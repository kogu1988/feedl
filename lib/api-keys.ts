import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
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
// Security audit (Sprint 60): anahtar, host-bazlı getWorkspaceId() ile DEĞİL,
// yalnızca karmasıyla bulunur. Tenant'ın gerçek kaynağı **key.workspaceId**'dir
// — v1 route'ları işlemleri bu id ile scope'lar (gerçek çok kiracılı izolasyon;
// workspace B'nin anahtarı, host ne olursa olsun yalnızca workspace B'ye erişir).
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
      and(
        eq(apiKeys.keyHash, hashApiKey(match[1])),
        isNull(apiKeys.revokedAt),
      ),
    )
    .limit(1);
  // Revoke edilmiş anahtar geçerli sayılmaz.
  return record ?? null;
}

// Rate limit: dakikada 60 istek/anahtar. Upstash Redis env'leri varsa
// kayan pencere tüm serverless instance'lar arasında PAYLAŞILIR; yoksa
// (veya Upstash erişimi hata verirse) davranış eski süreç-içi pencereye
// düşer — aynı enveloğu korur, kesin sınır best-effort kalır.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

// Lazy singleton: env yoksa null, varsa Ratelimit. Modül başına bir kez
// kurulur; serverless instance'ı boyunca önbelleklenir. Sprint 60: farklı
// limit/window'lar için birden çok limiter önbellek (harita).
let sharedLimiters = new Map<string, Ratelimit>();
function getSharedLimiter(max: number, windowSec: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  const key = `${max}:${windowSec}`;
  const cached = sharedLimiters.get(key);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
    // Kullanıcı kuralı: paylaşılan Upstash alanında feedl öneki zorunlu.
    prefix: "feedl:rl",
  });
  sharedLimiters.set(key, limiter);
  return limiter;
}

const buckets = new Map<string, number[]>();

function inProcessRateLimit(
  keyId: string,
  max: number,
  windowSec: number,
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const windowStart = now - windowMs;
  const hits = (buckets.get(keyId) ?? []).filter((t) => t > windowStart);
  if (hits.length >= max) {
    buckets.set(keyId, hits);
    return {
      allowed: false,
      retryAfterSec: Math.ceil((hits[0] + windowMs - now) / 1000),
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

// Opsiyonel limit/window geçersiz kılma (Sprint 60) — farklı scope'lar farklı
// limit kullanabilsin. Varsayılan 60 istek/60s (geriye dönük uyumlu).
export async function checkRateLimit(
  keyId: string,
  opts?: { limit?: number; windowSec?: number },
): Promise<RateLimitResult> {
  const max = opts?.limit ?? RATE_LIMIT_MAX;
  const windowSec = opts?.windowSec ?? RATE_LIMIT_WINDOW_MS / 1000;
  const limiter = getSharedLimiter(max, windowSec);
  if (limiter) {
    try {
      const { success, reset } = await limiter.limit(keyId);
      // reset: epoch saniye (unix timestamp).
      return {
        allowed: success,
        retryAfterSec: success
          ? 0
          : Math.max(1, reset - Math.floor(Date.now() / 1000)),
      };
    } catch (err) {
      console.error(
        "Upstash rate limit failed, using in-process fallback:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  return inProcessRateLimit(keyId, max, windowSec);
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
