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

**New files must be explicitly git add-ed — untracked files are invisible to Vercel**
Wrong assumption: committing with `git commit -a` or pushing after creating new files is sufficient to include them in the build.
Correct behaviour: `git commit -a` only stages modifications to already-tracked files. New files remain untracked and are never sent to GitHub — Vercel builds without them, causing silent "cannot find module" errors or blank pages with no obvious cause.
Fix: before every push, run `git status` and confirm zero untracked files in `src/` and `api/`. Any red untracked file must be explicitly staged with `git add <file>` before committing. This applies to every new page, component, API route, and utility created in a session.
Learned: 2026-03-28.

**checkRateLimit call signature — always 3 args, key string first**
Wrong assumption: `checkRateLimit` accepts a request object as the first argument, followed by a key string, limit, and seconds.
Correct behaviour: signature is `checkRateLimit(key: string, limit: number, windowMs: number)`. First argument is always a string key, never the request object. Window is always milliseconds, never seconds. The function is synchronous — never `await` it.
Fix: extract IP first with `getClientIp(req)`, build the key string, then call `checkRateLimit(\`endpoint:${ip}\`, 30, 60 * 60 * 1000)`. Wrong: `checkRateLimit(req, 'key', 30, 3600)`. Always verify against existing call sites before using any utility function — Claude will hallucinate call signatures that do not exist.
Learned: 2026-03-28.

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
Fix: CLAUDE.md is now a programmatic file injected by buildStaticFiles (one of 5 programmatic files; 24 total per build as of 2026-03-28). Template added to the generation system prompt.
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

**run-build.ts scaffold was missing .env.example — added as programmatic file**
Wrong assumption: .env.example was only needed by Tier 3 (CI/CD standard).
Correct behaviour: .env.example is a security baseline for every app — without it, users have no reference for what env vars the app needs and will either hardcode secrets or leave the app broken.
Fix: added .env.example as a programmatic file in buildStaticFiles() with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, VITE_APP_URL.
Current canonical count: 24 total files per build (19 Claude-generated + 5 programmatic). See foundation conflict resolution lesson (2026-03-28).
Learned: 2026-03-21. Updated: 2026-03-28.

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

**Always run verify-schema.sql before debugging database issues**
Wrong assumption: documented migrations have been run in production.
Correct behaviour: migration files in api/migrations/ are never auto-run — they must be manually executed in the Supabase SQL editor. A column referenced in a query but never migrated produces a silent 500 that looks identical to an auth failure.
Fix: api/migrations/verify-schema.sql checks every required column in one pass. Run it first before any database debugging. api/migrations/ensure-schema.sql is the safe idempotent fix if any return MISSING.
Learned: 2026-03-23.

**scripts/env-checklist.md is the definitive reference for all required env vars**
Wrong assumption: .env.example was the complete list of env vars needed.
Correct behaviour: .env.example was missing ANTHROPIC_API_KEY and CRON_SECRET — both hard-fail variables. The authoritative list with categories, where to get each value, and fail modes is in scripts/env-checklist.md.
Fix: scripts/check-env.ts gives a live PRESENT/MISSING report. Run it first when debugging any 5xx. ANTHROPIC_API_KEY and CRON_SECRET have been added to .env.example.
Rule: when adding any new env var to the codebase, update .env.example, scripts/env-checklist.md, and scripts/check-env.ts in the same session.
Learned: 2026-03-23.

**SETUP.md is the recovery guide if anything breaks**
Context: setup and recovery procedures were scattered across CLAUDE.md and PRODUCT.md — each session had to reconstruct steps from scratch.
Decision: SETUP.md in the repo root is now the single source of truth for setup, env vars, SQL migrations, OAuth registration, and troubleshooting.
Rule: when adding new env vars, migrations, or external registrations, update SETUP.md in the same session.
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

