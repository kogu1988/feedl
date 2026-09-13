"use client";

// Sprint 70.3 — tek sorumluluk: OpportunityFormDialog.
import { useState } from "react";
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { stageLabels } from "./shared";
import type { CompanyView, OpportunityView } from "./shared";

export function OpportunityFormDialog({
  mode,
  company,
  opportunity,
  onSuccess,
}: {
  mode: "create" | "edit";
  company: CompanyView;
  opportunity?: OpportunityView;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [stage, setStage] = useState("open");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefill = () => {
    setTitle(opportunity?.title ?? "");
    setDealValue(opportunity?.dealValue ?? "");
    setStage(opportunity?.stage ?? "open");
    setExpectedCloseDate(opportunity?.expectedCloseDate ?? "");
    setNotes(opportunity?.notes ?? "");
    setError(null);
  };

  const submit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Fırsat başlığı gerekli.");
      return;
    }
    const trimmedDeal = dealValue.trim();
    const dealValueNum = trimmedDeal === "" ? null : Number(trimmedDeal);
    if (
      dealValueNum !== null &&
      (!Number.isFinite(dealValueNum) || dealValueNum < 0)
    ) {
      setError("Fırsat değeri geçerli bir sayı olmalı.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/opportunities", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          ...(mode === "edit" && opportunity ? { id: opportunity.id } : {}),
          title: trimmedTitle,
          dealValue: dealValueNum,
          stage,
          ...(expectedCloseDate ? { expectedCloseDate } : {}),
          notes: notes.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Fırsat kaydedilemedi.");
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
            <Button variant="outline" size="sm">
              <PlusIcon className="size-4" aria-hidden="true" />
              Fırsat Ekle
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
            {mode === "create" ? "Fırsat Ekle" : "Fırsatı Düzenle"}
          </DialogTitle>
          <DialogDescription>
            {company.name} için satış fırsatı — değer ve tarih opsiyoneldir.
            Açık/teklif aşamasındaki fırsatlar gelir skorunu artırır.
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
            <label htmlFor={`opportunity-title-${mode}`} className="text-sm font-medium">
              Başlık
            </label>
            <Input
              id={`opportunity-title-${mode}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              placeholder="Örn. Yıllık plan yenileme"
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor={`opportunity-value-${mode}`}
              className="text-sm font-medium"
            >
              Fırsat Değeri (opsiyonel)
            </label>
            <Input
              id={`opportunity-value-${mode}`}
              type="number"
              min={0}
              step="0.01"
              value={dealValue}
              onChange={(event) => setDealValue(event.target.value)}
              placeholder="0"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor={`opportunity-stage-${mode}`} className="text-sm font-medium">
              Aşama
            </label>
            <select
              id={`opportunity-stage-${mode}`}
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {Object.entries(stageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label
              htmlFor={`opportunity-date-${mode}`}
              className="text-sm font-medium"
            >
              Beklenen Kapanış (opsiyonel)
            </label>
            <Input
              id={`opportunity-date-${mode}`}
              type="date"
              value={expectedCloseDate}
              onChange={(event) => setExpectedCloseDate(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label
              htmlFor={`opportunity-notes-${mode}`}
              className="text-sm font-medium"
            >
              Not (opsiyonel)
            </label>
            <Textarea
              id={`opportunity-notes-${mode}`}
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              placeholder="Fırsat hakkında not"
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

// Sprint 30: müşteri şirket yönetimi (P3.1). Şirket CRUD + üye yönetimi tek
// bileşende; tüm işlemler fetch + router.refresh() ile sunucu verisini tazeler.
