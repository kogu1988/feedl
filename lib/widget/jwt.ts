import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Widget SDK JWT yardımcıları (plan.md Sprint 32). Dış bağımlılık yerine
// node:crypto ile HS256 uygulanır: müşteri uygulaması herhangi bir JWT
// kütüphanesiyle imzalar, feedl yalnızca doğrular; feedl'in kendi widget
// oturumu (12 saatlik çerez jetonu) da burada imzalanır.
export const ISSUER = "feedl";
export const WIDGET_AUDIENCE = "feedl-widget";
export const SESSION_AUDIENCE = "feedl-widget-session";
export const WIDGET_SESSION_COOKIE = "feedl_widget";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
export const CLOCK_LEEWAY_SECONDS = 60;

// Müşteri uygulamasının kendi kullanıcı kimliği (opaque). Clerk ID'ler
// "user_..." biçiminde olduğundan "widget_" öneki çakışmayı imkânsız kılar.
const SUB_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// base64url bölümleri katı doğrulanır; Buffer decoder'ı esnek olduğu için
// geçersiz karakterleri baştan reddetmek gerekir.
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface WidgetIdentity {
  sub: string;
  name: string | null;
  email: string | null;
}

function getWidgetSecret(): string {
  return process.env.FEEDL_WIDGET_SECRET ?? "";
}

// Widget akışı yapılandırılmış mı? Secret en az 16 karakter olmalı.
export function isWidgetConfigured(): boolean {
  return getWidgetSecret().length >= 16;
}

// Opaque müşteri kimliğini feedl kullanıcı kimliğine çevirir.
export function toWidgetUserId(sub: string): string {
  return `widget_${sub}`;
}

// Origin allowlist'i Sprint 38'den itibaren lib/widget/origins.ts'tedir:
// self origin + env listesi + widget_origins tablosu (hepsinde yoksa red).

function signHs256(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
    "utf8",
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

// İmzayı timingSafeEqual ile doğrular; geçerliyse payload'ı döndürür.
function verifyHs256(
  token: string,
  secret: string,
): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  if (
    !headerPart ||
    !payloadPart ||
    !signaturePart ||
    !BASE64URL_PATTERN.test(headerPart) ||
    !BASE64URL_PATTERN.test(payloadPart) ||
    !BASE64URL_PATTERN.test(signaturePart)
  ) {
    return null;
  }

  let header: { alg?: unknown };
  try {
    header = JSON.parse(
      Buffer.from(headerPart, "base64url").toString("utf8"),
    ) as { alg?: unknown };
  } catch {
    return null;
  }
  if (header?.alg !== "HS256") return null;

  const expected = createHmac("sha256", secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest();
  const provided = Buffer.from(signaturePart, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    );
    if (typeof payload !== "object" || payload === null) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
}

// exp zorunludur: süresiz jetonlar reddedilir (kalıcı oturum riski).
function isExpired(payload: Record<string, unknown>, nowSeconds: number): boolean {
  const exp = payload.exp;
  if (typeof exp !== "number") return true;
  return exp + CLOCK_LEEWAY_SECONDS < nowSeconds;
}

// Müşteri uygulamasının ürettiği widget jetonunu doğrular.
export function verifyWidgetToken(token: string): WidgetIdentity | null {
  const secret = getWidgetSecret();
  if (secret.length < 16) return null;

  const payload = verifyHs256(token, secret);
  if (!payload) return null;
  if (payload.iss !== ISSUER || payload.aud !== WIDGET_AUDIENCE) return null;
  if (isExpired(payload, Math.floor(Date.now() / 1000))) return null;
  if (typeof payload.sub !== "string" || !SUB_PATTERN.test(payload.sub)) {
    return null;
  }

  return {
    sub: payload.sub,
    name: normalizeOptionalText(payload.name, 120),
    email: normalizeOptionalText(payload.email, 254),
  };
}

// Admin token üreticisi (app/api/admin/widget-token): 1 saatlik widget jetonu.
export function signWidgetToken(
  identity: WidgetIdentity,
  ttlSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  return signHs256(
    {
      iss: ISSUER,
      aud: WIDGET_AUDIENCE,
      sub: identity.sub,
      ...(identity.name ? { name: identity.name } : {}),
      ...(identity.email ? { email: identity.email } : {}),
      iat: now,
      exp: now + ttlSeconds,
    },
    getWidgetSecret(),
  );
}

export interface WidgetSession {
  userId: string;
  // Oturum açılırken yakalanan müşteri sitesi origin'i (varsa). İframe
  // içinden gelen isteklerde Origin feedl olduğu için gerçek müşteri
  // kaynağı yalnızca buradan bilinir (posts.widgetOrigin bunu kullanır).
  origin: string | null;
}

// feedl'in kendi widget oturum jetonu (httpOnly çerez değeri). origin
// varsa jetona gömülür; böylece sonraki widget isteklerinde müşteri
// sitesi kaynağı korunur.
export function signSessionToken(
  widgetUserId: string,
  origin: string | null,
): string {
  const now = Math.floor(Date.now() / 1000);
  return signHs256(
    {
      iss: ISSUER,
      aud: SESSION_AUDIENCE,
      sub: widgetUserId,
      ...(origin ? { o: origin.slice(0, 200) } : {}),
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
    },
    getWidgetSecret(),
  );
}

function verifySessionPayload(token: string): WidgetSession | null {
  const secret = getWidgetSecret();
  if (secret.length < 16) return null;

  const payload = verifyHs256(token, secret);
  if (!payload) return null;
  if (payload.iss !== ISSUER || payload.aud !== SESSION_AUDIENCE) return null;
  if (isExpired(payload, Math.floor(Date.now() / 1000))) return null;
  if (typeof payload.sub !== "string" || !SUB_PATTERN.test(payload.sub)) {
    return null;
  }
  const origin =
    typeof payload.o === "string" && payload.o.length > 0 && payload.o.length <= 200
      ? payload.o
      : null;
  // sub zaten feedl widget kullanıcı kimliğidir (session route
  // toWidgetUserId uygulanmış hâlini imzalar) - burada tekrar
  // prefix'lenemez, aksi halde FK eşleşmez (widget_widget_... bug'ı).
  return { userId: payload.sub, origin };
}

// İframe içindeki widget sayfası/API'leri için oturum kimliği.
// Widget kullanıcıları Clerk oturumu taşımaz; kimlik çerezden çözülür.
export async function getWidgetSession(): Promise<WidgetSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(WIDGET_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionPayload(token);
}
