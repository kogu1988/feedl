import * as Sentry from "@sentry/nextjs";

// Sprint 63w (B1) — Sentry edge (middleware) init. DSN yoksa no-op.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
});
