import "server-only";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { resolveTxt } from "node:dns/promises";

import { getAdminUserId } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";
import {
  domainVerificationRecordName,
  domainVerificationRecordValue,
} from "@/lib/custom-domain";

// 2026-09-12 kod incelemesi — custom domain SAHİPLİK DOĞRULAMASI (DNS TXT).
//
// Neden: domain'i yazan kişinin o host'un gerçekten sahibi olduğunu kanıtlaması
// gerekir. Aksi halde bir tenant `feedback.acme.com`'u yazıp, acme sonradan
// DNS'ini feedl'e çevirdiğinde gelen trafik o tenant'ın workspace'i olarak
// servis edilirdi (hostname squatting). Kullanıcı `_feedl.<domain>` TXT kaydını
// ekler; değeri doğrulayıp `custom_domain_verified_at`'i işaretleriz — host
// çözümlemesi YALNIZ doğrulanmış domain'leri dikkate alır
// (bkz. lib/db/workspace.ts).
//
// node:dns edge runtime'da yok → Node runtime şart.
export const runtime = "nodejs";

export async function POST() {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const workspaceId = await getWorkspaceId();
    const [ws] = await getDb()
      .select({
        domain: workspaces.customDomain,
        token: workspaces.customDomainVerificationToken,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!ws?.domain) {
      return NextResponse.json(
        { success: false, error: "Önce bir custom domain kaydet." },
        { status: 400 },
      );
    }
    if (!ws.token) {
      return NextResponse.json(
        { success: false, error: "Doğrulama token'ı yok — alan adını yeniden kaydet." },
        { status: 400 },
      );
    }

    const recordName = domainVerificationRecordName(ws.domain);
    const recordValue = domainVerificationRecordValue(ws.token);

    let records: string[][] = [];
    try {
      records = await resolveTxt(recordName);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? "unknown";
      // ENOTFOUND/ENODATA = kayıt henüz yok (en sık durum; DNS yayılımı gecikir).
      const missing = code === "ENOTFOUND" || code === "ENODATA";
      return NextResponse.json(
        {
          success: false,
          error: missing
            ? `${recordName} için TXT kaydı bulunamadı. DNS yayılımı birkaç dakika sürebilir.`
            : `DNS sorgusu başarısız (${code}). Lütfen tekrar dene.`,
        },
        { status: missing ? 400 : 502 },
      );
    }

    // resolveTxt uzun değerleri 255 karakterlik parçalara böler → birleştir.
    const found = records.map((chunks) => chunks.join("").trim());
    if (!found.includes(recordValue)) {
      return NextResponse.json(
        {
          success: false,
          error: `${recordName} TXT kaydı beklenen değeri içermiyor.`,
          data: { recordName, recordValue, found: found.slice(0, 5) },
        },
        { status: 400 },
      );
    }

    const verifiedAt = new Date();
    await getDb()
      .update(workspaces)
      .set({ customDomainVerifiedAt: verifiedAt, updatedAt: verifiedAt })
      .where(eq(workspaces.id, workspaceId));

    return NextResponse.json({
      success: true,
      data: { domain: ws.domain, verifiedAt: verifiedAt.toISOString() },
    });
  } catch (err) {
    console.error(
      "POST /api/admin/workspace/verify-domain failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "Doğrulama yapılamadı. Lütfen tekrar dene." },
      { status: 500 },
    );
  }
}
