import "server-only";

import { NextResponse } from "next/server";

import { checkRateLimit, type RateLimitResult } from "@/lib/api-keys";

// Sprint 60 (rate limit hardening) — Claude #1. `checkRateLimit` (Upstash
// + in-process fallback, `feedl:rl` prefix) zaten jeneriktir; bu yardımcı
// katmanı ona standart 429 + Retry-After + Türkçe mesaj + IP çözümlemesi
// sağlar ve API-key olmayan bağlamlarda (auth'lu kullanıcı, widget session,
// IP) aynı limiter'ı tekrar kullanılabilir kılar.

// Standart Türkçe 429 yanıtı (Retry-After header'lı).
export function rateLimitResponse(
  rl: RateLimitResult,
  limit?: number,
): NextResponse {
  const res = NextResponse.json(
    {
      success: false,
      error: `İstek limiti aşıldı. ${rl.retryAfterSec} saniye sonra tekrar deneyin.`,
    },
    { status: 429 },
  );
  res.headers.set("Retry-After", String(Math.max(1, rl.retryAfterSec)));
  res.headers.set("X-RateLimit-Limit", String(limit ?? 60));
  return res;
}

// İsteğin istemci IP'si (x-forwarded-for ilk değer; yoksa uzak adres).
export function clientIpFrom(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip")?.trim() ?? "unknown";
}

// Anahtar oluşturucu: `feedl:rl:<scope>:<id>` (Upstash prefix'i lib/api-keys
// zaten ekler; tutarlılık için scope'lu anahtar burada birleştirilir).
export function rateKey(scope: string, id: string): string {
  return `${scope}:${id}`;
}

// Basit helper: limiter'ı çağır, limit aşıldıysa 429 dön. Opsiyonel limit/window
// scope bazında sıkılaştırma sağlar (örn. widget triage — LLM maliyeti).
export async function enforceRateLimit(
  scope: string,
  id: string,
  opts?: { limit?: number; windowSec?: number },
): Promise<{ allowed: boolean; response?: NextResponse; rl?: RateLimitResult }> {
  const rl = await checkRateLimit(rateKey(scope, id), opts);
  if (!rl.allowed) {
    return { allowed: false, response: rateLimitResponse(rl, opts?.limit), rl };
  }
  return { allowed: true, rl };
}
