# feedl - AI Prompt Şablonları, Event Şemaları & AI Context

## 1. OpenRouter - Duygu Analizi (Sentiment) & Etiket Çıkarma

**Kullanım Yeri:** Yeni bir `Post` oluşturulduğunda Inngest içinde çalışır.  
**Model Önerisi:** `meta-llama/llama-3.1-70b-instruct` (OpenRouter üzerinden)  
**Çıktı Doğrulaması:** LLM yanıtı Zod ile doğrulanmalı; `nötr` gibi varyantlar `notr`'a normalize edilmelidir. Parse edilemeyen yanıt hata sayılır ve Inngest retry ile tekrar denenir. JSON'daki `sentiment` değeri `sentiment_label` sütununa, `keywords` dizisi `ai_keywords` sütununa, `summary` ise `ai_summary` sütununa yazılır.

**System Prompt:**

```text
Sen bir ürün geri bildirim analisti uzmanısın. Görevin, kullanıcıların yazdığı özellik isteklerini analiz etmek.
Verilen metni oku ve aşağıdaki JSON formatında kesinlikle geçerli bir yanıt döndür.
JSON dışında hiçbir açıklama, markdown veya ek metin yazma.

{
  "sentiment": "pozitif" | "notr" | "negatif",
  "keywords": ["kelime1", "kelime2", "kelime3"],
  "summary": "Bu isteğin ne olduğunu 20 kelimeden kısa özetleyen cümle"
}

> Sentiment değeri kesinlikle `"pozitif"`, `"notr"` veya `"negatif"` olmalıdır; `"nötr"` veya başka bir yazım kabul edilmez. Keywords, `ai_keywords` sütununa kaydedilecek.
```

**User Prompt (Girdi):**

```text
Kullanıcının isteği:
Başlık: {{post.title}}
Açıklama: {{post.description}}
```

---

## 2. OpenRouter - Duplicate (Kopya) Kontrol Özeti

**Kullanım Yeri:** Embedding karşılaştırmasıyla Cosine similarity **> 0.85** bulunan aday eşleşmeler için çalışır. LLM `DUPLICATE` dönerse yeni postun `duplicate_of` alanına orijinal postun ID'si yazılır ve `duplicate_note` alanına açıklama eklenir.  
**Model Önerisi:** `meta-llama/llama-3.1-70b-instruct`

**System Prompt:**

```text
Görevin, iki farklı özellik isteğini karşılaştırmak. Eğer konuları %90'dan fazla aynıysa "DUPLICATE", eğer alakalı ama farklılarsa "RELATED" döndür.
Sadece şu JSON'u dön: { "relation": "DUPLICATE" | "RELATED" | "UNRELATED" }
```

**User Prompt:**

```text
Mevcut İstek: {{existing_post.title}} - {{existing_post.description}}
Yeni İstek: {{new_post.title}} - {{new_post.description}}
```

---

## 3. OpenAI - Embedding (Vektör) Ayarları

**Kullanım Yeri:** Yeni post oluştuğunda metni vektöre çevirmek için.  
**API:** OpenAI API (`/v1/embeddings`)  
**Model Önerisi:** `text-embedding-ada-002` (1536 boyut)

> **Not:** Boyut (dimension) değerini veritabanındaki `embedding_vector` sütununun tipiyle eşleştirin (`vector(1536)`). LLM çağrıları OpenRouter üzerinden yapılırken embedding'ler doğrudan OpenAI API ile alınır.

---

## 4. Inngest Event Şemaları

### 4.1. Event: `post/created`

**Ne Zaman:** Kullanıcı portal üzerinden yeni bir fikir gönderdiğinde (API `POST /posts`).  
**Amacı:** AI analizini (OpenRouter LLM + OpenAI Embedding + Dedup) başlatmak.

**Payload:**

```typescript
{
  name: "post/created",
  data: {
    postId: string; // UUID
    title: string;
    description: string;
    userId: string; // Clerk ID
  }
}
```

### 4.2. Event: `post/status.changed`

**Ne Zaman:** Admin panelde bir fikrin durumu değiştirildiğinde (API `PATCH /admin/posts`).  
**Amacı:** Eğer yeni durum `shipped` ise isteği açan ve oy veren herkese e-posta atmak.

**Payload:**

```typescript
{
  name: "post/status.changed",
  data: {
    postId: string;
    oldStatus: "open" | "planned" | "in-progress" | "shipped";
    newStatus: "open" | "planned" | "in-progress" | "shipped";
  }
}
```

---

## 5. AI Asistanına Özel Notlar (Context)

Bu proje **Solo Vibecoder** tarafından yapılıyor. Kod kalitesi ve hız çok önemli.

- **Tek Bir Doğru Yanıt:** Bir sorunun çözümü için 3 farklı yol önerme. En pragmatik, en az dosya değişikliği gerektiren yolu direkt kodla göster.
- **Shadcn/ui Kullanımı:** Özel CSS yazmak yerine her zaman Shadcn'in mevcut komponentlerini (`Card`, `Button`, `Dialog`, `DropdownMenu`) kullan.
- **Hata Yönetimi:** `try-catch` eklemeyi asla unutma. `console.error` yanında mutlaka kullanıcıya dönülecek mesajı da yaz.
- **Dosya Değişiklikleri:** Bir özellik eklerken eğer 3'ten fazla dosyayı aynı anda değiştirmen gerekiyorsa, dur ve bana "Bu işlem çok büyük, izin verir misin?" diye sor.
- **Migration'lar:** Veritabanı şemasında değişiklik varsa, migration dosyasını (`drizzle-kit generate`) oluşturmayı unutma.
- **OpenRouter Kullanımı (LLM):** Tüm LLM çağrılarında `OPENROUTER_API_KEY` kullan. Model isimlerini OpenRouter'ın tam model ID'si ile gir (örn: `meta-llama/llama-3.1-70b-instruct`).
- **OpenAI Kullanımı (Embedding):** Embedding çağrılarında `OPENAI_API_KEY` kullan (model: `text-embedding-ada-002`). OpenRouter embedding endpoint'i sunmadığı için embedding'ler doğrudan OpenAI `/v1/embeddings` üzerinden alınır.
