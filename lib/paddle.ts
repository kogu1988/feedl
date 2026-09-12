import "server-only";

import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { z } from "zod";

// Sprint 48h (Faz 5) — Paddle entegrasyonu. Environment seçimi (sandbox/live)
// + plan tanımları + imza doğrulama. Fiyatlar Paddle'da `feedl_` önekli
// oluşturuldu ($19/ay, $15/ay yıllık) ve 2026-09-12 itibarıyla CANLI (live)
// ortamda aktiftir; ortam `PADDLE_ENV` ile seçilir (varsayılan live).

export const PADDLE_ENV = process.env.PADDLE_ENV === "sandbox" ? "sandbox" : "live";

export function getPaddle(): Paddle | null {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) return null;
  return new Paddle(apiKey, {
    environment: PADDLE_ENV === "sandbox" ? Environment.sandbox : Environment.production,
  });
}

// Plan tanımları: free/pro limitleri. Pro'da limitsiz(∞) tutulur.
export type PlanKey = "free" | "pro";

export const PLANS: Record<
  PlanKey,
  { key: PlanKey; label: string; trackedUserLimit: number; boardLimit: number; memberLimit: number }
> = {
  free: { key: "free", label: "Free", trackedUserLimit: 50, boardLimit: 1, memberLimit: 1 },
  pro: { key: "pro", label: "Pro", trackedUserLimit: Number.MAX_SAFE_INTEGER, boardLimit: Number.MAX_SAFE_INTEGER, memberLimit: 10 },
};

export function planFromString(value: string | null | undefined): PlanKey {
  return value === "pro" ? "pro" : "free";
}

// Paddle abonelik status'undan plan türet (TEST EDİLEBİLİR saf fonksiyon).
// Sprint 52/60 kuralı: trialing/active → pro; canceled/paused/past_due/dunned
// /expired → free; diğer (bilinmeyen) → null (yoksay, durum yine saklanır).
// Webhook route ve testler bu tek kaynağı kullanır.
export function derivePlanFromStatus(
  status: string | null | undefined,
): "pro" | "free" | null {
  if (!status) return null;
  if (status === "trialing" || status === "active") return "pro";
  if (
    status === "canceled" ||
    status === "paused" ||
    status === "past_due" ||
    status === "dunned" ||
    status === "expired"
  ) {
    return "free";
  }
  return null;
}

// 2026-09-12 (denetim K3) — DUNNING GRACE.
//
// `derivePlanFromStatus` ödeme sorununu (`past_due`/`dunned`) ANINDA `free`
// yapıyordu: kartı geçmeyen müşteri, Paddle daha yeniden denemeye fırsat
// bulamadan Pro'yu kaybediyordu — entegrasyonları durur, custom domain düşer,
// private board'ları görünmez olur. Sektör standardı birkaç günlük grace'tir.
export const DUNNING_GRACE_DAYS = 7;

// Erişimi hemen kesmeyen ödeme-sorunu durumları (grace başlatır).
export function isDunningStatus(status: string | null | undefined): boolean {
  return status === "past_due" || status === "dunned";
}

// ETKİN plan — tüm Pro kapıları BUNU kullanmalı (tek kaynak).
//
// Grace okuma anında hesaplanır: penceresi dolduğunda Paddle hiçbir olay
// göndermez, dolayısıyla yalnız saklanan `plan` alanına bakmak "süre bitti"
// anını yakalayamaz (ve bunun için ayrı bir cron'a bağımlı kalmak istemiyoruz).
//
// Kural: saklanan plan pro ise pro (Paddle zaten senkronlar). Aksi hâlde ödeme
// sorunu YENİ başladıysa grace boyunca pro kalır, süre dolunca free'ye düşer.
// Zaman damgası yoksa güvenli taraf: free.
export function effectivePlanKey(
  row: {
    plan?: string | null;
    paddleSubscriptionStatus?: string | null;
    paddleStatusChangedAt?: Date | string | null;
  },
  now: Date = new Date(),
): PlanKey {
  if (planFromString(row.plan) === "pro") return "pro";
  if (!isDunningStatus(row.paddleSubscriptionStatus)) return "free";
  const startedAt = row.paddleStatusChangedAt
    ? new Date(row.paddleStatusChangedAt)
    : null;
  if (!startedAt || Number.isNaN(startedAt.getTime())) return "free";
  return now.getTime() - startedAt.getTime() < DUNNING_GRACE_DAYS * 24 * 60 * 60 * 1000
    ? "pro"
    : "free";
}

// Workspace'te güncel limitler (plan'a göre; DB'de saklanan limit alanlarını
// PLANS ile birleştirir). plan free ise PLANS.free, pro ise PLANS.pro.
import { getWorkspaceId } from "@/lib/db/workspace";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { workspaces } from "@/lib/db/schema";

// Request-scoped memo: aynı istek içinde getPlanLimits bir kez DB okur
// (plan limitleri sık sorulur; sayfa içinde kopya sorguyu önler).
const fetchPlanLimits = cache(async () => {
  const [row] = await getDb()
    .select({
      plan: workspaces.plan,
      paddleSubscriptionStatus: workspaces.paddleSubscriptionStatus,
      paddleStatusChangedAt: workspaces.paddleStatusChangedAt,
    })
    .from(workspaces)
    .where(eq(workspaces.id, await getWorkspaceId()))
    .limit(1);
  // Dunning grace dahil (denetim K3) — tüm Pro kapılarının tek kaynağı.
  return PLANS[effectivePlanKey(row ?? {})];
});

export async function getPlanLimits() {
  return fetchPlanLimits();
}

