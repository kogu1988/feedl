import { SignIn } from "@clerk/nextjs";

// Giriş sayfası site kabuğu (üst bar + alt bar) içinde ortalanır —
// min-h-screen kabukla çakışıyordu, kaldırıldı. signUpUrl, kart içi
// "Sign up" bağlantısını doğru sayfaya bağlar. Clerk kartı trTR
// (layout localization) olduğundan sayfa-altı "Kayıt ol" tekrarı YOK
// (audit P1: self-link + üçlü tekrar). Kart üstüne marka logosu eklenir.
export default function SignInPage() {
  return (
    <main className="container mx-auto flex flex-col items-center justify-center gap-6 px-4 py-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_brand_orange.svg" alt="feedl" className="size-12 shrink-0 object-contain" />
      <SignIn signUpUrl="/sign-up" />
    </main>
  );
}
