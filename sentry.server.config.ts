import * as Sentry from "@sentry/nextjs";

// Sprint 63w (B1) — Sentry server init. SENTRY_DSN yoksa no-op (build/runtime
// kırmaz); DSN eklendiğinde capture başlar. tracesSampleRate üretimde düşürülebilir.
//
// 2026-09-12 (denetim K2) — `captureConsoleIntegration`: uygulamada 183
// yakalanmış hata `console.error` ile loglanıp YUTULUYORDU; kullanıcı
// "Yüklenemedi" görüyor, Vercel log'una bir satır düşüyor, Sentry'ye HİÇBİR ŞEY
// gitmiyordu. Bu entegrasyon `console.error` çağrılarını Sentry olayına çevirir
// — 183 çağrı yerini tek tek değiştirmeden görünürlük kapanır. Yalnız `error`
// seviyesi alınır (`warn`/`log` gürültü olurdu).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});
