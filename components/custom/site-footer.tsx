"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpIcon } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

import { textOn } from "@/lib/color";

// Sprint 63+ (IA standardı) + 2026-09-06 revizyonları:
// footer yalnızca anonim ziyaretçiye gösterilir (Giriş yapmış kullanıcı ürünü
// kullanıyor → pazarlama gürültüsü yok; admin/auth/işlem yüzeylerinde de yok).
// İçerik: marka tanıtımı (sol) + şirket/legal linkleri TEK SIRA (sağ) + ortalanmış
// telif. "Ürün" bağlantıları (Demo/Fiyat) tüm footer'lardan kaldırıldı — nav üst
// bardadır. PRIVATE_APP_PREFIXES private yüzeyleri belirler.
const PRIVATE_APP_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/invites",
  "/sign-in",
  "/sign-up",
];

const companyLinks = [
  { href: "/contact", label: "İletişim" },
  { href: "/privacy", label: "Gizlilik Politikası" },
  { href: "/terms", label: "Kullanım Şartları" },
];

export function SiteFooter({ brand }: { brand: { name: string; brandColor?: string | null; logoUrl?: string | null } }) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  // Giriş yapmış kullanıcı ürünü kullanıyor → pazarlama footer'ı yok.
  // Anonimde private yüzeylerde de yok (PRIVATE_APP_PREFIXES).
  if (isSignedIn || PRIVATE_APP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }
  return (
    <footer className="border-t">
      <div className="container mx-auto max-w-none px-4 pb-8 pt-10">
        {/* Üst satır: marka tanıtımı (sol) + şirket linkleri TEK SIRA (sağ). */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            {/* Sprint 63u: footer marka tanıtımında da HEADER'ın logosu kullanılır. */}
            <div className="flex items-center gap-2">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-md"
                style={{
                  backgroundColor: brand.brandColor ?? "#ff5c35",
                  color: textOn(brand.brandColor ?? "#ff5c35"),
                }}
                aria-hidden="true"
              >
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt="" className="size-4 object-contain" />
                ) : (
                  <ChevronsUpIcon className="size-3.5" />
                )}
              </span>
              <span className="text-sm font-semibold text-foreground">{brand.name}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Müşteri geri bildirimini ürün kararına dönüştürür.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Topla, analiz et, önceliklendir ve duyur — hepsi tek bir
              herkese açık topluluk portalında.
            </p>
          </div>
          <ul
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm md:pt-1"
            aria-label="Şirket linkleri"
          >
            {companyLinks.map((link) => (
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

        {/* Telif — normal footer içinde, ortalanmış. */}
        <div className="mt-8 border-t pt-6">
          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} {brand.name}. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </footer>
  );
}
