import { ClerkProvider } from "@clerk/nextjs";
import { trTR } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";

import { SiteHeader } from "@/components/custom/site-header";
import { SiteFooter } from "@/components/custom/site-footer";
import { ThemeProvider } from "@/components/custom/theme-provider";
import { getWorkspaceBrand } from "@/lib/db/workspace";

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
  // Sprint 48k: workspace markası (subdomain'e göre) üst bara taşınır.
  const brand = await getWorkspaceBrand();
  return (
    <ClerkProvider localization={trTR} appearance={{ theme: shadcn }}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
      <div className="flex min-h-svh flex-col">
        <SiteHeader brand={brand} />
        <div className="flex-1">{children}</div>
        <SiteFooter brand={brand} />
      </div>
      </ThemeProvider>
    </ClerkProvider>
  );
}
