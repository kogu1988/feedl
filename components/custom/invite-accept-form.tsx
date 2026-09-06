"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Sprint 48j — davet kabul formu (Suspense içinde kullanılır).
export function InviteAcceptForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const accept = async () => {
    if (!token) {
      setStatus("error");
      setError("Davet bağlantısı geçersiz.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 401) {
          window.location.href = `/sign-in?redirect_url=${encodeURIComponent(`/invites/accept?token=${token}`)}`;
          return;
        }
        setStatus("error");
        setError(json.error ?? "Davet kabul edilemedi.");
        return;
      }
      setStatus("success");
      startTransition(() => {
        setTimeout(() => router.push("/dashboard"), 1200);
      });
    } catch {
      setStatus("error");
      setError("Bağlantı hatası.");
    }
  };

  useEffect(() => {
    // token, URL'den (searchParams) gelir ve mount sonrası değişmez; accept
    // yalnızca ilk yüklemede çağrılır. Deps'i bırakmak bilinçli — tek seferlik.
    if (token) void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md rounded-lg border p-6 text-center">
      <h1 className="text-xl font-bold">Çalışma Alanı Daveti</h1>
      {status === "loading" ? (
        <p className="mt-3 text-sm text-muted-foreground">Kabul ediliyor…</p>
      ) : status === "success" ? (
        <div className="mt-4">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Davet kabul edildi. Yönlendiriliyorsun…
          </p>
          <Link href="/dashboard" className="mt-2 inline-block text-sm text-primary hover:underline">
            Şimdi dashboard&apos;a git
          </Link>
        </div>
      ) : status === "error" ? (
        <div className="mt-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void accept()}>
            Tekrar Dene
          </Button>
        </div>
      ) : null}
    </div>
  );
}
