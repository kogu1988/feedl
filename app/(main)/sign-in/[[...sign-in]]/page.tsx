import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

// Giriş sayfası site kabuğu (üst bar + alt bar) içinde ortalanır —
// min-h-screen kabukla çakışıyordu, kaldırıldı. signUpUrl, kart içi
// "Sign up" bağlantısını doğru sayfaya bağlar.
export default function SignInPage() {
  return (
    <main className="container mx-auto flex flex-col items-center justify-center px-4 py-16">
      <SignIn signUpUrl="/sign-up" />
      <p className="mt-6 text-sm text-muted-foreground">
        Hesabın yok mu?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
        >
          Kayıt ol
        </Link>
      </p>
    </main>
  );
}
