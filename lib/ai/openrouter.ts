import type { ZodType } from "zod";
import { maskPii } from "./pii";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Modeller docs/README.md §1 ve docs/prompts.md'de sabitlendi (canlı test edildi).
const LLM_MODEL = "minimax/minimax-m3:free";
const EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b:free";

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
  const response = await fetch(`${OPENROUTER_BASE_URL}/embeddings`, {
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

/**
 * LLM çağrısı yapar, yanıttaki ilk `{` ile son `}` arası JSON'u çıkarır ve
 * verilen Zod şemasıyla doğrular. Serbest modeller JSON'u markdown çiti
 * içine sarabildiği için çıkarım adımı şarttır.
 * Parse/validasyon hatası fırlatır → Inngest retry ile fonksiyon tekrar dener.
 */
export async function chatJson<T>(options: {
  system: string;
  user: string;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
      temperature: 0,
      max_tokens: options.maxTokens ?? 500,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `LLM request failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

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

  const candidate: unknown = JSON.parse(content.slice(start, end + 1));

  const result = options.schema.safeParse(candidate);
  if (!result.success) {
    throw new Error(
      `LLM JSON failed schema validation: ${result.error.message.slice(0, 300)}`,
    );
  }
  return result.data;
}
