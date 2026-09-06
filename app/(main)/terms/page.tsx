// Sprint 63x — Kullanım Şartları (canlı Paddle onayı için gerçek içerik).
// Bu, feedl'i kullanan herkes için geçerli hizmet şartlarıdır. (Stub metin
// yerine kullanılabilir içerik; yasal şablon değil — gerektiğinde avukat/yerel
// uyumla güncellenmeli.)
export const metadata = {
  title: "Kullanım Şartları · feedl",
  description: "feedl kullanım şartları — hizmetin nasıl kullanılacağı.",
};

export default function TermsPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">Kullanım Şartları</h1>
      <p className="mt-2 text-sm text-muted-foreground">Son güncelleme: 7 Eylül 2026</p>

      <div className="mt-8 grid gap-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="text-lg font-semibold">1. Kabul</h2>
          <p className="mt-2 text-muted-foreground">
            feedl.app hizmetini kullanarak bu şartları kabul edersin. Hizmeti
            kullanmıyorsan lütfen kullanmayı bırak.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Hizmet</h2>
          <p className="mt-2 text-muted-foreground">
            feedl, müşteri geri bildirimini toplama, analiz etme, önceliklendirme
            ve duyurma için bir SaaS platformudur. Hizmetin kapsamı ve özellikleri
            zamanla değişebilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Hesap ve Sorumluluk</h2>
          <p className="mt-2 text-muted-foreground">
            Hesabının güvenliğinden ve hesabın altında yapılan tüm işlemlerden
            sorumlusun. Feedl&apos;in altyapısına zarar veren, yetkisiz erişim
            sağlayan veya yasa dışı içerik yükleyen kullanım yasaktır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. İçerik ve Veri</h2>
          <p className="mt-2 text-muted-foreground">
            Platforma yüklediğin içerik ve veri senindir. Feedl, hizmeti
            sağlamak için gerekli olduğu ölçüde bu veriyi işler. Başkalarının
            fikri mülkiyetini veya gizliliğini ihlal eden içerik yüklememelisin.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Fiyatlandırma ve Ödeme</h2>
          <p className="mt-2 text-muted-foreground">
            Ücretli planlar Paddle üzerinden tahsil edilir. Ödemeler ve iadeler
            için <a href="/refund" className="underline underline-offset-4 hover:text-primary">İade Politikası</a>{" "}
            geçerlidir. Fiyatlar değişebilir; değişiklikler geçerli fatura
            döneminden sonra uygulanır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Fesih</h2>
          <p className="mt-2 text-muted-foreground">
            Şartları ihlal edersen hizmeti askıya alma veya sonlandırma hakkımız
            saklıdır. Ücretli aboneliklerini kendi isteğinle iptal edebilirsin
            (Paddle üzerinden).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Sorumluluk</h2>
          <p className="mt-2 text-muted-foreground">
            Hizmet &quot;olduğu gibi&quot; sunulur. Kanunun izin verdiği azami
            ölçüde, dolaylı zararlardan sorumlu değiliz. Toplam sorumluluğumuz,
            son 12 ayda ödediğin ücretle sınırlıdır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. İletişim</h2>
          <p className="mt-2 text-muted-foreground">
            Soruların için <a href="/contact" className="underline underline-offset-4 hover:text-primary">iletişim</a>{" "}
            sayfasını kullanabilirsin.
          </p>
        </section>
      </div>
    </main>
  );
}
