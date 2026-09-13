"use client";

// Sprint 70.3 — tek sorumluluk: CompanyFormDialog.
import { useState } from "react";
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyView } from "./shared";

export function CompanyFormDialog({
  mode,
  company,
  onSuccess,
  isPro,
}: {
  mode: "create" | "edit";
  company?: CompanyView;
  onSuccess: () => void;
  // 2026-09-12 (plan matrisi): MRR girişi Pro. Free'de alan kapalı ve
  // gönderime HİÇ eklenmez (mevcut MRR korunur — silinmez).
  isPro: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [mrr, setMrr] = useState("");
  const [status, setStatus] = useState("active");
  const [renewalDate, setRenewalDate] = useState("");
  const [segment, setSegment] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefill = () => {
    setName(company?.name ?? "");
    setDomain(company?.domain ?? "");
    setMrr(company?.mrr ?? "");
    setStatus(company?.status ?? "active");
    setRenewalDate(company?.renewalDate ?? "");
    setSegment(company?.segment ?? "");
    setNotes(company?.notes ?? "");
    setError(null);
  };

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Şirket adı gerekli.");
      return;
    }
    const trimmedMrr = mrr.trim();
    const mrrValue = trimmedMrr === "" ? null : Number(trimmedMrr);
    if (mrrValue !== null && (!Number.isFinite(mrrValue) || mrrValue < 0)) {
      setError("MRR geçerli bir sayı olmalı.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/companies", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "edit" && company ? { id: company.id } : {}),
          name: trimmedName,
          domain: domain.trim() || undefined,
          // Free'de MRR alanı yok sayılır: alan hiç gönderilmez, PATCH mevcut
          // değeri KORUR (silmez). Kapı zaten yalnız pozitif MRR yazımını
          // engeller (app/api/admin/companies/route.ts).
          ...(isPro ? { mrr: mrrValue } : {}),
          status,
          renewalDate: renewalDate || undefined,
          segment: segment.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Şirket kaydedilemedi.");
        return;
      }
      setOpen(false);
      onSuccess();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          prefill();
        }
      }}
    >
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button>
              <PlusIcon className="size-4" aria-hidden="true" />
              Yeni Şirket
            </Button>
          ) : (
            <Button variant="ghost" size="sm">
              <PencilIcon className="size-4" aria-hidden="true" />
              Düzenle
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Yeni Şirket" : "Şirketi Düzenle"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Müşteri şirketi ekle — domain, MRR ve notlar opsiyoneldir."
              : "Şirket bilgilerini güncelle."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="grid gap-4"
        >
          <div className="grid gap-2">
            <label htmlFor={`company-name-${mode}`} className="text-sm font-medium">
              Ad
            </label>
            <Input
              id={`company-name-${mode}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="Örn. Acme Yazılım"
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor={`company-domain-${mode}`}
              className="text-sm font-medium"
            >
              Domain (opsiyonel)
            </label>
            <Input
              id={`company-domain-${mode}`}
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              maxLength={200}
              placeholder="acme.com"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor={`company-mrr-${mode}`} className="text-sm font-medium">
              MRR (opsiyonel)
            </label>
            <Input
              id={`company-mrr-${mode}`}
              type="number"
              min={0}
              step="0.01"
              value={mrr}
              onChange={(event) => setMrr(event.target.value)}
              placeholder="0"
              disabled={!isPro}
            />
            {!isPro ? (
              <p className="text-xs text-muted-foreground">
                MRR bağlamı Pro planda girilir; gelir skorunu besler.
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <label htmlFor={`company-status-${mode}`} className="text-sm font-medium">
              Durum
            </label>
            <select
              id={`company-status-${mode}`}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              <option value="active">Aktif</option>
              <option value="at_risk">Risk altında</option>
              <option value="churned">Kaybedildi</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor={`company-renewal-${mode}`} className="text-sm font-medium">
              Yenileme tarihi (opsiyonel)
            </label>
            <Input
              id={`company-renewal-${mode}`}
              type="date"
              value={renewalDate}
              onChange={(event) => setRenewalDate(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor={`company-segment-${mode}`} className="text-sm font-medium">
              Segment (opsiyonel)
            </label>
            <Input
              id={`company-segment-${mode}`}
              value={segment}
              onChange={(event) => setSegment(event.target.value)}
              maxLength={40}
              placeholder="Kurumsal"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor={`company-notes-${mode}`} className="text-sm font-medium">
              Not (opsiyonel)
            </label>
            <Textarea
              id={`company-notes-${mode}`}
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              placeholder="Şirket hakkında not"
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Sprint 30: şirkete üye ekleme — kullanıcı seçici (native select) + ünvan.
// Zaten üye olan kullanıcılar listeden çıkarılır; sunucu yine duplicate'e
// karşı korur.
