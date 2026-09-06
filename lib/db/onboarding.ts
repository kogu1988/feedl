import "server-only";

import { count, eq } from "drizzle-orm";

import { getDb } from "./index";
import { getWorkspaceId } from "./workspace";
import {
  boards,
  posts,
  workspaceIntegrations,
  workspaceMembers,
  workspaces,
  widgetOrigins,
} from "./schema";

// Sprint 59 (madde — onboarding): Dashboard'daki "başlarken" checklist'inin
// durumunu çözer. Gerçek veriden türetilir (manuel dismissal DEĞİL) — kullanıcı
// adımı tamamladıkça kutu otomatik işaretlenir. workspace'te hiç veri yokken
// gösterilir; kilit adımlar tamamlanınca (veya kullanıcı "Şimdilik gizle" dediyse)
// gizlenir.

export interface OnboardingState {
  boardCount: number;
  postCount: number;
  memberCount: number;
  integrationCount: number;
  widgetOriginCount: number;
  onboardingDismissedAt: string | null;
  portalUrl: string;
}

export async function loadOnboardingState(): Promise<OnboardingState> {
  const workspaceId = await getWorkspaceId();
  const db = getDb();

  const [[boardRow], [postRow], [memberRow], [integrationRow], [widgetRow], [wsRow]] =
    await Promise.all([
      db
        .select({ value: count(boards.id) })
        .from(boards)
        .where(eq(boards.workspaceId, workspaceId)),
      db
        .select({ value: count(posts.id) })
        .from(posts)
        .where(eq(posts.workspaceId, workspaceId)),
      db
        .select({ value: count(workspaceMembers.id) })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspaceId)),
      db
        .select({ value: count(workspaceIntegrations.id) })
        .from(workspaceIntegrations)
        .where(eq(workspaceIntegrations.workspaceId, workspaceId)),
      db
        .select({ value: count(widgetOrigins.id) })
        .from(widgetOrigins)
        .where(eq(widgetOrigins.workspaceId, workspaceId)),
      db
        .select({
          slug: workspaces.slug,
          onboardingDismissedAt: workspaces.onboardingDismissedAt,
        })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1),
    ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://feedl.app";
  return {
    boardCount: Number(boardRow?.value ?? 0),
    postCount: Number(postRow?.value ?? 0),
    memberCount: Number(memberRow?.value ?? 0),
    integrationCount: Number(integrationRow?.value ?? 0),
    widgetOriginCount: Number(widgetRow?.value ?? 0),
    onboardingDismissedAt: wsRow?.onboardingDismissedAt
      ? new Date(wsRow.onboardingDismissedAt).toISOString()
      : null,
    portalUrl: `${appUrl}/portal?board=${encodeURIComponent(wsRow?.slug ?? "feedl")}`,
  };
}


