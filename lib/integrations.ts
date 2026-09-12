import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { decryptSecret, encryptSecret } from "@/lib/encrypt";
import { workspaceIntegrations, workspaces } from "@/lib/db/schema";

// Sprint 63g — per-workspace entegrasyon deseni (Linear/Jira'dan genelleştirildi).
// Slack / Zendesk / Intercom / Linear hepsi workspace_integrations'a yazılır;
// provider benzersiz (workspace+provider). Per-workspace webhook URL'sine
// ?ws=<slug>&t=<urlToken> gömülür — handler hangi workspace olduğunu ve
// ilgili credential'ı buradan çözer (env fallback yerine).
export type IntegrationProvider = "linear" | "jira" | "slack" | "zendesk" | "intercom";

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  "linear",
  "jira",
  "slack",
  "zendesk",
  "intercom",
];

// Yeni per-workspace token üret (Linear'ın aynı modeli).
// 24 byte rastgele → 48 hex karakter; tahmin edilemez, URL'ye gömülür.
export function randomIntegrationToken(): string {
  return randomBytes(24).toString("hex");
}

// URL token karşılaştırması ZAMAN-SABİT olmalı. Düz `a !== b` erken çıkış yapar
// ve teorik olarak karakter-karakter zamanlamadan token sızdırır; bu repoda
// widget JWT'si de `timingSafeEqual` kullanıyor (lib/widget/jwt.ts). HTTP
// üzerinden pratikte zor olsa da aynı standart burada da uygulanır.
// Uzunluk farkı `timingSafeEqual`'ı fırlatacağı için önce boyut karşılaştırılır
// (boyut zaten genel bilgi).
export function urlTokenMatches(
  stored: string | null | undefined,
  provided: string,
): boolean {
  if (!stored || !provided) return false;
  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Legacy (parametresiz) gelen webhook yolu ve global env secret fallback'i
// 2026-09-12 (Faz 3) itibarıyla EMEKLİYE AYRILDI. Emeklilik kararı ölçülerek
// verildi: 90 günde Sentry'de `area=integrations` uyarısı yok ve bağlı
// entegrasyon sayısı 0. Tüm handler'lar artık `?ws=&t=` parametrelerini
// ZORUNLU tutar; eksikse 403 döner. Bu sayede global secret'a düşen tek
// sızıntı noktası ortadan kalktı.

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
}

// Provider → webhook handler yolu (Slack /events, diğerleri /webhook).
const PROVIDER_WEBHOOK_PATH: Record<IntegrationProvider, string> = {
  linear: "/api/integrations/linear/webhook",
  jira: "/api/integrations/jira/webhook",
  slack: "/api/integrations/slack/events",
  zendesk: "/api/integrations/zendesk/webhook",
  intercom: "/api/integrations/intercom/webhook",
};

// Per-workspace webhook URL'si: ?ws=<slug>&t=<urlToken>.
export function integrationWebhookUrl(
  provider: IntegrationProvider,
  slug: string,
  urlToken: string,
): string {
  const path = PROVIDER_WEBHOOK_PATH[provider];
  return `${appUrl()}${path}?ws=${encodeURIComponent(slug)}&t=${encodeURIComponent(urlToken)}`;
}

// Kurulum detayını kaydet (upsert: workspace+provider).
// apiKey → dış servis erişim anahtarı/credential; webhookSecret → imza anahtarı;
// urlToken → per-workspace token; extra → provider'a özel alanlar (webhookId vs.).
export async function saveIntegration(
  provider: IntegrationProvider,
  data: {
    apiKey?: string | null;
    webhookSecret?: string | null;
    urlToken?: string | null;
    webhookId?: string | null;
    resourceTypes?: string[] | null;
    baseUrl?: string | null;
    accountEmail?: string | null;
    status?: string;
  },
): Promise<{ id: string; urlToken: string }> {
  const workspaceId = await getWorkspaceId();
  const urlToken = data.urlToken ?? randomIntegrationToken();
  // Sprint 63t — dış servis API key / webhook secret SHA üretimi değil,
  // AES-256-GCM ile şifrelenir (ENCRYPTION_KEY). Kurulu değilse düz saklanır.
  const [created] = await getDb()
    .insert(workspaceIntegrations)
    .values({
      workspaceId,
      provider,
      apiKey: data.apiKey ? encryptSecret(data.apiKey) : null,
      webhookSecret: data.webhookSecret ? encryptSecret(data.webhookSecret) : null,
      urlToken,
      webhookId: data.webhookId ?? null,
      resourceTypes: data.resourceTypes ?? null,
      baseUrl: data.baseUrl ?? null,
      accountEmail: data.accountEmail ?? null,
      status: data.status ?? "connected",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [workspaceIntegrations.workspaceId, workspaceIntegrations.provider],
      set: {
        apiKey: data.apiKey ? encryptSecret(data.apiKey) : null,
        webhookSecret: data.webhookSecret ? encryptSecret(data.webhookSecret) : null,
        urlToken,
        webhookId: data.webhookId ?? null,
        resourceTypes: data.resourceTypes ?? null,
        baseUrl: data.baseUrl ?? null,
        accountEmail: data.accountEmail ?? null,
        status: data.status ?? "connected",
        updatedAt: new Date(),
      },
    })
    .returning({ id: workspaceIntegrations.id, urlToken: workspaceIntegrations.urlToken });
  return { id: created.id, urlToken: created.urlToken ?? urlToken };
}

