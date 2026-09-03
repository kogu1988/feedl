import "server-only";

import { NextResponse } from "next/server";
import { and, count, desc, eq, inArray } from "drizzle-orm";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { loadCustomerCounts } from "@/lib/db/customer-counts";
import {
  computeRevenueScore,
  loadRevenueContexts,
} from "@/lib/db/revenue-scores";
import { sentimentLabels, statusLabels, typeLabels } from "@/lib/post-format";
import { comments, postTags, posts, tags, votes } from "@/lib/db/schema";

// GET /api/admin/export — tüm fikirleri CSV olarak indir (plan.md Sprint 7).
// Rota middleware'da korumalı; admin rolü burada DB'den doğrulanır.
export async function GET() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const rows = await getDb()
      .select({
        id: posts.id,
        title: posts.title,
        description: posts.description,
        status: posts.status,
        postType: posts.postType,
        sentimentLabel: posts.sentimentLabel,
        aiKeywords: posts.aiKeywords,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        voteCount: count(votes.id),
      })
      .from(posts)
      .leftJoin(votes, eq(votes.postId, posts.id))
      .where(eq(posts.workspaceId, await getWorkspaceId()))
      .groupBy(posts.id)
      .orderBy(desc(posts.createdAt));

    // Sprint 21: etiketler ikinci sorguyla (fan-out'suz) toplanır.
    const tagRows = rows.length
      ? await getDb()
          .select({ postId: postTags.postId, name: tags.name })
          .from(postTags)
          .innerJoin(tags, eq(tags.id, postTags.tagId))
          .where(
            inArray(
              postTags.postId,
              rows.map((row) => row.id),
            ),
          )
      : [];
    const tagsByPost = tagRows.reduce((map, row) => {
      const list = map.get(row.postId) ?? [];
      list.push(row.name);
      map.set(row.postId, list);
      return map;
    }, new Map<string, string[]>());

    // Sprint 29: herkese açık yorum sayaçları (iç notlar hariç) —
    // etiketlerle aynı ikinci-sorgu deseni (fan-out'suz).
    const commentRows = rows.length
      ? await getDb()
          .select({ postId: comments.postId, value: count() })
          .from(comments)
          .where(
            and(
              inArray(
                comments.postId,
                rows.map((row) => row.id),
              ),
              eq(comments.isInternal, false),
            ),
          )
          .groupBy(comments.postId)
      : [];
    const commentCountByPost = new Map(
      commentRows.map((row) => [row.postId, row.value]),
    );

    // Sprint 30: kaç şirket istedi — aynı ikinci-sorgu deseni.
    const customerCountByPost = await loadCustomerCounts(
      rows.map((row) => row.id),
    );

    // Sprint 31: gelir skoru — dashboard tablosuyla aynı formül.
    const revenueContexts = await loadRevenueContexts(
      rows.map((row) => row.id),
    );
    const revenueScoreByPost = new Map(
      rows.map((row) => {
        const customerCount = customerCountByPost.get(row.id) ?? 0;
        return [
          row.id,
          computeRevenueScore({
            voteCount: row.voteCount,
            customerCount,
            mrrTotal: revenueContexts.mrrByPost.get(row.id) ?? 0,
            openOpportunityValue:
              revenueContexts.opportunityValueByPost.get(row.id) ?? 0,
          }),
        ] as const;
      }),
    );

    const csv = buildCsv(
      rows,
      tagsByPost,
      commentCountByPost,
      customerCountByPost,
      revenueScoreByPost,
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="feedl-fikirler-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(
      "GET /api/admin/export failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "CSV oluşturulamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// limit yok: export tüm fikirleri kapsar (plan.md Sprint 7).
interface ExportRow {
  id: string;
  title: string;
  description: string;
  status: string;
  postType: string | null;
  sentimentLabel: string | null;
  aiKeywords: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  voteCount: number;
}

// RFC 4180: virgül/tırnak/yeni satır içeren alanlar çift tırnağa alınır,
// içindeki tırnaklar ikiye katlanır. Baştaki BOM, Excel'in Türkçe karakterleri
// UTF-8 olarak açmasını garanti eder.
function buildCsv(
  rows: ExportRow[],
  tagsByPost: Map<string, string[]>,
  commentCountByPost: Map<string, number>,
  customerCountByPost: Map<string, number>,
  revenueScoreByPost: Map<string, number>,
): string {
  const header = [
    "Başlık",
    "Açıklama",
    "Durum",
    "Tür",
    "Etiketler",
    "Duygu",
    "Anahtar Kelimeler",
    "Oy Sayısı",
    "Yorum Sayısı",
    "Müşteri Sayısı",
    "Gelir Skoru",
    "Oluşturma",
    "Güncelleme",
    "ID",
  ];
  const lines = [header.map(escapeCsvField).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.title,
        row.description,
        statusLabels[row.status] ?? row.status,
        row.postType ? (typeLabels[row.postType] ?? row.postType) : "—",
        (tagsByPost.get(row.id) ?? []).map((t) => `#${t}`).join(" "),
        row.sentimentLabel
          ? (sentimentLabels[row.sentimentLabel] ?? row.sentimentLabel)
          : "—",
        (row.aiKeywords ?? []).join(" "),
        String(row.voteCount),
        String(commentCountByPost.get(row.id) ?? 0),
        String(customerCountByPost.get(row.id) ?? 0),
        String(revenueScoreByPost.get(row.id) ?? 0),
        dateFormatter.format(row.createdAt),
        dateFormatter.format(row.updatedAt),
        row.id,
      ]
        .map(escapeCsvField)
        .join(","),
    );
  }

  return "\uFEFF" + lines.join("\r\n");
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
