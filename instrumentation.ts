import * as Sentry from "@sentry/nextjs";

// Sprint 63w (B1) — Next.js instrumentation: runtime'a göre Sentry'yi başlat.
// DSN yoksa config no-op olur; eklenince otomatik capture başlar.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// 2026-09-12 (kod incelemesi #7) — Next.js `onRequestError` hook'u.
//
// Neden gerekli: `register()` yalnızca SDK'yı başlatır; route handler / RSC /
// server action içinde YAKALANMAYAN (unhandled) hatalar Sentry'ye bu hook
// olmadan HİÇ ulaşmaz. Canlı kanıt: feedl Sentry projesine 90 günde uygulama
// çalışma zamanından tek bir otomatik olay gelmemişti — açık `captureException`
// çağrıları (lib/ai/openrouter.ts) çalışıyordu ama otomatik yakalama yoktu.
// Next, bu export eksikse build sırasında uyarı da verir.
//
// Not: bu, LLM hattı için kurduğumuz açık uyarının tüm sunucu hatalarına
// yayılmış halidir; alert kuralı (bkz. README #13) artık daha geniş bir
// yüzeyi kapsar.
export const onRequestError = Sentry.captureRequestError;
