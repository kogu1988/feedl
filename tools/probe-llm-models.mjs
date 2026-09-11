// OpenRouter model sağlık probu: verilen model kimliklerine GERÇEK bir çağrı
// yapar ve şunları raporlar: HTTP durum, gecikme, token kullanımı, tahmini
// maliyet, JSON parse edilebildi mi, BEKLENEN ŞEMAYA uyuyor mu, ham çıktı.
//
// Neden var: `minimax/minimax-m3:free` bir gün sessizce emekliye ayrıldı ve
// üretimde tüm AI fonksiyonları (ai-autopilot, corpus-insights) öldü; tek
// sinyal Inngest'teki failed run'lardı. Model değiştirmeden ya da bir modeli
// sabitlemeden önce bununla canlı olduğunu ve şemayı tuttuğunu doğrula.
//
// Kullanım:
//   node tools/probe-llm-models.mjs                       (İstem A, varsayılan adaylar)
//   node tools/probe-llm-models.mjs --prompt=b            (İstem B — iç içe şema)
//   node tools/probe-llm-models.mjs --prompt=b <model>... (belirli modeller)
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

// ---- istemler -------------------------------------------------------------
// feedl'in GERÇEK görevleri. A: düz sınıflandırma (ai-autopilot).
// B: iç içe şema (corpus-insights) — ücretsiz modellerin patladığı asıl nokta.
const PROMPTS = {
  a: {
    label: "A — sınıflandırma (düz şema)",
    maxTokens: 300,
    system:
      "Sen bir ürün geri bildirimi sınıflandırıcısısın. YALNIZCA geçerli JSON " +
      "döndür; açıklama, markdown çiti veya ek metin yazma.",
    user:
      'Geri bildirim: "Mobilde checkout butonu ekranın dışına taşıyor, sipariş veremiyorum."\n' +
      'Şu şemayla JSON döndür: {"type":"bug|feature|support|clarify|unrecognized",' +
      '"sentiment":"positive|neutral|negative","summary":"<tek cümle, Türkçe>",' +
      '"keywords":["<2-4 kısa anahtar>"]}',
    validate: (j) => {
      const types = ["bug", "feature", "support", "clarify", "unrecognized"];
      const sents = ["positive", "neutral", "negative"];
      if (!j || typeof j !== "object") return "kök nesne değil";
      if (!types.includes(j.type)) return `type geçersiz: ${JSON.stringify(j.type)}`;
      if (!sents.includes(j.sentiment)) return `sentiment geçersiz: ${JSON.stringify(j.sentiment)}`;
      if (typeof j.summary !== "string" || !j.summary.trim()) return "summary boş";
      if (!Array.isArray(j.keywords)) return "keywords dizi değil";
      return null;
    },
  },
  b: {
    label: "B — korpus içgörüleri (iç içe şema)",
    maxTokens: 900,
    system:
      "Sen bir ürün analistisin. YALNIZCA geçerli JSON döndür; açıklama veya markdown yazma.",
    user:
      "Aşağıdaki geri bildirimleri analiz et ve YALNIZCA şu şemada JSON döndür:\n" +
      '{\n  "themes": [{"name":"<kısa tema>","count":<tam sayı>,"summary":"<tek cümle>"}],\n' +
      '  "trends": [{"name":"<kısa ad>","direction":"up|down|flat","note":"<tek cümle>"}],\n' +
      '  "quickWins": ["<kısa, uygulanabilir madde>"],\n' +
      '  "risks": ["<kısa risk maddesi>"],\n' +
      '  "recommendation": "<tek paragraf>"\n}\n\n' +
      "Geri bildirimler:\n" +
      "1. Mobilde checkout butonu ekran dışına taşıyor, sipariş veremiyorum.\n" +
      "2. Karanlık mod desteği gelse harika olur.\n" +
      "3. PDF dışa aktarma çok yavaş, 30 saniye sürüyor.\n" +
      "4. Fiyatlandırma sayfasında yıllık indirim görünmüyor.\n" +
      "5. Takım arkadaşımı davet ettim ama davet e-postası gelmedi.\n" +
      "6. Bildirimler çok sık geliyor, kapatamıyorum.\n" +
      '7. Arama Türkçe karakterlerde sonuç bulamıyor (ör. "işlem").\n' +
      "8. Mobil uygulamada giriş yapamıyorum, sürekli çıkış yapıyor.\n" +
      "9. API anahtarı oluşturma akışı çok karışık.\n" +
      "10. Raporları Excel'e aktarma özelliği çok işimize yarıyor, teşekkürler.",
    // İŞTE asıl test: `themes` NESNE dizisi olmalı, düz string dizisi değil.
    // `direction` yalnız up|down|flat; `count` tam sayı.
    validate: (j) => {
      const dirs = ["up", "down", "flat"];
      if (!j || typeof j !== "object") return "kök nesne değil";
      if (!Array.isArray(j.themes) || j.themes.length === 0) return "themes dizi değil/boş";
      for (const t of j.themes) {
        if (!t || typeof t !== "object" || Array.isArray(t)) {
          return `themes[].* NESNE değil (düz string dizisi gönderilmiş: ${JSON.stringify(t).slice(0, 40)})`;
        }
        if (typeof t.name !== "string" || !t.name.trim()) return "themes[].name yok";
        if (!Number.isInteger(t.count)) return `themes[].count tam sayı değil: ${JSON.stringify(t.count)}`;
        if (typeof t.summary !== "string") return "themes[].summary yok";
      }
      if (j.trends !== undefined) {
        if (!Array.isArray(j.trends)) return "trends dizi değil";
        for (const t of j.trends) {
          if (!t || typeof t !== "object") return "trends[].* nesne değil";
          if (!dirs.includes(t.direction)) return `trends[].direction geçersiz: ${JSON.stringify(t.direction)}`;
        }
      }
      if (!Array.isArray(j.quickWins)) return "quickWins dizi değil";
      if (!Array.isArray(j.risks)) return "risks dizi değil";
      if (typeof j.recommendation !== "string" || !j.recommendation.trim()) return "recommendation boş";
      return null;
    },
  },
};

