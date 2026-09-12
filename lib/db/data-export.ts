import "server-only";

import { eq, inArray, is } from "drizzle-orm";
import { getTableConfig, PgTable, type PgColumn } from "drizzle-orm/pg-core";

import { getDb } from "./index";
import * as schema from "./schema";
import {
  aiSuggestions,
  changelogPostLinks,
  comments,
  companyMembers,
  emailDeliveries,
  postCustomValues,
  postFollowers,
  postMerges,
  postOpportunities,
  postStatusHistory,
  postTags,
  users,
  votes,
  workspaces,
} from "./schema";

// Denetim #8b — GDPR/KVKK veri taşınabilirliği: bir workspace'in TÜM verisini
// tek bir JSON dosyasında dışa aktarır.
//
// KAPSAM NEDEN KARIŞIK: şemadaki her tablo `workspace_id` taşımaz.
//  - 20 tablo doğrudan `workspace_id` ile scope'ludur → türetilir.
//  - `votes`, `comments`, `post_tags`, `post_followers`, `ai_suggestions`,
//    `post_opportunities`, `post_custom_values`, `post_status_history`,
//    `post_merges`, `changelog_post_links` yalnız `post_id` taşır (fikir
//    silinince kendiliğinden gider) → workspace'in fikirleriyle filtrelenir.
//  - `company_members` şirket üzerinden, `email_deliveries` kullanıcı
//    üzerinden scope'ludur.
// Bunlar elle eşlenir ÇÜNKÜ ilişki generik türetilemez (`post_id` mi
// `source_post_id` mi?). Drift'e karşı iki test vardır: her tablo bir gruba
// ATANMIŞ olmalı ve yeni eklenen bir tablo hiçbir gruba girmiyorsa test kırılır
// (sessizce eksik ihracı engeller).

// Sır/anahtar benzeri kolonlar + 2048 boyutlu embedding vektörleri dosyaya
// yazılmaz. Dosya kullanıcının kendi arşividir ama paylaşılabilir/yedeklenebilir;
// kimlik bilgilerini (hash/şifreli olsa da) toplu bir dosyaya koymak gereksiz
// risktir. Bu değerler yeniden üretilebilir (unsubscribe linki, webhook secret).
const SECRET_COLUMN_RE = /(secret|password|token|hash|encrypted|embedding)/i;

export const REDACTED = "[gizlendi]";

// Dışa aktarımda değeri gizlenmesi gereken kolon adı mı? (JS/camelCase anahtar.)
export function isRedactedKey(key: string): boolean {
  return SECRET_COLUMN_RE.test(key);
}

// Dışa aktarım kapsamı DIŞINDAKİ tablolar ve gerekçeleri. Bu tablolar ya kök
// kayıttır (ayrı alanlarda verilir) ya da kullanıcı verisi taşımayan teknik
// defterdir.
export const EXCLUDED_TABLE_NAMES: ReadonlySet<string> = new Set([
  // Kök: workspace satırı `workspace`, kullanıcılar `users` alanında verilir.
  "workspaces",
  "users",
  // Teknik idempotency defteri: kısa ömürlüdür (`expires_at`), kullanıcı
  // verisi değildir, workspace_id de taşımaz.
  "api_idempotency",
]);

// Fikir (post) üzerinden scope'lu tablolar — workspace'in fikir id'leriyle
// filtrelenir. Sıra anahtarı ihracın tablo adıdır.
export const POST_SCOPED_TABLES: ReadonlyArray<{
  table: PgTable;
  column: PgColumn;
}> = [
  { table: votes, column: votes.postId },
  { table: comments, column: comments.postId },
  { table: postMerges, column: postMerges.sourcePostId },
  { table: postStatusHistory, column: postStatusHistory.postId },
  { table: postTags, column: postTags.postId },
  { table: changelogPostLinks, column: changelogPostLinks.postId },
  { table: postFollowers, column: postFollowers.postId },
  { table: aiSuggestions, column: aiSuggestions.postId },
  { table: postOpportunities, column: postOpportunities.postId },
  { table: postCustomValues, column: postCustomValues.postId },
];

// Şirket üzerinden scope'lu tablolar (workspace'in şirket id'leriyle filtrelenir).
export const COMPANY_SCOPED_TABLES: ReadonlyArray<{
  table: PgTable;
  column: PgColumn;
}> = [{ table: companyMembers, column: companyMembers.companyId }];

// Kullanıcı üzerinden scope'lu tablolar (workspace'le ilişkili kullanıcı
// id'leriyle filtrelenir).
export const USER_SCOPED_TABLES: ReadonlyArray<{
  table: PgTable;
  column: PgColumn;
}> = [{ table: emailDeliveries, column: emailDeliveries.userId }];

export interface WorkspaceScopedTable {
  /** DB tablo adı (snake_case) — ihracın anahtarı. */
  name: string;
  table: PgTable;
  workspaceColumn: PgColumn;
}

