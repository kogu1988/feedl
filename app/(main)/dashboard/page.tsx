import { redirect } from "next/navigation";
import Link from "next/link";
import { DownloadIcon, PuzzleIcon } from "lucide-react";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { FilterTabs } from "@/components/custom/filter-tabs";
import { AutopilotInbox } from "@/components/custom/autopilot-inbox";
import { ApiKeysManager } from "@/components/custom/api-keys-manager";
import { ChangelogAdmin } from "@/components/custom/changelog-admin";
import { WebhooksManager } from "@/components/custom/webhooks-manager";
import { PostsTable } from "@/components/custom/posts-table";
import { RoadmapPlanner } from "@/components/custom/roadmap-planner";
import { SavedViewBar } from "@/components/custom/saved-view-bar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import {
  aiSuggestions,
  apiKeys,
  changelogEntries,
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

// Canlı veri: her istekte DB'den okunur.
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tag?: string }>;
}) {
  // Middleware girişi garanti eder; admin rolü tek kaynaktan (DB) doğrulanır.
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect("/portal");
  }

  // plan.md Sprint 12: durum filtresi ?status= ile gelir; geçersiz değer
  // "Tümü"ne düşer. İstatistikler her zaman TÜM fikirlerden hesaplanır,
  // filtre yalnızca tabloyu etkiler.
  const { status: rawStatus, tag: rawTag } = await searchParams;
  const statusFilter =
    postStatusEnum.enumValues.find((value) => value === rawStatus) ?? null;
  // Sprint 21: etiket filtresi (portal ile aynı normalize kuralı).
  const tagFilter = (rawTag ?? "").trim().toLocaleLowerCase("tr").slice(0, 30);

  let rows: Awaited<ReturnType<typeof loadPosts>> = [];
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
  let loadError = false;

  try {
    rows = await loadPosts(tagFilter);
    tagOptions = await loadTagOptions();
    views = await loadSavedViews();
    changelogData = await loadChangelogData();
    plannerData = await loadPlannerData();
    inboxSuggestions = await loadInboxSuggestions();
    apiKeyItems = await loadApiKeys();
    webhookItems = await loadWebhooks();
  } catch (err) {
    console.error(
      "Dashboard list failed:",
      err instanceof Error ? err.message : err,
    );
    loadError = true;
  }

  const visibleRows = statusFilter
    ? rows.filter((row) => row.status === statusFilter)
    : rows;

  // İstatistik satırı (plan.md Sprint 11): tek sorgudan JS tarafında hesaplanır.
  const totalVotes = rows.reduce((sum, row) => sum + row.voteCount, 0);
  const openCount = rows.filter((row) => row.status === "open").length;
  const shippedCount = rows.filter((row) => row.status === "shipped").length;

  const stats = [
    { label: "Toplam Fikir", value: rows.length },
    { label: "Toplam Oy", value: totalVotes },
    { label: "Açık (bekleyen)", value: openCount },
    { label: "Yayınlanan", value: shippedCount },
  ];

  return (
    <main className="container mx-auto max-w-5xl p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Paneli</h1>
          <p className="mt-2 text-muted-foreground">
            Fikirleri incele, durumlarını güncelleyerek yol haritasını yönet.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/widget"
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            <PuzzleIcon className="size-4" aria-hidden="true" />
            Widget
          </Link>
          <a
            href="/api/admin/export"
            download
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <DownloadIcon className="size-4" aria-hidden="true" />
            CSV İndir
          </a>
        </div>
      </div>

      {!loadError ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Autopilot Inbox</CardTitle>
          <CardDescription>
            AI duplicate şüphelendiğinde artık otomatik birleştirmez — karar
            senin. Onaylamak birleştirir (oylar/yorumlar taşınır), red ve
            yoksay yalnızca öneriyi kapatır.
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

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Güncellemeler (Changelog)</CardTitle>
          <CardDescription>
            Portalın herkese açık duyuru sayfasına içerik yaz —{" "}
            <Link
              href="/portal/changelog"
              className="underline underline-offset-4 hover:text-foreground"
            >
              /portal/changelog
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

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Fikirler</CardTitle>
          <CardDescription>
            {loadError
              ? "Liste yüklenemedi."
              : statusFilter
                ? `Filtrede ${visibleRows.length} / toplam ${rows.length} fikir — durumu satırdan değiştirebilirsin.`
                : `Toplam ${rows.length} fikir — durumu satırdan değiştirebilirsin.`}
          </CardDescription>
          {!loadError && rows.length > 0 ? (
            <div className="grid gap-2 pt-2">
              <FilterTabs
                paramName="status"
                basePath="/dashboard"
                active={statusFilter ?? ""}
                extraParams={tagFilter ? { tag: tagFilter } : undefined}
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
                  extraParams={
                    statusFilter ? { status: statusFilter } : undefined
                  }
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
                  ].filter(
                    (pair): pair is [string, string] =>
                      pair[1] !== null && pair[1] !== "",
                  ),
                )}
              />
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Fikirler yüklenemedi. Sayfayı yenilemeyi dene.
            </p>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Henüz fikir yok. Portala gönderilen ilk fikir burada görünecek.
            </p>
          ) : visibleRows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Bu durumda fikir yok.
            </p>
          ) : (
            <PostsTable
              rows={visibleRows.map((row) => ({
                id: row.id,
                title: row.title,
                status: row.status,
                postType: row.postType,
                mergedIntoId: row.mergedIntoId,
                sentimentLabel: row.sentimentLabel,
                aiKeywords: row.aiKeywords,
                createdAtLabel: dateFormatter.format(row.createdAt),
                voteCount: row.voteCount,
              }))}
              tagOptions={tagOptions.map((option) => ({
                id: option.id,
                name: option.name,
              }))}
            />
          )}
        </CardContent>
      </Card>

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
            Seçtiğin olaylar gerçekleşince URL&apos;ne HMAC-SHA256 imzalı POST
            gönderilir (X-Feedl-Signature başlığı). Teslimat Inngest ile
            otomatik yeniden denenir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhooksManager items={webhookItems} />
        </CardContent>
      </Card>
    </main>
  );
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Sprint 21: ?tag= filtresi — birleşmiş fikirler dahil (admin görür).
async function loadPosts(tagFilter: string) {
  return getDb()
    .select({
      id: posts.id,
      title: posts.title,
      status: posts.status,
      sentimentLabel: posts.sentimentLabel,
      aiKeywords: posts.aiKeywords,
      postType: posts.postType,
      mergedIntoId: posts.mergedIntoId,
      createdAt: posts.createdAt,
      voteCount: count(votes.id),
    })
    .from(posts)
    .leftJoin(votes, eq(votes.postId, posts.id))
    .where(
      tagFilter
        ? inArray(
            posts.id,
            getDb()
              .select({ postId: postTags.postId })
              .from(postTags)
              .innerJoin(tags, eq(tags.id, postTags.tagId))
              .where(eq(tags.name, tagFilter)),
          )
        : undefined,
    )
    .groupBy(posts.id)
    .orderBy(desc(posts.createdAt))
    .limit(200);
}

// Sprint 21: etiket filtre sekmeleri — en çok kullanılan 8 etiket.
// Sprint 22: id de dönülüyor (bulk etiket işlemi için).
async function loadTagOptions() {
  return getDb()
    .select({ id: tags.id, name: tags.name, count: count(postTags.id) })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
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
      publishedAt: changelogEntries.publishedAt,
    })
    .from(changelogEntries)
    .orderBy(desc(changelogEntries.publishedAt))
    .limit(50);

  const shippedRows = await getDb()
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(eq(posts.status, "shipped"))
    .orderBy(desc(posts.updatedAt))
    .limit(30);

  return {
    entries: entryRows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      label: row.label,
      publishedAtLabel: trDateTimeFormatter.format(row.publishedAt),
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
    .innerJoin(posts, eq(posts.id, aiSuggestions.postId))
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
      revokedAt: apiKeys.revokedAt,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .orderBy(desc(apiKeys.createdAt))
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
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
