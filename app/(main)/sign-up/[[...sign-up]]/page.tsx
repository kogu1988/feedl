import { SignUp } from "@clerk/nextjs";

// Kayıt sayfası site kabuğu (üst bar + alt bar) içinde ortalanır.
// Kayıt sonrası onboarding akışı landing/demo CTA'larındaki
// forceRedirectUrl ile yönetilir; burada yönlendirme prop'u yok.
// signInUrl, kart içi "Sign in" bağlantısını doğru sayfaya bağlar.
// Clerk kartı trTR olduğundan sayfa-altı "Giriş yap" tekrarı YOK (audit P1).
export default function SignUpPage() {
  return (
    <main className="container mx-auto flex flex-col items-center justify-center px-4 py-16">
      <SignUp signInUrl="/sign-in" />
    </main>
  );
}
