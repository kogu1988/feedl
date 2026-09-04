import { z } from "zod";

// API (POST /api/posts) ve portal formu aynı kuralları kullanır.
// Sprint 48d: boardId opsiyonel — verilmezse varsayılan board (genel) atanır.
export const createPostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Başlık en az 3 karakter olmalı.")
    .max(140, "Başlık en fazla 140 karakter olabilir."),
  description: z
    .string()
    .trim()
    .min(10, "Açıklama en az 10 karakter olmalı.")
    .max(2000, "Açıklama en fazla 2000 karakter olabilir."),
  boardId: z
    .uuid("Geçersiz board.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
