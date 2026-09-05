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
// Sprint 50: footer çok sütunlu — ürün + demo linkleri + yasal/şirket.
const footerColumns = [
  {
    title: "Ürün",
    links: [
      { href: "/portal", label: "Fikir Portalı" },
      { href: "/roadmap", label: "Yol Haritası" },
      { href: "/changelog", label: "Güncellemeler" },
      { href: "/demo", label: "Demo" },
    ],
  },
  {
    title: "Şirket",
    links: [
      { href: "/pricing", label: "Fiyatlandırma" },
      { href: "/contact", label: "İletişim" },
      { href: "/privacy", label: "Gizlilik Politikası" },
      { href: "/terms", label: "Kullanım Şartları" },
    ],
  },
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
          <div className="container mx-auto max-w-none px-4 py-10">
            <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{brand.name}</span>
                  {" "}— müşteri geri bildirimini ürün kararına dönüştürür.
                </p>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Topla, analiz et, önceliklendir ve duyur — hepsi tek bir
                  herkese açık topluluk portalında.
                </p>
              </div>
              {footerColumns.map((column) => (
                <div key={column.title}>
                  <h2 className="text-sm font-semibold">{column.title}</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t pt-6">
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} {brand.name}. Tüm hakları saklıdır.
              </p>
            </div>
          </div>
        </footer>
      </div>
      </ThemeProvider>
    </ClerkProvider>
  );
}
