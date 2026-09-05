"use client";

import { useRef, useState } from "react";
import { UploadIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Sprint 59/62 (madde — import): Dashboard'daki "CSV İçe Aktar" + "Canny'den
// İçe Aktar" butonları. Dosya seç → multipart POST /api/admin/import →
// sonuç göster. `format=csv` export CSV başlıklarını, `format=canny` Canny
// export CSV başlıklarını (name/headline/body/state/category) eşler.
export function ImportCsvButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<"csv" | "canny">("csv");
  const [result, setResult] = useState<{
    created: number;
    skippedDuplicates: number;
    errors: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openPicker(f: "csv" | "canny") {
    setFormat(f);
    setError(null);
    inputRef.current?.click();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("format", format);
      const res = await fetch("/api/admin/import", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "İçe aktarılamadı. Lütfen tekrar deneyin.");
        return;
      }
      setResult({
        created: json.data?.created ?? 0,
        skippedDuplicates: json.data?.skippedDuplicates ?? 0,
        errors: (json.data?.errors ?? []).length,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "İçe aktarılamadı. Lütfen tekrar deneyin.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => openPicker("csv")} disabled={busy}>
        {busy && format === "csv" ? (
          <Loader2Icon className="animate-spin" aria-hidden="true" />
        ) : (
          <UploadIcon aria-hidden="true" />
        )}
        CSV İçe Aktar
      </Button>
      <Button variant="outline" onClick={() => openPicker("canny")} disabled={busy}>
        {busy && format === "canny" ? (
          <Loader2Icon className="animate-spin" aria-hidden="true" />
        ) : (
          <UploadIcon aria-hidden="true" />
        )}
        Canny&apos;den İçe Aktar
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {result && (
        <span className="text-sm text-emerald-600 dark:text-emerald-400">
          {result.created} eklendi
          {result.skippedDuplicates > 0 ? ` · ${result.skippedDuplicates} atlandı (tekrar)` : ""}
          {result.errors > 0 ? ` · ${result.errors} hata` : ""}
        </span>
      )}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
