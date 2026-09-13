import Link from "next/link";
import { CompassIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Ortak 404 görünümü (plan.md Sprint 16). İki bağlamda kullanılır:
// app/not-found.tsx (eşleşmeyen URL'ler — bare root layout, üst bar yok)
// ve app/(main)/not-found.tsx (route içindeki notFound() — üst barlı).
// Görsel dil portaldaki boş durumlarla aynı — kesikli kenarlık, merkezli
// metin, primary + outline buton çifti.
//
// `hostUnknown` (2026-09-12 fail-closed karar): istek host'u bilinen bir
// workspace'e çözülmüyorsa göreli bağlantılar (`/portal`) da 404'e giderdi —
// bu varyantta kök siteye MUTLAK bağlantı verilir.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";

export function NotFoundView({ hostUnknown = false }: { hostUnknown?: boolean } = {}) {
  return (
    <div className="mt-16 rounded-lg border border-dashed p-10 text-center sm:p-16">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-muted/40">
        <CompassIcon
          className="size-6 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <p
        className="mt-6 text-6xl font-bold tracking-tight text-muted-foreground/40"
        aria-hidden="true"
      >
        404
      </p>
      {hostUnknown ? (
        <>
          <h1 className="mt-4 text-xl font-semibold">
            Bu geri bildirim alanı bulunamadı
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Bu adreste bir feedl çalışma alanı yok. Adres yanlış yazılmış ya da
            alan kaldırılmış olabilir.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button render={<Link href={APP_URL} />}>feedl.app&apos;e git</Button>
            <Button variant="outline" render={<Link href={`${APP_URL}/#pricing`} />}>
              Planları gör
            </Button>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-xl font-semibold">Sayfa bulunamadı</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Aradığın sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.
            Adresi kontrol et ya da aşağıdaki yollardan devam et.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button render={<Link href="/portal" />}>Portala dön</Button>
            <Button variant="outline" render={<Link href="/roadmap" />}>
              Yol Haritasına göz at
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
