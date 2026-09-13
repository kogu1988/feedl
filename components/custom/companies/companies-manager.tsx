"use client";

// Sprint 70.3 — tek sorumluluk: CompaniesManager.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PencilIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/custom/empty-state";
import { useConfirm } from "@/components/custom/confirm-dialog";
import { ProFeatureLock } from "@/components/custom/pro";
import { Input } from "@/components/ui/input";
import { stageLabels, stageBadgeClasses, mrrFormatter } from "./shared";
import type { CompanyView, UserOption, OpportunityView } from "./shared";

// Tip tanımları artık `./shared`'da; eski import yolu (bu modül) korunur.
export type { CompanyView, UserOption, OpportunityView } from "./shared";
import { CompanyFormDialog } from "./company-form-dialog";
import { AddMemberDialog } from "./add-member-dialog";
import { OpportunityFormDialog } from "./opportunity-form-dialog";

export function CompaniesManager({
  items,
  userOptions,
  opportunities,
  isPro,
}: {
  items: CompanyView[];
  userOptions: UserOption[];
  opportunities: OpportunityView[];
  // 2026-09-12 (plan matrisi): MRR + fırsatlar Pro. Şirket/üye yönetimi Free
  // (üyelerin oyları dashboard'daki "Müşteri" sayacını besler).
  isPro: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  // Yıkıcı onaylar uygulama içi diyalogla sorulur (window.confirm değil).
  const { confirm, dialog } = useConfirm();

  const refresh = () => startTransition(() => router.refresh());
  const busy = isPending || busyId !== null;

  const deleteCompany = (id: string) => {
    confirm({
      title: "Şirket silinsin mi?",
      description:
        "Şirketin tüm üyeleri ve fikir bağları silinir. İşlem geri alınamaz.",
      confirmLabel: "Şirketi sil",
      onConfirm: () => void performDeleteCompany(id),
    });
  };

  const performDeleteCompany = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/companies?id=${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Şirket silinemedi.");
        return;
      }
      refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteOpportunity = (id: string) => {
    confirm({
      title: "Fırsat silinsin mi?",
      description: "Fırsatın fikir bağları silinir. İşlem geri alınamaz.",
      confirmLabel: "Fırsatı sil",
      onConfirm: () => void performDeleteOpportunity(id),
    });
  };

  const performDeleteOpportunity = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/opportunities?id=${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Fırsat silinemedi.");
        return;
      }
      refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/companies/members?id=${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Üye çıkarılamadı.");
        return;
      }
      refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusyId(null);
    }
  };

  const saveMemberTitle = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/companies/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, jobTitle: editingTitle.trim() }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Ünvan güncellenemedi.");
        return;
      }
      setEditingMemberId(null);
      refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length} şirket — üyelerin oyları, dashboard&apos;da
          &quot;müşteri&quot; sayacını besler.
        </p>
        <CompanyFormDialog mode="create" onSuccess={refresh} isPro={isPro} />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState>
          Henüz şirket yok. Üyeleri bağladıkça &quot;kaç müşteri istedi&quot;
          sayacı kullanılabilir hale gelir.
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {items.map((company) => {
            const companyOpportunities = opportunities.filter(
              (opportunity) => opportunity.companyId === company.id,
            );
            return (
            <li key={company.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{company.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {company.domain ? `${company.domain} · ` : ""}
                    {company.mrr
                      ? `MRR ${mrrFormatter.format(Number(company.mrr))} · `
                      : ""}
                    {company.members.length} üye
                    {company.segment ? ` · ${company.segment}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={
                        company.status === "churned"
                          ? "rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                          : company.status === "at_risk"
                            ? "rounded-md bg-red-100 px-1.5 py-0.5 text-xs text-red-800 dark:bg-red-500/15 dark:text-red-300"
                            : "rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                      }
                    >
                      {company.status === "churned"
                        ? "Kaybedildi"
                        : company.status === "at_risk"
                          ? "Risk altında"
                          : "Aktif"}
                    </span>
                    {company.renewalDate ? (
                      <span className="text-xs text-muted-foreground">
                        Yenileme: {company.renewalDate}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <CompanyFormDialog
                    mode="edit"
                    company={company}
                    onSuccess={refresh}
                    isPro={isPro}
                  />
                  <AddMemberDialog
                    company={company}
                    userOptions={userOptions}
                    onSuccess={refresh}
                  />
                  {isPro ? (
                    <OpportunityFormDialog
                      mode="create"
                      company={company}
                      onSuccess={refresh}
                    />
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void deleteCompany(company.id)}
                    disabled={busy}
                    className="text-destructive hover:text-destructive"
                  >
                    {busyId === company.id ? (
                      <Loader2Icon
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <TrashIcon className="size-4" aria-hidden="true" />
                    )}
                    Sil
                  </Button>
                </div>
              </div>

              {company.notes ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {company.notes}
                </p>
              ) : null}

              {isPro ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Fırsatlar
                  </p>
                {companyOpportunities.length === 0 ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Bu şirkete henüz fırsat eklenmedi.
                  </p>
                ) : (
                  <ul className="mt-1.5 divide-y rounded-md border">
                    {companyOpportunities.map((opportunity) => (
                      <li
                        key={opportunity.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {opportunity.title}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                                stageBadgeClasses[opportunity.stage] ??
                                stageBadgeClasses.open
                              }`}
                            >
                              {stageLabels[opportunity.stage] ??
                                opportunity.stage}
                            </span>
                            <span>
                              {mrrFormatter.format(
                                Number(opportunity.dealValue ?? "0"),
                              )}
                            </span>
                            {opportunity.expectedCloseDate ? (
                              <span>
                                Kapanış: {opportunity.expectedCloseDate}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <OpportunityFormDialog
                            mode="edit"
                            company={company}
                            opportunity={opportunity}
                            onSuccess={refresh}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void deleteOpportunity(opportunity.id)
                            }
                            disabled={busy}
                            className="text-destructive hover:text-destructive"
                          >
                            {busyId === opportunity.id ? (
                              <Loader2Icon
                                className="size-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <TrashIcon className="size-4" aria-hidden="true" />
                            )}
                            Sil
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  )}
                </div>
              ) : (
                /* Free: fırsatlar Pro (2026-09-12). Liste ve "Fırsat Ekle"
                   kontrolü hiç render edilmez; API de kapılı. */
                <div className="mt-3 max-w-sm">
                  <ProFeatureLock
                    compact
                    title="Fırsatlar Pro planda"
                    description="Açık fırsat değerini fikre bağla; gelir skoru bu veriyle hesaplanır."
                  />
                </div>
              )}

              {company.members.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Bu şirkete henüz üye eklenmedi.
                </p>
              ) : (
                <ul className="mt-3 divide-y rounded-md border">
                  {company.members.map((member) => (
                    <li
                      key={member.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{member.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.userEmail}
                        </p>
                      </div>
                      {editingMemberId === member.id ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={editingTitle}
                            onChange={(event) =>
                              setEditingTitle(event.target.value)
                            }
                            maxLength={120}
                            placeholder="Ünvan"
                            className="h-8 w-40 text-xs"
                          />
                          <Button
                            size="sm"
                            onClick={() => void saveMemberTitle(member.id)}
                            disabled={busy}
                          >
                            Kaydet
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingMemberId(null)}
                            disabled={busy}
                          >
                            İptal
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {member.jobTitle ?? "Ünvan yok"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingMemberId(member.id);
                              setEditingTitle(member.jobTitle ?? "");
                            }}
                            disabled={busy}
                          >
                            <PencilIcon className="size-4" aria-hidden="true" />
                            Ünvan
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void removeMember(member.id)}
                            disabled={busy}
                            className="text-destructive hover:text-destructive"
                          >
                            {busyId === member.id ? (
                              <Loader2Icon
                                className="size-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <TrashIcon className="size-4" aria-hidden="true" />
                            )}
                            Çıkar
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
            );
            })}
        </ul>
      )}
      {dialog}
    </div>
  );
}
