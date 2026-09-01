import { z } from "zod";

import { postTypeEnum } from "@/lib/db/schema";

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
  // Sprint 21: fikir türü (Canny "category" karşılığı). LLM varyantlarına
  // karşı toleranslı: trim + lowercase + Türkçe yazımlar eşlenir.
  type: z
    .string()
    .transform((v) => {
      const lowered = v.trim().toLowerCase();
      if (lowered === "özellik" || lowered === "özellik isteği") return "feature";
      if (lowered === "hata" || lowered === "bug raporu") return "bug";
      if (lowered === "kullanılabilirlik" || lowered === "kullanılabilirlik sorunu")
        return "usability";
      return lowered;
    })
    .pipe(z.enum(postTypeEnum.enumValues)),
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