// Mevcut kaydı oku (public bilgi: status + webhook url; credential döndürme).
export async function readIntegrationStatus(provider: IntegrationProvider) {
  const workspaceId = await getWorkspaceId();
  const [slugRow] = await getDb()
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const slug = slugRow?.slug ?? "feedl";
  const [row] = await getDb()
    .select({
      status: workspaceIntegrations.status,
      resourceTypes: workspaceIntegrations.resourceTypes,
      webhookId: workspaceIntegrations.webhookId,
      urlToken: workspaceIntegrations.urlToken,
      createdAt: workspaceIntegrations.createdAt,
    })
    .from(workspaceIntegrations)
    .where(
      and(
        eq(workspaceIntegrations.workspaceId, workspaceId),
        eq(workspaceIntegrations.provider, provider),
      ),
    )
    .limit(1);
  return {
    status: row?.status ?? null,
    webhookId: row?.webhookId ?? null,
    createdAt: row?.createdAt ?? null,
    webhookUrl: row?.urlToken ? integrationWebhookUrl(provider, slug, row.urlToken) : null,
  };
}

// Bağlantıyı kes (kaydı sil). Dış serviste webhook silme, provider'a özel
// DELETE route'unda yapılır (Linear gibi); burada kayıt kaldırılır.
export async function deleteIntegration(provider: IntegrationProvider) {
  await getDb()
    .delete(workspaceIntegrations)
    .where(
      and(
        eq(workspaceIntegrations.workspaceId, await getWorkspaceId()),
        eq(workspaceIntegrations.provider, provider),
      ),
    );
}

// Webhook handler'ı için: ?ws&t ile kaydı çöz (secret + workspace id).
export async function resolveIntegrationByUrlToken(
  provider: IntegrationProvider,
  slug: string,
  urlToken: string,
) {
  const [row] = await getDb()
    .select({
      id: workspaceIntegrations.id,
      workspaceId: workspaceIntegrations.workspaceId,
      apiKey: workspaceIntegrations.apiKey,
      webhookSecret: workspaceIntegrations.webhookSecret,
      resourceTypes: workspaceIntegrations.resourceTypes,
      urlToken: workspaceIntegrations.urlToken,
      baseUrl: workspaceIntegrations.baseUrl,
      accountEmail: workspaceIntegrations.accountEmail,
      webhookId: workspaceIntegrations.webhookId,
    })
    .from(workspaceIntegrations)
    .innerJoin(workspaces, eq(workspaces.id, workspaceIntegrations.workspaceId))
    .where(
      and(
        eq(workspaceIntegrations.provider, provider),
        eq(workspaces.slug, slug),
      ),
    )
    .limit(1);
  if (!row) return null;
  // Token zaman-sabit karşılaştırılır; DB'de token yoksa (`!stored`) asla
  // eşleşmez (boş token'lı kayıt kapıyı açamaz).
  if (!urlTokenMatches(row.urlToken, urlToken)) {
    return null;
  }
  // Sprint 63t — şifreli saklanan credential'ları çöz (mevcut düz satırlar
  // aynen döner; yanlış anahtarda null → webhook güvenli reddeder).
  return {
    ...row,
    apiKey: decryptSecret(row.apiKey),
    webhookSecret: decryptSecret(row.webhookSecret),
  };
}
