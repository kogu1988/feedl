import "server-only";

import { CORPUS_INSIGHTS_SYSTEM_PROMPT, corpusInsightsUserPrompt } from "./prompts";
import { maskPii } from "./pii";
import { chatJson } from "./openrouter";
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

// Korpusu analiz eder. PII maskelenir; güvenlik prompt'ta (prompt injection
// savunması) ve veri maskelenmesiyle sağlanır. LLM hata verirse fırlatır —
// çağıran (route/Inngest) retry politikasını üstlenir.
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

  return chatJson({
    system: CORPUS_INSIGHTS_SYSTEM_PROMPT,
    user: corpusInsightsUserPrompt(masked),
    schema: corpusInsightsSchema,
    maxTokens: 1200,
  });
}
