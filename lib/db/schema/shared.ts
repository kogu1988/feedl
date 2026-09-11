import { customType, pgEnum } from "drizzle-orm/pg-core";

// Sprint 63y (B7) — paylaşılan ilkel: tüm pgEnum'lar + tsvector özel tipi.
// Bunlar hiçbir tabloya bağımlı değildir (leaf), bu yüzden ayrı modüldedir.
// `lib/db/schema.ts` bunları hem import eder hem re-export eder — dışa
// importlar (@/lib/db/schema) DEĞİŞMEZ.

export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

export const userRoleEnum = pgEnum("user_role", ["admin", "customer"]);

export const postStatusEnum = pgEnum("post_status", [
  "open",
  "under-review",
  "planned",
  "in-progress",
  "shipped",
  "closed",
]);

export const postSentimentEnum = pgEnum("post_sentiment", [
  "pozitif",
  "notr",
  "negatif",
]);

export const postTypeEnum = pgEnum("post_type", [
  "feature",
  "bug",
  "usability",
]);

export const boardVisibilityEnum = pgEnum("board_visibility", [
  "public",
  "private",
]);

// 2026-09-11 (kullanıcı kararı): 3 kademe. owner = her şey (billing dahil),
// manager = ürün ops + üye yönetimi (billing hariç), member = ürün ops.
// "user" (yetkisiz düz kullanıcı) SAKLANAN bir rol değildir: üyelik satırı
// olmamasıdır (yalnız public portal + widget). Eski `admin`/`contributor`
// kaldırıldı → manager/member olarak yeniden adlandırıldı. `admin` adı artık
// yalnız `user_role` enum'unda feedl PLATFORM personeli için ayrılmıştır.
export const workspaceMemberRoleEnum = pgEnum("workspace_member_role", [
  "owner",
  "manager",
  "member",
]);

export const widgetTriageEnum = pgEnum("widget_triage_type", [
  "feedback",
  "support",
  "clarify",
  "unrecognized",
]);

export const aiSuggestionTypeEnum = pgEnum("ai_suggestion_type", [
  "duplicate",
]);

export const aiSuggestionStatusEnum = pgEnum("ai_suggestion_status", [
  "pending",
  "approved",
  "rejected",
  "ignored",
]);

export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "select",
  "number",
  "date",
]);
