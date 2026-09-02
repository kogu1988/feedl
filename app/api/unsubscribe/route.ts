import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

// Sprint 26: token'lı unsubscribe — bildirim e-postalarının altındaki
// link buraya gelir. token kullanıcıya özel (users.unsubscribe_token);
// type hangi bildirim grubunun kapatılacağını seçer. Tek yönlü: geri
// açma için kullanıcı Clerk ile giriş yapıp portaldan tercihler
// sayfasını kullanır (ileride); burada yalnızca kapatma var.

const unsubscribeSchema = z.object({
  token: z.uuid("Geçersiz bağlantı."),
  type: z.enum(["status", "comment"], { error: "Geçersiz bildirim türü." }),
});

function page(title: string, message: string) {
  return new NextResponse(
    `<!doctype html>
<html lang="tr">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — feedl</title></head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
      <tr><td align="center">
        <table role="presentation" style="max-width:420px;width:100%;background:#fff;border:1px solid #e4e4e7;border-radius:8px;">
          <tr><td style="padding:24px 32px;border-bottom:1px solid #e4e4e7;">
            <span style="font-size:18px;font-weight:700;color:#18181b;">feedl</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:18px;color:#18181b;">${title}</h1>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3f46;">${message}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = unsubscribeSchema.safeParse({
      token: url.searchParams.get("token") ?? "",
      type: url.searchParams.get("type") ?? "",
    });
    if (!parsed.success) {
      return page("Geçersiz bağlantı", "Bu abonelikten çıkma bağlantısı hatalı veya eksik.");
    }

    const patch =
      parsed.data.type === "status"
        ? { emailStatusUpdates: false }
        : { emailComments: false };

    const updated = await getDb()
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.unsubscribeToken, parsed.data.token))
      .returning({ id: users.id });

    if (updated.length === 0) {
      return page(
        "Bağlantı bulunamadı",
        "Bu abonelikten çıkma bağlantısı geçersiz. Hesabınla giriş yapıp tercihlerini yönetebilirsin.",
      );
    }

    return page(
      "Bildirimler kapatıldı",
      parsed.data.type === "status"
        ? "Artık fikir durumu güncellemeleri e-posta ile gönderilmeyecek."
        : "Artık yorum bildirimleri e-posta ile gönderilmeyecek.",
    );
  } catch (err) {
    console.error(
      "GET /api/unsubscribe failed:",
      err instanceof Error ? err.message : err,
    );
    return page("Hata", "İşlem tamamlanamadı. Lütfen daha sonra tekrar dene.");
  }
}
