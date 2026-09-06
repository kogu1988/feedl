import { expect, test } from "@playwright/test";

// Sprint 63w (B3) — E2E smoke: ürünün ana yüzeyleri + public API sağlıklı mı?
// Canlı (feedl.app) veya yerel (playwright.config webServer) üzerinde çalışır.
// Not: widgets/merge/webhook uçtan uca daha derin spec'lerde; bunlar "kahve kırık
// mı" smoke'ları — her deploy sonrası hızlı güven paneli.

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Hero CTA'larından biri görünür olmalı.
  await expect(page.getByRole("button", { name: /Ücretsiz Başla|Canlı Demo/i })).toBeVisible();
});

test("portal loads and shows the board list", async ({ page }) => {
  await page.goto("/portal");
  // Sayfa h1 + en az bir fikir kartı veya boş durum görünür.
  await expect(page.locator("h1").first()).toBeVisible();
});

test("sign-in page loads (Clerk)", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page).toHaveTitle(/.*/);
});

test("public posts API returns a well-formed envelope", async ({ request }) => {
  const res = await request.get("/api/posts");
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json).toHaveProperty("success");
  expect(json).toHaveProperty("data");
});

test("roadmap loads", async ({ page }) => {
  await page.goto("/roadmap");
  await expect(page.locator("main").first()).toBeVisible();
});

test("changelog loads", async ({ page }) => {
  await page.goto("/changelog");
  await expect(page.locator("main").first()).toBeVisible();
});

// Sprint 63x (B3 test derinleştirme) — public API yüzeyi sağlık smoke'ları.
// Bunlar auth'suz (anahtar gerekmeden) çalışır: gate'in AÇIK olduğunu ve
// OpenAPI'nin sunulduğunu doğrular. Tam authed akış (post→oy→roadmap→publish)
// Clerk test kullanıcısı + seed DB ister — ayrı, mevcut a11y/smoke kapsamı.

test("v1 openapi serves a spec with documented paths", async ({ request }) => {
  const res = await request.get("/api/v1/openapi");
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json).toHaveProperty("openapi");
  expect(json).toHaveProperty("paths");
  // Public API'nin ana yüzeyleri belgelenmiş olmalı.
  expect(json.paths).toHaveProperty("/posts");
  expect(json.paths).toHaveProperty("/feedbacks");
  expect(json.paths).toHaveProperty("/changelog");
});

test("v1 posts returns 401 without an API key (auth gate intact)", async ({ request }) => {
  const res = await request.get("/api/v1/posts");
  expect(res.status()).toBe(401);
  const json = await res.json();
  // Ortak hata envelope'ı korunur.
  expect(json.success).toBe(false);
  expect(json.error).toBeTruthy();
});

test("v1 changelog returns 401 without an API key", async ({ request }) => {
  const res = await request.get("/api/v1/changelog");
  expect(res.status()).toBe(401);
});

test("widget page loads (tenant-aware shell)", async ({ page }) => {
  await page.goto("/widget");
  await expect(page.locator("body")).toBeVisible();
});
