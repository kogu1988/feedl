import "server-only";

// Sprint 70.2 — dashboard sayfasının VERİ YÜKLEYİCİLERİ (sunucu tarafı).
//
// Neden ayrıldı: sayfa dosyası 1246 satırdı ve veri erişimi ile görünüm
// iç içeydi; yükleyicilere dokunmak için 700 satır JSX taranıyordu. Davranış
// DEĞİŞMEDİ — yalnız taşındı. Yeni okuma sorguları buraya eklenir.
import { and, asc, count, countDistinct, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { listWorkspaceTeam } from "@/lib/db/membership";
import { computeRevenueScore, loadPostImpactContexts, revenueScoreOrderSql } from "@/lib/db/revenue-scores";
import { aiSuggestions, apiKeys, changelogEntries, comments, postStatusEnum, postTags, posts, savedViews, tags, users, votes, webhookEndpoints } from "@/lib/db/schema";
import { trDateTimeFormatter } from "@/lib/post-format";

export const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Sprint 21: ?tag= filtresi — birleşmiş fikirler dahil (admin görür).
// Sprint 39: durum filtresi sunucuda uygulanır + offset/limit sayfalama.
// 2026-09-12 (frontend_plan P1-8): sıralama seçenekleri. `newest` varsayılan
// (mevcut davranış KORUNUR). `votes` talebe, `impact` iş etkisine göre sıralar;
// ikisi de SQL'de yapılır → sayfalama bozulmaz (tüm liste JS'e çekilmez).
// Sayfa modülünden export EDİLMEZ (Next.js sayfa export'ları için güvenli değil).
export const POST_SORTS = ["newest", "votes", "impact"] as const;
export type PostSort = (typeof POST_SORTS)[number];

export async function loadPosts(
  tagFilter: string,
  statusFilter: (typeof postStatusEnum.enumValues)[number] | null,
  limit: number,
  offset: number,
  boardId?: string,
  deviceFilter?: string | null,
  sort: PostSort = "newest",
) {
  const workspaceId = await getWorkspaceId();
  return getDb()
    .select({
      id: posts.id,
      title: posts.title,
      status: posts.status,
      sentimentLabel: posts.sentimentLabel,
      aiKeywords: posts.aiKeywords,
      postType: posts.postType,
      mergedIntoId: posts.mergedIntoId,
      boardId: posts.boardId,
      createdAt: posts.createdAt,
      voteCount: count(votes.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .where(dashboardPostConditions(workspaceId, tagFilter, statusFilter, boardId, deviceFilter))
    .groupBy(posts.id)
    .orderBy(
      sort === "votes"
        ? desc(count(votes.id))
        : sort === "impact"
          ? revenueScoreOrderSql(workspaceId)
          : desc(posts.createdAt),
    )
    .limit(limit)
    .offset(offset);
}

// Sprint 39: loadPosts + countDashboardPosts paylaşılan where koşulu
// (tek kaynak kuralı). statusFilter undefined → istatistik sorgusu tüm
// durumları kapsar (kartlar filtrelenmemiş toplamları gösterir). Sprint
// 48d: boardId koşulu — ?board= verildiyse o board'un fikirleri.
export function dashboardPostConditions(
  workspaceId: string,
  tagFilter: string,
  statusFilter: (typeof postStatusEnum.enumValues)[number] | null | undefined,
  boardId?: string,
  deviceFilter?: string | null,
) {
  return and(
    eq(posts.workspaceId, workspaceId),
    boardId ? eq(posts.boardId, boardId) : undefined,
    deviceFilter ? eq(posts.deviceType, deviceFilter) : undefined,
    tagFilter
      ? inArray(
          posts.id,
          getDb()
            .select({ postId: postTags.postId })
            .from(postTags)
            .innerJoin(tags, eq(tags.id, postTags.tagId))
            .where(
              and(
                eq(tags.workspaceId, workspaceId),
                eq(tags.name, tagFilter),
              ),
            ),
        )
      : undefined,
    statusFilter ? eq(posts.status, statusFilter) : undefined,
  );
}

export async function countDashboardPosts(
  tagFilter: string,
  statusFilter: (typeof postStatusEnum.enumValues)[number] | null,
  boardId?: string,
  deviceFilter?: string | null,
) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(posts)
    .where(
      dashboardPostConditions(
        await getWorkspaceId(),
        tagFilter,
        statusFilter,
        boardId,
        deviceFilter,
      ),
    );
  return row.value;
}

// Sprint 39: istatistikler sayfalanmış rows'tan DEĞİL, agregat sorgudan
// hesaplanır — tablo sayfalansa da kartlar/analitik tüm fikirleri
// yansıtır (eski davranış: rows limit(200) idi; toplamlar artık tam).
// Durum filtresi burada uygulanmaz (eski davranış: rows filtre öncesiydi).
export async function loadPostStats(tagFilter: string) {
  const workspaceId = await getWorkspaceId();
  const statusRows = await getDb()
    .select({
      status: posts.status,
      sentimentLabel: posts.sentimentLabel,
      postCount: countDistinct(posts.id),
      voteCount: count(votes.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .where(dashboardPostConditions(workspaceId, tagFilter, undefined))
    .groupBy(posts.status, posts.sentimentLabel);

  const stats = {
    totalPosts: 0,
    totalVotes: 0,
    openCount: 0,
    shippedCount: 0,
  };
  const sentimentCounts = { pozitif: 0, notr: 0, negatif: 0, unanalyzed: 0 };
  for (const row of statusRows) {
    stats.totalPosts += row.postCount;
    stats.totalVotes += row.voteCount;
    if (row.status === "open") stats.openCount += row.postCount;
    if (row.status === "shipped") stats.shippedCount += row.postCount;
    if (row.sentimentLabel === "pozitif") sentimentCounts.pozitif += row.postCount;
    else if (row.sentimentLabel === "notr") sentimentCounts.notr += row.postCount;
    else if (row.sentimentLabel === "negatif") sentimentCounts.negatif += row.postCount;
    else sentimentCounts.unanalyzed += row.postCount;
  }

  // En çok oy alanlar — eski davranış: durum filtresinden bağımsız,
  // birleşmiş fikirler hariç, en yüksek oydan 5 satır (beraberlikte
  // en yeni üstte — eski JS sıralamasıyla aynı).
  const topPosts = await getDb()
    .select({
      id: posts.id,
      title: posts.title,
      status: posts.status,
      voteCount: countDistinct(votes.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .where(
      and(
        eq(posts.workspaceId, workspaceId),
        isNull(posts.mergedIntoId),
        tagFilter
          ? inArray(
              posts.id,
              getDb()
                .select({ postId: postTags.postId })
                .from(postTags)
                .innerJoin(tags, eq(tags.id, postTags.tagId))
                .where(
                  and(
                    eq(tags.workspaceId, workspaceId),
                    eq(tags.name, tagFilter),
                  ),
                ),
            )
          : undefined,
      ),
    )
    .groupBy(posts.id)
    .orderBy(desc(countDistinct(votes.id)), desc(posts.createdAt))
    .limit(5);

  return { stats, sentimentCounts, topPosts };
}

// 2026-09-12 (frontend_plan P1-11) — dashboard içgörüsü: "Gelir etkisi en
// yüksek". "En çok istenenler" (oy) ile aynı kapsam ve aynı dönem/etiket
// davranışı, ama sıralama TALEP değil İŞ ETKİSİ üzerinden.
//
// Sıralama SQL'de: mevcut `revenueScoreOrderSql` kullanılır — `?sort=impact`
// ile AYNI ifade, böylece listedeki sıra ile gösterilen skor ayrışamaz (§6).
// Tüm liste JS'e çekilmez, yalnız en iyi 5 satır gelir (§33).
//
// Skor sütunu Pro olduğu için bu sorgu Free'de HİÇ koşmaz (çağıran `isPro`
// ile korur) — kilitli bir özellik için veri çekmenin anlamı yok.
export async function loadTopRevenuePosts(tagFilter: string) {
  const workspaceId = await getWorkspaceId();
  const rows = await getDb()
    .select({ id: posts.id, title: posts.title, status: posts.status })
    .from(posts)
    .where(
      and(
        dashboardPostConditions(workspaceId, tagFilter, undefined),
        isNull(posts.mergedIntoId),
      ),
    )
    .orderBy(revenueScoreOrderSql(workspaceId))
    .limit(5);

  const contexts = await loadPostImpactContexts(rows.map((row) => row.id));
  return rows.map((row) => {
    const voteCount = contexts.get(row.id)?.voteCount ?? 0;
    const customerCount = contexts.get(row.id)?.customerCount ?? 0;
    const mrrTotal = contexts.get(row.id)?.mrrTotal ?? 0;
    const openOpportunityValue = contexts.get(row.id)?.opportunityValue ?? 0;
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      voteCount,
      customerCount,
      mrrTotal,
      score: computeRevenueScore({
        voteCount,
        customerCount,
        mrrTotal,
        openOpportunityValue,
      }),
    };
  });
}

// Sprint 21: etiket filtre sekmeleri — en çok kullanılan 8 etiket.
// Sprint 22: id de dönülüyor (bulk etiket işlemi için).
export async function loadTagOptions() {
  return getDb()
    .select({ id: tags.id, name: tags.name, count: count(postTags.id) })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .where(eq(tags.workspaceId, await getWorkspaceId()))
    .groupBy(tags.id)
    .orderBy(desc(count(postTags.id)), asc(tags.name))
    .limit(20);
}

// Sprint 22: kayıtlı görünümler — en yeniden.
export async function loadSavedViews() {
  return getDb()
    .select({
      id: savedViews.id,
      name: savedViews.name,
      params: savedViews.params,
    })
    .from(savedViews)
    .where(eq(savedViews.workspaceId, await getWorkspaceId()))
    .orderBy(desc(savedViews.createdAt))
    .limit(12);
}

// Sprint 25: changelog paneli verisi — mevcut duyurular + shipped fikirler.
export async function loadChangelogData() {
  const entryRows = await getDb()
    .select({
      id: changelogEntries.id,
      title: changelogEntries.title,
      body: changelogEntries.body,
      label: changelogEntries.label,
      status: changelogEntries.status,
      publishedAt: changelogEntries.publishedAt,
    })
    .from(changelogEntries)
    .where(eq(changelogEntries.workspaceId, await getWorkspaceId()))
    .orderBy(desc(changelogEntries.publishedAt))
    .limit(50);

  const shippedRows = await getDb()
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, await getWorkspaceId()),
        eq(posts.status, "shipped"),
      ),
    )
    .orderBy(desc(posts.updatedAt))
    .limit(30);

  return {
    entries: entryRows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      label: row.label,
      status: row.status,
      publishedAtLabel: row.publishedAt
        ? trDateTimeFormatter.format(row.publishedAt)
        : "Taslak",
    })),
    shippedPosts: shippedRows,
  };
}

// Sprint 28: iç roadmap planlayıcı verisi — planned/in-progress fikirler
// + owner seçenekleri (tüm adminler).
export async function loadPlannerData() {
  const rows = await getDb()
    .select({
      id: posts.id,
      title: posts.title,
      status: posts.status,
      ownerId: posts.ownerId,
      ownerName: users.name,
      targetDate: posts.targetDate,
      impact: posts.impact,
      effort: posts.effort,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.ownerId))
    .where(
      and(
        eq(posts.workspaceId, await getWorkspaceId()),
        isNull(posts.mergedIntoId),
        inArray(posts.status, ["planned", "in-progress"]),
      ),
    )
    .orderBy(desc(posts.updatedAt))
    .limit(50);

  // Yol haritası "sorumlu" seçenekleri workspace EKİBİDİR (owner/manager/
  // member) — platform personeli (`users.role='admin'`) değil.
  const team = await listWorkspaceTeam(await getWorkspaceId());
  const admins = team.map((member) => ({
    id: member.userId,
    name: member.name ?? member.userId,
  }));

  // 2026-09-12 (frontend_plan §16, P1-9): roadmap "ne yapacağız?" sorusunun
  // yanında "NEDEN bunu yapıyoruz?" sorusunu da cevaplasın. İş etkisi TEK
  // ek sorguyla (N+1 yok) planlanan fikirler için çözülür. MRR yalnız
  // `mrrKnown` ise gösterilir → Free'de zaten veri olmadığı için doğal olarak
  // gizli kalır (gelir bilgisi public roadmap'te GÖSTERİLMEZ, §14).
  const impactByPost = await loadPostImpactContexts(rows.map((row) => row.id));

  return {
    rows: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      targetDate: row.targetDate ? row.targetDate.slice(0, 10) : null,
      impact: row.impact,
      effort: row.effort,
      customerCount: impactByPost.get(row.id)?.customerCount ?? 0,
      mrrTotal: impactByPost.get(row.id)?.mrrTotal ?? 0,
      mrrKnown: impactByPost.get(row.id)?.mrrKnown ?? false,
      voteCount: impactByPost.get(row.id)?.voteCount ?? 0,
    })),
    admins,
  };
}

