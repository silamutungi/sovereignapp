# Sovereign App — Product State

Last updated: 2026-03-23 (autonomous session)

---

## What Sovereign Is

Sovereign is a self-hosted AI dev environment bootstrapper. Tagline: "Build without permission."

Non-developers describe an app idea → Sovereign generates a complete multi-file React/TS/Tailwind app → connects GitHub + Vercel via OAuth → deploys it live → the user owns the code, the repo, the domain.

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Landing page | ✅ Live | Two-door design: ndev (idea people) + dev (CLI) toggle |
| Brief extraction | ✅ Live | `api/extract-brief.ts` + wired into `src/App.tsx` |
| Multi-file app generation (18 files) | ✅ Live | `api/generate.ts` SSE streaming, Sonnet 4.6 |
| App preview (3 versions) | ✅ Live | Try 3 different visual directions before committing |
| GitHub OAuth | ✅ Live | `api/auth/github/callback.ts` |
| Vercel OAuth | ✅ Live | `api/auth/vercel/callback.ts` |
| Supabase OAuth | ✅ Code complete | Callback wired. Needs env vars in Vercel (see Manual Steps) |
| Supabase provisioning (own account) | ✅ Code complete | Run-build handles both own-account and sovereign-hosted paths |
| Supabase provisioning (sovereign-hosted) | ✅ Code complete | Needs SOVEREIGN_SUPABASE_REF + SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN |
| GitHub repo creation | ✅ Live | Creates repo, pushes 19-file scaffold |
| Vercel project creation + auto-deploy | ✅ Live | Polls to READY, captures live URL |
| Welcome email | ✅ Live | `api/send-welcome.ts` via Resend |
| Magic link auth | ✅ Live | `api/auth/magic-link.ts` + `api/auth/verify-token.ts` |
| Dashboard | ✅ Live | Shows all builds, live URLs, repos |
| Build status polling | ✅ Live | `api/build-status.ts` |
| Lessons knowledge base | ✅ Live | `api/lessons.ts` — 42 seed lessons from CLAUDE.md |
| 7-day expiry system | ✅ Code complete (this session) | `api/expire-builds.ts` cron — needs CRON_SECRET in Vercel |
| Sovereign Standards v15 | ✅ Already in codebase | Resilience & Recovery standard present in `_systemPrompt.ts` |
| Prompt caching | 🔲 Not built | Anthropic SDK types may need `@ts-expect-error` — see Priority 8 notes |
| Stripe billing | 🔲 Not built | Phase 3 item |
| npx sovereign-app@latest CLI | 🔲 Not built | Phase 4 item |
| Figma import | 🔲 Not built | Phase 4 item |

---

## Architecture

```
User types idea
  → /api/extract-brief (if >200 chars) → brief confirmation screen
  → /api/generate (SSE) → multi-file spec preview
  → User confirms → email capture
  → /api/start-build → creates builds record → redirect to GitHub OAuth
  → /api/auth/github/callback → captures token → redirect to Vercel OAuth
  → /api/auth/vercel/callback → captures token → redirect to Supabase OAuth (optional)
  → /api/auth/supabase/callback → stores token → redirect to /building
  → /api/run-build → GitHub repo → Vercel project → Supabase provisioning → file push → poll READY
  → Deploy URL live → welcome email → /dashboard
```

---

## Current Flow: Brief Extraction

