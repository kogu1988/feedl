import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "feedl - AI Destekli Müşteri Geri Bildirim Platformu",
  description:
    "Özellik isteklerini toplayın, AI ile analiz edin ve yol haritanızı yönetin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ClerkProvider v7 ile <body> içinde olmalı (html'i sarmamalı).
  // Ortak site üst barı: marka + Portal/Yol Haritası nav + auth (plan.md
  // Sprint 9; Sprint 2'deki geçici barın yerine geçti).
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider appearance={{ theme: shadcn }}>
          <header className="border-b">
            <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
              <div className="flex items-center gap-6">
                <Link
                  href="/"
                  className="text-base font-bold tracking-tight"
                >
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
      </body>
    </html>
  );
}
