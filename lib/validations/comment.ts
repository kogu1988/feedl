import { z } from "zod";

// POST /api/posts/[id]/comments ve detay sayfası formu aynı kuralları kullanır.
// isInternal bayrağı API'de yalnızca admin oturumuyla dikkate alınır;
// burada şema sadece biçimi doğrular.
export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(2, "Yorum en az 2 karakter olmalı.")
    .max(2000, "Yorum en fazla 2000 karakter olabilir."),
  isInternal: z.boolean(),
  // Sprint 24: opsiyonel yanıt hedefi — yalnızca TEK SEVİYE thread;
  // derinlik API'de doğrulanır (parent'ın da parentId'si olamaz).
  parentId: z.uuid().optional(),
});

// PATCH /api/comments/[commentId] — yalnızca gövde düzenlenir.
export const editCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(2, "Yorum en az 2 karakter olmalı.")
    .max(2000, "Yorum en fazla 2000 karakter olabilir."),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type EditCommentInput = z.infer<typeof editCommentSchema>;
