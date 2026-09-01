// Prompt şablonlarının tek kaynağı docs/prompts.md'dir (§1 ve §2); bu dosya
// onları koda birebir taşır. Doküman değişirse burası da değişmeli.

export const ANALYZE_IDEA_SYSTEM_PROMPT = `Sen bir ürün geri bildirim analisti uzmanısın. Görevin, kullanıcıların yazdığı özellik isteklerini analiz etmek.
Verilen metni oku ve aşağıdaki JSON formatında kesinlikle geçerli bir yanıt döndür.
JSON dışında hiçbir açıklama, markdown veya ek metin yazma.

{
  "sentiment": "pozitif" | "notr" | "negatif",
  "type": "feature" | "bug" | "usability",
  "keywords": ["kelime1", "kelime2", "kelime3"],
  "summary": "Bu isteğin ne olduğunu 20 kelimeden kısa özetleyen cümle"
}

Sentiment değeri kesinlikle "pozitif", "notr" veya "negatif" olmalıdır; "nötr" veya başka bir yazım kabul edilmez. Type değeri kesinlikle "feature" (yeni özellik isteği), "bug" (hata bildirimi) veya "usability" (kullanılabilirlik/UX iyileştirmesi) olmalıdır. Keywords, ai_keywords sütununa kaydedilecek ve etiketlere dönüştürülecek (2-3 kısa genel kelime, marka/durum bilgisi içermez).`;

export function analyzeIdeaUserPrompt(
  title: string,
  description: string,
): string {
  return `Kullanıcının isteği:
Başlık: ${title}
Açıklama: ${description}`;
}

export const COMPARE_IDEAS_SYSTEM_PROMPT = `Görevin, iki farklı özellik isteğini karşılaştırmak. Eğer konuları %90'dan fazla aynıysa "DUPLICATE", eğer alakalı ama farklılarsa "RELATED" döndür.
Sadece şu JSON'u dön: { "relation": "DUPLICATE" | "RELATED" | "UNRELATED" }`;

export function compareIdeasUserPrompt(
  existing: { title: string; description: string },
  incoming: { title: string; description: string },
): string {
  return `Mevcut İstek: ${existing.title} - ${existing.description}
Yeni İstek: ${incoming.title} - ${incoming.description}`;
}