// Sprint 33: Autopilot Inbox verisi — bekleyen duplicate önerileri.
// Hedef başlıkları payload.duplicateOf üzerinden ikinci sorguda çözülür.
export async function loadInboxSuggestions() {
  const suggestionRows = await getDb()
    .select({
      id: aiSuggestions.id,
      postId: aiSuggestions.postId,
      type: aiSuggestions.type,
      payload: aiSuggestions.payload,
      confidence: aiSuggestions.confidence,
      createdAt: aiSuggestions.createdAt,
      sourceTitle: posts.title,
    })
    .from(aiSuggestions)
    .innerJoin(
      posts,
      and(
        eq(posts.id, aiSuggestions.postId),
        eq(posts.workspaceId, await getWorkspaceId()),
      ),
    )
    .where(eq(aiSuggestions.status, "pending"))
    .orderBy(desc(aiSuggestions.createdAt))
    .limit(20);

  if (suggestionRows.length === 0) {
    return [];
  }

  const targetIds = [
    ...new Set(suggestionRows.map((row) => row.payload.duplicateOf)),
  ];
  const targetRows = await getDb()
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(inArray(posts.id, targetIds));
  const targetTitles = new Map(targetRows.map((row) => [row.id, row.title]));

  return suggestionRows.map((row) => ({
    id: row.id,
    postId: row.postId,
    type: row.type,
    confidence: row.confidence,
    note: row.payload.note,
    targetId: row.payload.duplicateOf,
    targetTitle: targetTitles.get(row.payload.duplicateOf) ?? null,
    sourceTitle: row.sourceTitle,
    createdAtLabel: trDateTimeFormatter.format(row.createdAt),
  }));
}

