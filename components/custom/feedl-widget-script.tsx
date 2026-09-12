import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { getWorkspaceId, isShowcaseRequest } from "@/lib/db/workspace";
import { getPlanLimits } from "@/lib/paddle";
import { resolveWidgetAccent } from "@/lib/widget/embed";

// feedl'in KENDİ yüzeylerine widget self-embed'i (dogfood, 2026-09-12).
//
// ⚠️ HOST KAPISI BURADA — çağrı yerinde DEĞİL. `/roadmap` ve `/changelog`
// host-bağımsız render edilir: aynı kod `feedl.app`'te, `acme.feedl.app`'te ve
// doğrulanmış custom domain'lerde de çalışır. Kapı olmadan bu bileşen bir
// müşterinin roadmap'ine konulsaydı, sabit feedl workspace'i hedeflendiği için
// O MÜŞTERİNİN ziyaretçileri FEEDL'İN panosuna yazardı (cross-tenant veri
// yönlendirmesi). Kapıyı bileşenin içine koyarak bu hatayı yapısal olarak
// imkânsız kılıyoruz: bileşeni nereye koyarsan koy, yalnız feedl kök host'unda
// render eder.
//
// Yüzey politikası: landing (/) + /roadmap + /changelog. /portal BİLİNÇLİ
// olarak hariç — o sayfa zaten geri bildirim panosunun kendisidir; oraya widget
// koymak feedl içinde feedl paneli (iç içe iframe) yaratırdı.
export async function FeedlWidgetScript() {
  if (!(await isShowcaseRequest())) return null;

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

  return (
    <script
      src={`${baseUrl}/widget.js`}
      data-feedl-url={baseUrl}
      data-feedl-workspace={slug}
      data-button-text="Geri bildirim"
      // `data-accent` yalnız Pro'da ve özel renk varsa yazılır (plan matrisi);
      // yoksa widget varsayılanı = feedl marka rengi.
      {...(accent ? { "data-accent": accent } : {})}
      // Feedl'in kendi yüzeyi: ziyaretçinin temasını izle.
      data-theme="auto"
      async
    />
  );
}
