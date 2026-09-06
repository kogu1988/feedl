// Sprint 63x — Public API OpenAPI 3.0 şeması. Kod ile güncellenebilir tek
// kaynak: `/api/v1/openapi` route'u bu nesneyi JSON olarak sunar (bellekte,
// import). Dış istemciler (SDK üretimi, Postman/Insomnia import) bunu tüketir.
// Kimlik (Bearer), kapsamlar (read/write), hata envelope'ı ve idempotency
// başlığını belgeler.

// Başarı sarmalayıcı: { success: true, data }.
function successEnvelope(
  dataSchema: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { type: "boolean", enum: [true] },
      data: dataSchema,
    },
  };
}

const errorEnvelope = {
  type: "object",
  required: ["success", "error"],
  properties: {
    success: { type: "boolean", enum: [false] },
    error: {
      type: "string",
      description: "İnsan-okur Türkçe hata mesajı.",
    },
  },
};

const pageMeta = {
  type: "object",
  required: ["page", "limit", "total"],
  properties: {
    page: { type: "integer", description: "1 tabanlı sayfa numarası." },
    limit: { type: "integer", description: "Sayfa başına kayıt (max 100)." },
    total: { type: "integer", description: "Filtreye uyan toplam kayıt." },
  },
};

const postSchema = {
  type: "object",
  required: ["id", "title", "status", "voteCount", "commentCount", "tags"],
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    description: { type: "string" },
    status: {
      type: "string",
      enum: ["open", "under-review", "planned", "in-progress", "shipped", "closed"],
    },
    postType: {
      type: "string",
      enum: ["feature", "bug", "usability"],
      nullable: true,
    },
    sentimentLabel: { type: "string", nullable: true },
    aiKeywords: { type: "array", items: { type: "string" }, nullable: true },
    createdAt: { type: "string", format: "date-time" },
    voteCount: { type: "integer" },
    commentCount: { type: "integer" },
    tags: { type: "array", items: { type: "string" } },
  },
};

