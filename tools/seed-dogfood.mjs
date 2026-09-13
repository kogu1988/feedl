// Sprint 66 — DOGFOOD SEED (glm_analyse.md §3.5).
//
// NEDEN: Ürün kendi portalında 0 fikirle duruyordu. Boş portal (a) satın alma
// niyetini kırar (sosyal kanıt yok), (b) çok-kiracılı içerik izolasyonunu
// kanıtsız bırakır, (c) AI hattını gerçek veriyle hiç çalıştırmaz.
// Bu betik feedl'in KENDİ workspace'ine gerçek backlog'unu fikir olarak yazar,
// gelir bağlamını (şirket + MRR + fırsat) kurar ve birkaç "müşteri" oyu ekler —
// böylece gelir skoru mekanizması canlı veriyle görünür olur.
//
// KULLANIM:
//   node tools/seed-dogfood.mjs            → KURU ÇALIŞMA (yazmaz, ne yapacağını yazar)
//   node tools/seed-dogfood.mjs --apply    → yazar (idempotent)
//   node tools/seed-dogfood.mjs --clean --apply → bu betiğin yazdığı satırları SİLER
//
// IDEMPOTENT: başlık/ad/id üzerinden varlık kontrolü yapar; ikinci çalıştırma
// duplike üretmez. Yazdığı satırlar `source='dogfood'` ve `dogfood_` önekli
// kullanıcı id'leriyle işaretlidir → `--clean` yalnız KENDİ verisini siler,
// gerçek veriye dokunmaz.
//
// `.env.local`'deki DATABASE_URL — ÜRETİM. Bilinçli (dogfood canlıda yapılır).
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const sql = neon(env.DATABASE_URL);
const APPLY = process.argv.includes("--apply");
const CLEAN = process.argv.includes("--clean");

const log = (...a) => console.log(...a);

// ── İçerik: feedl'in KENDİ backlog'u (raporlardan) ─────────────────────────
const POSTS = [
  { title: "İngilizce (i18n) desteği ve dil seçici", status: "open",
    description: "Arayüz tamamen Türkçe ve <html lang=\"tr\"> sabit. Küresel bir SaaS hedefliyorsak İngilizce kritik yolda; değilse TRY fiyat gösterimi gerekir." },
  { title: "Özel alan adı (custom domain) kurulum sihirbazı", status: "planned",
    description: "CNAME/A kaydı talimatı ve TXT doğrulaması var ama gerçek bir domainle uçtan uca prova yapılmadı. Adım adım bir sihirbaz kurulumu hızlandırır." },
  { title: "Funnel olaylarında tarih aralığı filtresi", status: "open",
    description: "Aktivasyon sayfasındaki olay hunisi şu an tek pencere (son 30 gün) gösteriyor. Karşılaştırma için tarih aralığı seçilebilmeli." },
  { title: "Görsel geri bildirimde işaretlenen bölgenin vurgulanması", status: "in-progress",
    description: "Pin ile işaretleme yapılınca tüm ekran görüntüsü alınıyor. En azından işaretlenen bölge, kullanıcının seçebileceği renkte vurgulanmalı." },
  { title: "Widget mobil görünümde ekrana sığmıyor", status: "shipped",
    description: "Küçük ekranlarda panel viewport'tan taşıyor; yükseklik yönetimi ve kaydırma düzeltilmeli." },
  { title: "Haftalık AI özeti için saat dilimi ayarı", status: "open",
    description: "Digest pazartesi sabahı gönderiliyor; workspace bazında saat dilimi seçilebilirse e-posta doğru anda gelir." },
  { title: "CSV müşteri import'unun gerçek dosyayla test edilmesi", status: "planned",
    description: "Kod hazır ama gerçek bir CSV ile hiç koşulmadı. Bozuk satır / eksik alan / tekrar e-posta senaryoları doğrulanmalı." },
  { title: "Toplu işlemler için geri alma (undo)", status: "open",
    description: "Bulk durum değiştirme ve birleştirme geri alınamıyor (merge hariç). Yanlış toplu işlem geri alınabilmeli." },
  { title: "Public API'de cursor tabanlı sayfalama", status: "open",
    description: "Limit/offset büyük veri kümelerinde kayma yapıyor; cursor tabanlı sayfalama daha kararlı olur." },
  { title: "Fiyatlandırmada TRY gösterimi", status: "open",
    description: "Fiyatlar USD sabit. Hedef pazar Türkiye ise yerel para birimi ve vergi gösterimi dönüşümü artırır." },
  { title: "Roadmap'te bağımlılık (blocker) ilişkisi", status: "open",
    description: "Bir fikrin başka bir fikre bağlı olduğu durumlar görünmüyor; blocker ilişkisi önceliklendirmeyi netleştirir." },
  { title: "Entegrasyon hataları için kuyruk görünürlüğü", status: "in-progress",
    description: "Gelen entegrasyon webhook'ları başarısız olduğunda admin bunu göremiyor; son denemeler ve hata nedenleri listelenmeli." },
  { title: "Dashboard tablolarında koyu tema tutarlılığı", status: "open",
    description: "Bazı tablo ve rozetler koyu temada kontrast sınırında kalıyor; token tutarlılığı gözden geçirilmeli." },
  { title: "Sonuç kaydı (outcome) için hatırlatma", status: "planned",
    description: "Yayına alınan fikirler için gerçekleşen sonucu girmeyi hatırlatan bir akış yok; 30 gün sonra soru sorulabilir." },
];

