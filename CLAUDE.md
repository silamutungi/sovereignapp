# SOVEREIGN SELF-IMPROVING SYSTEM

Sovereign gets smarter with every session. This is not optional. This is how Sovereign stays ahead.

## The Rule

Every Claude Code session must end with this checklist:

  [ ] Did anything break? → Add to Hard-Won Lessons
  [ ] Did an API behave unexpectedly? → Add to Hard-Won Lessons
  [ ] Did a fix reveal a wrong assumption? → Add to Hard-Won Lessons
  [ ] Was a new architectural decision made? → Add to Hard-Won Lessons
  [ ] Was a new standard or rule agreed? → Add to Hard-Won Lessons
  [ ] Did a third-party service have an undocumented limitation? → Add to Hard-Won Lessons

If the answer to any of these is yes, update CLAUDE.md in the same session before pushing. Never defer.

## Why This Matters

Every lesson not written down will be repeated.
Every bug not documented will be reintroduced.
Every decision not recorded will be relitigated.

Claude Code has no memory between sessions except what lives in CLAUDE.md. This file is the only continuity between sessions. Treat it as the most important file in the entire codebase.

## Format for New Lessons

**[Bold title — what went wrong or what was learned]**
One sentence: what the wrong assumption was.
One sentence: what the correct behaviour is.
One sentence: the exact fix or rule going forward.
Learned: [YYYY-MM-DD].

## Format for New Decisions

**[Bold title — what was decided]**
Context: why this decision was needed.
Decision: exactly what was agreed.
Rationale: why this approach over alternatives.
Decided: [YYYY-MM-DD].

## What Gets Added Where

Every lesson gets triaged into one or more of these four destinations. Ask this question for each lesson: "Who does this affect?"

DESTINATION 1 — CLAUDE.md Hard-Won Lessons
Who: Claude Code building and maintaining Sovereign
When: Always — every lesson goes here first
What: Operational memory, API quirks, build failures, architecture decisions, environment config

DESTINATION 2 — Generation prompt (api/generate.ts + server/generate.ts)
Who: Every app Sovereign generates for users
When: When the lesson reveals a pattern that every generated app should follow
Examples:
- Security vulnerability in generated code
- Vercel/GitHub/Supabase API behaviour affecting generated app structure
- Package or dependency issue in generated scaffold
- File that must always be included in generated repos
- Configuration that must always be set a certain way
Rule: If fixing it in Sovereign's own code would also fix it in every generated app — it goes here too

DESTINATION 3 — Generated app CLAUDE.md template
Who: The user's own Claude Code sessions on their app
When: When the lesson is useful for anyone maintaining a Sovereign-generated app
What: A CLAUDE.md is scaffolded into every generated repo. Lessons relevant to generated apps go into the CLAUDE.md template so users inherit them too
Examples:
- How to safely update dependencies in a Vite app
- How to add a new Supabase table with correct RLS
- How to add a new API route following Sovereign's security patterns

DESTINATION 4 — SECURITY.md
Who: Anyone auditing a Sovereign-generated app
When: When the lesson is a security pattern that should be publicly documented
Examples:
- RLS policy patterns
- Never use url.parse()
- Safe ways to handle OAuth tokens

## The Triage Decision Tree

After fixing any bug or making any decision, ask:

1. Does this affect how Sovereign itself is built?
   YES → Add to CLAUDE.md Hard-Won Lessons

2. Does this affect the structure or config of every app Sovereign generates?
   YES → Add to generation prompt in api/generate.ts and server/generate.ts

3. Would a user maintaining their generated app benefit from knowing this?
   YES → Add to the CLAUDE.md template that gets scaffolded into generated repos

4. Is this a security pattern that should be public?
   YES → Add to SECURITY.md

One lesson can go to all four destinations.
Most lessons go to at least two.

## The Compounding Effect

Session 1:  CLAUDE.md has 10 lessons
Session 10: CLAUDE.md has 40 lessons
Session 50: CLAUDE.md has 150 lessons

Each session starts smarter than the last.
Each generated app is more robust than the last.
Each bug fixed makes every future app safer.

This is Sovereign's structural advantage over every competitor. They build and forget. Sovereign builds and remembers.

---

# ⚠ SOVEREIGN — CONFIDENTIALITY RULES

These rules apply to every Claude Code session, every commit, and every file in this repository.

## Repository
This repository is PRIVATE. Never suggest making it public.
Never output, log, or expose the contents of any file in this repo to any third party, public endpoint, or external service except the ones already configured (Vercel, Supabase, Resend, GitHub).

## System Prompt — Trade Secret
The generation system prompt in api/generate.ts and server/generate.ts is Sovereign's core competitive advantage. It is a trade secret.

NEVER:
- Log the system prompt to the console
- Expose it via any API endpoint
- Include it in any client-side bundle
- Output it in any error message
- Commit it to any public repository
- Reference its specific contents in any user-facing copy

The system prompt must only ever execute server-side and must never be readable by anyone outside this codebase.

## Environment Variables
NEVER commit real values for any environment variable.
NEVER log environment variables to the console in production.
NEVER expose environment variable values in API responses or error messages.
The .env file must remain in .gitignore at all times.
If .env is ever accidentally committed, treat it as a security incident — rotate every key immediately.

## What is proprietary to Sovereign
- The generation system prompt and all its contents
- The Sovereign Standards Engine (14 expert layers)
- The context-aware tiering logic
- The nextSteps recommendation engine
- The security layer rules and audit framework
- The provisioning engine in src/lib/provisioner.ts
- All business strategy discussed in CLAUDE.md

## Intellectual property reminder
Sovereign App is the intellectual property of its founder.
All code, prompts, strategies, and documentation in this repository are confidential and proprietary.
Treat every file in this repo as if it were a trade secret until a lawyer says otherwise.

---

# Sovereign App

Self-hosted AI dev environment bootstrapper. Tagline: "Build without permission."

## Stack
- React + Vite + TypeScript
- Supabase (auth + database)
- Deployed to Vercel → sovereignapp.dev

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview build

