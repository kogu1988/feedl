// Sprint 71.2 — MIGRATION'LARI SIFIRDAN DOĞRULAMA.
//
// NEDEN: 62+ migration ve 36 tablo var; şemanın BOŞ bir veritabanında baştan
// kurulabildiği hiç kanıtlanmamıştı (glm_analyse.md R8). Bir migration'ın
// sırası bozulsa, bir kolon önceki bir migration'a bağımlı olsa ya da bir
// uzantı eksik olsa bunu yalnız ÜRETİMDE fark ederdik.
//
// YAKLAŞIM: geçici bir `pgvector/pgvector:pg16` konteyneri açılır, migration
// dosyaları SÖZLÜK SIRASIYLA (0001 → …) uygulanır, sonuç raporlanır ve
// konteyner her durumda silinir. Hiçbir bulut servisi veya gizli anahtar
// gerekmez; üretim veritabanına DOKUNULMAZ.
//
// KULLANIM: node tools/verify-migrations.mjs
// Gereksinim: Docker (daemon çalışıyor olmalı). Docker yoksa araç ATLAR (exit 0).

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CONTAINER = process.env.MIGRATION_CONTAINER ?? "feedl-mig-verify";
const PORT = process.env.MIGRATION_PORT ?? "55433";
const IMAGE = process.env.MIGRATION_IMAGE ?? "pgvector/pgvector:pg16";
const DB = "feedl";

function docker(args, options = {}) {
  return execFileSync("docker", args, { encoding: "utf8", ...options });
}

function dockerQuiet(args) {
  return spawnSync("docker", args, { encoding: "utf8" });
}

// Docker yoksa atla — bu araç bir ORTAM gerektirir, kod hatası değildir.
const probe = dockerQuiet(["--version"]);
if (probe.status !== 0) {
  console.log("⚠️  Docker bulunamadı — migration doğrulaması ATLANDI.");
  process.exit(0);
}

const migrationsDir = join(process.cwd(), "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort(); // 0001_…, 0002_… sözlük sırası = kronolojik sıra (sıfır dolgulu)

console.log(`Migration doğrulaması: ${files.length} dosya · imaj ${IMAGE}\n`);

function cleanup() {
  dockerQuiet(["rm", "-f", CONTAINER]);
}

cleanup();
try {
  docker([
    "run",
    "-d",
    "--name",
    CONTAINER,
    "-e",
    "POSTGRES_PASSWORD=verify",
    "-e",
    `POSTGRES_DB=${DB}`,
    "-p",
    `${PORT}:5432`,
    IMAGE,
  ]);

  // Hazır olana kadar bekle (en fazla ~60 sn).
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const r = dockerQuiet([
      "exec",
      CONTAINER,
      "pg_isready",
      "-U",
      "postgres",
      "-d",
      DB,
    ]);
    if (r.status === 0) {
      ready = true;
      break;
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  if (!ready) throw new Error("Postgres 60 sn içinde hazır olmadı.");

  let applied = 0;
  const failed = [];
  for (const file of files) {
    const sqlText = readFileSync(join(migrationsDir, file), "utf8");
    const res = spawnSync(
      "docker",
      [
        "exec",
        "-i",
        CONTAINER,
        "psql",
        "-v",
        "ON_ERROR_STOP=1",
        "-q",
        "-U",
        "postgres",
        "-d",
        DB,
      ],
      { input: sqlText, encoding: "utf8" },
    );
    if (res.status === 0) {
      applied += 1;
    } else {
      failed.push({ file, error: (res.stderr ?? "").trim().split("\n").slice(-4).join("\n") });
      // İlk hatada dur: sonraki migration'lar zaten anlamsız olur.
      break;
    }
  }

  console.log(`Uygulanan: ${applied}/${files.length}`);
  if (failed.length > 0) {
    console.error(`\n❌ Başarısız: ${failed[0].file}\n${failed[0].error}`);
    process.exitCode = 1;
  } else {
    // Şema gerçekten oluştu mu? (Sessiz no-op'a karşı son kontrol.)
    const tables = docker([
      "exec",
      CONTAINER,
      "psql",
      "-tAc",
      "select count(*) from information_schema.tables where table_schema='public'",
      "-U",
      "postgres",
      "-d",
      DB,
    ]).trim();
    console.log(`✅ Tüm migration'lar boş bir veritabanında başarıyla kuruldu (public tablo: ${tables}).`);
  }
} catch (err) {
  console.error(`❌ Doğrulama çalıştırılamadı: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
} finally {
  cleanup();
}
