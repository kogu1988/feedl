import { describe, expect, it } from "vitest";

import { ALL_PAGE_SIZE, parsePagination } from "@/lib/pagination";

describe("parsePagination", () => {
  it("defaults to 5 per page and page 1", () => {
    expect(parsePagination(undefined, undefined)).toEqual({
      per: "5",
      perSize: 5,
      requestedPage: 1,
    });
  });

  it("accepts whitelisted page sizes", () => {
    expect(parsePagination("25").perSize).toBe(25);
    expect(parsePagination("50").perSize).toBe(50);
    expect(parsePagination("all").per).toBe("all");
    expect(parsePagination("all").perSize).toBe(ALL_PAGE_SIZE);
  });

  it("falls back to 5 on invalid page size", () => {
    expect(parsePagination("7").per).toBe("5");
    expect(parsePagination("all/").per).toBe("5");
    expect(parsePagination("").per).toBe("5");
  });

  it("parses valid page numbers", () => {
    expect(parsePagination(undefined, "3").requestedPage).toBe(3);
  });

  it("falls back to page 1 on invalid page numbers", () => {
    expect(parsePagination(undefined, "0").requestedPage).toBe(1);
    expect(parsePagination(undefined, "-2").requestedPage).toBe(1);
    expect(parsePagination(undefined, "2.5").requestedPage).toBe(1);
    expect(parsePagination(undefined, "abc").requestedPage).toBe(1);
  });
});