// Şirketler (gelir bağlamı) — gerçekçi ama örnek.
const COMPANIES = [
  { name: "Acme Yazılım", domain: "acme.example", mrr: "450.00", status: "active" },
  { name: "Globex Teknoloji", domain: "globex.example", mrr: "1200.00", status: "active" },
  { name: "Initech", domain: "initech.example", mrr: "300.00", status: "at_risk" },
  { name: "Umbrella Dijital", domain: "umbrella.example", mrr: "2500.00", status: "active" },
];

const OPPORTUNITIES = [
  { company: "Acme Yazılım", title: "Yıllık plana geçiş", dealValue: "4800.00", stage: "open" },
  { company: "Globex Teknoloji", title: "20 koltuk eklentisi", dealValue: "2400.00", stage: "proposal" },
  { company: "Umbrella Dijital", title: "Enterprise paket görüşmesi", dealValue: "12000.00", stage: "open" },
];

// "Müşteri" kullanıcıları — company_members + oy için. OPAK id (dogfood_ öneki).
const CUSTOMERS = [
  { id: "dogfood_cust_acme_1", name: "Acme Ürün Müdürü", company: "Acme Yazılım" },
  { id: "dogfood_cust_acme_2", name: "Acme Destek", company: "Acme Yazılım" },
  { id: "dogfood_cust_globex_1", name: "Globex CTO", company: "Globex Teknoloji" },
  { id: "dogfood_cust_globex_2", name: "Globex PM", company: "Globex Teknoloji" },
  { id: "dogfood_cust_initech_1", name: "Initech Ürün", company: "Initech" },
  { id: "dogfood_cust_umbrella_1", name: "Umbrella Başkan", company: "Umbrella Dijital" },
];

// Hangi fikre hangi müşteriler oy verir (skoru anlamlı kılmak için dağıtım).
const VOTES = {
  "İngilizce (i18n) desteği ve dil seçici": [
    "dogfood_cust_globex_1", "dogfood_cust_umbrella_1", "dogfood_cust_acme_1",
  ],
  "Özel alan adı (custom domain) kurulum sihirbazı": [
    "dogfood_cust_umbrella_1", "dogfood_cust_globex_1",
  ],
  "Funnel olaylarında tarih aralığı filtresi": ["dogfood_cust_acme_1"],
  "Görsel geri bildirimde işaretlenen bölgenin vurgulanması": [
    "dogfood_cust_globex_2", "dogfood_cust_acme_2", "dogfood_cust_initech_1",
  ],
  "CSV müşteri import'unun gerçek dosyayla test edilmesi": ["dogfood_cust_globex_1"],
  "Fiyatlandırmada TRY gösterimi": ["dogfood_cust_acme_2", "dogfood_cust_initech_1"],
  "Roadmap'te bağımlılık (blocker) ilişkisi": ["dogfood_cust_umbrella_1"],
  "Entegrasyon hataları için kuyruk görünürlüğü": ["dogfood_cust_acme_1", "dogfood_cust_globex_2"],
  "Sonuç kaydı (outcome) için hatırlatma": ["dogfood_cust_umbrella_1"],
};

// Fırsat ↔ fikir bağlantısı (gelir skorunu besler).
const POST_OPPORTUNITY = {
  "İngilizce (i18n) desteği ve dil seçici": "Enterprise paket görüşmesi",
  "Özel alan adı (custom domain) kurulum sihirbazı": "20 koltuk eklentisi",
};

