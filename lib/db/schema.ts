import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  timestamp,
  unique,
  uuid,
  varchar,
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
  // Sprint 48s: Intercom/ticket connector'lardan zenginleştirilen gerçek
  // müşteri iletişim bilgisi (phone opsiyonel; phone olmayan kanallarda null).
  phone: text("phone"),
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
// workspaceId: Sprint 37 tenant hazırlığı — tüm üst düzey kaynak tablolar
// workspace'e bağlıdır; listeler getWorkspaceId() ile filtrelenir.
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Sprint 48b: fikrin ait olduğu board. Mevcut kayıtlar varsayılan
    // board'a seed'lenir; yeni girişler seçilen board'a yazılır.
    boardId: uuid("board_id").references(() => boards.id, {
      onDelete: "set null",
    }),
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
    // Sprint 44: fikrin geldiği kaynak — portal | widget_embed | api | inbound:<ad>
    // Connector'ların (madde 7) Autopilot'u bu alanla izlenebilir kılar.
    source: varchar("source", { length: 60 }),
    // Sprint 48q: connector kaynak referansı — Slack event_ts, Zendesk
    // ticket.id vb. Aynı kaynak (mesaj/ticket) tekrar gelirse idempotent
    // reddedilir (çift post engellenir). Portal/widget/api satırları null.
    sourceRef: varchar("source_ref", { length: 120 }),
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
    index("posts_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("posts_search_vector_idx").using("gin", table.searchVector),
    // Sprint 48q: aynı connector kaynağı (sourceRef) bir kez post edilir.
    // sourceRef null olanlar (portal/api) bu unique'e girmez (null hariç).
    uniqueIndex("posts_workspace_source_ref_key").on(
      table.workspaceId,
      table.sourceRef,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// workspaces: Sprint 37 — tenant hazırlık migration'ı (PM raporu §8 madde 1).
// Şu an tek workspace (migration ile seed: "feedl"); lib/db/workspace.ts'teki
// getWorkspaceId() merkezi erişim noktasıdır. Çoklu workspace + board UI
// (P0.1, domain ile birlikte) geldiğinde çözüm (slug/subdomain) burada
// genişletilir; child tablolar (votes, comments, post_tags...) parent'ları
// üzerinden scope edilir, workspace_id kolonu almaz.
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // slug: gelecekte subdomain kaynağı ({slug}.feedl.app); şimdilik yalnızca
  // seed satırını belirleyici yapmak için kullanılır.
  slug: varchar("slug", { length: 63 }).notNull().unique(),
  // Sprint 48a (madde 8): workspace yönetimi + custom domain hazırlığı.
  // customDomain: müşterinin kendi domaini (ör. feedback.acme.com);
  // brandColor: kendi portal marka rengi; logoUrl: marka logosu.
  customDomain: varchar("custom_domain", { length: 200 }),
  brandColor: varchar("brand_color", { length: 20 }),
  logoUrl: text("logo_url"),
  // Sprint 48h (Faz 5): plan + limitler + Paddle bağlantısı. plan
  // free|pro; limitler workspace başına kaynak sınırları; Paddle
  // customer/subscription kimlikleri abonelik webhook'undan doldurulur.
  plan: varchar("plan", { length: 20 }).notNull().default("free"),
  paddleCustomerId: varchar("paddle_customer_id", { length: 40 }),
  paddleSubscriptionId: varchar("paddle_subscription_id", { length: 40 }),
  // Sprint 60 (billing hardening): Paddle abonelik durumu — active/trialing/
  // canceled/past_due/paused/dunned/expired. Billing sayfası gerçek durumu
  // gösterir; ödeme gecikmesi uyarısı için kullanılır.
  paddleSubscriptionStatus: varchar("paddle_subscription_status", { length: 30 }),
  trackedUserLimit: integer("tracked_user_limit").notNull().default(50),
  boardLimit: integer("board_limit").notNull().default(1),
  memberLimit: integer("member_limit").notNull().default(1),
  // Sprint 59 (madde onboarding): dashboard'daki onboarding checklist'ini
  // kullanıcı "Şimdilik gizle" derse kalıcı olarak gizle (tamamlansa bile).
  onboardingDismissedAt: timestamp("onboarding_dismissed_at", {
    withTimezone: true,
  }),
  // Sprint 63l (corpus insights arka plana): AI içgörü önbelleği. Sayfa
  // LLM çağrısını engellemez; Inngest arka planda üretir ve buraya yazılır.
  corpusInsights: jsonb("corpus_insights"),
  corpusInsightsAt: timestamp("corpus_insights_at", { withTimezone: true }),
  corpusInsightsStatus: varchar("corpus_insights_status", { length: 20 })
    .notNull()
    .default("idle"), // idle | pending | done | error
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Sprint 48b (madde 8): board modeli — feedback koleksiyonları. Canny'de
// boards yalnızca POST'lari kapsar; votes/comments/tags post üzerinden
// scope'lanır (post_id FK). companies/opportunities/changelog/api_keys
// workspace-scoped kalır (board'a bağlanmaz).
export const boardVisibilityEnum = pgEnum("board_visibility", [
  "public",
  "private",
]);

export const boards = pgTable("boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull(),
  description: text("description"),
  visibility: boardVisibilityEnum("visibility").notNull().default("public"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("boards_workspace_slug_key").on(table.workspaceId, table.slug),
  index("boards_workspace_sort_idx").on(table.workspaceId, table.sortOrder),
]);

export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;

// Sprint 48c-2 (madde 8): role matrix — workspace üyeleri. users.role
// (admin/customer) global kalır; bu tablo workspace bağlamında owner /
// admin / member rolleri taşır. getAdminUserId buradan doğrular (geriye
// dönük: users.role=admin de kabul edilir, geçişte kırılma olmaz).
export const workspaceMemberRoleEnum = pgEnum("workspace_member_role", [
  "owner",
  "admin",
  "member",
  "contributor",
]);

export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: workspaceMemberRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("workspace_members_workspace_user_key").on(
    table.workspaceId,
    table.userId,
  ),
  index("workspace_members_user_idx").on(table.userId),
]);

