"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpIcon } from "lucide-react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/custom/theme-toggle";
import { cn } from "@/lib/utils";

// Sprint 36: üst bar site kabuğunun parçası — marka işareti ve aktif sayfa
// durumu eklendi. usePathname client gerektirdiği için layout'tan buraya
// taşındı; ClerkProvider (main) layout'unda kalır.
const navItems = [
  { href: "/portal", label: "Portal" },
  { href: "/roadmap", label: "Yol Haritası" },
  { href: "/portal/changelog", label: "Güncellemeler" },
];

function isActive(pathname: string, href: string) {
  if (href === "/portal") {
    // Changelog'un kendi menü girdisi var; /portal ve detay sayfaları
    // (/portal/[id], /portal/oyladiklarim) Portal'ı aktif eder.
    return (
      pathname === "/portal" ||
      (pathname.startsWith("/portal/") && pathname !== "/portal/changelog")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 font-bold tracking-tight"
          >
            <span
              className="flex size-6 items-center justify-center rounded-md bg-brand text-primary-foreground"
              aria-hidden="true"
            >
              <ChevronsUpIcon className="size-3.5" />
            </span>
            <span className="text-base">feedl</span>
          </Link>
          <nav
            className="flex min-w-0 items-center gap-0.5 text-sm sm:gap-1"
            aria-label="Site menüsü"
          >
            {navItems.map((item) => (
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
