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
  → /api/run-build → GitHub repo → Vercel project (sovereign staging team) → Supabase → file push → poll READY
  → Deploy URL live → welcome email → /dashboard
```

---

## Staging Architecture (as of 2026-03-23)

### Vercel — Sovereign staging team
All generated apps deploy to **Sovereign's own Vercel team**, not the user's account.

| What | Where |
|------|-------|
| GitHub repos | User's own GitHub account (via `github_token`) |
| Vercel projects | Sovereign's staging Vercel team (via `SOVEREIGN_VERCEL_TOKEN`) |
| Supabase DB | Sovereign's Supabase instance (sovereign or sovereign_temporary mode) |

**Why:** Creating a Vercel project in the user's account during the build pipeline is unreliable — the user's OAuth token may have insufficient scope or the API call fails in ways we can't control. Sovereign's token always works.

**Claim flow (future):** When a user claims their app, Sovereign transfers the Vercel project to their account using their stored `vercel_token`. This is the correct moment to use their OAuth token.

### Token lifecycle
| Token | Captured | Used during build | Used during claim |
|-------|----------|-------------------|-------------------|
| `github_token` | GitHub OAuth | ✅ Creates repo, pushes files | — |
| `vercel_token` | Vercel OAuth | ❌ Not used | ✅ Transfer ownership |
| `supabase_token` | Supabase OAuth | ❌ Not used (deferred) | ✅ Migrate DB |

### Required env vars
- `SOVEREIGN_VERCEL_TOKEN` — hard fail if missing, all staging deploys broken
- `SOVEREIGN_VERCEL_TEAM_ID` — hard fail if missing, team-scoped API calls fail

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

## Manual Steps — Completed 2026-03-23

> All setup steps complete. See `SETUP.md` for the full recovery guide.

### Step 1 — Run verify-schema.sql in Supabase SQL editor
File: `api/migrations/verify-schema.sql`
Purpose: Check whether all required columns exist on the builds table.
If any return MISSING → run `api/migrations/ensure-schema.sql` (idempotent, safe to run any time).

### Step 2 — Seed lessons table if empty
File: `api/migrations/check-lessons.sql` → if count = 0, run `api/migrations/seed-lessons.sql`

### Step 3 — Add env vars to Vercel ✅ Complete

All hard-fail vars set via `scripts/set-vercel-env.ts` on 2026-03-23.
Run `npx tsx scripts/check-env.ts` for live status (currently 16/19 present, 0 hard-fail missing).

Optional vars still missing (sovereign-hosted DB path disabled until set):
- `SOVEREIGN_SUPABASE_REF`
- `SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN`
- `SUPABASE_ORG_ID`

### Schema status ✅ Complete (verified 2026-03-23)

| Column | Status |
|--------|--------|
| `supabase_token` | ✅ EXISTS |
| `deleted_at` | ✅ EXISTS |
| `next_steps` | ✅ EXISTS |
| `staging` | ✅ EXISTS |
| `expires_at` | ✅ EXISTS |
| `claimed_at` | ✅ EXISTS |
| `supabase_project_ref` | ✅ EXISTS |

### Step 4 — Register Supabase redirect URI
Register this URI in the Supabase OAuth App settings:
`https://sovereignapp.dev/auth/supabase/callback`

> ⚠️ Still needs manual registration at app.supabase.com → Account → OAuth Apps → Sovereign → Redirect URIs

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
| `scripts/set-vercel-env.ts` | Set all Vercel env vars — needs fresh VERCEL_ACCESS_TOKEN |
| `scripts/create-lessons-table.ts` | Create lessons table + seed via Supabase management API |

---

## Setup Session — 2026-03-23

### What was completed programmatically

| Task | Status | Notes |
|------|--------|-------|
| CRON_SECRET generated | ✅ Done | Added to .env (64 char hex) |
| VITE_SUPABASE_ANON_KEY | ✅ Done | Found in .env.local, added to .env |
| Vercel env vars via API | ✅ Done | 5 vars set via scripts/set-vercel-env.ts (2026-03-23) |
| Supabase schema migration | ✅ Done | 4 columns added via SQL editor (2026-03-23) |
| Lessons table creation | ✅ Done | Created via Management API (2026-03-23) |
| Lessons seeding | ✅ Done | 45 lessons seeded via scripts/create-lessons-table.ts |

### Env var status (verified via check-env.ts — 2026-03-23)
- Present: 16/19
- Missing hard-fail: 0
- Missing optional: 3 (SOVEREIGN_SUPABASE_REF, SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN, SUPABASE_ORG_ID)

### Schema status (verified via Supabase REST API — 2026-03-23)
| Column | Status |
|--------|--------|
| `supabase_token` | ✅ EXISTS |
| `deleted_at` | ✅ EXISTS |
| `next_steps` | ✅ EXISTS |
| `staging` | ✅ EXISTS |
| `expires_at` | ✅ EXISTS |
| `claimed_at` | ✅ EXISTS |
| `supabase_project_ref` | ✅ EXISTS |
| `lessons` table | ✅ EXISTS (45 rows) |

### Automation scripts created (run these with fresh tokens)

```bash
# Set Vercel env vars (needs fresh token from vercel.com/account/tokens):
VERCEL_ACCESS_TOKEN=<new-token> npx tsx scripts/set-vercel-env.ts

# Create lessons table + seed (needs token from app.supabase.com/account/tokens):
SUPABASE_ACCESS_TOKEN=<token> npx tsx scripts/create-lessons-table.ts
```

---

## Morning Handoff

**Two-token unblock:** Generate two tokens in ~2 minutes and everything finishes programmatically:
1. **Vercel personal access token** — [vercel.com/account/tokens](https://vercel.com/account/tokens) → Full Access → Copy
2. **Supabase personal access token** — [app.supabase.com/account/tokens](https://app.supabase.com/account/tokens) → Generate → Copy

Then run:
```bash
VERCEL_ACCESS_TOKEN=<vercel-token> npx tsx scripts/set-vercel-env.ts

SUPABASE_ACCESS_TOKEN=<supabase-token> npx tsx scripts/create-lessons-table.ts

# Paste these 4 lines in Supabase SQL editor:
# https://supabase.com/dashboard/project/gudiuktjzynkjvtqmuvi/sql/new
ALTER TABLE builds ADD COLUMN IF NOT EXISTS staging BOOLEAN DEFAULT true;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days');
ALTER TABLE builds ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_project_ref TEXT DEFAULT NULL;

# Then get SUPABASE_OAUTH_CLIENT_SECRET from app.supabase.com → Account → OAuth Apps → Sovereign
# and set it in Vercel manually (or add to .env and re-run set-vercel-env.ts)

# Trigger redeploy:
git commit --allow-empty -m 'chore: redeploy with env vars' && git push
```

**What will still need manual action after scripts run:**
- `SUPABASE_OAUTH_CLIENT_SECRET` — only available in Supabase OAuth App dashboard (not derivable)
- Register redirect URI `https://sovereignapp.dev/auth/supabase/callback` in Supabase OAuth App settings

**What's working in production right now:**
- Full build flow: idea → generate → GitHub OAuth → Vercel OAuth → deploy → live URL
- Brief extraction (short ideas skip, long ideas show confirmation screen)
- Dashboard, magic link auth, lessons API
- 7-day expiry cron (configured, but CRON_SECRET not yet in Vercel)
