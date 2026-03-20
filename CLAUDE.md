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

Every generated app is classified as SIMPLE, STANDARD, or COMPLEX based on the idea input. This determines which of the 14 expert standards are activated. Tier 1 (design, accessibility, SEO, performance, content, legal) applies to every app. Tier 2 (security, analytics, onboarding, email, i18n) activates for apps with user accounts or public products. Tier 3 (rate limiting, data backup, CI/CD) activates for complex multi-user or financial apps. The business intelligence layer (monitoring, domain readiness, referral hooks, audit log, billing) activates based on app context. Every app also gets a nextSteps array of 3 tailored recommendations returned in the JSON response — these are rendered as chips in the dashboard.

## Hard-Won Lessons

STANDING RULE: Every time a bug is fixed, a wrong assumption is corrected, or an API behaves differently than expected — add it here immediately in the same session. Do not wait. The lesson is most accurate right after the fix. Format: bold title, what went wrong, what the fix was, date learned.

If Claude Code is about to do something and there is a relevant lesson here that contradicts it — stop, follow the lesson, do not repeat the mistake.

### Deployment & Build

**nodeVersion is not a valid Vercel project creation field**
Wrong assumption: nodeVersion could be passed in the POST /v9/projects payload to control Node version.
Correct behaviour: Vercel rejects this with 400 — should NOT have additional property nodeVersion.
Fix: set Node version via engines field in the generated package.json instead: { engines: { node: '20.x' } }. Never pass nodeVersion in the project creation payload.
Learned: 2026-03-20.

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

**Lessons flow to four destinations, not just one**
When a bug is fixed or decision made, triage it: (1) CLAUDE.md — always, for Sovereign's own builds; (2) Generation prompt — if every generated app is affected; (3) Generated app CLAUDE.md template — if users maintaining their app would benefit; (4) SECURITY.md — if it is a security pattern. One lesson can go to all four destinations.
Decided: 2026-03-20.
