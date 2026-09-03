import type { NextRequest } from "next/server";

// Widget isteklerinin kaynak origin'ini çözer. Cross-origin çağrılarda
// Origin, yoksa Referer'dan türetilir (sekmeler arası GET'lerde ikisi de
// olmayabilir → null).
export function requestOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const referer = req.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
