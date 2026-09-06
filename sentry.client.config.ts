import * as Sentry from "@sentry/nextjs";

// Sprint 63w (B1) — Sentry client (browser) init. Replays kapalı (performans).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