// Şema modülündeki `workspace_id` kolonu taşıyan tablolar (türetilir; elle
// liste tutulmaz — yeni tablo otomatik kapsanır).
export function listWorkspaceScopedTables(): WorkspaceScopedTable[] {
  const found: WorkspaceScopedTable[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    const workspaceColumn = config.columns.find(
      (column) => column.name === "workspace_id",
    );
    if (!workspaceColumn) continue;
    found.push({ name: config.name, table: value, workspaceColumn });
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

// İhracın hesabını veren sözleşme: şemadaki HER tablo ya bir gruba girer ya da
// EXCLUDED_TABLE_NAMES'te gerekçesiyle listelenir. Test bunu doğrular.
export function exportedTableNames(): string[] {
  return [
    ...listWorkspaceScopedTables().map((entry) => entry.name),
    ...POST_SCOPED_TABLES.map((entry) => getTableConfig(entry.table).name),
    ...COMPANY_SCOPED_TABLES.map((entry) => getTableConfig(entry.table).name),
    ...USER_SCOPED_TABLES.map((entry) => getTableConfig(entry.table).name),
  ].sort((a, b) => a.localeCompare(b));
}

// Bir satırı ihracın parçası hâline getirir: sır kolonları maskeler,
// `undefined` alanları düşürür (dosya daha okunur olur).
export function redactRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    out[key] = isRedactedKey(key) ? REDACTED : value;
  }
  return out;
}

export interface WorkspaceExport {
  formatVersion: number;
  generator: string;
  exportedAt: string;
  workspace: Record<string, unknown> | null;
  users: Record<string, unknown>[];
  tables: Record<string, Record<string, unknown>[]>;
  counts: Record<string, number>;
}

// Workspace'in tüm verisini okur. Sorgular bilinçli olarak sıralıdır: bu tek
// seferlik, seyrek bir işlemdir ve neon-http üzerinde paralel okuma kazancı yok.
export async function buildWorkspaceExport(
  workspaceId: string,
): Promise<WorkspaceExport> {
  const db = getDb();
  const tables: Record<string, Record<string, unknown>[]> = {};

  const [workspaceRow] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  // 1) Doğrudan workspace'e bağlı tablolar.
  for (const { name, table, workspaceColumn } of listWorkspaceScopedTables()) {
    const rows = (await db
      .select()
      .from(table)
      .where(eq(workspaceColumn, workspaceId))) as Record<string, unknown>[];
    tables[name] = rows.map(redactRow);
  }

  const idColumn = (rows: Record<string, unknown>[]): string[] =>
    rows
      .map((row) => row.id)
      .filter((value): value is string => typeof value === "string");

  // 2) Fikir üzerinden scope'lu tablolar.
  const postIds = idColumn(tables["posts"] ?? []);
  for (const { table, column } of POST_SCOPED_TABLES) {
    const name = getTableConfig(table).name;
    const rows = postIds.length
      ? ((await db
          .select()
          .from(table)
          .where(inArray(column, postIds))) as Record<string, unknown>[])
      : [];
    tables[name] = rows.map(redactRow);
  }

  // 3) Şirket üzerinden scope'lu tablolar.
  const companyIds = idColumn(tables["companies"] ?? []);
  for (const { table, column } of COMPANY_SCOPED_TABLES) {
    const name = getTableConfig(table).name;
    const rows = companyIds.length
      ? ((await db
          .select()
          .from(table)
          .where(inArray(column, companyIds))) as Record<string, unknown>[])
      : [];
    tables[name] = rows.map(redactRow);
  }

  // 4) Workspace'le ilişkili kullanıcılar: üyeler + fikir/yorum/oy/takip
  //    sahipleri. Portal son kullanıcıları da (kayıtlı olmayan) bu kümeye girer;
  //    ihracın kapsamı "workspace'e veri bırakan herkes"tir.
  const relatedUserIds = new Set<string>();
  for (const row of tables["workspace_members"] ?? []) {
    if (typeof row.userId === "string") relatedUserIds.add(row.userId);
  }
  for (const table of ["posts", "comments", "votes", "post_followers"]) {
    for (const row of tables[table] ?? []) {
      if (typeof row.userId === "string") relatedUserIds.add(row.userId);
    }
  }
  const relatedIds = [...relatedUserIds];

  // 5) Kullanıcı üzerinden scope'lu tablolar.
  for (const { table, column } of USER_SCOPED_TABLES) {
    const name = getTableConfig(table).name;
    const rows = relatedIds.length
      ? ((await db
          .select()
          .from(table)
          .where(inArray(column, relatedIds))) as Record<string, unknown>[])
      : [];
    tables[name] = rows.map(redactRow);
  }

  const userRows = relatedIds.length
    ? await db.select().from(users).where(inArray(users.id, relatedIds))
    : [];

  const counts: Record<string, number> = {};
  for (const [name, rows] of Object.entries(tables)) counts[name] = rows.length;
  counts["users"] = userRows.length;

  return {
    formatVersion: 1,
    generator: "feedl",
    exportedAt: new Date().toISOString(),
    workspace: workspaceRow ? redactRow(workspaceRow as Record<string, unknown>) : null,
    users: userRows.map(redactRow),
    tables,
    counts,
  };
}
