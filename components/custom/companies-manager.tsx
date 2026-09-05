"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  UserPlusIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/custom/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface CompanyMemberView {
  id: string;
  userId: string;
  jobTitle: string | null;
  userName: string;
  userEmail: string;
}

export interface CompanyView {
  id: string;
  name: string;
  domain: string | null;
  mrr: string | null;
  status: string;
  renewalDate: string | null;
  segment: string | null;
  notes: string | null;
  members: CompanyMemberView[];
}

export interface UserOption {
  id: string;
  label: string;
}

export interface OpportunityView {
  id: string;
  companyId: string;
  title: string;
  dealValue: string;
  stage: string;
  expectedCloseDate: string | null;
  notes: string | null;
}

// Sprint 31: aşama etiketleri — gelir skoru yalnızca open/proposal sayar.
const stageLabels: Record<string, string> = {
  open: "Açık",
  proposal: "Teklif",
  won: "Kazanıldı",
  lost: "Kaybedildi",
};

const stageBadgeClasses: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  proposal:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  lost: "bg-muted text-muted-foreground",
};

const mrrFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 2,
});

// Sprint 30: şirket oluştur/düzenle formu — aynı dialog iki modu paylaşır;
// alanlar dialog her açılışta props'tan tazelenir.
function CompanyFormDialog({
  mode,
  company,
  onSuccess,
}: {
  mode: "create" | "edit";
  company?: CompanyView;
  onSuccess: () => void;
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
          mrr: mrrValue,
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
            />
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
function AddMemberDialog({
  company,
  userOptions,
  onSuccess,
}: {
  company: CompanyView;
  userOptions: UserOption[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberIds = new Set(company.members.map((member) => member.userId));
  const available = userOptions.filter((option) => !memberIds.has(option.id));

  const submit = async () => {
    if (!userId) {
      setError("Kullanıcı seç.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/companies/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          userId,
          jobTitle: jobTitle.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Üye eklenemedi.");
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
          setUserId("");
          setJobTitle("");
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <UserPlusIcon className="size-4" aria-hidden="true" />
            Üye Ekle
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Üye Ekle</DialogTitle>
          <DialogDescription>
            En az bir kullanıcı seçip ünvanını gir. Ünvan opsiyoneldir.
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
            <label htmlFor="member-user" className="text-sm font-medium">
              Kullanıcı
            </label>
            <select
              id="member-user"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              disabled={available.length === 0}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">
                {available.length === 0
                  ? "Eklenecek kullanıcı kalmadı"
                  : "Kullanıcı seç"}
              </option>
              {available.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="member-job-title" className="text-sm font-medium">
              Ünvan (opsiyonel)
            </label>
            <Input
              id="member-job-title"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              maxLength={120}
              placeholder="Örn. CTO"
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
              Ekle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Sprint 31: fırsat ekle/düzenle formu — CompanyFormDialog ile aynı iki-mod
// dialog deseni; alanlar dialog her açılışta props'tan tazelenir.
function OpportunityFormDialog({
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
export function CompaniesManager({
  items,
  userOptions,
  opportunities,
}: {
  items: CompanyView[];
  userOptions: UserOption[];
  opportunities: OpportunityView[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const refresh = () => startTransition(() => router.refresh());
  const busy = isPending || busyId !== null;

  const deleteCompany = async (id: string) => {
    if (!window.confirm("Şirket ve tüm üyeleri silinecek. Emin misin?")) {
      return;
    }
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

  const deleteOpportunity = async (id: string) => {
    if (!window.confirm("Fırsat ve fikir bağları silinecek. Emin misin?")) {
      return;
    }
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
        <CompanyFormDialog mode="create" onSuccess={refresh} />
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
                  />
                  <AddMemberDialog
                    company={company}
                    userOptions={userOptions}
                    onSuccess={refresh}
                  />
                  <OpportunityFormDialog
                    mode="create"
                    company={company}
                    onSuccess={refresh}
                  />
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
                              className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
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
    </div>
  );
}
