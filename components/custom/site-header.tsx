"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpIcon } from "lucide-react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
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
function navItemsFor(pathname: string) {
  const isSales =
    pathname === "/" ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/pricing");
  if (isSales) {
    return [
      { href: "/demo", label: "Demo" },
      { href: "/pricing", label: "Fiyat" },
    ];
  }
  return [
    { href: "/portal", label: "Portal" },
    { href: "/roadmap", label: "Yol Haritası" },
    { href: "/portal/changelog", label: "Güncellemeler" },
  ];
}

function isActive(pathname: string, href: string) {
  if (href === "/portal") {
    // Changelog'un kendi menü girdisi var; /portal ve detay sayfaları
    // (/portal/[id], /portal/oyladiklarim) Portal'ı aktif eder.
    return (
      pathname === "/portal" ||
      (pathname.startsWith("/portal/") && pathname !== "/portal/changelog")
    );
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
            <SignInButton>
              <button className="hidden cursor-pointer rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent sm:block">
                Giriş Yap
              </button>
            </SignInButton>
            <SignUpButton>
              <Button size="sm">Kayıt Ol</Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
