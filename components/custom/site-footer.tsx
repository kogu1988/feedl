"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

// Sprint 63+ (IA standardı) + 2026-09-06 revizyonları:
// footer yalnızca anonim ziyaretçiye gösterilir (Giriş yapmış kullanıcı ürünü
// kullanıyor → pazarlama gürültüsü yok; admin/auth/işlem yüzeylerinde de yok).
// PRIVATE_APP_PREFIXES private yüzeyleri belirler.
const PRIVATE_APP_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/invites",
  "/sign-in",
  "/sign-up",
];

// 2026-09-14 (kullanıcı isteği) — linkler TEK SIRA yerine HİYERARŞİK gruplara
// ayrıldı. Her grup bir başlık + dikey liste; böylece "ürün", "kaynak" ve
// "şirket/yasal" ayrımı gözle okunur oluyor. Sıralama kuralları:
//   · "Ürün" önce (ürün-marka yüzeyi), "Şirket" sonra (yasal/iletişim).
//   · İLETİŞİM en sonda (kullanıcı isteği): son grubun son maddesidir.
// Yeni bir public sayfa eklenirse doğru gruba yazılır (orphan sayfa bırakma).
const FOOTER_GROUPS: Array<{
  heading: string;
  links: Array<{ href: string; label: string }>;
}> = [
  {
    heading: "Ürün",
    links: [
      { href: "/alternative", label: "Neden feedl" },
      { href: "/how-to-use-feedl", label: "Kullanım Rehberi" },
    ],
  },
  {
    heading: "Kaynaklar",
    links: [{ href: "/how-to-collect-feedback", label: "Geri Bildirim Rehberi" }],
  },
  {
    heading: "Şirket",
    links: [
      { href: "/privacy", label: "Gizlilik Politikası" },
      { href: "/terms", label: "Kullanım Şartları" },
      // Sprint 63x — Paddle canlı onayı: refund politikası linki zorunlu.
      { href: "/refund", label: "İade Politikası" },
      // En sonda: iletişim diğer linklerden sonra gelir (kullanıcı isteği).
      // İletişim sayfasındaki `<address id="iletisim">` bloğuna çapalar.
      { href: "/contact#iletisim", label: "İletişim" },
    ],
  },
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
        {/* Üst satır: marka tanıtımı (sol) + hiyerarşik link grupları (sağ). */}
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            {/* Sprint 63z: workspace logoUrl yoksa varsayılan turuncu marka logosu. */}
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brand.logoUrl ?? "/logo_brand_orange.svg"}
                alt=""
                className="size-6 shrink-0 object-contain"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-foreground">{brand.name}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Müşteri geri bildirimini ürün kararına dönüştürür.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Topla, analiz et, önceliklendir ve duyur — hepsi tek bir
              portalda.
            </p>
          </div>

          {/* Gruplar: her biri başlık + dikey liste. Tüm linkler AYNI stilde
              (aralarında görsel fark yok) — ayrım yalnız başlıkla verilir. */}
          <nav
            aria-label="Alt bilgi linkleri"
            className="grid gap-x-10 gap-y-6 sm:grid-cols-3"
          >
            {FOOTER_GROUPS.map((group) => (
              <div key={group.heading}>
                <h2 className="text-xs font-semibold text-foreground">
                  {group.heading}
                </h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {group.links.map((link) => (
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
          </nav>
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
