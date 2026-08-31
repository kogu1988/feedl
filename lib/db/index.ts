import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Database = ReturnType<typeof createDb>;

let instance: Database | null = null;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local");
  }
  return drizzle(neon(url), { schema });
}

/**
 * Lazy singleton: modül import'u sırasında değil, ilk kullanımda bağlanır.
 * Böylece DATABASE_URL olmasa bile `next build` kırılmaz.
 */
export function getDb() {
  if (!instance) {
    instance = createDb();
  }
  return instance;
}
