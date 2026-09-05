import { describe, expect, it } from "vitest";

import { voteSchema } from "@/lib/validations/vote";

// Sprint 61 (Claude #2, KABUL) — oy mutation'ına giden post kimliği doğrulaması.
// Geçersiz kimlik 400 döner; geçerli uuid kabul edilir.
describe("voteSchema", () => {
  it("accepts a valid post uuid", () => {
    const result = voteSchema.safeParse({
      postId: "5e8ad70c-ee46-4308-8a21-25d1ab347ba0",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid post id", () => {
    expect(voteSchema.safeParse({ postId: "not-a-uuid" }).success).toBe(false);
    expect(voteSchema.safeParse({ postId: 123 }).success).toBe(false);
    expect(voteSchema.safeParse({}).success).toBe(false);
  });
});
