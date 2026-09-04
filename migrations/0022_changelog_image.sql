-- Sprint 40: changelog duyurularına kapak görseli (PM raporu §8.4 —
-- "markdown render, görsel"). Şema: lib/db/schema.ts changelogEntries
-- imageUrl (snapshot 0022'de eşlenik).

ALTER TABLE "changelog_entries" ADD COLUMN "image_url" text;
