import * as Sentry from "@sentry/nextjs";

// Sprint 63w (B1) — Sentry server init. SENTRY_DSN yoksa no-op (build/runtime
// kırmaz); DSN eklendiğinde capture başlar. tracesSampleRate üretimde düşürülebilir.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
});
