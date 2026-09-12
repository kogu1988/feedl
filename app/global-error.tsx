"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// 2026-09-12 (kod incelemesi #7) — kök hata sınırı (App Router `global-error`).
//
// Neden: yakalanmayan render hatalarında Next varsayılan hata sayfasını
// gösteriyordu (markasız, İngilizce) ve hata Sentry'ye raporlanmıyordu.
//
// ÖNEMLİ: `global-error` kök layout'un YERİNE geçer → app/layout.tsx (ve onun
// globals.css import'u) devrede olmayabilir. Bu yüzden stil için Tailwind
// sınıfı DEĞİL, satır içi stil kullanılır; görünüm CSS'ten bağımsız çalışır.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          color: "#0f172a",
          backgroundColor: "#f8fafc",
        }}
      >
        <main
          style={{
            maxWidth: "440px",
            width: "100%",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            backgroundColor: "#ffffff",
            padding: "24px",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
            Bir şeyler ters gitti
          </h1>
          <p
            style={{
              marginTop: "8px",
              fontSize: "14px",
              lineHeight: 1.6,
              color: "#475569",
            }}
          >
            Beklenmeyen bir hata oluştu ve kaydı teknik ekibe iletildi. Sayfayı
            yeniden deneyebilirsin.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "8px",
                fontSize: "12px",
                color: "#94a3b8",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              }}
            >
              Hata kodu: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "20px",
              border: "none",
              borderRadius: "8px",
              backgroundColor: "#ff5c35",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 600,
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
