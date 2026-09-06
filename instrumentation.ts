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
