// Embedding ucunun girdi sınırını ölçer: hangi uzunlukta OpenRouter 2xx dışı
// dönüyor? Amaç, `lib/ai/openrouter.ts` → `reportLlmFailure("embedding",…)`
// yolunu ÜRETİM çalışma zamanından tetikleyip Sentry yakalamasının uçtan uca
// çalıştığını kanıtlamak — deploy/env değişikliği YOK.
//
// ÖLÇÜLEN GERÇEK (2026-09-12): sınır KARAKTER değil TOKEN'dır — model 4096
// token'ı aşınca 422 verir ve mesajda "set truncate=END or START to truncate
// long inputs" der. Yani uzun bir geri bildirim AI zenginleştirmesini
// (özet/triage/etiket/benzerlik) TAMAMEN düşürür. `--truncate` bu bayrağın
// sorunu gerçekten çözüp çözmediğini kanıtlar.
//
// Kullanım:
//   node tools/probe-embedding-limit.mjs
//   node tools/probe-embedding-limit.mjs --lens=500,1000,2000,4000,8000,16000
//   node tools/probe-embedding-limit.mjs --truncate      # aynı uzunluklar, truncate=END ile
import { readFileSync, existsSync } from "node:fs";

function parseDotenv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [
          l.slice(0, i).trim(),
          l
            .slice(i + 1)
            .trim()
            .replace(/^["']|["']$/g, ""),
        ];
      }),
  );
}

let env = {};
if (existsSync(".env.local")) env = parseDotenv(readFileSync(".env.local", "utf8"));
const apiKey = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY yok (.env.local).");
  process.exit(1);
}

// Modeli elle sabitliyoruz: openrouter.ts içindeki EMBEDDING_MODEL ile aynı olmalı.
// (Uzunluk sınırı modele bağlı; model değişirse burası da güncellenmeli.)
const EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b:free";

const lensArg = process.argv.slice(2).find((a) => a.startsWith("--lens="));
const lens = lensArg
  ? lensArg.split("=")[1].split(",").map((n) => Number(n.trim())).filter(Boolean)
  : [200, 1000, 2000, 4000, 8000, 16000, 32000];

// `truncate=END` desteği (uzun girdiyi kesip gömer): sınır aşımında 422 yerine 200.
const truncate = process.argv.includes("--truncate");

console.log(`model: ${EMBEDDING_MODEL}${truncate ? "  (truncate=END)" : ""}\n`);
console.log("uzunluk | HTTP | not");
console.log("--------|------|----");

for (const len of lens) {
  const input = "a".repeat(len);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        truncate
          ? { model: EMBEDDING_MODEL, input, truncate: "END" }
          : { model: EMBEDDING_MODEL, input },
      ),
    });
    let note = "";
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      note = `HATA → reportLlmFailure tetiklenir: ${detail.slice(0, 90)}`;
    } else {
      const payload = await res.json().catch(() => null);
      const dim = payload?.data?.[0]?.embedding?.length;
      note = `ok (dim=${dim ?? "?"})`;
    }
    console.log(`${String(len).padStart(7)} | ${res.status} | ${note}`);
  } catch (err) {
    console.log(
      `${String(len).padStart(7)} | net  | ${err instanceof Error ? err.message : err}`,
    );
  }
}
