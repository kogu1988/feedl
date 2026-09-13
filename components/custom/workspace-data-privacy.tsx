"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";

import { Notice } from "@/components/custom/notice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Denetim #8b — veri taşınabilirliği + silme hakkı (self-servis).
//
// İkisi de OWNER-ONLY'dir (`lib/auth/admin.ts` → getOwnerUserId): dışa aktarım
// müşteri verisinin tamamını içerdiği için toplu sızdırma yüzeyidir, silme ise
// geri alınamaz. Arayüz yetkiyi yalnızca GÖSTERİR; asıl kapı API'dedir.

export function WorkspaceDataPrivacy({
  slug,
  isOwner,
}: {
  slug: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sprint 68 — onboarding'de üretilmiş ÖRNEK veri var mı? Varsa silme kartı
  // gösterilir. Sorgu yalnız bir kez (mount) yapılır.
  const [samplePresent, setSamplePresent] = useState(false);
  const [removingSample, setRemovingSample] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/sample-data")
      .then((r) => r.json())
      .then((j) => {
        if (active && j?.success) setSamplePresent(Boolean(j.data?.present));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function removeSample() {
    setError(null);
    setRemovingSample(true);
    try {
      const res = await fetch("/api/admin/sample-data", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Örnek veriler silinemedi.");
        return;
      }
      setSamplePresent(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Örnek veriler silinemedi.",
      );
    } finally {
      setRemovingSample(false);
    }
  }

  function download() {
    setError(null);
    setExporting(true);
    // `Content-Disposition: attachment` → sayfa değişmez, indirme başlar.
    window.location.assign("/api/admin/data-export");
    // İndirmenin bittiğini tarayıcıdan öğrenmenin güvenilir bir yolu yok; kısa
    // süre sonra butonu eski hâline döndür (kalıcı "takıldı" hissi olmasın).
    window.setTimeout(() => setExporting(false), 1500);
  }

  async function remove() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/workspace", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Workspace silinemedi. Lütfen tekrar deneyin.");
        return;
      }
      setConfirmText("");
      router.push("/dashboard/workspaces");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Workspace silinemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mt-10" aria-labelledby="veri-gizlilik-basligi">
      <h2
        id="veri-gizlilik-basligi"
        className="text-lg font-semibold tracking-tight"
      >
        Veri ve gizlilik
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Verini indir veya workspace&apos;i kalıcı olarak sil. İki işlem de
        yalnızca workspace sahibine (owner) açıktır.
      </p>

      {error && (
        <Notice className="mt-4" size="md">
          {error}
        </Notice>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verini indir</CardTitle>
            <CardDescription>
              Fikirler, oylar, yorumlar, board&apos;lar, müşteriler, changelog,
              üyeler ve ayarlar tek bir JSON dosyası olarak indirilir. Anahtarlar
              ve erişim belirteçleri dosyaya yazılmaz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={download}
              disabled={!isOwner || exporting}
            >
              {exporting ? (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              ) : (
                <DownloadIcon aria-hidden="true" />
              )}
              JSON indir
            </Button>
            {!isOwner && (
              <p className="mt-2 text-xs text-muted-foreground">
                Yalnızca workspace sahibi indirebilir.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Workspace&apos;i sil</CardTitle>
            <CardDescription>
              Workspace ve içindeki tüm veriler kalıcı olarak silinir; geri
              alınamaz. Onaylamak için workspace adresini{" "}
              <code className="font-mono">{slug}</code> yaz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">Workspace adresi (slug)</Label>
              <Input
                id="delete-confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={slug}
                autoComplete="off"
                disabled={!isOwner || deleting}
              />
            </div>
            <Button
              variant="destructive"
              onClick={remove}
              disabled={!isOwner || deleting || confirmText.trim() !== slug}
            >
              {deleting ? (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              ) : (
                <TriangleAlertIcon aria-hidden="true" />
              )}
              Kalıcı olarak sil
            </Button>
            {!isOwner && (
              <p className="text-xs text-muted-foreground">
                Yalnızca workspace sahibi silebilir.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sprint 68 — yalnız onboarding örnek verisi varsa görünür. Gerçek
          veriye dokunmaz; kullanıcı "temiz sayfayla" devam edebilsin. */}
      {samplePresent && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Örnek veriler</CardTitle>
            <CardDescription>
              Kurulumda eklenen örnek fikirler, müşteriler ve fırsatlar. Gerçek
              verilerine dokunulmaz — yalnızca örnekler kaldırılır.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={removeSample}
              disabled={removingSample}
            >
              {removingSample && (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              )}
              Örnek verileri kaldır
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
