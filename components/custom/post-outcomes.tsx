"use client";

import { useState } from "react";
import { Loader2Icon, PlusIcon, TrashIcon } from "lucide-react";

import { useConfirm } from "@/components/custom/confirm-dialog";
import { Notice } from "@/components/custom/notice";
import { ProFeatureLock } from "@/components/custom/pro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  OUTCOME_TYPES,
  OUTCOME_TYPE_HINTS,
  OUTCOME_TYPE_LABELS,
  formatRevenueDelta,
  parseRevenueDelta,
  type OutcomeType,
} from "@/lib/post-outcome";

// 2026-09-12 (M6 ürün eksiği) — SONUÇ KAYDI. Ürün "ne yaptık?" sorusunu
// cevaplıyordu; "işe yaradı mı?" cevapsızdı. Yayınlanan bir fikrin gerçekleşen
// sonucu (genişleme / elde tutma / verimlilik + gelir etkisi) burada kaydedilir.
//
// Kararlar:
// - Kayıt İÇSEL bilgidir; portalda (müşteriye açık yüzeyde) GÖSTERİLMEZ —
//   gelir bilgisi public tarafta yer almaz (frontend_plan §14).
// - Gelir etkisi ile "veri yok" AYRI: boş bırakılırsa uydurma `$0` yazılmaz,
//   `—` gösterilir (§19).
// - Yazma Pro; okuma/silme her admine açık (veri kilidi tuzağı olmasın).

export interface PostOutcomeView {
  id: string;
  outcomeType: string;
  /** numeric kolon → string; null = "veri yok". */
  revenueDelta: string | null;
  summary: string;
  evidenceUrl: string | null;
  occurredAt: string | null;
}

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return dateFormatter.format(parsed);
}

function typeLabel(value: string): string {
  return OUTCOME_TYPE_LABELS[value as OutcomeType] ?? value;
}

export function PostOutcomes({
  postId,
  initial,
  isPro,
  postStatus,
}: {
  postId: string;
  initial: PostOutcomeView[];
  isPro: boolean;
  postStatus: string;
}) {
  const [outcomes, setOutcomes] = useState<PostOutcomeView[]>(initial);
  const [outcomeType, setOutcomeType] = useState<OutcomeType>("expansion");
  const [revenue, setRevenue] = useState("");
  const [summary, setSummary] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const total = outcomes.reduce((sum, item) => {
    const value = item.revenueDelta === null ? 0 : Number(item.revenueDelta);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const hasKnownRevenue = outcomes.some(
    (item) =>
      item.revenueDelta !== null && Number.isFinite(Number(item.revenueDelta)),
  );

  async function save() {
    setError(null);
    if (summary.trim().length < 3) {
      setError("Sonucu birkaç kelimeyle açıkla.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/post-outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          outcomeType,
          revenueDelta: revenue.trim() ? revenue.trim() : null,
          summary: summary.trim(),
          evidenceUrl: evidenceUrl.trim() ? evidenceUrl.trim() : null,
          occurredAt: occurredAt || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Sonuç kaydedilemedi.");
        return;
      }
      setOutcomes((current) => [json.data as PostOutcomeView, ...current]);
      setSummary("");
      setRevenue("");
      setEvidenceUrl("");
      setOccurredAt("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sonuç kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  }

  function remove(id: string, label: string) {
    confirm({
      title: "Bu sonuç kaydı silinsin mi?",
      description: `"${label}" kaydı silinir. İşlem geri alınamaz.`,
      confirmLabel: "Kaydı sil",
      onConfirm: () => void performRemove(id),
    });
  }

  async function performRemove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/post-outcomes?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Kayıt silinemedi.");
        return;
      }
      setOutcomes((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt silinemedi.");
    }
  }

  const parsedPreview = revenue.trim() ? parseRevenueDelta(revenue) : null;

  return (
    <div className="grid gap-2 rounded-md border border-dashed p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Sonuç (yalnızca admin)
        </p>
        {hasKnownRevenue ? (
          <p className="text-xs text-muted-foreground">
            Kaydedilen toplam etki:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatRevenueDelta(total)}
            </span>
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Bu fikir yayına girdikten sonra ne oldu?{" "}
        {postStatus === "shipped"
          ? "Gerçekleşen sonucu kaydet — sonraki önceliklendirme bu veriye dayansın."
          : "Fikir henüz yayınlanmadı; sonucu yayına girdikten sonra kaydet."}
      </p>

      {error && <Notice>{error}</Notice>}

      {outcomes.length > 0 ? (
        <ul className="grid gap-2">
          {outcomes.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 p-2.5"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">
                    {typeLabel(item.outcomeType)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {item.revenueDelta === null
                      ? "—"
                      : formatRevenueDelta(item.revenueDelta)}
                  </span>
                  {formatDate(item.occurredAt) ? (
                    <span className="text-muted-foreground">
                      {formatDate(item.occurredAt)}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm">{item.summary}</p>
                {item.evidenceUrl ? (
                  <a
                    href={item.evidenceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-brand underline underline-offset-2"
                  >
                    Kanıt
                  </a>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                aria-label="Sonuç kaydını sil"
                onClick={() => remove(item.id, typeLabel(item.outcomeType))}
              >
                <TrashIcon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
          Henüz sonuç kaydedilmedi.
        </p>
      )}

      {isPro ? (
        <div className="grid gap-3 rounded-md border p-2.5">
          <div className="grid gap-1.5">
            <Label htmlFor="outcome-type">Sonuç türü</Label>
            <select
              id="outcome-type"
              className={selectClassName}
              value={outcomeType}
              onChange={(event) => setOutcomeType(event.target.value as OutcomeType)}
            >
              {OUTCOME_TYPES.map((type) => (
                <option key={type} value={type}>
                  {OUTCOME_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {OUTCOME_TYPE_HINTS[outcomeType]}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="outcome-revenue">Aylık gelir etkisi ($)</Label>
              <Input
                id="outcome-revenue"
                value={revenue}
                onChange={(event) => setRevenue(event.target.value)}
                placeholder="80000"
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground">
                {parsedPreview === null
                  ? "Boş bırakılabilir — bilinmiyorsa uydurma 0 yazılmaz."
                  : `Kaydedilecek: ${formatRevenueDelta(parsedPreview)}`}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="outcome-date">Gerçekleşme tarihi</Label>
              <Input
                id="outcome-date"
                type="date"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="outcome-summary">Ne oldu?</Label>
            <Textarea
              id="outcome-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Örn: 3 müşteri planını yükseltti; yenileme riski kapandı."
              maxLength={2000}
              rows={3}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="outcome-evidence">Kanıt linki (opsiyonel)</Label>
            <Input
              id="outcome-evidence"
              value={evidenceUrl}
              onChange={(event) => setEvidenceUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>

          <Button onClick={save} disabled={saving} className="justify-self-start">
            {saving ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : (
              <PlusIcon aria-hidden="true" />
            )}
            Sonucu kaydet
          </Button>
        </div>
      ) : (
        <ProFeatureLock
          title="Sonuç kaydı Pro"
          description="Yayınlanan işlerin gerçek gelir etkisini kaydet; önceliklendirme tahmin yerine kanıta dayansın."
          compact
        />
      )}

      {dialog}
    </div>
  );
}