// Sprint 34: API anahtarları — prefix listesi (tam anahtar DB'de yok).
export async function loadApiKeys() {
  const rows = await getDb()
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      scopes: apiKeys.scopes,
      revokedAt: apiKeys.revokedAt,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.workspaceId, await getWorkspaceId()))
    .orderBy(desc(apiKeys.createdAt))
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    revoked: row.revokedAt !== null,
    lastUsedLabel: row.lastUsedAt
      ? trDateTimeFormatter.format(row.lastUsedAt)
      : null,
    createdAtLabel: trDateTimeFormatter.format(row.createdAt),
  }));
}

// Sprint 34: webhook endpoint'leri — secret gösterilmez.
export async function loadWebhooks() {
  const rows = await getDb()
    .select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      events: webhookEndpoints.events,
      createdAt: webhookEndpoints.createdAt,
    })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.workspaceId, await getWorkspaceId()))
    .orderBy(desc(webhookEndpoints.createdAt))
    .limit(20);

  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    events: row.events,
    active: true,
    createdAtLabel: trDateTimeFormatter.format(row.createdAt),
  }));
}

// Sprint 29: seçili dönemin yeni fikir/oy/yorum sayaçları. Üç bağımsız
// count sorgusu paralel çalışır (neon-http her sorguyu ayrı HTTP isteği
// olarak gönderir); iç notlar "yorum" sayacına girmez.
export async function loadWeeklyCounts(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const db = getDb();
  const [ideaRows, voteRows, commentRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(posts)
      .where(
        and(
          eq(posts.workspaceId, await getWorkspaceId()),
          gte(posts.createdAt, since),
        ),
      ),
    db
      .select({ value: count() })
      .from(votes)
      .where(gte(votes.createdAt, since)),
    db
      .select({ value: count() })
      .from(comments)
      .where(
        and(gte(comments.createdAt, since), eq(comments.isInternal, false)),
      ),
  ]);
  return {
    ideas: ideaRows[0]?.value ?? 0,
    votes: voteRows[0]?.value ?? 0,
    comments: commentRows[0]?.value ?? 0,
  };
}
