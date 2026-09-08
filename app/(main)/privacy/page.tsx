import { LEGAL } from "@/lib/legal";

// Sprint 64 — Privacy Policy (Paddle canlı onayı gereksinimi). Kullanıcı
// tarafından sağlanan tam metin; LEGAL config'ten şirket/email çekilir.
export const metadata = {
  title: "Gizlilik Politikası · feedl",
  description: "feedl gizlilik politikası — hangi veriyi nasıl toplar, kullanır ve saklarız.",
};

export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">Gizlilik Politikası</h1>
      <p className="mt-2 text-sm text-muted-foreground">Son güncelleme: 8 Eylül 2026</p>

      <div className="mt-8 grid gap-8 text-sm leading-relaxed text-foreground">
        <section>
          <p className="text-muted-foreground">
            Bu Gizlilik Politikası (“Politika”), Feedl hizmetinin (“Feedl”, “Hizmet”,
            “Platform”, “biz”, “bize” veya “bizim”) kişisel verileri nasıl topladığını,
            kullandığını, sakladığını ve paylaştığını açıklar.
          </p>
          <p className="mt-2 text-muted-foreground">
            Feedl, müşteri geri bildirimlerini toplamak, analiz etmek, önceliklendirmek ve
            müşterilere duyurmak amacıyla kullanılan bir SaaS platformudur.
          </p>
          <p className="mt-2 text-muted-foreground">
            Feedl&apos;in işletmecisi:
            <br />
            <strong>{LEGAL.companyName}</strong>
            <br />
            Adres: {LEGAL.address}
            <br />
            E-posta: <a href={`mailto:${LEGAL.privacyEmail}`} className="underline hover:text-primary">{LEGAL.privacyEmail}</a>
          </p>
          <p className="mt-2 text-muted-foreground">
            Feedl&apos;i kullanarak bu Politikada açıklanan veri işleme faaliyetlerini kabul etmiş olursunuz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">1. Topladığımız Bilgiler</h2>
          <p className="mt-2 text-muted-foreground">Hizmeti kullandığınızda aşağıdaki kategorilerde bilgi toplayabiliriz.</p>
          <h3 className="mt-2 font-medium">1.1. Hesap ve kimlik bilgileri</h3>
          <p className="mt-1 text-muted-foreground">
            Hesap oluşturduğunuzda veya bir çalışma alanına katıldığınızda: ad ve soyad,
            e-posta adresi, profil bilgileri, kullanıcı ve hesap kimlikleri, çalışma
            alanı/organizasyon bilgileri, kullanıcı rolü ve yetkileri gibi bilgiler
            işlenebilir. Kimlik doğrulama hizmetleri için üçüncü taraf bir kimlik
            sağlayıcısı kullanabiliriz.
          </p>
          <h3 className="mt-2 font-medium">1.2. Feedl&apos;e gönderilen içerikler</h3>
          <p className="mt-1 text-muted-foreground">
            Feedl üzerinden oluşturduğunuz veya gönderdiğiniz: müşteri geri bildirimleri,
            fikirler ve talepler, yorumlar, oylar, takipler, roadmap ve changelog içerikleri,
            dahili notlar, müşteri veya şirket bilgileri, gelir/fırsat bilgileri,
            entegrasyonlardan aktarılan veriler hizmetin sağlanması amacıyla işlenebilir.
            Bir çalışma alanındaki yöneticiler tarafından gönderilen içerikler, o çalışma
            alanının diğer kullanıcılarına veya public portal ziyaretçilerine görünür hale
            getirilebilir. Kullanıcılar, bir içeriğin public olarak yayınlanmasından önce
            gerekli izinlere sahip olduklarından sorumludur.
          </p>
          <h3 className="mt-2 font-medium">1.3. Teknik bilgiler</h3>
          <p className="mt-1 text-muted-foreground">
            Hizmeti kullandığınızda IP adresi, tarayıcı ve cihaz bilgileri, işletim sistemi,
            yaklaşık konum bilgisi, ziyaret edilen sayfalar, kullanım zamanı ve süresi, hata
            kayıtları, performans ve güvenlik kayıtları, oturum ve kimlik doğrulama bilgileri
            otomatik olarak toplanabilir.
          </p>
          <h3 className="mt-2 font-medium">1.4. Ödeme ve abonelik bilgileri</h3>
          <p className="mt-1 text-muted-foreground">
            Ücretli Feedl planlarında ödeme işlemleri Paddle üzerinden gerçekleştirilir.
            Paddle, ilgili işlemlerde Merchant of Record ve yetkili satıcı olarak hareket eder.
            Paddle ödeme, faturalandırma, vergi ve işlemle ilgili bazı müşteri destek
            süreçlerini yönetebilir. Feedl, Paddle üzerinden işlenen kart bilgilerinin
            tamamını doğrudan saklamaz. Ödeme işlemlerine ilişkin işlem kimliği, abonelik
            durumu, plan, dönem ve benzeri bilgiler Feedl sistemlerinde hizmetin sağlanması
            için tutulabilir.
          </p>
          <h3 className="mt-2 font-medium">1.5. Entegrasyon verileri</h3>
          <p className="mt-1 text-muted-foreground">
            Feedl; Slack, Zendesk, Intercom, Linear, Jira, webhook ve API gibi entegrasyonlar
            sağlayabilir. Bir entegrasyonu etkinleştirdiğinizde ilgili hizmetten Feedl&apos;e
            aktarılan veriler işlenebilir. Entegrasyonlara ait erişim bilgileri ve secret
            değerleri güvenlik amacıyla şifrelenmiş biçimde saklanabilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Bilgileri Neden Kullanıyoruz?</h2>
          <p className="mt-2 text-muted-foreground">
            Kişisel verileri; hesap oluşturma ve yönetme, kimlik doğrulama ve yetkilendirme,
            çalışma alanı ve kullanıcı rolleri yönetme, geri bildirim/oy/roadmap işleme, AI
            destekli özetleme/sınıflandırma/benzerlik/duygu analizi, entegrasyonları
            çalıştırma, e-posta ve bildirim gönderme, abonelik ve ödeme durumu yönetme,
            hizmet güvenliği, kötüye kullanım/spam/dolandırıcılık tespiti, hata ve performans
            teşhisi, hizmeti geliştirme, yasal yükümlülükler ve kullanıcı veya üçüncü taraf
            haklarını koruma amaçlarıyla kullanabiliriz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. AI Özellikleri</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl&apos;in bazı özellikleri üçüncü taraf yapay zeka ve makine öğrenimi
            servislerinden yararlanabilir. Bu özellikleri kullandığınızda, ilgili özellik
            için gerekli olan içerik üçüncü taraf AI sağlayıcılarına aktarılabilir. AI
            servisleri; içeriği özetlemek, sınıflandırmak, etiketlemek, benzer içerikleri
            belirlemek, duygu veya tema analizi yapmak ve toplu geri bildirimlerden içgörü
            üretmek için kullanılabilir. AI tarafından üretilen sonuçlar hatalı, eksik veya
            yanlış yorumlanmış olabilir; profesyonel, hukuki, finansal veya başka bir uzman
            tavsiyesi olarak değerlendirilmemelidir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Verilerin Paylaşılması</h2>
          <p className="mt-2 text-muted-foreground">
            Kişisel verileri; kimlik doğrulama, bulut hosting ve altyapı, veritabanı ve
            depolama, AI/ML, e-posta ve bildirim, ödeme ve Merchant of Record sağlayıcısı
            Paddle, hata izleme ve performans, analitik, güvenlik/rate limiting/fraud
            prevention ve entegrasyon sağlayıcılarıyla paylaşabiliriz. Ayrıca kanunen zorunlu
            olduğunda, geçerli mahkeme kararı resmi talep veya hukuki süreçte, dolandırıcılık
            güvenlik veya kötüye kullanımı önlemek için, hakların ve güvenliğin korunmasında
            ve şirket birleşmesi, satın alma, yeniden yapılanma veya varlık devri kapsamında
            bilgi paylaşabiliriz. Kişisel verileri bağımsız bir veri ürünü olarak satmayız.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Çalışma Alanı ve Public Portal Verileri</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl, müşterilerin kendi public geri bildirim portallarını oluşturmasına izin
            verir. Bir çalışma alanı yöneticisi içeriği public olarak yayınladığında, bu
            içerik internet üzerindeki diğer kişiler tarafından görüntülenebilir,
            kopyalanabilir veya başka şekillerde kullanılabilir. Feedl, müşterilerinin kendi
            kullanıcılarından topladığı kişisel veriler üzerinde her durumda veri sorumlusu
            olmayabilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Çerezler ve Analitik</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl, zorunlu çerezler ve benzeri teknolojileri kullanabilir. Hizmetin kullanımı,
            performansı ve güvenilirliğini anlamak amacıyla analitik veya performans araçları
            kullanılabilir — bunlar arasında yapılandırmaya bağlı olarak Google Analytics,
            Vercel Analytics, Vercel Speed Insights ve Sentry bulunabilir. Zorunlu olmayan
            çerezler veya benzeri teknolojiler için gerekli olduğu durumlarda kullanıcıdan
            izin alınır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Veri Saklama</h2>
          <p className="mt-2 text-muted-foreground">
            Kişisel verileri yalnızca toplandıkları amaçların gerçekleştirilmesi için gerekli
            olduğu sürece veya yasal, muhasebesel, güvenlik ve uyuşmazlık çözümü ihtiyaçları
            nedeniyle saklarız. Bir hesabın silinmesinden sonra veriler makul süre içerisinde
            silinebilir veya anonimleştirilebilir; ancak yasal olarak saklamamız gereken
            bilgiler, güvenlik kayıtları, finansal işlem kayıtları veya devam eden
            uyuşmazlıklarla ilişkili veriler daha uzun süre saklanabilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Veri Güvenliği</h2>
          <p className="mt-2 text-muted-foreground">
            Kişisel verileri yetkisiz erişim, değişiklik, kayıp veya kötüye kullanıma karşı
            korumak için erişim kontrolü, rol tabanlı yetkilendirme, şifreleme, güvenli
            bağlantılar, API erişim kontrolleri, rate limiting, güvenlik izleme, hata ve olay
            izleme gibi makul teknik ve organizasyonel önlemler uygularız. Bununla birlikte
            internet üzerinden gerçekleştirilen hiçbir veri aktarımının veya elektronik
            depolamanın mutlak şekilde güvenli olduğunu garanti edemeyiz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Uluslararası Veri Aktarımları</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl ve hizmet sağlayıcıları farklı ülkelerde bulunabilir. Bu nedenle kişisel
            veriler ülkeniz dışındaki sunuculara veya hizmet sağlayıcılara aktarılabilir.
            Uluslararası veri aktarımı gerektiğinde, uygulanabilir veri koruma mevzuatının
            gerektirdiği uygun güvenlik ve aktarım mekanizmalarını kullanmaya çalışırız.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. Veri Koruma Hakları</h2>
          <p className="mt-2 text-muted-foreground">
            Bulunduğunuz ülkeye ve uygulanabilir mevzuata bağlı olarak kişisel verilerinize
            erişme, yanlış verilerin düzeltilmesini isteme, verilerin silinmesini isteme, veri
            işlemeye itiraz etme, işlemenin sınırlandırılmasını isteme, verilerin
            taşınabilirliğini isteme, verdiğiniz bazı izinleri geri çekme ve ilgili veri
            koruma otoritesine şikayette bulunma haklarına sahip olabilirsiniz. Türkiye&apos;de
            uygulanabilir olduğu ölçüde 6698 sayılı Kişisel Verilerin Korunması Kanunu
            (“KVKK”) kapsamındaki haklarınız da saklıdır. Haklarınızı kullanmak için{" "}
            <a href={`mailto:${LEGAL.privacyEmail}`} className="underline hover:text-primary">{LEGAL.privacyEmail}</a>{" "}
            adresine başvurabilirsiniz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">11. Çocukların Gizliliği</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl, çocuklara yönelik bir hizmet değildir. 13 yaşından küçük çocuklardan
            bilerek kişisel veri toplamayız. Uygulanabilir yerel mevzuat daha yüksek bir yaş
            sınırı öngörüyorsa ilgili sınır uygulanır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">12. Üçüncü Taraf Hizmetleri</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl&apos;in kullandığı üçüncü taraf hizmetlerin kendi gizlilik politikaları
            olabilir. Feedl, üçüncü taraf hizmetlerin kendi uygulamalarından, güvenlik
            politikalarından veya veri işleme faaliyetlerinden sorumlu değildir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">13. Bu Politikadaki Değişiklikler</h2>
          <p className="mt-2 text-muted-foreground">
            Bu Politikayı zaman zaman güncelleyebiliriz. Önemli değişiklikler olduğunda
            uygulanabilir olduğu ölçüde kullanıcıları Hizmet üzerinden veya e-posta yoluyla
            bilgilendirebiliriz. Güncel Politika bu sayfada yayınlanır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">14. İletişim</h2>
          <p className="mt-2 text-muted-foreground">
            Gizlilik, kişisel veri veya bu Politika hakkında sorularınız için:
            <br />
            <strong>{LEGAL.companyName}</strong>
            <br />
            Adres: {LEGAL.address}
            <br />
            E-posta: <a href={`mailto:${LEGAL.privacyEmail}`} className="underline hover:text-primary">{LEGAL.privacyEmail}</a>
          </p>
        </section>
      </div>
    </main>
  );
}