async function main() {
  const [ws] = await sql.query(
    `select id, slug from workspaces where slug = 'feedl' limit 1`,
  );
  if (!ws) throw new Error("'feedl' workspace bulunamadı.");
  const workspaceId = ws.id;

  if (CLEAN) {
    log("🧹 dogfood verisi siliniyor (yalnız source='dogfood' + dogfood_ kullanıcıları)…");
    if (!APPLY) return log("   (kuru çalışma — --apply ekleyin)");
    await sql.query(`delete from posts where workspace_id = $1 and source = 'dogfood'`, [workspaceId]);
    await sql.query(`delete from opportunities where workspace_id = $1 and title = any($2)`,
      [workspaceId, OPPORTUNITIES.map((o) => o.title)]);
    await sql.query(`delete from companies where workspace_id = $1 and name = any($2)`,
      [workspaceId, COMPANIES.map((c) => c.name)]);
    await sql.query(`delete from users where id like 'dogfood\\_%'`);
    return log("✅ temizlendi.");
  }

  const [board] = await sql.query(
    `select id from boards where workspace_id = $1 order by sort_order asc limit 1`,
    [workspaceId],
  );
  if (!board) throw new Error("Varsayılan board bulunamadı.");

  log(`Workspace: ${ws.slug} (${workspaceId}) · board: ${board.id}`);
  log(`Plan: ${POSTS.length} fikir · ${COMPANIES.length} şirket · ${OPPORTUNITIES.length} fırsat · ${CUSTOMERS.length} müşteri`);
  if (!APPLY) {
    log("\n⚠️  KURU ÇALIŞMA — hiçbir şey yazılmadı. Yazmak için: --apply");
    return;
  }

  // 1) Şirketler
  const companyIds = {};
  for (const c of COMPANIES) {
    const [existing] = await sql.query(
      `select id from companies where workspace_id = $1 and name = $2 limit 1`,
      [workspaceId, c.name],
    );
    if (existing) { companyIds[c.name] = existing.id; continue; }
    const id = randomUUID();
    await sql.query(
      `insert into companies (id, workspace_id, name, domain, mrr, status)
       values ($1,$2,$3,$4,$5,$6)`,
      [id, workspaceId, c.name, c.domain, c.mrr, c.status],
    );
    companyIds[c.name] = id;
  }
  log(`✓ şirketler: ${Object.keys(companyIds).length}`);

  // 2) Müşteri kullanıcıları + şirket üyeliği
  for (const u of CUSTOMERS) {
    await sql.query(
      `insert into users (id, email, name, role) values ($1,$2,$3,'customer')
       on conflict (id) do nothing`,
      [u.id, `${u.id}@dogfood.example`, u.name],
    );
    await sql.query(
      `insert into company_members (id, company_id, user_id, job_title)
       values ($1,$2,$3,$4) on conflict (company_id, user_id) do nothing`,
      [randomUUID(), companyIds[u.company], u.id, "Ürün"],
    );
  }
  log(`✓ müşteri kullanıcıları: ${CUSTOMERS.length}`);

  // 3) Fikirler
  const postIds = {};
  for (const p of POSTS) {
    const [existing] = await sql.query(
      `select id from posts where workspace_id = $1 and title = $2 limit 1`,
      [workspaceId, p.title],
    );
    if (existing) { postIds[p.title] = existing.id; continue; }
    const id = randomUUID();
    await sql.query(
      `insert into posts (id, workspace_id, board_id, user_id, title, description, status, source, post_type)
       values ($1,$2,$3,null,$4,$5,$6,'dogfood','feature')`,
      [id, workspaceId, board.id, p.title, p.description, p.status],
    );
    postIds[p.title] = id;
  }
  log(`✓ fikirler: ${Object.keys(postIds).length}`);

  // 4) Oylar
  let voteCount = 0;
  for (const [title, voters] of Object.entries(VOTES)) {
    const postId = postIds[title];
    if (!postId) continue;
    for (const userId of voters) {
      const res = await sql.query(
        `insert into votes (id, user_id, post_id) values ($1,$2,$3)
         on conflict (user_id, post_id) do nothing returning id`,
        [randomUUID(), userId, postId],
      );
      if (res.length > 0) voteCount += 1;
    }
  }
  log(`✓ oylar: +${voteCount}`);

  // 5) Fırsatlar + fikir bağlantısı
  const oppIds = {};
  for (const o of OPPORTUNITIES) {
    const [existing] = await sql.query(
      `select id from opportunities where workspace_id = $1 and title = $2 limit 1`,
      [workspaceId, o.title],
    );
    if (existing) { oppIds[o.title] = existing.id; continue; }
    const id = randomUUID();
    await sql.query(
      `insert into opportunities (id, workspace_id, company_id, title, deal_value, stage)
       values ($1,$2,$3,$4,$5,$6)`,
      [id, workspaceId, companyIds[o.company], o.title, o.dealValue, o.stage],
    );
    oppIds[o.title] = id;
  }
  for (const [postTitle, oppTitle] of Object.entries(POST_OPPORTUNITY)) {
    const postId = postIds[postTitle];
    const oppId = oppIds[oppTitle];
    if (!postId || !oppId) continue;
    await sql.query(
      `insert into post_opportunities (id, post_id, opportunity_id) values ($1,$2,$3)
       on conflict (post_id, opportunity_id) do nothing`,
      [randomUUID(), postId, oppId],
    );
  }
  log(`✓ fırsatlar: ${Object.keys(oppIds).length} (+${Object.keys(POST_OPPORTUNITY).length} bağlantı)`);

  log("\n✅ dogfood verisi yazıldı. Portaldan kontrol: https://feedl.app/portal");
  log("   Temizlemek için: node tools/seed-dogfood.mjs --clean --apply");
}

await main();
