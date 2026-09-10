"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

import { getPlanEnv } from "@/components/custom/plan-config";

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
  // Ödeme tamamlanınca gidilecek yer (girişli kullanıcı → "/dashboard").
  // Verilmezse mevcut sayfa yenilenir (billing kartındaki davranış).
  successRedirect?: string;
}

export function useCheckout(opts: UseCheckoutOptions) {
  const [paddle, setPaddle] = useState<Paddle | undefined>();
  const [status, setStatus] = useState<CheckoutStatus>({ tone: "idle", message: "" });
  const completedRef = useRef(false);
  const { paddleCustomerId, workspaceId, workspaceSlug, successRedirect } = opts;

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
    // Tek seferlik Paddle kurulumu; handleCompleted güncel değerleri ref'ler
    // üzerinden okur (dep'e eklemek Paddle'ı her render'da yeniden başlatırdı).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paddleCustomerId]);

  // Aktivasyon tamamlanınca: hedef varsa oraya git (ör. satın alan girişli
  // kullanıcı dashboard'a), yoksa mevcut sayfayı yenile.
  function finish(message: string, delayMs: number, redirect?: string) {
    setStatus({ tone: "success", message });
    window.setTimeout(() => {
      if (redirect) window.location.assign(redirect);
      else window.location.reload();
    }, delayMs);
  }

  // successRedirect render'lar arası değişebilir; effect tek seferlik Paddle
  // init'i olduğundan callback'in EN GÜNCEL değeri okuması için ref kullanılır
  // (effect bağımlılığına eklemek Paddle'ı gereksiz yeniden başlatırdı).
  const successRedirectRef = useRef(successRedirect);
  successRedirectRef.current = successRedirect;

  async function handleCompleted() {
    setStatus({
      tone: "processing",
      message: "Ödemeniz alındı. Pro aktivasyonu doğrulanıyor…",
    });
    const redirect = successRedirectRef.current;
    const res = await pollProActivation();
    if (res.activated) {
      finish(
        redirect ? "Pro aktif! Yönetim paneline yönlendiriliyorsun…" : "Pro aktif! Sayfa güncelleniyor…",
        1200,
        redirect,
      );
    } else {
      // Webhook gecikse bile Paddle onay ekranını kaldırıp güncel durumu göster.
      finish(
        redirect ? "Ödemeniz alındı. Panele yönlendiriliyorsun…" : "Ödemeniz alındı. Sayfa güncelleniyor…",
        2500,
        redirect,
      );
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

// ─── Billing activation polling (tek dosya: use-checkout) ────────────────
// P0-1: ödeme tamamlandıktan sonra webhook'un DB'ye ulaşıp workspace'i Pro
// yapmasını beklemek yerine `/api/paddle/status` poll edilir. `pollProActivation`
// checkout.completed akışında, `pollPlanChange` in-app aylık↔yıllık geçişinde
// kullanılır (plan değişmez, subscription'ın price_id'si değişimi yansıtır).
const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 14; // ~21s — webhook genelde saniyeler içinde düşer.

export interface ActivationPollResult {
  activated: boolean;
  timeout: boolean;
  plan: string;
  status: string | null;
}

export interface PlanChangePollResult {
  changed: boolean;
  timeout: boolean;
  plan: string;
}

interface StatusSnapshot {
  pro: boolean;
  plan: string;
  status: string | null;
  priceId: string | null;
}

async function readStatus(): Promise<StatusSnapshot | null> {
  try {
    const res = await fetch("/api/paddle/status", { method: "GET", cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      data?: { plan?: string; priceId?: string | null; paddleSubscriptionStatus?: string | null };
    };
    const data = json.data;
    if (!json.success || !data) return null;
    return {
      pro: data.plan === "pro",
      plan: data.plan ?? "free",
      status: data.paddleSubscriptionStatus ?? null,
      priceId: data.priceId ?? null,
    };
  } catch {
    return null;
  }
}

export async function pollProActivation(): Promise<ActivationPollResult> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const s = await readStatus();
    if (s?.pro) {
      return { activated: true, timeout: false, plan: s.plan, status: s.status };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { activated: false, timeout: true, plan: "free", status: null };
}

export async function pollPlanChange(targetPriceId: string): Promise<PlanChangePollResult> {
  if (!targetPriceId) return { changed: true, timeout: false, plan: "pro" };
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const s = await readStatus();
    if (s && s.priceId === targetPriceId) {
      return { changed: true, timeout: false, plan: s.plan };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { changed: false, timeout: true, plan: "pro" };
}
