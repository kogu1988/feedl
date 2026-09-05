import { NextResponse } from "next/server";

import { getAdminUserId } from "@/lib/auth/admin";
import { parseCsv } from "@/lib/csv";
import { importPosts } from "@/lib/db/import";

// Sprint 59 (madde — import): CSV'den feedback importu. Export CSV formatıyla
// uyumlu; "Başlık" (zorunlu), "Açıklama", "Durum", "Tür", "Etiketler" sütunları
// kabul edilir. Aynı başlık workspace'te varsa atlanır (idempotent).
// AI analiz bulk import'ta çalıştırılmaz — postlar `open`/unanalyzed kalır.

const MAX_ROWS = 500;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: "Bu işlem için admin yetkisi gerekir." },
        { status: 403 },
      );
    }

    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "CSV dosyası gerekli." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "Dosya çok büyük (max 2MB)." },
        { status: 400 },
      );
    }

    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "CSV'de satır yok." },
        { status: 400 },
      );
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { success: false, error: `En fazla ${MAX_ROWS} satır desteklenir.` },
        { status: 400 },
      );
    }

    const result = await importPosts(headers, rows);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error(
      "POST /api/admin/import failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { success: false, error: "CSV içe aktarılamadı. Dosya formatını ve başlıkları kontrol et." },
      { status: 500 },
    );
  }
}