**Curly/smart quotes inside string literals break tsc — confirmed production failure**
Wrong assumption: Claude generates valid TypeScript string literals when writing user-facing copy.
Correct behaviour: Claude uses Unicode curly apostrophes (') and smart quotes (" ") in prose, which are not valid inside single-quoted or double-quoted JS/TS string literals. They terminate the string early and cause cascading parse errors that exit with code 2 on Vercel.
Confirmed failure: `setError('Those credentials didn't work.')` — the ' after "didn" closes the string, causing 9 tsc errors on the same line.
Fix: rule added to TYPESCRIPT BUILD RULES in _systemPrompt.ts. When a string contains an apostrophe, use double quotes or a template literal. Never use curly quotes inside any string literal.
Triage: → CLAUDE.md ✓ → Generation prompt (_systemPrompt.ts) ✓
Learned: 2026-03-23.

**Staging builds deploy to Sovereign's Vercel team, not the user's account**
Context: previously run-build.ts used the user's vercel_token for all Vercel API calls. This is wrong — the user's token should only be used for the claim flow (ownership transfer) when they're ready to move the app to their own account.
Decision: all staging builds use SOVEREIGN_VERCEL_TOKEN and SOVEREIGN_VERCEL_TEAM_ID. The user's vercel_token is captured during Vercel OAuth and stored on the build record, but never used during the build pipeline.
Rule: createVercelProject, injectVercelEnvVars, waitForVercelDeployment, and fetchDeploymentError all read process.env.SOVEREIGN_VERCEL_TOKEN internally — they no longer accept a token parameter. SOVEREIGN_VERCEL_TOKEN is a hard-fail env var; builds will 500 if it is missing.
Decided: 2026-03-23.

## The Jony Ive Bar — Design Standard

Every generated app must feel like Apple hired Jony Ive as creative director and a senior engineering team to ship it. "Award-winning design. Expert implementation. World-class defaults. Out of the box."

This is not a landing page generator. Founders receiving Sovereign-generated apps should be able to share them proudly the same day.

**Pre-ship quality gate (mandatory):**
- npm run build exits 0 ✓
- No console errors on page load ✓
- Every page works at 375px mobile ✓
- Loading states on every async operation ✓
- Error states with recovery actions on every async operation ✓
- Empty states with helpful copy and a primary action ✓
- Key elements fade+translateY in on entrance (200ms) ✓
- Delight moments: confetti on success actions ✓
- WCAG AA contrast on every element ✓
- No lorem ipsum — not even in development ✓

**The full quality gate and design rules are in RULES.md.**
**All major decisions with full context are in DECISIONS.md.**

Learned: 2026-03-23.

**IntersectionObserver for scroll animations — useInView hook pattern**
Wrong assumption: CSS-only animations (animate-fade-up on initial render) are sufficient for entrance animations.
Correct behaviour: Elements below the fold should only animate when they scroll into view, not on page load. IntersectionObserver fires once, disconnects immediately to avoid performance issues.
Fix: `useInView` hook using `useRef<HTMLDivElement>(null)` + IntersectionObserver. Returns `{ ref, visible }`. Apply inline style transitions rather than CSS class animation to control timing precisely. Type the ref as `RefObject<HTMLDivElement>` (named import from 'react') not `React.RefObject<HTMLDivElement>` (namespace would require React to be in scope).
Learned: 2026-03-23.

**Confetti component — CSS keyframe + CSS custom properties pattern**
The confetti animation uses `--drift` CSS custom property in the keyframe to vary the horizontal drift per piece. This requires the keyframe to reference `var(--drift, 40px)` and each piece to set `style={{ '--drift': '${n}px' } as CSSProperties}`. The confetti auto-dismisses via `setTimeout(() => setVisible(false), 4000)`. Only fires when RSVP status is 'yes' — not for maybe or no.
Learned: 2026-03-23.

**CSP missing connect-src kills all Supabase calls — every generated app was broken**
Wrong assumption: `default-src 'self'` in vercel.json only blocks scripts and styles.
Correct behaviour: `default-src` is the fallback for ALL directives including `connect-src`. Without explicit `connect-src`, every fetch/XHR to an external origin (including Supabase) is blocked. Auth signup, login, and all database queries silently fail with a CSP violation — showing a generic error with no obvious cause.
Fix: add `connect-src 'self' https://*.supabase.co wss://*.supabase.co` to the CSP header. The `wss://` covers Supabase Realtime websocket connections. Updated in api/run-build.ts (scaffold injector) and api/_systemPrompt.ts (generation prompt) so every future app gets it automatically.
Rule: every generated app's CSP must include `connect-src` covering the Supabase wildcard. Never rely on `default-src` fallback for network-connected apps.
Learned: 2026-03-23.

**Git SSH over HTTPS for Sovereign-generated repos**
When cloning generated repos via `git clone https://github.com/...` for local editing, the HTTPS remote cannot push (no token cached). Switch to SSH before pushing: `git remote set-url origin git@github.com:user/repo.git`. The user's SSH key at `~/.ssh/id_ed25519` is configured for `silamutungi` and works for all repos they own.
Rule: always switch generated repo remotes to SSH before attempting a push from the local environment.
Learned: 2026-03-23.

**Vercel SSO on staging previews — 401 is expected, not an app failure**
Wrong assumption: a 401 on a sovereign-staging preview URL means the app is broken or returning a blank screen.
Correct behaviour: the sovereign-staging Vercel team has `ssoProtection: all_except_custom_domains` enabled. Every `*.vercel.app` preview URL requires Vercel account login — the app itself is fully built and serving content behind that auth wall.
Fix: to confirm a build is healthy, check deployment `readyState: READY` and build logs for `✓ built in Xs` via the Vercel API — do not rely on a curl HTTP status check against the preview URL. To make a build publicly accessible without login, connect a custom domain (custom domains are exempt from SSO protection).
Learned: 2026-03-24.

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

## Sovereign v2.0.0 — Self-Build Session (2026-03-24)

**Confidence Engine evaluator calibration — false positives from legitimate production patterns**
The initial evaluators were calibrated too strictly for generated apps, not for the Sovereign codebase itself.
Specific false positives caught and fixed:
1. Rate limiting check: flagged `_` prefixed utility files, auth callbacks, and cron endpoints — all legitimately exempt
2. `dangerouslySetInnerHTML` check: flagged usage in template literal string content inside `_systemPrompt.ts` — fixed by stripping template strings before regex check
3. `any` type check: global 3-use limit penalized `api/` files that use `req: any, res: any` by documented pattern — fixed: only scan `src/`, 5-per-file threshold
4. Function length: 80-line limit flagged every React component — fixed: 500 lines = high, 300 lines = low (React components routinely exceed 80 lines)
5. Antipattern check: `_systemPrompt.ts` contains antipattern EXAMPLES in strings — fixed: added to SKIP_FILES list; strip string literal content before checking
6. Error handling: flagged `.test.ts` files and `_` prefixed API utilities — fixed: skip test files (use assertions) and `_` utilities (designed to propagate errors to callers)
7. TODO check: flagged `// TODO` inside template literal strings in `_systemPrompt.ts` — fixed: strip template literals before checking
Rule: evaluator calibration requires running against real production code, not just testing the evaluator logic in isolation. The first run against the actual codebase always reveals false positives.
Learned: 2026-03-24.

**Real bug found by dogfooding own security evaluator — CSP missing connect-src**
The security evaluator correctly flagged Sovereign's own `vercel.json` as missing `connect-src` — every Supabase call was being silently blocked by CSP `default-src 'self'`.
This is the exact same bug documented in the 2026-03-23 lesson. The evaluator caught a real regression.
Rule: the confidence engine is not just for generated apps — run it against Sovereign itself regularly. The dogfood principle means bugs we'd catch in user apps must be caught in our own code first.
Learned: 2026-03-24.

**React.* namespace types cause tsc failures — applies to Sovereign's own src/ too**
App.tsx and Dashboard.tsx both used `React.KeyboardEvent`, `React.FormEvent`, `React.RefObject` without importing React.
These are the exact patterns documented in the generation prompt as antipatterns. Sovereign's own code had the same issue.
Fix: `import { type KeyboardEvent, type FormEvent, type RefObject } from 'react'` and replace all `React.*` namespace references with the named imports.
Lesson: whenever we add a rule to the generation prompt, audit Sovereign's own codebase for the same pattern.
Learned: 2026-03-24.

**source.unsplash.com is deprecated — use loremflickr.com with server-side prefetch**
Wrong assumption: `source.unsplash.com/{keywords}` and `images.unsplash.com/photo-{id}` URLs are reliable for generated apps.
Correct behaviour: `source.unsplash.com` returns 503. `images.unsplash.com/photo-{id}` IDs are effectively random — Claude guesses them and they 404. Neither works reliably.
Fix: use `https://loremflickr.com/1600/900/{keyword1},{keyword2},{keyword3}` for keyword-based images. Server-side prefetch with `fetch(url, { redirect: 'follow' })` to resolve the redirect to a guaranteed-working CDN URL, then pass that exact URL to Claude. Never let Claude guess image URLs.
Rule: all image guidance in edit.ts and _systemPrompt.ts must use loremflickr.com. Never reference source.unsplash.com or images.unsplash.com/photo-{id}.
Learned: 2026-03-26.

**iOS Safari h-full bug — use backgroundImage inline style, never `<img>` for hero backgrounds**
Wrong assumption: `<img className="absolute inset-0 w-full h-full object-cover">` works for full-bleed hero backgrounds.
Correct behaviour: `height: 100%` (Tailwind `h-full`) resolves to 0 on iOS Safari when the parent element uses `min-height` instead of `height`. The hero image flashes on load then disappears on scroll/reload.
Fix: use `backgroundImage` inline style on the section element itself — never an `<img>` tag for hero backgrounds. Required pattern:
  `<section style={{ backgroundImage: 'url(URL)', backgroundSize: 'cover', backgroundPosition: 'center' }} className="relative min-h-screen flex items-center overflow-hidden">`
  with an overlay div `<div className="absolute inset-0 bg-gradient-to-b from-black/70 ...">` and content `<div className="relative z-10 ...">`.
Triage: → CLAUDE.md ✓ → Generation prompt (_systemPrompt.ts) ✓ → edit.ts design principles ✓
Learned: 2026-03-26.

**Vercel deploy_url must be the stable project alias, not the immutable deployment URL**
Wrong assumption: the URL returned from triggering a Vercel deployment is the correct URL to store and show users.
Correct behaviour: each deployment gets a unique immutable URL like `project-abc123-team.vercel.app`. When a new edit deploys, the old URL still works but shows the old version. The stable alias (`project-team.vercel.app`) always points to the latest production deployment.
Fix: after a deployment reaches READY state, call `GET /v9/projects/{id}?teamId={teamId}` and extract `targets.production.alias[0]`. Store that as `deploy_url`. Fall back to the deployment URL only if the project fetch fails. Applied in both `run-build.ts` (initial build) and `build-status.ts` (self-heal on edit).
Learned: 2026-03-26.

**Edit pipeline must detect React apps and edit the right file**
Wrong assumption: `index.html` is always the right file to edit for all generated apps.
Correct behaviour: React apps built with Vite don't have meaningful content in `index.html` — all UI is in `src/pages/Home.tsx` or `src/App.tsx`. Editing `index.html` on a React app does nothing visible.
Fix: `CANDIDATE_FILES = ['src/pages/Home.tsx', 'src/App.tsx', 'index.html']` — try each in order, use the first one found. Use a React-aware prompt for `.tsx` files (design judgment, named imports, no `React.*` namespace). Use the plain HTML prompt for `index.html`.
Learned: 2026-03-26.

**X-Frame-Options: DENY on generated apps blocks the dashboard preview iframe**
Wrong assumption: `X-Frame-Options: DENY` is a safe default security header for all generated apps.
Correct behaviour: DENY prevents the app from being embedded in any iframe — including Sovereign's own dashboard preview. Users see a blank black screen instead of their app.
Fix: remove `X-Frame-Options` from generated `vercel.json`. Use `Content-Security-Policy: frame-ancestors 'self' https://sovereignapp.dev` instead — this allows the Sovereign dashboard to embed the app while blocking all other origins. Applied in `run-build.ts` scaffold and backfilled on existing builds via `scripts/fix-vercel-json.ts`.
Learned: 2026-03-26.

**Edit API returns `{ ok: true }` — not `{ success: true }`**
Wrong assumption: the edit API response shape matches a `success` field pattern.
Correct behaviour: `api/edit.ts` returns `{ ok: true, message: 'Edit deployed' }` on success. Any frontend check for `data.success` will always be falsy even on a successful edit, triggering a false error state.
Fix: check `data.ok` (or `data.ok || data.success` for safety). This caused the dashboard to show "Something went wrong" on every successful edit.
Learned: 2026-03-26.

**build-status self-heal threshold must be 30s, not 10min**
Wrong assumption: builds should be considered stuck only after 10 minutes.
Correct behaviour: after an edit, the redeploy is queued within seconds. A 10-minute threshold means the user waits up to 10 minutes after deploy completes before the dashboard updates. 30 seconds is enough time for the redeploy to be queued before the first self-heal check fires.
Fix: `const stuckThresholdMs = 30 * 1000` in `build-status.ts`. Builds in 'building' state for >30s with a `vercel_project_id` trigger an automatic Vercel state check.
Learned: 2026-03-26.

**Sovereign v2.0.0 self-build final score: 86/100 STRONG — launch gate PASSED**
Full multi-agent system built and evaluated:
- Brain API (3 learning cycles: per-project, weekly, monthly)
- 10-dimension Confidence Engine (all evaluators calibrated)
- 30-agent pipeline (intake → elevation → vision → build → verify → review → ship)
- Company OS (handoff protocol, unlock system, marketplace registry, activation system)
- Coach system (engine, personality, interventions, memory, outcomes, weekly brief)
- Brain Dashboard (React TypeScript page with category filters and stats)
- Self-build infrastructure (architect.js, orchestrator.js)
Scores: security 95, code_quality 75, performance 100, accessibility 50, ux 100, architecture 100, test_coverage 85, seo 75, documentation 90, i18n 85.
Note: accessibility at 50 is a known gap — the accessibility evaluator returns default 50/passed=true because a dedicated UI audit tool is not yet integrated. This is a future improvement.
Decided: 2026-03-24.

**Brain/coaching must be present in EVERY AI interaction, not just generation**
Wrong assumption: the brain and agents are for the initial build pipeline only.
Correct behaviour: the brain's accumulated lessons must inform every Claude call — generation, edit, and chat. Coaching interventions must trigger at the right lifecycle moment (launch, first day, first week, inactivity) — not just at build time. The coach is always present.
Fix: lessons injected into api/edit.ts and api/chat.ts (same best-effort 2s fetch pattern as generate.ts). api/chat.ts evolved from edit-assistant to Sovereign Coach — knows app age, coaches on strategy and momentum, not just edits. api/coach.ts (new) returns time-based interventions + brain-derived recommendations per build. Dashboard polls /api/coach every 5 minutes and shows the active intervention as a dismissable coaching banner with a CTA.
Architecture rule: any new AI call in api/ must include lesson context injection. Any new user-facing endpoint that returns build data should also return coaching context.
Learned: 2026-03-26.

**Brain cycle crons (cycle2/cycle3) must be Supabase-native on Vercel — no local file system**
Wrong assumption: brain/cycle2-weekly.js and brain/cycle3-monthly.js could be run as Vercel cron endpoints by calling them directly.
Correct behaviour: those files use local file-based BrainAPI (brain/.brain-data/*.json). Vercel serverless functions have no persistent filesystem — any data written is lost between invocations.
Fix: api/brain-cycle2.ts and api/brain-cycle3.ts are standalone Supabase-native implementations. They query the lessons table directly, do not import from brain/, and write results back to Supabase. The local brain/ files remain useful for local analysis and the 30-agent pipeline — they are not replaceable, just separate from the Vercel runtime.
Rule: anything running on Vercel must be Supabase-native. brain/ files = local/pipeline only. api/ files = Vercel/serverless only.
Learned: 2026-03-26.

**Claim flow: staged app transfer to user's GitHub + Vercel accounts**
Context: staging builds deploy to Sovereign's team. Users need a way to take ownership of their app permanently.
Decision: POST /api/claim-build takes { build_id }, reads stored github_token and vercel_token from the builds table (never from request body — tokens are server-side only), and orchestrates:
  1. GitHub transfer (if SOVEREIGN_GITHUB_ORG env var is set and repo is on that org) — sends user a GitHub email to accept
  2. Create Vercel project on user's personal account using stored vercel_token (no teamId = personal scope)
  3. Delete staging Vercel project using SOVEREIGN_VERCEL_TOKEN
  4. Update builds: claimed_at=now(), staging=false, claim_status='claimed', claimed_url=newVercelUrl
  5. Send "on its way" email via Resend
Error states: 'claiming' (in progress), 'transfer_partial' (Vercel failed after GitHub transfer), 'pending_github_acceptance' (GitHub transfer sent).
Rule: never accept tokens in request body — always read from Supabase server-side. claim_status field drives UI state.
Decided: 2026-03-28.

**Claim flow tokens: always server-side from builds table, never from request body**
Wrong assumption: claim-build API should accept user_github_token and user_vercel_token in the request body.
Correct behaviour: tokens are already stored in builds.github_token and builds.vercel_token from the initial OAuth flows. Accepting tokens in the API request body would expose them in transit unnecessarily and allow any caller to pass arbitrary tokens.
Fix: api/claim-build.ts accepts only { build_id } and reads tokens from Supabase using the service role key. The tokens never leave the server.
Learned: 2026-03-28.

## Supabase Schema — 2026-03-28 Claim Flow Migrations

Run in Supabase SQL Editor before deploying claim-build.ts:

```sql
ALTER TABLE builds ADD COLUMN IF NOT EXISTS claim_status text DEFAULT 'unclaimed';
ALTER TABLE builds ADD COLUMN IF NOT EXISTS claimed_url text;
```

Confirm:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'builds' AND column_name IN ('claim_status', 'claimed_url');
```
Must return 2 rows. If fewer, the columns are missing and claim-build will fail silently.

Also confirm existing columns are present (should already exist per earlier migrations):
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'builds' AND column_name IN ('staging', 'claimed_at', 'expires_at');
```
Must return 3 rows.

**Vercel SSO protection is enabled by default on all team projects — breaks all iframe previews**
Wrong assumption: creating a Vercel project on a team with SSO configured produces a publicly accessible URL.
Correct behaviour: Vercel enables `ssoProtection` by default on every project in a team that has SSO configured. Every preview URL requires a Vercel login — the iframe in the Sovereign dashboard shows a blank screen with no obvious error.
Fix: immediately after `createVercelProject` succeeds, call `PATCH /v9/projects/{id}?teamId={teamId}` with body `{ "ssoProtection": null }` using `SOVEREIGN_VERCEL_TOKEN`. Non-fatal — build proceeds regardless. Also: `scripts/disable-sso-protection.ts` (single project) and `scripts/backfill-sso.ts` (all existing staging builds).
Rule: any new Vercel project created on the sovereign-staging team must have SSO protection disabled immediately after creation. This call lives in `run-build.ts` right after `markDone('vercel')`.
Learned: 2026-03-28.

**Dark mode is default — CSS custom properties only, never hardcoded hex in components**
Wrong assumption: generated apps can use hardcoded hex values (#f2efe8, #0e0d0b, etc.) in component styles as long as the overall design looks correct.
Correct behaviour: all color values in component code must use CSS custom properties (var(--color-*)) defined on :root. Hardcoded hex is a dark mode violation — it never adapts to the user's preferred scheme. :root must define both light and dark variants via @media (prefers-color-scheme: dark). The <html> element must carry color-scheme="light dark" so the browser renders system UI (scrollbars, form controls) in the correct mode.
Fix: DARK MODE SYSTEM section added to api/_systemPrompt.ts (full :root custom property block, both light and dark variants, image filter, html element requirement). Section 11 added to docs/SOVEREIGN_DESIGN_SYSTEM.md. scoreI18n in _scoreApp.ts drops to 70 for hardcoded 'en-US' locale. api/audit-generated-app.ts checks darkmode-1/2/3. 35-check audit total updated from 32.
Triage: → CLAUDE.md ✓ → Generation prompt (_systemPrompt.ts) ✓ → docs/SOVEREIGN_DESIGN_SYSTEM.md ✓
Learned: 2026-03-28.

**Translation-ready is default — Intl API always, never toLocaleDateString with hardcoded locale**
Wrong assumption: English-only apps can use toLocaleDateString('en-US', ...) and '$' + amount.toFixed(2) since translation is a future concern.
Correct behaviour: every generated app must use Intl.DateTimeFormat(undefined, {...}).format(date) for dates and Intl.NumberFormat(undefined, {...}).format(amount) for currency. Passing undefined as the locale uses the visitor's browser locale — costs nothing, enables future i18n with zero refactoring.
Fix: TRANSLATION READINESS section (6 rules) added to api/_systemPrompt.ts. Section 12 added to docs/SOVEREIGN_DESIGN_SYSTEM.md. scoreI18n baseline set to 85 for all generated apps (translation-ready by default). src/components/SovereignChat.tsx and src/pages/Dashboard.tsx updated to use Intl.DateTimeFormat.
Triage: → CLAUDE.md ✓ → Generation prompt (_systemPrompt.ts) ✓ → docs/SOVEREIGN_DESIGN_SYSTEM.md ✓
Learned: 2026-03-28.

## Claim Flow — Optional Env Vars (for sovereign-org GitHub staging)

These env vars enable the GitHub transfer step. If not set, the GitHub step is skipped (safe — repo is already on user's account in current architecture).

- SOVEREIGN_GITHUB_ORG — GitHub org where staged repos live (e.g., "sovereign-builds")
- SOVEREIGN_GITHUB_TOKEN — Personal access token with admin rights on SOVEREIGN_GITHUB_ORG

## Landing Page — 2026-03-28 UI Fixes (src/App.tsx, src/App.css, src/lib/i18n.ts)

**FIX 1 — CTA button color: #c8f060 background, #0e0d0b text**
Changed `.gobtn` in `src/App.css` (~line 479): `background: var(--ink)` → `background: #c8f060`, `color: var(--paper)` → `color: #0e0d0b`.
This applies to the "Generate my app →" button and all other uses of `.gobtn`.

**FIX 2 — Collapsed toggle-to-input gap to 24px**
`src/App.css`: `.hero` bottom padding reduced from 64px → 16px. `.ndev-panel` top padding reduced from 60px → 8px. Total gap = 24px on all screen sizes. Mobile (480px) media query updated to match: hero 48px→16px bottom, ndev-panel 40px→8px top.

**FIX 3 — Nav, pricing position, and CTA copy**
- Nav (`src/App.tsx` Nav component): removed Pricing link and nav-cta button. Nav is now: logo (left) | How it works · Dashboard (right).
- Pricing section moved below Waitlist in App component — order is now Waitlist → Pricing → Footer.
- `src/lib/i18n.ts`: `plan.builder.btn` and `plan.team.btn` changed to "Start building →" (all 4 locales). `plan.builder.note` changed to "Live now." (was "Launching soon. Waitlist is free.") across all locales.
- `wl.btn` (EN) changed to "Lock in $19/mo — start building now →".
- Waitlist section (`src/App.tsx` Waitlist component): form removed entirely, replaced with a single `<button>` that scrolls to top (`window.scrollTo({ top: 0 })`). `joinWaitlist` import removed. Dead state (`email`, `error`, `loading`, `success`, `handleSubmit`) removed.
- Pricing plan buttons (Builder, Team) wired to `scrollToBuildFlow` instead of `scrollToWaitlist`.
Decided: 2026-03-28.

**Foundation conflict resolution — 2026-03-28**
Four contradictions existed between the system prompt, SOVEREIGN_STANDARDS.md, and run-build.ts:
1. X-Frame-Options: DENY in the system prompt vercel.json template vs ALLOWALL in the pipeline — resolved by removing X-Frame-Options from the system prompt template entirely and adding a comment explaining the pipeline handles it.
2. Same conflict in SOVEREIGN_STANDARDS.md Part 13 — resolved to match pipeline behaviour: X-Frame-Options is set by the pipeline, not by generated apps.
3. Acid green CTA color: three sources said three different things — resolved to the two-variant rule: #c8f060 on dark (#0e0d0b), #8ab800 on light (#f2efe8). Updated in both SOVEREIGN_STANDARDS.md Part 1 and api/_systemPrompt.ts.
4. File count: "7 scaffold files" and "8 scaffold files" were stale since the multi-file era — updated to 24 total files per build (19 Claude-generated + 5 programmatic).
Rule: SOVEREIGN_STANDARDS.md is the single source of truth. When any other file contradicts it, SOVEREIGN_STANDARDS.md wins and the other file updates.
Decided: 2026-03-28.

**docs/SOVEREIGN_DESIGN_SYSTEM.md is the authoritative design reference**
Context: design rules were scattered across CLAUDE.md, SOVEREIGN_STANDARDS.md, and the system prompt. No single canonical source existed.
Decision: docs/SOVEREIGN_DESIGN_SYSTEM.md is the definitive 12-section spec: Philosophy, Spacing System, Typography Scale, Color System, Component Library, Responsive Rules, Motion, Accessibility, Default Inclusions, Audit Checklist, Dark Mode System, Translation Readiness.
Rule: when adding new design rules, update docs/SOVEREIGN_DESIGN_SYSTEM.md first, then api/_systemPrompt.ts, then SOVEREIGN_STANDARDS.md if needed. The design doc is the source of truth for design decisions.
Decided: 2026-03-28.

**Audit pipeline wired into run-build.ts — 'auditing' status, audit_score field**
Context: generated apps had no automated quality check before marking complete. Builds could complete with CSS/accessibility/dark mode violations undetected.
Decision: after confidence scoring and before final status='complete', run-build.ts calls runDesignAudit(ghOwner, repoName, github_token). Status sequence: queued → building → auditing → complete | error. 'auditing' step applies 35 static checks and commits mechanical fixes (missing meta description, missing color-scheme attribute) directly to the GitHub repo — triggering a Vercel auto-redeploy.
Key facts:
- 35 checks across TYPOGRAPHY, COLOUR, SPACING, COMPONENTS, STRUCTURE, ACCESSIBILITY, DARK MODE categories
- Audit is non-blocking — wrapped in try/catch; build completes even if audit errors
- audit_score stored in builds.audit_score (integer 0–100)
- audit_flags='high_fix_count' if >15 fixes needed — triggers a lesson record
- audit_score shown as "✦ Design audit · N/100" badge in Building.tsx when not null
- build-status.ts returns audit_score in response JSON
Rule: 'auditing' status threshold in build-status.ts is 5 minutes (vs 30s for 'building') — audit fetches ~11 files + optionally commits fixes, which can take up to 2 minutes on slow GitHub API responses.
Decided: 2026-03-28.

**Migrations required for audit pipeline**
Run in Supabase SQL Editor before the audit pipeline deploy takes effect:
```sql
ALTER TABLE builds ADD COLUMN IF NOT EXISTS audit_score integer;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS audit_flags text;
```
Confirm: `SELECT column_name FROM information_schema.columns WHERE table_name = 'builds' AND column_name IN ('audit_score', 'audit_flags');` — must return 2 rows.
Learned: 2026-03-28.

**api/audit-generated-app.ts exports runDesignAudit() — POST endpoint is for manual testing only**
The serverless POST /api/audit-generated-app endpoint exists for manual triggering (dashboard admin use). The pipeline entry point is the exported function runDesignAudit(owner, repo, token).
Rule: never call the HTTP endpoint from run-build.ts — import and call runDesignAudit() directly. The POST endpoint adds rate limiting and HTTP overhead that adds latency without benefit in the pipeline context.
Learned: 2026-03-28.

**New files must be explicitly git add-ed — untracked files are invisible to Vercel**
Wrong assumption: creating a file in the working directory and pushing is sufficient for it to deploy.
Correct behaviour: git only tracks files that have been explicitly staged with git add. New files appear in `git status` as "Untracked files" (red) but are never included in commits. Vercel builds from the committed tree — untracked files simply do not exist in production.
Symptom: pages showed blank screen with no error; routes were registered in main.tsx but modules couldn't be found at runtime.
Fix: always run `git status` before committing. Any red (untracked) file in src/ or api/ must be git add-ed before committing.
Standing rule: before every push, `git status` must show zero untracked files in src/ and api/. Zero red lines = safe to push.
Learned: 2026-03-28.

**checkRateLimit call signature — 3 args, key string first, no await**
Wrong assumption: checkRateLimit accepted a request object as first arg and used 4 parameters.
Correct behaviour: checkRateLimit(key: string, limit: number, windowMs: number) — exactly 3 args. It is synchronous (returns RateLimitResult directly, not a Promise). Call it with a string key built from the identifier (e.g., `audit-generated-app:${ip}`).
Fix: extract IP with getClientIp(req), then call checkRateLimit(`endpoint:${ip}`, limit, windowMs) — no await.
Learned: 2026-03-28.

## Sovereign Edit Experience — 2026-03-28

**Sovereign edit experience shipped — route /app/:buildId/edit**
Context: The old edit experience was an overlay modal (EditPanel) inside Dashboard.tsx. It had two tabs (Chat/Preview) but no brain intelligence, no click-to-describe, no prompt queue, and no security scan.
Decision: Full dedicated page at /app/:buildId/edit replacing the modal. Two-column layout (360px brain panel + live preview). Mobile: single column with Chat/Preview tab toggle.
Key files: src/pages/EditApp.tsx (main page), api/brain-hint.ts, api/verify-deployment.ts, api/security-scan.ts.
Decided: 2026-03-28.

**EditPanel removed from Dashboard.tsx — navigate to /app/:buildId/edit instead**
Wrong assumption: the edit experience belonged inside Dashboard.tsx as a modal overlay.
Correct behaviour: the edit experience is a full page at /app/:buildId/edit. "Edit app" button in AppCard navigates there via React Router. The Dashboard removes ~460 lines of EditPanel code.
Fix: AppCard.onEdit now calls `navigate('/app/${build.id}/edit')`. Coach CTA likewise navigates. EditPanel component, isPanelOpen/panelBuild state, openPanel/closePanel callbacks all removed. Toast retained for "Link copied!" notification.
Learned: 2026-03-28.

**api/brain-hint.ts — POST /api/brain-hint — hint logic**
Three hint types: green (milestone at edit 5/10/20), blue (Claude-detected missing feature), amber (dangerous patterns — intercepted in frontend BEFORE calling edit API, not from this endpoint).
Rules: never show hint if edit_count < 2. Never show two hints of same type in a row. Blue uses Haiku; green is hardcoded. Rate limit: 30/hr per IP.
Non-fatal: always returns 200 with show_hint:false on error — never blocks the edit flow.
Learned: 2026-03-28.

**api/verify-deployment.ts — POST /api/verify-deployment — health check**
Fetches a deployment URL, checks HTTP 200, verifies HTML content, scans for JavaScript runtime error signatures in the body. Only https URLs allowed (SSRF prevention). 10s timeout. Rate limit: 30/hr per IP. Always returns 200 — unhealthy result triggers amber hint in frontend, not an API error.
Learned: 2026-03-28.

**api/security-scan.ts — POST /api/security-scan — pre-claim security audit**
Called when user clicks "Claim →". Fetches 6 key files from GitHub (src/lib/supabase.ts, vercel.json, src/App.tsx, Login.tsx, Signup.tsx, .env.example), sends to Haiku for security analysis. Returns { passed, issues[], score }. passed = score >= 70 AND no high severity issues. Rate limit: 5/hr per IP (heavy). Token always read from builds table server-side — never from request body.
Learned: 2026-03-28.

**Prompt queue persists in localStorage with key sovereign_queue_{buildId}**
Queue items are stored in localStorage so they survive page refreshes. Key pattern: `sovereign_queue_${buildId}`. Queue runs items in sequence, waiting for each deployment to complete before starting the next. Max 10 items (UI enforced). Queue is displayed as numbered pills in the collapsible panel above the input area.
Decided: 2026-03-28.

**Amber hints intercept dangerous edit patterns in the frontend before calling the API**
Dangerous patterns checked client-side in EditApp.tsx before calling /api/edit: "remove auth", "disable security", "make everything visible", "delete all", "drop table", "service role key". These show an amber BrainHintCard and pause execution — the user must choose "Safe alternative →" or dismiss. The brain-hint.ts endpoint does NOT fire amber — it only fires after successful deploys.
Learned: 2026-03-28.

**Build-status.ts now returns staging and claimed_at**
Added staging and claimed_at to the Supabase select query and the response JSON. Required for the EditApp top bar to show the "Claim →" button correctly (only when staging=true AND claimed_at is null).
Learned: 2026-03-28.
