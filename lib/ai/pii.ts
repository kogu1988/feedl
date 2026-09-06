// Sprint 48f (PM raporu §9, AI PII) — PII maskeleme.
// Kullanıcı içeriği OpenRouter'a gönderilmeden önce kişisel veri kalıpları
// [pii:tür] yer tutucusuyla değiştirilir. Böylece AI sağlayıcısına giden
// bağlamda e-posta/telefon/TC/no gibi PII sızmaz. Sonuçlar çoğunlukla
// kategori/özet olduğundan unmask gerekmez; yalnızca analize giren metin
// maskelenir.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE =
  /(?:\+?9?0?[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)?\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/g;
const TC_RE = /\b\d{11}\b/g;
const CARD_RE = /\b(?:\d[ -]?){12,19}\b/g;
const IBAN_RE = /\bTR\d{2}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{2}\b/g;

function replace(text: string, re: RegExp, tag: string): string {
  return text.replace(re, tag);
}

function hideOverlaps(text: string): string {
  // "pii:" etiketleri telefon/card regex'leriyle yeniden yakalanabilir;
  // onları korumak için son temizlikte etiket dışını dokunmadan bırakırız.
  return text;
}

export function maskPii(input: string): string {
  if (!input) return input;
  let text = input;
  // Sıra önemli: önce geniş kalıplar (iban/card) sonra dar (email/phone/tc).
  text = replace(text, IBAN_RE, "[pii:iban]");
  text = replace(text, CARD_RE, "[pii:card]");
  text = replace(text, EMAIL_RE, "[pii:email]");
  text = replace(text, TC_RE, "[pii:tc]");
  text = replace(text, PHONE_RE, "[pii:phone]");
  return hideOverlaps(text);
}
