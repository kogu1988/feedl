import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Sprint 27: tsvector özel tipi — drizzle pg-core'da yerleşik yok;
// generated kolon (posts.search_vector) bu tiple tanımlanır.
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

export const userRoleEnum = pgEnum("user_role", ["admin", "customer"]);

// users: Clerk ile senkronize edilir (app/api/webhooks/clerk/route.ts).
// id, Clerk user ID'sidir (tek kaynak: Neon users.role).
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  role: userRoleEnum("role").notNull().default("customer"),
  // Sprint 26: e-posta tercihleri + token'lı unsubscribe (bildirim
  // e-postalarının altındaki link bu token ile çalışır).
  emailStatusUpdates: boolean("email_status_updates").notNull().default(true),
  emailComments: boolean("email_comments").notNull().default(true),
  unsubscribeToken: uuid("unsubscribe_token")
    .notNull()
    .defaultRandom()
    .unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const postStatusEnum = pgEnum("post_status", [
  "open",
  "under-review",
  "planned",
  "in-progress",
  "shipped",
  "closed",
]);

// prompts.md'deki LLM çıktısı; AI fonksiyonları dolana kadar null kalır.
export const postSentimentEnum = pgEnum("post_sentiment", [
  "pozitif",
  "notr",
  "negatif",
]);

