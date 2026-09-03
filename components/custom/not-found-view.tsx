import Link from "next/link";
import { CompassIcon } from "lucide-react";

// Ortak 404 görünümü (plan.md Sprint 16). İki bağlamda kullanılır:
// app/not-found.tsx (eşleşmeyen URL'ler — bare root layout, üst bar yok)
// ve app/(main)/not-found.tsx (route içindeki notFound() — üst barlı).
// Görsel dil portaldaki boş durumlarla aynı — kesikli kenarlık, merkezli
// metin, primary + outline buton çifti.
export function NotFoundView() {
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
      <h1 className="mt-4 text-xl font-semibold">Sayfa bulunamadı</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Aradığın sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.
        Adresi kontrol et ya da aşağıdaki yollardan devam et.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/portal"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Portala dön
        </Link>
        <Link
          href="/roadmap"
          className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
        >
          Yol Haritasına göz at
        </Link>
      </div>
    </div>
  );
}