// Bir workspace için kaynak sayısı limit aşımı kontrolü.
export async function enforceLimit(
  kind: "board" | "member" | "trackedUser",
  currentCount: number,
): Promise<{ ok: boolean; limit: number; message?: string }> {
  const plan = await getPlanLimits();
  const limit =
    kind === "board"
      ? plan.boardLimit
      : kind === "member"
        ? plan.memberLimit
        : plan.trackedUserLimit;
  const ok = currentCount < limit;
  return {
    ok,
    limit,
    message: ok
      ? undefined
      : `${plan.label} planında ${kind === "board" ? "board" : kind === "member" ? "üye" : "takipçi"} sınırı aşıldı (${limit}). Yükseltmek için Pro planına geç.`,
  };
}

// Paddle webhook imza doğrulama. Paddle bir `Paddle-Signature` header'ı gönderir
// (format: ts=<epoch>;h1=<hex>); payload'ın HMAC-SHA256'sı secret ile doğrulanır.
//
// ÜRETİM YOLU `isValidPaddleSignature`'dır (aşağıda, SDK). Bu manuel v1 HMAC
// implementasyonu bilinçli olarak KORUNUR:
//  • SDK'ya bağımlı olmayan, saf HMAC'li bir yedek yol (SDK davranışı
//    değişirse/erişilemezse `verifyPaddleWebhook` buna çevrilebilir),
//  • testleri mevcut: tests/lib/paddle-signature.test.ts (4 vaka) — yani
//    "ölü kod" değil, test edilmiş bir yedek. Silmek testli bir güvenlik
//    yolunu kaldırır (2026-09-12 kod incelemesi kararı: kalsın).
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPaddleSignature(payload: string, signatureHeader: string): boolean {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return false;
  // Paddle formatı: ts=...;h1=<hex> (v1).
  const match = /ts=(\d+);h1=([a-f0-9]+)/.exec(signatureHeader);
  if (!match) return false;
  const [, ts, h1] = match;
  const expected = createHmac("sha256", secret)
    .update(`${ts}:${payload}`)
    .digest("hex");
  try {
    const a = Buffer.from(h1, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Paddle webhook imza doğrulama. Paddle (v1) `Paddle-Signature` header'ı gönderir
// (ts=<epoch>;h1=<hex>), payload'ın HMAC-SHA256'sı notification SIGNING SECRET
// ile doğrulanır (5sn tolerans). Burada imzayı resmi SDK `isSignatureValid` ile
// doğrular (yalnızca HMAC), ardından raw body'yi kendimiz JSON.parse edip lenient
// alan çıkarırız. SDK `unmarshal` (imza + katı event constructor) gerçek Paddle
// payload'larını bazen `.map` şema hatasıyla reddedebildiğinden, event şemasını
// handler toleranslı alır — imza doğrulama tek gerçek güven sınırıdır.
export async function isValidPaddleSignature(rawBody: string, signature: string): Promise<boolean> {
  const paddle = getPaddle();
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!paddle || !secret) return false;
  try {
    return await paddle.webhooks.isSignatureValid(rawBody, secret, signature);
  } catch {
    return false;
  }
}

export async function verifyPaddleWebhook(
  rawBody: string,
  signature: string,
): Promise<{ eventType: string; data: Record<string, unknown> } | null> {
  if (!(await isValidPaddleSignature(rawBody, signature))) return null;
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      eventType: (parsed.event_type as string | undefined) ?? (parsed.type as string | undefined) ?? "",
      data: (parsed.data as Record<string, unknown> | undefined) ?? {},
    };
  } catch {
    return null;
  }
}

// Webhook event'lerinin çoğu (subscription.*) sadece `customer_id` taşır; e-posta
// `customer.created/updated` event'inde gelir. Eksikse Paddle API'den (`GET
// /customers/{id}`) çeker ve email'i doldurur. Webhook yolu için kullanılır.
export async function fetchCustomerEmail(customerId: string): Promise<string | null> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey || !customerId) return null;
  try {
    const res = await fetch(`https://api.paddle.com/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: { email?: string } };
    return j.data?.email ?? null;
  } catch {
    return null;
  }
}

// Paddle webhook `data` gövdesi (2026-09-12 kod incelemesi).
//
// Neden katı bir şema DEĞİL: Paddle event tipine göre farklı alanlar gönderir
// ve parse hatası webhook'u düşürür → `workspaces.plan` senkronu durur
// (billing'in kritik yolu). Bu yüzden her yaprak `.catch(undefined)` ile
// yazılır: beklenmeyen tip gelirse alan `undefined` olur, parse ASLA patlamaz.
// Kazanç: `as string` cast'leri ve `??` zincirleri kaybolur; alanlar tek
// kaynaktan tiplenir (eski `paddleSubscriptionSchema` kullanılmıyordu — kaldırıldı).
const optionalString = z.string().optional().catch(undefined);

export const paddleWebhookDataSchema = z.object({
  id: optionalString,
  subscription_id: optionalString,
  status: optionalString,
  customer_id: optionalString,
  email: optionalString,
  price_id: optionalString,
  product_id: optionalString,
  customer: z
    .object({ id: optionalString, email: optionalString })
    .optional()
    .catch(undefined),
  items: z
    .array(
      z.object({
        price: z
          .object({ id: optionalString, product_id: optionalString })
          .optional()
          .catch(undefined),
      }),
    )
    .optional()
    .catch(undefined),
  custom_data: z
    .object({ slug: optionalString, workspace_id: optionalString })
    .optional()
    .catch(undefined),
  scheduled_change: z
    .object({ action: optionalString, effective_at: optionalString })
    .optional()
    .catch(undefined),
});

export type PaddleWebhookData = z.infer<typeof paddleWebhookDataSchema>;
