import { beforeEach, describe, expect, it } from "vitest";

// Sprint 63w (B4) — LLM model zinciri (birincil + fallback).
// 2026-09-11 dersi: OpenRouter ücretsiz modelleri haber vermeden emekliye
// ayrılıyor (`minimax/minimax-m3:free` 404 → tüm AI prod'da sessizce öldü).
// Bu yüzden varsayılanlar canlı doğrulanmış ücretli modellerdir ve fallback
// zinciri VARSAYILAN OLARAK DOLUDUR (env'siz kurulumda da korumalı).
beforeEach(() => {
  delete process.env.LLM_MODEL;
  delete process.env.LLM_FALLBACK_MODEL;
});

describe("chatModels", () => {
  it("env yokken canlı doğrulanmış birincil + varsayılan fallback döner", async () => {
    const { chatModels } = await import("@/lib/ai/openrouter");
    expect(chatModels()).toEqual(["amazon/nova-micro-v1", "mistralai/mistral-nemo"]);
  });

  it("LLM_FALLBACK_MODEL varsayılan fallback'i DEĞİŞTİRİR", async () => {
    process.env.LLM_FALLBACK_MODEL = "google/gemini-2.5-flash";
    const { chatModels } = await import("@/lib/ai/openrouter");
    expect(chatModels()).toEqual([
      "amazon/nova-micro-v1",
      "google/gemini-2.5-flash",
    ]);
  });

  it("virgülle birden çok fallback zincirlenebilir", async () => {
    process.env.LLM_FALLBACK_MODEL = "mistralai/mistral-nemo, amazon/nova-lite-v1";
    const { chatModels } = await import("@/lib/ai/openrouter");
    expect(chatModels()).toEqual([
      "amazon/nova-micro-v1",
      "mistralai/mistral-nemo",
      "amazon/nova-lite-v1",
    ]);
  });

  it("LLM_MODEL birincili override eder", async () => {
    process.env.LLM_MODEL = "google/gemini-2.5-flash";
    process.env.LLM_FALLBACK_MODEL = "openai/gpt-4o-mini";
    const { chatModels } = await import("@/lib/ai/openrouter");
    expect(chatModels()).toEqual(["google/gemini-2.5-flash", "openai/gpt-4o-mini"]);
  });

  it("birincil fallback'te tekrar ederse zincirden düşer (tekilleştirme)", async () => {
    process.env.LLM_MODEL = "mistralai/mistral-nemo";
    process.env.LLM_FALLBACK_MODEL = "mistralai/mistral-nemo";
    const { chatModels } = await import("@/lib/ai/openrouter");
    expect(chatModels()).toEqual(["mistralai/mistral-nemo"]);
  });
});
