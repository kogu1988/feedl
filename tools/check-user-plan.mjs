// oguzkir@gmail.com kullanıcısının plan/abonelik durumunu okur (secret basmaz).
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

const users = await sql`
  select id, email, role, email_digest, created_at
  from users where lower(email) = 'oguzkir@gmail.com'`;
console.log("users:", users);

const ws = await sql`
  select id, name, slug, plan, paddle_customer_id, paddle_subscription_id,
         paddle_subscription_status, digest_last_sent_at
  from workspaces order by created_at`;
console.log("workspaces:", ws);

const subs = await sql`
  select subscription_id, customer_id, workspace_id, status, price_id, product_id, updated_at
  from subscriptions order by updated_at desc limit 5`;
console.log("subscriptions:", subs);

const customers = await sql`
  select customer_id, email, workspace_id, updated_at
  from customers order by updated_at desc limit 5`;
console.log("customers:", customers);
