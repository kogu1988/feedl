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

// Sprint 24: fikre yeni (iç olmayan) yorum geldiğinde — alıcılar (fikir
// yazarı + yanıtlanan yorumun yazarı) fonksiyon içinde DB'den çözülür;
// event yalnızca kimlikler taşır, e-posta adresi taşımaz.
export const commentCreatedEventSchema = z.object({
  commentId: z.uuid(),
  postId: z.uuid(),
  commenterUserId: z.string().min(1),
});

export type CommentCreatedEvent = z.infer<typeof commentCreatedEventSchema>;

export type PostStatusChangedEvent = z.infer<typeof postStatusChangedEventSchema>;

// Sprint 40: yeni changelog duyurusu yayınlandığında — alıcılar
// (changelog_subscribers) fonksiyon içinde DB'den çözülür; event
// yalnızca duyuru kimliği ve içeriğini taşır.
export const changelogPublishedEventSchema = z.object({
  entryId: z.uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
});

export type ChangelogPublishedEvent = z.infer<
  typeof changelogPublishedEventSchema
>;

// Sprint 43 (PM raporu §9 full API/webhook event matrix): oy ve yorum
// silme olayları. Bildirim e-postası tetiklemezler — yalnızca webhook
// matrix'ini tamamlamak için yayınlanır.
export const voteCreatedEventSchema = z.object({
  postId: z.uuid(),
  userId: z.string().min(1),
});

export type VoteCreatedEvent = z.infer<typeof voteCreatedEventSchema>;

export const voteDeletedEventSchema = z.object({
  postId: z.uuid(),
  userId: z.string().min(1),
});

export type VoteDeletedEvent = z.infer<typeof voteDeletedEventSchema>;

export const commentDeletedEventSchema = z.object({
  commentId: z.uuid(),
  postId: z.uuid(),
  deletedById: z.string().min(1),
});

export type CommentDeletedEvent = z.infer<typeof commentDeletedEventSchema>;
