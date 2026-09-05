import { and, asc, eq } from "drizzle-orm";

import { getDb } from "./index";
import { getWorkspaceId } from "./workspace";
import { boards } from "./schema";

// Sprint 48b (madde 8): board erişim yardımcıları. Tek workspace döneminde
// getWorkspaceId() hangi workspace'i döndürüyorsa board'lar onun altındadır.
// Varsayılan board ("genel") tüm mevcut fikirleri taşır; slug ile çözümleme
// public/private erişim kontrolünü de yapar (MVC: public herkese, private
// yalnızca admin oturumunda görünür — sayfa/API çağrısı isAdmin bilgisini taşır).

const DEFAULT_BOARD_SLUG = "genel";

let cachedBoardId: string | null = null;
let cachedWorkspaceId: string | null = null;

export async function getDefaultBoardId(
  workspaceIdOverride?: string,
): Promise<string> {
  const workspaceId = workspaceIdOverride ?? (await getWorkspaceId());
  if (cachedBoardId && cachedWorkspaceId === workspaceId) {
    return cachedBoardId;
  }
  const [row] = await getDb()
    .select({ id: boards.id })
    .from(boards)
    .where(
      and(
        eq(boards.workspaceId, workspaceId),
        eq(boards.slug, DEFAULT_BOARD_SLUG),
      ),
    )
    .limit(1);
  if (!row) {
    throw new Error(
      `Varsayılan board "${DEFAULT_BOARD_SLUG}" bulunamadı. Migration 0030 uygulanmalı.`,
    );
  }
  cachedBoardId = row.id;
  cachedWorkspaceId = workspaceId;
  return row.id;
}

export interface BoardRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: "public" | "private";
  sortOrder: number;
}

export async function listBoards(): Promise<BoardRow[]> {
  return getDb()
    .select({
      id: boards.id,
      name: boards.name,
      slug: boards.slug,
      description: boards.description,
      visibility: boards.visibility,
      sortOrder: boards.sortOrder,
    })
    .from(boards)
    .where(eq(boards.workspaceId, await getWorkspaceId()))
    .orderBy(asc(boards.sortOrder), asc(boards.createdAt));
}

// Slug ile board çöz; yoksa null. isAdmin yoksa private board reddedilir.
export async function resolveBoardBySlug(
  slug: string,
  isAdmin: boolean,
): Promise<BoardRow | null> {
  const [row] = await getDb()
    .select({
      id: boards.id,
      name: boards.name,
      slug: boards.slug,
      description: boards.description,
      visibility: boards.visibility,
      sortOrder: boards.sortOrder,
    })
    .from(boards)
    .where(
      and(
        eq(boards.workspaceId, await getWorkspaceId()),
        eq(boards.slug, slug),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (row.visibility === "private" && !isAdmin) return null;
  return row;
}

// Bir workspace'te o board'un gerçekten var olduğunu kontrol et (FK güvenliği).
export async function isBoardInWorkspace(boardId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: boards.id })
    .from(boards)
    .where(
      and(
        eq(boards.id, boardId),
        eq(boards.workspaceId, await getWorkspaceId()),
      ),
    )
    .limit(1);
  return Boolean(row);
}
