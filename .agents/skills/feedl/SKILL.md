---
name: feedl
description: feedl (feedl.co) development guide - AI feedback platform (Canny clone) on Next.js 15 + Clerk + Neon/Drizzle + Inngest + OpenRouter (LLM + embeddings), LIVE at getfeedl.vercel.app. Use when continuing development in this repo it locates the source-of-truth docs in docs/ defines the sprint workflow and conventions and lists hard-won pitfalls (OpenRouter free-model quirks pgvector 2000-dim cap Clerk v7 split exports neon-http CTE pattern widget iframe/JWT origin rules Windows file-tool quirks).
---

# feedl - Project Development Guide

feedl (domain feedl.co is PLANNED, not bought - do not wire domains) is an
AI-supported customer feedback platform - a Canny clone MVP built solo. It is
LIVE at https://getfeedl.vercel.app (Vercel, project "feedl", team
ogukis-vercel-projects); pushing to main deploys to production. This skill
encodes everything learned so far so future sessions do not repeat mistakes.

Git: `github.com/kogu1988/feedl` (main) - commit + push after each validated sprint.

## Source of truth (read before acting)

- `docs/plan.md` - sprint log; find the current sprint here first
- `docs/standarts.md` - mandatory security/optimization/coding rules
- `docs/prompts.md` - AI prompt templates and Inngest event schemas
- `docs/README.md` - stack table, env vars, DB schema, folder map

Design/feature references (consult when the task touches them):

- `DESIGN.md` (repo root) - Base UI (`@base-ui/react`) documentation; the
  design reference for UI/component work going forward (plan.md §Referans)
- `docs/deepseek.txt`, `docs/oxalpha.txt` - Canny platform research gathered
  from AI models (features, statuses/roadmap/changelog, monetization, data
  model, critical UX details); check before planning new features/UX
