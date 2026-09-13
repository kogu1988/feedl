import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, like } from "drizzle-orm";

import { getDb } from "./index";
import { companies, companyMembers, opportunities, posts, users, votes } from "./schema";

// Sprint 68 (2026-09-13) — ÖRNEK VERİ (activation friction, glm_analyse.md §3.2/R2).
//
// SORUN: Gelir skoru = oy + müşteri + fırsat değeri. Bunun anlamlı olması için
// kullanıcının "şirket aç → MRR gir → fırsat gir → fikre bağla" zincirini
// tamamlaması gerekir. Yeni bir Free kullanıcı bunu yapmadan ürünün ASIL
// değerini (gelir ağırlıklı önceliklendirme) hiç göremiyor → aktivasyon düşüyor.
//
// ÇÖZÜM: Onboarding'de "örnek veriyle dene" seçeneği. Kullanıcı 2 dakikada
// dolu bir pano + çalışan bir gelir skoru görür, sonra kendi verisini girer.
//
// TASARIM KURALLARI:
//   1) Her satır `is_sample=true` (migration 0063) → gerçek veriden ayrılır.
//   2) Örnek veri HUNİYE SIZMAZ: burada `trackEvent` ÇAĞRILMAZ (aksi halde
//      funnel'daki feedback_added/customer_linked sayıları şişerdi).
//   3) Sentetik kullanıcılar `sample_<ws>_` önekli opak id'lerdir; silme
//      yalnız bu öneki hedefler — gerçek kullanıcıya dokunmaz.
//   4) Silme TEK çağrıyla ve workspace-scoped yapılır (GDPR dostu).

// Workspace'e özel önek: farklı workspace'lerin örnek kullanıcıları çakışmasın.
function userPrefix(workspaceId: string): string {
  return `sample_${workspaceId.replace(/-/g, "").slice(0, 12)}_`;
}

const SAMPLE_COMPANIES = [
  { key: "acme", name: "Örnek Müşteri A (Acme)", domain: "acme.example", mrr: "450.00", status: "active" },
  { key: "globex", name: "Örnek Müşteri B (Globex)", domain: "globex.example", mrr: "1200.00", status: "active" },
  { key: "initech", name: "Örnek Müşteri C (Initech)", domain: "initech.example", mrr: "300.00", status: "at_risk" },
];

const SAMPLE_POSTS = [
  { title: "Karanlık mod desteği", status: "planned", type: "feature",
    description: "Gözleri yoran açık temaya alternatif olarak karanlık mod istiyoruz." },
  { title: "CSV dışa aktarma", status: "in-progress", type: "feature",
    description: "Tüm geri bildirimleri tek dosyada indirebilmek istiyoruz." },
  { title: "Mobilde menü taşıyor", status: "open", type: "bug",
    description: "Küçük ekranda üst menü ekrandan taşıyor, bazı bağlantılar görünmüyor." },
  { title: "Slack bildirimi", status: "shipped", type: "feature",
    description: "Yeni geri bildirim geldiğinde Slack kanalına otomatik bildirim gelsin." },
  { title: "Arama sonuçları çok yavaş", status: "open", type: "usability",
    description: "Binlerce kayıt olduğunda arama birkaç saniye sürüyor." },
];

// Hangi örnek şirket hangi örnek fikre oy verir (gelir skorunu besler).
const SAMPLE_VOTES: Record<string, string[]> = {
  "Karanlık mod desteği": ["acme", "globex", "initech"],
  "CSV dışa aktarma": ["globex", "initech"],
  "Mobilde menü taşıyor": ["acme", "globex"],
  "Slack bildirimi": ["acme"],
  "Arama sonuçları çok yavaş": ["initech"],
};

export interface SampleDataResult {
  posts: number;
  companies: number;
  opportunities: number;
  votes: number;
}

