---
name: feedl
description: feedl (feedl.co) MVP development guide - AI feedback platform (Canny clone) on Next.js 15 + Clerk + Neon/Drizzle + Inngest + OpenRouter/OpenAI. Use when continuing development in this repo it locates the source-of-truth docs in docs/ defines the sprint workflow and conventions and lists hard-won pitfalls (OpenRouter has no embeddings endpoint shadcn form removal svix typing Clerk React pin).
---

# feedl - Project Development Guide

feedl (domain: feedl.co, planned) is an AI-supported customer feedback platform -
a Canny clone MVP built solo. This skill encodes everything learned so far so
future sessions do not repeat mistakes.

## Source of truth (read before acting)

- `docs/plan.md` - sprint log; find the current sprint here first
- `docs/standarts.md` - mandatory security/optimization/coding rules
- `docs/prompts.md` - AI prompt templates and Inngest event schemas
- `docs/README.md` - stack table, env vars, DB schema, folder map

Do not duplicate these docs in code comments; point to them.

## Stack (pinned - do not bump majors without asking)

- Next.js 15 App Router (scaffolded with `create-next-app@15`)
- React 19.1.4 (pinned by @clerk/nextjs peer deps - see pitfalls)
- Tailwind v4 + shadcn/ui (`components.json` at root)
- Clerk (`@clerk/nextjs`) + `svix` for webhook verification
- Drizzle ORM + `@neondatabase/serverless` (neon-http driver) + `drizzle-kit`
- Inngest for background jobs; OpenRouter for LLM; OpenAI for embeddings
- Email: Resend (production) / Ethereal.email (dev/test)

## Repo layout

```
app/api/{posts,votes,admin/export,webhooks,inngest}   API routes
app/{dashboard,portal,sign-in/[[...sign-in]],sign-up/[[...sign-up]]}
lib/{db,ai,email}                                     db schema+client, AI helpers, email templates
components/{ui,custom}                                shadcn ui + project components
inngest/                                              Inngest function definitions
migrations/                                           drizzle-kit output
docs/                                                 planning docs (source of truth)
```

## Conventions (enforced by docs/standarts.md)

- Standard API envelope: `{ "success": true, "data": ... }` / `{ "success": false, "error": "..." }`
- try/catch every async handler; return user-friendly errors, never leak stack traces or DB details
- Strict TypeScript, no `any`; Drizzle only, no raw SQL string building
- `middleware.ts` gates AUTHENTICATION only; authorization (admin) reads Neon
  `users.role` in pages/API routes - DB is the single source of role
- DB client: lazy `getDb()` from `lib/db/index.ts` - never instantiate at module
  top level (keeps `next build` working without DATABASE_URL)
- Public routes in middleware: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/portal(.*)`,
  `/api/posts(.*)` (GET public, POST checks auth in handler), `/api/webhooks(.*)`
- Zod-validate all LLM outputs; normalize `nötr` → `notr`; parse failure = retry via Inngest
- Secrets only in `.env.local` (gitignored); never log emails/tokens/passwords
- Webhook handlers: verify svix signature first; on `user.updated` never overwrite `role`

## Known pitfalls (learned the hard way)

- **OpenRouter has NO embeddings endpoint** (verified against their API docs -
  only `/api/v1/chat/completions`). Call OpenAI `/v1/embeddings` directly with
  `OPENAI_API_KEY` (model: `text-embedding-ada-002`, 1536 dims).
- **shadcn `form` component was removed from the registry** (404). Build forms
  with react-hook-form + zod + `@hookform/resolvers` and compose
  `input`/`textarea`/`button` manually.
- **svix `Webhook.verify()` returns void** in current typings. Verify (it throws
  on invalid), then cast the parsed payload: `evt = payload as WebhookEvent`.
- **@clerk/nextjs requires react `~19.1.4`** - react 19.1.0 fails ERESOLVE.
  Fix: `npm i react@19.1.4 react-dom@19.1.4`.
- **create-next-app refuses non-empty directories**; `docs/` is whitelisted, so
  planning docs can live there during scaffolding.
- **drizzle-kit does NOT auto-load `.env.local`** (unlike Next.js). `drizzle.config.ts`
  loads it explicitly via `process.loadEnvFile(".env.local")` (Node 20.12+). Do not
  remove that block or `drizzle-kit migrate/push` fails with `url: ''`.
- **neonctl is org-aware**: `projects create --name X` hangs on an interactive
  org-selection prompt in a pty. Pass `--org-id` explicitly (current org:
  `org-jolly-meadow-44804591`). Neon project: **feedl** (`bold-flower-95043158`,
  aws-us-west-2).
- Webhook path is plural: `/api/webhooks/clerk`. Inngest serve endpoint:
  `/api/inngest`.
- Node v20.13.1 produces EBADENGINE warnings (some tools want >=20.18.1);
  harmless so far, but worth knowing.
- Validation command is `npm run build`. Do NOT start `npm run dev` in-session
  (long-running server).

## Sprint workflow

1. Read `docs/plan.md`, find the next incomplete sprint and its Hedef/Yapılacaklar.
2. Implement it. If reality diverges from the docs (registry changes, API shifts),
   update the docs in the same change.
3. Validate with `npm run build` (types + lint).
4. Report the sprint's **Kontrol** checklist to the user for manual verification.
5. External services: Neon via `npx neonctl`, Clerk app created manually in the
   Clerk dashboard (use `clerk listen` to forward webhooks to localhost),
   Vercel at the deploy sprint.
6. **NEVER name anything** (Neon project, Vercel project, Clerk app, database,
   skill, etc.) without asking the user first - the user explicitly requires
    being consulted on every name.
