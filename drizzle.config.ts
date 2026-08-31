import { defineConfig } from "drizzle-kit";

// Next.js .env.local'ı otomatik yükler ama drizzle-kit yüklemez; burada yüklüyoruz.
// Dosya yoksa sessiz geçilir — migrate/push bu durumda DATABASE_URL hatası verir.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no-op
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
