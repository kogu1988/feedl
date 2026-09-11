// OpenRouter model sağlık probu: verilen model kimliklerine GERÇEK bir çağrı
// yapar (feedl'in gerçek görevine benzeyen Türkçe JSON sınıflandırma istemi),
// ve şunları raporlar: HTTP durum, gecikme, token kullanımı, tahmini maliyet,
// JSON parse edilebildi mi, ham çıktı.
//
// Neden var: `minimax/minimax-m3:free` bir gün sessizce emekliye ayrıldı ve
// üretimde tüm AI fonksiyonları (ai-autopilot, corpus-insights) öldü; tek
// sinyal Inngest'teki failed run'lardı. Model değiştirmeden ya da bir modeli
// sabitlemeden önce bununla canlı olduğunu doğrula.
//
// Kullanım:
//   node tools/probe-llm-models.mjs                    (varsayılan 6 aday)
//   node tools/probe-llm-models.mjs mistralai/mistral-nemo google/gpt-oss-20b
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const key = env.OPENROUTER_API_KEY;
if (!key) {
  console.error("OPENROUTER_API_KEY yok (.env.local).");
  process.exit(1);
}

const DEFAULT_MODELS = [
  // en ucuz ücretli adaylar
  "mistralai/mistral-nemo",
  "inclusionai/ling-3.0-flash",
  "ibm-granite/granite-4.0-h-micro",
  // ücretsiz adaylar
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nex-agi/nex-n2.5-pro:free",
  "google/gemma-4-31b-it:free",
];

const models = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_MODELS;

// feedl'in gerçek görevi: Türkçe serbest geri bildirimi sınıflandır, KATI JSON.
const SYSTEM =
  "Sen bir ürün geri bildirimi sınıflandırıcısısın. YALNIZCA geçerli JSON " +
  "döndür; açıklama, markdown çiti veya ek metin yazma.";
const USER =
  'Geri bildirim: "Mobilde checkout butonu ekranın dışına taşıyor, sipariş veremiyorum."\n' +
  'Şu şemayla JSON döndür: {"type":"bug|feature|support|clarify|unrecognized",' +
  '"sentiment":"positive|neutral|negative","summary":"<tek cümle, Türkçe>",' +
  '"keywords":["<2-4 kısa anahtar>"]}';

// Fiyatları tek seferde çek (tahmini maliyet için).
const modelsRes = await fetch("https://openrouter.ai/api/v1/models");
const catalog = (await modelsRes.json()).data ?? [];
const priceOf = (id) => catalog.find((m) => m.id === id)?.pricing ?? null;

function usd(n) {
  return "$" + n.toFixed(6);
}

let failures = 0;
for (const model of models) {
  const started = Date.now();
  let status = 0;
  let body = null;
  let raw = "";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER },
        ],
        temperature: 0,
        max_tokens: Number(process.env.PROBE_MAX_TOKENS ?? 256),
      }),
    });
    status = res.status;
    raw = await res.text();
    body = JSON.parse(raw);
  } catch (err) {
    console.log(`\n✗ ${model}\n  istek hatası: ${err.message}`);
    failures += 1;
    continue;
  }
  const ms = Date.now() - started;

  if (status !== 200) {
    console.log(`\n✗ ${model}\n  HTTP ${status} (${ms}ms): ${raw.slice(0, 200)}`);
    failures += 1;
    continue;
  }

  const text = body?.choices?.[0]?.message?.content ?? "";
  const usage = body?.usage ?? {};
  const p = priceOf(model);
  const cost = p
    ? Number(usage.prompt_tokens ?? 0) * parseFloat(p.prompt) +
      Number(usage.completion_tokens ?? 0) * parseFloat(p.completion)
    : null;

  // Modeller JSON'u markdown çiti içine sarabilir → kodun da yaptığı gibi
  // ilk `{` ile son `}` arasını al.
  let parsed = null;
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a !== -1 && b > a) {
    try {
      parsed = JSON.parse(text.slice(a, b + 1));
    } catch {
      /* parse hatası aşağıda raporlanır */
    }
  }
  const shapeOk =
    parsed &&
    typeof parsed.type === "string" &&
    typeof parsed.sentiment === "string" &&
    typeof parsed.summary === "string" &&
    Array.isArray(parsed.keywords);

  console.log(`\n${shapeOk ? "✓" : "⚠"} ${model}  [${ms}ms]`);
  console.log(
    `  token: in ${usage.prompt_tokens ?? "?"} / out ${usage.completion_tokens ?? "?"}` +
      (cost !== null ? `  · tahmini maliyet ${usd(cost)}` : "  · (fiyat bulunamadı)"),
  );
  console.log(`  JSON parse: ${parsed ? "evet" : "HAYIR"} · şema uygun: ${shapeOk ? "evet" : "HAYIR"}`);
  console.log(`  çıktı: ${text.replace(/\s+/g, " ").slice(0, 300)}`);
  if (!shapeOk) failures += 1;
}

console.log(
  `\n${failures === 0 ? "✅ tüm adaylar sağlıklı" : `❌ ${failures} aday başarısız/şema dışı`}`,
);
process.exit(failures === 0 ? 0 : 1);
