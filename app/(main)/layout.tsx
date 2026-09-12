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
  resolveWorkspaceForCurrentHost,
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
  const hostWorkspace = await resolveWorkspaceForCurrentHost();
  if (!hostWorkspace) {
    notFound();
  }

  // Sprint 48k: workspace markası (subdomain'e göre) üst bara taşınır.
  const brand = await getWorkspaceBrand();
  const brandStyle = workspaceBrandStyle(brand.brandColor);
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
        <SiteHeader brand={brand} />
        <div className="flex-1">{children}</div>
        <SiteFooter brand={brand} />
      </div>
      </ThemeProvider>
    </ClerkProvider>
  );
}
