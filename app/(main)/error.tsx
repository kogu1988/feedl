"use client";

import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Global hata sınırı (plan.md Sprint 19): 404'ün (app/not-found.tsx)
// kardeşi — beklenmeyen çalışma zamanı hatalarında markalı karşılama.
// Root layout içinde render edildiği için feedl üst barı görünür kalır.
// Hata detayı kullanıcıya gösterilmez (docs/standarts.md); yalnızca
// tarayıcı konsoluna yazılır.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Page error boundary:", error.message, error.digest);

  return (
    <main className="container mx-auto max-w-none p-4 sm:p-8">
      <div className="mt-16 rounded-lg border border-dashed p-10 text-center sm:p-16">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-muted/40">
          <AlertTriangleIcon
            className="size-6 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <h1 className="mt-6 text-xl font-semibold">Bir şeyler ters gitti</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Beklenmeyen bir hata oluştu. Tekrar denemeyi dene; sorun sürerse
          biraz sonra tekrar gel.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={reset}>
            Tekrar dene
          </Button>
          <Button variant="outline" render={<Link href="/portal" />}>
            Portala dön
          </Button>
        </div>
      </div>
    </main>
  );
}
