import { beforeEach, describe, expect, it } from "vitest";

// Sprint 63w (B4) — LLM model zinciri (birincil + opsiyonel fallback).
beforeEach(() => {
  delete process.env.LLM_MODEL;
  delete process.env.LLM_FALLBACK_MODEL;
});

describe("chatModels", () => {
  it("returns only the default primary when no fallback configured", async () => {
    const { chatModels } = await import("@/lib/ai/openrouter");
    expect(chatModels()).toEqual(["minimax/minimax-m3:free"]);
  });

  it("appends the fallback model when configured", async () => {
    process.env.LLM_FALLBACK_MODEL = "google/gemini-2.5-flash";
    const { chatModels } = await import("@/lib/ai/openrouter");
    expect(chatModels()).toEqual([
      "minimax/minimax-m3:free",
      "google/gemini-2.5-flash",
    ]);
  });

  it("allows overriding the primary via LLM_MODEL", async () => {
    process.env.LLM_MODEL = "google/gemini-2.5-flash";
    process.env.LLM_FALLBACK_MODEL = "openai/gpt-4o-mini";
    const { chatModels } = await import("@/lib/ai/openrouter");
    expect(chatModels()).toEqual(["google/gemini-2.5-flash", "openai/gpt-4o-mini"]);
  });
});
