import "server-only";

import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { getDb } from "./index";
import { boards, changelogEntries, posts, votes, workspaces } from "./schema";

// Sprint 60 (madde — activation funnel): Operator seviyesinde "activated
// workspace" ölçümü. ChatGPT P0: Signup → Board → Feedback → Vote → AI →
// Roadmap → Changelog. Her adımın kaç workspace'in o adıma ulaştığını ve
// bir öncekine göre dönüşümünü (%) hesaplar. Tüm workspace'leri kapsar.

export interface ActivationStep {
  key: string;
  label: string;
  count: number;
  // Bir önceki adıma göre dönüşüm (ilk adım 100%).
  conversion: number;
}

export interface ActivationFunnel {
  totalWorkspaces: number;
  steps: ActivationStep[];
}

export async function loadActivationFunnel(): Promise<ActivationFunnel> {
  const db = getDb();

  const wsRows = await db.select({ id: workspaces.id }).from(workspaces);
  const all = wsRows.map((w) => w.id);
  const total = all.length;

  const setFor = async (q: Promise<{ id: string }[]>): Promise<Set<string>> =>
    new Set((await q).map((r) => r.id));

  // Her koşulu sağlayan workspace id seti.
  const sBoard = await setFor(
    db.select({ id: boards.workspaceId }).from(boards).where(inArray(boards.workspaceId, all)),
  );
  const sPost = await setFor(
    db.select({ id: posts.workspaceId }).from(posts).where(inArray(posts.workspaceId, all)),
  );
  const sVote = await setFor(
    db
      .select({ id: posts.workspaceId })
      .from(posts)
      .innerJoin(votes, eq(votes.postId, posts.id))
      .where(inArray(posts.workspaceId, all)),
  );
  const sAi = await setFor(
    db
      .select({ id: posts.workspaceId })
      .from(posts)
      .where(and(inArray(posts.workspaceId, all), isNotNull(posts.sentimentLabel))),
  );
  const sRoadmap = await setFor(
    db
      .select({ id: posts.workspaceId })
      .from(posts)
      .where(
        and(
          inArray(posts.workspaceId, all),
          inArray(posts.status, ["planned", "in-progress", "shipped"]),
        ),
      ),
  );
  const sChangelog = await setFor(
    db
      .select({ id: changelogEntries.workspaceId })
      .from(changelogEntries)
      .where(
        and(inArray(changelogEntries.workspaceId, all), eq(changelogEntries.status, "published")),
      ),
  );

  // Birikimli funnel: her adım, kendinden öncekileri de yapmış workspace'leri sayar.
  const cumSteps = [
    sBoard,
    intersect(sBoard, sPost),
    intersect(sBoard, sPost, sVote),
    intersect(sBoard, sPost, sVote, sAi),
    intersect(sBoard, sPost, sVote, sAi, sRoadmap),
    intersect(sBoard, sPost, sVote, sAi, sRoadmap, sChangelog),
  ];

  const labels = [
    "Kayıt / Workspace",
    "İlk Board",
    "İlk Feedback",
    "İlk Oy",
    "İlk AI İçgörüsü",
    "İlk Roadmap",
    "İlk Changelog",
  ];

  const steps: ActivationStep[] = labels.map((label, i) => {
    const count = i === 0 ? total : cumSteps[i - 1].size;
    // Bir önceki adımın count'u ile dönüşüm hesapla (ilk adım 100%).
    const prev = i === 0 ? total : i === 1 ? total : cumSteps[i - 2].size;
    return {
      key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label,
      count,
      conversion: prev === 0 ? 0 : Math.round((count / prev) * 100),
    };
  });

  return { totalWorkspaces: total, steps };
}

function intersect(...sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  const [first, ...rest] = sets;
  const result = new Set<string>();
  for (const id of first) {
    if (rest.every((s) => s.has(id))) result.add(id);
  }
  return result;
}
