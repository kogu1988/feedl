import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

// Kayıt sayfası site kabuğu (üst bar + alt bar) içinde ortalanır.
// Kayıt sonrası onboarding akışı landing/demo CTA'larındaki
// forceRedirectUrl ile yönetilir; burada yönlendirme prop'u yok.
// signInUrl, kart içi "Sign in" bağlantısını doğru sayfaya bağlar.
export default function SignUpPage() {
  return (
    <main className="container mx-auto flex flex-col items-center justify-center px-4 py-16">
      <SignUp signInUrl="/sign-in" />
      <p className="mt-6 text-sm text-muted-foreground">
        Zaten hesabın var mı?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
        >
          Giriş yap
        </Link>
      </p>
    </main>
  );
}