// Sprint 48j (madde 8, P1) — davet akışı. Tek kullanımlık, süreli davet
// token'ı. Kabul edilince workspace_members'e üye eklenir.
export const workspaceInvites = pgTable("workspace_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: workspaceMemberRoleEnum("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
export type NewWorkspaceInvite = typeof workspaceInvites.$inferInsert;

// Sprint 48l (madde 8, P1) — widget AI triage. Widget'ta yazılan mesajlar
// AI ile sınıflandırılır (feedback/support/clarify/unrecognized); kayıt
// audit için tutulur.
export const widgetTriageEnum = pgEnum("widget_triage_type", [
  "feedback",
  "support",
  "clarify",
  "unrecognized",
]);

export const widgetTriages = pgTable("widget_triages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  message: text("message").notNull(),
  classification: widgetTriageEnum("classification").notNull(),
  response: text("response"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type WidgetTriage = typeof widgetTriages.$inferSelect;
export type NewWidgetTriage = typeof widgetTriages.$inferInsert;

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
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
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Sprint 37: etiket adı workspace başına benzersiz (global unique(name)
    // çoklu workspace'te yanlış olurdu).
    unique("tags_workspace_name_unique").on(table.workspaceId, table.name),
    index("tags_workspace_idx").on(table.workspaceId),
  ],
);

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
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
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
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  // imageUrl: duyuru kapak görseli (opsiyonel — Sprint 40).
  imageUrl: text("image_url"),
  // label: örn. "yeni", "iyileştirme", "düzeltme" — filtreleme için.
  label: text("label"),
  // Sprint 48n: draft/published yaşam döngüsü. publishedAt draft'ta null;
  // yayınlanınca set edilir. Mevcut satırlar 'published' olur.
  status: varchar("status", { length: 20 }).notNull().default("published"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
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

// changelog_subscribers: Sprint 40 — changelog e-posta aboneleri. Anonim
// ziyaretçiler (ve oturum açmış kullanıcılar) portalda e-posta ile duyuru
// abonesi olur; token unsubscribe içindir (users tablosuna bağlı değildir).
export const changelogSubscribers = pgTable(
  "changelog_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references((): AnyPgColumn => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    unsubscribeToken: uuid("unsubscribe_token")
      .notNull()
      .defaultRandom()
      .unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("changelog_subscribers_workspace_email_unique").on(
      table.workspaceId,
      table.email,
    ),
  ],
);

export type ChangelogSubscriber = typeof changelogSubscribers.$inferSelect;
export type NewChangelogSubscriber = typeof changelogSubscribers.$inferInsert;

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
    // Sprint 63v (deliverability): Resend message id + teslimat durumu.
    // Resend webhook'u (email.delivered/bounced/complained) bu id ile eşleşir.
    providerId: text("provider_id"),
    status: varchar("status", { length: 20 }).notNull().default("sent"), // sent|delivered|bounced|complained
    error: text("error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    complainedAt: timestamp("complained_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("email_deliveries_unique").on(
      table.userId,
      table.type,
      table.entityId,
    ),
    index("email_deliveries_provider_id_idx").on(table.providerId),
  ],
);

export type EmailDelivery = typeof emailDeliveries.$inferSelect;
export type NewEmailDelivery = typeof emailDeliveries.$inferInsert;

// ai_suggestions: Sprint 33 — Autopilot Inbox (P5). AI'ın ürettiği ancak
// admin onayı bekleyen öneriler. Sprint 5'te duplicate kararı otomatik
// uygulanıyordu; artık pending öneri olarak inbox'a düşer, admin approve
// edince Sprint 20 merge CTE'si çalışır. Karar alanları audit izi bırakır.
export const aiSuggestionTypeEnum = pgEnum("ai_suggestion_type", [
  "duplicate",
  // spam önerisi ileride eklenir (analiz raporu P5).
]);

export const aiSuggestionStatusEnum = pgEnum("ai_suggestion_status", [
  "pending",
  "approved",
  "rejected",
  "ignored",
]);

export const aiSuggestions = pgTable(
  "ai_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references((): AnyPgColumn => posts.id, { onDelete: "cascade" }),
    type: aiSuggestionTypeEnum("type").notNull(),
    // Öneri bağlamı: duplicateOf (hedef fikir), similarity (cosine 0-1),
    // note (insan-okur açıklama).
    payload: jsonb("payload")
      .$type<{
        duplicateOf: string;
        similarity: number;
        note: string;
      }>()
      .notNull(),
    // Güven skoru 0-100; cosine similarity'den türetilir.
    confidence: integer("confidence").notNull(),
    status: aiSuggestionStatusEnum("status").notNull().default("pending"),
    decidedBy: text("decided_by").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_suggestions_status_idx").on(table.status),
    index("ai_suggestions_post_id_idx").on(table.postId),
  ],
);

