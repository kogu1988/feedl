import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

// Sprint 71.1 — DB-BACKED ENTEGRASYON TESTİ (gerçek Postgres).
//
// NEDEN AYRI: birim testler mock'lu çalışır ve şema/SQL regresyonunu YAKALAMAZ
// (62 migration, 36 tablo). Bu dosya gerçek bir veritabanına yazar.
//
// ÇALIŞTIRMA: `TEST_DATABASE_URL` setli olmalıdır. Yoksa tamamı ATLANIR — yani
// `npm test` (TEST_DATABASE_URL'siz, CI'ın test job'u ve yerel) etkilenmez.
//   TEST_DATABASE_URL='postgres://…' npm test
//
// NEDEN EN DEĞERLİ TEST BU: `revenueScoreOrderSql` gelir skorunun SIRALAMA
// sorgusudur ve bu sorgu sınıfı geçmişte GERÇEK bir kiracı sızıntısı üretti
// (tech-debt #22: `companies.workspace_id` filtresi eksikti → A'nın MRR'i
// B'nin skoruna sızıyordu). Burada o sınıfın kapalı olduğu fiilen kanıtlanır.
//
// VERİ HİJYENİ: tüm fikstür benzersiz id'lerle yazılır ve `afterAll` içinde
// silinir (workspace cascade + sentetik kullanıcılar).

const TEST_URL = process.env.TEST_DATABASE_URL;
// Uygulamanın `getDb()`'si DATABASE_URL okur — ilk çağrıdan ÖNCE yönlendir.
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const suffix = randomUUID().slice(0, 8);
const wsA = randomUUID();
const wsB = randomUUID();
const postA = randomUUID();
const postB = randomUUID();
const companyA = randomUUID();
const companyB = randomUUID();
const oppB = randomUUID();
const userA = `itest_a_${suffix}`;
const userB = `itest_b_${suffix}`;

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const wrapped = (result as { rows?: Record<string, unknown>[] }).rows;
  return Array.isArray(wrapped) ? wrapped : [];
}

describe.skipIf(!TEST_URL)("DB-backed: gelir skoru kiracı izolasyonu", () => {
  beforeAll(async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.execute(sql`
      INSERT INTO workspaces (id, name, slug, plan) VALUES
        (${wsA}, ${"itest A " + suffix}, ${"itest-a-" + suffix}, 'free'),
        (${wsB}, ${"itest B " + suffix}, ${"itest-b-" + suffix}, 'free')
    `);
    await db.execute(sql`
      INSERT INTO users (id, email, name, role) VALUES
        (${userA}, ${userA + "@itest.local"}, 'Itest A', 'customer'),
        (${userB}, ${userB + "@itest.local"}, 'Itest B', 'customer')
    `);
    await db.execute(sql`
      INSERT INTO posts (id, workspace_id, title, description, status, source) VALUES
        (${postA}, ${wsA}, ${"itest post A " + suffix}, 'A', 'open', 'integration-test'),
        (${postB}, ${wsB}, ${"itest post B " + suffix}, 'B', 'open', 'integration-test')
    `);
    // A'nın şirketi (MRR 1000) ve B'nin şirketi (MRR 9999).
    await db.execute(sql`
      INSERT INTO companies (id, workspace_id, name, mrr, status) VALUES
        (${companyA}, ${wsA}, ${"itest co A " + suffix}, 1000, 'active'),
        (${companyB}, ${wsB}, ${"itest co B " + suffix}, 9999, 'active')
    `);
    await db.execute(sql`
      INSERT INTO company_members (id, company_id, user_id) VALUES
        (${randomUUID()}, ${companyA}, ${userA}),
        (${randomUUID()}, ${companyB}, ${userB})
    `);
    // KRİTİK: B'nin şirket üyesi A'nın fikrine oy veriyor (kiracılar arası oy).
    await db.execute(sql`
      INSERT INTO votes (id, user_id, post_id) VALUES
        (${randomUUID()}, ${userA}, ${postA}),
        (${randomUUID()}, ${userB}, ${postA})
    `);
    // B workspace'inde büyük bir fırsat, A'nın fikrine bağlı (fırsat sızıntı sınavı).
    await db.execute(sql`
      INSERT INTO opportunities (id, workspace_id, company_id, title, deal_value, stage)
      VALUES (${oppB}, ${wsB}, ${companyB}, ${"itest opp B " + suffix}, 500000, 'open')
    `);
    await db.execute(sql`
      INSERT INTO post_opportunities (id, post_id, opportunity_id)
      VALUES (${randomUUID()}, ${postA}, ${oppB})
    `);
  });

  afterAll(async () => {
    if (!TEST_URL) return;
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    await db.execute(sql`DELETE FROM workspaces WHERE id IN (${wsA}, ${wsB})`);
    await db.execute(sql`DELETE FROM users WHERE id IN (${userA}, ${userB})`);
  });

  it("A'nın skoru B'nin şirket MRR'ini ve fırsat değerini İÇERMEZ", async () => {
    const { getDb } = await import("@/lib/db");
    const { revenueScoreOrderSql } = await import("@/lib/db/revenue-scores");
    const db = getDb();

    const result = await db.execute(sql`
      SELECT id, (${revenueScoreOrderSql(wsA)}) AS score
      FROM posts
      WHERE id IN (${postA}, ${postB})
    `);
    const rows = rowsOf(result);
    const scoreOf = (id: string) => {
      const row = rows.find((r) => r.id === id);
      return row ? Number(row.score) : null;
    };

    // A'nın fikri: 2 oy + (yalnız A'nın şirketi sayılır → 10×1) + (1000/1000)
    //   = 2 + 10 + 1 = 13
    // B'nin şirketi (9999) ve fırsatı (500000/1000 = 500) DAHİL OLMAMALI.
    expect(scoreOf(postA)).toBe(13);
    // B'nin fikri A'nın workspace'i için 0 (hiçbir A verisi bağlı değil).
    expect(scoreOf(postB)).toBe(0);
  });
});