// ---- argümanlar -----------------------------------------------------------
const args = process.argv.slice(2);
let promptKey = process.env.PROBE_PROMPT ?? "a";
const modelArgs = [];
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === "--prompt=b" || a === "-b") promptKey = "b";
  else if (a === "--prompt=a" || a === "-a") promptKey = "a";
  else if (a.startsWith("--prompt=")) promptKey = a.slice("--prompt=".length);
  else modelArgs.push(a);
}

const prompt = PROMPTS[promptKey];
if (!prompt) {
  console.error(`bilinmeyen istem: ${promptKey} (a | b)`);
  process.exit(1);
}

const DEFAULT_MODELS = [
  "amazon/nova-micro-v1",
  "meta-llama/llama-3.1-8b-instruct",
  "mistralai/mistral-small-24b-instruct-2501",
  "nex-agi/nex-n2.5-pro:free",
  "nex-agi/nex-n2.5-mini:free",
];

const models = modelArgs.length ? modelArgs : DEFAULT_MODELS;
const maxTokens = Number(process.env.PROBE_MAX_TOKENS ?? prompt.maxTokens);

// Fiyatları tek seferde çek (tahmini maliyet için).
const catalog = (await (await fetch("https://openrouter.ai/api/v1/models")).json()).data ?? [];
const priceOf = (id) => catalog.find((m) => m.id === id)?.pricing ?? null;

console.log(`İstem: ${prompt.label} · max_tokens ${maxTokens} · ${models.length} model`);

let failures = 0;
const results = [];
for (const model of models) {
  const started = Date.now();
  let status = 0;
  let raw = "";
  let body = null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0,
        max_tokens: maxTokens,
      }),
    });
    status = res.status;
    raw = await res.text();
    body = JSON.parse(raw);
  } catch (err) {
    console.log(`\n✗ ${model}\n  istek hatası: ${err.message}`);
    failures += 1;
    results.push({ model, ok: false });
    continue;
  }
  const ms = Date.now() - started;

  if (status !== 200) {
    console.log(`\n✗ ${model}\n  HTTP ${status} (${ms}ms): ${raw.slice(0, 180)}`);
    failures += 1;
    results.push({ model, ok: false });
    continue;
  }

  const text = body?.choices?.[0]?.message?.content ?? "";
  const usage = body?.usage ?? {};
  const p = priceOf(model);
  const cost = p
    ? Number(usage.prompt_tokens ?? 0) * parseFloat(p.prompt) +
      Number(usage.completion_tokens ?? 0) * parseFloat(p.completion)
    : null;

  // Kodun da yaptığı gibi ilk `{` ile son `}` arasını al.
  let parsed = null;
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a !== -1 && b > a) {
    try {
      parsed = JSON.parse(text.slice(a, b + 1));
    } catch {
      /* parse hatası aşağıda */
    }
  }
  const shapeError = parsed ? prompt.validate(parsed) : "JSON parse edilemedi";
  const ok = Boolean(parsed) && shapeError === null;

  console.log(`\n${ok ? "✓" : "⚠"} ${model}  [${ms}ms]`);
  console.log(
    `  token: in ${usage.prompt_tokens ?? "?"} / out ${usage.completion_tokens ?? "?"}` +
      (cost !== null ? `  · tahmini maliyet $${cost.toFixed(6)}` : ""),
  );
  console.log(`  JSON: ${parsed ? "evet" : "HAYIR"} · şema: ${ok ? "evet" : `HAYIR — ${shapeError}`}`);
  if (promptKey === "b" && ok) {
    console.log(
      `  themes: ${parsed.themes.map((t) => `${t.name}(${t.count})`).join(", ")}`,
    );
  }
  console.log(`  çıktı: ${text.replace(/\s+/g, " ").slice(0, 260)}`);
  results.push({ model, ok, ms, cost, shapeError });
  if (!ok) failures += 1;
}

console.log(`\n${failures === 0 ? "✅ tüm adaylar şemayı tuttu" : `❌ ${failures}/${models.length} aday şema dışı/başarısız`}`);
process.exit(failures === 0 ? 0 : 1);
