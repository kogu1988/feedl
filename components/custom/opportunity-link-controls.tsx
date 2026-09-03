"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseIcon, Loader2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface LinkableOpportunity {
  id: string;
  title: string;
  companyName: string;
  stage: string;
  dealValue: string;
}

const stageLabels: Record<string, string> = {
  open: "Açık",
  proposal: "Teklif",
  won: "Kazanıldı",
  lost: "Kaybedildi",
};

const formatDealValue = (value: string) =>
  Number(value).toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  });

// Sprint 31: fikir ↔ fırsat bağlama (P3.2). Bağ, gelir skorundaki
// "Açık Fırsat" bileşenini besler; bağ kaldırılınca skor düşer.
export function OpportunityLinkControls({
  postId,
  opportunities,
  linkedIds,
}: {
  postId: string;
  opportunities: LinkableOpportunity[];
  linkedIds: string[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const linked = opportunities.filter((opportunity) =>
    linkedIds.includes(opportunity.id),
  );
  const unlinked = opportunities.filter(
    (opportunity) => !linkedIds.includes(opportunity.id),
  );

  const request = async (
    method: "POST" | "DELETE",
    opportunityId: string,
  ) => {
    setError(null);
    setBusyId(opportunityId);
    try {
      const url =
        method === "POST"
          ? "/api/admin/opportunities/links"
          : `/api/admin/opportunities/links?postId=${postId}&opportunityId=${opportunityId}`;
      const res = await fetch(url, {
        method,
        ...(method === "POST"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postId, opportunityId }),
            }
          : {}),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Bağlama işlemi başarısız.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-2 rounded-md border border-dashed p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <BriefcaseIcon className="size-3.5" aria-hidden="true" />
        Fırsatlar (yalnızca admin)
      </p>
      {linked.length > 0 ? (
        <div className="grid gap-1.5">
          {linked.map((opportunity) => (
            <div
              key={opportunity.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {opportunity.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {opportunity.companyName} ·{" "}
                  {stageLabels[opportunity.stage] ?? opportunity.stage} ·{" "}
                  {formatDealValue(opportunity.dealValue)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busyId === opportunity.id || isPending}
                onClick={() => void request("DELETE", opportunity.id)}
                aria-label={`${opportunity.title} bağlantısını kaldır`}
              >
                {busyId === opportunity.id ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <XIcon className="size-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Bu fikre bağlı fırsat yok — açık/teklif fırsatları skoru artırır.
        </p>
      )}
      {unlinked.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" disabled={isPending}>
                {isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                Fırsat bağla
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="max-h-64 overflow-auto">
            <DropdownMenuRadioGroup
              value=""
              onValueChange={(value) => void request("POST", value)}
            >
              {unlinked.map((opportunity) => (
                <DropdownMenuRadioItem key={opportunity.id} value={opportunity.id}>
                  {opportunity.title} — {opportunity.companyName}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