export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type NewAiSuggestion = typeof aiSuggestions.$inferInsert;

// api_keys: Sprint 34 — Public API (P4.2). Salt-okunur anahtarlar; tam
// anahtar yalnızca oluşturma anında gösterilir, DB'de yalnızca SHA-256
// karması tutulur. prefix liste görünümü için anahtarın ilk karakterleridir.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    prefix: varchar("prefix", { length: 16 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
    // Sprint 34 MVP'de yalnızca "read" kapsamı üretilir; yazma kapsamları
    // ileride bu diziye eklenir (analiz raporu P4.2).
    scopes: varchar("scopes", { length: 40 }).array().notNull().default(["read"]),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("api_keys_key_hash_idx").on(table.keyHash)],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

// webhook_endpoints: Sprint 34 — kayıtlı webhook alıcıları. secret alıcı
// tarafında imza doğrulaması içindir; teslimat Inngest sendWebhooks
// fonksiyonundan HMAC-SHA256 imzalı POST ile yapılır (retry Inngest'te).
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    // Abone olaylar: post.created | post.status_changed | comment.created
    events: varchar("events", { length: 40 }).array().notNull(),
    secret: text("secret").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;

// Sprint 43 (PM raporu §9 madde 6): webhook dead-letter kuyruğu.
// Inngest teslimatı 3× retry eder; her deneme burada izlenir, sonunda
// başarısız kalanlar admin'in inceleyip yeniden tetikleyebileceği
// dead-letter kaydıdır. payload teslimat için oluşturulmuş gövdeyi taşır.
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 40 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(1),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Doğal anahtar: aynı endpoint+olay+payload tek teslimat kaydıdır;
    // retry'lar bu satırın attempts'ını artırır, başarı durumu `delivered`
    // olur (dead-letter görünümünden düşer).
    uniqueIndex("webhook_deliveries_endpoint_event_payload_key").on(
      table.endpointId,
      table.event,
      table.payload,
    ),
  ],
);

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;

