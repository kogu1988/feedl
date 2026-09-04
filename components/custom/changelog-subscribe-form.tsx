"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Sprint 40: changelog abonelik kutusu — anonim ziyaretçiler dahil herkes
// e-posta ile yeni duyurulara abone olabilir (Canny changelog modeli).
// Girişli kullanıcıya e-posta alanı sunucudan ön-dolu gelir.
export function ChangelogSubscribeForm({
  defaultEmail,
}: {
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      const res = await fetch("/api/changelog/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: { alreadySubscribed?: boolean };
      };

      if (!res.ok || !json.success) {
        setIsError(true);
        setMessage(json.error ?? "Abonelik kaydedilemedi. Lütfen tekrar deneyin.");
        return;
      }

      if (json.data?.alreadySubscribed) {
        setMessage("Bu e-posta zaten abone.");
      } else {
        setDone(true);
        setMessage("Abone olundu. Yeni duyurular e-posta ile gönderilecek.");
      }
    } catch {
      setIsError(true);
      setMessage("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
        {message}
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3"
    >
      <Input
        type="email"
        required
        placeholder="E-posta adresiniz"
        aria-label="E-posta adresiniz"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={submitting}
      />
      <Button type="submit" disabled={submitting}>
        Abone Ol
      </Button>
      {message ? (
        <p
          className={`text-sm sm:col-span-2 ${
            isError ? "text-destructive" : "text-muted-foreground"
          }`}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
