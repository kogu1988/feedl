import { z } from "zod";

// POST gövdesi ve DELETE query param'ı için ortak doğrulama.
export const voteSchema = z.object({
  postId: z.uuid("Geçersiz fikir kimliği."),
});

export type VoteInput = z.infer<typeof voteSchema>;
