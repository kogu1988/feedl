import type { ZodType } from "zod";
import { maskPii } from "./pii";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Modeller docs/README.md §1 ve docs/prompts.md'de sabitlendi (canlı test edildi).
// Sprint 63w (B4): LLM_MODEL env ile override edilebilir; LLM_FALLBACK_MODEL
// varsa birincil model 429/5xx verince fallback denenir (ücretli gemini vs.).
const LLM_MODEL_DEFAULT = "minimax/minimax-m3:free";
const EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b:free";

// Aktif LLM model listesi: birincil + opsiyonel fallback. Birincili env override
// edip dengeyi değiştirmeden fallback zincirini kullanabilirsin. (Test için export.)
export function chatModels(): string[] {
  const primary = process.env.LLM_MODEL || LLM_MODEL_DEFAULT;
  const fallback = process.env.LLM_FALLBACK_MODEL;
  return fallback ? [primary, fallback] : [primary];
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

/** Tek metni 2048 boyutlu vektöre çevirir (docs/prompts.md §3). */
export async function embedText(input: string): Promise<number[]> {
  const safeInput = maskPii(input);
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
    throw new Error(
      `Embedding request failed (${response.status}): ${detail.slice(0, 200)}`,
    );
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
// ham (unsafe) çıktıyı döner. Sprint 63w: model zinciri — birincil ücretsiz
// 429/5xx verirse ve LLM_FALLBACK_MODEL varsa sıradaki modele geçer (tek modelde
// kısa beklemeli retry de `fetchWithRetry` ile zaten var). Ağ/hata son modelde
// fırlatır → Inngest retry yakar. Şema doğrulaması çağıran tarafındadır.
async function requestChatJson(options: ChatJsonOptions): Promise<unknown> {
  const models = chatModels();
  let lastErr: unknown;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
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

      // HTTP hatası: son modeldeyse fırlat, değilse fallback'e geç.
      const detail = await response.text().catch(() => "");
      const err = new Error(
        `LLM request failed (${response.status}) [${model}]: ${detail.slice(0, 200)}`,
      );
      if (i === models.length - 1) throw err;
      lastErr = err;
    } catch (err) {
      if (i === models.length - 1) throw err;
      lastErr = err;
    }
  }

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
