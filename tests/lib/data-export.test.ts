import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  COMPANY_SCOPED_TABLES,
  EXCLUDED_TABLE_NAMES,
  POST_SCOPED_TABLES,
  REDACTED,
  USER_SCOPED_TABLES,
  exportedTableNames,
  isRedactedKey,
  listWorkspaceScopedTables,
  redactRow,
} from "@/lib/db/data-export";
import * as schema from "@/lib/db/schema";
import {
  apiIdempotency,
  boards,
  changelogEntries,
  changelogSubscribers,
  comments,
  companies,
  companyMembers,
  customFields,
  emailDeliveries,
  opportunities,
  posts,
  users,
  votes,
  webhookEndpoints,
  workspaceIntegrations,
  workspaceMembers,
  workspaces,
} from "@/lib/db/schema";

// Denetim #8b — veri dışa aktarma (GDPR/KVKK taşınabilirlik).
//
// Üç riski kilitler:
//  1) Kimlik bilgileri (secret/hash/token) ve embedding vektörleri indirilen
//     dosyaya yazılmamalı → redaksiyon testleri.
//  2) Şemadaki her workspace-kapsamlı tablo kapsanmalı → türetme + drift testi.
//  3) `workspace_id` taşımayan ama workspace verisi olan tablolar (comments,
//     votes, company_members, email_deliveries...) atlanmamalı → hesap testi.

// Şemadaki tüm pgTable adları.
function allSchemaTableNames(): string[] {
  const names: string[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    names.push(getTableConfig(value).name);
  }
  return names;
}

describe("data-export — redaksiyon", () => {
  it("sır/anahtar benzeri kolon adlarını gizler", () => {
    for (const key of [
      "secret",
      "webhookSecret",
      "customDomainVerificationToken",
      "unsubscribeToken",
      "keyHash",
      "secretEncrypted",
      "apiToken",
      "passwordHash",
      "embeddingVector",
    ]) {
      expect(isRedactedKey(key), key).toBe(true);
    }
  });

  it("normal veri kolonlarına dokunmaz", () => {
    for (const key of [
      "id",
      "title",
      "description",
      "email",
      "name",
      "status",
      "createdAt",
      "workspaceId",
      "mrrCents",
    ]) {
      expect(isRedactedKey(key), key).toBe(false);
    }
  });

  it("redactRow sırları maskeler, null'u korur, undefined'ı düşürür", () => {
    const row = redactRow({
      id: "p1",
      title: "Karanlık mod",
      unsubscribeToken: "capability-token",
      embeddingVector: [0.1, 0.2],
      deletedAt: null,
      updatedAt: undefined,
    });

    expect(row).toEqual({
      id: "p1",
      title: "Karanlık mod",
      unsubscribeToken: REDACTED,
      embeddingVector: REDACTED,
      deletedAt: null,
    });
    expect("updatedAt" in row).toBe(false);
  });
});

describe("data-export — tablo kapsamı", () => {
  const derived = listWorkspaceScopedTables().map((entry) => entry.name);
  const exported = exportedTableNames();

  it("workspace_id taşıyan tabloları türetir", () => {
    for (const table of [
      posts,
      boards,
      workspaceMembers,
      changelogEntries,
      changelogSubscribers,
      companies,
      opportunities,
      customFields,
      webhookEndpoints,
      workspaceIntegrations,
    ]) {
      expect(derived, getTableConfig(table).name).toContain(
        getTableConfig(table).name,
      );
    }
  });

  it("kök tabloları türetilen listeden dışlar", () => {
    for (const table of [users, workspaces, apiIdempotency]) {
      expect(derived, getTableConfig(table).name).not.toContain(
        getTableConfig(table).name,
      );
    }
  });

  it("post üzerinden scope'lu tabloları kapsar (workspace_id taşımazlar)", () => {
    // Regresyon: bu tablolar `workspace_id` kolonu taşımadığı için yalnızca
    // türetmeye güvenilseydi bir müşterinin TÜM yorum ve oyları ihraçtan
    // sessizce düşerdi.
    for (const { table, column } of POST_SCOPED_TABLES) {
      const config = getTableConfig(table);
      expect(config.columns.some((c) => c.name === "workspace_id")).toBe(false);
      expect(
        config.columns.some((c) => c.name === column.name),
        `${config.name}.${column.name}`,
      ).toBe(true);
    }
    const names = POST_SCOPED_TABLES.map((entry) => getTableConfig(entry.table).name);
    expect(names).toContain(getTableConfig(comments).name);
    expect(names).toContain(getTableConfig(votes).name);
  });

  it("şirket ve kullanıcı üzerinden scope'lu tabloları kapsar", () => {
    expect(COMPANY_SCOPED_TABLES.map((e) => getTableConfig(e.table).name)).toEqual([
      getTableConfig(companyMembers).name,
    ]);
    expect(USER_SCOPED_TABLES.map((e) => getTableConfig(e.table).name)).toEqual([
      getTableConfig(emailDeliveries).name,
    ]);
  });

  it("şemadaki HER tablo ya ihraçta ya da gerekçeli istisna listesinde", () => {
    const accounted = new Set([...exported, ...EXCLUDED_TABLE_NAMES]);
    const missing = allSchemaTableNames().filter((name) => !accounted.has(name));
    // Yeni bir tablo eklenip bir gruba atanmazsa bu test kırılır — eksik ihracı
    // sessizce yayınlamaktansa testin kırılması yeğdir.
    expect(missing).toEqual([]);
  });

  it("tablo adlarında kopya yok", () => {
    expect(new Set(exported).size).toBe(exported.length);
  });

  it("kapsam taban çizgisi (en az 20 doğrudan + 14 ilişkisel tablo)", () => {
    expect(derived.length).toBeGreaterThanOrEqual(20);
    expect(exported.length).toBeGreaterThanOrEqual(32);
  });
});
