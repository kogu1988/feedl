import "server-only";

import { NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { statusLabels } from "@/lib/post-format";
import { posts, votes } from "@/lib/db/schema";

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
        status: posts.status,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        voteCount: count(votes.id),
      })
      .from(posts)
      .leftJoin(votes, eq(votes.postId, posts.id))
      .groupBy(posts.id)
      .orderBy(desc(posts.createdAt));

    const csv = buildCsv(rows);

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
  status: string;
  createdAt: Date;
  updatedAt: Date;
  voteCount: number;
}

// RFC 4180: virgül/tırnak/yeni satır içeren alanlar çift tırnağa alınır,
// içindeki tırnaklar ikiye katlanır. Baştaki BOM, Excel'in Türkçe karakterleri
// UTF-8 olarak açmasını garanti eder.
function buildCsv(rows: ExportRow[]): string {
  const header = ["Başlık", "Durum", "Oy Sayısı", "Oluşturma", "Güncelleme", "ID"];
  const lines = [header.map(escapeCsvField).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.title,
        statusLabels[row.status] ?? row.status,
        String(row.voteCount),
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
