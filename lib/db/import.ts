import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { getDb } from "./index";
import { getWorkspaceId } from "./workspace";
import { getDefaultBoardId } from "./board";
import { posts, postTags, tags, users, votes } from "./schema";
import { statusLabels, typeLabels } from "@/lib/post-format";

// Başka araçtan gelen oy sayısı: sentetik oy kullanıcıları ile `votes`'a taşınır.
// `votes.user_id → users.id NOT NULL` + `unique(user_id, post_id)` olduğu için
// her oyya benzersiz sentetik kimlik gerekir. Cap, veri şişkinliğini önler.
const MAX_IMPORT_VOTES_PER_POST = 1000;

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

// Dış araç CSV statüleri → feedl status enum'u (İngilizce).
const externalStatusToEnum: Record<string, string> = {
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

// Dış araç CSV başlık takma adları → feedl kanonik alan adı.
// (İleri import: oy/yazar/yorum sayısı dış export'tan taşınır.)
const externalHeaderAliases: Record<string, string> = {
  name: "title",
  headline: "title",
  body: "description",
  content: "description",
  details: "description",
  state: "status",
  category: "tags",
  labels: "tags",
  votes: "votes",
  upvotes: "votes",
  vote_count: "votes",
  author: "author",
  author_email: "author",
  email: "author",
  comment_count: "commentCount",
  comments: "commentCount",
  commentCount: "commentCount",
};

// CSV / dış araç başlık takma adları → normalize kanonik alan adı.
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
  oy: "votes",
  oy_sayisi: "votes",
  upvotes: "votes",
  votes: "votes",
  vote_count: "votes",
  yazar: "author",
  author: "author",
  author_email: "author",
  email: "author",
  yorum_sayisi: "commentCount",
  comment_count: "commentCount",
  comments: "commentCount",
  ...externalHeaderAliases,
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

  // Yazar (`author`/`email` sütunu) varsa onu oluştur; yoksa import_csv.
  // Deterministik: email'den türetilmiş id (aynı satır tekrar gelirse aynı user).
  const authorIdx = canonical.indexOf("author");
  const authorEmail = authorIdx >= 0 ? (rows[0]?.[authorIdx] ?? "").trim() : "";
  const authorUserIds = new Map<string, string>();
  if (authorEmail) {
    const slug = authorEmail.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
    const authorId = `import_author_${slug.slice(0, 60)}`;
    await getDb()
      .insert(users)
      .values({
        id: authorId,
        email: authorEmail,
        name: authorEmail.split("@")[0] || "Imported Author",
        role: "customer",
      })
      .onConflictDoNothing();
    // Satır bazlı (her satırın kendi author'u olabilir) — ilk satırdan map.
    authorUserIds.set(authorEmail.toLowerCase(), authorId);
  }

  // Mevcut başlıkları topla (idempotent dedupe için).
  const existing = await getDb()
    .select({ title: posts.title })
    .from(posts)
    .where(eq(posts.workspaceId, workspaceId));
  const existingTitles = new Set(existing.map((r) => r.title.trim().toLowerCase()));

  const result: ImportResult = { created: 0, skippedDuplicates: 0, errors: [] };
  const db = getDb();

  // 2026-09-12 (denetim — import): ETİKET ÖNBELLEĞİ.
  //
  // Önceden her satırın her etiketi için bir `select` atılıyordu; 200 satır ×
  // 3 etiket = 600 gereksiz gidiş-dönüş. Artık workspace'in etiketleri TEK
  // sorguyla çekilir ve yeni oluşturulanlar haritaya eklenir.
  const tagMap = new Map<string, string>();
  for (const t of await db
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.workspaceId, workspaceId))) {
    tagMap.set(t.name, t.id);
  }

  // Etiket id'sini garanti eder (haritadan ya da yeni oluşturarak). Yeni etiket
  // başına 1 yazma; yarış durumunda (paralel import) `onConflictDoNothing`
  // boş döner ve mevcut satır okunur — böylece post_tags FK'si kırılmaz.
  async function ensureTagId(label: string): Promise<string | null> {
    const cached = tagMap.get(label);
    if (cached) return cached;
    const id = randomUUID();
    const [ins] = await db
      .insert(tags)
      .values({ id, workspaceId, name: label })
      .onConflictDoNothing()
      .returning({ id: tags.id });
    if (ins?.id) {
      tagMap.set(label, ins.id);
      return ins.id;
    }
    const [found] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), eq(tags.name, label)))
      .limit(1);
    if (found?.id) tagMap.set(label, found.id);
    return found?.id ?? null;
  }

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
      externalStatusToEnum[statusRaw] ??
      ((VALID_STATUSES as readonly string[]).includes(statusRaw)
        ? statusRaw
        : "open");
    const postType = (
      (typeToEnum[typeRaw] as (typeof VALID_TYPES)[number] | undefined) ??
      (VALID_TYPES.includes(typeRaw as (typeof VALID_TYPES)[number]) ? (typeRaw as (typeof VALID_TYPES)[number]) : undefined)
    );

    // Oy sayısı (`Votes`/`upvotes` sütunu) — en çok oy metriği doğru çıksın.
    const votesRaw = canonical.indexOf("votes") >= 0
      ? parseInt((row[canonical.indexOf("votes")] ?? "").replace(/\D/g, ""), 10)
      : 0;
    const voteCount = Number.isFinite(votesRaw)
      ? Math.min(Math.max(votesRaw, 0), MAX_IMPORT_VOTES_PER_POST)
      : 0;
    // Yorum sayısı (body yok → sadece iç not olarak açıklamaya eklenir).
    const commentCountRaw = canonical.indexOf("commentCount") >= 0
      ? parseInt((row[canonical.indexOf("commentCount")] ?? "").replace(/\D/g, ""), 10)
      : 0;
    const commentCount = Number.isFinite(commentCountRaw)
      ? Math.max(commentCountRaw, 0)
      : 0;
    // Yazar (satır bazlı).
    const rowAuthor = authorIdx >= 0 ? (row[authorIdx] ?? "").trim() : "";
    const rowAuthorId = rowAuthor
      ? (authorUserIds.get(rowAuthor.toLowerCase()) ?? authorUserIds.get(authorEmail.toLowerCase()) ?? importUserId)
      : importUserId;

    try {
      // 2026-09-12 (denetim — import): SATIR BAŞINA TEK BATCH (atomik).
      //
      // Önceden post → oy'lar → (etiket başına select+insert+post_tag) ayrı
      // gidiş-dönüşlerdi: 200 satırlık bir CSV binlerce seri HTTP isteği
      // demekti ve satırın ORTASINDA bir hata olursa post kalır, etiketleri
      // kalmazdı (kısmi satır). Artık satırın tüm yazmaları tek transaction'da:
      //   [post, oy kullanıcıları, oylar, post_tags...]
      // Id'ler önceden üretildiği için batch içinde sonuç bağımlılığı yok.
      // Satır-bazlı hata toleransı KORUNUR (tasarım: 98/100 içe aktar, 2'yi
      // raporla) — batch yalnız O SATIRI atomik yapar, tüm importu değil.
      const postId = randomUUID();
      const tagIds: string[] = [];
      for (const raw of parseTags(tagsRaw)) {
        const tagId = await ensureTagId(raw.toLowerCase());
        if (tagId) tagIds.push(tagId);
      }

      const batch = [
        db.insert(posts).values({
          id: postId,
          workspaceId,
          boardId,
          userId: rowAuthorId,
          title: rawTitle.slice(0, 140),
          description: buildDescription(description, rawTitle, commentCount),
          status: status as (typeof VALID_STATUSES)[number],
          postType: postType ?? null,
          source,
        }),
        ...voteStatements(postId, voteCount, db),
        ...(tagIds.length > 0
          ? [
              db
                .insert(postTags)
                .values(tagIds.map((tagId) => ({ postId, tagId })))
                .onConflictDoNothing(),
            ]
          : []),
      ];
      // Drizzle `batch` en az bir ifade ister; ilk eleman her zaman post'tur.
      await db.batch(batch as [typeof batch[0], ...typeof batch]);
      existingTitles.add(titleKey);
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

// Dış araçtan gelen yorum sayısı: body yok (CSV sadece sayı) → gerçek yorum
// satırı üretilemez, açıklamanın sonuna aktarım iç notu olarak eklenir.
function buildDescription(description: string, fallbackTitle: string, commentCount: number): string {
  const base = description || fallbackTitle || "";
  if (commentCount > 0) {
    return `${base}\n\n> *${commentCount} yorum içe aktarımdan taşındı.*`;
  }
  return base;
}

// `Votes` sayısını `votes` tablosuna gerçek satırlar olarak taşır.
// Her oy için benzersiz sentetik kullanıcı (unique(user_id, post_id) gereği).
//
// 2026-09-12 (denetim — import): fonksiyon ARTIK YAZMAZ, batch'e konacak
// ifadeleri ÜRETİR. Böylece oy yazmaları da satırın tek transaction'ına girer
// (eskiden ayrı gidiş-dönüşlerdi ve satır ortasında kopabiliyordu).
function voteStatements(
  postId: string,
  count: number,
  db: ReturnType<typeof getDb>,
) {
  const capped = Math.min(Math.max(count, 0), MAX_IMPORT_VOTES_PER_POST);
  if (capped === 0) return [];
  const rows = [];
  for (let i = 0; i < capped; i++) {
    rows.push({ userId: `import_vote_${postId}_${i}`, postId });
  }
  return [
    db
      .insert(users)
      .values(
        rows.map((r) => ({
          id: r.userId,
          email: `${r.userId}@feedl.import`,
          name: "Imported Voter",
          role: "customer" as const,
        })),
      )
      .onConflictDoNothing(),
    db.insert(votes).values(rows).onConflictDoNothing(),
  ];
}
