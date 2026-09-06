import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Sprint 63t — workspace entegrasyon gizli bilgileri (api_key, webhook_secret)
// DÜZ saklanıyordu; bu yardımcı AES-256-GCM ile şifreler. GCM hem gizlilik hem
// bütünlük sağlar (AEAD). Format: `enc:v1:<iv>:<tag>:<ciphertext>` (base64url).
// ENCRYPTION_KEY 32 byte'lık base64 değerdir. Kurulu değilse (yerel geliştirme)
// şifreleme atlanır ve düz saklanır — production'da KURULMALIDIR.

const KEY_B64 = process.env.ENCRYPTION_KEY ?? "";
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  if (!KEY_B64) {
    throw new Error("ENCRYPTION_KEY gerekli (32 byte base64).");
  }
  const buf = Buffer.from(KEY_B64, "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY tam 32 byte olmalı (base64).");
  }
  return buf;
}

// Şifreleme anahtarı kurulu mu? (Değilse entegrasyon secret'ı düz saklanır —
// yerel geliştirme için; production'da kurulmalı.)
export function isEncryptionConfigured(): boolean {
  return KEY_B64.length > 0;
}

// Değeri şifrele. Boş / zaten şifreli (enc:v1:) değerler dokunulmadan döner.
export function encryptSecret(value: string): string {
  if (!value || value.startsWith(PREFIX)) return value;
  if (!isEncryptionConfigured()) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ct.toString("base64url")}`;
}

// Değeri çöz. Şifreli değilse (mevcut düz satır / geçiş) aynen döner.
// Çözülemezse (yanlış anahtar/bozuk) null döner — çağıran güvenli varsayar.
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  if (!value.startsWith(PREFIX)) return value;
  if (!isEncryptionConfigured()) return value;
  try {
    const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
    if (!ivB64 || !tagB64 || !ctB64) return null;
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const ct = Buffer.from(ctB64, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch (err) {
    console.error("decryptSecret failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
