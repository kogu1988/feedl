import "server-only";

import { CORPUS_INSIGHTS_SYSTEM_PROMPT, corpusInsightsUserPrompt } from "./prompts";
import { maskPii } from "./pii";
import { chatJsonRaw } from "./openrouter";
import { corpusInsightsSchema, type CorpusInsights } from "@/lib/validations/ai";

// Sprint 61 (corpus AI içgörüleri) — ChatGPT §16/17 "asıl moat": feedback
// KORPUSUNU analiz eder (tek tek post değil). Korpusu toplar, PII maskeler,
// LLM'e verir; temas/trend/hızlı kazanım/risk önerisi döner. Embed altyapısı
// (2048-dim pgvector) hazır; burada LLM tabanlı semantik özet kullanıyoruz.
// Not: LLM çağrısı maliyetli — korpus sınırlandırılır (en fazla N fikir).

export interface CorpusPostInput {
  title: string;
  description: string;
  status: string;
  votes: number;
}

// Serbest LLM modelleri iç içe nesne şemasını takip etmekte tutarsızdır:
// `themes` alanını [{name,count,summary}] yerine string[] (["A","B"]) döndürebilir
// → Zod doğrulaması patlar ve Inngest run failed olur (gözlemlendi: 32 failed run).
// Bu normalizasyon, ham LLM çıktısını kanonik CorpusInsights şekline kavuşturur;
// string olan maddeleri nesneye çevirir, eksik/boş alanları tolere eder, sonra
// şemayla son bir doğrulama yapar. Şekil uyumsuzluğu artık run'ı düşürmez.
function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 1;
}

function normalizeTheme(v: unknown): { name: string; count: number; summary: string } | null {
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    return { name: s, count: 1, summary: s };
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const name = asString(o.name) || asString(o.label) || asString(o.title);
    if (!name) return null;
    return {
      name,
      count: asNumber(o.count),
      summary: asString(o.summary) || asString(o.description) || name,
    };
  }
  return null;
}

function normalizeTrend(v: unknown): { name: string; note: string } | null {
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    return { name: s, note: s };
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const name = asString(o.name) || asString(o.label) || asString(o.title);
    if (!name) return null;
    return { name, note: asString(o.note) || asString(o.description) || (typeof v === "object" && "trend" in o ? asString((o as Record<string, unknown>).trend) : name) };
  }
  return null;
}

function normalizeRisk(v: unknown): { label: string; detail: string } | null {
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    return { label: s, detail: s };
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const label = asString(o.label) || asString(o.name) || asString(o.title);
    if (!label) return null;
    return { label, detail: asString(o.detail) || asString(o.description) || label };
  }
  return null;
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(asString).filter(Boolean);
}

// Ham LLM çıktısını kanonik CorpusInsights şekline getirir. Serbest modelin
// yapısal sapmalarını (string vs nesne, eksik alanlar) tolere eder.
export function normalizeCorpusInsights(raw: unknown): CorpusInsights {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const themes = Array.isArray(obj.themes)
    ? obj.themes
        .map(normalizeTheme)
        .filter((t): t is { name: string; count: number; summary: string } => t !== null)
    : [];
  const trends = Array.isArray(obj.trends)
    ? obj.trends
        .map(normalizeTrend)
        .filter((t): t is { name: string; note: string } => t !== null)
    : [];
  const quickWins = asStrArray(obj.quickWins);
  const risks = Array.isArray(obj.risks)
    ? obj.risks
        .map(normalizeRisk)
        .filter((r): r is { label: string; detail: string } => r !== null)
    : [];

  return {
    themes,
    trends,
    quickWins,
    risks,
    recommendation: asString(obj.recommendation) || "Henüz yeterli geri bildirim yok.",
  };
}

// Son çare fallback — şekil hatası durumunda bile run'ı düşürmez.
function fallbackCorpusInsights(): CorpusInsights {
  return {
    themes: [],
    trends: [],
    quickWins: [],
    risks: [],
    recommendation: "İçgörü üretilemedi. Yeniden denemek için sayfadaki 'Yenile'yi kullan.",
  };
}

// Korpusu analiz eder. PII maskelenir; güvenlik prompt'ta (prompt injection
// savunması) ve veri maskelenmesiyle sağlanır. AĞ hataları (429/5xx/yok) fırlatır
// → Inngest retry bunu yakar. Yalnızca ŞEKİL/şema uyumsuzluğu graceful fallback'e
// düşer; Inngest run'ı artık LLM çıktı şekli yüzünden failed olmaz.
export async function analyzeCorpus(
  posts: CorpusPostInput[],
): Promise<CorpusInsights> {
  if (posts.length === 0) {
    return {
      themes: [],
      trends: [],
      quickWins: [],
      risks: [],
      recommendation: "Henüz yeterli geri bildirim yok. İlk fikirler geldikçe içgörü üretilir.",
    };
  }

  const masked = posts.map((p) => ({
    title: maskPii(p.title),
    description: maskPii(p.description),
    status: p.status,
    votes: p.votes,
  }));

  // Ham JSON'u al (ağ hatası fırlatır → Inngest retry).
  const raw: unknown = await chatJsonRaw({
    system: CORPUS_INSIGHTS_SYSTEM_PROMPT,
    user: corpusInsightsUserPrompt(masked),
    maxTokens: 1200,
  });

  // Şekil normalizasyonu yap, sonra şemayla son doğrulama.
  const normalized = normalizeCorpusInsights(raw);
  const parsed = corpusInsightsSchema.safeParse(normalized);
  if (!parsed.success) {
    return fallbackCorpusInsights();
  }
  return parsed.data;
}
