// Sprint 63x — İade Politikası (canlı Paddle onayı gereksinimi). subscription
// iptal/iade yaklaşımını net söyler. Kanuna uygun şablon değil — değişebilir.
export const metadata = {
  title: "İade Politikası · feedl",
  description: "feedl iade ve iptal politikası.",
};

export default function RefundPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">İade Politikası</h1>
      <p className="mt-2 text-sm text-muted-foreground">Son güncelleme: 7 Eylül 2026</p>

      <div className="mt-8 grid gap-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="text-lg font-semibold">1. Kapsam</h2>
          <p className="mt-2 text-muted-foreground">
            Bu politika, feedl&apos;in ücretli planları (Pro) için geçerlidir.
            Ödemeler Paddle üzerinden işlenir; iade süreçleri Paddle&apos;ın
            desteklediği dönem içinde geçerlidir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. İptal</h2>
          <p className="mt-2 text-muted-foreground">
            Aboneliğini istediğin an Faturalandırma sayfasındaki &quot;Faturalandırmayı
            Yönet&quot; üzerinden iptal edebilirsin. İptal, mevcut fatura
            döneminin sonunda geçerli olur; o dönem boyunca hizmete erişimin açık
            kalır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. İade</h2>
          <p className="mt-2 text-muted-foreground">
            Satın alma tarihinden itibaren 14 gün içinde iade talep edebilirsin.
            İade, kullanılmamış dönem için Paddle üzerinden işlenir; kartına
            iade süresi bankana bağlı olarak birkaç iş günü sürebilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. İstisnalar</h2>
          <p className="mt-2 text-muted-foreground">
            Kullanılmış tam dönem veya aşırı kullanım (AI kota aşımı) içeren
            dönemlerde iade, Paddle&apos;ın uygun gördüğü oranla sınırlı olabilir.
            Hizmet şartlarını ihlal nedeniyle yapılan fesihlerde iade yapılmaz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. İletişim</h2>
          <p className="mt-2 text-muted-foreground">
            İade veya fatura soruları için <a href="/contact" className="underline underline-offset-4 hover:text-primary">iletişim</a>{" "}
            sayfasını kullan; en kısa sürede yanıtlarız.
          </p>
        </section>
      </div>
    </main>
  );
}
