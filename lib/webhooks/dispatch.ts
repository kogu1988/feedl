import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { decryptSecret } from "@/lib/encrypt";
import { webhookEndpoints } from "@/lib/db/schema";

// Sprint 34 — webhook teslimatı (analiz raporu P4.2). İmza şeması:
// HMAC-SHA256 `${timestamp}.${body}` üzerinden endpoint secret'ı ile,
// header: X-Feedl-Signature: t=<unix-ts>,v1=<hex>. Alıcı kendi tarafında
// ham body üzerinde aynı hesabı yaparak doğrular. Teslimat Inngest
// fonksiyonundan (send-webhooks) yapılır; non-2xx throw → Inngest retry.

// Sprint 43 (PM raporu §9 full API/webhook event matrix): tüm alan olayları
// webhook'a taşınır — oluşturma/durum/yorum + oy ekle-geri al + yorum sil +
// duyuru. post.deleted yok (fikir silme akışı yok; birleştirme ile kapanır).
export const WEBHOOK_EVENTS = [
  "post.created",
  "post.status_changed",
  "comment.created",
  "comment.deleted",
  "vote.created",
  "vote.deleted",
  "changelog.published",
] as const;

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookEndpointRow {
  id: string;
  url: string;
  secret: string;
}

// Olaya abone, aktif endpoint'ler. events varchar[] @> tek elemanlı dizi.
//
// Secret DB'de ŞİFRELİ tutulur (`encryptSecret`, 2026-09-12 incelemesi: eskiden
// düz metindi). İmzalamak için burada çözülür. Geçiş güvenli: `decryptSecret`
// şifreli olmayan eski satırları aynen döner. Şifreli ama ÇÖZÜLEMEYEN satır
// (anahtar değişmiş/bozuk veri) teslim edilmez — aksi halde ciphertext ile
// imzalanır ve alıcı 401 verir; sessizce yanlış imza üretmek yerine atlanır.
export async function loadWebhookEndpoints(
  eventName: WebhookEventName,
): Promise<WebhookEndpointRow[]> {
  const rows = await getDb()
    .select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      secret: webhookEndpoints.secret,
    })
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.workspaceId, await getWorkspaceId()),
        eq(webhookEndpoints.active, true),
        sql`${webhookEndpoints.events} @> ARRAY[${eventName}]::varchar[]`,
      ),
    );

  return rows.flatMap((row) => {
    const secret = decryptSecret(row.secret);
    if (!secret) {
      console.error(
        `[webhook] endpoint ${row.id}: secret çözülemedi (anahtar değişmiş olabilir) — atlanıyor`,
      );
      return [];
    }
    return [{ id: row.id, url: row.url, secret }];
  });
}

export function signWebhookPayload(secret: string, body: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const hmac = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

// Tek endpoint'e imzalı POST. Zaman aşımı 10s; non-2xx Inngest'in retry
// etmesi için throw eder.
export async function deliverWebhook(
  endpoint: WebhookEndpointRow,
  eventName: WebhookEventName,
  data: unknown,
): Promise<void> {
  const body = JSON.stringify({
    id: randomUUID(),
    event: eventName,
    createdAt: new Date().toISOString(),
    data,
  });
  const signature = signWebhookPayload(endpoint.secret, body);
  const res = await fetch(endpoint.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "feedl-webhooks/1.0",
      "X-Feedl-Signature": signature,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Webhook teslimatı başarısız: HTTP ${res.status}`);
  }
}

// Birden çok endpoint'e BAĞIMSIZ teslimat: bir endpoint'in hatası
// diğerlerinin teslimatını ENGELLEMEZ. Hatalar toplanır, çağıran taraf
// (Inngest fonksiyonu) sonunda tek seferde fırlatıp retry'ı tetikler.
//
// Neden: eski akış `for (endpoint) { await step.run(...) }` idi ve ilk hata
// döngüyü kırıyordu → tek bir ölü endpoint, listede kendisinden SONRAKİ tüm
// endpoint'leri kalıcı olarak aç bırakıyordu (2026-09-11'de canlıda
// gözlemlendi: send-webhooks 9/9 failed).
export async function deliverToAllEndpoints(
  endpoints: WebhookEndpointRow[],
  // Dönüş değeri kullanılmaz; Inngest `step.run` void yerine `null`
  // döndürebildiği için `unknown` kabul edilir.
  deliver: (endpoint: WebhookEndpointRow) => Promise<unknown>,
): Promise<{ delivered: number; failed: string[] }> {
  let delivered = 0;
  const failed: string[] = [];
  for (const endpoint of endpoints) {
    try {
      await deliver(endpoint);
      delivered += 1;
    } catch (err) {
      failed.push(endpoint.id);
      console.error(
        `Webhook teslimatı başarısız (endpoint ${endpoint.id}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { delivered, failed };
}
