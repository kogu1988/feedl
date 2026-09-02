import { z } from "zod";

import { postStatusEnum } from "@/lib/db/schema";

// Inngest event payload'ları (docs/prompts.md §4). Event şemaları tek yerde
// toplanır; tetikleyen route ile tüketen Inngest fonksiyonu aynı şemayı paylaşır.

// prompts.md §4.1: yeni fikir oluşturulduğunda.
export const postCreatedEventSchema = z.object({
  postId: z.uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  userId: z.string().min(1),
});

export type PostCreatedEvent = z.infer<typeof postCreatedEventSchema>;

// prompts.md §4.2: admin fikir durumunu değiştirdiğinde. note (Sprint
// 23): admin'in değişim açıklaması — bildirim e-postasında kullanıcıya
// gösterilir; yoksa e-posta mevcut metinle gönderilir.
export const postStatusChangedEventSchema = z.object({
  postId: z.uuid(),
  oldStatus: z.enum(postStatusEnum.enumValues),
  newStatus: z.enum(postStatusEnum.enumValues),
  note: z.string().max(500).optional(),
});

export type PostStatusChangedEvent = z.infer<typeof postStatusChangedEventSchema>;
