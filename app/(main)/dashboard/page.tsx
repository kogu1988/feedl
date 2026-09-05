import { redirect } from "next/navigation";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { and, asc, count, countDistinct, desc, eq, gte, inArray, isNull } from "drizzle-orm";

import { FilterTabs } from "@/components/custom/filter-tabs";
import { PaginationFooter } from "@/components/custom/pagination-footer";
import { AnalyticsOverview } from "@/components/custom/analytics-overview";
import { AutopilotInbox } from "@/components/custom/autopilot-inbox";
import { ApiKeysManager } from "@/components/custom/api-keys-manager";
import { ChangelogAdmin } from "@/components/custom/changelog-admin";
import { WebhooksManager } from "@/components/custom/webhooks-manager";
import { PostsTable } from "@/components/custom/posts-table";
import { RoadmapPlanner } from "@/components/custom/roadmap-planner";
import { SavedViewBar } from "@/components/custom/saved-view-bar";
import { BoardFilterSelect } from "@/components/custom/board-filter-select";
import { OnboardingChecklist } from "@/components/custom/onboarding-checklist";
import { ImportCsvButton } from "@/components/custom/import-csv-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/custom/notice";
import { getTeamUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { loadOnboardingState } from "@/lib/db/onboarding";
import { listBoards, resolveBoardBySlug } from "@/lib/db/board";
import { loadCustomerCounts } from "@/lib/db/customer-counts";
import {
  computeRevenueScore,
  loadRevenueContexts,
} from "@/lib/db/revenue-scores";
import {
  aiSuggestions,
  apiKeys,
  changelogEntries,
  comments,
  postStatusEnum,
  postTags,
  posts,
  savedViews,
  tags,
  users,
  votes,
  webhookEndpoints,
} from "@/lib/db/schema";
import { statusLabels, trDateTimeFormatter } from "@/lib/post-format";
import { parsePagination } from "@/lib/pagination";

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

// Sprint 29: analitik dönem seçenekleri (?range= gün cinsinden).
const rangeOptions = [
  { value: "7", label: "Son 7 Gün" },
  { value: "14", label: "Son 14 Gün" },
  { value: "30", label: "Son 30 Gün" },
  { value: "365", label: "Son 1 Yıl" },
];

// Dashboard sekmeleri (?tab=): kart yığınını iş akışına göre böler.
// value "" Genel Bakış'tır ve temiz path'e gider (FilterTabs kuralı).
const sectionOptions = [
  { value: "", label: "Genel Bakış" },
  { value: "fikirler", label: "Fikirler" },
  { value: "yayin", label: "Yayın" },
  { value: "planlama", label: "Planlama" },
  { value: "entegrasyon", label: "Entegrasyonlar" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    tag?: string;
    range?: string;
    per?: string;
    page?: string;
    board?: string;
    tab?: string;
  }>;
}) {
  // Middleware girişi garanti eder; admin rolü tek kaynaktan (DB) doğrulanır.
  const teamId = await getTeamUserId();
  if (!teamId) {
    redirect("/portal");
  }

  // plan.md Sprint 12: durum filtresi ?status= ile gelir; geçersiz değer
  // "Tümü"ne düşer. İstatistikler her zaman TÜM fikirlerden hesaplanır,
  // filtre yalnızca tabloyu etkiler.
  const { status: rawStatus, tag: rawTag, range: rawRange, per: rawPer, page: rawPage, board: rawBoard, tab: rawTab } = await searchParams;
  const statusFilter =
    postStatusEnum.enumValues.find((value) => value === rawStatus) ?? null;
  // Sprint 21: etiket filtresi (portal ile aynı normalize kuralı).
  const tagFilter = (rawTag ?? "").trim().toLocaleLowerCase("tr").slice(0, 30);
  // Sprint 48d: board filtresi (
  const boardSlug = (rawBoard ?? "").trim().toLowerCase().slice(0, 80);
  const activeBoard = boardSlug
    ? await resolveBoardBySlug(boardSlug, true)
    : null;
  // Sekme bölümü: whitelist dışındaki değerler Genel Bakış'a düşer.
  const section =
    rawTab === "fikirler" ||
    rawTab === "yayin" ||
    rawTab === "planlama" ||
    rawTab === "entegrasyon"
      ? rawTab
      : "";
  // Sprint 29: analitik dönemi (?range=); geçersiz değer 7 güne düşer.
  const rangeDays =
    rawRange === "14" || rawRange === "30" || rawRange === "365"
      ? Number(rawRange)
      : 7;
  const rangeLabel =
    rangeOptions.find((option) => option.value === String(rangeDays))?.label ??
    "Son 7 Gün";
  // h1 aktif sekmenin adını taşır — sidebar'daki adla ("Genel Bakış") tutarlı.
  const sectionLabel =
    sectionOptions.find((option) => option.value === section)?.label ??
    "Genel Bakış";
  // Sprint 39: tablo sayfalaması — 5 varsayılan, 25/50/Tümü (ortak parse).
  const { per, perSize, requestedPage } = parsePagination(rawPer, rawPage);

  let rows: Awaited<ReturnType<typeof loadPosts>> = [];
  let totalCount = 0;
  let currentPage = 1;
  let totalPages = 1;
  let postStats = { totalPosts: 0, totalVotes: 0, openCount: 0, shippedCount: 0 };
  let sentimentCounts = { pozitif: 0, notr: 0, negatif: 0, unanalyzed: 0 };
  let topPosts: Awaited<ReturnType<typeof loadPostStats>>["topPosts"] = [];
  let tagOptions: Awaited<ReturnType<typeof loadTagOptions>> = [];
  let views: Awaited<ReturnType<typeof loadSavedViews>> = [];
  let changelogData: Awaited<ReturnType<typeof loadChangelogData>> = {
    entries: [],
    shippedPosts: [],
  };
  let plannerData: Awaited<ReturnType<typeof loadPlannerData>> = {
    rows: [],
    admins: [],
  };
  let inboxSuggestions: Awaited<ReturnType<typeof loadInboxSuggestions>> = [];
  let apiKeyItems: Awaited<ReturnType<typeof loadApiKeys>> = [];
  let webhookItems: Awaited<ReturnType<typeof loadWebhooks>> = [];
  let boardItems: Awaited<ReturnType<typeof listBoards>> = [];
  let weeklyCounts = { ideas: 0, votes: 0, comments: 0 };
  let customerCountByPost: Map<string, number> = new Map();
  let revenueContexts = {
    mrrByPost: new Map<string, number>(),
    opportunityValueByPost: new Map<string, number>(),
  };
  let loadError = false;
  let onboardingState: Awaited<ReturnType<typeof loadOnboardingState>> | null = null;

  try {
    // Sprint 59 (onboarding): "Başlarken" checklist'inin durumu.
    onboardingState = await loadOnboardingState();
    // Sprint 39: istatistikler agregat sorgudan; tablo offset/limit ile
    // tek sayfa çeker. Durum filtresi artık sunucuda uygulanır — client-
    // tarafı filtre sayfalanmış listede yanlış sonuç verirdi.
    const statsData = await loadPostStats(tagFilter);
    postStats = statsData.stats;
    sentimentCounts = statsData.sentimentCounts;
    topPosts = statsData.topPosts;
    totalCount = await countDashboardPosts(tagFilter, statusFilter, activeBoard?.id);
    totalPages =
      per === "all" ? 1 : Math.max(1, Math.ceil(totalCount / perSize));
    currentPage = Math.min(requestedPage, totalPages);
    rows = await loadPosts(
      tagFilter,
      statusFilter,
      perSize,
      (currentPage - 1) * perSize,
      activeBoard?.id,
    );
    customerCountByPost = await loadCustomerCounts(rows.map((row) => row.id));
    revenueContexts = await loadRevenueContexts(rows.map((row) => row.id));
    tagOptions = await loadTagOptions();
    views = await loadSavedViews();
    changelogData = await loadChangelogData();
    plannerData = await loadPlannerData();
    inboxSuggestions = await loadInboxSuggestions();
    apiKeyItems = await loadApiKeys();
    webhookItems = await loadWebhooks();
    boardItems = await listBoards();
    weeklyCounts = await loadWeeklyCounts(rangeDays);
  } catch (err) {
    console.error(
      "Dashboard list failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  // İstatistik satırı (plan.md Sprint 11): agregat sorgudan (loadPostStats)
  // — tablo sayfalansa da kartlar tüm fikirleri yansıtır. Sprint 51
  // (Batch 3): akış metriklerine dönem deltası — weeklyCounts seçili
  // (?range=) dönemin toplamı (loadWeeklyCounts); stok metriklerinde
  // delta yok, uydurmayız.
  const stats: { label: string; value: number; delta?: string }[] = [
    {
      label: "Toplam Fikir",
      value: postStats.totalPosts,
      delta: `+${weeklyCounts.ideas} (${rangeLabel})`,
    },
    {
      label: "Toplam Oy",
      value: postStats.totalVotes,
      delta: `+${weeklyCounts.votes} (${rangeLabel})`,
    },
    { label: "Açık (bekleyen)", value: postStats.openCount },
    { label: "Yayınlanan", value: postStats.shippedCount },
  ];

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{sectionLabel}</h1>
          <p className="mt-2 text-muted-foreground">
            Fikirleri incele, durumlarını güncelleyerek yol haritasını yönet.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ImportCsvButton />
          <Button render={<a href="/api/admin/export" download />}>
            <DownloadIcon aria-hidden="true" />
            CSV İndir
          </Button>
        </div>
      </div>

      {onboardingState ? (
        <OnboardingChecklist state={onboardingState} />
      ) : null}

      {!loadError ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border p-4 sm:p-5">
              <p className="text-xs font-medium text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
                {stat.value}
              </p>
              {stat.delta ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.delta}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-8">
        <FilterTabs
          paramName="tab"
          basePath="/dashboard"
          active={section}
          options={sectionOptions}
        />
      </div>

      {section === "" ? (
        <>
          {!loadError ? (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Analitik</CardTitle>
                <CardDescription>
                  Seçili dönemin özeti, duygu dağılımı ve en çok oy alan
                  fikirler.
                </CardDescription>
                <div className="pt-2">
                  <FilterTabs
                    paramName="range"
                    basePath="/dashboard"
                    active={String(rangeDays)}
                    extraParams={{
                      ...(statusFilter ? { status: statusFilter } : {}),
                      ...(tagFilter ? { tag: tagFilter } : {}),
                      ...(boardSlug ? { board: boardSlug } : {}),
                    }}
                    options={rangeOptions}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <AnalyticsOverview
                  data={{
                    rangeLabel,
                    weekly: weeklyCounts,
                    sentiment: sentimentCounts,
                    topPosts,
                  }}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Autopilot Inbox</CardTitle>
              <CardDescription>
                AI duplicate şüphelendiğinde artık otomatik birleştirmez —
                karar senin. Onaylamak birleştirir (oylar/yorumlar taşınır),
                red ve yoksay yalnızca öneriyi kapatır.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!loadError ? (
                <AutopilotInbox suggestions={inboxSuggestions} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Öneriler yüklenemedi.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {section === "yayin" ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Güncellemeler (Changelog)</CardTitle>
            <CardDescription>
              Portalın herkese açık duyuru sayfasına içerik yaz —{" "}
              <Link
                href="/changelog"
                className="underline underline-offset-4 hover:text-foreground"
              >
                /changelog
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangelogAdmin
              entries={changelogData.entries}
              shippedPosts={changelogData.shippedPosts}
            />
          </CardContent>
        </Card>
      ) : null}

      {section === "planlama" ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>İç Roadmap (Planlama)</CardTitle>
            <CardDescription>
              Planlanan ve geliştirilen fikirlere sahip ata, hedef tarih ve
              etki/efor puanı ver — skor = etki ÷ efor. Müşteri bunu görmez.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoadmapPlanner
              rows={plannerData.rows}
              admins={plannerData.admins}
            />
          </CardContent>
        </Card>
      ) : null}

      {section === "fikirler" ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Fikirler</CardTitle>
            <CardDescription>
              {loadError
                ? "Liste yüklenemedi."
                : statusFilter
                  ? `Filtrede ${totalCount} fikir — durumu satırdan değiştirebilirsin.`
                  : `Toplam ${totalCount} fikir — durumu satırdan değiştirebilirsin.`}
            </CardDescription>
            {!loadError && boardItems.length > 1 ? (
              <div className="pt-2">
                <BoardFilterSelect
                  boards={boardItems.map((board) => ({
                    id: board.id,
                    name: board.name,
                    slug: board.slug,
                    visibility: board.visibility,
                  }))}
                  boardSlug={boardSlug}
                />
              </div>
            ) : null}
            {!loadError && rows.length > 0 ? (
              <div className="grid gap-2 pt-2">
                <FilterTabs
                  paramName="status"
                  basePath="/dashboard"
                  active={statusFilter ?? ""}
                  extraParams={{
                    ...(section ? { tab: section } : {}),
                    ...(tagFilter ? { tag: tagFilter } : {}),
                    ...(boardSlug ? { board: boardSlug } : {}),
                    ...(per !== "5" ? { per } : {}),
                  }}
                  options={[
                    { value: "", label: "Tümü" },
                    ...postStatusEnum.enumValues.map((value) => ({
                      value,
                      label: statusLabels[value] ?? value,
                    })),
                  ]}
                />
                {tagOptions.length > 0 ? (
                  <FilterTabs
                    paramName="tag"
                    basePath="/dashboard"
                    active={tagFilter}
                    extraParams={{
                      ...(section ? { tab: section } : {}),
                      ...(statusFilter ? { status: statusFilter } : {}),
                      ...(boardSlug ? { board: boardSlug } : {}),
                      ...(per !== "5" ? { per } : {}),
                    }}
                    options={[
                      { value: "", label: "Tüm Etiketler" },
                      ...tagOptions.map((option) => ({
                        value: option.name,
                        label: `#${option.name} (${option.count})`,
                      })),
                    ]}
                  />
                ) : null}
                <SavedViewBar
                  views={views}
                  currentParams={Object.fromEntries(
                    [
                      ["status", statusFilter],
                      ["tag", tagFilter],
                      ["board", boardSlug || null],
                    ].filter(
                      (pair): pair is [string, string] =>
                        pair[1] !== null && pair[1] !== "",
                    ),
                  )}
                  preserveParams={section ? { tab: section } : undefined}
                />
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {loadError ? (
              <Notice size="md">
                Fikirler yüklenemedi. Sayfayı yenilemeyi dene.
              </Notice>
            ) : rows.length === 0 && (statusFilter || tagFilter) ? (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Bu filtrede fikir yok.
              </p>
            ) : rows.length === 0 ? (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Henüz fikir yok. Portala gönderilen ilk fikir burada görünecek.
              </p>
            ) : (
              <PostsTable
                rows={rows.map((row) => ({
                  id: row.id,
                  title: row.title,
                  status: row.status,
                  postType: row.postType,
                  boardId: row.boardId,
                  mergedIntoId: row.mergedIntoId,
                  sentimentLabel: row.sentimentLabel,
                  aiKeywords: row.aiKeywords,
                  createdAtLabel: dateFormatter.format(row.createdAt),
                  voteCount: row.voteCount,
                  customerCount: customerCountByPost.get(row.id) ?? 0,
                  revenueScore: computeRevenueScore({
                    voteCount: row.voteCount,
                    customerCount: customerCountByPost.get(row.id) ?? 0,
                    mrrTotal: revenueContexts.mrrByPost.get(row.id) ?? 0,
                    openOpportunityValue:
                      revenueContexts.opportunityValueByPost.get(row.id) ?? 0,
                  }),
                }))}
                tagOptions={tagOptions.map((option) => ({
                  id: option.id,
                  name: option.name,
                }))}
                boardOptions={boardItems.map((board) => ({
                  id: board.id,
                  name: board.name,
                }))}
              />
            )}
            {!loadError && rows.length > 0 ? (
              <PaginationFooter
                basePath="/dashboard"
                page={currentPage}
                totalPages={totalPages}
                per={per}
                extraParams={{
                  ...(section ? { tab: section } : {}),
                  ...(statusFilter ? { status: statusFilter } : {}),
                  ...(tagFilter ? { tag: tagFilter } : {}),
                  ...(boardSlug ? { board: boardSlug } : {}),
                }}
                pageParams={{
                  ...(section ? { tab: section } : {}),
                  ...(statusFilter ? { status: statusFilter } : {}),
                  ...(tagFilter ? { tag: tagFilter } : {}),
                  ...(boardSlug ? { board: boardSlug } : {}),
                  ...(per !== "5" ? { per } : {}),
                }}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {section === "entegrasyon" ? (
        <>
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>API Anahtarları</CardTitle>
              <CardDescription>
                Public API (/api/v1) uçlarını programatik kullanım için üret.
                Anahtarlar SHA-256 karmasıyla saklanır; tam değer yalnızca
                oluşturma anında gösterilir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApiKeysManager items={apiKeyItems} />
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Webhook&apos;lar</CardTitle>
              <CardDescription>
                Seçtiğin olaylar gerçekleşince URL&apos;ne HMAC-SHA256 imzalı
                POST gönderilir (X-Feedl-Signature başlığı). Teslimat Inngest
                ile otomatik yeniden denenir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebhooksManager items={webhookItems} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Sprint 21: ?tag= filtresi — birleşmiş fikirler dahil (admin görür).
// Sprint 39: durum filtresi sunucuda uygulanır + offset/limit sayfalama.
async function loadPosts(
  tagFilter: string,
  statusFilter: (typeof postStatusEnum.enumValues)[number] | null,
  limit: number,
  offset: number,
  boardId?: string,
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
    .where(dashboardPostConditions(workspaceId, tagFilter, statusFilter, boardId))
    .groupBy(posts.id)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
}

// Sprint 39: loadPosts + countDashboardPosts paylaşılan where koşulu
// (tek kaynak kuralı). statusFilter undefined → istatistik sorgusu tüm
// durumları kapsar (kartlar filtrelenmemiş toplamları gösterir). Sprint
// 48d: boardId koşulu — ?board= verildiyse o board'un fikirleri.
function dashboardPostConditions(
  workspaceId: string,
  tagFilter: string,
  statusFilter: (typeof postStatusEnum.enumValues)[number] | null | undefined,
  boardId?: string,
) {
  return and(
    eq(posts.workspaceId, workspaceId),
    boardId ? eq(posts.boardId, boardId) : undefined,
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

async function countDashboardPosts(
  tagFilter: string,
  statusFilter: (typeof postStatusEnum.enumValues)[number] | null,
  boardId?: string,
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
      ),
    );
  return row.value;
}

// Sprint 39: istatistikler sayfalanmış rows'tan DEĞİL, agregat sorgudan
// hesaplanır — tablo sayfalansa da kartlar/analitik tüm fikirleri
// yansıtır (eski davranış: rows limit(200) idi; toplamlar artık tam).
// Durum filtresi burada uygulanmaz (eski davranış: rows filtre öncesiydi).
async function loadPostStats(tagFilter: string) {
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

// Sprint 21: etiket filtre sekmeleri — en çok kullanılan 8 etiket.
// Sprint 22: id de dönülüyor (bulk etiket işlemi için).
async function loadTagOptions() {
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
async function loadSavedViews() {
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
async function loadChangelogData() {
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
async function loadPlannerData() {
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

  const admins = await getDb()
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "admin"));

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
    })),
    admins: admins.map((admin) => ({
      id: admin.id,
      name: admin.name ?? admin.id,
    })),
  };
}

// Sprint 33: Autopilot Inbox verisi — bekleyen duplicate önerileri.
// Hedef başlıkları payload.duplicateOf üzerinden ikinci sorguda çözülür.
async function loadInboxSuggestions() {
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
async function loadApiKeys() {
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
async function loadWebhooks() {
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
async function loadWeeklyCounts(days: number) {
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
