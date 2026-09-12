import * as Sentry from "@sentry/nextjs";
import type { ZodType } from "zod";
import { maskPii } from "./pii";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Modeller docs/README.md §1 ve docs/prompts.md'de sabitlendi (canlı test edildi).
// Sprint 63w (B4): LLM_MODEL env ile override edilebilir; LLM_FALLBACK_MODEL
// varsa birincil model 429/5xx/kullanılamaz durumunda sıradaki denenir.
//
// DERS (2026-09-11): OpenRouter ücretsiz modelleri HABER VERMEDEN emekliye
// ayrılıyor — `minimax/minimax-m3:free` bir gün 404 dönmeye başladı ve
// üretimde tüm AI fonksiyonları (ai-autopilot 9/9, corpus-insights 1/1)
// öldü; tek sinyal Inngest'teki failed run'lardı. Bu yüzden:
//   1) varsayılanlar yalnızca CANLI doğrulanmış ücretli modeller olur
//      (ücretsizler upstream 429 + reasoning token sızıntısı ile düzensiz —
//      `tools/probe-llm-models.mjs` ile ölçüldü),
//   2) fallback zinciri her zaman dolu tutulur (env'den),
//   3) tüm modeller tükenirse hata SESLİ (Sentry) hale gelir.
// Ölçümler ve istemler: tools/llm-model-test-prompts.md
const LLM_MODEL_DEFAULT = "amazon/nova-micro-v1";
const LLM_FALLBACK_DEFAULT = "mistralai/mistral-nemo";
const EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b:free";

// Aktif LLM model listesi: birincil + fallback. Üçüncü bir model id'si
// virgülle LLM_FALLBACK_MODEL'a yazılabilir. (Test için export.)
export function chatModels(): string[] {
  const primary = process.env.LLM_MODEL || LLM_MODEL_DEFAULT;
  const fallbackRaw = process.env.LLM_FALLBACK_MODEL || LLM_FALLBACK_DEFAULT;
  const extras = fallbackRaw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const chain = [primary, ...extras].filter((m, i, arr) => arr.indexOf(m) === i);
  return chain;
}

// AI hattı sessizce ölmesin: bir model emekliye ayrıldığında ya da tüm zincir
// tükendiğinde Sentry'ye raporla (DSN yoksa capture no-op'tur).
function reportLlmFailure(scope: string, models: string[], err: unknown): void {
  try {
    Sentry.captureException(err, {
      tags: { area: "llm", scope },
      extra: { models },
    });
  } catch {
    /* Sentry yapılandırılmamışsa veya hata verirse ana akışı bozma */
  }
}

function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  return apiKey;
}

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
}

// Embedding modeli 4096 TOKEN'da 422 döner ve mesajı "set truncate=END or START
// to truncate long inputs" der — ancak OpenRouter bu parametreyi DİKKATE ALMAZ
// (canlı ölçüm 2026-09-12: truncate=END ile de aynı 422). Bu yüzden kırpmayı
// İSTEMCİ tarafında yapıyoruz: aksi halde uzun bir geri bildirim TÜM AI
// zenginleştirmesini (özet/triage/etiket/benzerlik/embedding) düşürür.
// Karakter tavanı en kötü tokenizasyonda (~2 karakter/token) bile 4096 token'ın
// altında kalır. Ölçümler: tools/probe-embedding-limit.mjs
// (krş. tools/prove-ai-alert.mjs — bu hata Sentry'de FEEDL-4 olarak doğrulandı)
export const MAX_EMBEDDING_INPUT_CHARS = 7000;

// Sıra önemli: önce PII maskelenir, SONRA kırpılır. Kırpma önce yapılırsa bir
// PII kalıbı ortadan kesilip maskelenmeden sağlayıcıya gidebilirdi.
export function capEmbeddingInput(input: string): string {
  return input.slice(0, MAX_EMBEDDING_INPUT_CHARS);
}