Short ideas (<200 chars, no newlines): skip extraction, call generate directly.
Long/multiline ideas: call `/api/extract-brief` → show `briefConfirm` screen with:
- Playfair Display heading "Here's what we're building."
- Acid green (#8ab800) app name
- DM Mono features list with green dots
- "Looks good, build it →" and "Edit brief →" buttons

Status: **fully wired** as of previous session. `handleSubmitIdea` in `src/App.tsx` handles both paths.

---

## Build First, Claim Later

### Current flow
Users see the generated app preview (files list, color swatch, tier badge) before any OAuth. OAuth only happens when they click "Build this app". This is already "build first" in the sense that generation is free and instant.

### Spec for future improvement
To show a live rendered preview (not just file names) before signup, we would need:
1. An in-browser preview renderer using an iframe with a blob URL (security: sandboxed)
2. State preservation across the full OAuth chain (already handled via buildId in state params)
3. The preview iframe would use the generated HTML/CSS rendered client-side

**Risk**: Live preview rendering requires injecting multi-file app content into an iframe, which has CSP implications and could expose the generated code before the user commits to building. The current file-list preview is intentionally lightweight.

**Decision**: Current flow is adequate. The "aha moment" is seeing their app name, tagline, color, and files generated in real time. Full live preview is a Phase 2 enhancement.

---

## 7-Day Expiry System

Built in this session. See `api/expire-builds.ts`.

Flow:
- Day 5: send warning email "Your app expires in 2 days — claim it to keep it live"
- Day 7: set `deleted_at`, send "Your app has expired — rebuild it here" email with `?idea=` link back to sovereignapp.dev
- Cron runs daily at 09:00 UTC via Vercel cron
- Protected by `CRON_SECRET` header check

See vercel.json for cron schedule entry.

---

## Manual Steps Needed

> Scripts created 2026-03-23. Awaiting manual execution. See `SETUP.md` for the full recovery guide.

### Step 1 — Run verify-schema.sql in Supabase SQL editor
File: `api/migrations/verify-schema.sql`
Purpose: Check whether all required columns exist on the builds table.
If any return MISSING → run `api/migrations/ensure-schema.sql` (idempotent, safe to run any time).

### Step 2 — Seed lessons table if empty
File: `api/migrations/check-lessons.sql` → if count = 0, run `api/migrations/seed-lessons.sql`

### Step 3 — Add env vars to Vercel

Run `npx tsx scripts/check-env.ts` for live PRESENT/MISSING status.
See `scripts/env-checklist.md` for the complete reference.

**Local .env status (verified 2026-03-23):** 12/19 present, 4 hard-fail missing, 3 optional missing.

`VITE_SUPABASE_ANON_KEY` — found in `.env.local`, added to `.env`. ✅

Missing vars (not yet in Vercel):

| Variable | Where to get it | Purpose |
|---|---|---|
| `SUPABASE_OAUTH_CLIENT_ID` | app.supabase.com → Account → OAuth Apps | Supabase OAuth flow |
| `SUPABASE_OAUTH_CLIENT_SECRET` | Same location | Supabase OAuth flow |
| `VITE_SUPABASE_OAUTH_CLIENT_ID` | Same value as above | Frontend Supabase OAuth button |
| `SOVEREIGN_SUPABASE_REF` | Sovereign's Supabase project ref | Sovereign-hosted DB provisioning |
| `SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN` | app.supabase.com → Account → Access Tokens | Sovereign-hosted DB provisioning |
| `CRON_SECRET` | Generate: `openssl rand -hex 32` | Protects expire-builds cron endpoint |

After adding env vars: trigger a redeploy (`git commit --allow-empty -m 'chore: redeploy' && git push`).

### Schema status (verified 2026-03-23 via Supabase REST API probe)

| Column | Status |
|--------|--------|
| `supabase_token` | ✅ EXISTS |
| `deleted_at` | ✅ EXISTS |
| `next_steps` | ✅ EXISTS |
| `staging` | ❌ MISSING |
| `expires_at` | ❌ MISSING |
| `claimed_at` | ❌ MISSING |
| `supabase_project_ref` | ❌ MISSING |

**Run this in the [Supabase SQL editor](https://supabase.com/dashboard/project/gudiuktjzynkjvtqmuvi/sql/new):**
```sql
ALTER TABLE builds ADD COLUMN IF NOT EXISTS staging BOOLEAN DEFAULT true;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days');
ALTER TABLE builds ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_project_ref TEXT DEFAULT NULL;
```
Cannot be automated — requires Supabase Management API token (not in env files). After running, re-verify with `api/migrations/verify-schema.sql`.

### Step 4 — Register Supabase redirect URI
Register this URI in the Supabase OAuth App settings:
`https://sovereignapp.dev/auth/supabase/callback`

---

## Session Notes — 2026-03-23

### What was assessed

**Priority 1 — Supabase OAuth loop**
Code review complete. `api/auth/supabase/callback.ts` is well-structured:
- Rate limited (20/15min per IP) ✓
- Handles OAuth denied error → redirects back with error param ✓
- Token exchange uses correct Supabase OAuth endpoint ✓
- Redacts token from logs ✓
- PATCH uses `Prefer: return=representation` to confirm row was updated ✓
- Empty array check guards against buildId-not-found ✓
- All error paths redirect instead of stranding user on a raw error page ✓
- All env vars (`SUPABASE_OAUTH_CLIENT_ID`, `SUPABASE_OAUTH_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are checked before use ✓

No code bugs found. Blockers are purely env vars (documented above).

**Priority 2 — Brief extraction**
Already fully wired. `handleSubmitIdea` in `src/App.tsx` (line 357) handles short/long idea branching, calls `/api/extract-brief`, shows `briefConfirm` stage with Playfair heading, acid green name, DM Mono features list, "Looks good, build it →" and "Edit brief →" buttons. Spec matches exactly.

**Priority 3 — Build first, claim later**
Current flow already shows generated app (name, color, files, tier, standards) before OAuth. Full live preview (rendered iframe) is a larger architectural change with CSP risk. Spec documented above. Implementation deferred — current UX already achieves the goal.

**Priority 4 — Landing page redesign**
Current landing page already has the two-door design (ndev + dev toggle), Playfair headings, DM Mono body, paper background, acid green CTAs. No redesign needed — the spec is already implemented.

**Priority 5 — 7-day expiry**
Built: `api/expire-builds.ts`, cron in `vercel.json`. See above.

**Priority 6 — Lessons knowledge base**
Already exists: `api/lessons.ts`. Correct implementation — queries lessons WHERE solution != '', ordered by build_count desc, optional category filter, 5-minute cache, 60/hr rate limit.

**Priority 7 — Sovereign Standards in generation**
Standard 15 (Resilience & Recovery) is already present in `api/_systemPrompt.ts` (line 351). All 14+ standards are present. All required expert names (Don Norman, Steve Krug, Rosenfeld, Jeff Patton, Marty Cagan, Sondra Orozco, David Allen, Seth Godin, Gary Vee, Neil Patel, WCAG, OWASP, NNGroup, iOS HIG) are referenced.

**Priority 8 — Prompt caching**
Completed. `api/generate.ts` now uses `system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }]`. SDK 0.78 types supported this natively — no TypeScript workaround needed. Build passes clean. Reduces input token costs ~90% on repeated generation calls since the ~6000-token system prompt is cached by Anthropic for ~5 minutes.

---

## Documentation

| File | Purpose |
|------|---------|
| `SETUP.md` | Step-by-step recovery guide — from scratch or broken state |
| `scripts/env-checklist.md` | Definitive env var reference — where to get each value |
| `scripts/check-env.ts` | Live PRESENT/MISSING env var report: `npx tsx scripts/check-env.ts` |
| `api/migrations/verify-schema.sql` | Check all required DB columns exist |
| `api/migrations/ensure-schema.sql` | Idempotent migration — add any missing columns |
| `api/migrations/check-lessons.sql` | Check lessons table row count |
| `api/migrations/seed-lessons.sql` | Seed 42 lessons from CLAUDE.md founder notes |

---

## Morning Handoff

**What's ready to test right now:**
1. Full build flow (idea → generation → GitHub → Vercel → deploy) — working in production
2. Supabase OAuth callback — code is correct, needs env vars in Vercel before testing
3. Lessons API — `GET /api/lessons` — test with `curl https://sovereignapp.dev/api/lessons`

**What to do first tomorrow — in order:**

1. `npx tsx scripts/check-env.ts` — see which vars are missing
2. Run `api/migrations/verify-schema.sql` in Supabase SQL editor — confirm all columns exist
3. If any MISSING: run `api/migrations/ensure-schema.sql`
4. Run `api/migrations/check-lessons.sql` — if count = 0, run `api/migrations/seed-lessons.sql`
5. Add missing env vars to Vercel (see `scripts/env-checklist.md`)
6. Redeploy: `git commit --allow-empty -m 'chore: redeploy' && git push`
7. Test Supabase OAuth: click "Connect Database (own account)" on building page
8. Test cron: `curl -H "x-cron-secret: <your-value>" https://sovereignapp.dev/api/expire-builds`

**Reference files created this session:**
- `SETUP.md` — full recovery guide
- `scripts/env-checklist.md` — every env var, where to get it
- `scripts/check-env.ts` — live PRESENT/MISSING script
- `api/migrations/verify-schema.sql` — check DB column status
- `api/migrations/ensure-schema.sql` — safe idempotent migration
- `api/migrations/check-lessons.sql` — check lessons row count