// widget_origins: Sprint 38 — widget'ın gömülebileceği izinli origin'ler
// (PM raporu §8.2: "env boşsa her origin kabul" riskini kapatır). Biçim:
// protokol + host (+port), path yok — örn. https://example.com. Feedl'in
// kendi origin'i kod tarafında daima izinlidir; bu tablo müşteri
// siteleri içindir. Sahiplik doğrulaması (meta tag/DNS) custom domain
// sprintinde; şimdilik ekleyen admin fiilen teyit sağlar.
export const widgetOrigins = pgTable(
  "widget_origins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    origin: varchar("origin", { length: 200 }).notNull(),
    label: varchar("label", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("widget_origins_workspace_origin_key").on(
      table.workspaceId,
      table.origin,
    ),
  ],
);

export type WidgetOrigin = typeof widgetOrigins.$inferSelect;
export type NewWidgetOrigin = typeof widgetOrigins.$inferInsert;

// companies: Sprint 30 — müşteri şirketleri (P3.1). MRR opsiyonel; Sprint 31
// opportunities bu tabloya bağlanacak.
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  domain: varchar("domain", { length: 200 }),
  mrr: numeric("mrr", { precision: 12, scale: 2 }),
  // Sprint 45 (PM raporu §9 madde 9): segment MRR + renewal/churn riski.
  // status: active | at_risk | churned — yenileme riski ve kayıp izlenir.
  status: varchar("status", { length: 20 }).notNull().default("active"),
  renewalDate: date("renewal_date"),
  segment: varchar("segment", { length: 40 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

// company_members: kullanıcı ↔ şirket eşleşmesi. Clerk user id metin olduğu
// için FK users.id (text). Aynı kullanıcı aynı şirkete bir kez eklenir.
export const companyMembers = pgTable(
  "company_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobTitle: varchar("job_title", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("company_members_company_user_unique").on(
      table.companyId,
      table.userId,
    ),
    index("company_members_user_idx").on(table.userId),
  ],
);

export type CompanyMember = typeof companyMembers.$inferSelect;
export type NewCompanyMember = typeof companyMembers.$inferInsert;

// opportunities: Sprint 31 — satış fırsatları (P3.2). Şirkete bağlı;
// fikirle ilişki post_opportunities üzerinden kurulur. Gelir ağırlıklı
// önceliklendirme yalnızca açık aşamaları (open/proposal) sayar.
export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    dealValue: numeric("deal_value", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    stage: varchar("stage", { length: 20 }).notNull().default("open"),
    expectedCloseDate: date("expected_close_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("opportunities_company_idx").on(table.companyId),
    index("opportunities_workspace_idx").on(table.workspaceId),
  ],
);

export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;

