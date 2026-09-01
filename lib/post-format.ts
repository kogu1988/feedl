// Post durumu etiketleri, tarih formatı ve kart metin yardımcıları —
// portal, roadmap, dialog ve CSV export'un ortak kaynağı (durum etiketleri
// canny.md §2'deki akışa karşılık gelir).

export const statusLabels: Record<string, string> = {
  open: "Açık",
  planned: "Planlandı",
  "in-progress": "Geliştiriliyor",
  shipped: "Yayınlandı",
};

// Roadmap kolon sırası (plan.md Sprint 8): planlanan → geliştirilen → yayında.
export const roadmapStatuses = ["planned", "in-progress", "shipped"] as const;

// AI duygu analizi etiketleri (posts.sentiment_label; prompts.md §sentiment).
export const sentimentLabels: Record<string, string> = {
  pozitif: "Pozitif",
  notr: "Nötr",
  negatif: "Negatif",
};

export const trDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const trDateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Kartlardaki uzun açıklamaları kısaltır (portal + oyladıklarım sayfası
// aynı kaynağı kullanır — plan.md Sprint 15).
export function summarize(text: string, maxLength = 160) {
  return text.length > maxLength
    ? `${text.slice(0, maxLength).trimEnd()}…`
    : text;
}
