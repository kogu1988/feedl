import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "./index";
import { getWorkspaceId } from "./workspace";
import { getDefaultBoardId } from "./board";
import { posts, postTags, tags, users } from "./schema";
import { statusLabels, typeLabels } from "@/lib/post-format";

// Sprint 59 (madde — import): CSV'den feedback importu. Export CSV formatıyla
// uyumlu; Türkçe başlıklar (Başlık, Açıklama, Durum, Tür, Etiketler) kabul edilir.
// Aynı başlık workspace'te zaten varsa atlanır (idempotent). AI analiz burada
// çalıştırılmaz (bulk import maliyeti); postlar `open`/unanalyzed kalır.

// Durum/Tür etiketini enum değerine çevir (Türkçe gösterim → enum).
const statusToEnum = Object.fromEntries(
  Object.entries(statusLabels).map(([k, v]) => [v.toLowerCase(), k]),
);
const typeToEnum = Object.fromEntries(
  Object.entries(typeLabels).map(([k, v]) => [v.toLowerCase(), k]),
);

// Canny CSV statüleri → feedl status enum'u (İngilizce).
const cannyStatusToEnum: Record<string, string> = {
  open: "open",
  "under review": "under-review",
  under_review: "under-review",
  planned: "planned",
  "in progress": "in-progress",
  in_progress: "in-progress",
  completed: "shipped",
  shipped: "shipped",
  done: "shipped",
  closed: "closed",
  archive: "closed",
};

// Canny CSV başlık takma adları → feedl kanonik alan adı.
const cannyHeaderAliases: Record<string, string> = {
  name: "title",
  headline: "title",
  body: "description",
  content: "description",
  details: "description",
  state: "status",
  category: "tags",
  labels: "tags",
};

// CSV/Canny başlık takma adları → normalize kanonik alan adı.
const headerAliases: Record<string, string> = {
  başlık: "title",
  baslik: "title",
  title: "title",
  açıklama: "description",
  aciklama: "description",
  description: "description",
  durum: "status",
  status: "status",
  tür: "type",
  tur: "type",
  type: "type",
  etiketler: "tags",
  tags: "tags",
  etiket: "tags",
  tag: "tags",
  ...cannyHeaderAliases,
};

export interface ImportResult {
  created: number;
  skippedDuplicates: number;
  errors: string[];
}

export async function importPosts(
  headers: string[],
  rows: string[][],
  source: string = "import",
): Promise<ImportResult> {
  // Başlık sütununu normalize et.
  const canonical: string[] = headers.map(
    (h) => headerAliases[h.trim().toLowerCase()] ?? "",
  );
  const titleIdx = canonical.indexOf("title");
  if (titleIdx === -1) {
    return { created: 0, skippedDuplicates: 0, errors: ["CSV'de 'Başlık' sütunu yok."] };
  }

  const workspaceId = await getWorkspaceId();
  const boardId = await getDefaultBoardId();

  // Sentetik "CSV import" kullanıcısı (müşteri kimliği yok). Deterministik id
  // ile tek kullanıcı; tüm import post'ları bu kullanıcıya bağlanır.
  const importUserId = "import_csv";
  await getDb()
    .insert(users)
    .values({
      id: importUserId,
      email: "import@feedl.local",
      name: "CSV Import",
      role: "customer",
    })
    .onConflictDoNothing();

  // Mevcut başlıkları topla (idempotent dedupe için).
  const existing = await getDb()
    .select({ title: posts.title })
    .from(posts)
    .where(eq(posts.workspaceId, workspaceId));
  const existingTitles = new Set(existing.map((r) => r.title.trim().toLowerCase()));

  const result: ImportResult = { created: 0, skippedDuplicates: 0, errors: [] };
  const db = getDb();

  for (const [rowIdx, row] of rows.entries()) {
    const rawTitle = (row[titleIdx] ?? "").trim();
    if (!rawTitle) {
      result.errors.push(`Satır ${rowIdx + 2}: boş başlık atlandı.`);
      continue;
    }
    const titleKey = rawTitle.toLowerCase();
    if (existingTitles.has(titleKey)) {
      result.skippedDuplicates += 1;
      continue;
    }

    const description = canonical.indexOf("description") >= 0
      ? (row[canonical.indexOf("description")] ?? "").trim()
      : "";
    const statusRaw = canonical.indexOf("status") >= 0
      ? (row[canonical.indexOf("status")] ?? "").trim().toLowerCase()
      : "";
    const typeRaw = canonical.indexOf("type") >= 0
      ? (row[canonical.indexOf("type")] ?? "").trim().toLowerCase()
      : "";
    const tagsRaw = canonical.indexOf("tags") >= 0
      ? (row[canonical.indexOf("tags")] ?? "").trim()
      : "";

    const VALID_TYPES = ["feature", "bug", "usability"] as const;
    const VALID_STATUSES = ["open", "under-review", "planned", "in-progress", "shipped", "closed"] as const;
    const status =
      statusToEnum[statusRaw] ??
      cannyStatusToEnum[statusRaw] ??
      ((VALID_STATUSES as readonly string[]).includes(statusRaw)
        ? statusRaw
        : "open");
    const postType = (
      (typeToEnum[typeRaw] as (typeof VALID_TYPES)[number] | undefined) ??
      (VALID_TYPES.includes(typeRaw as (typeof VALID_TYPES)[number]) ? (typeRaw as (typeof VALID_TYPES)[number]) : undefined)
    );

    try {
      const [created] = await db
        .insert(posts)
        .values({
          workspaceId,
          boardId,
          userId: importUserId,
          title: rawTitle.slice(0, 140),
          description: description || rawTitle,
          status: status as (typeof VALID_STATUSES)[number],
          postType: postType ?? null,
          source,
        })
        .returning({ id: posts.id });
      existingTitles.add(titleKey);

      // Etiketler: "#etiket1 #etiket2" veya "etiket1, etiket2" formatı.
      for (const raw of parseTags(tagsRaw)) {
        if (!created?.id) break;
        const label = raw.toLowerCase();
        // Tag varsa id al, yoksa oluştur.
        const [found] = await db
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.workspaceId, workspaceId), eq(tags.name, label)))
          .limit(1);
        let tagId = found?.id;
        if (!tagId) {
          const [ins] = await db
            .insert(tags)
            .values({ workspaceId, name: label })
            .returning({ id: tags.id });
          tagId = ins?.id;
        }
        if (tagId) {
          await db
            .insert(postTags)
            .values({ postId: created.id, tagId })
            .onConflictDoNothing();
        }
      }

      result.created += 1;
    } catch (err) {
      result.errors.push(
        `Satır ${rowIdx + 2}: ${err instanceof Error ? err.message : "eklenemedi."}`,
      );
    }
  }

  return result;
}

// "#a #b" veya "a, b" formatından etiket listesi.
function parseTags(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#+/, ""))
    .filter(Boolean)
    .slice(0, 20);
}
