import Link from "next/link";
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";

// Sprint 32: site üst barı ClerkProvider ile birlikte (main) route group'una
// taşındı (plan.md Sprint 9 barının yerini korur). /widget iframe içinde
// bu layout'u KULLANMAZ — root layout bare html/body verir.
export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={{ theme: shadcn }}>
      <header className="border-b">
        <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-base font-bold tracking-tight">
              feedl
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/portal"
                className="rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Portal
              </Link>
              <Link
                href="/roadmap"
                className="rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Yol Haritası
              </Link>
              <Link
                href="/portal/changelog"
                className="rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Güncellemeler
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton>
                <button className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent">
                  Giriş Yap
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Kayıt Ol
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </div>
      </header>
      {children}
    </ClerkProvider>
  );
}
