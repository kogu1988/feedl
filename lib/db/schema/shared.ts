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

export const workspaceMemberRoleEnum = pgEnum("workspace_member_role", [
  "owner",
  "admin",
  "member",
  "contributor",
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
