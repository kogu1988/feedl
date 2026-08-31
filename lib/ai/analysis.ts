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

/** prompts.md §1: özet + sentiment + etiketler üretir. */
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
