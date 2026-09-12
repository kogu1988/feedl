import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { getWorkspaceId, isShowcaseRequest } from "@/lib/db/workspace";
import { getTeamUserId } from "@/lib/auth/admin";
import { getPlanLimits } from "@/lib/paddle";
import {
  resolveWidgetAccent,
  type FeedlSelfEmbedConfig,
} from "@/lib/widget/embed";

// feedl'in KENDİ yüzeylerine widget self-embed'i (dogfood) — SUNUCU tarafı
// çözücü. Client yaşam döngüsü: components/custom/feedl-widget-embed.tsx.
//
// ⚠️ KAPILAR BURADA. Bu fonksiyon (main) layout'tan çağrılır, yani şu üç host
// durumunda da çalışır: feedl.app, acme.feedl.app, doğrulanmış custom domain.
//
//   1) HOST KAPISI (`isShowcaseRequest`): yalnız feedl kök host'unda devam et.
//      Kapı olmadan sabit feedl workspace'i hedeflendiği için bir müşterinin
//      roadmap'inde O MÜŞTERİNİN ziyaretçileri FEEDL'İN panosuna yazardı
//      (cross-tenant veri yönlendirmesi). Kapıyı tek mount noktasının dışında
//      değil, çözücünün içinde tutuyoruz → çağrı yerini değiştirmek sızıntı
//      üretmez.
//   2) OTURUM KAPISI (2026-09-12, kullanıcı kararı): giriş yapmış workspace
//      üyesi (owner/manager/member) widget'ı GÖRMEZ. Operatör odur, geri
//      bildirim kaynağı değildir; widget'tan gönderirse kayıt anonim düşer ve
//      kendi panosunda karışıklık yaratır. Tanınmış geri bildirim araçları da
//      "identified internal user → launcher gizle" davranışını uygular.
//      Anonim ziyaretçi ve üye olmayan girişli müşteri görür.
export async function resolveFeedlSelfEmbed(): Promise<FeedlSelfEmbedConfig | null> {
  if (!(await isShowcaseRequest())) return null;

  // Oturum kapısı. İstek bağlamı olmayan render'lar (build/prerender/test/cron)
  // için FAIL-CLOSED: `auth()` orada fırlatır ve o durumda widget HİÇ
  // çözülmez — böylece statik üretime yanlış `baseUrl`/oturum bilgisi
  // gömülmez. Çalışma zamanındaki her istekte bağlam vardır.
  try {
    if (await getTeamUserId()) return null;
  } catch {
    return null;
  }

  let slug: string | null = null;
  let accent: string | null = null;
  try {
    const workspaceId = await getWorkspaceId();
    const [row] = await getDb()
      .select({ slug: workspaces.slug, brandColor: workspaces.brandColor })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    // Workspace, sayfanın kendisiyle AYNI çözücüden gelir (`getWorkspaceId`) —
    // böylece widget'ın hedefi her zaman sayfada görünen panonun aynısı olur.
    slug = row?.slug ?? null;
    accent = resolveWidgetAccent(
      (await getPlanLimits()).key === "pro",
      row?.brandColor,
    );
  } catch (err) {
    console.error(
      "Feedl widget self-embed çözümlenemedi:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
  if (!slug) return null;

  // baseUrl İSTEKTEN türetilir (preview/prod ayrımı kendiliğinden doğru olur) —
  // dashboard/widget sayfasındaki host okuma deseniyle aynı.
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return null;
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const baseUrl = `${proto}://${host}`;

  return {
    src: `${baseUrl}/widget.js`,
    baseUrl,
    workspace: slug,
    accent,
    buttonText: "Geri bildirim",
  };
}
