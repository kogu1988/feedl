# Canny.io Nedir? (Hedef & MVP Stratejisi)

## 1. Canny.io'nun Misyonu
Canny, "AI destekli müşteri geri bildirim platformu"dur. Temel amacı, satış ve destek ekiplerinin konuşmalarını okuyarak hangi özelliklerin geliştirilmesi gerektiğini otomatik olarak tespit etmek ve böylece müşteri kaybını önleyip geliri artırmaktır.

## 2. Canny'nin 4 Temel Sütunu (Bizim MVP'mizin de Kalbi)
1. **Toplama (Collect):** Kullanıcıların kendi cümleleriyle istek göndermesi ve oy vermesi.
2. **Analiz (Analyze):** Gelen verilerin otomatik olarak etiketlenmesi, kopyalarının ayıklanması ve duygu analizi (sentiment) yapılması.
3. **Önceliklendirme & Yol Haritası (Prioritize & Roadmap):** Admin'in bu istekleri durumlara (`open` → `planned` → `in-progress` → `shipped`; kullanıcıya `Planlandı`, `Geliştirmede`, `Yayında` olarak gösterilir) ataması ve bunu herkese göstermesi.
4. **Değişiklik Günlüğü (Changelog) & Bildirim:** Yayınlanan özelliği o isteği açan/oylayan herkese otomatik e-posta ile duyurmak.

## 3. Hedef Kitle (Persona)
- **Admin (Bizim Tek Yöneticimiz):** Ürün sahibi. Geri bildirimleri yönetir, roadmap'i günceller.
- **Müşteri (Son Kullanıcı):** Ürünü kullanan kişi. Yeni özellik ister ve oy verir. (Yorum özelliği MVP sonrası düşünülecek.)

## 4. Fiyatlandırma Stratejisi (Canny'nin Modeli)
Canny, "Tracked User" (Oy veren veya istek gönderen kişi) başına fiyatlandırma yapar.
- Free: 25 kullanıcı, 5 yönetici.
- Pro: $79/ay (Yıllık). 100+ kullanıcı.
- Business: Özel (Kurumsal).

**Bizim Planımız:** MVP'de ücretsiz açıp, ileride `Polar.sh` veya `Lemon Squeezy` ile benzer bir model uygulayacağız.

## 5. 🚫 MVP'de KESİNLİKLE YAPMAYACAKLARIMIZ (Scope Dışı)
- **Entegrasyonlar:** Intercom, Slack, Gong, Jira gibi üçüncü taraf entegrasyonları MVP'de yapılmayacak; sadece kendi uygulamamızın webhook'ları ve CSV dışa aktarımı kullanılacak.
- **MCP Sunucusu (Claude/ChatGPT bağlantısı):** Çok havalı ama şimdilik sadece "CSV Dışa Aktar" yapacağız. Bu özellik MVP sonrası `app/api/admin/export` ile eklenecek.
- **Gelir Etkisi (Revenue Impact) Skoru:** CRM entegrasyonu gerektirir, şimdilik sadece oy sayısı ve sentiment ile ilerleyeceğiz.
- **SSO / Kurumsal Güvenlik:** Tek admin var, Clerk ile standart email/şifre yeterli.

## 6. 🎯 MVP'nin Temel Başarı Kriteri (North Star)
Kullanıcı bir istek gönderdiğinde, AI otomatik olarak bunu etiketleyip özetlesin. Admin "Yayında" (`shipped`) dediği anda, o isteği **açan ve oy veren herkese** anında e-posta gitsin. Bu döngü tamamlanırsa ürün başarılıdır.