const commentSchema = {
  type: "object",
  required: ["id", "body", "authorName", "createdAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    body: { type: "string" },
    authorName: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const changelogEntrySchema = {
  type: "object",
  required: ["id", "title", "label", "publishedAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    body: { type: "string", nullable: true },
    label: { type: "string", nullable: true },
    imageUrl: { type: "string", nullable: true },
    publishedAt: { type: "string", format: "date-time", nullable: true },
  },
};

const idempotencyHeader = {
  name: "Idempotency-Key",
  in: "header",
  required: false,
  description:
    "Yazma isteklerinde (POST) benzersiz bir anahtar gönder — aynı anahtarla tekrarlanan istek ilk yanıtı döndürür (duplike kayıt oluşmaz). 24 saat saklanır.",
  schema: { type: "string", maxLength: 200 },
};

const bearerAuth = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "fk_live_...",
  description:
    "Public API anahtarı (Bearer). Okuma (GET) read kapsamı; yazma (POST/DELETE) write kapsamı ister.",
};

// Dış istemciler için sade, tam OpenAPI 3.0 dokümanı. Tip anotasyonu bilinçli
// olarak yumuşak (Record<string, unknown>) — openapi-types bağımlılığı ekleme.
export const apiDoc: Record<string, unknown> = {
  openapi: "3.0.0",
  info: {
    title: "feedl Public API",
    version: "1.0.0",
    description:
      "feedl'in public API yüzeyi — müşteri geri bildirimini (fikirler, oylar, yorumlar, duyurular) programatik okumak/yazmak için. Tüm uçlar Bearer API anahtarı gerektirir.",
  },
  servers: [{ url: "https://feedl.app/api/v1" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth },
    schemas: {
      Post: postSchema,
      Comment: commentSchema,
      ChangelogEntry: changelogEntrySchema,
      Error: errorEnvelope,
    },
  },
  paths: {
    "/posts": {
      get: {
        operationId: "listPosts",
        summary: "Fikirleri listele",
        description:
          "Workspace'in birleştirilmemiş herkese açık fikirlerini sayfalanmış döndürür. sort/status/tag ile filtrele.",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["recent", "top"], default: "recent" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["open", "under-review", "planned", "in-progress", "shipped", "closed"] } },
          { name: "tag", in: "query", schema: { type: "string", description: "Etiket adı (küçük harf)." } },
        ],
        responses: {
          "200": {
            description: "Fikir listesi",
            content: {
              "application/json": {
                schema: successEnvelope({
                  type: "object",
                  required: ["posts", ...pageMeta.required],
                  properties: {
                    posts: { type: "array", items: postSchema },
                    ...pageMeta.properties,
                  },
                }),
              },
            },
          },
          "401": { description: "Geçersiz API anahtarı", content: { "application/json": { schema: errorEnvelope } } },
          "429": { description: "Rate limit aşıldı", content: { "application/json": { schema: errorEnvelope } } },
        },
      },
      post: {
        operationId: "createPost",
        summary: "Yeni fikir oluştur",
        description:
          "Yeni bir fikir oluşturur ve AI autopilot'ı tetikler. author.email zorunlu. Idempotency-Key ile güvenli tekrar.",
        security: [{ bearerAuth: [] }],
        parameters: [idempotencyHeader],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "description", "author"],
                properties: {
                  title: { type: "string", minLength: 3, maxLength: 140 },
                  description: { type: "string", minLength: 10, maxLength: 2000 },
                  author: {
                    type: "object",
                    required: ["email"],
                    properties: {
                      email: { type: "string", format: "email" },
                      name: { type: "string", maxLength: 100 },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Oluşturuldu",
            content: {
              "application/json": {
                schema: successEnvelope({
                  type: "object",
                  required: ["id", "title"],
                  properties: { id: { type: "string", format: "uuid" }, title: { type: "string" } },
                }),
              },
            },
          },
          "400": { description: "Geçersiz gövde", content: { "application/json": { schema: errorEnvelope } } },
          "403": { description: "write kapsamı yok", content: { "application/json": { schema: errorEnvelope } } },
          "401": { description: "Geçersiz anahtar", content: { "application/json": { schema: errorEnvelope } } },
          "429": { description: "Rate limit", content: { "application/json": { schema: errorEnvelope } } },
        },
      },
    },
    "/posts/{id}": {
      get: {
        operationId: "getPost",
        summary: "Tek fikir + yorumları",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Fikir detayı + herkese açık yorumlar",
            content: {
              "application/json": {
                schema: successEnvelope({
                  type: "object",
                  required: ["post", "comments"],
                  properties: {
                    post: postSchema,
                    comments: { type: "array", items: commentSchema },
                  },
                }),
              },
            },
          },
          "404": { description: "Fikir bulunamadı", content: { "application/json": { schema: errorEnvelope } } },
          "401": { description: "Geçersiz anahtar", content: { "application/json": { schema: errorEnvelope } } },
        },
      },
    },
    "/posts/{id}/votes": {
      post: {
        operationId: "votePost",
        summary: "Fikre oy ver",
        description:
          "Yazar (user.email) ile oy işler; daha önce oy verdiyse yeniden oy oluşturmaz (doğal idempotent).",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["user"],
                properties: {
                  user: {
                    type: "object",
                    required: ["email"],
                    properties: {
                      email: { type: "string", format: "email" },
                      name: { type: "string", maxLength: 100 },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Oy kaydedildi",
            content: {
              "application/json": {
                schema: successEnvelope({
                  type: "object",
                  required: ["voted", "voteCount"],
                  properties: { voted: { type: "boolean", enum: [true] }, voteCount: { type: "integer" } },
                }),
              },
            },
          },
          "400": { description: "Birleşmiş fikir / geçersiz", content: { "application/json": { schema: errorEnvelope } } },
          "403": { description: "write kapsamı yok", content: { "application/json": { schema: errorEnvelope } } },
          "404": { description: "Fikir bulunamadı", content: { "application/json": { schema: errorEnvelope } } },
          "429": { description: "Rate limit", content: { "application/json": { schema: errorEnvelope } } },
        },
      },
      delete: {
        operationId: "deleteVote",
        summary: "Oyu geri al",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "email", in: "query", required: true, schema: { type: "string", format: "email" } },
        ],
        responses: {
          "200": {
            description: "Oy geri alındı",
            content: {
              "application/json": {
                schema: successEnvelope({
                  type: "object",
                  required: ["voted", "voteCount"],
                  properties: { voted: { type: "boolean", enum: [false] }, voteCount: { type: "integer" } },
                }),
              },
            },
          },
          "400": { description: "email eksik", content: { "application/json": { schema: errorEnvelope } } },
          "404": { description: "Fikir bulunamadı", content: { "application/json": { schema: errorEnvelope } } },
        },
      },
    },
    "/posts/{id}/comments": {
      post: {
        operationId: "createComment",
        summary: "Yorum yaz",
        description:
          "Herkese açık üst düzey yorum oluşturur. Idempotency-Key ile güvenli tekrar.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          idempotencyHeader,
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["user", "body"],
                properties: {
                  user: {
                    type: "object",
                    required: ["email"],
                    properties: {
                      email: { type: "string", format: "email" },
                      name: { type: "string", maxLength: 100 },
                    },
                  },
                  body: { type: "string", minLength: 1, maxLength: 2000 },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Yorum oluşturuldu",
            content: {
              "application/json": {
                schema: successEnvelope({
                  type: "object",
                  required: ["id", "createdAt"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                }),
              },
            },
          },
          "400": { description: "Geçersiz", content: { "application/json": { schema: errorEnvelope } } },
          "404": { description: "Fikir bulunamadı", content: { "application/json": { schema: errorEnvelope } } },
          "429": { description: "Rate limit", content: { "application/json": { schema: errorEnvelope } } },
        },
      },
    },
    "/feedbacks": {
      post: {
        operationId: "createFeedback",
        summary: "Geri bildirim akıt (connector)",
        description:
          "Dış sistemden (Intercom/Slack/uygulaman) serbest mesajı geri bildirime çevirir; AI autopilot sınıflandırır. Idempotency-Key ile güvenli tekrar.",
        security: [{ bearerAuth: [] }],
        parameters: [idempotencyHeader],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["source", "author", "message"],
                properties: {
                  source: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,40}$", description: "Kaynak etiketi (örn. intercom)." },
                  author: {
                    type: "object",
                    required: ["email"],
                    properties: {
                      email: { type: "string", format: "email" },
                      name: { type: "string", maxLength: 100 },
                    },
                  },
                  message: { type: "string", minLength: 10, maxLength: 4000 },
                  title: { type: "string", minLength: 3, maxLength: 140, description: "Opsiyonel — verilmezse mesajın ilk satırı." },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Oluşturuldu",
            content: {
              "application/json": {
                schema: successEnvelope({
                  type: "object",
                  required: ["id", "title"],
                  properties: { id: { type: "string", format: "uuid" }, title: { type: "string" } },
                }),
              },
            },
          },
          "400": { description: "Geçersiz gövde", content: { "application/json": { schema: errorEnvelope } } },
          "403": { description: "write kapsamı yok", content: { "application/json": { schema: errorEnvelope } } },
          "429": { description: "Rate limit", content: { "application/json": { schema: errorEnvelope } } },
        },
      },
    },
    "/changelog": {
      get: {
        operationId: "listChangelog",
        summary: "Yayınlanmış duyuruları listele",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
        ],
        responses: {
          "200": {
            description: "Duyuru listesi",
            content: {
              "application/json": {
                schema: successEnvelope({
                  type: "object",
                  required: ["entries", ...pageMeta.required],
                  properties: {
                    entries: { type: "array", items: changelogEntrySchema },
                    ...pageMeta.properties,
                  },
                }),
              },
            },
          },
          "401": { description: "Geçersiz anahtar", content: { "application/json": { schema: errorEnvelope } } },
          "429": { description: "Rate limit", content: { "application/json": { schema: errorEnvelope } } },
        },
      },
    },
  },
};
