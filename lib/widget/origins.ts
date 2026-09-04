import "server-only";

import { asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { widgetOrigins } from "@/lib/db/schema";
import { getWorkspaceId } from "@/lib/db/workspace";

// Feedl'in kendi origin'i: iframe içi istekler (posts/votes) kendi
// domainimizden gelir; session açılışındaki Origin ise müşteri sitesidir.
// NEXT_PUBLIC_APP_URL setliyse o da self kabul edilir (custom domain'e
// geçişte tek env güncellemesi yeter kalır).
function getSelfOrigins(): string[] {
  const self = new Set<string>(["https://getfeedl.vercel.app"]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) self.add(appUrl.replace(/\/$/, ""));
  return [...self];
}

// Sprint 32'deki env tabanlı liste: geçiş döneminde etrafındaki sistemlere
// dokunmadan ek origin imkânı verir; DB listesi birikince env boşaltılabilir.
function getEnvOrigins(): string[] {
  const raw = process.env.FEEDL_WIDGET_ALLOWED_ORIGINS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

// Sprint 38 (PM raporu §8.2): "env boşsa her origin kabul" davranışı
// kaldırıldı. Artık origin şu üç listeden birinde değilse reddedilir:
// self origin (feedl kendi domaini) → env listesi → widget_origins tablosu.
export async function isOriginAllowed(origin: string | null): Promise<boolean> {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, "");
  if (getSelfOrigins().includes(normalized)) return true;
  if (getEnvOrigins().includes(normalized)) return true;
  const dbOrigins = await getDbOrigins();
  return dbOrigins.includes(normalized);
}

// Widget isteklerinde her istek DB okumamak için kısa TTL cache; admin
// yazma işlemleri invalidateOriginsCache ile anında etkili olur.
const ORIGINS_TTL_MS = 10_000;
let originsCache: {
  workspaceId: string;
  origins: string[];
  fetchedAt: number;
} | null = null;

async function getDbOrigins(): Promise<string[]> {
  const workspaceId = await getWorkspaceId();
  const now = Date.now();
  if (
    originsCache &&
    originsCache.workspaceId === workspaceId &&
    now - originsCache.fetchedAt < ORIGINS_TTL_MS
  ) {
    return originsCache.origins;
  }

  const db = getDb();
  const rows = await db
    .select({ origin: widgetOrigins.origin })
    .from(widgetOrigins)
    .where(eq(widgetOrigins.workspaceId, workspaceId));
  const origins = rows.map((row) => row.origin.replace(/\/$/, ""));
  originsCache = { workspaceId, origins, fetchedAt: now };
  return origins;
}

export function invalidateOriginsCache(): void {
  originsCache = null;
}

export async function listWidgetOrigins() {
  const db = getDb();
  return db
    .select({
      id: widgetOrigins.id,
      origin: widgetOrigins.origin,
      label: widgetOrigins.label,
      createdAt: widgetOrigins.createdAt,
    })
    .from(widgetOrigins)
    .where(eq(widgetOrigins.workspaceId, await getWorkspaceId()))
    .orderBy(asc(widgetOrigins.createdAt));
}
