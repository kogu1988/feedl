// Sprint 63x — İletişim (canlı: hi@feedl.app EForw yönlendirmesi aktif).
// Footer + legal sayfalar (Gizlilik/Şartlar/İade) /contact'a link veriyor.
// Basit, mailto tabanlı içerik — form/CRM ileride eklenebilir. Erişilebilirlik:
// mailto linki gerçek bir <a href="mailto:"> ve görünür label taşır.
export const metadata = {
  title: "İletişim · feedl",
  description: "feedl hakkında soruların, geri bildirimin veya satış görüşmesi taleplerin için bize yaz.",
};

export default function ContactPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">İletişim</h1>
      <p className="mt-4 max-w-prose text-muted-foreground">
        Soruların, özellik taleplerin, geri bildirimin veya satış görüşmesi
        taleplerin için bize yaz. Tüm mesajlar ekibimiza ulaşır; en kısa
        sürede dönüş yaparız.
      </p>

      <div className="mt-10 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold">Doğrudan e-posta</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Bize en hızlı şekilde e-posta ile ulaşabilirsin. Cevap oranımız
          yüksektir — genellikle 1 iş günü içinde yanıtlarız.
        </p>
        <a
          href="mailto:hi@feedl.app"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">✉️</span>
          <span>hi@feedl.app</span>
        </a>
        <p className="mt-3 text-xs text-muted-foreground">
          E-posta istemcin otomatik açılır; konu alanını kısaca doldurun.
        </p>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Neler için yazabilirsin?</h2>
        <ul className="mt-4 max-w-prose space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span><span className="font-medium text-foreground">Ürün:</span> özellik önerisi, hata bildirimi, kullanım soruları.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span><span className="font-medium text-foreground">Satış:</span> fiyatlandırma, kurumsal takım, özel domain / entegrasyon.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span><span className="font-medium text-foreground">Fatura &amp; iade:</span> abonelik, fatura veya iade durumu — <a href="/refund" className="underline underline-offset-4 hover:text-primary">İade Politikası</a> sayfasına da göz at.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span><span className="font-medium text-foreground">Hukuk:</span> gizlilik veya veri talepleri — <a href="/privacy" className="underline underline-offset-4 hover:text-primary">Gizlilik Politikası</a>.</span>
          </li>
        </ul>
      </div>
    </main>
  );
}
