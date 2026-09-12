// Middleware'de hangi isteklerin Clerk oturumu GEREKTİRMEDİĞİNİ belirler.
//
// Neden `createRouteMatcher` DEĞİL (2026-09-12, teknik borç #21): Clerk'in
// `createRouteMatcher`'ı deprecated (v8'de kalkacak) ve gerekçesi tam olarak bu
// repoda üç kez bug üreten sınıf: "path matching … leave protected resources
// reachable". Açık bir allowlist + birim testleri bu yüzeyi denetlenebilir kılar.
//
// KURAL: listede YOKSA KORUNUR (fail-closed). Yeni bir public uç eklerken
// buraya bilinçli olarak yazmak gerekir; sessizce açılan kapı olmaz.
// Testler: tests/lib/public-paths.test.ts

// Tam eşleşme gereken yollar (kök ve tek segmentli sayfalar).
const PUBLIC_EXACT = new Set([
  "/",
  "/pricing",
  // SEO: ticari niyetli karşılaştırma sayfası + kurulum rehberi.
  "/alternative",
  "/how-to-collect-feedback",
  // Ürün turu + demo.
  "/demo",
  // Yasal/şirket sayfaları (footer).
  "/privacy",
  "/terms",
  "/refund",
  "/contact",
  // Crawler'lar için; auth istemez.
  "/robots.txt",
  "/sitemap.xml",
  // Widget SDK'sının iframe kabuğu (Clerk oturumu taşımaz).
  "/widget",
]);

// Alt yolları da kapsayan önekler. `isPublicPath` bunları segment sınırında
// eşler: "/api/posts" öneki "/api/posts-oyun"ı AÇMAZ (fail-closed ayrıntısı).
const PUBLIC_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/portal",
  "/roadmap",
  "/changelog",
  // Davet kabulü: davet linkine tıklayan kullanıcı çoğu zaman oturumsuzdur.
  "/invites",
  // Public API + widget + webhook yüzeyleri: kimlik handler içinde (Bearer API
  // key / widget JWT / imza doğrulaması) çözülür.
  "/api/posts",
  "/api/v1",
  "/api/widget",
  "/api/webhooks",
  // Paddle uçları + görsel feedback proxy'i: auth'u handler'da (getAdminUserId).
  "/api/paddle",
  "/api/visual-feedback",
  // Dış servis webhook'ları (Linear/Jira/Slack/Zendesk/Intercom): kendi imzaları.
  "/api/integrations",
  "/api/inngest",
  "/api/changelog",
  // Bildirim e-postalarındaki token'lı unsubscribe linki — alıcının oturumu yok.
  "/api/unsubscribe",
  // ── Handler auth'u olan API namespace'leri ──────────────────────────────
  // Middleware'de `protect()` etmek bu uçları Clerk redirect'ine/404'üne
  // çeviriyordu; API istemcisi düzgün JSON 401 görmeli. Denetim (2026-09-12):
  // aşağıdaki namespace'lerin TÜM handler'ları kendi auth'unu yapıyor
  // (getAdminUserId / getTeamUserId / auth()). Denetim komutu README #21'de.
  "/api/admin",
  "/api/comments",
  "/api/corpus-insights",
  "/api/invites",
  "/api/onboarding",
  "/api/votes",
];

// Sondaki tek eğik çizgiyi at (kök hariç): "/pricing/" → "/pricing".
function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isPublicPath(pathname: string): boolean {
  const path = normalize(pathname);
  if (PUBLIC_EXACT.has(path)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