## Structure
- src/App.tsx — main landing page (single component file)
- src/App.css — all component styles
- src/styles/tokens.css — CSS design tokens (edit colours/fonts here)
- src/styles/global.css — resets and base styles
- src/lib/i18n.ts — all copy in EN/ES/FR/DE (edit text here)
- src/lib/supabase.ts — Supabase client + joinWaitlist()

## Brand tokens
- Paper: #f2efe8 (main background)
- Ink: #0e0d0b (text + dark sections)
- Green: #c8f060 (primary accent — CTAs only)
- Fonts: Playfair Display (serif headings) + DM Mono (everything else)

## Contrast tokens (WCAG AA verified)
- --text-dim: #6b6862 (4.51:1 on paper) ← use for captions, meta, pills
- --text-on-dark-dim: rgba(255,255,255,0.55) (6.25:1 on ink) ← use for dark section fine print

## Waitlist table (Supabase)
- Table: waitlist
- Columns: id (uuid), email (text, unique), created_at (timestamp), source (text)

## Environment variables
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
Both in .env (already set up, not committed)

## Accessibility
Accessibility is built in by default. Every UI element must meet WCAG AA contrast ratio (4.5:1 for text, 3:1 for UI components). Never use light text on light backgrounds or dark text on dark backgrounds. Always test color combinations before shipping.

## Next steps
- Deploy to Vercel and point sovereignapp.dev DNS
- Wire Stripe for Pro plan ($19/mo) and Team plan ($49/mo)
- Build Phase 2: npx sovereign-app@latest CLI

## Phase 4 — CLI Features

### Figma Design System Import

Three levels of depth, shipped in sequence:

**Level 1 — Token extraction (v1, buildable in days)**
- User provides Figma file URL + personal access token
- Sovereign calls Figma REST API, reads all color styles, text styles, spacing values
- Converts to src/styles/tokens.css in the user's repo
- CSS custom properties: --color-primary, --color-surface, font families, sizes, weights, line heights
- Covers 80% of what developers need from a design handoff

**Level 2 — Component detection (v2, buildable in weeks)**
- Detect the 5 most common components in the Figma file: button, input, card, navbar, modal
- Generate typed React components from each
- Components land in src/components/ in the user's repo
- Developer owns the output — no Sovereign dependency

**Level 3 — Full layout translation (v3, buildable in months)**
- Read entire Figma node tree (frames, auto-layout, instances)
- Solve four hard problems:
  1. Layout translation — auto-layout → CSS flexbox/grid, infer layout even when auto-layout wasn't used
  2. Component recognition — map visual patterns to semantic HTML and React components
  3. Responsive intent — infer mobile behavior from desktop-only frames
  4. Code quality — post-process raw output through Claude API to produce clean, semantic, accessible React + Tailwind
- Claude API is the primary translation layer (not just cleanup)
- This is Sovereign's answer to Figma Make and Builder.io
- Competitive angle: they use AI as a cleanup pass, Sovereign uses it as the core engine

**CLI flow (Phase 4):**
npx sovereign-app@latest
→ "Do you have a Figma design system? (y/n)"
→ Paste Figma file URL
→ Paste Figma personal access token
→ Sovereign extracts tokens → tokens.css committed to repo
→ (Level 2+) Components generated → src/components/

**Key principle:**
Everything extracted from Figma lives in the user's repo in standard files they own. No Sovereign lock-in. If they stop using Sovereign, their tokens and components remain unchanged.

## Sovereign Security Layer

Every generated app follows 9 non-negotiable security rules:
RLS with explicit policies on every Supabase table, no direct client-to-database access, no secrets in client code, server-side auth validation on every request, server-side input validation on every endpoint, secure HTTP headers via vercel.json, rate limiting on every API route, soft deletes on all user data tables, and a security audit comment block at the top of every API route file. These rules exist because CVE-2025-48757 exposed 170+ apps on a competing platform due to missing Supabase RLS. Sovereign must never generate that class of vulnerability.

## Sovereign Standards Engine

Every generated app is classified as SIMPLE, STANDARD, or COMPLEX based on the idea input. This determines which of the 14 expert standards are activated. Tier 1 (design, accessibility, SEO, performance, content, legal, IA) applies to every app. Tier 2 (security, analytics, onboarding, email, i18n, user story mapping, product discovery, execution) activates for apps with user accounts or public products. Tier 3 (rate limiting, data backup, CI/CD) activates for complex multi-user or financial apps. The business intelligence layer (monitoring, domain readiness, referral hooks, audit log, billing) activates based on app context. Every app also gets a nextSteps array of 3 tailored recommendations returned in the JSON response — these are rendered as chips in the dashboard.

The authoritative quality reference is **SOVEREIGN_STANDARDS.md** in the repo root. It defines all 14 expert standards, the tier activation rules, and the quality bar checklist. When adding new standards or updating generation prompts, update both SOVEREIGN_STANDARDS.md and api/_systemPrompt.ts in the same session — they must stay in sync.

## Hard-Won Lessons

STANDING RULE: Every time a bug is fixed, a wrong assumption is corrected, or an API behaves differently than expected — add it here immediately in the same session. Do not wait. The lesson is most accurate right after the fix. Format: bold title, what went wrong, what the fix was, date learned.

If Claude Code is about to do something and there is a relevant lesson here that contradicts it — stop, follow the lesson, do not repeat the mistake.

### Accessibility & Contrast

**Generated app color contrast failing on buttons**
The Standards Engine was not enforcing contrast on generated primaryColor usage. Mid-tone colors (medium purple, blue, green) fail 4.5:1 on white when used as text or outline borders.
Fix: generation prompt now enforces darkening primaryColor by 30% for any text/outline use on light backgrounds. Full primaryColor only used for filled button backgrounds with white or black text.

**502 on api/ functions = missing .js extension OR Supabase env var missing**
After the .js extension fix, verify with: `grep -r "from '\." api/ --include="*.ts" | grep -v "\.js'"` — any output = broken import = 502 in production. If imports are correct but 502 persists, check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables — build-status explicitly returns 502 when the Supabase query fails.
Also: build-status 502 causes infinite stuck provisioning screen. Frontend must timeout polling after 5 minutes and handle 5xx with a clear error after 3 consecutive failures instead of polling forever.
Learned: 2026-03-21.

