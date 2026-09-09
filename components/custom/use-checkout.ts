"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

import { getPlanEnv } from "@/components/custom/plan-config";
import { pollProActivation } from "@/components/custom/billing-activation";

// PricingManager ve BillingOverview'daki Paddle checkout akışını TEK yerde toplar.
// Amaç: "Ödeme kutusu yükleniyor…", "Ödeme tamamlanmadı…" gibi amatör metinleri
// profesyonel durumlar (loading/processing/success/error/closed) ile değiştirmek.
// checkout.completed sonrası webhook'u bekleyip Pro olunca yenile; kapama
// uyarısı SADECE ödeme tamamlanmadıysa gösterilir (başarılı ödemeden sonra "iptal
// edildi" gibi yanlış hata görünmesin).

const env = getPlanEnv();
const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";

export type CheckoutTone = "idle" | "loading" | "processing" | "success" | "error" | "closed";

export interface CheckoutStatus {
  tone: CheckoutTone;
  message: string;
}

export interface UseCheckoutOptions {
  paddleCustomerId?: string | null;
  // P0-2: checkout'ta workspace'i immutable UUID ile eşleştir.
  workspaceId?: string | null;
  workspaceSlug: string;
}

export function useCheckout(opts: UseCheckoutOptions) {
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [status, setStatus] = useState<CheckoutStatus>({ tone: "idle", message: "" });
  const completedRef = useRef(false);
  const { paddleCustomerId, workspaceId, workspaceSlug } = opts;

  // Paddle'ı kur. customerId yüklenince (null → id) yeniden kurulur; bu,
  // eksik `paddleCustomerId` bağımlılığı uyarısını da giderir (Retain için).
  useEffect(() => {
    if (!clientToken) return;
    let cancelled = false;
    initializePaddle({
      environment: env === "sandbox" ? "sandbox" : undefined,
      token: clientToken,
      ...(paddleCustomerId ? { pwCustomer: { id: paddleCustomerId } } : {}),
      eventCallback: (event) => {
        if (cancelled) return;
        if (event.name === "checkout.completed") {
          // Ödeme TAMAMLANDI → kapatma event'i gelse bile hata gösterilmez.
          completedRef.current = true;
          void handleCompleted();
        } else if (event.name === "checkout.closed") {
          if (!completedRef.current) {
            setStatus({
              tone: "closed",
              message: "Ödeme penceresi kapatıldı. Dilediğinde tekrar deneyebilirsin.",
            });
          }
        }
      },
    })
      .then((p) => {
        if (!cancelled) setPaddle(p);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ tone: "error", message: "Paddle yüklenemedi. Lütfen sayfayı yenile." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [paddleCustomerId]);

  async function handleCompleted() {
    setStatus({
      tone: "processing",
      message: "Ödemeniz alındı. Pro aktivasyonu doğrulanıyor…",
    });
    const res = await pollProActivation();
    if (res.activated) {
      setStatus({ tone: "success", message: "Pro aktif! Sayfa güncelleniyor…" });
      window.setTimeout(() => window.location.reload(), 1200);
    } else {
      // Webhook gecikse bile Paddle onay ekranını kaldırıp güncel durumu göster.
      setStatus({ tone: "success", message: "Ödemeniz alındı. Sayfa güncelleniyor…" });
      window.setTimeout(() => window.location.reload(), 2500);
    }
  }

  const openCheckout = useCallback(
    (priceId: string): boolean => {
      if (!paddle) {
        setStatus({ tone: "error", message: "Paddle hazır değil. Lütfen tekrar dene." });
        return false;
      }
      completedRef.current = false;
      setStatus({ tone: "loading", message: "Güvenli ödeme penceresi açılıyor…" });
      try {
        paddle.Checkout.open({
          items: [{ priceId, quantity: 1 }],
          // P0-2: immutable workspace_id (varsa) + slug fallback.
          customData: {
            ...(workspaceId ? { workspace_id: workspaceId } : {}),
            slug: workspaceSlug,
          },
        });
        return true;
      } catch {
        setStatus({ tone: "error", message: "Ödeme penceresi açılamadı. Lütfen tekrar dene." });
        return false;
      }
    },
    [paddle, workspaceId, workspaceSlug],
  );

  const clearStatus = useCallback(() => setStatus({ tone: "idle", message: "" }), []);

  return { paddle, status, openCheckout, clearStatus };
}
