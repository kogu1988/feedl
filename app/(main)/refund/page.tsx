import { LEGAL } from "@/lib/legal";

// Sprint 64 — Refund Policy (Paddle canlı onayı). Kullanıcı sağlanan tam metin.
export const metadata = {
  title: "İade Politikası · feedl",
  description: "feedl iade ve iptal politikası.",
};

export default function RefundPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">İade Politikası</h1>
      <p className="mt-2 text-sm text-muted-foreground">Son güncelleme: 8 Eylül 2026</p>

      <div className="mt-8 grid gap-8 text-sm leading-relaxed text-foreground">
        <section>
          <p className="text-muted-foreground">
            Bu Refund Policy (“İade Politikası”), Feedl&apos;in ücretli planları ve abonelikleri
            için geçerli iade, iptal ve cayma koşullarını açıklar.
          </p>
          <p className="mt-2 text-muted-foreground">
            Feedl&apos;in işletmecisi:
            <br />
            <strong>{LEGAL.companyName}</strong>
            <br />
            Adres: {LEGAL.address}
            <br />
            Destek: <a href={`mailto:${LEGAL.supportEmail}`} className="underline hover:text-primary">{LEGAL.supportEmail}</a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">1. Paddle Merchant of Record</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl&apos;in ücretli planlarında ödeme işlemleri Paddle üzerinden gerçekleştirilir.
            Paddle.com, ilgili işlemlerde Merchant of Record ve yetkili satıcıdır. Bu nedenle
            ödeme, faturalandırma, vergi, işlem makbuzları ve iade işlemlerinin önemli bir bölümü
            Paddle tarafından yürütülür. Paddle&apos;ın güncel Refund Policy&apos;si ve Buyer
            Terms&apos;ü, uygulanabilir olduğu ölçüde bu politika ile birlikte değerlendirilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Yasal Haklar Saklıdır</h2>
          <p className="mt-2 text-muted-foreground">
            Bu İade Politikası hiçbir şekilde tüketicilerin yürürlükteki zorunlu yasal haklarını
            ortadan kaldırmaz veya sınırlandırmaz. Tüketici koruma mevzuatının zorunlu iade veya
            cayma hakkı verdiği durumlarda ilgili yasal hak uygulanır. Uygulanabilir tüketici
            mevzuatı ile Paddle&apos;ın güncel Buyer Terms ve Refund Policy hükümleri, geçerli
            olduğu ölçüde bu politika ile birlikte değerlendirilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Genel İade Politikası</h2>
          <p className="mt-2 text-muted-foreground">
            Yürürlükteki hukuk tarafından zorunlu tutulmadıkça veya Feedl ya da Paddle tarafından
            ayrıca kabul edilmedikçe, ücretli abonelik ödemeleri otomatik olarak iade edilmez.
            Bununla birlikte yasal cayma hakları, ürünün tanımlandığı şekilde sunulmaması, ürünün
            kusurlu olması, uygulanabilir tüketici koruma hakları ve Feedl veya Paddle tarafından
            gönüllü olarak onaylanan iadeler saklıdır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Abonelik İptali</h2>
          <p className="mt-2 text-muted-foreground">
            Aboneliğinizi istediğiniz zaman iptal edebilirsiniz. İptal, aksi belirtilmedikçe mevcut
            ücretli faturalandırma döneminin sonunda geçerli olur. İptal sonrasında mevcut
            faturalandırma döneminin sonuna kadar ücretli özelliklere erişiminiz devam edebilir.
            Aboneliğin iptal edilmesi, daha önce ödenmiş tutarın otomatik olarak iade edileceği
            anlamına gelmez.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Yasal Cayma Hakkı</h2>
          <p className="mt-2 text-muted-foreground">
            Uygulanabilir tüketici mevzuatı ve Paddle&apos;ın güncel Buyer Terms / Refund Policy
            hükümleri uyarınca cayma hakkınız varsa bu hakkı ilgili yasal süre içinde
            kullanabilirsiniz. Cayma hakkının kapsamı, süresi ve istisnaları (ör. dijital hizmetin
            kullanımına başlanması ve tüketicinin açık onayı) bulunduğunuz ülkenin mevzuatına ve
            Paddle&apos;ın güncel politikasına göre belirlenir. Ülkeye özgü güncel ayrıntılar için
            Paddle dokümantasyonunu esas almanızı öneririz; bu sayfada ülke bazlı süre taahhüdü
            verilmez. Hiçbir hüküm, tüketici mevzuatının zorunlu hükümlerini geçersiz kılmaz.
          </p>
          <p className="mt-2 text-muted-foreground">
            <strong>Ücretsiz deneme ≠ cayma hakkı ≠ iade süresi.</strong> Bunlar üç ayrı
            kavramdır: (i) ücretsiz deneme, satın alma sırasında belirtilen süre boyunca ücret
            alınmadan kullanımı ifade eder; (ii) yasal cayma hakkı, ödenen bedele ilişkin olarak
            mevzuatın tanıdığı haktır; (iii) iade süresi (§11), onaylanan bir iadenin ödeme
            yöntemine dönüş süresidir. Ücretsiz deneme süresi, cayma hakkı süresi olarak
            yorumlanmamalıdır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. İade Talebi Nasıl Yapılır?</h2>
          <p className="mt-2 text-muted-foreground">
            İade veya cayma talebi için öncelikle Paddle&apos;ın işlem makbuzunda veya abonelik
            yönetim alanında bulunan destek/iade seçeneklerini kullanmanızı öneririz. Ayrıca Feedl
            ile <a href={`mailto:${LEGAL.supportEmail}`} className="underline hover:text-primary">{LEGAL.supportEmail}</a>{" "}
            üzerinden iletişime geçebilirsiniz. İade talebinizde mümkünse siparişte kullanılan
            e-posta adresini, işlem veya abonelik bilgilerini ve iade talebinin nedenini belirtin.
            Paddle&apos;ın güncel politikasına göre iade talepleri işlem makbuzundaki “View receipt”
            veya “Manage subscription” bağlantılarından ya da Paddle&apos;ın destek sistemi
            üzerinden yapılabilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Gönüllü / Takdiri İadeler</h2>
          <p className="mt-2 text-muted-foreground">
            Yasal olarak zorunlu olmadığı halde Feedl veya Paddle bir iade talebini
            değerlendirebilir. Böyle bir iade talep özelinde değerlendirilir; gelecekte aynı
            durumda iade yapılacağı anlamına gelmez veya bir emsal oluşturmaz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Hatalı veya Çalışmayan Hizmet</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl&apos;in tanımlanan temel işlevlerini makul şekilde yerine getirmediğini
            düşünüyorsanız bizimle iletişime geçin. Sorunu tespit etmeye, makul olduğu ölçüde
            gidermeye ve gerekli olması halinde uygun bir çözüm sunmaya çalışırız. Bu bölüm,
            tüketicilerin uygulanabilir yasal haklarını sınırlamaz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Kötüye Kullanım ve Dolandırıcılık</h2>
          <p className="mt-2 text-muted-foreground">
            Sahte veya çalıntı ödeme yöntemi kullanılması, iade sisteminin kötüye kullanılması,
            dolandırıcılık şüphesi, hizmetin sistematik olarak tüketilip ardından iade talep
            edilmesi, ödeme veya abonelik sisteminin manipüle edilmesi gibi durumlarda iade talebi
            reddedilebilir veya erişim geçici olarak askıya alınabilir. Bu hükümler yasal iade
            veya tüketici haklarını ortadan kaldırmaz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. İade Sonrası Erişim</h2>
          <p className="mt-2 text-muted-foreground">
            Bir işlem için iade onaylandığında, ilgili ücretli hizmete erişim sona erebilir veya
            ücretsiz plana düşürülebilir. İade işleminin tamamlanması, mevcut verilerin otomatik
            olarak silineceği anlamına gelmez. Veri saklama ve silme işlemleri Feedl Privacy
            Policy&apos;ye tabidir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">11. İadenin İşlenmesi</h2>
          <p className="mt-2 text-muted-foreground">
            İade Paddle tarafından işleniyorsa, mümkün olduğu ölçüde ödeme sırasında kullanılan aynı
            ödeme yöntemine yapılır. Paddle&apos;ın güncel politikasına göre uygun görülen iadeler,
            onaylandıktan sonra mümkün olduğunda aynı ödeme yöntemiyle ve 14 gün içinde işlenir.
            Bankaların veya ödeme kuruluşlarının işlem süreleri Feedl veya Paddle&apos;ın kontrolü
            dışında olabilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">12. Chargeback ve Ödeme Uyuşmazlıkları</h2>
          <p className="mt-2 text-muted-foreground">
            Bir ödeme hakkında sorun yaşarsanız öncelikle Feedl veya Paddle ile iletişime
            geçmenizi öneririz. Bir chargeback veya ödeme uyuşmazlığı başlatılması halinde, ilgili
            işlem inceleme süresince hesabınıza veya ücretli özelliklere erişim geçici olarak
            sınırlandırılabilir. Bu hüküm, geçerli kart kuruluşu kurallarından veya tüketici koruma
            mevzuatından doğan haklarınızı sınırlamaz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">13. Vergiler</h2>
          <p className="mt-2 text-muted-foreground">
            Paddle&apos;ın Merchant of Record olarak gerçekleştirdiği işlemlerde uygulanabilir satış
            vergisi, KDV veya benzeri vergiler işlem sırasında hesaplanabilir ve tahsil edilebilir.
            Vergi iadesi veya vergi muafiyeti talepleri, uygulanabilir hukuk ve Paddle&apos;ın ilgili
            prosedürlerine tabidir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">14. Politika Değişiklikleri</h2>
          <p className="mt-2 text-muted-foreground">
            Bu İade Politikasını zaman zaman güncelleyebiliriz. Bir işlemin iadesi
            değerlendirilirken, aksi yasal olarak zorunlu olmadıkça işlem tarihindeki uygulanabilir
            politika esas alınır. Önemli değişiklikler olduğunda güncel politika bu sayfada
            yayınlanır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">15. İletişim</h2>
          <p className="mt-2 text-muted-foreground">
            İade, iptal veya faturalandırma hakkında sorularınız için:
            <br />
            <strong>{LEGAL.companyName}</strong>
            <br />
            Adres: {LEGAL.address}
            <br />
            Destek: <a href={`mailto:${LEGAL.supportEmail}`} className="underline hover:text-primary">{LEGAL.supportEmail}</a>
            <br />
            Ödeme işlemi Paddle tarafından gerçekleştirildiyse, Paddle&apos;ın işlem makbuzunda veya
            abonelik yönetim ekranında yer alan destek kanallarını da kullanabilirsiniz.
          </p>
        </section>
      </div>
    </main>
  );
}