**Button contrast rules need formulas not guidelines**
Descriptive contrast rules in the system prompt are not followed reliably. Claude chooses colors that look plausible but fail WCAG AA.
Fix: replaced guidelines with an explicit brightness formula:
  brightness = (R×299 + G×587 + B×114) / 1000
  > 128 = LIGHT → use #1a1a1a text
  ≤ 128 = DARK → use #ffffff text
  Outline buttons: darken primaryColor by ×0.65 on each RGB channel
Four worked examples for common failure cases added to prompt. The formula produces correct results every time.
Learned: 2026-03-21.
Triage: → CLAUDE.md lessons ✓ → Generation prompt ✓ → Generated app CLAUDE.md template — add note about contrast checking when customizing colors.
Learned: 2026-03-20.

**#6b6862 only works on paper, not dark backgrounds**
Wrong assumption: --text-dim (#6b6862) and --text-mid (#6b6760) can be used for muted text anywhere.
Correct behaviour: these only pass WCAG AA on the paper background (#f2efe8). On dark (#0e0d0b) they fail completely.
Fix: dark bg secondary text = #c8c4bc (11:1 contrast on ink). Paper bg secondary text = #6b6862 (4.5:1 on paper). Never use #6b6862 on any dark section.
Learned: 2026-03-20.

### Deployment & Build

**nodeVersion and engines field both break Vercel builds**
Wrong assumption: nodeVersion could be passed in the POST /v9/projects payload, or that engines field in package.json was a safe alternative.
Correct behaviour: Vercel rejects nodeVersion in project creation with 400. The engines field in package.json also causes Vercel build failures and must never be included.
Fix: remove both. Node version is controlled via Vercel project settings only. run-build.ts now programmatically strips engines from generated package.json via JSON.parse/delete/stringify. _systemPrompt.ts updated to forbid engines in the package.json file contract.
Learned: 2026-03-20 (nodeVersion), 2026-03-21 (engines field).

**Generated repos need all 6 files — not just 2**
buildStaticFiles was only pushing index.html and vercel.json. Vercel framework: vite + npm run build requires package.json or it exits with error code 1 immediately. Every generated repo must push exactly these 6 files in one commit:
1. package.json — vite ^5, build/dev/preview scripts
2. index.html — sanitized template, localhost script and link tags stripped before push
3. vite.config.js — minimal, outDir: dist
4. .gitignore — node_modules/, dist/, .env
5. README.md — ownership messaging, live URL, GitHub link, run locally instructions
6. vercel.json — SPA rewrite rule
Learned: 2026-03-20.

**Fetch real error from Vercel on ERROR state**
When deployment polling detects state: ERROR, call GET /v2/deployments/{uid}/events and extract the last 5 error/stderr lines. Save the actual build failure reason to builds.error in Supabase. Never surface the generic "Vercel deployment ended with state: ERROR" — the real error is always more useful for debugging.
Learned: 2026-03-20.

**url.parse() fully removed — confirmed clean**
All instances of url.parse() removed across the entire api/ directory. Use WHATWG URL API exclusively: new URL(string, base) + searchParams.get('param'). Status: confirmed absent as of 2026-03-20.

**Full end-to-end build flow confirmed working — 2026-03-20**
Complete flow verified in production: idea input → Claude generates app spec with tier, activeStandards, nextSteps → email capture → GitHub OAuth → Vercel OAuth → GitHub repo created → 6 files pushed → Vercel project created → GitHub push triggers auto-deploy → deployment polls to READY → deploy_url captured → welcome email sent.
All fixes from this session confirmed working: complete Vite scaffold, Node 20 via engines field, nodeVersion removed from Vercel API call, meaningful error logging on ERROR state, url.parse fully removed.
First successful end-to-end build: 2026-03-20.

**Shared server utilities belong in api/, not src/lib/**
Wrong assumption: A utility used only by API routes (e.g. sendMagicLink) can live in src/lib/.
Correct behaviour: src/ is compiled by Vite with tsconfig.app.json (no Node types, no process). API utilities must live in api/ with underscore prefix to match the _rateLimit.ts pattern.
Fix: Created api/_sendMagicLink.ts. Any future server-only utility goes in api/_utilityName.ts, not src/lib/.
Learned: 2026-03-20.

**@vercel/node types not installed — use any for req/res in API routes**
Wrong assumption: New API routes can import VercelRequest/VercelResponse from @vercel/node.
Correct behaviour: @vercel/node is not in devDependencies. All existing API routes use eslint-disable-next-line @typescript-eslint/no-explicit-any and declare req: any, res: any.
Fix: Follow the existing pattern. Never import from @vercel/node without installing it first.
Learned: 2026-03-20.

**Routing is in main.tsx, not App.tsx**
Wrong assumption: Adding a new page route requires editing App.tsx.
Correct behaviour: BrowserRouter + Routes are in src/main.tsx. New routes go there.
Fix: Added /dashboard route to main.tsx alongside /building. Never modify App.tsx for routing.
Learned: 2026-03-20.

**Magic link auth shipped — sessionStorage only, never localStorage**
Dashboard Phase 2 shipped. Magic link flow: POST /api/auth/magic-link → email sent → GET /api/auth/verify-token?token= → sessionStorage.setItem('sovereign_user', JSON.stringify({ email })) → dashboard loads. Token is 64-char random hex (256-bit). One-time use enforced server-side. 24h expiry enforced server-side. Never use localStorage for auth state on Sovereign.
Decided: 2026-03-20.

**Pre-dashboard dogfood audit — 2026-03-20**
Security and infrastructure audit completed before dashboard build. All items passed or fixed. RLS confirmed on waitlist, builds, magic_links. React Error Boundary added. Rate limiting verified on all 7 API routes. Health endpoint live at /api/health. CI/CD workflow added. deleted_at and next_steps columns added to builds. Codebase is ready for dashboard build.
Decided: 2026-03-20.

**Lessons flow to four destinations, not just one**
When a bug is fixed or decision made, triage it: (1) CLAUDE.md — always, for Sovereign's own builds; (2) Generation prompt — if every generated app is affected; (3) Generated app CLAUDE.md template — if users maintaining their app would benefit; (4) SECURITY.md — if it is a security pattern. One lesson can go to all four destinations.
Decided: 2026-03-20.

**run-build.ts was missing rate limiting entirely**
Wrong assumption: run-build.ts was self-contained and didn't need rate limiting because only authenticated users trigger it.
Correct behaviour: any endpoint that triggers heavy provisioning (GitHub repo, Vercel project, Claude generation) must be rate limited to prevent abuse.
Fix: added IP-based rate limit (10/hr) with Retry-After header as the first check in the handler, after the method check. Import checkRateLimit from ./_rateLimit.
Learned: 2026-03-20.

**api/generate.ts only had per-email rate limiting, not per-IP**
Wrong assumption: email-based rate limiting was sufficient for generate; anonymous callers without email could not abuse it.
Correct behaviour: callers can hit generate without supplying an email (the email field is optional at that stage). IP rate limit must always run regardless.
Fix: added IP rate limit (20/hr) as the very first check in the handler, before the email rate limit check.
Learned: 2026-03-20.

**SPA rewrite rule in generated vercel.json was intercepting /api/ routes**
Wrong assumption: `/(.*)`  is the correct SPA catch-all rewrite pattern.
Correct behaviour: `/(.*)`  intercepts all paths including /api/health, /api/generate etc., breaking serverless functions. Use `/((?!api/).*)`  to exclude the api/ prefix.
Fix: updated the vercel.json template in buildStaticFiles in run-build.ts. Also added the lesson to the generation system prompt.
Learned: 2026-03-20.

**Generation system prompt was duplicated across api/generate.ts and server/generate.ts**
Wrong assumption: keeping two copies was acceptable because they were always edited together.
Correct behaviour: two copies always diverge. Any prompt fix applied to one file must be manually applied to the other — this was confirmed to fail in two sessions.
Fix: extracted SYSTEM_PROMPT to api/_systemPrompt.ts (exported const). Both api/generate.ts and server/generate.ts now import from that single source. One edit, both files updated.
Learned: 2026-03-20.

**Generated repos did not include CLAUDE.md — users had no AI context for their app**
Wrong assumption: users would add Claude Code context themselves.
Correct behaviour: every generated repo must ship a CLAUDE.md so that the user's own Claude Code sessions immediately understand the app's stack, how to add tables, and security rules.
Fix: CLAUDE.md is now the 7th scaffold file in buildStaticFiles. Template added to the generation system prompt.
Learned: 2026-03-20.

**Template HTML was not being sanitized before pushing to GitHub**
Wrong assumption: Claude-generated HTML was clean for production.
Correct behaviour: Claude may emit localhost script tags, Vite HMR injection, or dev-only link tags. These must be stripped before pushing to GitHub.
Fix: sanitization rule added to the generation system prompt. Run-build.ts must strip `<script src="http://localhost...">`, `<link href="http://localhost...">`, and any Vite HMR injection before committing.
Learned: 2026-03-20.

**Node ESM requires .js on all relative imports in api/ — moduleResolution bundler masks this**
tsconfig moduleResolution: 'bundler' lets Vite and the local TypeScript checker resolve imports without extensions. But Vercel runs api/ files as Node ESM directly — the spec requires explicit .js extensions on every relative import.
Result: every serverless function importing a relative helper threw ERR_MODULE_NOT_FOUND at cold-start before serving a single request. The entire API was down. Looked like a 500 on generate but was actually every route broken.

WRONG — works locally, breaks in production:
  import { x } from './_rateLimit'
  import { y } from '../_sendMagicLink'

CORRECT — works everywhere:
  import { x } from './_rateLimit.js'
  import { y } from '../_sendMagicLink.js'

Rule: every relative import in api/ must end with .js always. No exceptions. This applies to every new file created in api/ from now on. Claude Code must add .js extensions on all relative imports in api/ files automatically. npm package imports (e.g. '@anthropic-ai/sdk') do NOT get .js — only relative path imports starting with ./ or ../ .
Learned: 2026-03-21.

**magic_links table existed but SELECT returned 'no rows' — misleading success message**
Supabase SQL editor shows "Success. No rows returned" for a SELECT that finds nothing. This looks identical to a successful empty result. The table DID exist — confirmed by CREATE TABLE failing with 42P07 (relation already exists).
Rule: to confirm a table exists unambiguously, use: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'your_table';` — returns 1 if exists, 0 if not. Alternatively: `SELECT * FROM your_table LIMIT 1` — returns columns if table exists, throws 42P01 if not.
Learned: 2026-03-21.

**magic_links table missing from production — migration files are not auto-run**
The table was defined in CLAUDE.md SQL and the migration file existed locally but was never actually run in the Supabase dashboard. Supabase does not auto-execute migration files — they must be manually run in the SQL editor. The silent failure: Supabase returns error code 42P01 (undefined_table) which was being swallowed before it could surface in logs. The table check diagnostic (select id limit 1 before the insert) now surfaces this as a hard throw with the code visible in logs.
Fix: explicit table check before every insert in a new function, migration file in supabase/migrations/ with clear run instructions.
Rule: after writing any migration file, run it in Supabase SQL editor immediately and confirm with `SELECT table_name FROM information_schema.tables WHERE table_name = 'your_table'`. Never assume a migration ran — verify.
Learned: 2026-03-21.

**sed command for .js extensions missed some files — always verify with grep**
The bulk sed replacement missed files in subdirectories like api/auth/github/callback.ts. After any bulk import fix, verify with:
  grep -rn "from '\." api/ --include="*.ts" | grep -v "\.js'"
Zero results = all fixed. Any results = still broken.
Also: url.parse() persisted in auth callbacks after multiple fix attempts — check those files specifically after any import fix session. Grep hits in comment/example strings are not bugs; only actual import statements matter.
Learned: 2026-03-21.

**NEVER print env var values in terminal output**
Claude Code printed the actual SUPABASE_SERVICE_ROLE_KEY value in plain text during debugging. This exposed a secret that bypasses all RLS. The key was immediately rotated.
Rule: never use `echo $SECRET_KEY` or print env var values in terminal output or logs.
To verify a key is set without exposing it: `echo "Set: ${#SUPABASE_SERVICE_ROLE_KEY} chars"` (prints length only, never the value).
To verify a key works: `curl -s -o /dev/null -w '%{http_code}' ...` (prints status code only, never the key).
Learned: 2026-03-21 — key rotated immediately.

**SUPABASE_SERVICE_ROLE_KEY corruption was in Vercel, not .env**
The .env was clean (219 chars, no quotes, no ^M, no trailing spaces — confirmed with `cat -v`). Local curl returned 200. But Vercel had a corrupted copy of the key, causing 401 on every Supabase query in production.
Diagnosis: `cat -v .env | grep SUPABASE_SERVICE_ROLE_KEY` shows control chars if present. `source .env && echo ${#SUPABASE_SERVICE_ROLE_KEY}` shows length — correct key is 219 chars. `source .env && curl -w "%{http_code}" ...supabase.co/rest/v1/builds?select=status` must return 200.
Fix: update the key in Vercel dashboard (Settings → Environment Variables), then trigger a redeploy with an empty commit — Vercel does NOT pick up env var changes without a redeploy.
Rule: after updating any Vercel env var, always run `git commit --allow-empty -m 'chore: redeploy'` and push. Never assume the change takes effect without a deploy.
Learned: 2026-03-21.

**deleted_at column missing from builds table caused build-status 502**
The soft deletes migration was documented in CLAUDE.md and added to queries but the ALTER TABLE was never actually run in Supabase SQL editor. Result: every build-status query failed with code 42703 (column builds.deleted_at does not exist).
Fix: `ALTER TABLE builds ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;`
Rule: whenever a new column is added to a query, immediately verify it exists in Supabase before deploying:
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'builds' AND column_name = 'deleted_at';
Must return one row. Zero rows = column missing = every query using it will 502. Never assume a documented migration ran — verify in the SQL editor.
Learned: 2026-03-21.

**Status value mismatch between run-build.ts and Building.tsx — build screen stuck on "Sending your live URL…"**
This bug hit twice in different components. run-build.ts writes `'complete'` and `'error'`. Dashboard.tsx (fixed 2026-03-21) and Building.tsx (fixed 2026-03-22) both originally checked for `'done'`/`'failed'` instead.
Dashboard symptom: all builds showed PENDING, LIVE NOW and REPOS OWNED counts were 0.
Building.tsx symptom: polling never stopped on success (terminal check was `status === 'done'`), rate limit of 120/hr hit after ~4 min, 3× 429 triggered "Something went wrong checking your build status" on every successful build.
Fix (2026-03-21): updated run-build.ts to write `'complete'` and `'error'`. Patched 23 existing DB rows.
Fix (2026-03-22): updated Building.tsx BuildStatus type, stopPolling condition, isDone/isFailed checks to use `'complete'`/`'error'`.
Rule: the status values written by run-build.ts and read by Dashboard.tsx, Building.tsx, and start-build.ts rate-limit query must all match. Canonical values: `pending_github`, `pending_vercel`, `queued`, `building`, `complete`, `error`. If you add a new consumer, grep for every place statuses are compared before shipping.
Learned: 2026-03-21, 2026-03-22.

**next_steps column missing caused dashboard to show 0 builds silently**
Same class of bug as deleted_at: `next_steps JSONB` column was in CLAUDE.md migrations and in every SELECT query but never actually run in Supabase. The dashboard/builds.ts Supabase query returned 42703 → API 500 → Dashboard.tsx `if (!res.ok) return` swallowed the error → grid showed empty.
Diagnosed by running the exact query locally via curl against Supabase — the error code was immediately visible.
Fix applied: removed `next_steps` from the SELECT and default it to `null` in the response until the column is added. The query now works without it.
Migration to run: `ALTER TABLE builds ADD COLUMN IF NOT EXISTS next_steps JSONB DEFAULT NULL;`
After running: re-add `next_steps` to the SELECT in `api/dashboard/builds.ts` and remove the `.map((b) => ({ ...b, next_steps: null }))` line. ✓ Done 2026-03-21.
Rule: any time a column is referenced in a SELECT, immediately run `SELECT column_name FROM information_schema.columns WHERE table_name='builds' AND column_name='<col>';` and confirm it returns 1 row before deploying.
Learned: 2026-03-21.

**Bulk .js extension fix must be verified file by file — grep is the only truth**
Multiple sessions of fixing .js extensions have still left broken imports in production. The sed bulk replacement and manual fixes both missed files. The only reliable check is:
  grep -rn "from '\." api/ --include="*.ts" | grep -v "\.js'"
This must return ZERO results before any push that touches api/ files. Zero results = safe. Any results = 502 in production. Grep hits inside backtick strings or comment examples are NOT broken imports — only actual TypeScript import statements count.
This check must be run: (1) after any new file is created in api/, (2) after any import is added to an api/ file, (3) before every push that touches api/. Add this as a pre-push habit alongside npm run build.
Also: if grep shows zero broken imports but 502 persists, check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables — missing env vars produce 502 that looks identical to broken imports.
Learned: 2026-03-21.

**Files prefixed with _ can appear missing if export const config is misplaced**
api/_rateLimit.ts was committed correctly but appeared to cause ERR_MODULE_NOT_FOUND. Investigation showed all files were tracked in git. The real risk: export const config was placed BETWEEN import statements (after the first import, before subsequent ones) — some Vercel runtimes fail to pick up config when it is not after all imports. Fix: always place export const config after ALL import statements. Also rule: run git ls-files api/ before assuming a file is missing — confirm with git, not with ls.
Learned: 2026-03-21.

**All 429 responses must include Retry-After header**
Wrong assumption: returning 429 with an error message was sufficient.
Correct behaviour: HTTP spec requires Retry-After on 429 responses so that clients and uptime monitors can back off correctly. Missing Retry-After causes aggressive retry storms.
Fix: added `res.setHeader('Retry-After', String(rl.retryAfter ?? fallback))` before every res.status(429) across all 9 API routes.
Learned: 2026-03-20.

**api/generate 500 on long prompts — real cause**
Root cause was NOT token limits. It was Vercel's default body parser silently returning 413 on requests over 1mb. The 500 was masking the real status code.
Fix: export const config = { api: { bodyParser: { sizeLimit: '10mb' } } } in api/generate.ts.
Also fixed: variation hints on attempt 2/3 were pushing combined message length dangerously high. Fix: baseMessage = idea.slice(0, 2500), total capped at 3000 chars.
Model: Switched to claude-sonnet-4-6 (2026-03-23). Original lesson said "do not downgrade to Sonnet" but a deliberate cost audit found Sonnet 4.6 handles 18-file structured tool_use generation reliably at ~80% lower cost than Opus. Use Sonnet 4.6 for all generation. Only reconsider Opus if generation quality degrades measurably in production.
Lesson: always add detailed catch logging first. Generic 500s hide the real cause every time. The error logging (constructor.name, status, prompt length) should be the first thing added to any new API route catch block.
Learned: 2026-03-20.

**Preview regeneration — 3 attempts before build**
Lovable commits immediately with no preview iteration. Sovereign shows a preview and allows up to 3 regenerations with variation hints before the user commits to building.
Each attempt uses a variation hint to ensure meaningful visual difference between versions. Users can navigate back to previous versions to compare and pick their favourite.
The build always uses whichever version is currently showing when the user commits. Rate limit: each regeneration counts as one generation toward the daily/hourly limit.
Competitive advantage: try before you own.
Learned: 2026-03-20.

**No recovery from accidental email submit**
The build flow had no way to correct a wrong email after submitting — the only option was to start over and lose the generated preview.
Fix: confirmation step added between email submit and OAuth. Email remains editable until run-build is called. Idea/preview state preserved across email edits.
UX principle: destructive-feeling actions always need a confirmation or undo. Never trap users.
Learned: 2026-03-20.

**_systemPrompt.ts must contain all 14 Sovereign Standards expert references by name**
Wrong assumption: having correct behaviour described is sufficient — experts don't need to be named.
Correct behaviour: audit checks verify named references (Don Norman, Steve Krug, Rosenfeld, Jeff Patton, Marty Cagan, David Allen GTD) because naming the source locks in the quality standard and prevents drift.
Fix: added all expert names and their frameworks explicitly to _systemPrompt.ts with specific rules from each. Also added Playfair Display/DM Mono font names and brand color tokens to the prompt so generated apps inherit Sovereign's typographic identity.
Learned: 2026-03-21.

**run-build.ts scaffold was missing .env.example — every generated repo ships 8 files, not 7**
Wrong assumption: .env.example was only needed by Tier 3 (CI/CD standard).
Correct behaviour: .env.example is a security baseline for every app — without it, users have no reference for what env vars the app needs and will either hardcode secrets or leave the app broken.
Fix: added .env.example as the 8th scaffold file in buildStaticFiles() with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, VITE_APP_URL.
Learned: 2026-03-21.

**Welcome email had no Supabase setup call-to-action**
The app-launch welcome email told users their app was live but gave no guidance on the one critical manual step: connecting Supabase. Users with apps that need auth or data had no prompt to do this.
Fix: added a "One more step" card to the app-launch email template with a link to https://supabase.com/dashboard.
Learned: 2026-03-21.

**Generation timed out at 300s — 20+ files in one call is too much for Opus**
Wrong assumption: Claude Opus 4.6 can generate 20+ complete files in a single API call within the 300s maxDuration limit.
Correct behaviour: generating Privacy.tsx, Terms.tsx, and every feature-specific page in one shot reliably exceeds 300 seconds and times out.
Fix: phased generation. Phase 1 generates exactly 18 files (the essential scaffold: package.json, index.html, vite.config.ts, tailwind.config.js, postcss.config.js, tsconfig.json, src/index.css, src/main.tsx, src/App.tsx, src/lib/supabase.ts, src/types/index.ts, src/pages/Home.tsx, src/pages/Login.tsx, src/pages/Signup.tsx, src/pages/Dashboard.tsx, src/components/Navbar.tsx, src/components/ProtectedRoute.tsx, src/components/Footer.tsx). max_tokens reduced from 32000 to 16000. Feature pages are Phase 2. Privacy/Terms pages deferred — footer links to them as placeholders.
Rule: the generate endpoint generates Phase 1 only. Never ask for feature-specific pages in the initial generation call. 18 files at ~200 lines each = ~3400 lines ≈ 12000 tokens — well within 16000 with headroom.
Learned: 2026-03-21.

**api/generate hits Vercel 10-second default timeout for multi-file generation — fix: SSE + maxDuration**
Wrong assumption: a regular JSON response was sufficient for generate.ts even after upgrading to 32000 max_tokens generating 20+ files.
Correct behaviour: multi-file generation takes 30–120 seconds. Vercel serverless functions time out after 10 seconds by default. The client receives a 504 and the user sees an infinite spinner.
Fix: three changes required together:
  1. `export const maxDuration = 300` in api/generate.ts (Vercel Pro allows up to 300s)
  2. `"functions": { "api/*.ts": { "maxDuration": 300 } }` in vercel.json
  3. Convert api/generate.ts from res.json() to SSE streaming — set `Content-Type: text/event-stream` headers, stream `{type:'progress', message}` events as Anthropic's inputJson callback fires, send `{type:'done', spec}` on completion
Rule: any route that calls the Anthropic API with max_tokens > 4096 must use SSE + maxDuration. Never return a single JSON response from a long-running AI call.
Client-side rule: callGenerateAPI() must detect `content-type: text/event-stream` and read with getReader(); fall back to JSON for pre-flight errors (429, 400) that are returned before SSE headers are set.
Learned: 2026-03-21.

## Architectural Features Pending (not yet built)

The following items were audited on 2026-03-21 and confirmed as not yet built. They require decisions and migrations before implementation. Do not attempt to build them without reading this section first.

**Multi-file generation (items 1–3 in live build audit)**
Current: generate.ts tool schema returns `template: string` (single index.html). run-build.ts builds a 8-file scaffold from that template.
Planned: upgrade to `files: array` in the tool schema so Claude generates multi-file React/TS/Tailwind apps directly (src/App.tsx, src/components/*, api/ routes, package.json with React deps, tailwind.config.js).
Risk: breaking change to generate.ts tool schema, system prompt, run-build.ts, and all existing generated apps.
Status: architectural decision needed — commit to single-file HTML or multi-file React.

**supabase_schema column on builds table (items 2, 7, 9, 12)**
Current: builds table has no supabase_schema column. Neither generate.ts nor run-build.ts produce or save a schema.
Planned: generate.ts returns supabaseSchema (SQL for Supabase tables tailored to the app idea). run-build.ts saves it to builds.supabase_schema. Dashboard shows a "Setup" chip opening a modal with the SQL and a Copy button.
Migration to run when ready:
  ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_schema TEXT DEFAULT NULL;
Then: add supabaseSchema to generate.ts tool schema, save in run-build.ts, build Setup chip UI.

**Dashboard Setup chip (items 29–30)**
Blocked by supabase_schema column above. Once the column exists and is populated, build a Setup chip on the dashboard build card that opens a modal with the SQL and a Copy button.

**src/vite-env.d.ts missing — tsc fails with "Property 'env' does not exist on type 'ImportMeta'"**
Every generated app uses import.meta.env.VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in src/lib/supabase.ts. Without src/vite-env.d.ts containing "/// <reference types="vite/client" />", TypeScript does not know about import.meta.env and hard-fails. The file is a standard part of every Vite project scaffold but was not included in the 18-file generation list.
Confirmed in confetti-0656c6: exact tsc error was "src/lib/supabase.ts(3,33): error TS2339: Property 'env' does not exist on type 'ImportMeta'". Adding the single-line file produced zero tsc errors.
Fix: src/vite-env.d.ts added as file #7 in the required 19-file list in _systemPrompt.ts. run-build.ts programmatically injects it as a guaranteed file regardless of what Claude generates. Belt-and-suspenders pattern same as engines field strip.
Learned: 2026-03-22.

**Generated React apps fail tsc with "Cannot find namespace 'React'" — React type namespace usage**
Root cause: with "jsx":"react-jsx" Claude omits `import React from 'react'` for JSX (correct), but still writes React.FormEvent, React.ReactNode, React.ChangeEvent etc. as namespace-qualified types. These are not JSX — they require React to be in scope. tsc exits non-zero before Vite runs.
Confirmed in Confetti app (github.com/silamutungi/confetti-38fd59): Login.tsx, Signup.tsx, Dashboard.tsx all had `React.FormEvent` without React imported; ProtectedRoute.tsx had `React.ReactNode` without React imported. All four caused hard tsc failures.
Fix: TYPESCRIPT BUILD RULES section added to _systemPrompt.ts. Rule: never use React. namespace prefix for types. Always use named type imports: import { type FormEvent, type ReactNode } from 'react'.
Additional rules added to prompt: no @/ path aliases, React Router v6 syntax only (useNavigate not useHistory, Routes not Switch), every component must have a default export, noUnusedLocals/noUnusedParameters enforcement, dead imports not allowed.
Learned: 2026-03-22.

**Model selection: Sonnet 4.6 for generation, Haiku for extraction/classification**
Wrong assumption: 18-file React app generation requires Opus for quality. Learned 2026-03-20 but superseded.
Correct behaviour: Sonnet 4.6 handles structured tool_use generation of 18+ files reliably. Opus costs ~5× more for no measurable quality gain on this task.
Fix: generation/edit/chat use MODEL_GENERATION = 'claude-sonnet-4-6'. extract-brief uses MODEL_FAST = 'claude-haiku-4-5-20251001' — output is bounded JSON under 500 tokens, no complex reasoning needed.
Rule: use Haiku for any task with bounded output and a fixed JSON schema (extraction, classification, summarization). Use Sonnet for code generation, multi-step reasoning, and structured output where schema adherence is critical. Model constants live at the top of each file — one line to swap.
Estimated cost reduction: ~75% on overall API spend.
Learned: 2026-03-23.

**api/extract-brief.ts — called before OAuth, Haiku, skips short ideas**
POST /api/extract-brief takes { idea: string } and returns a structured AppBrief (name, description, target_user, features[], entities[], tone).
Skip condition: idea under 200 chars with no newlines → returns { skipped: true, idea } immediately, no API call.
On JSON parse failure → returns { error: 'extraction_failed', idea } so the caller can fall back to the raw idea. Never throws a 5xx.
Rate limit: 60/hr per IP. idea truncated to 5000 chars before API call.
Called before OAuth begins — after idea submit, before GitHub/Vercel OAuth steps.
Learned: 2026-03-23.

## Brief extraction frontend flow
- extract-brief called for ideas 200+ chars or multiline (handleSubmitIdea in NdevPanel)
- Short ideas skip extraction entirely — zero latency, set resolvedIdea = value.trim() and proceed
- Brief confirmation screen (stage='briefConfirm') shown before generation for long inputs
- Confirmation screen: Playfair Display heading, acid green (#8ab800) app name, DM Mono features list with green dots
- Two paths from confirmation: "Looks good, build it →" OR "Edit brief →" (editable textarea)
- resolvedIdea is the canonical idea string passed to the build pipeline (runGeneration, handleRegenerate, handleGitHubConnect)
- Extraction failure (network error or parse fail) always falls back to raw idea — never blocks the user
- isExtracting boolean drives button loading state: "Reading your idea…", disabled, opacity 0.7, "Extracting your brief…" status line below
- runGeneration(ideaToUse) is the internal function that calls callGenerateAPI — all entry points converge on this
Decided: 2026-03-23.

## Supabase Schema — SQL Run in Production

All statements below must be run in the Supabase SQL Editor.
Run each one and confirm success before proceeding to the next.

### 2026-03-22 — Supabase OAuth (supabase_token column on builds)

Run in Supabase SQL Editor:

```sql
ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_token TEXT DEFAULT NULL;
```

Confirm: `SELECT column_name FROM information_schema.columns WHERE table_name='builds' AND column_name='supabase_token';` — must return 1 row.

Also add these to Vercel environment variables before deploying:
- SUPABASE_OAUTH_CLIENT_ID — from app.supabase.com → Account → OAuth Apps
- SUPABASE_OAUTH_CLIENT_SECRET — same location
- VITE_SUPABASE_OAUTH_CLIENT_ID — same value as SUPABASE_OAUTH_CLIENT_ID (public)
- SOVEREIGN_SUPABASE_REF — the project ref for Sovereign's own Supabase instance
- SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN — personal access token from app.supabase.com → Account → Access Tokens
Register the redirect URI with Supabase OAuth App: https://sovereignapp.dev/auth/supabase/callback

### 2026-03-21 — magic_links table (create if missing)

Migration file: `supabase/migrations/magic_links.sql`

```sql
CREATE TABLE IF NOT EXISTS magic_links (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  token      TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);
ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;
-- No public policies — service role only
CREATE INDEX IF NOT EXISTS magic_links_token_idx ON magic_links(token);
CREATE INDEX IF NOT EXISTS magic_links_email_idx ON magic_links(email);
```

Confirm after: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'magic_links';`

### 2026-03-20 — Pre-dashboard dogfood audit

```sql
-- ── waitlist table — enable RLS ────────────────────────────────────────────
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "anon_insert_waitlist"
ON waitlist FOR INSERT
TO anon
WITH CHECK (true);

-- ── builds table — enable RLS (service role only, no anon policies) ────────
ALTER TABLE builds ENABLE ROW LEVEL SECURITY;
-- Service role key bypasses RLS automatically.
-- All builds access goes through api/ routes using service role key.

-- ── builds table — add missing columns ────────────────────────────────────
ALTER TABLE builds ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS next_steps JSONB DEFAULT NULL;

-- ── magic_links table — create if not exists ───────────────────────────────
CREATE TABLE IF NOT EXISTS magic_links (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  token      TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;
-- No public policies — service role only.

CREATE INDEX IF NOT EXISTS magic_links_token_idx ON magic_links(token);
CREATE INDEX IF NOT EXISTS magic_links_email_idx ON magic_links(email);
```

## Supabase provisioning
- Migration required: ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_token TEXT DEFAULT NULL
- Sovereign-hosted path uses SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN (service role key) — never expose client-side
- Own Supabase path uses token stored in builds.supabase_token — retrieved server-side only
- All generated app schemas get build_id (uuid not null) prepended to every CREATE TABLE
- Supabase OAuth redirect URL: https://sovereignapp.dev/auth/supabase/callback
- Test sovereign path first — it works without OAuth app credentials
- Test own path second — requires SUPABASE_OAUTH_CLIENT_ID and SUPABASE_OAUTH_CLIENT_SECRET in Vercel env vars

**Anthropic SDK 0.78 supports prompt caching natively — no @ts-expect-error needed**
Wrong assumption: cache_control on the system prompt required beta types or a TypeScript workaround.
Correct behaviour: SDK 0.78 types `system` as `string | Array<TextBlockParam>` and `TextBlockParam` includes `cache_control?: CacheControlEphemeral`. The array format compiles cleanly with no type errors.
Fix: `system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }]` — direct, no cast needed.
Learned: 2026-03-23.

**PRODUCT.md is required — it is the product memory equivalent of CLAUDE.md**
Wrong assumption: keeping all context in CLAUDE.md was sufficient for product decision-making.
Correct behaviour: CLAUDE.md is engineering memory (lessons, bugs, decisions); PRODUCT.md is product memory (feature status, architecture, manual steps, morning handoff).
Fix: PRODUCT.md created and must be updated at the end of every session alongside CLAUDE.md. Both files together are the full continuity layer.
Learned: 2026-03-23.

**Cron endpoints need CRON_SECRET header — Vercel cron does not add auth automatically**
Wrong assumption: Vercel cron handles authentication automatically for cron-triggered endpoints.
Correct behaviour: Vercel cron calls the endpoint as a plain GET request with no auth. Any caller can hit the endpoint unless you add your own secret header check.
Fix: check `req.headers['x-cron-secret'] === process.env.CRON_SECRET` before any logic. Add CRON_SECRET to Vercel env vars (generate with `openssl rand -hex 32`). The endpoint returns 401 if the header is missing or wrong.
Learned: 2026-03-23.

**Day-5 warning query window is a 24-hour band, not a point in time**
Wrong assumption: querying "created_at between 5 and 6 days ago" is too narrow — a cron that misses a day would skip those users entirely.
Correct behaviour: the 5-6 day window is correct for a daily cron because the cron runs every 24 hours. Each build can only fall in that window once. If the cron fails one day, builds shift to the day-7 expiry path without a warning — acceptable for v1.
Fix: no code change. Document this limitation: if reliability is required in production, add a `warning_sent_at` column to builds and query `warning_sent_at IS NULL` instead of relying on a time window.
Rule: document timing assumptions in cron endpoints.
Learned: 2026-03-23.

## Lessons Knowledge Base
- Every build failure (caught by the outer provisionErr catch in run-build.ts) is automatically inserted into the lessons table via recordFailureLesson()
- Lesson category is inferred from error message: 'generation' (typescript/files), 'oauth' (token/auth), 'database' (schema/table/supabase org), 'env_vars' (not configured), 'deployment' (vercel/github/deploy)
- solution field is empty on auto-captured failures — to be reviewed and filled in manually
- Seed data (42 lessons) extracted from CLAUDE.md founder notes: run api/migrations/seed-lessons.sql after create-lessons-table.sql
- Migration order: (1) create-lessons-table.sql, (2) seed-lessons.sql — run both in Supabase SQL Editor
- GET /api/lessons returns all lessons where solution != '', ordered by build_count desc
- Optional ?category= filter: generation, deployment, oauth, database, env_vars, ux, stack
- Response cached for 5 minutes (Cache-Control: public, max-age=300)
- RLS: public read (anon) for rows with solution != ''. All writes are service role only.
- lessons table: id, category, source, problem, solution, applied_automatically, build_count, created_at
- Future: increment build_count when a lesson pattern recurs; feed high-count lessons back into generation system prompt automatically
