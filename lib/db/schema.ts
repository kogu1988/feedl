import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "customer"]);

// users: Clerk ile senkronize edilir (app/api/webhooks/clerk/route.ts).
// id, Clerk user ID'sidir (tek kaynak: Neon users.role).
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  role: userRoleEnum("role").notNull().default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const postStatusEnum = pgEnum("post_status", [
  "open",
  "planned",
  "in-progress",
  "shipped",
]);

// prompts.md'deki LLM çıktısı; AI fonksiyonları dolana kadar null kalır.
export const postSentimentEnum = pgEnum("post_sentiment", [
  "pozitif",
  "notr",
  "negatif",
]);

// posts: Ana fikir tablosu (docs/README.md §3).
// embedding_vector: nvidia/nemotron-3-embed-1b:free (2048 boyut). HNSW limiti
// 2000 olduğu için index yok — MVP hacminde sıralı tarama yeterli (docs/README.md §3).
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: postStatusEnum("status").notNull().default("open"),
    sentimentLabel: postSentimentEnum("sentiment_label"),
    aiKeywords: text("ai_keywords").array(),
    aiSummary: text("ai_summary"),
    embeddingVector: vector("embedding_vector", { dimensions: 2048 }),
    duplicateOf: uuid("duplicate_of").references((): AnyPgColumn => posts.id, {
      onDelete: "set null",
    }),
    duplicateNote: text("duplicate_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("posts_created_at_idx").on(table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

// votes: Kullanıcı başına fikir başına 1 oy (plan.md Sprint 3).
// unique(user_id, post_id) çifte oyu DB seviyesinde engeller;
// API tarafındaki onConflictDoNothing bu kısıtla idempotent çalışır.
export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("votes_user_post_unique").on(table.userId, table.postId)],
);

export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
