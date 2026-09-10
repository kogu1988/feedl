import { z } from "zod";

// Faz 1 — gönderimle birlikte gelen teknik bağlam (opsiyonel; istemci doldurur).
// Sunucu tarafı eksikse `user-agent` header'ından türetir.
export const clientContextSchema = z.object({
  device: z.enum(["desktop", "tablet", "mobile"]).optional(),
  viewportWidth: z.number().int().min(0).max(20000).nullish(),
  viewportHeight: z.number().int().min(0).max(20000).nullish(),
  browser: z.string().trim().max(60).nullish(),
  os: z.string().trim().max(60).nullish(),
  pageUrl: z.string().trim().max(1000).nullish(),
});

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
  // Faz 1: otomatik teknik bağlam (cihaz/viewport/tarayıcı/OS/URL).
  clientContext: clientContextSchema.optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type ClientContextInput = z.infer<typeof clientContextSchema>;