/** Tek metni 2048 boyutlu vektöre çevirir (docs/prompts.md §3). */
export async function embedText(input: string): Promise<number[]> {
  const safeInput = capEmbeddingInput(maskPii(input));
  const response = await fetchWithRetry(`${OPENROUTER_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: safeInput }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const err = new Error(
      `Embedding request failed (${response.status}): ${detail.slice(0, 200)}`,
    );
    // Embedding modeli de haber verilmeden emekliye ayrılabilir → sesli hata.
    reportLlmFailure("embedding", [EMBEDDING_MODEL], err);
    throw err;
  }

  const payload: unknown = await response.json();
  const embedding = (payload as EmbeddingResponse).data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Embedding response is malformed");
  }
  return embedding;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

// Geçici OpenRouter/ücretsiz 429/5xx hatalarında sınırlı yeniden deneme.
// Free sağlayıcılar yoğunlukta geçici 429 dönebilir; tek denemeyle pes
// etmek yerine kısa beklemeli 2 ek deneme yapar (Inngest retry katmanına
// da düşer, ama kalıcı araya girip bekleme maliyetini düşürür).
const RETRY_DELAYS_MS = [800, 2000];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, init);
      if (!RETRYABLE_STATUS.has(response.status) || attempt === RETRY_DELAYS_MS.length) {
        return response;
      }
    } catch (err) {
      lastError = err;
      if (attempt === RETRY_DELAYS_MS.length) throw err;
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastError;
}

interface ChatJsonOptions {
  system: string;
  user: string;
  maxTokens?: number;
}

// LLM çağrısı yapar, yanıttaki ilk `{` ile son `}` arası JSON'u çıkarır ve
// ham (unsafe) çıktıyı döner. Serbest modeller JSON'u markdown çiti içine
// sarabildiği için çıkarım adımı şarttır. 429/5xx'te kısa beklemeli yeniden
// dener; ağ hatası fırlatır (Inngest retry bunu yakar). Şema doğrulaması
// ÇAĞIRAN tarafındadır — serbest modeller iç içe nesne şemasını eşit takip
// etmediği için (örn. themes: string[] döndürebilir), şekil normalizasyonunu
// çağıran yapabilir (bkz. analyzeCorpus).
// Bir yanıttan JSON içeriğini çıkarır (markdown çiti sarmalaması, ilk `{`..son `}`).
async function parseChatContent(response: Response): Promise<unknown> {
  const payload: unknown = await response.json();
  const content = (payload as ChatResponse).choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("LLM response is malformed");
  }
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("LLM response contains no JSON object");
  }
  return JSON.parse(content.slice(start, end + 1)) as unknown;
}

// LLM çağrısı yapar, yanıttaki ilk `{` ile son `}` arası JSON'u çıkarır ve
// ham (unsafe) çıktıyı döner. Model zinciri: birincil başarısız olursa
// (429/5xx/kullanılamaz) sıradaki denenir. Zincir tamamen tükenirse hata
// SESLİ hale getirilir (Sentry) ve Inngest retry için fırlatılır.
async function requestChatJson(options: ChatJsonOptions): Promise<unknown> {
  const models = chatModels();
  let lastErr: unknown;

  for (const model of models) {
    try {
      const response = await fetchWithRetry(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: options.user },
          ],
          temperature: 0,
          max_tokens: options.maxTokens ?? 500,
        }),
      });

      if (response.ok) {
        return await parseChatContent(response);
      }

      const detail = await response.text().catch(() => "");
      lastErr = new Error(
        `LLM request failed (${response.status}) [${model}]: ${detail.slice(0, 200)}`,
      );
      console.error(`LLM modeli başarısız [${model}]: HTTP ${response.status}`);
    } catch (err) {
      lastErr = err;
      console.error(
        `LLM modeli başarısız [${model}]:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Tüm modeller tükendi: sessiz ölüm yerine sesli hata.
  reportLlmFailure("chat-json", models, lastErr);
  throw lastErr;
}

/**
 * LLM çağrısı yapar, yanıttaki ilk `{` ile son `}` arası JSON'u çıkarır ve
 * verilen Zod şemasıyla doğrular. Serbest modeller JSON'u markdown çiti
 * içine sarabildiği için çıkarım adımı şarttır. 429/5xx'te kısa beklemeli
 * yeniden dener.
 * Parse/validasyon hatası fırlatır → Inngest retry ile fonksiyon tekrar dener.
 */
export async function chatJson<T>(options: {
  system: string;
  user: string;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  const candidate: unknown = await requestChatJson(options);

  const result = options.schema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `LLM JSON failed schema validation: ${result.error.message.slice(0, 300)}`,
    );
  }
  return result.data;
}

// İç içe nesne şeması bekleyen çağrılar (örn. corpus insights) LLM'den ham
// çıktı alıp normalizasyon yapmak isteyebilir — bu yardımcı ham JSON'u döner.
export async function chatJsonRaw(options: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<unknown> {
  return requestChatJson(options);
}
