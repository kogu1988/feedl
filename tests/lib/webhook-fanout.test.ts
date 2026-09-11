import { describe, expect, it, vi } from "vitest";

// 2026-09-11 regresyonu: send-webhooks teslimatı `for (endpoint) { await ... }`
// idi ve ilk hata döngüyü kırıyordu → tek bir ölü endpoint, listede
// kendisinden SONRAKİ tüm endpoint'leri kalıcı olarak aç bırakıyordu.
import { deliverToAllEndpoints } from "@/lib/webhooks/dispatch";

function ep(id: string) {
  return { id, url: `https://example.com/${id}`, secret: "whsec_test" };
}

describe("deliverToAllEndpoints", () => {
  it("tüm endpoint'lere sırayla teslim eder", async () => {
    const seen: string[] = [];
    const res = await deliverToAllEndpoints(
      [ep("a"), ep("b"), ep("c")],
      async (e) => {
        seen.push(e.id);
      },
    );
    expect(seen).toEqual(["a", "b", "c"]);
    expect(res).toEqual({ delivered: 3, failed: [] });
  });

  it("ortadaki endpoint hata verse bile SONRAKİLER de denenir", async () => {
    const seen: string[] = [];
    const res = await deliverToAllEndpoints(
      [ep("a"), ep("b"), ep("c")],
      async (e) => {
        seen.push(e.id);
        if (e.id === "b") throw new Error("HTTP 404");
      },
    );
    // Eskiden "c" hiç denenmezdi.
    expect(seen).toEqual(["a", "b", "c"]);
    expect(res).toEqual({ delivered: 2, failed: ["b"] });
  });

  it("hatayı yutar (fırlatma çağıranın işi) ve konsola yazar", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await deliverToAllEndpoints([ep("x")], async () => {
      throw new Error("boom");
    });
    expect(res).toEqual({ delivered: 0, failed: ["x"] });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("boş listede no-op", async () => {
    const res = await deliverToAllEndpoints([], async () => {});
    expect(res).toEqual({ delivered: 0, failed: [] });
  });
});
