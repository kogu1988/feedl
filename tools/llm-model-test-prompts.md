# LLM model seçimi — test istemleri

`minimax/minimax-m3:free` OpenRouter'dan kaldırıldığı için (2026-09-11) üretimde
tüm AI fonksiyonları öldü (ai-autopilot 9/9 failed, corpus-insights 1/1 failed).
Bu dosya, yeni modeli **kanıta dayalı** seçmek için kullanılan istemleri ve
ölçülen sonuçları tutar.

Hızlı sağlık kontrolü (aynı istemi gerçek çağrıyla dener):

```bash
node tools/probe-llm-models.mjs                 # varsayılan 6 aday
node tools/probe-llm-models.mjs <model-id> ...  # belirli modeller
PROBE_MAX_TOKENS=300 node tools/probe-llm-models.mjs ...
```

---

## İstem A — sınıflandırma (kısa, ai-autopilot'un gerçek görevi)

**System**

```
Sen bir ürün geri bildirimi sınıflandırıcısısın. YALNIZCA geçerli JSON döndür;
açıklama, markdown çiti veya ek metin yazma.
```

**User**

```
Geri bildirim: "Mobilde checkout butonu ekranın dışına taşıyor, sipariş veremiyorum."
Şu şemayla JSON döndür: {"type":"bug|feature|support|clarify|unrecognized","sentiment":"positive|neutral|negative","summary":"<tek cümle, Türkçe>","keywords":["<2-4 kısa anahtar>"]}
```

Beklenen: `type=bug`, `sentiment=negative`, tek cümle Türkçe özet, 2-4 anahtar.

---

## İstem B — korpus içgörüleri (İÇ İÇE şema, asıl kırılma noktası)

Bilinen sorun: ücretsiz modeller iç içe nesne şemasını takip etmiyor
(`themes` alanına `[{name,count,summary}]` yerine `["A","B"]` döndürüyor) →
Zod doğrulaması patlıyor → Inngest run failed (geçmişte 32 failed run).

**System**

```
Sen bir ürün analistisin. YALNIZCA geçerli JSON döndür; açıklama veya markdown yazma.
```

**User**

```
Aşağıdaki geri bildirimleri analiz et ve YALNIZCA şu şemada JSON döndür:
{
  "themes": [{"name":"<kısa tema>","count":<tam sayı>,"summary":"<tek cümle>"}],
  "trends": [{"name":"<kısa ad>","direction":"up|down|flat","note":"<tek cümle>"}],
  "quickWins": ["<kısa, uygulanabilir madde>"],
  "risks": ["<kısa risk maddesi>"],
  "recommendation": "<tek paragraf>"
}

Geri bildirimler:
1. Mobilde checkout butonu ekran dışına taşıyor, sipariş veremiyorum.
2. Karanlık mod desteği gelse harika olur.
3. PDF dışa aktarma çok yavaş, 30 saniye sürüyor.
4. Fiyatlandırma sayfasında yıllık indirim görünmüyor.
5. Takım arkadaşımı davet ettim ama davet e-postası gelmedi.
6. Bildirimler çok sık geliyor, kapatamıyorum.
7. Arama Türkçe karakterlerde sonuç bulamıyor (ör. "işlem").
8. Mobil uygulamada giriş yapamıyorum, sürekli çıkış yapıyor.
9. API anahtarı oluşturma akışı çok karışık.
10. Raporları Excel'e aktarma özelliği çok işimize yarıyor, teşekkürler.
```

Kabul kriteri: `themes` **nesne dizisi** olmalı (`name`/`count`/`summary`),
`count` tam sayı, `trends[].direction` yalnız `up|down|flat`.
`themes: ["..."]` gibi düz string dizisi → **RED**.

---

## Ölçülen sonuçlar (2026-09-11, İstem A, max_tokens 256-300)

| Model | Durum | Gecikme | Kullanım (in/out) | Maliyet/çağrı | JSON | Şema |
|---|---|---|---|---|---|---|
| `mistralai/mistral-nemo` | ✅ | 11.4s | 137/72 | $0.000005 | ✓ | ✓ |
| `meta-llama/llama-3.1-8b-instruct` | ✅ | 2.7s | 138/44 | $0.000010 | ✓ | ✓ |
| `mistralai/mistral-small-24b-instruct-2501` | ✅ | **1.6s** | 137/63 | $0.000012 | ✓ | ✓ |
| `amazon/nova-micro-v1` | ✅ | **0.8s** | 149/67 | $0.000015 | ✓ | ✓ |
| `openai/gpt-oss-20b` | ✅ | 2.2s | 194/207 | $0.000033 | ✓ | ✓ |
| `inclusionai/ling-3.0-flash` | ❌ | — | — | — | HTTP 429 (upstream) | — |
| `ibm-granite/granite-4.0-h-micro` | ⚠ | 1.7s | 156/53 | $0.000009 | ✗ (`}}`) | ✗ |
| `qwen/qwen3.7-flash` | ⚠ | 3.5s | 139/300 | $0.000043 | ✗ (boş) | ✗ |
| `nex-agi/nex-n2.5-pro:free` | ✅ | 1.8s | 138/93 | $0 | ✓ | ✓ |
| `nex-agi/nex-n2.5-mini:free` | ✅ | 1.4s | 138/128 | $0 | ✓ | ✓ |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | ✅ | 16.8s | 148/121 | $0 | ✓ | ✓ |
| `nvidia/nemotron-3-super-120b-a12b:free` | ⚠ | 5.2s | 148/200 | $0 | ✗ (kesildi) | ✗ |
| `nvidia/nemotron-3.5-lightning:free` | ⚠ | 7.7s | 148/300 | $0 | ✗ (düşünce sızdı) | ✗ |
| `dots-studio/dots-3-note-preview:free` | ⚠ | 3.2s | 135/300 | $0 | ✗ (boş) | ✗ |
| `google/gemma-4-31b-it:free` | ❌ | — | — | — | HTTP 429 (upstream) | — |

Notlar:
- Ücretsiz modeller **upstream 429** verebiliyor (OpenRouter free-tier ortak
  havuzu) ve reasoning modelleri token bütçesini yiyip çıktıyı kesebiliyor.
- Hacim düşük olduğu için ücretli modeller pratikte bedava: 1.000
  sınıflandırma ≈ **$0.01** (llama-3.1-8b ile).
- `LLM_FALLBACK_MODEL` tanımlı olmadığı için model emekliye ayrılınca üretim
  sessizce öldü. Fallback zinciri + `/widget` gibi bir sağlık kontrolü şart.
