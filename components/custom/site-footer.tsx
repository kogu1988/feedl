"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

// Rakip standardı (Canny, Linear, Featurebase): admin uygulaması, kayıt
// funnel'ı ve auth yüzeylerinde pazarlama footer'ı yok — içerik alanı
// sayfa sonuna kadar uzanır. Satış ve kamusal topluluk sayfalarında tam
// footer kalır. Yasal sayfalar (/privacy, /terms) kamusal olduğu için
// uygulamadan da erişilebilir kalır.
const APP_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/invites",
  "/sign-in",
  "/sign-up",
];

export function SiteFooter({ brand }: { brand: { name: string } }) {
  const pathname = usePathname();
  if (APP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }
  return (
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
  );
}
