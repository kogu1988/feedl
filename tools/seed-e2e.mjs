// E2E/test seed — Playwright akışları için gereken MİNİMUM veri.
//
// 2026-09-12 (kod incelemesi #8): bu betiğin eski hali `scripts/seed-e2e.mjs`
// idi ve `/scripts` gitignore'da olduğu için CI onu GÖREMİYORDU; README ve
// `e2e/auth-flow.spec.ts` ise ona referans veriyordu (kırık referans). Ayrıca
// workspace/board'un zaten var olduğunu VARSAYIYORDU → taze bir test
// veritabanında çalışmıyordu. Artık `tools/` altında (takipli) ve idempotent
// olarak eksikleri KENDİSİ oluşturur.
//
// Neden board şart: `/portal` hiç board bulamazsa `/portal?board=genel`'e
// redirect eder ve o da bulamazsa döngüye girer — e2e smoke/a11y bu yüzden
// seed'siz yeşil olamaz.
//
// Kullanım:
//   node tools/seed-e2e.mjs                                   # yerel (.env.local)
//   DATABASE_URL=postgres://... node tools/seed-e2e.mjs       # CI
//   node tools/seed-e2e.mjs "test+clerk_test@example.com" feedl
//
// Yazdığı şeyler (hepsi idempotent):
//   workspace(slug) + board(genel, public) + board(e2e, public)
//   + users(email, role=admin) + workspace_members(owner)
// UYARI: üretim veritabanına karşı çalıştırmak GÜVENLİ DEĞİL — test için ayrı
// bir Neon branch kullanın. Betik bunu KENDİSİ de kontrol eder: hedef
// workspace'te fikir varsa (gerçek veri) `--force` olmadan durur.
import { loadEnvFile } from "node:process";
import { neon } from "@neondatabase/serverless";

try {
  loadEnvFile(".env.local");
} catch {
  // CI'da .env.local yok — env doğrudan gelir.
}

const url = process.env.DATABASE_URL;
const email =
  process.argv[2] ?? process.env.E2E_ADMIN_EMAIL ?? "test+clerk_test@example.com";
const slug = process.argv[3] ?? process.env.E2E_WORKSPACE_SLUG ?? "feedl";
const workspaceName = process.env.E2E_WORKSPACE_NAME ?? "feedl";
// Guard: gerçek veri içeren bir workspace'e yazmayı ENGELLE (2026-09-12'de bu
// betik yanlışlıkla üretim DB'sine karşı çalıştırıldı ve sahte admin + board
// bıraktı; temizlendi). Test için ayrı DB/branch kullan; bilinçli istisna için
// `--force`.
const force = process.argv.includes("--force");

if (!url) {
  console.error("DATABASE_URL yok (.env.local veya ortam değişkeni).");
  process.exit(1);
}

const sql = neon(url);
const created = [];

// 1) Workspace (yoksa oluştur).
let [ws] = await sql`SELECT id, name FROM workspaces WHERE slug = ${slug} LIMIT 1`;
if (!ws) {
  [ws] = await sql`
    INSERT INTO workspaces (name, slug) VALUES (${workspaceName}, ${slug})
    RETURNING id, name`;
  created.push(`workspace:${slug}`);
} else {
  // Mevcut workspace: gerçek veri sinyali var mı?
  const [{ posts: postCount }] = await sql`
    SELECT count(*)::int AS posts FROM posts WHERE workspace_id = ${ws.id}`;
  if (postCount > 0 && !force) {
    console.error(
      `\n⛔ DURDURULDU: "${slug}" workspace'inde ${postCount} fikir var — bu GERÇEK veri.`,
      "\n   Seed yalnızca test veritabanı içindir (ayrı Neon branch aç).",
      "\n   Bilinçli olarak üzerine yazmak istiyorsan: --force\n",
    );
    process.exit(2);
  }
}

// 2) Varsayılan board ("genel") — portal redirect döngüsünü kırar.
const [defaultBoard] = await sql`
  SELECT id FROM boards WHERE workspace_id = ${ws.id} AND slug = 'genel' LIMIT 1`;
if (!defaultBoard) {
  await sql`
    INSERT INTO boards (workspace_id, name, slug, visibility, description)
    VALUES (${ws.id}, 'Genel', 'genel', 'public', 'Varsayılan board (seed)')`;
  created.push("board:genel");
}

// 3) E2E board'u.
const [e2eBoard] = await sql`
  SELECT id FROM boards WHERE workspace_id = ${ws.id} AND slug = 'e2e' LIMIT 1`;
if (!e2eBoard) {
  await sql`
    INSERT INTO boards (workspace_id, name, slug, visibility, description)
    VALUES (${ws.id}, 'E2E Board', 'e2e', 'public', 'Otomatik E2E test board')`;
  created.push("board:e2e");
}

// 4) Admin kullanıcı. Clerk "fakes" ile giriş yapıldığında `auth()` userId'si
// Clerk'e ait olur; bu kayıt e-posta ile bulunup role yükseltilir. Kayıt yoksa
// (webhook gecikti) deterministik olmayan bir id ile oluşturulur — o durumda
// gerçek Clerk id'si eşleşmeyeceği için authed akış yine webhook'a bağlıdır.
const [existingUser] = await sql`
  SELECT id, email FROM users WHERE email = ${email} LIMIT 1`;
let userId;
if (existingUser) {
  userId = existingUser.id;
  await sql`UPDATE users SET role = 'admin' WHERE id = ${userId}`;
} else {
  userId = `user_e2e_seed_${Date.now()}`;
  await sql`
    INSERT INTO users (id, email, name, role)
    VALUES (${userId}, ${email}, 'E2E Admin', 'admin')`;
  created.push(`user:${email}`);
}

// 5) Workspace üyeliği (owner → getRole "owner").
await sql`
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (${ws.id}, ${userId}, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner'`;

console.log("E2E seed tamam:", {
  workspace: `${ws.name} (${slug})`,
  userId,
  email,
  created: created.length > 0 ? created : "yok (hepsi zaten vardı)",
});
process.exit(0);
