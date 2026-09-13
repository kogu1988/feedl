// Sprint 70.1 — birden çok Inngest fonksiyonunun paylaştığı sabitler ve yardımcılar.
import { type WebhookEventName } from "@/lib/webhooks/dispatch";


// plan.md Sprint 5: cosine adayları LLM ile çift doğrulanır (prompts.md §2);
// LLM "DUPLICATE" derse yeni post duplicate işaretlenir. Eşik kalibrasyonu
// canlı veriyle revize edildi (2026-09-01): gerçek yakın-kopya çift 0.547,
// alakasız-generic çiftler 0.489'a kadar çıkabiliyor → 0.60 kaçırdı, 0.45
// iki bandı ayırır. Post başına en fazla 1 LLM karşılaştırması olduğu için
export const MAX_CORPUS = 60;
// düşük eşiğin maliyeti sınırlı; yanlış adayları LLM eler.
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.45;
export const DUPLICATE_CANDIDATE_LIMIT = 5;

export interface DuplicateCandidate {
  id: string;
  title: string;
  description: string;
  similarity: number;
}

// neon-http üzerindeki drizzle execute() sonucu sürüme göre ya satır dizisi
// ya da { rows } zarfı döndürebilir; ikisini de normalize et.
export function extractRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (
    result !== null &&
    typeof result === "object" &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

// Sprint 34 — webhook teslimatı: kaynak Inngest olaylarını noktalı webhook
// olay adlarına çevirip abone endpoint'lere imzalı POST atar (analiz raporu
// P4.2). Her endpoint ayrı step: tek hata yalnızca kendi teslimatını retry
// eder. Sprint 43: matrix tamamlandı — oy/yorum silme + duyuru olayları da
// eklenir ve payload teslimat öncesi zenginleştirilir (lib/webhooks/payload).
export const WEBHOOK_EVENT_MAP: Record<string, WebhookEventName> = {
  "post/created": "post.created",
  "post/status.changed": "post.status_changed",
  "post/comment.created": "comment.created",
  "post/comment.deleted": "comment.deleted",
  "vote/created": "vote.created",
  "vote/deleted": "vote.deleted",
  "changelog/published": "changelog.published",
};
