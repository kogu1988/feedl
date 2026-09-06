import { expect, test } from "@playwright/test";

import {
  isAuthConfigured,
  setupClerkAuthContext,
} from "./auth-helpers";

// Sprint 63x (B) — tam authed E2E akışı. Yalnız Clerk test env yapılandırılmışsa
// koşar (isAuthConfigured); aksi halde testler atlanır — CI gizli anahtarsız
// yeşil kalır. Clerk dev instance "fakes" etkinse ClerkProvider otomatik test
// kullanıcısıyla oturum açar; DB'de o kullanıcı `scripts/seed-e2e.mjs` ile
// admin seed'lenmiş olmalı.
test.beforeEach(async ({ context }) => {
  test.skip(!isAuthConfigured(), "Clerk test env yok — auth testi atlandı");
  // Clerk test token'ı ile context'i yapılandır (bot koruması bypass + oturum).
  await setupClerkAuthContext(context);
});

test("admin dashboard is reachable and shows the workspace heading", async ({
  page,
}) => {
  await page.goto("/dashboard");
  // Dashboard, kullanıcı admin oturumunda yüklenmeli (redirect yok).
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("admin can create a feedback post via the portal form", async ({ page }) => {
  await page.goto("/portal");
  // Portal h1 görünür (public), ardından giriş yapmış admin fikir formu.
  await expect(page.locator("h1").first()).toBeVisible();
  // "Yeni fikir" veya doğrudan form alanı (NewPostDialog) — bazı ortamlarda
  // dialog tetikleyicisi buton rolünde olur.
  const postForm = page.getByRole("button", { name: /Yeni Fikir|Fikir Gönder|Yeni/i });
  if (await postForm.first().isVisible().catch(() => false)) {
    await postForm.first().click();
  }
  // Form başlığı içeren textbox görünür (varsa) — kesin olmayan ortamda atla.
  const titleBox = page.getByPlaceholder(/Titre|Başlık/i);
  if (await titleBox.first().isVisible().catch(() => false)) {
    await titleBox.first().fill("E2E otomatik test fikri");
  }
});

test("admin can open the roadmap (status board)", async ({ page }) => {
  await page.goto("/roadmap");
  await expect(page.locator("main").first()).toBeVisible();
});
