import { expect, test } from "@playwright/test";

// Sprint 71.6 — `/survey` sayfasının host kapıları ve noindex'i için E2E kanıtı.
//
// Birim testler yalnız `isPublicPath`/robots metnini doğrular; burada GERÇEK
// HTTP davranışı sınanır: sayfa kök host'ta açılır, bir müşterinin alt alanında
// 404 döner (feedl'in anketi müşterinin ziyaretçisine doldurtulmamalı).
//
// Host taklidi: `x-forwarded-host` (üretimde Vercel doldurur).

test("kök host'ta /survey açılır ve Tally formunu gömer", async ({ request }) => {
  const res = await request.get("/survey", {
    headers: { "x-forwarded-host": "feedl.app" },
  });
  expect(res.status()).toBe(200);
  const html = await res.text();
  // Form düz iframe ile gömülür (Tally embed.js'e bağımlı değil).
  expect(html).toContain("tally.so/r/pbQG4b");
  expect(html).toContain("<iframe");
});

test("kök host'ta /survey noindex işaretlidir", async ({ request }) => {
  const res = await request.get("/survey", {
    headers: { "x-forwarded-host": "feedl.app" },
  });
  const html = await res.text();
  expect(html).toMatch(/noindex/i);
});

test("bilinmeyen host'ta /survey 404 (fail-closed)", async ({ request }) => {
  const res = await request.get("/survey", {
    headers: { "x-forwarded-host": "kesinlikleyok12345.feedl.app" },
  });
  expect(res.status()).toBe(404);
});

test("var olan workspace alt alanında /survey 404 (müşteri alanına bulaşmaz)", async ({
  request,
}) => {
  const res = await request.get("/survey", {
    headers: { "x-forwarded-host": "feedl.feedl.app" },
  });
  expect(res.status()).toBe(404);
});

test("survey sitemap'e girmez", async ({ request }) => {
  const res = await request.get("/sitemap.xml", {
    headers: { "x-forwarded-host": "feedl.app" },
  });
  const xml = await res.text();
  expect(xml).not.toContain("/survey");
});
