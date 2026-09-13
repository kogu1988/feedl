import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

import { PricingManager } from "@/components/custom/pricing-manager";
import {
  ACCOUNT_PRO_NOTE,
  PLAN_POSITIONING,
  TRIAL_VS_WITHDRAWAL_NOTE,
} from "@/lib/plan-copy";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { workspaces } from "@/lib/db/schema";
import { generateCanonical } from "@/lib/seo";

// Public /pricing — plan karşılaştırma + Paddle checkout (canlı/live; ortam
// PADDLE_ENV ile seçilir).
// Slug Paddle webhook'unda workspace'i eşleştirmek için customData'ya geçilir.
// Çalışma alanı bulunamazsa seed slug'a geri düşülür (tek-workspace MVP).
export const dynamic = "force-dynamic";

// SEO: benzersiz title + canonical (root template "%s · feedl" ayağı ekler).
export async function generateMetadata(): Promise<import("next").Metadata> {
  const canonical = await generateCanonical();
  return {
    title: "Fiyatlandırma",
    description:
      "Feedl'i sınırsız board, entegrasyonlar ve AI içgörüleriyle kullan. Ekip başı fiyatlandırma — ücretsiz başla, Pro'ya yükselt.",
    ...canonical,
  };
}

export default async function PricingPage() {
  // Girişli kullanıcı ödeme sonrası ürünün içine (dashboard) düşer; anonim
  // ziyaretçi satın alamaz → yönlendirme yok (sayfa yenilenir).
  const { userId } = await auth();
  const successRedirect = userId ? "/dashboard" : undefined;

  let slug = "feedl";
  let workspaceId: string | null = null;
  let paddleCustomerId: string | null = null;
  try {
    const resolvedId = await getWorkspaceId();
    const [row] = await getDb()
      .select({ slug: workspaces.slug, paddleCustomerId: workspaces.paddleCustomerId })
      .from(workspaces)
      .where(eq(workspaces.id, resolvedId))
      .limit(1);
    if (row?.slug) slug = row.slug;
    // P0-2: immutable workspace UUID — billing checkpoint'e gider (slug DEĞİL).
    workspaceId = resolvedId;
    // Sprint 64 (Paddle Retain): giriş yapmış Pro workspace owner'ının müşteri
    // ID'si — anonim/ücretsizde null olur.
    paddleCustomerId = row?.paddleCustomerId ?? null;
  } catch (err) {
    console.error("PricingPage workspace fallback:", err instanceof Error ? err.message : err);
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Geri bildirimi ürüne dönüştürmek için fiyatlandırma
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {PLAN_POSITIONING.free} {PLAN_POSITIONING.pro} Her ölçekte ekip için
          basit, kullanıcı başına değil ekip başına fiyatlandırma.
        </p>
        {/* Sprint 69.3 — hesap düzeyi Pro kuralı görünür olsun. */}
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          {ACCOUNT_PRO_NOTE}
        </p>
      </div>

      <div className="mt-10">
        <PricingManager
          workspaceSlug={slug}
          workspaceId={workspaceId}
          paddleCustomerId={paddleCustomerId}
          successRedirect={successRedirect}
        />
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Ödeme Paddle tarafından güvenle işlenir (merchant of record). Fiyatlar
        USD, vergi dahildir. {TRIAL_VS_WITHDRAWAL_NOTE}
      </p>
    </main>
  );
}
