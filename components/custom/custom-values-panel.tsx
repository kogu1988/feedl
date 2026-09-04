"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomFieldView } from "@/components/custom/custom-fields-manager";

// Sprint 42 (PM raporu §8.5) — fikir detay sayfasındaki özel alan değerleri.
// editable=true (admin): her alan türü için uygun giriş + kaydet;
// editable=false (herkes): yalnızca show_on_portal alanlar salt okunur.

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

type ValueState = Record<string, string>;

export function CustomValuesPanel({
  postId,
  fields,
  initialValues,
  editable,
}: {
  postId: string;
  fields: CustomFieldView[];
  initialValues: ValueState;
  editable: boolean;
}) {
  const [values, setValues] = useState<ValueState>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setValue(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    setSaved(false);
  }

  function validateRequired(): string | null {
    for (const field of fields) {
      if (field.required && !(values[field.id] ?? "").trim()) {
        return `"${field.name}" alanı zorunlu.`;
      }
    }
    return null;
  }

  async function save() {
    setError(null);
    const requiredError = validateRequired();
    if (requiredError) {
      setError(requiredError);
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      for (const field of fields) {
        body[field.id] = values[field.id] ?? "";
      }
      const res = await fetch(`/api/admin/posts/${postId}/custom-values`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: body }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Kaydedilemedi. Lütfen tekrar deneyin.");
        return;
      }
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kaydedilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {fields.map((field) => {
        const value = values[field.id] ?? "";
        return (
          <div key={field.id} className="grid gap-1.5">
            <Label htmlFor={`cfv-${field.id}`}>
              {field.name}
              {field.required && (
                <span className="ml-1 text-destructive" aria-hidden="true">
                  *
                </span>
              )}
            </Label>

            {editable ? (
              field.fieldType === "select" ? (
                <select
                  id={`cfv-${field.id}`}
                  className={selectClassName}
                  value={value}
                  onChange={(e) => setValue(field.id, e.target.value)}
                >
                  <option value="" disabled={field.required}>
                    {field.required ? "Seçin" : "—"}
                  </option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={`cfv-${field.id}`}
                  type={
                    field.fieldType === "number"
                      ? "number"
                      : field.fieldType === "date"
                        ? "date"
                        : "text"
                  }
                  value={value}
                  onChange={(e) => setValue(field.id, e.target.value)}
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                {value.trim() ? value : "—"}
              </p>
            )}
          </div>
        );
      })}

      {editable && (
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving}>
            {saving && (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            )}
            Değerleri Kaydet
          </Button>
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Kaydedildi.
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
