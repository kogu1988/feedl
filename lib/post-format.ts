// Post durumu etiketleri ve tarih formatı — portal, roadmap, dialog ve CSV
// export'un ortak kaynağı (durum etiketleri canny.md §2'deki akışa karşılık gelir).

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
