import { NextResponse } from "next/server";

import { apiDoc } from "@/lib/v1/openapi";

// Sprint 63x — Public API OpenAPI dokümanı (JSON). `operationId`'lerle SDK
// üretimi (typescript, openapi-generator) ve Postman/Insomnia import desteklenir.
// Dokümanın kaynağı `lib/v1/openapi.ts` (kod ile güncellenir, ayrı dosya değil).
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(apiDoc);
}
