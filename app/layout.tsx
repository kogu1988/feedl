import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-app-sans",
  subsets: ["latin", "latin-ext"],
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

// Sprint 32: root layout artık yalnızca kabuk (html/body + fontlar). Site
// üst barı ClerkProvider ile birlikte app/(main)/layout.tsx'e taşındı;
// /widget sayfası iframe içinde bare root layout ile render edilir.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
  <html lang="tr" className={`${manrope.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
