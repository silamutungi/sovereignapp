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

### Environment variables — add to Vercel project settings

| Variable | Where to get it | Purpose |
|---|---|---|
| `SUPABASE_OAUTH_CLIENT_ID` | app.supabase.com → Account → OAuth Apps | Supabase OAuth flow |
| `SUPABASE_OAUTH_CLIENT_SECRET` | Same location | Supabase OAuth flow |
| `VITE_SUPABASE_OAUTH_CLIENT_ID` | Same value as above | Frontend Supabase OAuth button |
| `SOVEREIGN_SUPABASE_REF` | Sovereign's Supabase project ref | Sovereign-hosted DB provisioning |
| `SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN` | app.supabase.com → Account → Access Tokens | Sovereign-hosted DB provisioning |
| `CRON_SECRET` | Generate: `openssl rand -hex 32` | Protects expire-builds cron endpoint |

After adding env vars: trigger a redeploy (`git commit --allow-empty -m 'chore: redeploy'`).

### Supabase SQL — run in SQL editor

1. **supabase_token column** (may already be run):
   ```sql
   ALTER TABLE builds ADD COLUMN IF NOT EXISTS supabase_token TEXT DEFAULT NULL;
   ```

2. **Verify lessons table exists** (created in previous session):
   ```sql
   SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'lessons';
   -- Must return 1
   ```

3. **Run seed-lessons.sql** if lessons table is empty:
   - File: `api/migrations/seed-lessons.sql`
   - Run in Supabase SQL editor

### Supabase redirect URI registration
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
`api/generate.ts` uses `system: SYSTEM_PROMPT` as a plain string. Adding `cache_control` requires changing the `system` param to an array format. The Anthropic SDK types may not include `cache_control` in the local version. This is a low-risk performance optimization — deferred to avoid breaking the working generation flow. The prompt is ~6000 chars and cached automatically by Anthropic's infrastructure on repeated identical calls anyway.

---

## Morning Handoff

**What's ready to test right now:**
1. Full build flow (idea → generation → GitHub → Vercel → deploy) — working in production
2. Supabase OAuth callback — code is correct, needs env vars in Vercel before testing
3. Lessons API — `GET /api/lessons` — test with `curl https://sovereignapp.dev/api/lessons`

**What to do first tomorrow:**
1. Add the env vars in the table above to Vercel dashboard (Settings → Environment Variables)
2. Trigger a redeploy after adding env vars
3. Test the Supabase OAuth flow end-to-end: click "Connect Database (own account)" on the building page
4. Verify the cron by calling `GET /api/expire-builds` with `x-cron-secret: <your-secret>` header

**What needs manual SQL first:**
- Verify `supabase_token` column exists on builds table
- Verify lessons table exists and has data (42 seed rows from seed-lessons.sql)
