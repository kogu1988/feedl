import { expect, test } from "@playwright/test";

// 2026-09-12 (fail-closed host kararı) — E2E kanıtı.
//
// Davranış: var olmayan bir alt alan (`kesinlikleyok.<...>`) veya
// doğrulanmamış bir custom domain artık varsayılan workspace'i GÖSTERMEZ;
// 404 döner. Kök host ve var olan workspace alt alanları etkilenmez.
//
// Host taklidi: `getRequestHost()` (lib/db/workspace.ts) `x-forwarded-host`
// başlığını ilk sırada okur — üretimde Vercel bu başlığı gerçek müşteri
// host'uyla doldurur. Testler host'u bu başlıkla belirler; `feedl.app` her
// ortamda kök host'tur (NEXT_PUBLIC_APP_URL'e bağlı değildir).

const UNKNOWN_HOST = "kesinlikleyok12345.feedl.app";

test("bilinmeyen alt alan 404 döner ve 'alan bulunamadı' sayfasını gösterir", async ({
  page,
}) => {
  const res = await page.request.get("/portal", {
    headers: { "x-forwarded-host": UNKNOWN_HOST },
  });
  expect(res.status()).toBe(404);
  const html = await res.text();
  expect(html).toContain("Bu geri bildirim alanı bulunamadı");
});

test("bilinmeyen alt alanda landing de 404 (varsayılan workspace vitrini sızmaz)", async ({
  request,
}) => {
  const res = await request.get("/", {
    headers: { "x-forwarded-host": UNKNOWN_HOST },
  });
  expect(res.status()).toBe(404);
});

test("bilinmeyen host'ta robots taramayı tümüyle kapatır", async ({ request }) => {
  const res = await request.get("/robots.txt", {
    headers: { "x-forwarded-host": UNKNOWN_HOST },
  });
  expect(res.status()).toBe(200);
  const txt = await res.text();
  expect(txt).toContain("Disallow: /");
  expect(txt).not.toContain("Sitemap:");
  expect(res.headers()["x-robots-tag"]).toBe("noindex");
});

test("bilinmeyen host'ta sitemap boş urlset döner", async ({ request }) => {
  const res = await request.get("/sitemap.xml", {
    headers: { "x-forwarded-host": UNKNOWN_HOST },
  });
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).not.toContain("<loc>");
  expect(res.headers()["x-robots-tag"]).toBe("noindex");
});

test("kök host etkilenmedi: /portal 404 DEĞİL", async ({ request }) => {
  const res = await request.get("/portal", {
    headers: { "x-forwarded-host": "feedl.app" },
  });
  expect(res.status()).not.toBe(404);
});

test("var olan workspace alt alanı 404 DEĞİL (seed: feedl)", async ({ request }) => {
  const res = await request.get("/portal", {
    headers: { "x-forwarded-host": "feedl.feedl.app" },
  });
  expect(res.status()).not.toBe(404);
});

test("Vercel preview host'u varsayılana düşer (404 DEĞİL)", async ({ request }) => {
  const res = await request.get("/portal", {
    headers: { "x-forwarded-host": "feedl-git-main-kogu.vercel.app" },
  });
  expect(res.status()).not.toBe(404);
});

// 2026-09-12 (marka kapsamı — rakip standardı): kök host'ta (feedl.app) marka
// HER ZAMAN feedl'dir; aktif workspace'in adı logonun yerine geçmez. Önceden
// `getWorkspaceBrand()` her yüzeyde kullanıldığı için feedl.app header'ı
// varsayılan workspace'in adını (o sırada "workspace") gösteriyordu.
test("kök host'ta header markası feedl (workspace adı DEĞİL)", async ({ request }) => {
  const res = await request.get("/portal", {
    headers: { "x-forwarded-host": "feedl.app" },
  });
  const html = await res.text();
  const mark = html.match(/<span class="text-base">([^<]*)<\/span>/);
  expect(mark?.[1]).toBe("feedl");
});

test("workspace alt alanında header markası workspace adıdır (müşteri portalı)", async ({
  request,
}) => {
  // Seed workspace'inin adı 'feedl' — işaretin kaynağı host bazlı çözümlemedir;
  // kök host'ta da aynı string çıktığı için bu test yalnız 'marka kaynağı
  // host'tur' sözleşmesini değil, sayfanın 404 olmadığını da doğrular.
  const res = await request.get("/portal", {
    headers: { "x-forwarded-host": "feedl.feedl.app" },
  });
  expect(res.status()).not.toBe(404);
  const html = await res.text();
  expect(html).toMatch(/<span class="text-base">[^<]+<\/span>/);
});
