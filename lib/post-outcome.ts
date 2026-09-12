import { z } from "zod";

// 2026-09-12 (M6 ürün eksiği) — OUTCOME (sonuç) kaydının saf mantığı.
//
// Neden ayrı modül: tür listesi, etiketler, para ayrıştırma/biçimleme ve API
// şeması TEK kaynaktan gelmeli. Bunlar UI, API ve testler tarafından paylaşılır;
// ayrı ayrı yazılsalardı "genişleme" bir yerde "Expansion", başka yerde
// "Genişleme" olur ve veri tutarsızlaşırdı.

export const OUTCOME_TYPES = [
  "expansion",
  "retention",
  "efficiency",
  "acquisition",
  "other",
] as const;

export type OutcomeType = (typeof OUTCOME_TYPES)[number];

export const OUTCOME_TYPE_LABELS: Record<OutcomeType, string> = {
  expansion: "Genişleme",
  retention: "Elde tutma",
  efficiency: "Verimlilik",
  acquisition: "Yeni müşteri",
  other: "Diğer",
};

// Form yardımı: kullanıcı hangi türü seçeceğini tahmin etmek zorunda kalmasın.
export const OUTCOME_TYPE_HINTS: Record<OutcomeType, string> = {
  expansion: "Mevcut müşteri bu iş sayesinde daha fazla ödedi (koltuk/plan artışı).",
  retention: "İptal veya yenilememe riski bu iş sayesinde kapandı.",
  efficiency: "Ekipte zaman ya da maliyet tasarrufu sağladı.",
  acquisition: "Bu iş yeni bir müşteri kazandırdı.",
  other: "Diğer — özet alanında açıkla.",
};

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

// Gelir etkisini gösterime çevirir: 80000 → "$80.000", -12000 → "-$12.000".
// `null` (veri yok) ile `0` (sıfır olarak girilmiş) AYRI kalır — frontend_plan
// §19 ile aynı kural: veri yoksa uydurma rakam gösterme.
export function formatRevenueDelta(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return `${parsed < 0 ? "-" : ""}$${money.format(Math.abs(parsed))}`;
}

// Gelir etkisi girişini sayıya çevirir. Kullanıcı "80000", "80.000", "80.000,50"
// ya da "-12000" yazabilir (Türkçe/İngilizce ayıraç karışıklığı).
//
// Kural: ayıraç yalnızca SONDA 1-2 hane bırakıyorsa ondalıktır; aksi halde
// binlik ayıracıdır. Böylece "80.000" = 80000, "1.234.567" = 1234567 ve
// "80.000,50" = 80000.5 olur. Boş/ayrıştırılamayan girdi → null ("veri yok").
export function parseRevenueDelta(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const negative = raw.startsWith("-");
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const lastSeparator = Math.max(
    cleaned.lastIndexOf("."),
    cleaned.lastIndexOf(","),
  );
  const tail =
    lastSeparator === -1 ? "" : cleaned.slice(lastSeparator + 1);
  const isDecimal = lastSeparator !== -1 && /^\d{1,2}$/.test(tail);
  const normalized = isDecimal
    ? `${cleaned.slice(0, lastSeparator).replace(/[.,]/g, "")}.${tail}`
    : cleaned.replace(/[.,]/g, "");

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

export interface OutcomeInput {
  postId: string;
  outcomeType: OutcomeType;
  /** Ham girdi (string) veya daha önce ayrıştırılmış sayı; ikisi de kabul. */
  revenueDelta: string | number | null;
  summary: string;
  evidenceUrl: string | null;
  occurredAt: string | null;
}

// API gövdesi doğrulaması. `revenueDelta` bilinçli olarak serbest biçimde
// kabul edilir ve SUNUCUDA `parseRevenueDelta` ile normalize edilir — istemci
// ile sunucunun farklı ayrıştırması mümkün olmasın (tek kaynak).
export const createOutcomeSchema = z.object({
  postId: z.string().uuid("Geçersiz fikir kimliği."),
  outcomeType: z.enum(OUTCOME_TYPES),
  revenueDelta: z.union([z.string(), z.number(), z.null()]).optional(),
  summary: z
    .string()
    .trim()
    .min(3, "Sonucu birkaç kelimeyle açıkla.")
    .max(2000),
  evidenceUrl: z
    .union([z.string().trim().max(500), z.null()])
    .optional()
    .transform((value) => (value ? value : null))
    .refine(
      (value) => value === null || /^https?:\/\/\S+$/i.test(value),
      { message: "Kanıt linki http(s) ile başlamalı." },
    ),
  occurredAt: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => (value ? value : null))
    .refine(
      (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
      { message: "Tarih YYYY-AA-GG biçiminde olmalı." },
    ),
});

// Yüklenen gövdeyi DB yazımına hazır hale getirir. `revenueDelta` burada
// sayıya çevrilir (veya null'a düşer).
export function normalizeOutcomeInput(
  parsed: z.infer<typeof createOutcomeSchema>,
): {
  postId: string;
  outcomeType: OutcomeType;
  revenueDelta: number | null;
  summary: string;
  evidenceUrl: string | null;
  occurredAt: string | null;
} {
  const raw = parsed.revenueDelta;
  return {
    postId: parsed.postId,
    outcomeType: parsed.outcomeType,
    revenueDelta:
      typeof raw === "number" && Number.isFinite(raw)
        ? raw
        : typeof raw === "string"
          ? parseRevenueDelta(raw)
          : null,
    summary: parsed.summary,
    evidenceUrl: parsed.evidenceUrl ?? null,
    occurredAt: parsed.occurredAt ?? null,
  };
}
