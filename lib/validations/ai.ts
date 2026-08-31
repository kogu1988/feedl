import { z } from "zod";

// Inngest event payload (docs/prompts.md §4.1).
export const postCreatedEventSchema = z.object({
  postId: z.uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  userId: z.string().min(1),
});

export type PostCreatedEvent = z.infer<typeof postCreatedEventSchema>;

// prompts.md §1: LLM analiz çıktısı. "nötr" gibi varyantlar "notr"a normalize
// edilir; eşleşmeyen değer şema hatası sayılır ve Inngest retry ile tekrar dener.
const sentimentSchema = z
  .string()
  .transform((v) => {
    const lowered = v.trim().toLowerCase();
    return lowered === "nötr" ? "notr" : lowered;
  })
  .pipe(z.enum(["pozitif", "notr", "negatif"]));

export const ideaAnalysisSchema = z.object({
  sentiment: sentimentSchema,
  keywords: z.array(z.string().trim().min(1)).min(1).max(10),
  summary: z.string().trim().min(1).max(500),
});

export type IdeaAnalysis = z.infer<typeof ideaAnalysisSchema>;

// prompts.md §2: duplicate karşılaştırma çıktısı.
export const ideaRelationSchema = z.object({
  relation: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.enum(["DUPLICATE", "RELATED", "UNRELATED"])),
});

export type IdeaRelation = z.infer<typeof ideaRelationSchema>;