// post_opportunities: fikir ↔ fırsat eşleşmesi. Şirket üyelerinin oyu
// zaten müşteri sayacını verir; fırsat bağlantısı gelir skorunu besler.
export const postOpportunities = pgTable(
  "post_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("post_opportunities_post_opportunity_unique").on(
      table.postId,
      table.opportunityId,
    ),
  ],
);

export type PostOpportunity = typeof postOpportunities.$inferSelect;
export type NewPostOpportunity = typeof postOpportunities.$inferInsert;

// Sprint 42 (PM raporu §8.5): Admin'in fikirlere eklediği özel alanlar.
// Sprint 21 taksonomi kararına dokunmaz: postType = kategori, tags = serbest
// etiket kalır; custom fields ayrı, admin tanımlı bir katmandır.
export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "select",
  "number",
  "date",
]);

export const customFields = pgTable(
  "custom_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    fieldType: customFieldTypeEnum("field_type").notNull().default("text"),
    // Yalnızca fieldType = "select" iken anlamlı; satır başına bir seçenek.
    options: text("options").array(),
    required: boolean("required").notNull().default(false),
    // true ise portal detay sayfasında herkese görünür; false yalnızca admin.
    showOnPortal: boolean("show_on_portal").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("custom_fields_workspace_name_key").on(
      table.workspaceId,
      table.name,
    ),
  ],
);

export type CustomField = typeof customFields.$inferSelect;
export type NewCustomField = typeof customFields.$inferInsert;

export const postCustomValues = pgTable(
  "post_custom_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => customFields.id, { onDelete: "cascade" }),
    // Değer metin saklanır; number/date doğrulaması API katmanında yapılır.
    value: text("value"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("post_custom_values_post_field_unique").on(
      table.postId,
      table.fieldId,
    ),
  ],
);

export type PostCustomValue = typeof postCustomValues.$inferSelect;
export type NewPostCustomValue = typeof postCustomValues.$inferInsert;

// Per-workspace entegrasyon kaydı (Sprint 58 — per-workspace otomasyon).
// Her workspace kendi dış servis bağlantısını (ör. Linear webhook) tutar;
// gelen webhook ?ws=<slug>&t=<urlToken> ile doğru workspace'e yönlendirilir.
// webhookSecret: Linear'ın HMAC doğrulama anahtarı (connect anında döner).
// urlToken: her workspace'e özel, URL'ye gömülen yüksek entropili gizli.
export const workspaceIntegrations = pgTable(
  "workspace_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 40 }).notNull(),
    // Dış servis webhook id'si (silme/refresh için).
    webhookId: text("webhook_id"),
    // Dış servis API key — webhook silme/refresh için saklanır (Linear key).
    // Not: üretimde şifreli saklanmalı; şimdilik workspace sahibinin kendi
    // API key'i olduğu için düz tutulur (Canny/Intercom modeli).
    apiKey: text("api_key"),
    // Linear webhook signing secret (HMAC anahtarı).
    webhookSecret: text("webhook_secret"),
    // URL'ye gömülen per-workspace token (?t=).
    urlToken: text("url_token"),
    // Abone olunan Linear resourceTypes (Issue/Comment/CustomerNeed vb.).
    resourceTypes: text("resource_types").array(),
    // Opsiyonel: belirli bir Linear ekibi.
    linearTeamId: text("linear_team_id"),
    // Sprint 63g (Jira per-workspace): Jira base URL + site e-postası.
    // (Linear için apiKey=API key; Jira için apiKey=API token + bu iki alan.)
    baseUrl: text("base_url"),
    accountEmail: text("account_email"),
    // connected | error | disconnected
    status: varchar("status", { length: 20 }).notNull().default("connected"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_integrations_workspace_provider_key").on(
      table.workspaceId,
      table.provider,
    ),
    index("workspace_integrations_provider_idx").on(table.provider),
  ],
);

export type WorkspaceIntegration = typeof workspaceIntegrations.$inferSelect;
export type NewWorkspaceIntegration = typeof workspaceIntegrations.$inferInsert;
