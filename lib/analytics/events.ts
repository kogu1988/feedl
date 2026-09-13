import "server-only";

import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { getDb } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import type { AnalyticsEventName, AnalyticsProps } from "./names";

// Taksonomi `./names` içinde (client da okur). Burada yeniden dışa verilir ki
// çağrı yerleri tek import noktası kullansın.
export { ANALYTICS_EVENTS } from "./names";
export type { AnalyticsEventName, AnalyticsProps } from "./names";

// Sprint 65 (2026-09-13) — BİRİNCİ TARAF ÜRÜN ANALİTİĞİ (SUNUCU).
//
// Neden kendi tablo (GA4 değil): ad-blocker client olaylarını düşürür, vendor
// lock ve sorgulanabilirlik sorunu olur, PII kontrolü bizde kalmalı. GA4 yalnız
// anonim üst-funnel (visitor) için ayrıca mirror edilir — bkz. lib/analytics/client.ts.
//
// TASARIM KURALI: `trackEvent` **fire-and-forget**'tir. Analitik hiçbir zaman
// ana iş akışını kırmaz, geciktirmez veya yavaşlatmaz:
//   - `await` EDİLMEZ (çağrı yerleri `void trackEvent(...)`).
//   - Hata yutulur + Sentry'ye `area=analytics` ile düşer (gözlemlenebilirlik).
//   - DB yoksa (build/prerender) sessizce no-op olur.

export interface TrackEventOptions {
  workspaceId?: string | null;
  userId?: string | null;
  props?: AnalyticsProps;
}

// PII savunması (derinlemesine): prop DEĞERLERİNİN şeklini değil, KABA
// içeriğini denetler. E-posta benzeri veya çok uzun serbest metin değerlerini
// yazmadan önce kırpar. Bu, çağrı yerini değiştirmekle açılabilecek bir
// sızıntıyı yapısal olarak engeller (host kapısındaki savunmayla aynı felsefe).
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MAX_VALUE_LEN = 120;

function sanitizeProps(props: AnalyticsProps | undefined): AnalyticsProps | null {
  if (!props) return null;
  const clean: AnalyticsProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string") {
      // E-posta benzeri ya da aşırı uzun değer = muhtemel serbest metin/PII.
      if (EMAIL_RE.test(value)) continue;
      clean[key] =
        value.length > MAX_VALUE_LEN ? value.slice(0, MAX_VALUE_LEN) : value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
    }
    // Diğer tipler (nesne/dizi/null) bilinçli olarak atlanır.
  }
  return Object.keys(clean).length > 0 ? clean : null;
}

// Gerçek yazım (iç). Hata yutulur + Sentry'ye düşer; analitik asla akışı kırar.
async function writeEvent(
  name: AnalyticsEventName,
  options: TrackEventOptions,
): Promise<void> {
  try {
    await getDb()
      .insert(analyticsEvents)
      .values({
        name,
        workspaceId: options.workspaceId ?? null,
        userId: options.userId ?? null,
        props: sanitizeProps(options.props),
      });
  } catch (err) {
    // Sessizce yut ama görünmez de olma: Sentry'de area=analytics etiketiyle
    // toplanır (kural eklenirse alarm da kurulur).
    try {
      Sentry.captureException(err, { tags: { area: "analytics", event: name } });
    } catch {
      /* Sentry yoksa ana akışı bozma */
    }
  }
}

/**
 * Bir huni olayını kaydeder. **Ateşle-ve-unut** — çağrı yerinde `await`
 * ETMEYİN.
 *
 * NEDEN `after()` (next/server) ve çıplak `void` DEĞİL: Vercel serverless'ta
 * yanıt gönderildikten sonra fonksiyon sonlandırılabilir; `void promise`
 * biçimindeki bir yazım sessizce KAYBOLUR (huninin tam olarak ölçmek istediği
 * şey eksik kalır). `after()` işi yanıttan SONRA çalıştırır ama lambda'yı
 * bitene kadar canlı tutar → ne gecikme ne kayıp.
 *
 * İstek bağlamı yoksa (build/prerender, ya da `after` desteklemeyen bağlam)
 * çıplak yazıma düşer; DB de yoksa sessizce no-op olur.
 */
export function trackEvent(
  name: AnalyticsEventName,
  options: TrackEventOptions = {},
): void {
  try {
    after(() => writeEvent(name, options));
  } catch {
    // `after()` istek bağlamı dışında fırlar — akışı bozma, doğrudan dene.
    void writeEvent(name, options);
  }
}

// Test edilebilirlik için iç yardımcıyı da dışa ver (saf fonksiyon).
export const __sanitizeProps = sanitizeProps;
