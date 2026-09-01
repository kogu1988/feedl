import {
  ANALYZE_IDEA_SYSTEM_PROMPT,
  analyzeIdeaUserPrompt,
  COMPARE_IDEAS_SYSTEM_PROMPT,
  compareIdeasUserPrompt,
} from "./prompts";
import { chatJson } from "./openrouter";
import {
  ideaAnalysisSchema,
  ideaRelationSchema,
  type IdeaAnalysis,
} from "@/lib/validations/ai";

/** prompts.md §1: özet + sentiment + tür + etiketler üretir. */
export function analyzeIdea(post: {
  title: string;
  description: string;
}): Promise<IdeaAnalysis> {
  return chatJson({
    system: ANALYZE_IDEA_SYSTEM_PROMPT,
    user: analyzeIdeaUserPrompt(post.title, post.description),
    schema: ideaAnalysisSchema,
  });
}

// Sprint 21: AI keyword'lerini tags tablosuna yazılacak normalize etiketlere
// çevirir. Kural: trim + Türkçe lowercase + kenar noktalama temizliği +
// boşluk sıkıştırma; 2-30 karakter bandı dışındakiler ve nihai tekrarlar
// atılır; en fazla 5 etiket.
export function normalizeTags(keywords: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of keywords) {
    const name = raw
      .trim()
      .toLocaleLowerCase("tr")
      .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "")
      .replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 30) {
      continue;
    }
    seen.add(name);
    if (seen.size >= 5) {
      break;
    }
  }
  return [...seen];
}

/** prompts.md §2: cosine adayını LLM ile çift doğrular (plan.md Sprint 5). */
export function compareIdeas(
  existing: { title: string; description: string },
  incoming: { title: string; description: string },
): Promise<"DUPLICATE" | "RELATED" | "UNRELATED"> {
  return chatJson({
    system: COMPARE_IDEAS_SYSTEM_PROMPT,
    user: compareIdeasUserPrompt(existing, incoming),
    schema: ideaRelationSchema,
    maxTokens: 100,
  }).then((parsed) => parsed.relation);
}
