import { ClerkProvider } from "@clerk/nextjs";
import { trTR } from "@clerk/localizations";
import { notFound } from "next/navigation";

import { clerkElements, clerkVariables } from "@/lib/clerk-theme";

import { SiteHeader } from "@/components/custom/site-header";
import { SiteFooter } from "@/components/custom/site-footer";
import { ThemeProvider } from "@/components/custom/theme-provider";
import { CanonicalLink } from "@/components/custom/canonical-link";
import {
  getWorkspaceBrand,
  isFeedlRootRequest,
  isUnknownHostRequest,
} from "@/lib/db/workspace";
import { workspaceBrandStyle } from "@/lib/brand-style";

// Sprint 63w (F3) / 2026-09-12: marka paleti artık `lib/brand-style.ts`
// içindedir (tek kaynak) — dashboard kendi segmentinde bu paleti sıfırlar.

// Sprint 32: site üst barı ClerkProvider ile birlikte (main) route group'una
// taşındı. /widget iframe içinde bu layout'u KULLANMAZ — root layout bare
// html/body verir. Sprint 36: üst bar SiteHeader'a taşındı (aktif nav durumu
// client gerektirir), alt bar eklendi; flex iskelet footer'ı alta sabitler.
// Sprint 50: footer çok sütunlu — ürün + demo linkleri + yasal/şirket.
// Sprint 51: footer SiteFooter'a taşındı — rakip standardıyla admin
// (/dashboard*), onboarding, davet ve auth yüzeylerinde render edilmez.

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 2026-09-12 (fail-closed host kapısı): var olmayan bir alt alan veya
  // doğrulanmamış bir custom domain artık varsayılan workspace'i GÖSTERMEZ;
  // 404 döner. Gerekçe + muafiyetler: lib/db/workspace.ts → isDefaultFallbackHost.
  //
  // Bu kapı BİLEREK layout'ta ve getWorkspaceId'in DIŞINDA: `getWorkspaceId`
  // çağrılarının çoğu `try { ... } catch {}` içinde (ör. changelog/page.tsx) ve
  // `notFound()` oradan fırlarsa sessizce yutulur, kırık sayfa render edilirdi.
  // Kapı istek bağlamı yoksa (build/prerender) uygulanmaz — statik üretim
  // DB'ye muhtaç olmasın (bkz. isUnknownHostRequest).
  if (await isUnknownHostRequest()) {
    notFound();
  }

  // 2026-09-12 (marka kapsamı — rakip standardı):
  //   Kök host (feedl.app)  → marka HER ZAMAN feedl; workspace paleti uygulanmaz.
  //                           Pazarlama + kendi portal vitrinimiz bizim kimliğimiz.
  //   Workspace host'u      → müşterinin adı/logo'su/rengi (portal, roadmap,
  //                           changelog) — Canny/Featurebase/UserVoice/Fider
  //                           hep böyle yapar; satıcı yalnızca "Powered by"dır.
  //   Dashboard             → feedl işareti + aktif workspace bağlamı (chip).
  // Bu ayrım aynı zamanda bir a11y hatasını da kapatır: workspace marka rengi
  // (#1e01f9) kök host'un CTA bölümüne uygulanıp kontrastı bozuyordu.
  const isRootHost = await isFeedlRootRequest();
  const brand = await getWorkspaceBrand();
  const mark = isRootHost
    ? { name: "feedl", logoUrl: null }
    : { name: brand.name, logoUrl: brand.logoUrl };
  const brandStyle = isRootHost ? null : workspaceBrandStyle(brand.brandColor);
  return (
    <ClerkProvider
      localization={trTR}
      appearance={{ variables: clerkVariables, elements: clerkElements }}
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
      <CanonicalLink customDomain={brand.customDomain} />
      {brandStyle ? <style dangerouslySetInnerHTML={{ __html: brandStyle }} /> : null}
      <div className="flex min-h-svh flex-col">
        <SiteHeader brand={mark} contextWorkspaceName={isRootHost ? brand.name : undefined} />
        <div className="flex-1">{children}</div>
        {/* Footer da aynı kurala bağlı: kök host'ta feedl markası, workspace
            host'unda müşterinin adı/logo'su. `brand`'ı doğrudan geçmek kök
            host'ta workspace adını (ve kullanılmayan brandColor'ı) sızdırıyordu. */}
        <SiteFooter brand={mark} />
      </div>
      </ThemeProvider>
    </ClerkProvider>
  );
}
