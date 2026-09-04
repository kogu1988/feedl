import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  changelogEntries,
  comments,
  posts,
  users,
} from "@/lib/db/schema";
import type { WebhookEventName } from "@/lib/webhooks/dispatch";

// Sprint 43 (PM raporu §9 full API/webhook event matrix) — webhook
// payload'ları yalnızca kimlik değil, tüketicinin kullanabileceği bağlam
// (başlık/alan/yazar) taşır. Inngest event'ları minimal ID'lerle yayınlanır;
// teslimat öncesi burada zenginleştirilir (best-effort: satır silinmişse
// id kalır, bağlam yok).

interface WithUser {
  userId: string;
  userName?: string | null;
}

async function resolvePostSummary(
  postId: string,
): Promise<{ id: string; title: string; status?: string | null }> {
  const [post] = await getDb()
    .select({ id: posts.id, title: posts.title, status: posts.status })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return post
    ? { id: post.id, title: post.title, status: post.status }
    : { id: postId, title: "" };
}

async function resolveAuthorName(userId: string): Promise<string | null> {
  const [user] = await getDb()
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.name ?? null;
}

async function resolveWithUser(
  userId: string,
): Promise<WithUser> {
  return { userId, userName: await resolveAuthorName(userId) };
}

export async function hydrateWebhookPayload(
  eventName: WebhookEventName,
  data: unknown,
): Promise<unknown> {
  const raw = data as Record<string, unknown>;

  switch (eventName) {
    case "post.created": {
      const postId = String(raw.postId);
      const [post, user] = await Promise.all([
        resolvePostSummary(postId),
        resolveWithUser(String(raw.userId)),
      ]);
      return {
        ...raw,
        post: { id: post.id, title: post.title, status: post.status },
        author: user,
      };
    }
    case "post.status_changed": {
      const postId = String(raw.postId);
      const post = await resolvePostSummary(postId);
      return {
        ...raw,
        post: { id: post.id, title: post.title, status: post.status },
      };
    }
    case "comment.created": {
      const commentId = String(raw.commentId);
      const [[commentRow], author] = await Promise.all([
        getDb()
          .select({
            body: comments.body,
            postId: comments.postId,
          })
          .from(comments)
          .where(eq(comments.id, commentId))
          .limit(1),
        resolveWithUser(String(raw.commenterUserId)),
      ]);
      const postId = commentRow?.postId ?? String(raw.postId);
      const post = await resolvePostSummary(postId);
      return {
        ...raw,
        comment: { id: commentId, body: commentRow?.body ?? "" },
        post: { id: post.id, title: post.title },
        author,
      };
    }
    case "comment.deleted": {
      const postId = String(raw.postId);
      const [post, author] = await Promise.all([
        resolvePostSummary(postId),
        resolveWithUser(String(raw.deletedById)),
      ]);
      return {
        ...raw,
        post: { id: post.id, title: post.title },
        author,
      };
    }
    case "vote.created":
    case "vote.deleted": {
      const postId = String(raw.postId);
      const [post, author] = await Promise.all([
        resolvePostSummary(postId),
        resolveWithUser(String(raw.userId)),
      ]);
      return {
        ...raw,
        post: { id: post.id, title: post.title },
        author,
      };
    }
    case "changelog.published": {
      const entryId = String(raw.entryId);
      const [entry] = await getDb()
        .select({
          title: changelogEntries.title,
          body: changelogEntries.body,
          publishedAt: changelogEntries.publishedAt,
        })
        .from(changelogEntries)
        .where(eq(changelogEntries.id, entryId))
        .limit(1);
      return {
        ...raw,
        changelog: {
          id: entryId,
          title: entry?.title ?? raw.title,
          body: entry?.body ?? raw.body,
          publishedAt: entry?.publishedAt ?? null,
        },
      };
    }
    default:
      return data;
  }
}
