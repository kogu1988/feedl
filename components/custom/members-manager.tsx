"use client";

import { useState } from "react";
import { Loader2Icon, MailIcon, TrashIcon, UserPlusIcon } from "lucide-react";

import { Notice } from "@/components/custom/notice";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// Sprint 48c-2 (madde 8) — üye/rol matrisi. Üye ekle (var olan Clerk
// kullanıcısı), rol değiştir (owner/admin/member), çıkar (son owner
// kaldırılamaz — API engeller).

export interface MemberView {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member" | "contributor";
  createdAt: Date;
  name: string | null;
  email: string;
}

export interface MemberUserOption {
  id: string;
  label: string;
}

const roleLabels: Record<string, string> = {
  owner: "Sahip",
  admin: "Yönetici",
  member: "Üye",
  contributor: "Katkıcı",
};

const roleOptions = [
  { value: "owner", label: "Sahip" },
  { value: "admin", label: "Yönetici" },
  { value: "member", label: "Üye" },
  { value: "contributor", label: "Katkıcı" },
] as const;

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export function MembersManager({
  initial,
  userOptions,
}: {
  initial: MemberView[];
  userOptions: MemberUserOption[];
}) {
  const [members, setMembers] = useState<MemberView[]>(initial);
  const [addedUserId, setAddedUserId] = useState("");
  const [addedRole, setAddedRole] = useState<"member" | "admin" | "owner">("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);

  async function refresh() {
    const res = await fetch("/api/admin/members", { cache: "no-store" });
    const json = await res.json();
    if (json.success) setMembers(json.data);
  }

  async function invite() {
    setError(null);
    if (!inviteEmail.trim()) {
      setError("Davet e-postası gerekli.");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Davet gönderilemedi.");
        return;
      }
      setInviteEmail("");
      setError("Davet e-postası gönderildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Davet gönderilemedi.");
    } finally {
      setInviting(false);
    }
  }

  async function add() {
    setError(null);
    if (!addedUserId) {
      setError("Bir kullanıcı seç.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addedUserId, role: addedRole }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Üye eklenemedi.");
        return;
      }
      setAddedUserId("");
      setAddedRole("member");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Üye eklenemedi.");
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(userId: string, role: string) {
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Rol güncellenemedi.");
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(userId: string) {
    if (!window.confirm("Bu üyeyi workspace'ten çıkar? Emin misin?")) return;
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members?userId=${userId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Üye çıkarılamadı.");
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{members.length} üye</p>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger render={<Button />}>
              <UserPlusIcon aria-hidden="true" />
              Üye Ekle
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Üye Ekle</DialogTitle>
                <DialogDescription>
                  Var olan bir kullanıcıyı workspace&apos;e ekle.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="member-user">Kullanıcı</Label>
                  <select
                    id="member-user"
                    className={selectClassName}
                    value={addedUserId}
                    onChange={(e) => setAddedUserId(e.target.value)}
                  >
                    <option value="">Kullanıcı seç</option>
                    {userOptions.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="member-role">Rol</Label>
                  <select
                    id="member-role"
                    className={selectClassName}
                    value={addedRole}
                    onChange={(e) =>
                      setAddedRole(e.target.value as "owner" | "admin" | "member")
                    }
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={add} disabled={adding}>
                  {adding && (
                    <Loader2Icon className="animate-spin" aria-hidden="true" />
                  )}
                  Ekle
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>
              <MailIcon aria-hidden="true" />
              Davet Gönder
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Davet Gönder</DialogTitle>
                <DialogDescription>
                  E-posta ile yeni üye davet et — 7 gün geçerli.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">E-posta</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="ornek@firma.com"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Rol</Label>
                  <select
                    id="invite-role"
                    className={selectClassName}
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="member">Üye</option>
                    <option value="contributor">Katkıcı</option>
                    <option value="admin">Yönetici</option>
                    <option value="owner">Sahip</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={invite} disabled={inviting}>
                  {inviting && (
                    <Loader2Icon className="animate-spin" aria-hidden="true" />
                  )}
                  Davet Gönder
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <Notice>
          {error}
        </Notice>
      )}

      <ul className="divide-y rounded-lg border">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {member.name ?? member.email}
              </p>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </div>
            <select
              value={member.role}
              disabled={busyId === member.userId}
              onChange={(e) => void changeRole(member.userId, e.target.value)}
              aria-label={`${member.email} rolü`}
              className="h-8 w-[130px] rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Üyeyi çıkar"
              disabled={busyId === member.userId}
              onClick={() => void remove(member.userId)}
            >
              <TrashIcon aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
