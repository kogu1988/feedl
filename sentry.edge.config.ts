import * as Sentry from "@sentry/nextjs";

// Sprint 63w (B1) — Sentry edge (middleware) init. DSN yoksa no-op.
// 2026-09-12 (denetim K2) — `captureConsoleIntegration` gerekçesi:
// sentry.server.config.ts.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});
