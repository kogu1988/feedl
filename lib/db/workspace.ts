import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "./index";
import { workspaces } from "./schema";

// Sprint 37 (PM raporu §8.1): tek workspace döneminde tüm kaynakların
// ait olduğu workspace kimliğinin merkezi erişim noktası. Süreç-içi
// cache'li singleton; workspace satırı migration (0020) ile seed edilir
// (slug: "feedl"). Çoklu workspace/board işleri ayrı sprint'te gelir.
const DEFAULT_WORKSPACE_SLUG = "feedl";

const workspaceIdSchema = z.uuid();

let cachedWorkspaceId: string | null = null;

export async function getWorkspaceId(): Promise<string> {
  if (cachedWorkspaceId) {
    return cachedWorkspaceId;
  }

  const [row] = await getDb()
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, DEFAULT_WORKSPACE_SLUG))
    .limit(1);

  if (!row) {
    throw new Error(
      `Workspace "${DEFAULT_WORKSPACE_SLUG}" bulunamadı. Migration'ları uygulayın (npx drizzle-kit migrate).`,
    );
  }

  const id = workspaceIdSchema.parse(row.id);
  cachedWorkspaceId = id;
  return id;
}
