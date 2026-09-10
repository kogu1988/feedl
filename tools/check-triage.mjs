// Faz 3 doğrulama — ai_triage_signals şeması + mevcut sinyaller.
// .env.local'i kendisi okur; hiçbir secret stdout'a basılmaz.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const sql = neon(env.DATABASE_URL);

const cols = await sql`
  select column_name, data_type, is_nullable
  from information_schema.columns
  where table_name = 'posts' and column_name in ('triage_label','source','pin_x','screenshot_url','device_type')
  order by column_name`;
console.log("posts columns:", cols);

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_name = 'ai_triage_signals'`;
console.log("ai_triage_signals table:", tables);

const signals = await sql`
  select kind, count(*)::int as n from ai_triage_signals group by kind order by kind`;
console.log("signals by kind:", signals);

const visual = await sql`
  select count(*)::int as n from posts where source = 'visual_feedback'`;
console.log("visual_feedback posts:", visual);
