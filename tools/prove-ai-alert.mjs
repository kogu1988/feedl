// AI arızasında Sentry yakalamasının ÜRETİM çalışma zamanından gerçekten
// çalıştığını kanıtlar.
//
// Sorun: `lib/ai/openrouter.ts` → `reportLlmFailure` koddaki TEK açık
// `captureException` çağrısıdır ve 90 gündür feedl Sentry projesine uygulamadan
// HİÇ olay gelmemiştir (FEEDL-1/2/3 hep elle gönderilen provalar). Yani
// instrumentation/DSN zinciri üretimde hiç doğrulanmadı — alert kuralı kurulsa
// bile olay gelmezse sessiz kalırız.
//
// Yöntem (deploy YOK, env değişikliği YOK, DB yazımı YOK):
//   Embedding ucu 4096 TOKEN'ı aşan girdiyi 422 ile reddeder. İlk varsayım
//   "8002 karakter" YANLIŞTI: 9016 karakterlik bir prova BAŞARIYLA gömüldü çünkü
//   sınır karakter değil token'dır (~2-4 karakter/token). Ölçüm:
//   tools/probe-embedding-limit.mjs. `ai-autopilot` ilk adımda
//   `${title}\n${description}` metnini gömer. `post/created` olayını sınırın
//   ÇOK ÜSTÜNDE bir açıklama + RASTGELE (var olmayan) postId ile gönderirsek:
//     • ai-autopilot  → embedText 422 → reportLlmFailure("embedding",…) ✅
//       (gömme BAŞARILI olursa zincir devam eder ve `sync-tags` FK ihlaliyle
//        ölür + `tags` tablosuna sahipsiz satır bırakır — uzunluk kritik;
//        artıkları `tools/cleanup-ai-probe.mjs` ile temizle)
//     • notify-admin  → post yok → alıcı yok → e-posta GÖNDERMEZ
//     • send-webhooks → aktif endpoint yoksa erken döner
//
// KANIT (2026-09-12): 30000 karakterlik açıklamayla gönderilen olay
//   Sentry'de FEEDL-4'ü üretti — başlık "Embedding request failed (422)",
//   culprit `POST /api/inngest`, `issue.priority:high` ve high-priority
//   kuralı (807520) tetiklendi (lastTriggered 08:54:09Z). Yani UYGULAMA
//   çalışma zamanından Sentry yakalaması ve e-posta bildirimi uçtan uca çalışıyor.
//
// Yan etki: Inngest'te 2-3 başarısız `ai-autopilot` run'ı görünür (bilinçli).
// Sonrasında oluşan Sentry issue'sunu `resolved` yap.
//
// Kullanım:
//   node tools/prove-ai-alert.mjs               # kuru çalıştırma (varsayılan)
//   node tools/prove-ai-alert.mjs --apply
//   node tools/prove-ai-alert.mjs --apply --len=40000
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

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

const apply = process.argv.includes("--apply");
if (!existsSync(".env.local")) {
  console.error(".env.local bulunamadı.");
  process.exit(1);
}
const env = parseDotenv(readFileSync(".env.local", "utf8"));
const eventKey = env.INNGEST_EVENT_KEY;
if (!eventKey) {
  console.error("INNGEST_EVENT_KEY yok (.env.local).");
  process.exit(1);
}

const lenArg = process.argv.slice(2).find((a) => a.startsWith("--len="));
// Varsayılan 30000: API sınırının (8000 < sınır < 16000) rahat üstünde.
const LONG = "x".repeat(lenArg ? Number(lenArg.split("=")[1]) : 30000);
const payload = {
  name: "post/created",
  data: {
    // Kasıtlı olarak var olmayan UUID: hiçbir kaydı okumaz/yazmaz.
    postId: randomUUID(),
    title: "AI alert probe",
    description: LONG,
    userId: "ai-alert-probe",
  },
};

console.log("gönderilecek olay: post/created");
console.log(`  postId      : ${payload.data.postId} (var olmayan, kasıtlı)`);
console.log(`  description : ${LONG.length} karakter (gömme sınırının üstünde)`);
console.log("  beklenen    : ai-autopilot ilk adımda 422 alır → Sentry `area=llm`");
console.log("                olayı + high-priority kuralı ile e-posta");
if (!apply) {
  console.log("\n(kuru çalıştırma — göndermek için --apply)");
  process.exit(0);
}

const res = await fetch(`https://inn.gs/e/${eventKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const text = await res.text();
console.log(`\nHTTP ${res.status} ${text.slice(0, 200)}`);
if (!res.ok) process.exit(1);
console.log(
  [
    "\nŞimdi doğrula (birkaç saniye–1 dk):",
    "  · Sentry: area:llm scope:embedding environment:production issue'SU",
    "    (server_name Vercel olmalı → UYGULAMADAN geldiğinin kanıtı)",
    "  · E-posta: konu 'LLM pipeline failure' / yüksek öncelikli issue",
    "  · Inngest: ai-autopilot FAILED run'ları (beklenen)",
    "Sonra issue'yu resolved yap; bu 2-3 failed run bilinçli provadır.",
    "Yan etki kalırsa: node tools/cleanup-ai-probe.mjs [--apply]",
  ].join("\n"),
);
