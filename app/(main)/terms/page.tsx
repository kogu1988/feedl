import { LEGAL } from "@/lib/legal";

// Sprint 64 — Terms of Use (Paddle canlı onayı). Kullanıcı sağlanan tam metin.
export const metadata = {
  title: "Kullanım Şartları · feedl",
  description: "feedl kullanım koşulları — hizmetin nasıl kullanılacağı.",
};

export default function TermsPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">Kullanım Şartları</h1>
      <p className="mt-2 text-sm text-muted-foreground">Son güncelleme: 8 Eylül 2026</p>

      <div className="mt-8 grid gap-8 text-sm leading-relaxed text-foreground">
        <section>
          <p className="text-muted-foreground">
            Bu Kullanım Koşulları (“Koşullar”), Feedl tarafından sağlanan web sitesi, uygulama,
            API, widget, public portal, entegrasyonlar ve diğer ilgili hizmetlerin (“Hizmet”)
            kullanımını düzenler.
          </p>
          <p className="mt-2 text-muted-foreground">
            Feedl&apos;in işletmecisi:
            <br />
            <strong>{LEGAL.companyName}</strong>
            <br />
            Adres: {LEGAL.address}
            <br />
            E-posta: <a href={`mailto:${LEGAL.legalEmail}`} className="underline hover:text-primary">{LEGAL.legalEmail}</a>
          </p>
          <p className="mt-2 text-muted-foreground">
            Feedl&apos;i kullanarak bu Koşulları kabul etmiş olursunuz. Kabul etmiyorsanız
            Hizmeti kullanmamalısınız.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">1. Hizmet</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl; müşteri geri bildirimlerinin toplanması, yönetilmesi, analiz edilmesi,
            önceliklendirilmesi ve duyurulması için kullanılan bir SaaS platformudur. Hizmet
            kapsamında; geri bildirim ve fikir toplama, oylama, public feedback portal,
            roadmap, changelog, AI destekli özetleme ve sınıflandırma, benzer içerik tespiti,
            duygu ve tema analizi, gelir/opportunity bazlı önceliklendirme, ekip ve rol
            yönetimi, API ve webhook, Slack/Zendesk/Intercom/Linear/Jira gibi entegrasyonlar,
            gömülebilir widget, özel domain ve çalışma alanı özellikleri sunulabilir.
            Özelliklerin tamamı her planda veya her kullanıcı için mevcut olmayabilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Hesap ve Uygunluk</h2>
          <p className="mt-2 text-muted-foreground">
            Hesap oluştururken verdiğiniz bilgilerin doğru ve güncel olmasını sağlamalısınız.
            Hesabınızın güvenliğinden ve hesabınız üzerinden gerçekleştirilen faaliyetlerden
            siz sorumlusunuz. Hesabınızı başka bir kişiye devredemez veya yetkisiz kişilerin
            hesabınızı kullanmasına izin veremezsiniz. Yetkisiz bir kullanım veya güvenlik
            ihlalinden haberdar olursanız makul süre içerisinde bize bildirmelisiniz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Çalışma Alanları</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl&apos;de bir çalışma alanı (“Workspace”) oluşturabilirsiniz. Workspace
            yöneticileri; kullanıcı davet edebilir, roller ve yetkiler atayabilir, içerikleri
            değiştirebilir veya silebilir, entegrasyonları etkinleştirebilir, public
            içerikleri yayınlayabilir ve Workspace aboneliğini yönetebilir. Workspace
            yöneticileri tarafından gerçekleştirilen işlemler, ilgili Workspace&apos;in diğer
            kullanıcılarının erişimini etkileyebilir. Feedl, Workspace içerisindeki
            kullanıcıların birbirleri arasındaki yetki veya anlaşmazlıklardan sorumlu değildir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Abonelikler ve Ödemeler</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl ücretsiz ve ücretli planlar sunabilir. Ücretli planlarda fiyat, faturalandırma
            sıklığı, plan kapsamı ve varsa deneme süresi satın alma sırasında açıkça gösterilir.
            Abonelikler, aksi belirtilmedikçe seçilen dönem sonunda otomatik olarak yenilenebilir.
          </p>
          <p className="mt-2 text-muted-foreground">
            <strong>Paddle:</strong> Sipariş sürecimiz online reseller&apos;imiz Paddle.com
            tarafından yürütülür. Paddle.com, tüm siparişlerimiz için Merchant of Record&apos;dur.
            Paddle tüm müşteri hizmetleri taleplerini karşılar ve iadeleri yönetir. Paddle, ilgili
            işlemlerde yetkili satıcı ve Merchant of Record olarak hareket eder ve ödeme, vergi,
            faturalandırma, abonelik yenileme ve ilgili işlem süreçlerini yönetebilir. Feedl
            doğrudan kredi kartı numaranızı istemez veya saklamaz. Ödeme ve iade işlemleri
            bakımından Paddle&apos;ın ilgili Buyer Terms ve Refund Policy hükümleri de
            uygulanabilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Abonelik İptali</h2>
          <p className="mt-2 text-muted-foreground">
            Aboneliğinizi hesabınız üzerinden veya Paddle&apos;ın sağladığı abonelik yönetim
            araçları üzerinden iptal edebilirsiniz. İptal, aksi belirtilmedikçe mevcut
            faturalandırma döneminin sonunda yürürlüğe girer. İptal işlemi, mevcut dönem için
            ödenmiş ücretleri otomatik olarak iade etmez. Yasal olarak zorunlu iade ve cayma
            hakları saklıdır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Deneme ve Ücretsiz Planlar</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl ücretsiz deneme veya ücretsiz plan sunabilir. Deneme süresi ve kapsamı satın
            alma sırasında açıkça belirtilir. Deneme süresinin ücretli aboneliğe dönüşmesi
            halinde, uygulanabilir ödeme ve iptal koşulları satın alma sırasında gösterilir.
            Feedl ücretsiz planın özelliklerini, limitlerini veya kullanılabilirliğini önceden
            bildirimde bulunarak veya yasal olarak gerekli olduğu ölçüde değiştirebilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Kabul Edilebilir Kullanım</h2>
          <p className="mt-2 text-muted-foreground">
            Hizmeti kullanırken yürürlükteki yasalara uymalı, başkalarının haklarını ihlal
            etmemeli, yetkisiz erişim sağlamaya çalışmamalı, hizmetin güvenliğini veya
            çalışmasını bozacak faaliyetlerde bulunmamalı, spam/kötü amaçlı yazılım/zararlı kod
            göndermemeli, API/rate limitlerini aşmamalı, başka kullanıcıların hesaplarına veya
            Workspace&apos;lerine yetkisiz erişmemeli, hizmeti tersine mühendislik amacıyla
            kullanmamalı, izin verilmeyen şekilde yeniden satmamalı veya kiralamamalı ve hizmeti
            yasa dışı, dolandırıcı veya kötüye kullanım amaçlı kullanmamalısınız. Feedl, bu
            kuralların ihlal edildiğini düşündüğü durumlarda erişimi sınırlandırabilir veya
            hesabı askıya alabilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Kullanıcı İçeriği</h2>
          <p className="mt-2 text-muted-foreground">
            Hizmete gönderdiğiniz içeriklerin (“User Content”) mülkiyeti size veya ilgili
            Workspace sahibine ait olmaya devam eder. Feedl&apos;e, Hizmeti sunmak, işletmek,
            geliştirmek, güvenliğini sağlamak, yedeklemek, desteklemek ve bu Koşullarda
            açıklanan özellikleri çalıştırmak için User Content&apos;i barındırma, kopyalama,
            işleme, değiştirme, görüntüleme ve iletme konusunda dünya çapında, münhasır olmayan,
            telifsiz bir lisans verirsiniz. Bu lisans, Feedl&apos;in User Content&apos;in sahibi
            olduğu anlamına gelmez. Feedl, User Content&apos;i bağımsız bir içerik ürünü olarak
            satmaz. Feedl&apos;e gönderdiğiniz içerikler üzerinde gerekli haklara sahip
            olduğunuzu kabul edersiniz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Public İçerik</h2>
          <p className="mt-2 text-muted-foreground">
            Bir Workspace sahibi veya yetkili kullanıcısı bir içeriği public olarak yayınlarsa,
            bu içerik internet üzerinden erişilebilir hale gelebilir. Public içeriklerin
            erişilebilirliği, arama motorları tarafından indekslenmesi veya üçüncü kişiler
            tarafından kopyalanması üzerinde Feedl tam kontrol sahibi olmayabilir. Public olarak
            yayınlanmaması gereken kişisel, gizli veya ticari bilgileri public alanlara
            göndermemelisiniz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. AI Özellikleri</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl bazı özelliklerinde üçüncü taraf yapay zeka servisleri kullanır. AI çıktıları
            otomatik olarak oluşturulur ve yanlış, eksik olabilir; bağlamı yanlış yorumlayabilir;
            eski veya hatalı sonuç üretebilir; insan değerlendirmesinin yerini almayabilir. AI
            çıktıları yalnızca yardımcı bilgi olarak kullanılmalıdır. Feedl, AI tarafından
            oluşturulan sonuçların doğruluğunu veya eksiksizliğini garanti etmez. Özellikle
            gelir, müşteri memnuniyeti, ürün stratejisi veya iş kararları yalnızca AI çıktısına
            dayanılarak verilmemelidir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">11. Üçüncü Taraf Hizmetleri ve İçerikleri</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl üçüncü taraf hizmetlerle entegre olabilir. Bu hizmetlerin kullanılabilmesi için
            ilgili üçüncü tarafın hesabına, API anahtarına veya yetkilendirmesine ihtiyaç
            duyulabilir. Üçüncü taraf hizmetlerin kullanılabilirliği, doğruluğu, güvenliği,
            fiyatlandırması, API değişiklikleri ve veri işleme faaliyetleri Feedl&apos;in kontrolü
            dışındadır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">12. Fikri Mülkiyet</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl ve Hizmet ile ilgili yazılım, tasarım, marka, logo, metin, arayüz, veri
            yapıları, teknik altyapı ve diğer içerikler Feedl&apos;e veya lisans verenlerine
            aittir. Bu Koşullar size Feedl&apos;in fikri mülkiyet haklarını devretmez. Feedl&apos;in
            yazılımını kopyalayamaz, dağıtamaz, satamaz, kiralayamaz, yeniden lisanslayamaz,
            türev çalışmalar oluşturamaz, tersine mühendislik yapamaz veya kaynak kodunu
            çıkarmaya çalışamazsınız.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">13. Geri Bildirim</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl&apos;e gönderdiğiniz ürün önerileri, hata bildirimleri veya diğer geri
            bildirimleri Hizmeti geliştirmek amacıyla kullanabiliriz. Bize gönderdiğiniz geri
            bildirimler için size ödeme yapma veya geri bildirimi gizli tutma yükümlülüğümüz
            bulunmaz; ancak kişisel veriler ve gizli bilgiler ilgili Gizlilik Politikası ve
            uygulanabilir hukuk çerçevesinde ele alınır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">14. Hizmetin Kullanılabilirliği</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl, Hizmeti makul şekilde erişilebilir tutmaya çalışır ancak Hizmetin kesintisiz,
            hatasız, tamamen güvenli veya her cihaz/tarayıcıyla uyumlu olacağını garanti etmez.
            Bakım, güvenlik, altyapı arızası, üçüncü taraf hizmet kesintisi veya kontrolümüz
            dışındaki olaylar nedeniyle Hizmet geçici olarak kullanılamayabilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">15. Hizmette Değişiklikler</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl, Hizmetin özelliklerini, teknolojisini, limitlerini veya arayüzünü
            değiştirebilir. Ücretli bir planın temel özelliklerinde önemli ve olumsuz bir
            değişiklik yapılması halinde, uygulanabilir hukuk ve sözleşme yükümlülüklerine uygun
            olarak kullanıcıları bilgilendirmeye çalışırız.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">16. Askıya Alma ve Fesih</h2>
          <p className="mt-2 text-muted-foreground">
            Feedl; Koşulların ihlali, yasa dışı faaliyet, dolandırıcılık veya ödeme kötüye
            kullanımı, güvenlik riski, diğer kullanıcıların güvenliğine yönelik tehdit, Hizmetin
            kötüye kullanılması, Paddle veya ödeme sağlayıcısı tarafından ödeme işleminin
            reddedilmesi veya yasal bir yükümlülük durumlarında hesabınızı veya Hizmete
            erişiminizi askıya alabilir veya sona erdirebilir. Mümkün olduğu ölçüde kullanıcıya
            bildirimde bulunuruz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">17. Garanti Reddi</h2>
          <p className="mt-2 text-muted-foreground">
            Yürürlükteki hukukun izin verdiği azami ölçüde Hizmet, “olduğu gibi” ve “mevcut
            olduğu şekilde” sağlanır. Feedl; belirli bir ticari sonuca, gelir artışına, müşteri
            memnuniyeti seviyesine, AI sonuçlarının doğruluğuna veya kesintisiz/hatasız çalışmaya
            garanti vermez. Bu bölüm, tüketicilerin yürürlükteki zorunlu yasal haklarını ortadan
            kaldırmaz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">18. Sorumluluğun Sınırlandırılması</h2>
          <p className="mt-2 text-muted-foreground">
            Yürürlükteki hukukun izin verdiği azami ölçüde Feedl veya bağlı kuruluşları,
            yöneticileri, çalışanları veya hizmet sağlayıcıları; dolaylı zararlar, kar kaybı,
            gelir kaybı, veri kaybı, iş kesintisi, itibar kaybı, beklenen tasarruf kaybı gibi
            dolaylı veya sonuçsal zararlardan sorumlu olmaz. Yürürlükteki hukukun izin verdiği
            ölçüde Feedl&apos;in bu Koşullardan doğan toplam sorumluluğu, ilgili olaydan önceki
            12 ay içinde Feedl&apos;e ödediğiniz toplam ücret veya 100 ABD doları tutarından
            hangisi daha yüksekse onunla sınırlıdır. Bu sınırlama, uygulanabilir hukuk
            kapsamında sınırlandırılamayan veya hariç tutulamayan sorumluluklar için geçerli
            değildir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">19. Tazmin</h2>
          <p className="mt-2 text-muted-foreground">
            Hizmeti Koşullara aykırı şekilde kullanmanız, yasa dışı faaliyetleriniz, üçüncü
            kişilerin fikri mülkiyet/gizlilik/diğer haklarını ihlal eden içerikleriniz veya
            yetkisiz/kötüye kullanıma dayalı faaliyetleriniz nedeniyle Feedl&apos;e karşı üçüncü
            bir kişi tarafından ileri sürülen taleplerden kaynaklanan zarar ve makul masraflardan,
            yürürlükteki hukukun izin verdiği ölçüde sorumlu olabilirsiniz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">20. Gizlilik</h2>
          <p className="mt-2 text-muted-foreground">
            Kişisel verilerin işlenmesi, Privacy Policy kapsamında gerçekleştirilir. Privacy
            Policy bu Koşulların ayrılmaz bir parçası olarak değerlendirilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">21. Paddle</h2>
          <p className="mt-2 text-muted-foreground">
            Paddle, Feedl&apos;in yazılım ve dijital hizmetlerinin satışında Merchant of Record
            ve yetkili satıcı olarak hareket eder. Ödeme işlemleri Paddle&apos;ın ilgili
            şartlarına ve politikalarına tabidir. Refund Policy&apos;de belirtilen yasal tüketici
            hakları saklıdır. Paddle&apos;ın güncel politikası, uygulanabilir olduğu ölçüde
            Feedl&apos;in iade hükümleriyle birlikte değerlendirilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">22. Koşullarda Değişiklik</h2>
          <p className="mt-2 text-muted-foreground">
            Bu Koşulları zaman zaman güncelleyebiliriz. Güncellenmiş Koşullar bu sayfada
            yayınlandığı tarihten itibaren geçerli olur. Önemli değişikliklerde uygulanabilir
            olduğu ölçüde kullanıcıları ayrıca bilgilendiririz. Değişikliklerden sonra Hizmeti
            kullanmaya devam etmeniz, güncellenmiş Koşulları kabul ettiğiniz anlamına gelir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">23. Uygulanacak Hukuk</h2>
          <p className="mt-2 text-muted-foreground">
            Bu Koşullar {LEGAL.jurisdiction} hukukuna tabidir. Ancak tüketici olarak
            bulunduğunuz ülkedeki emredici tüketici koruma hükümleri bu madde tarafından ortadan
            kaldırılmaz veya sınırlandırılmaz. Uyuşmazlıkların çözümünde uygulanabilir zorunlu
            tüketici hakları ve yetkili mahkemelere ilişkin kurallar saklıdır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">24-25. Bölünebilirlik ve Sözleşmenin Tamamı</h2>
          <p className="mt-2 text-muted-foreground">
            Bu Koşulların herhangi bir hükmünün geçersiz veya uygulanamaz bulunması, diğer
            hükümlerin geçerliliğini etkilemez. Bu Koşullar, Privacy Policy ve uygulanabilir
            Refund Policy ile birlikte Feedl ile kullanıcı arasındaki Hizmet kullanımına ilişkin
            anlaşmanın tamamını oluşturur.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">26. İletişim</h2>
          <p className="mt-2 text-muted-foreground">
            <strong>{LEGAL.companyName}</strong>
            <br />
            Adres: {LEGAL.address}
            <br />
            E-posta: <a href={`mailto:${LEGAL.legalEmail}`} className="underline hover:text-primary">{LEGAL.legalEmail}</a>
          </p>
        </section>
      </div>
    </main>
  );
}
