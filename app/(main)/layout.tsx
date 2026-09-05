import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";

import { SiteHeader } from "@/components/custom/site-header";
import { ThemeProvider } from "@/components/custom/theme-provider";
import { getWorkspaceBrand } from "@/lib/db/workspace";

// Sprint 32: site üst barı ClerkProvider ile birlikte (main) route group'una
// taşındı. /widget iframe içinde bu layout'u KULLANMAZ — root layout bare
// html/body verir. Sprint 36: üst bar SiteHeader'a taşındı (aktif nav durumu
// client gerektirir), alt bar eklendi; flex iskelet footer'ı alta sabitler.
const footerLinks = [
  { href: "/portal", label: "Portal" },
  { href: "/roadmap", label: "Yol Haritası" },
  { href: "/portal/changelog", label: "Güncellemeler" },
];

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Sprint 48k: workspace markası (subdomain'e göre) üst bara taşınır.
  const brand = await getWorkspaceBrand();
  return (
    <ClerkProvider appearance={{ theme: shadcn }}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
      <div className="flex min-h-svh flex-col">
        <SiteHeader brand={brand} />
        <div className="flex-1">{children}</div>
        <footer className="border-t">
          <div className="container mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{brand.name}</span>
              {" "}— müşteri geri bildirimini ürün kararına dönüştürür.
            </p>
            <nav
              className="flex items-center gap-4 text-sm text-muted-foreground"
              aria-label="Alt menü"
            >
              {footerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </footer>
      </div>
      </ThemeProvider>
    </ClerkProvider>
  );
}
