import { SignUp } from "@clerk/nextjs";

// Kayıt sayfası site kabuğu (üst bar + alt bar) içinde ortalanır.
// Kayıt sonrası onboarding akışı landing/demo CTA'larındaki
// forceRedirectUrl ile yönetilir; /sign-up'a DOĞRUDAN gelenler için
// afterSignUpUrl=/onboarding ile her kayıt noktası onboarding'e düşer
// (header/landing farkı bug'ı 2026-09-07'de kapatıldı).
// signInUrl, kart içi "Sign in" bağlantısını doğru sayfaya bağlar.
// Clerk kartı trTR olduğundan sayfa-altı "Giriş yap" tekrarı YOK (audit P1).
export default function SignUpPage() {
  return (
    <main className="container mx-auto flex flex-col items-center justify-center gap-6 px-4 py-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_brand_orange.svg" alt="feedl" className="size-12 shrink-0 object-contain" />
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />
    </main>
  );
}
