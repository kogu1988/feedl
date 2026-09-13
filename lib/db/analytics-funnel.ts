import "server-only";

import { gte, sql } from "drizzle-orm";

import { getDb } from "./index";
import { analyticsEvents } from "./schema";
import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@/lib/analytics/names";

// Sprint 65 (2026-09-13) — OLAY TABANLI aktivasyon hunisi (operatör görünümü).
//
// `lib/db/activation.ts` huniyi VERİNİN VARLIĞINDAN türetir (ör. "posts tablosunda
// satırı olan workspace"); bu modül ise gerçekten TETİKLENEN olayları sayar.
// İkisi tamamlayıcıdır: biri "ne oldu"yu, diğeri "kaç kişi o adıma geldi"yi
// gösterir. Fark, huninin nerede sızdığını ortaya çıkarır (§3.3'ün amacı).
//
// `visitor` bilinçli olarak HARİÇ: o olay yalnız client/GA mirror'ıdır, sunucuda
// satırı yoktur (anonim ziyaretçinin workspace'i yok).

const FUNNEL_ORDER = [
  "signup",
  "workspace_created",
  "feedback_added",
  "customer_linked",
  "revenue_added",
  "priority_viewed",
  "upgrade_clicked",
] as const satisfies readonly AnalyticsEventName[];

const LABELS: Record<(typeof FUNNEL_ORDER)[number], string> = {
  signup: "Kayıt (hesap açıldı)",
  workspace_created: "Workspace oluşturuldu",
  feedback_added: "Geri bildirim eklendi",
  customer_linked: "Şirket bağlandı (gelir 1/2)",
  revenue_added: "Fırsat eklendi (gelir 2/2)",
  priority_viewed: "Öncelik skoru görüntülendi",
  upgrade_clicked: "Pro'ya geç tıklandı",
};

export interface EventFunnelStep {
  name: AnalyticsEventName;
  label: string;
  count: number;
  // Bir önceki adıma göre dönüşüm (%). İlk adım 100.
  conversion: number;
}

export interface EventFunnel {
  windowDays: number;
  steps: EventFunnelStep[];
  totalEvents: number;
}

/**
 * Son `windowDays` gün içindeki olayları huni sırasına dizer.
 * Funnel adımları arasında telafi YAPILMAZ: bir adım 0 olsa bile gösterilir —
 * hunideki boşluk tam olarak görülmesi gereken şeydir.
 */
export async function loadEventFunnel(windowDays = 30): Promise<EventFunnel> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const rows = await getDb()
    .select({
      name: analyticsEvents.name,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.name);

  const counts = new Map<string, number>(
    rows.map((r) => [r.name, Number(r.count ?? 0)]),
  );

  let totalEvents = 0;
  const steps: EventFunnelStep[] = FUNNEL_ORDER.map((name, index) => {
    const count = counts.get(name) ?? 0;
    totalEvents += count;
    const prev = index === 0 ? count : (counts.get(FUNNEL_ORDER[index - 1]) ?? 0);
    return {
      name,
      label: LABELS[name],
      count,
      conversion: index === 0 ? 100 : prev === 0 ? 0 : Math.round((count / prev) * 100),
    };
  });

  return { windowDays, steps, totalEvents };
}

// Bilinmeyen/yeni olay adları (taksonomi dışı) sessizce yutulmasın diye
// dışa verilir — operatör görünümünde "tanımsız" olarak listelenebilir.
export async function loadUnknownEventNames(windowDays = 30): Promise<string[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await getDb()
    .select({ name: analyticsEvents.name })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.name);
  const known = new Set<string>(ANALYTICS_EVENTS);
  return rows.map((r) => r.name).filter((n) => !known.has(n));
}
