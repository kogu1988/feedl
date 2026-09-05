import { SignIn } from "@clerk/nextjs";

// Giriş sayfası site kabuğu (üst bar + alt bar) içinde ortalanır —
// min-h-screen kabukla çakışıyordu, kaldırıldı. signUpUrl, kart içi
// "Sign up" bağlantısını doğru sayfaya bağlar. Clerk kartı trTR
// (layout localization) olduğundan sayfa-altı "Kayıt ol" tekrarı YOK
// (audit P1: self-link + üçlü tekrar).
export default function SignInPage() {
  return (
    <main className="container mx-auto flex flex-col items-center justify-center px-4 py-16">
      <SignIn signUpUrl="/sign-up" />
    </main>
  );
}
