"use client";

// Sprint 70.3 — tek sorumluluk: AddMemberDialog.
import { useState } from "react";
import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CompanyView, UserOption } from "./shared";

export function AddMemberDialog({
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
