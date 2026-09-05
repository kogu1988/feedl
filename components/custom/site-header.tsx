"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpIcon } from "lucide-react";
import { Show, UserButton } from "@clerk/nextjs";

import { ClerkTriggerButton } from "@/components/custom/clerk-trigger-button";
import { ThemeToggle } from "@/components/custom/theme-toggle";
import { cn } from "@/lib/utils";

// Sprint 48k: marka renginin üzerinde okunur yazı rengi (WCAG kontrast
// tahmini). Açık renklerde koyu mürekkep, koyu renklerde beyaz.
function textOn(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#2b0e04";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? "#2b0e04" : "#ffffff";
}

// Sprint 36: üst bar site kabuğunun parçası — marka işareti ve aktif sayfa
// durumu eklendi. usePathname client gerektirdiği için layout'tan buraya
// taşındı; ClerkProvider (main) layout'unda kalır.
// Sprint 50: nav satış (/, /demo, /pricing) ve ürün (/portal*, /roadmap*,
// /dashboard*) yüzeylerine göre değişir. Satış sayfalarında portal/yol
// haritası/güncellemeler çıkar; yerine Demo + Fiyat. Ürün sayfalarında
// mevcut ürün nav'ı kalır.
// Sprint 63+ (IA standardı — kullanıcı onayı): yüzeyler netleştirildi —
//   satış/marka (/ , /demo, /pricing, /contact, /privacy, /terms) → Demo+Fiyat
//   auth/işlem (/sign-in, /sign-up, /onboarding, /invites) → nav YOK
//   admin (/dashboard*) → yalnız "Portal" (public board'a atla; sidebar zaten nav)
//   public topluluk (/portal*, /roadmap*, /changelog*) → Portal+Yol+Güncellemeler
const SALES_PREFIXES = ["/", "/demo", "/pricing", "/contact", "/privacy", "/terms"];
const AUTH_APP_PREFIXES = ["/sign-in", "/sign-up", "/onboarding", "/invites"];
const ADMIN_PREFIX = "/dashboard";

function navItemsFor(pathname: string) {
  if (pathname.startsWith(ADMIN_PREFIX)) {
    return [{ href: "/portal", label: "Portal" }];
  }
  // Satış/marka yüzeyleri: yeni müşteri CTA'sı. Legal/şirket sayfaları da
  // satış tarafına ait (public footer'da pazarlama nav'ıyla aynı dünya).
  if (SALES_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return [
      { href: "/demo", label: "Demo" },
      { href: "/pricing", label: "Fiyat" },
    ];
  }
  // Auth/işlem yüzeyleri: üst bar ürün nav'ı göstermez (footer da gizli).
  if (AUTH_APP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return [];
  }
  // Public topluluk yüzeyleri (portal, roadmap, changelog).
  return [
    { href: "/portal", label: "Portal" },
    { href: "/roadmap", label: "Yol Haritası" },
    { href: "/changelog", label: "Güncellemeler" },
  ];
}

function isActive(pathname: string, href: string) {
  if (href === "/portal") {
    // /portal ve alt sayfaları ([id], oyladiklarim) Portal'ı aktif eder;
    // changelog üst seviyede (/changelog), kendi kuralıyla aktif olur.
    return pathname === "/portal" || pathname.startsWith("/portal/");
  }
  if (href === "/demo") {
    return pathname === "/demo";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ brand }: { brand?: { name: string; brandColor: string | null; logoUrl: string | null } }) {
  const pathname = usePathname();
  // Tam genişlik kararı (2026-09-05): üst bar tüm sayfalarda ekranın
  // tamamını kullanır — public/admin container ayrımı kalktı.
  const workspaceName = brand?.name ?? "feedl";
  const brandColor = brand?.brandColor ?? "#ff5c35";
  const logoUrl = brand?.logoUrl ?? null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div
        className="container mx-auto flex h-14 max-w-none items-center justify-between gap-3 px-4"
      >
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 font-bold tracking-tight"
          >
            <span
              className="flex size-6 items-center justify-center rounded-md"
              style={{ backgroundColor: brandColor, color: textOn(brandColor) }}
              aria-hidden="true"
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="size-4 object-contain" />
              ) : (
                <ChevronsUpIcon className="size-3.5" />
              )}
            </span>
            <span className="text-base">{workspaceName}</span>
          </Link>
          <nav
            className="flex min-w-0 items-center gap-0.5 text-sm sm:gap-1"
            aria-label="Site menüsü"
          >
            {navItemsFor(pathname).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-2 py-1 font-medium whitespace-nowrap transition-colors hover:bg-accent hover:text-foreground sm:px-2.5",
                  isActive(pathname, item.href)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Show when="signed-out">
            <ClerkTriggerButton
              mode="sign-in"
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
            >
              Giriş yap
            </ClerkTriggerButton>
            <ClerkTriggerButton mode="sign-up" size="sm">
              Kayıt ol
            </ClerkTriggerButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
