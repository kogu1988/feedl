"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  Building2Icon,
  Columns3Icon,
  CreditCardIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ListTreeIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  PanelLeftOpenIcon,
  PuzzleIcon,
  SettingsIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { cn } from "@/lib/utils";

// Sprint 51 (Batch 2): admin kabuk — yalnız /dashboard altında solda
// daralabilir slate sidebar (DESIGN.md §2: yapısal slate, aksan değil;
// §4: hibrit kabuk — public yüzeyler üst bar düzeninde kalır).
// Masaüstünde rail (240px ↔ 56px, localStorage), mobilde çekmece.
// Hareket kuralı (DESIGN.md §8): yalnız transform/opacity, 200ms.
const STORAGE_KEY = "feedl:sidebar-collapsed";

const navGroups = [
  {
    label: "Genel",
    items: [
      { href: "/dashboard", label: "Genel Bakış", icon: LayoutDashboardIcon },
      { href: "/dashboard/boards", label: "Board'lar", icon: Columns3Icon },
      { href: "/dashboard/revenue", label: "Gelir", icon: TrendingUpIcon },
      { href: "/dashboard/activation", label: "Aktivasyon", icon: BarChart3Icon },
      { href: "/dashboard/insights", label: "AI İçgörüleri", icon: SparklesIcon },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { href: "/dashboard/companies", label: "Şirketler", icon: Building2Icon },
      { href: "/dashboard/members", label: "Üyeler", icon: UsersIcon },
      { href: "/dashboard/fields", label: "Alanlar", icon: ListTreeIcon },
      {
        href: "/dashboard/workspaces",
        label: "Çalışma Alanları",
        icon: LayersIcon,
      },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/dashboard/widget", label: "Widget", icon: PuzzleIcon },
      { href: "/dashboard/billing", label: "Faturalama", icon: CreditCardIcon },
      { href: "/dashboard/settings", label: "Ayarlar", icon: SettingsIcon },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Yönetim menüsü" className="flex-1 overflow-y-auto p-2">
      {navGroups.map((group) => (
        <div key={group.label} className="mb-3 last:mb-0">
          <p
            className={cn(
              "px-2.5 pb-1 text-xs font-medium text-sidebar-foreground/50",
              collapsed && "hidden",
            )}
          >
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "relative flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                    "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    active
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/70",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand"
                    />
                  )}
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className={cn("truncate", collapsed && "hidden")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // localStorage okuma mount sonrası — SSR/hydration güvenliği.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // Sayfa değişince çekmece kapanır.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <>
      {/* Masaüstü: daralabilir slate ray */}
      <aside
        className={cn(
          "sticky top-14 hidden h-[calc(100svh-3.5rem)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center px-2.5",
            collapsed && "justify-center px-0",
          )}
        >
          {!collapsed && (
            <span className="text-sm font-semibold">Yönetim</span>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            className={cn(
              "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              !collapsed && "ml-auto",
            )}
          >
            {collapsed ? (
              <PanelLeftOpenIcon className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftCloseIcon className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <NavList collapsed={collapsed} />
        <div
          className={cn(
            "flex items-center gap-2 border-t border-sidebar-border p-2.5",
            collapsed && "justify-center px-0",
          )}
        >
          <UserButton />
          {!collapsed && (
            <span className="text-sm text-sidebar-foreground/70">Hesap</span>
          )}
        </div>
      </aside>

      {/* Mobil tetik çubuğu */}
      <div className="flex h-10 items-center border-b border-sidebar-border px-2 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-label="Menüyü aç"
          className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <PanelLeftIcon className="size-4" aria-hidden="true" />
          Menü
        </button>
      </div>

      {/* Mobil çekmece */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          !mobileOpen && "pointer-events-none",
        )}
      >
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Yönetim menüsü"
          aria-hidden={!mobileOpen}
          className={cn(
            "absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-lg transition-transform duration-200 ease-[var(--ease-out-quart)]",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-14 items-center px-2.5">
            <span className="text-sm font-semibold">Yönetim</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Menüyü kapat"
              className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
          <NavList collapsed={false} />
          <div className="flex items-center gap-2 border-t border-sidebar-border p-2.5">
            <UserButton />
            <span className="text-sm text-sidebar-foreground/70">Hesap</span>
          </div>
        </aside>
      </div>
    </>
  );
}
