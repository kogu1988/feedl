import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";
import { clientIpFrom } from "@/lib/rate-limit";
import { toWidgetUserId } from "@/lib/widget/jwt";

// Widget fikir gönderim modu (Sprint 63z). "signup" (varsayılan, mevcut) →
// müşteri uygulaması imzalı JWT + Clerk/kimlik; "anonymous" → üye olmadan
// IP bazlı fikir+oy; "email" → sadece email gir, fikir ver (kayıt yok).
// Mod tek kaynak: workspaces.widget_submission_mode.

export type WidgetSubmissionMode = "anonymous" | "email" | "signup";

export const DEFAULT_SUBMISSION_MODE: WidgetSubmissionMode = "signup";

// Tek workspace için mod + anonim oy bayrağını okur. API çağrısı başına bir
// kez; değer yoksa varsayılana düşer (mevcut davranışı bozmaz).
export async function getWidgetSubmissionSettings(
  workspaceId: string,
): Promise<{ mode: WidgetSubmissionMode; anonymousVoting: boolean }> {
  try {
    const [row] = await getDb()
      .select({
        mode: workspaces.widgetSubmissionMode,
        anonymousVoting: workspaces.widgetAnonymousVoting,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    const mode = normalizeSubmissionMode(row?.mode);
    return { mode, anonymousVoting: row?.anonymousVoting ?? false };
  } catch {
    // DB hatası ana akışı bozmamalı — mevcut (signup) davranışa düş.
    return { mode: DEFAULT_SUBMISSION_MODE, anonymousVoting: false };
  }
}

export function normalizeSubmissionMode(value: string | null | undefined): WidgetSubmissionMode {
  return value === "anonymous" || value === "email" || value === "signup"
    ? value
    : DEFAULT_SUBMISSION_MODE;
}

// Anonim ziyaretçi için kararlı bir widget kullanıcı kimliği üretir. Aynı IP
// (reverse proxy dikkate alınarak) aynı kimliği alır → 1 IP 1 oy / takip,
// fakat gerçek kişisel kimlik saklanmaz (email/name yok). Kolay geri alınır
// (IP değişirse farklı kimlik olur — Canny/Clippy modeli). `users.email` NOT
// NULL olduğundan sentezlenmiş bir e-posta üretilir (gönderilmez, yalnız benzersizlik).
export function anonymousUserKey(ip: string): string {
  return `anon_${ip}`;
}

export function anonymousWidgetUserId(ip: string): string {
  return toWidgetUserId(anonymousUserKey(ip));
}

// `users` kaydı yoksa oluşturur; anonim/email modlarda session'sız da fikir/oy
// yazılabilmesi için. Email yoksa (anonim) deterministik yer tutucu üretilir.
export async function ensureWidgetUser(params: {
  userId: string;
  email?: string | null;
  name?: string | null;
}): Promise<void> {
  await getDb()
    .insert(users)
    .values({
      id: params.userId,
      email: params.email ?? `${params.userId}@widget.feedl.local`,
      name: params.name,
      role: "customer",
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        ...(params.email ? { email: params.email } : {}),
        ...(params.name ? { name: params.name } : {}),
        updatedAt: new Date(),
      },
    });
}

// İstekten istemci IP'sini çözer (rate-limit clientIpFrom ile aynı kurallar;
// x-forwarded-for zinciri güvenilir proxy başlığından alınır).
export function widgetClientIp(req: Request): string {
  return clientIpFrom(req);
}
