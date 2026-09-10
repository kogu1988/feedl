// Rol ayrımı öncesi envanter: kim hangi role/üyeliğe sahip?
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
console.log("TUM users:", await sql`select id, email, role, created_at from users order by created_at`);
console.log("TUM uyelikler:", await sql`
  select wm.user_id, u.email, u.role as user_role, wm.role as member_role, w.name
  from workspace_members wm
  join users u on u.id = wm.user_id
  join workspaces w on w.id = wm.workspace_id
  order by wm.created_at`);
console.log("workspace sayisi:", await sql`select count(*)::int n from workspaces`);
