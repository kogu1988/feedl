import { redirect } from "next/navigation";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { FilterTabs } from "@/components/custom/filter-tabs";
import { PaginationFooter } from "@/components/custom/pagination-footer";
import { AnalyticsOverview } from "@/components/custom/analytics-overview";
import { AutopilotInbox } from "@/components/custom/autopilot-inbox";
import { ApiKeysManager } from "@/components/custom/api-keys-manager";
import { ChangelogAdmin } from "@/components/custom/changelog-admin";
import { EmailDeliverabilityCard } from "@/components/custom/email-deliverability-card";
import { WebhooksManager } from "@/components/custom/webhooks-manager";
import { PostsTable } from "@/components/custom/posts-table";
import { RoadmapPlanner } from "@/components/custom/roadmap-planner";
import { SavedViewBar } from "@/components/custom/saved-view-bar";
import { BoardFilterSelect } from "@/components/custom/board-filter-select";
import { OnboardingChecklist } from "@/components/custom/onboarding-checklist";
import { ImportCsvButton } from "@/components/custom/import-csv-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/custom/notice";
import { EmptyState } from "@/components/custom/empty-state";
import { getTeamUserId } from "@/lib/auth/admin";
import { loadOnboardingState } from "@/lib/db/onboarding";
import { listBoards, resolveBoardBySlug } from "@/lib/db/board";
import { loadCustomerCounts } from "@/lib/db/customer-counts";
import { computeRevenueScore, loadRevenueContexts } from "@/lib/db/revenue-scores";
import { postStatusEnum } from "@/lib/db/schema";
import { statusLabels } from "@/lib/post-format";
import { parsePagination } from "@/lib/pagination";
import { getPlanLimits } from "@/lib/paddle";
import {
  dateFormatter,
  POST_SORTS,
  PostSort,
  loadPosts,
  countDashboardPosts,
  loadPostStats,
  loadTopRevenuePosts,
  loadTagOptions,
  loadSavedViews,
  loadChangelogData,
  loadPlannerData,
  loadInboxSuggestions,
  loadApiKeys,
  loadWebhooks,
  loadWeeklyCounts,
} from "@/lib/dashboard/loaders";


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
    device?: string;
    tab?: string;
  }>;
}) {
  // Middleware girişi garanti eder; admin rolü tek kaynaktan (DB) doğrulanır.
  const teamId = await getTeamUserId();
  if (!teamId) {
    redirect("/portal");
  }

  // Sprint 64: CSV içe/dışa aktarma PRO özelliği. Free'de butonlar gizlenir
  // (API de kontrol eder — çift güvenlik); kartta "Pro" rozeti gösterilir.
  const isPro = (await getPlanLimits()).key === "pro";

  // plan.md Sprint 12: durum filtresi ?status= ile gelir; geçersiz değer
  // "Tümü"ne düşer. İstatistikler her zaman TÜM fikirlerden hesaplanır,
  // filtre yalnızca tabloyu etkiler.
  const { status: rawStatus, tag: rawTag, range: rawRange, per: rawPer, page: rawPage, board: rawBoard, device: rawDevice, tab: rawTab } = await searchParams;
  // `sort` Next'in ürettiği searchParams tipinde tanımlı değil → cast ile okunur.
  const rawSort = ((await searchParams) as Record<string, string | undefined>).sort;
  const statusFilter =
    postStatusEnum.enumValues.find((value) => value === rawStatus) ?? null;
  // Faz 1: cihaz filtresi (desktop | tablet | mobile).
  const deviceFilter =
    (["desktop", "tablet", "mobile"] as const).find((v) => v === rawDevice) ?? null;
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
  // 2026-09-12 (P1-8): sıralama — whitelist dışı değer varsayılana düşer.
  const sortFilter: PostSort =
    POST_SORTS.find((value) => value === rawSort) ?? "newest";

  let rows: Awaited<ReturnType<typeof loadPosts>> = [];
  let totalCount = 0;
  let currentPage = 1;
  let totalPages = 1;
  let postStats = { totalPosts: 0, totalVotes: 0, openCount: 0, shippedCount: 0 };
  let sentimentCounts = { pozitif: 0, notr: 0, negatif: 0, unanalyzed: 0 };
  let topPosts: Awaited<ReturnType<typeof loadPostStats>>["topPosts"] = [];
  let topRevenuePosts: Awaited<ReturnType<typeof loadTopRevenuePosts>> = [];
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
    // 2026-09-12 (denetim — TTFB): BAĞIMSIZ yükleyiciler artık PARALEL.
    //
    // Önceden 16 `await` sıralıydı; neon-http her sorgu için ayrı HTTP
    // gidiş-dönüşü yaptığından BOŞ bir veritabanında bile TTFB 0.68–1.12s
    // ölçülüyordu. Bağımlılık grafiği (koddan çıkarıldı):
    //   [bağımsız ×12] → countPosts → loadPosts → (customerCounts, revenue)
    //
    // `countPosts → loadPosts` bağımlılığı BİLİNÇLİ korunur: tablo offset'i
    // sayfa clamp'ine (`currentPage = min(requestedPage, totalPages)`) bağlı;
    // clamp'i kaldırmak aralık dışı sayfada boş liste gösterirdi.
    //
    // Semantik korunur: tek `try` içinde ilk hata `loadError = true` yapıp
    // kalanı atlıyordu; `Promise.all` de ilk hatada reject eder. `getWorkspaceId()`
    // `React.cache`'li olduğu için eşzamanlı çağrılar TEK okumayı paylaşır —
    // paralellik ek DB yükü doğurmaz.
    // 2026-09-12 (denetim — TTFB, Aşama 2): SEKMEYE GÖRE yükleme.
    //
    // Aşama 1 yalnız zamanlamayı düzeltti; iş miktarı aynıydı — `/dashboard?
    // section=yayin` bile API anahtarlarını, webhook'ları, planlayıcıyı ve
    // oyları okuyordu. Gating YALNIZ kullanımının tamamı tek sekmede olan
    // yükleyicilere uygulanır; kullanım haritası koddan çıkarıldı:
    //   · onboardingState + inboxSuggestions + topRevenuePosts → Genel Bakış
    //   · views → Fikirler
    //   · changelogData → Yayın
    //   · plannerData → Planlama
    //   · apiKeyItems + webhookItems → Entegrasyonlar
    //   · customerCountByPost + revenueContexts → Fikirler
    //
    // KOŞULSUZ kalanlar (bölüm dışında da kullanılıyor):
    //   · `weeklyCounts` → istatistik kartları (bölüm dallarının ÜSTÜNDE)
    //   · `boardItems`/`tagOptions` → Fikirler VE Entegrasyonlar (CSV içe aktarma)
    //   · `postStats` → istatistik kartları
    //
    // POST LİSTESİ ZİNCİRİ (countPosts → rows → türetilenler) yalnız Fikirler
    // ve Entegrasyonlar'da kullanılıyor (satır 490/599/603/645, 474-475 ve
    // sayfalama 648-649). Genel Bakış onu HİÇ kullanmaz → varsayılan görünüm en
    // ağır sorguyu artık hiç çalıştırmaz.
    const needsOverview = section === "";
    const needsIdeas = section === "fikirler";
    const needsIntegrations = section === "entegrasyon";
    const needsPostList = needsIdeas || needsIntegrations;

    const [
      onboardingRes,
      statsData,
      totalCountRes,
      tagOptionsRes,
      viewsRes,
      changelogRes,
      plannerRes,
      inboxRes,
      apiKeyRes,
      webhookRes,
      boardRes,
      weeklyRes,
      topRevenueRes,
    ] = await Promise.all([
      needsOverview ? loadOnboardingState() : Promise.resolve(onboardingState),
      // Sprint 39: istatistikler agregat sorgudan; tablo offset/limit ile tek
      // sayfa çeker. Durum filtresi sunucuda uygulanır — client-tarafı filtre
      // sayfalanmış listede yanlış sonuç verirdi.
      loadPostStats(tagFilter),
      needsPostList
        ? countDashboardPosts(tagFilter, statusFilter, activeBoard?.id, deviceFilter)
        : Promise.resolve(totalCount),
      loadTagOptions(),
      needsIdeas ? loadSavedViews() : Promise.resolve(views),
      section === "yayin" ? loadChangelogData() : Promise.resolve(changelogData),
      section === "planlama" ? loadPlannerData() : Promise.resolve(plannerData),
      needsOverview ? loadInboxSuggestions() : Promise.resolve(inboxSuggestions),
      needsIntegrations ? loadApiKeys() : Promise.resolve(apiKeyItems),
      needsIntegrations ? loadWebhooks() : Promise.resolve(webhookItems),
      listBoards(),
      loadWeeklyCounts(rangeDays),
      // Gelir skoru Pro özelliği: Free'de bu sorgu HİÇ koşmaz.
      isPro && needsOverview
        ? loadTopRevenuePosts(tagFilter)
        : Promise.resolve(topRevenuePosts),
    ]);

    onboardingState = onboardingRes;
    postStats = statsData.stats;
    sentimentCounts = statsData.sentimentCounts;
    topPosts = statsData.topPosts;
    topRevenuePosts = topRevenueRes;
    totalCount = totalCountRes;
    totalPages =
      per === "all" ? 1 : Math.max(1, Math.ceil(totalCount / perSize));
    currentPage = Math.min(requestedPage, totalPages);
    tagOptions = tagOptionsRes;
    views = viewsRes;
    changelogData = changelogRes;
    plannerData = plannerRes;
    inboxSuggestions = inboxRes;
    apiKeyItems = apiKeyRes;
    webhookItems = webhookRes;
    boardItems = boardRes;
    weeklyCounts = weeklyRes;

    if (needsPostList) {
      // `countPosts → loadPosts` sıralılığı korunur: tablo offset'i sayfa
      // clamp'ine bağlı (yukarıdaki `currentPage`).
      rows = await loadPosts(
        tagFilter,
        statusFilter,
        perSize,
        (currentPage - 1) * perSize,
        activeBoard?.id,
        deviceFilter,
        sortFilter,
      );
      // Dalga 2 — `rows`'a bağlı iki yükleyici, birbirinden bağımsız (paralel).
      // İkisi de YALNIZ Fikirler'de render edilir.
      const [countsRes, revenueRes] = await Promise.all([
        needsIdeas
          ? loadCustomerCounts(rows.map((row) => row.id))
          : Promise.resolve(customerCountByPost),
        isPro && needsIdeas
          ? loadRevenueContexts(rows.map((row) => row.id))
          : Promise.resolve(revenueContexts),
      ]);
      customerCountByPost = countsRes;
      revenueContexts = revenueRes;
    }
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
          {isPro ? (
            <>
              <ImportCsvButton />
              <Button render={<a href="/api/admin/export" download />}>
                <DownloadIcon aria-hidden="true" />
                CSV İndir
              </Button>
            </>
          ) : (
            <Button render={<a href="/dashboard/billing" />}>
              <DownloadIcon aria-hidden="true" />
              CSV İndir · Pro
            </Button>
          )}
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
            <div className="mt-8 grid gap-8 xl:grid-cols-2">
              <Card>
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
                        ...(deviceFilter ? { device: deviceFilter } : {}),
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
                      topRevenuePosts,
                      isPro,
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
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
            </div>
          ) : null}
          {/* E-posta Durumu — üstteki Analitik/Autopilot grid'iyle standart boşluk. */}
          <div className="mt-8">
            <EmailDeliverabilityCard />
          </div>
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
                : statusFilter || deviceFilter
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
                    ...(deviceFilter ? { device: deviceFilter } : {}),
                    ...(per !== "5" ? { per } : {}),
                    ...(sortFilter !== "newest" ? { sort: sortFilter } : {}),
                  }}
                  options={[
                    { value: "", label: "Tümü" },
                    ...postStatusEnum.enumValues.map((value) => ({
                      value,
                      label: statusLabels[value] ?? value,
                    })),
                  ]}
                />
                {/* Faz 1: cihaz filtresi (Desktop / Tablet / Mobile). */}
                <FilterTabs
                  paramName="device"
                  basePath="/dashboard"
                  active={deviceFilter ?? ""}
                  extraParams={{
                    ...(section ? { tab: section } : {}),
                    ...(statusFilter ? { status: statusFilter } : {}),
                    ...(tagFilter ? { tag: tagFilter } : {}),
                    ...(boardSlug ? { board: boardSlug } : {}),
                    ...(per !== "5" ? { per } : {}),
                    ...(sortFilter !== "newest" ? { sort: sortFilter } : {}),
                  }}
                  options={[
                    { value: "", label: "Tüm Cihazlar" },
                    { value: "desktop", label: "Masaüstü" },
                    { value: "tablet", label: "Tablet" },
                    { value: "mobile", label: "Mobil" },
                  ]}
                />
                {/* 2026-09-12 (frontend_plan P1-8): sıralama. "İş etkisi"
                    yalnız Pro'da seçilebilir — skor sütunu da Pro (Free'de
                    MRR/fırsat verisi yok, sıralama yanıltıcı olurdu). */}
                <FilterTabs
                  paramName="sort"
                  basePath="/dashboard"
                  active={sortFilter}
                  extraParams={{
                    ...(section ? { tab: section } : {}),
                    ...(statusFilter ? { status: statusFilter } : {}),
                    ...(tagFilter ? { tag: tagFilter } : {}),
                    ...(boardSlug ? { board: boardSlug } : {}),
                    ...(deviceFilter ? { device: deviceFilter } : {}),
                  }}
                  options={[
                    { value: "", label: "En yeni" },
                    { value: "votes", label: "En çok oy" },
                    ...(isPro
                      ? [{ value: "impact", label: "İş etkisi" }]
                      : []),
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
                      ...(deviceFilter ? { device: deviceFilter } : {}),
                      ...(sortFilter !== "newest" ? { sort: sortFilter } : {}),
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
                      ["device", deviceFilter],
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
            ) : rows.length === 0 && (statusFilter || tagFilter || deviceFilter) ? (
              <EmptyState>
                Bu filtrede fikir yok.
              </EmptyState>
            ) : rows.length === 0 ? (
              <EmptyState>
                Henüz fikir yok. Portala gönderilen ilk fikir burada görünecek.
              </EmptyState>
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
                  // 2026-09-12 (plan matrisi): gelir skoru Pro özelliği. Free'de
                  // skor HESAPLANMAZ (aşağıda revenueContexts da boş kalır) ve
                  // tablo sütunu kilitli gösterilir (isPro prop'u).
                  revenueScore: isPro
                    ? computeRevenueScore({
                        voteCount: row.voteCount,
                        customerCount: customerCountByPost.get(row.id) ?? 0,
                        mrrTotal: revenueContexts.mrrByPost.get(row.id) ?? 0,
                        openOpportunityValue:
                          revenueContexts.opportunityValueByPost.get(row.id) ?? 0,
                      })
                    : 0,
                }))}
                tagOptions={tagOptions.map((option) => ({
                  id: option.id,
                  name: option.name,
                }))}
                boardOptions={boardItems.map((board) => ({
                  id: board.id,
                  name: board.name,
                }))}
                isPro={isPro}
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
                  ...(deviceFilter ? { device: deviceFilter } : {}),
                  ...(sortFilter !== "newest" ? { sort: sortFilter } : {}),
                }}
                pageParams={{
                  ...(section ? { tab: section } : {}),
                  ...(statusFilter ? { status: statusFilter } : {}),
                  ...(deviceFilter ? { device: deviceFilter } : {}),
                  ...(tagFilter ? { tag: tagFilter } : {}),
                  ...(boardSlug ? { board: boardSlug } : {}),
                  ...(sortFilter !== "newest" ? { sort: sortFilter } : {}),
                  ...(per !== "5" ? { per } : {}),
                }}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {section === "entegrasyon" ? (
        <>
          <div className="mt-8 grid gap-8 xl:grid-cols-2">
            <Card>
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

            <Card>
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
          </div>
        </>
      ) : null}
    </main>
  );
}
