import Link from "next/link";

import { WidgetPanel } from "@/components/custom/widget-panel";
import {
  getWorkspaceId,
  resolveWorkspaceIdFromSlug,
  getWorkspaceBrand,
} from "@/lib/db/workspace";
import { getWidgetSubmissionSettings } from "@/lib/widget/submission";
import { effectivePlanKeyForWorkspace } from "@/lib/paddle";
import { getWidgetSession } from "@/lib/widget/jwt";

// Widget sayfası (plan.md Sprint 32): müşteri sitelerine gömülen iframe'in
// içi. (main) layout'unu KULLANMAZ — root layout bare html/body verir, site
// üst barı iframe'e sızmaz. Kimlik Clerk değil widget çerezinden gelir;
// çerez yoksa liste salt-okunur izlenir. Sprint 41: ?theme= parametresi.
// Sprint 64: liste + arama + sayfalama + sıralama artık client (WidgetPanel)
// — canlı, sayfa yenilenmeden; burada yalnız bağlam (workspace/plan) çözülür.
export const dynamic = "force-dynamic";

const WIDGET_THEMES = ["light", "dark", "auto"] as const;
type WidgetTheme = (typeof WIDGET_THEMES)[number];

export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; ws?: string }>;
}) {
  const { theme: rawTheme, ws: rawWs } = await searchParams;
  // Sprint 63p: `?ws=<slug>` varsa workspace'i ondan çöz (token olmayan
  // salt-okunur iframe de müşteri workspace'ini görsün); yoksa oturum/host.
  const workspaceId =
    (await resolveWorkspaceIdFromSlug(rawWs)) ?? (await getWorkspaceId());
  // "Tümünü gör" müşterinin PORTALINA gider. Önce custom domain (varsa),
  // sonra subdomain (acme.feedl.app/portal), en son default /portal.
  const brand = await getWorkspaceBrand();
  const appHost = (process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app").replace(/^https?:\/\//, "");
  const portalHref =
    brand.customDomain
      ? `https://${brand.customDomain}/portal`
      : rawWs && rawWs !== "feedl"
        ? `https://${rawWs}.${appHost}/portal`
        : "/portal";
  const theme: WidgetTheme = WIDGET_THEMES.includes(
    rawTheme as WidgetTheme,
  )
    ? (rawTheme as WidgetTheme)
    : "light";

  const session = await getWidgetSession();

  // Sprint 63z: gönderim modu + anonim oy (client panel'e geçir).
  const { mode, anonymousVoting } = await getWidgetSubmissionSettings(workspaceId);
  const canVote = Boolean(session) || (mode === "anonymous" && anonymousVoting);

  // Triage Pro özelliği: free'de "Pro" rozetiyle gösterilir. 2026-09-12:
  // hesap düzeyi Pro dahil (owner'ın başka bir Pro workspace'i varsa bu
  // workspace de Pro'dur) — ham `workspaces.plan` okumak bunu atlıyordu.
  let isPro = false;
  try {
    isPro = (await effectivePlanKeyForWorkspace(workspaceId)) === "pro";
  } catch {
    isPro = false;
  }

  return (
    <main className="mx-auto w-full max-w-md p-4">
      {theme !== "light" ? (
        <script
          // Hydration'dan önce çalışır; auto modda işletim sistemi tercihini
          // izler ve değişiklikte class'ı günceller.
          dangerouslySetInnerHTML={{
            __html:
              theme === "dark"
                ? 'document.documentElement.classList.add("dark");'
                : '(function(){var el=document.documentElement;var mq=window.matchMedia("(prefers-color-scheme: dark)");function a(v){el.classList.toggle("dark",v)}a(mq.matches);if(mq.addEventListener)mq.addEventListener("change",function(e){a(e.matches)});else if(mq.addListener)mq.addListener(function(e){a(e.matches)})})();',
          }}
        />
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-bold tracking-tight">Geri Bildirim</h1>
        <Link
          href={portalHref}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          Tümünü gör
        </Link>
      </div>

      <WidgetPanel
        ws={rawWs}
        portalHref={portalHref}
        submissionMode={mode}
        authenticated={Boolean(session)}
        canVote={canVote}
        isPro={isPro}
      />
    </main>
  );
}
