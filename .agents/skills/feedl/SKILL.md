---
name: feedl
description: feedl (feedl.co) MVP development guide - AI feedback platform (Canny clone) on Next.js 15 + Clerk + Neon/Drizzle + Inngest + OpenRouter (LLM + embeddings). Use when continuing development in this repo it locates the source-of-truth docs in docs/ defines the sprint workflow and conventions and lists hard-won pitfalls (OpenRouter free-model quirks pgvector 2000-dim index cap shadcn form removal svix typing Clerk React pin).
---

# feedl - Project Development Guide

feedl (domain: feedl.co, planned) is an AI-supported customer feedback platform -
a Canny clone MVP built solo. This skill encodes everything learned so far so
future sessions do not repeat mistakes.

Git: `github.com/kogu1988/feedl` (main) - commit + push after each validated sprint.

## Source of truth (read before acting)

- `docs/plan.md` - sprint log; find the current sprint here first
- `docs/standarts.md` - mandatory security/optimization/coding rules
- `docs/prompts.md` - AI prompt templates and Inngest event schemas
- `docs/README.md` - stack table, env vars, DB schema, folder map

Do not duplicate these docs in code comments; point to them.

## Stack (pinned - do not bump majors without asking)

- Next.js 15 App Router (scaffolded with `create-next-app@15`)
- React + react-dom 19.2.8 (pinned EXACTLY, identical versions - see pitfalls)
- Tailwind v4 + shadcn/ui (`components.json` at root)
- Clerk (`@clerk/nextjs` v7 + `@clerk/ui` shadcn theme) + `svix` for webhook
  verification; Clerk CLI 3.2.0 (global); app "feedl" =
  `app_3Ih0Ue3SHQLk5HOOFnWEM7LD6Ze` (dev instance `ins_3Ih0UbHGeYBU0L04QhDtPo94eh0`)
- Drizzle ORM + `@neondatabase/serverless` (neon-http driver) + `drizzle-kit`
- Inngest for background jobs; OpenRouter for BOTH LLM (`minimax/minimax-m3:free`)
  and embeddings (`nvidia/nemotron-3-embed-1b:free`, 2048 dims) - single API key
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
- Zod-validate all LLM outputs; extract substring from first `{` to last `}`
  before parsing (free models wrap JSON in code fences); normalize `nötr` →
  `notr`; parse failure = retry via Inngest
- Secrets only in `.env.local` (gitignored); never log emails/tokens/passwords
- Webhook handlers: verify svix signature first; on `user.updated` never overwrite `role`

## Known pitfalls (learned the hard way)

- **OpenRouter HAS embeddings now** (verified live 2026-09-01 via
  `POST /api/v1/embeddings`; earlier checks found none - feature is new).
  Free models: `nvidia/nemotron-3-embed-1b:free` (2048 dims, 33K ctx - chosen)
  and `liquid/lfm-2.5-embedding-350m:free` (1024 dims, 512 ctx - truncates
  long Turkish posts). pgvector HNSW caps at 2000 dims -> store `vector(2048)`
  WITHOUT index; sequential scan fine at MVP scale, `halfvec` HNSW later.
  Free-tier models may retain data for training.
- **Free LLM pick: `minimax/minimax-m3:free`** (tested live 2026-09-01: best
  Turkish quality, correct sentiment, extractable JSON). Rejected:
  `nvidia/nemotron-3.5-lightning:free` ignores JSON format (reasoning dump);
  `google/gemma-4-26b-a4b-it:free` returned 429 twice (upstream shared pool).
  Fallback if free proves flaky in prod: paid `google/gemini-2.5-flash`
  (one-line model switch).
- **shadcn `form` component was removed from the registry** (404). Build forms
  with react-hook-form + zod + `@hookform/resolvers` and compose
  `input`/`textarea`/`button` manually.
- **svix `Webhook.verify()` returns void** in current typings. Verify (it throws
  on invalid), then cast the parsed payload: `evt = payload as WebhookEvent`.
- **react/react-dom must be the EXACT same version.** Installing `@clerk/ui`
  bumped react to 19.2.8 while react-dom stayed 19.1.4; build failed with
  "Incompatible React versions". Fix: `npm i react@19.2.8 react-dom@19.2.8
  --save-exact` (both Clerk packages' peers allow `~19.2.3`).
- **Clerk v7 layout rules**: `ClerkProvider` goes INSIDE `<body>` (not wrapping
  `<html>`); matcher must include `"/__clerk/(.*)"` after the api/trpc matcher.
- **`clerk init` hangs at "Scanning for issues..." on Windows** (CLI 3.2.0, pty).
  Run `clerk init --app <id> -y --no-skills`, let the timeout kill it, then
  verify results: it SKIPs existing middleware/layout/sign-in files and appends
  env URL vars, but does NOT write keys over empty placeholders - pull keys
  with `clerk env pull --app <id> --file .env.local`.
- **`clerk listen` is gone in CLI 3.x**: use
  `clerk webhooks listen --token c_zC347Uji8e --forward-to http://localhost:3000/api/webhooks/clerk`.
  The relay URL is NOT auto-registered: add it as an endpoint in the Clerk
  Dashboard (webhooks page; events user.created/updated/deleted) and copy the
  endpoint's Signing Secret into `CLERK_WEBHOOK_SIGNING_SECRET` (done once;
  relay is pinned via --token so the URL stays stable across restarts).
- **@neondatabase/serverless v1: `neon(url)` returns a tagged-template-only
  function.** `sql('SELECT ...')` throws; use `sql.query('SELECT ...', [])`
  for ad-hoc SQL (or go through Drizzle).
- **Background processes die with the tool's pty on Windows.** `nohup ... &`
  gets killed when the shell exits. Launch detached instead:
  `powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c','npm run dev > D:\\Projects\\feedl.co\\.dev.log 2>&1' -WorkingDirectory 'D:\\Projects\\feedl.co' -WindowStyle Hidden"`.
  Find/kill via Get-CimInstance CommandLine match + `taskkill //F //T //PID <pid>`.
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
5. External services: Neon via `npx neonctl`; Clerk app exists ("feedl",
   `app_3Ih0Ue3SHQLk5HOOFnWEM7LD6Ze`, CLI linked, authed as oguzkir@gmail.com);
   forward webhooks with `clerk webhooks listen` (see pitfalls); Vercel at the
   deploy sprint.
6. **NEVER name anything** (Neon project, Vercel project, Clerk app, database,
   skill, etc.) without asking the user first - the user explicitly requires
    being consulted on every name.