- `docs/Feedl–Canny Fonksiyonel Parite Analizi.md` - P0-P5 prioritized parity
  roadmap (source of Sprint 20-34 in plan.md's Faz 3 section); check the
  relevant P-item + acceptance criteria (§6) before adding features. Its
  "current state" rows predate Sprint 10+ - verify against plan.md's
  "Analiz doğrulaması" section

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
- Widget SDK (Sprint 32): zero-dependency HS256 JWT via node:crypto in
  `lib/widget/jwt.ts` - jose was NOT installed on purpose

## Repo layout

```
app/layout.tsx                                        Root layout: BARE (html/body
                                                      only, NO ClerkProvider)
app/(main)/layout.tsx                                 ClerkProvider + top bar live HERE
app/(main)/{page,dashboard,dashboard/widget,roadmap,  App pages: admin dashboard,
  sign-in/[[...sign-in]],sign-up/[[...sign-up]]}      widget setup, roadmap, auth
app/(main)/portal{,/[id],/oyladiklarim,/changelog}    Public portal (detail;
                                                      oyladiklarim: static, shadows [id])
app/widget/page.tsx                                   Iframe embed page (bare shell)
app/not-found.tsx + app/(main)/{not-found,error}.tsx  404/500 share not-found-view
app/api/{posts,posts/[id]/comments,comments/[commentId],votes}
                                                      Core CRUD APIs
app/api/admin/{posts,posts/bulk,merge,views,export,changelog,widget-token}
                                                      Admin APIs
app/api/{webhooks/clerk,inngest,unsubscribe}          svix + Inngest serve + opt-out
app/api/widget/{session,posts,votes}                  Widget SDK endpoints
lib/{db,ai,email,widget}                              db schema+client, AI, email, widget JWT/http
lib/{post-format,post-search,validations}.ts          status labels+dates, Turkish search, zod schemas
components/{ui,custom}                                shadcn ui + project components
inngest/                                              Inngest function definitions
migrations/                                           drizzle-kit output
public/widget.js                                      Embeddable <script> launcher
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
  `/roadmap(.*)`, `/widget`, `/api/posts(.*)` (GET public, POST checks auth in
  handler), `/api/widget(.*)`, `/api/webhooks(.*)`
- **Dual layout (Sprint 32)**: root `app/layout.tsx` is BARE; `ClerkProvider`
  + top bar live in `app/(main)/layout.tsx`. Pages that must render without a
  Clerk session (widget iframe) sit OUTSIDE `(main)`. New normal pages go
  under `app/(main)/`
- **Comments / internal notes** (Sprint 10): `comments.is_internal=true`
  olanlar HER okuma yolunda server-side filtrelenir (sayfa sorgusu + API);
  flag yalnızca admin oturumunda set edilir, istemciden gelen bayrağa
  asıl güvenilmez. Admin durum değişince otomatik iç not düşer
  (PATCH /api/admin/posts, best-effort).
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
- **Clerk v7 exports are split by runtime.** `auth()` and other server
  helpers ONLY from `@clerk/nextjs/server`; UI components (`SignInButton`,
  `SignUpButton`, `Show`, `UserButton`) ONLY from `@clerk/nextjs`. Mixing
  both in one import fails the Turbopack build with "Export X doesn't
  exist in target module" (verified 2026-09-01).
- **Never call `redirect()` inside try/catch.** It throws NEXT_REDIRECT;
  your own catch swallows it and redirects to the fallback (admin "/" →
  portal bug, fixed 2026-09-01). Compute the target inside try, call
  `redirect()` after the block.
- **Clerk user IDs are NOT UUIDs** (format `user_...`). Never validate
  text columns holding Clerk IDs with `z.uuid()` — the request 400s
  even though the DB FK accepts it (Sprint 28: ownerId PATCH returned
  "Geçersiz fikir kimliği veya durum."). Use `z.string().min(1)` and,
  when the field is a FK, verify the referenced user exists in the DB.
- **Search lives in `lib/post-search.ts`** (Turkish-aware, used by
  /api/posts GET + portal): multi-token AND, diacritic folding via SQL
  `translate+lower` mirrored in JS `foldTr`, relevance score (title 2 /
  description 1). SQL and JS fold mappings MUST stay in sync
  (TR_FOLD_SOURCE/TARGET ↔ TR_FOLD_MAP). Since Sprint 27 it is HYBRID:
  fold-ILIKE OR full-text (`posts.search_vector` generated tsvector
  'turkish' config + GIN) OR trigram (`word_similarity > 0.55` for 4+
  char tokens only - shorter tokens over-match) OR vector (top-5
  nearest by distance + 0.10 floor, ABSOLUTE thresholds fail - this
  embedding model's meaningful pairs sit at 0.10-0.25 cosine). Vector
  stage is FALLBACK-ONLY: portal searches without embedding first and
  embeds the query only when zero rows - keeps OpenRouter usage near
  zero. pg_trgm extension + trigram index are NOT in drizzle migrations
  (apply manually on new environments).
- **Dual leftJoin aggregates (votes + comments) MUST use `countDistinct`,
  not `count`** — join fan-out multiplies rows and silently inflates
  every count on the page (found while adding comment counts, Sprint
  13). Public comment counts exclude internal notes via
  `is_internal = false` in the JOIN condition itself;
  `CommentCountBadge` is the single visual source (renders nothing at
  0, links to `/portal/[id]#yorumlar`).
- **"Benzer fikirler" (Sprint 17)**: cosine similarity runs IN Postgres
  via scalar subquery (`1 - (embedding <=> (select ...))`) — never ship
  the 2048-dim vector through JS. Display threshold 0.5 (duplicate
  calibration: generic ≤ 0.489, near-dup ≥ 0.547, see
  inngest/functions.ts). Two-query load: similarity ids (no joins),
  then hydrate with countDistinct. Best-effort: failure hides the
  section. Embedding-less posts get no section.
- **Inngest has 4 functions** since Sprint 24: `ai-autopilot`,
  `notify-shipped` (Sprint 26: handles ALL status changes — shipped =
  celebration mail, others = "fikir güncellendi" info mail; recipients
  come from `post_followers`, not votes; respects
  `users.email_status_updates`; records `email_deliveries`
  (user+type+entity unique) for idempotency — re-shipping a post does
  NOT re-mail), `notify-admin-post-created` (emails
  `users.role=admin` on post/created; the author's own email is
  excluded), `notify-comment-created` (post/comment.created; emails
  followers, commenter excluded, internal notes skipped, respects
  `users.email_comments`). Unsubscribe: token per user
  (`users.unsubscribe_token`) + `/api/unsubscribe?token&type=status|comment`
  closes the pref and returns branded HTML; email templates take
  per-recipient `unsubscribeUrl` (render once per recipient, then one
  sendEmails call). Email templates share `escapeHtml` from
  `lib/email/html.ts`; branded boundaries: `app/not-found.tsx` (404) +
  `app/error.tsx` (500, client, reset()).
- **Widget SDK rules (Sprint 32)**: widget JWT (HS256, short-lived,
  node:crypto in `lib/widget/jwt.ts`) rides an httpOnly cookie; inside an
  iframe it is a third-party context, so the cookie needs SameSite=None and
  Safari ITP can still block it (warning shown on /dashboard/widget). The
  origin allowlist (`FEEDL_WIDGET_ALLOWED_ORIGINS`) is enforced per request
  in `lib/widget/http.ts` `requestOrigin()` - handlers using it MUST be typed
  `NextRequest` (plain `Request` fails the build); GET-only handlers may stay
  `Request`. Widget session POST = signed JWT in, cookie + CORS out; anonim
  widget API calls get 401. `posts.widgetOrigin` (migration 0015) records the
  embed origin per post (also a CSV export column).
- **Vercel env changes need a REDEPLOY** (adding FEEDL_WIDGET_SECRET to an
  already-deployed project changed nothing until `vercel --prod` re-ran).
  Create secrets with `vercel env add <KEY> production` and paste the value -
  NEVER echo secret values into chat (widget secret, API keys...).
- **File tools choke on parenthesized route groups**: `move_path` /
  `create_directory` reject `app/(main)/...` as "outside the project". Use
  terminal `mkdir` + `git mv`; if directory-level `git mv` hits "Permission
  denied" (tsserver holds locks), move FILE BY FILE. `write_file` cannot
  create missing directories - `mkdir` first.
- **Widget debugging (Sprint 32 E2E)**: `vercel logs <deployment-url> --json`
  shows the real error behind API 500s (fetching via the alias URL can hang).
  A widget 500 "Fikir kaydedilemedi" was a DOUBLE prefix: the session cookie
  `sub` is already `widget_`-prefixed, so `verifySessionPayload` must NOT call
  `toWidgetUserId` again (fixed in 04d6b02). Widget vote DELETE takes postId
  as a QUERY param (`/api/widget/votes?postId=...`), not a body.
- **Schema change checklist (hard rule)**: after editing
  lib/db/schema.ts ALWAYS run `npx drizzle-kit generate` then
  `npx drizzle-kit migrate` BEFORE committing. `migrate` prints
  "applied successfully" even when nothing is new - that output does
  NOT prove the new columns exist. Sprint 24 shipped code referencing
  comments.edited_at with no migration -> every post detail page
  500'd in production until migration 0010 was generated and applied.
- **Ethereal.email is a virtual inbox reachable ONLY via its own SMTP**
  - third-party mail (Clerk verification codes) NEVER arrives there.
  Clerk sign-up with an @ethereal.email address requires disabling
  email verification in Clerk Dashboard. Users who signed up BEFORE
  the Clerk webhook endpoint existed are NOT in the DB
  (posts.user_id FK fails -> "Fikir kaydedilemedi") - fix: create
  webhook (user.created/updated/deleted -> /api/webhooks/clerk),
  update CLERK_WEBHOOK_SIGNING_SECRET in Vercel (regenerated when the
  endpoint was recreated, 2026-09-02), manually insert the pre-existing
  user with their Clerk user ID from the dashboard.
- **FilterTabs** (components/custom/filter-tabs.tsx) is the shared
  pattern for server-side tab navigation via URL params (?sort=, ?status=,
  ?tag=). Reuse it for new filter/tab UI - no client state, links stay
  shareable. Since Sprint 21 it takes `extraParams` to preserve other
  filter params when switching tabs (multi-filter pages MUST pass it,
  or switching one filter silently clears the others).
- **Admin table pattern (Sprint 22)**: dashboard table lives in
  components/custom/posts-table.tsx (PostsTable - client component
  with row checkboxes + bulk status/tag bar) and saved-view-bar.tsx
  (SavedViewBar - save/open/delete filter combos). Bulk API:
  POST /api/admin/posts/bulk (only emits post/status.changed for rows
  whose status actually changed + one summary internal note per post);
  saved views: /api/admin/views (params stored as query string in
  `saved_views`, applied via plain /dashboard?... links). StatusSelect
  per-row stays intact - import it in new tables, not the whole markup.
- **Tags / post type model (Sprint 21)**: `posts.postType` enum
  (feature/bug/usability) = Canny's structured "category"; `tags` +
  `post_tags` = freeform tags. NO separate categories table (single
  taxonomy decision, Sprint 21). Tag names are normalized lowercase via
  `toLocaleLowerCase("tr")` (`normalizeTags` in lib/ai/analysis.ts -
  max 5, 2-30 chars); ai-autopilot step "sync-tags" upserts them from
  keywords and relinks post_tags idempotently. Tag chips: **TagChips**
  (linked ?tag= filter) is primary; KeywordChips only as fallback for
  old posts without tags. Read pattern for per-post tags: two queries
  (main list, then post_tags join filtered by page ids) - never a third
  join (fan-out). Per-post type badge = TypeBadge, admin picker =
  TypeSelect; PATCH /api/admin/posts accepts status and/or postType
  (at least one required) and drops an internal note for each change.
- **Portal default sort is "top" (vote count) since Sprint 12** - this
  SUPERSEDES plan.md Sprint 2's "en son eklenen en üstte" default
  (documented as BEHAVIOR CHANGE in plan.md). While a search query is
  active, tabs hide and relevance ordering wins. Dashboard stats are
  always computed from ALL posts; ?status= filters only the table.
- **StatusBadge** (components/custom/status-badge.tsx) is the single
  visual source for status colors; `statusLabels` comes only from
  `lib/post-format.ts` - no local copies (one was found in the export
  route and removed). Same pattern: **SentimentBadge** +
  **KeywordChips** for AI data; `sentimentLabels` in lib/post-format.
- **AI data visibility split** (user decision, Sprint 11): sentiment
  label + keywords are PUBLIC (portal cards, detail page); `aiSummary`
  is ADMIN-ONLY (detail page box). Rows render nothing when AI data is
  null. If this split ever changes, check all three surfaces.
- **Comments / internal notes** (Sprint 10): `comments.is_internal=true`
- **neon-http does NOT support `db.transaction()`** (session throws "No
  transactions support in neon-http driver", verified 2026-09-01). For
  multi-table atomic writes use a SINGLE CTE statement via `db.execute(sql`...`)`
  — data-modifying CTEs run in one implicit transaction; coordinate via
  RETURNING + `EXISTS (SELECT 1 FROM cte)` guards (see
  app/api/admin/merge/route.ts). `db.execute()` result shape varies —
  normalize `Array.isArray(res) ? res : res.rows`. In SET clauses use
  plain column names (drizzle renders interpolated columns qualified,
  which Postgres rejects in SET); table refs in FROM/INSERT INTO may use
  `${table}` interpolation.
- **Merge model (Sprint 20)**: `posts.mergedIntoId/mergedAt` = real
  merge (duplicateOf = AI candidate only); `votes/comments.mergedFromPostId`
  marks moved rows; `post_merges` = audit. Unmerge restores by
  `merged_from_post_id = source`. A voter who voted on BOTH posts keeps
  the source vote un-moved (NOT IN guard preserves unique(user_id,
  post_id)). Merged posts excluded from portal/roadmap/similar lists +
  votes/comments APIs reject them (400), but STAY in dashboard with a
  "Birleştirildi" badge (that is the unmerge path). No merge chains:
  target with mergedIntoId set cannot be a merge target.
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
- **base-ui Checkbox `onCheckedChange(checked)`**: checked is
  `boolean | "indeterminate"` - cast with `checked === true`.
  `npx shadcn add checkbox label` works (registry healthy for these).
- **drizzle-kit generate for ADDITIVE tables is non-interactive**;
  use `npx drizzle-kit generate --name <name>` then `npx drizzle-kit
  migrate` (config loads .env.local itself). Applied live to Neon
  without issue (migration 0004).
- Validation command is `npm run build`. Do NOT start `npm run dev` in-session
  (long-running server).

## Sprint workflow

1. Read `docs/plan.md`, find the next incomplete sprint and its Hedef/Yapılacaklar.
2. Implement it. If reality diverges from the docs (registry changes, API shifts),
   update the docs in the same change.
3. Validate with `npm run build` (types + lint).
4. Report the sprint's **Kontrol** checklist to the user for manual verification.
5. External services: Neon via `npx neonctl` (project feedl, bold-flower-95043158);
   Clerk app exists ("feedl", `app_3Ih0Ue3SHQLk5HOOFnWEM7LD6Ze`, CLI linked,
   authed as oguzkir@gmail.com); forward local webhooks with `clerk webhooks
   listen` (see pitfalls); Inngest runs CLOUD via the official Vercel
   integration (serve path /api/inngest; the Vercel "Protection Bypass for
   Automation" key is registered in Inngest - deleting it in Vercel breaks
   syncs); deploys are automatic on push to main (`vercel --prod` only when
   env vars changed). Users test on PRODUCTION; `npm run build` is the only
   in-session validation.
6. **NEVER name anything** (Neon project, Vercel project, Clerk app, database,
   skill, etc.) without asking the user first - the user explicitly requires
    being consulted on every name.

**Position (2026-09-03):** Sprint 32 (Widget SDK) is coded and deployed
(`b188c51` + double-prefix fix `04d6b02`); agent-side E2E passed all 6 steps
(session/cookie/CORS, anonim 401, fikir 201, liste+authenticated, oy
ver/çek, geçersiz jeton 401). Remaining: the user's manual browser check,
then mark Sprint 32 ✅ in docs/plan.md, then Sprint 33 (Autopilot Inbox) ->
Sprint 34 (Public API + Webhooks); Sprints 29-31 (analytics, companies,
opportunities) sit in backlog. Domain-bound work (custom domain,
Organizations/subdomain) stays deferred until a domain is bought.
