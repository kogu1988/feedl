import type { Metadata } from "next";
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
  // Geçici üst bar: Sprint 2'de gerçek portal/dashboard navigasyonu gelir.
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider appearance={{ theme: shadcn }}>
          <header className="flex items-center justify-end gap-3 border-b p-4">
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
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
