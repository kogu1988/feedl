import { setupClerkTestingToken } from "@clerk/testing/playwright";
import type { BrowserContext } from "@playwright/test";

// Sprint 63x (B) — tam authed E2E. Clerk dev instance test token'ı ile
// oturum taklidi kurulur. Yalnız clerkSetup() global setup'a coin; burada
// context başına bot-koruma bypass'ı + (gerekirse) oturum enjeksiyonu.
//
// Eğer Clerk E2E env'leri yoksa (CI'da gizli anahtarsız) testleri KOŞTURMA —
// `isAuthConfigured()` false döner ve auth-flow projesi skip edilir. Böylece
// `npm run build` / smoke CI'ı gizli anahtar olmadan da yeşil kalır.

export function isAuthConfigured(): boolean {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secretKey = process.env.CLERK_SECRET_KEY ?? "";
  if (!publishableKey || !secretKey) return false;
  // CI, server'ın ayağa kalkabilmesi için FORMAT geçerli ama SAHTE bir
  // publishable key kullanır (bkz. .github/workflows/ci.yml). Bu anahtarla
  // `clerkSetup()` gerçek bir Clerk örneğine ulaşamaz; auth testleri anlamsız
  // şekilde koşup kırmızı olur. Placeholder secret key ile bu testleri atla.
  if (secretKey.includes("placeholder")) return false;
  return true;
}

// Bir browser context'i Clerk test token'ıyla yapılandırır (bot koruması
// bypass'ı). Clerk dev instance'da "fakes" (test kullanıcıları) etkinse
// ClerkProvider otomatik test kullanıcısıyla oturum açar.
export async function setupClerkAuthContext(
  context: BrowserContext,
): Promise<void> {
  if (!isAuthConfigured()) return;
  // options.frontendApiUrl Clerk educedan publishable key'den türetilir;
  // Clerk `setupClerkTestingToken` bunu kendisi çözer.
  await setupClerkTestingToken({ context });
}

// Yerelde oturum cookie'sini (__session) doğrudan enjekte etmek istenirse:
// Clerk dashboard "Generate test token" çıktısını buraya koy (E2E_TOKEN).
export async function injectSessionFromToken(
  context: BrowserContext,
  token: string,
): Promise<void> {
  await context.addCookies([
    {
      name: "__session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}
