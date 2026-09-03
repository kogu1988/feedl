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
  notes: string | null;
  members: CompanyMemberView[];
}

export interface UserOption {
  id: string;
  label: string;
}

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
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefill = () => {
    setName(company?.name ?? "");
    setDomain(company?.domain ?? "");
    setMrr(company?.mrr ?? "");
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

// Sprint 30: müşteri şirket yönetimi (P3.1). Şirket CRUD + üye yönetimi tek
// bileşende; tüm işlemler fetch + router.refresh() ile sunucu verisini tazeler.
export function CompaniesManager({
  items,
  userOptions,
}: {
  items: CompanyView[];
  userOptions: UserOption[];
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
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Henüz şirket yok. Üyeleri bağladıkça &quot;kaç müşteri istedi&quot;
          sayacı kullanılabilir hale gelir.
        </p>
      ) : (
        <ul className="grid gap-3">
          {items.map((company) => (
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
                  </p>
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
          ))}
        </ul>
      )}
    </div>
  );
}
