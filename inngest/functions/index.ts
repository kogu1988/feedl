// Sprint 70.1 — Inngest fonksiyonları TEK import noktası olarak buradan yayınlanır.
//
// Eski tek dosya (`inngest/functions.ts`, 1256 satır) sekiz fonksiyonu birden
// taşıyordu; okunması ve değiştirilmesi zordu. Artık her fonksiyon kendi
// sorumluluk dosyasında (`ai-autopilot.ts`, `notify-*.ts`, ...). Bu barrel,
// çağıran tarafı (`app/api/inngest/route.ts`) DEĞİŞTİRMEDEN korur.
export { aiAutopilot } from "./ai-autopilot";
export { notifyShipped } from "./notify-shipped";
export { notifyAdminNewPost } from "./notify-admin-new-post";
export { notifyCommentCreated } from "./notify-comment-created";
export { sendWebhooks } from "./send-webhooks";
export { notifyChangelog } from "./notify-changelog";
export { corpusInsights } from "./corpus-insights";
export { weeklyDigest } from "./weekly-digest";