/**
 * Workspace'e örnek veri yazar (fikir + şirket + fırsat + oy).
 * Idempotent değildir ama `deleteSampleData` ile geri alınabilir; onboarding'de
 * yalnız bir kez çağrılır. Hata durumunda ÇAĞIRAN yutar (workspace oluşmuş
 * kalmalı; örnek veri kritik değildir).
 */
export async function createSampleData(
  workspaceId: string,
  boardId: string | null,
  authorUserId: string | null,
): Promise<SampleDataResult> {
  const db = getDb();
  const prefix = userPrefix(workspaceId);

  // 1) Örnek şirketler + deterministik id'ler.
  const companyIds: Record<string, string> = {};
  for (const c of SAMPLE_COMPANIES) {
    const id = randomUUID();
    companyIds[c.key] = id;
    await db.insert(companies).values({
      id,
      workspaceId,
      name: c.name,
      domain: c.domain,
      mrr: c.mrr,
      status: c.status,
      isSample: true,
    });
  }

  // 2) Örnek "müşteri" kullanıcıları + şirket üyelikleri.
  const voterIds: Record<string, string> = {};
  for (const c of SAMPLE_COMPANIES) {
    const userId = `${prefix}${c.key}`;
    voterIds[c.key] = userId;
    await db
      .insert(users)
      .values({
        id: userId,
        email: `${userId}@sample.local`,
        name: c.name,
        role: "customer",
      })
      .onConflictDoNothing();
    await db
      .insert(companyMembers)
      .values({ companyId: companyIds[c.key], userId, jobTitle: "Örnek Kullanıcı" })
      .onConflictDoNothing();
  }

  // 3) Örnek fırsat (gelir skorunun "fırsat" bileşeni için).
  await db.insert(opportunities).values({
    workspaceId,
    companyId: companyIds.globex,
    title: "Örnek fırsat: yıllık plana geçiş",
    dealValue: "4800.00",
    stage: "open",
    isSample: true,
  });

  // 4) Örnek fikirler + oylar.
  let voteCount = 0;
  for (const p of SAMPLE_POSTS) {
    const postId = randomUUID();
    await db.insert(posts).values({
      id: postId,
      workspaceId,
      boardId,
      userId: authorUserId,
      title: p.title,
      description: p.description,
      status: p.status as "open" | "planned" | "in-progress" | "shipped",
      postType: p.type as "feature" | "bug" | "usability",
      source: "sample",
      isSample: true,
    });
    const voters = SAMPLE_VOTES[p.title] ?? [];
    if (voters.length > 0) {
      await db
        .insert(votes)
        .values(voters.map((key) => ({ postId, userId: voterIds[key] })))
        .onConflictDoNothing();
      voteCount += voters.length;
    }
  }

  return {
    posts: SAMPLE_POSTS.length,
    companies: SAMPLE_COMPANIES.length,
    opportunities: 1,
    votes: voteCount,
  };
}

/**
 * Bu workspace'in TÜM örnek verisini siler (fikirler → oylar/etiketler cascade,
 * şirketler → üyeler/fırsatlar cascade). Sentetik kullanıcılar önekle silinir.
 * Gerçek veriye DOKUNMAZ.
 */
export async function deleteSampleData(workspaceId: string): Promise<void> {
  const db = getDb();
  const prefix = userPrefix(workspaceId);

  await db
    .delete(posts)
    .where(and(eq(posts.workspaceId, workspaceId), eq(posts.isSample, true)));
  await db
    .delete(opportunities)
    .where(
      and(eq(opportunities.workspaceId, workspaceId), eq(opportunities.isSample, true)),
    );
  await db
    .delete(companies)
    .where(and(eq(companies.workspaceId, workspaceId), eq(companies.isSample, true)));
  // Sentetik kullanıcılar (yalnız bu workspace'in öneki).
  await db.delete(users).where(like(users.id, `${prefix}%`));
}

/** Workspace'te örnek veri var mı? (Silme butonunu göstermek için.) */
export async function hasSampleData(workspaceId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.workspaceId, workspaceId), eq(posts.isSample, true)))
    .limit(1);
  return Boolean(row);
}
