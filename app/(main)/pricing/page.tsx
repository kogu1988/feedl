import { eq } from "drizzle-orm";

import { PricingManager } from "@/components/custom/pricing-manager";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";

// Public /pricing — plan karşılaştırma + Paddle checkout (sandbox/live).
// Slug Paddle webhook'unda workspace'i eşleştirmek için customData'ya geçilir.
// Çalışma alanı bulunamazsa seed slug'a geri düşülür (tek-workspace MVP).
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  let slug = "feedl";
  try {
    const workspaceId = await getWorkspaceId();
    const [row] = await getDb()
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (row?.slug) slug = row.slug;
  } catch (err) {
    console.error("PricingPage workspace slug fallback:", err instanceof Error ? err.message : err);
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Geri bildirimi ürüne dönüştürmek için fiyatlandırma
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Her ölçekte ekip için basit, kullanıcı başına değil ekip başına
          fiyatlandırma. Ücretsiz başlayın, büyüdükte Pro&apos;a geçin.
        </p>
      </div>

      <div className="mt-10">
        <PricingManager workspaceSlug={slug} />
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Ödeme Paddle tarafından güvenle işlenir (merchant of record). Fiyatlar
        USD, vergi dahildir.
      </p>
    </main>
  );
}
