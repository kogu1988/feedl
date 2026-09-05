"use client";

import { useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";

import { Notice } from "@/components/custom/notice";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Sprint 42 (PM raporu §8.5) — özel alan tanımları yönetimi. Sprint 21
// taksonomi kararı korunur: postType = kategori, tags = serbest etiket;
// custom fields bunlardan bağımsız, admin tanımlı bir katmandır.

export interface CustomFieldView {
  id: string;
  name: string;
  fieldType: "text" | "select" | "number" | "date";
  options: string[] | null;
  required: boolean;
  showOnPortal: boolean;
  displayOrder: number;
}

const typeLabels: Record<CustomFieldView["fieldType"], string> = {
  text: "Metin",
  select: "Seçim listesi",
  number: "Sayı",
  date: "Tarih",
};

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

function toOptions(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function CustomFieldsManager({
  initialFields,
}: {
  initialFields: CustomFieldView[];
}) {
  const [fields, setFields] = useState<CustomFieldView[]>(initialFields);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldView | null>(null);
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldView["fieldType"]>(
    "text",
  );
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);
  const [showOnPortal, setShowOnPortal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/custom-fields", { cache: "no-store" });
    const json = await res.json();
    if (json.success) setFields(json.data);
    return json;
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setFieldType("text");
    setOptionsText("");
    setRequired(false);
    setShowOnPortal(false);
    setInlineError(null);
    setDialogOpen(true);
  }

  function openEdit(field: CustomFieldView) {
    setEditing(field);
    setName(field.name);
    setFieldType(field.fieldType);
    setOptionsText((field.options ?? []).join("\n"));
    setRequired(field.required);
    setShowOnPortal(field.showOnPortal);
    setInlineError(null);
    setDialogOpen(true);
  }

  async function save() {
    setInlineError(null);
    if (!name.trim()) {
      setInlineError("Alan adı gerekli.");
      return;
    }
    if (fieldType === "select" && toOptions(optionsText).length === 0) {
      setInlineError("Seçim listesi için en az bir seçenek gerekir.");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      fieldType,
      options: fieldType === "select" ? toOptions(optionsText) : undefined,
      required,
      showOnPortal,
    };
    try {
      const res = await fetch(
        editing ? `/api/admin/custom-fields/${editing.id}` : "/api/admin/custom-fields",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!json.success) {
        setInlineError(json.error || "Kaydedilemedi. Lütfen tekrar deneyin.");
        return;
      }
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      setInlineError(
        err instanceof Error ? err.message : "Kaydedilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(field: CustomFieldView) {
    if (
      !window.confirm(
        `"${field.name}" alanı ve tüm değerleri silinecek. Emin misin?`,
      )
    ) {
      return;
    }
    setBusyId(field.id);
    try {
      const res = await fetch(`/api/admin/custom-fields/${field.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        setInlineError(json.error || "Alan silinemedi.");
        return;
      }
      await refresh();
    } catch (err) {
      setInlineError(
        err instanceof Error ? err.message : "Alan silinemedi.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function move(field: CustomFieldView, dir: -1 | 1) {
    const idx = fields.findIndex((f) => f.id === field.id);
    const neighbor = fields[idx + dir];
    if (!neighbor) return;
    setBusyId(field.id);
    try {
      // displayOrder alan-bazlı sıralamayı belirler; ikisini takas ederiz.
      await Promise.all([
        fetch(`/api/admin/custom-fields/${field.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: neighbor.displayOrder }),
        }),
        fetch(`/api/admin/custom-fields/${neighbor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: field.displayOrder }),
        }),
      ]);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {fields.length} alan tanımı
        </p>
        <Button onClick={openCreate}>
          <PlusIcon aria-hidden="true" />
          Alan Ekle
        </Button>
      </div>

      {inlineError && (
        <Notice>
          {inlineError}
        </Notice>
      )}

      {fields.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Henüz özel alan yok.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Alan Ekle ile ilk alanını tanımla.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {fields.map((field, idx) => (
            <li key={field.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {field.name}
                  </span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {typeLabels[field.fieldType]}
                  </span>
                  {field.required && (
                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      Zorunlu
                    </span>
                  )}
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {field.showOnPortal ? "Herkese açık" : "Yalnızca admin"}
                  </span>
                </div>
                {field.fieldType === "select" && field.options?.length ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {field.options.slice(0, 4).join(", ")}
                    {field.options.length > 4
                      ? ` +${field.options.length - 4}`
                      : ""}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Yukarı taşı"
                  disabled={idx === 0 || busyId === field.id}
                  onClick={() => move(field, -1)}
                >
                  <ArrowUpIcon aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Aşağı taşı"
                  disabled={idx === fields.length - 1 || busyId === field.id}
                  onClick={() => move(field, 1)}
                >
                  <ArrowDownIcon aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Düzenle"
                  onClick={() => openEdit(field)}
                >
                  <PencilIcon aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sil"
                  disabled={busyId === field.id}
                  onClick={() => remove(field)}
                >
                  {busyId === field.id ? (
                    <Loader2Icon className="animate-spin" aria-hidden="true" />
                  ) : (
                    <TrashIcon aria-hidden="true" />
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Alanı Düzenle" : "Özel Alan Ekle"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Alanın bilgilerini güncelle."
                : "Fikirlere eklenecek yeni bir alan tanımla."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cf-name">Alan adı</Label>
              <Input
                id="cf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Plan, Kullanım alanı"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cf-type">Tür</Label>
              <select
                id="cf-type"
                className={selectClassName}
                value={fieldType}
                onChange={(e) =>
                  setFieldType(
                    e.target.value as CustomFieldView["fieldType"],
                  )
                }
              >
                <option value="text">Metin</option>
                <option value="select">Seçim listesi</option>
                <option value="number">Sayı</option>
                <option value="date">Tarih</option>
              </select>
            </div>

            {fieldType === "select" && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-options">Seçenekler</Label>
                <Textarea
                  id="cf-options"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder={"Seçenek 1\nSeçenek 2\nSeçenek 3"}
                />
                <p className="text-xs text-muted-foreground">
                  satır başına bir seçenek.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="cf-required"
                checked={required}
                onCheckedChange={(checked) => setRequired(checked === true)}
              />
              <Label
                htmlFor="cf-required"
                className="text-sm font-normal"
              >
                Zorunlu (doldurulmadan gönderilemez)
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="cf-portal"
                checked={showOnPortal}
                onCheckedChange={(checked) => setShowOnPortal(checked === true)}
              />
              <Label htmlFor="cf-portal" className="text-sm font-normal">
                Herkese açık (portalda görünür)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Vazgeç
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              )}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
