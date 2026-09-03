import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { apiKeys, type ApiKey } from "@/lib/db/schema";

// Sprint 34 — Public API (P4.2). Anahtar biçimi fk_live_<32 hex>; tam
// anahtar yalnızca oluşturma anında döner, DB'de yalnızca SHA-256 karması
// tutulur (analiz raporu: "hash'lenmiş ve rotate edilebilir").

export function generateApiKey(): {
  key: string;
  prefix: string;
  keyHash: string;
} {
  const key = `fk_live_${randomBytes(16).toString("hex")}`;
  return { key, prefix: key.slice(0, 12), keyHash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(12).toString("hex")}`;
}

// Bearer anahtarını doğrular; geçerli (revoke edilmemiş) kaydı döner.
// Ağır hash gerekmez (anahtar yüksek entropili), SHA-256 yeterlidir.
export async function authenticateApiKey(
  req: Request,
): Promise<ApiKey | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer (fk_live_[0-9a-f]{32})$/.exec(header);
  if (!match) {
    return null;
  }
  const [record] = await getDb()
    .select()
    .from(apiKeys)
    .where(
      and(eq(apiKeys.keyHash, hashApiKey(match[1])), isNull(apiKeys.revokedAt)),
    )
    .limit(1);
  return record ?? null;
}

// MVP rate limit: süreç-içi kayan pencere, dakikada 60 istek/anahtar.
// Serverless'ta instance başına best-effort'tur (kesin sınır değildir);
// ileride paylaşımlı store (Upstash vb.) bağlanabilir.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const buckets = new Map<string, number[]>();

export function checkRateLimit(keyId: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const hits = (buckets.get(keyId) ?? []).filter((t) => t > windowStart);
  if (hits.length >= RATE_LIMIT_MAX) {
    buckets.set(keyId, hits);
    return {
      allowed: false,
      retryAfterSec: Math.ceil(
        (hits[0] + RATE_LIMIT_WINDOW_MS - now) / 1000,
      ),
    };
  }
  hits.push(now);
  buckets.set(keyId, hits);
  // Bellek büyümesin: penceresi tamamen boşalmış kovaları temizle.
  if (buckets.size > 1000) {
    for (const [id, times] of buckets) {
      if (times.every((t) => t <= windowStart)) {
        buckets.delete(id);
      }
    }
  }
  return { allowed: true, retryAfterSec: 0 };
}

// v1 yanıtlarında ortak envelope kullanılır; 401/429 hataları için hazır
// NextResponse üretici burada durur ki her route aynı biçimi versin.
export const API_KEY_ERRORS = {
  unauthorized: { success: false, error: "Geçersiz API anahtarı." },
  rateLimited: (sec: number) => ({
    success: false,
    error: `İstek limiti aşıldı. ${sec} saniye sonra tekrar deneyin.`,
  }),
} as const;
