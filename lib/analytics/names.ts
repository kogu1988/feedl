// Sprint 65 — Olay taksonomisi (TEK KAYNAK).
//
// Bu modül bilinçli olarak `server-only` DEĞİL: hem sunucu (`lib/analytics/events.ts`)
// hem client (`lib/analytics/client.ts`) aynı ada kümesini okur. Kural iki yere
// kopyalanırsa sessizce ayrışır — bu repoda tekrar eden bir bug sınıfıdır
// (bkz. lib/widget/embed.ts başlığındaki aynı gerekçe).
//
// Her adım `docs/FEEDL-ROADMAP.md` §4 hunisindeki bir düğüme karşılık gelir.
// Yeni bir olay eklerken ÖNCE buraya yaz — serbest string yazmak huniyi
// sessizce böler (yanlış yazılmış bir ad, sorguda hiç görünmez).
export const ANALYTICS_EVENTS = [
  "visitor", // client — anonim ziyaretçi (GA mirror)
  "signup", // Clerk user.created
  "workspace_created", // onboarding
  "feedback_added", // portal veya widget fikir oluşturma
  "customer_linked", // şirket kaydı (gelir bağlamı 1/2)
  "revenue_added", // fırsat kaydı (gelir bağlamı 2/2)
  "priority_viewed", // gelir skoru/öncelik görüntüleme
  "upgrade_clicked", // Pro'ya geç CTA
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

// Prop değerleri: yalnız opak id, sayı ve bool. Serbest metin KABUL EDİLMEZ —
// en sık PII sızıntısı yolu budur (birisi yanlışlıkla e-posta yazar).
export type AnalyticsProps = Record<string, string | number | boolean>;
