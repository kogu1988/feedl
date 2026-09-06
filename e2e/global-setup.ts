import { clerkSetup } from "@clerk/testing/playwright";

import { isAuthConfigured } from "./auth-helpers";

// Sprint 63x (B) — Clerk test token'ı bir kez çek (global setup). `clerkSetup`
// Clerk Backend API'den test token alır (CLERK_SECRET_KEY + publishable key
// gerektirir). Env yoksa hiçbir şey yapmaz — auth-flow projesi zaten atlanır.
export default async function globalSetup() {
  if (!isAuthConfigured()) return;
  try {
    await clerkSetup({
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });
  } catch (err) {
    // Test token alınamazsa auth akışları atlanacak; smoke/a11y etkilenmez.
    console.warn(
      "Clerk test token hazırlanamadı — auth-flow atlanacak:",
      err instanceof Error ? err.message : err,
    );
  }
}
