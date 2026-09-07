import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@/components/custom/google-analytics";
import { ogImage } from "@/lib/seo";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app"),
  title: {
    default: "feedl — AI Destekli Müşteri Geri Bildirim Platformu",
    template: "%s · feedl",
  },
  description:
    "Müşteri isteklerini topla, AI ile analiz et, gelir skoruyla önceliklendir ve yayınlanınca herkese duyur. Canny'ye ücretsiz, hosted alternatif.",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app",
    siteName: "feedl",
    title: "feedl — AI Destekli Müşteri Geri Bildirim Platformu",
    description:
      "Müşteri isteklerini veriyle önceliklendir: otomatik sınıflandırma, duygu analizi ve gelir bağlamı tek platformda.",
    images: [ogImage()],
  },
  twitter: {
    card: "summary_large_image",
    title: "feedl — AI Destekli Müşteri Geri Bildirim Platformu",
    description:
      "Müşteri isteklerini veriyle önceliklendir: otomatik sınıflandırma, duygu analizi ve gelir bağlamı tek platformda.",
    images: [ogImage()],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
  },
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
        <SpeedInsights />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
