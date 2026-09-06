import "server-only";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { apiIdempotency, type ApiKey } from "@/lib/db/schema";

// Sprint 63x — Public API idempotency. İstemci, bir POST isteğini
// `Idempotency-Key` başlığıyla gönderir. Aynı `(apiKeyId, idempotencyKey)`
// kombinasyonuyla tekrarlanan istek, ilk yanıtın kopyasını döndürür — duplike
// kayıt (fikir/geri bildirim) ve buna bağlı AI/autopilot maliyeti oluşmaz.
// Bu, retry penceresi yaşam döngüsüyle sınırlıdır: yanıt `expiresAt` sonrası
// prune edilir (aşağıda INGEST/RETRY benchmark'ına uygun 24 saat).

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 saat

// Başlıkta idempotency key yoksa null döner — çağıran taraf no-op davranır.
export function readIdempotencyKey(req: Request): string | null {
  // Başlık ön-ekli (Idempotency-Key) veya alternatif (X-Idempotency-Key).
  const key =
    req.headers.get("idempotency-key") ?? req.headers.get("x-idempotency-key");
  const trimmed = key?.trim();
  return trimmed && trimmed.length <= 200 ? trimmed : null;
}

// Daha önce kaydedilmiş yanıt var mı? Varsa döndürülür (200/201 it's not
// re-executed — idempotent replay).
async function findReplay(
  apiKeyId: string,
  idempotencyKey: string,
  method: string,
  path: string,
): Promise<NextResponse | null> {
  const [record] = await getDb()
    .select()
    .from(apiIdempotency)
    .where(
      and(
        eq(apiIdempotency.apiKeyId, apiKeyId),
        eq(apiIdempotency.idempotencyKey, idempotencyKey),
        eq(apiIdempotency.requestMethod, method),
        eq(apiIdempotency.requestPath, path),
      ),
    )
    .limit(1);
  if (!record) return null;
  // Süresi geçmiş kayıt replay edilemez — uygulayıcı çağrıyı yeniden çalıştırır.
  if (record.expiresAt.getTime() < Date.now()) return null;
  return NextResponse.json(record.responseBody, { status: record.responseStatus });
}

async function storeResponse(
  apiKeyId: string,
  idempotencyKey: string,
  method: string,
  path: string,
  response: NextResponse,
): Promise<void> {
  const body = await response.clone().json().catch(() => ({}));
  const rows = await getDb()
    .insert(apiIdempotency)
    .values({
      apiKeyId,
      idempotencyKey,
      requestMethod: method,
      requestPath: path,
      responseStatus: response.status,
      responseBody: body,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000),
    })
    .onConflictDoNothing({
      target: [apiIdempotency.apiKeyId, apiIdempotency.idempotencyKey],
    })
    .returning({ id: apiIdempotency.id });
  // onConflictDoNothing: eşzamanlı iki istek aynı anahtarla yarışırsa biri
  // yazar, diğeri sessizce geçer — replay alır (üstteki findReplay).
  void rows;
}

// idempotent yürütme sarmalayıcı. `handler` yalnızca key yoksa kayıt
// yoksa (veya o key için hiç kayıt yoksa) çalışır. Çağıran route, gerçek
// işlem mantığını `handler` içinde tutar.
export async function withIdempotency(
  req: Request,
  key: Pick<ApiKey, "id">,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const idempotencyKey = readIdempotencyKey(req);
  if (!idempotencyKey) {
    // Key yoksa eski davranış — garantili idempotency sözü verilmez.
    return handler();
  }

  const method = req.method.toUpperCase();
  const path = new URL(req.url).pathname;

  // Önce kayıtlı yanıtı kontrol et (replay).
  const replay = await findReplay(key.id, idempotencyKey, method, path);
  if (replay) {
    return replay;
  }

  const response = await handler();
  // Yalnızca başarı (2xx) yanıtlarını önbelleğe al — hata denemesinde aynı
  // key'i yeniden kullanmak gerçek sonucu döndürsün. 4xx/5xx cache'lenmez.
  if (response.status >= 200 && response.status < 300) {
    await storeResponse(key.id, idempotencyKey, method, path, response);
  }
  return response;
}
