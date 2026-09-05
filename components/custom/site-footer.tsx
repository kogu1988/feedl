"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

// Sprint 63+ (IA standardı — kullanıcı onayı) + 2026-09-06 revizyonu:
// footer yüzeye VE oturuma göre render edilir —
//   Giriş yapmış kullanıcı (ürünü kullanıyor) → footer YOK (pazarlama gürültüsü).
//   Anonim ziyaretçi → satış/marka: Demo + Fiyat; public topluluk:
//     Portal / Yol Haritası / Güncellemeler; Şirket/legal hep.
//   admin ve auth/işlem yüzeyleri → footer yok (PRIVATE_APP_PREFIXES).
// Not: "/" satış eşleşmesi EXACT (startsWith("/") her path'e uyar).
const PRIVATE_APP_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/invites",
  "/sign-in",
  "/sign-up",
];
const SALES_PREFIXES = ["/demo", "/pricing", "/contact", "/privacy", "/terms"];
const SALES_EXACT = ["/"];

function isSalesSurface(pathname: string) {
  return (
    SALES_EXACT.includes(pathname) ||
    SALES_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

const companyLinks = [
  { href: "/pricing", label: "Fiyatlandırma" },
  { href: "/contact", label: "İletişim" },
  { href: "/privacy", label: "Gizlilik Politikası" },
  { href: "/terms", label: "Kullanım Şartları" },
];

function footerColumnsFor(pathname: string) {
  // Satış/marka yüzeyi: ürün kolonunda yalnız Demo + Fiyat — müşteri
  // board'larını (portal/yol/güncelleme) satış landing'inde tanımlamayız.
  if (isSalesSurface(pathname)) {
    return [
      {
        title: "Ürün",
        links: [
          { href: "/demo", label: "Demo" },
          { href: "/pricing", label: "Fiyatlandırma" },
        ],
      },
      { title: "Şirket", links: companyLinks },
    ];
  }
  // Public topluluk yüzeyi (portal, roadmap, changelog).
  return [
    {
      title: "Ürün",
      links: [
        { href: "/portal", label: "Fikir Portalı" },
        { href: "/roadmap", label: "Yol Haritası" },
        { href: "/changelog", label: "Güncellemeler" },
      ],
    },
    { title: "Şirket", links: companyLinks },
  ];
}

export function SiteFooter({ brand }: { brand: { name: string } }) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  // Giriş yapmış kullanıcı ürünü kullanıyor → pazarlama footer'ı yok.
  // Anonimde private yüzeylerde de yok.
  if (isSignedIn || PRIVATE_APP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }
  const footerColumns = footerColumnsFor(pathname);
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
