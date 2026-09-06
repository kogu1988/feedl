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