// Sprint 21: fikir türü (Canny'nin "category" kavramının karşılığı —
// yapılandırılmış, tek seçim). AI doldurur; admin detay sayfasından
// değiştirebilir. Serbest form etiketler için tags tablosuna bak.
export const postTypeEnum = pgEnum("post_type", [
  "feature",
  "bug",
  "usability",
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
    postType: postTypeEnum("post_type"),
    sentimentLabel: postSentimentEnum("sentiment_label"),
    aiKeywords: text("ai_keywords").array(),
    aiSummary: text("ai_summary"),
    embeddingVector: vector("embedding_vector", { dimensions: 2048 }),
    duplicateOf: uuid("duplicate_of").references((): AnyPgColumn => posts.id, {
      onDelete: "set null",
    }),
    duplicateNote: text("duplicate_note"),
    // Sprint 20: admin merge işlemi (duplicateOf AI adayını işaretler,
    // mergedIntoId gerçek birleşmeyi). Kaynak fikir listelerden düşer,
    // detay sayfası hedefe yönlendirir; unmerge ile geri alınabilir.
    mergedIntoId: uuid("merged_into_id").references(
      (): AnyPgColumn => posts.id,
      { onDelete: "set null" },
    ),
    mergedAt: timestamp("merged_at", { withTimezone: true }),
    // Sprint 28: iç roadmap + scoring (P2.2). owner = atanan admin;
    // impact/effort 1-3 (admin girer); skor = impact/effort (UI hesaplar).
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetDate: date("target_date"),
    impact: integer("impact"),
    effort: integer("effort"),
    // Sprint 32: fikir widget (gömülü script) üzerinden gönderildiyse kaynak
    // origin/URL buraya yazılır; portal gönderilerinde null kalır.
    widgetOrigin: text("widget_origin"),
    // Sprint 27: Türkçe full-text arama kolonu (GENERATED ALWAYS STORED).
    // İki-argümanlı to_tsvector('turkish', ...) immutable olduğu için
    // generated kolonda kullanılabilir.
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('turkish', coalesce(title, '') || ' ' || coalesce(description, ''))`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("posts_created_at_idx").on(table.createdAt),
    index("posts_search_vector_idx").using("gin", table.searchVector),
  ],
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
    // Sprint 20 merge: oy bir kaynak fikirden hedefe taşındıysa kaynağı
    // işaretler; unmerge bu kolonla geri taşır. normal oyda null.
    mergedFromPostId: uuid("merged_from_post_id").references(
      (): AnyPgColumn => posts.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("votes_user_post_unique").on(table.userId, table.postId)],
);

export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;

// comments: Fikir altı yorumlar (plan.md Sprint 10). is_internal=true olanlar
// Canny'deki "internal note" modelidir: sadece admin görür, müşteriye
// asla render edilmez (filtre hem sayfada hem API'de uygulanır).
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    // Sprint 20 merge: yorum taşınması izi (votes.mergedFromPostId ile aynı model).
    mergedFromPostId: uuid("merged_from_post_id").references(
      (): AnyPgColumn => posts.id,
      { onDelete: "set null" },
    ),
    // Sprint 24: yanıt zinciri — yalnızca TEK SEVİYE (yanıtın yanıtına
    // parentId verilmez); parent silinince yanıtlar da cascade ile gider.
    parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("comments_post_created_idx").on(table.postId, table.createdAt)],
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

// post_merges: Sprint 20 merge audit kaydı. Taşınan oy/yorum id'leri
// snapshot olarak saklanır; unmerge tam olarak bu id'leri kaynak fikre
// geri taşır (neon-http interaktif transaction desteklemediği için merge
// tek CTE statement'ı ile atomik yürütülür — app/api/admin/merge/route.ts).
export const postMerges = pgTable(
  "post_merges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourcePostId: uuid("source_post_id")
      .notNull()
      .references((): AnyPgColumn => posts.id, { onDelete: "cascade" }),
    targetPostId: uuid("target_post_id")
      .notNull()
      .references((): AnyPgColumn => posts.id, { onDelete: "cascade" }),
    movedVoteIds: jsonb("moved_vote_ids").$type<string[]>().notNull().default([]),
    movedCommentIds: jsonb("moved_comment_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    mergedAt: timestamp("merged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    unmergedAt: timestamp("unmerged_at", { withTimezone: true }),
  },
  (table) => [
    index("post_merges_source_idx").on(table.sourcePostId, table.mergedAt),
  ],
);

export type PostMerge = typeof postMerges.$inferSelect;

// post_status_history: Sprint 23 — her status değişiminin izi (Canny
// status history modeli). oldStatus null olabilir (ilk kayıt senaryosu);
// note admin'in değişim açıklamasıdır ve bildirim e-postasına dahil
// edilir. Değişimler dashboard PATCH ve bulk rotasında yazılır.
export const postStatusHistory = pgTable(
  "post_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references((): AnyPgColumn => posts.id, { onDelete: "cascade" }),
    oldStatus: postStatusEnum("old_status"),
    newStatus: postStatusEnum("new_status").notNull(),
    note: text("note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("post_status_history_post_idx").on(table.postId, table.createdAt),
  ],
);

export type PostStatusHistory = typeof postStatusHistory.$inferSelect;
export type NewPostStatusHistory = typeof postStatusHistory.$inferInsert;
export type NewPostMerge = typeof postMerges.$inferInsert;

// tags: Sprint 21 serbest form etiketleri (AI keyword'lerinden türetilir,
// normalize lowercase). Tek taksonomi: Canny'nin "category" kavramı
// posts.postType enum'uyla karşılanır, ayrı categories tablosu yok.
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

// post_tags: fikir ↔ etiket bağlantısı (plan.md Sprint 21). AI autopilot
// her yeni fikir için keyword'lerinden etiket üretip buraya bağlar.
export const postTags = pgTable(
  "post_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("post_tags_post_tag_unique").on(table.postId, table.tagId),
    index("post_tags_tag_idx").on(table.tagId),
  ],
);

export type PostTag = typeof postTags.$inferSelect;
export type NewPostTag = typeof postTags.$inferInsert;

// saved_views: Sprint 22 — admin'in kaydettiği filtre kombinasyonları
// (?status=...&tag=...). MVP'de tek admin olduğu için userId kolonu yok;
// çoklu admin gelirse eklenir (bkz. plan.md P0.1 ertelenen blok).
export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Query string olarak saklanır (örn. "status=open&tag=arama") —
  // dashboard ?v= yerine doğrudan filtre parametreleriyle açılır.
  params: text("params").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SavedView = typeof savedViews.$inferSelect;
export type NewSavedView = typeof savedViews.$inferInsert;

// changelog_entries: Sprint 25 — roadmap'ten BAĞIMSIZ duyuru alanı
// (Canny changelog modeli; docs/oxalpha.txt §2D). Post ilişkisi
// changelog_post_links üzerinden çoktan çoğa (bir duyuru birden fazla
// fikri kapsayabilir). Gövde markdown saklanır; MVP'de düz metin gibi
// render edilir (whitespace-pre-line), markdown parser sonraki sprintte.
export const changelogEntries = pgTable("changelog_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  // label: örn. "yeni", "iyileştirme", "düzeltme" — filtreleme için.
  label: text("label"),
  publishedAt: timestamp("published_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export type ChangelogEntry = typeof changelogEntries.$inferSelect;
export type NewChangelogEntry = typeof changelogEntries.$inferInsert;

// changelog_post_links: duyuru <-> fikir ilişkisi. Fikir silinirse link
// gider ama duyuru kalır (set null + cascade link tablosunda).
export const changelogPostLinks = pgTable(
  "changelog_post_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references((): AnyPgColumn => changelogEntries.id, {
        onDelete: "cascade",
      }),
    postId: uuid("post_id")
      .notNull()
      .references((): AnyPgColumn => posts.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("changelog_post_links_entry_post_unique").on(
      table.entryId,
      table.postId,
    ),
    index("changelog_post_links_post_idx").on(table.postId),
  ],
);

export type ChangelogPostLink = typeof changelogPostLinks.$inferSelect;
export type NewChangelogPostLink = typeof changelogPostLinks.$inferInsert;

// post_followers: Sprint 26 — fikir takipçileri (Canny modeli). Yazar
// oluştururken, oy veren ve yorum yazan otomatik takipçi olur; status
// ve yorum bildirimleri bu tablodan çözülür.
export const postFollowers = pgTable(
  "post_followers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references((): AnyPgColumn => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("post_followers_post_user_unique").on(table.postId, table.userId),
    index("post_followers_user_idx").on(table.userId),
  ],
);

export type PostFollower = typeof postFollowers.$inferSelect;
export type NewPostFollower = typeof postFollowers.$inferInsert;

// email_deliveries: Sprint 26 — gönderim kaydı + idempotency.
// (user_id, type, entity_id) unique: aynı fikrin tekrar shipped'e
// çekilmesi ya da event replay'i mükerrer mail göndermez.
export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'shipped' | 'status' | 'comment'
    entityId: uuid("entity_id").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("email_deliveries_unique").on(
      table.userId,
      table.type,
      table.entityId,
    ),
  ],
);

export type EmailDelivery = typeof emailDeliveries.$inferSelect;
export type NewEmailDelivery = typeof emailDeliveries.$inferInsert; 
