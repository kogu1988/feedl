// Sprint 63x — Gizlilik Politikası (canlı Paddle onayı için gerçek içerik).
// Veri toplama/kullanımını özetler; şablon değil — gerektiğinde yerel uyumla
// güncellenmeli (KVKK/GDPR).
export const metadata = {
  title: "Gizlilik Politikası · feedl",
  description: "feedl gizlilik politikası — hangi veriyi nasıl işleriz.",
};

export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">Gizlilik Politikası</h1>
      <p className="mt-2 text-sm text-muted-foreground">Son güncelleme: 7 Eylül 2026</p>

      <div className="mt-8 grid gap-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="text-lg font-semibold">1. Topladığımız Veri</h2>
          <p className="mt-2 text-muted-foreground">
            Hesap verisi (ad, e-posta), workspace/ürün verisi (fükürler, oylar,
            yorumlar, etiketler), hizmeti kullanırken oluşan teknik veriler
            (IP, tarayıcı, log) ve ödeme bilgileri (Paddle üzerinden işlenir;
            kart bilgilerini biz saklamayız). Giriş için Clerk kullanılır — bu
            nedenle kimlik doğrulama verisi Clerk tarafından işlenir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Veriyi Neden İşleriz</h2>
          <p className="mt-2 text-muted-foreground">
            Hizmeti sağlamak (fikir toplama, oylama, AI analiz, bildirim),
            hesabını yönetmek, ödemeleri işlemek (Paddle), güvenliği sağlamak ve
            hizmeti iyileştirmek için işleriz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. AI İşleme</h2>
          <p className="mt-2 text-muted-foreground">
            Feedback içeriği, özet/etiket/duygu analizi için AI sağlayıcılarına
            (OpenRouter) gönderilebilir. Bu içerikler ürün ekiplerinin kararlarını
            desteklemek için kullanılır; başkalarıyla satılmaz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Veri Paylaşımı</h2>
          <p className="mt-2 text-muted-foreground">
            Hizmet sağlayıcılarımızla (hosting Vercel, veritabanı Neon, auth
            Clerk, e-posta Resend, ödeme Paddle, analiz Sentry) hizmeti sunmak
            için gerektiğinde paylaşırız. Reklam amaçlı satmıyoruz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Veri Saklama ve Güvenlik</h2>
          <p className="mt-2 text-muted-foreground">
            Veriyi hizmet aktif olduğun sürece saklarız; hesabını sildiğinde
            verilerini sileriz. Şifreleme (aktarımda TLS, gizli anahtarlar için
            AES-256-GCM), erişim kontrolü ve düzenli güvenlik denetimi uygularız.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Çerezler</h2>
          <p className="mt-2 text-muted-foreground">
            Oturum ve tercih için gerekli çerezler kullanırız (Clerk auth,
            tema, aktif workspace). Analitik için üçüncü taraf çerezler olabilir
            (Vercel Analytics, Sentry).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Hakların ve İletişim</h2>
          <p className="mt-2 text-muted-foreground">
            Verine erişim, düzeltme, silme ve işleme itiraz hakların saklıdır.
            Taleplerin için <a href="/contact" className="underline underline-offset-4 hover:text-primary">iletişim</a>{" "}
            sayfasını kullan. İlgili yasalar kapsamında veri koruma yetkilisine
            şikayet hakkın vardır.
          </p>
        </section>
      </div>
    </main>
  );
}
