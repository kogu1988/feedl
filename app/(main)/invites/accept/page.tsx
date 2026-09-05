import { Suspense } from "react";

import { InviteAcceptForm } from "@/components/custom/invite-accept-form";

// Sprint 48j — davet kabul sayfası. useSearchParams Suspense gerektirdiği
// için form Suspense içinde; sayfa server component.
export default function InviteAcceptPage() {
  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center p-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Yükleniyor…</p>}>
        <InviteAcceptForm />
      </Suspense>
    </div>
  );
}
