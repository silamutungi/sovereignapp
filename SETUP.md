# Sovereign — Setup Guide

Step-by-step guide for getting Sovereign running from scratch or recovering from a broken state.

See `scripts/env-checklist.md` for the complete env var reference.

---

## Quick setup checklist

1. **Clone the repo**
   ```bash
   git clone git@github.com:silamutungi/sovereignapp.git
   cd sovereignapp
   npm install
   ```

2. **Copy env example and fill in values**
   ```bash
   cp .env.example .env.local
   # Edit .env.local — fill in every value
   # See scripts/env-checklist.md for where to get each one
   ```

3. **Check env vars are set**
   ```bash
   npx tsx scripts/check-env.ts
   # Must print 0 hard-fail variables missing before proceeding
   ```

4. **Run verify-schema.sql in Supabase SQL editor**
   - Open [Supabase dashboard](https://supabase.com/dashboard) → your project → SQL editor
   - Paste and run: `api/migrations/verify-schema.sql`
   - All rows should return `EXISTS`

5. **If any columns are MISSING: run ensure-schema.sql**
   - Paste and run: `api/migrations/ensure-schema.sql`
   - Re-run `verify-schema.sql` to confirm all rows return `EXISTS`

6. **Check lessons table is seeded**
   - Paste and run: `api/migrations/check-lessons.sql`
   - If `lesson_count = 0`: paste and run `api/migrations/seed-lessons.sql`

7. **Add all env vars to Vercel**
   - Vercel dashboard → Project → Settings → Environment Variables
   - Add every variable from `scripts/env-checklist.md`
   - For `CRON_SECRET`: generate with `openssl rand -hex 32`

8. **Deploy to Vercel**
   ```bash
   git commit --allow-empty -m 'chore: trigger deploy'
   git push
   ```

9. **Verify the deploy**
   ```bash
   # Env var health check (from Vercel logs or locally with correct .env):
   npx tsx scripts/check-env.ts

   # API health check:
   curl https://sovereignapp.dev/api/health

   # Lessons check:
   curl https://sovereignapp.dev/api/lessons | head -c 200
   ```

10. **Test with a fresh build on sovereignapp.dev**
    - Type an idea → click Build → complete the OAuth chain → verify confetti screen shows live URL

---

## Manual steps that cannot be automated

These require manual configuration in third-party dashboards:

### GitHub OAuth App
- Go to [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps → New OAuth App
- Application name: `Sovereign App`
- Homepage URL: `https://sovereignapp.dev`
- Callback URL: `https://sovereignapp.dev/api/auth/github/callback`
- Copy Client ID → `GITHUB_CLIENT_ID` and `VITE_GITHUB_CLIENT_ID`
- Generate Client Secret → `GITHUB_CLIENT_SECRET`

### Vercel OAuth Integration
- Go to [vercel.com/docs/integrations](https://vercel.com/docs/integrations) → Create Integration
- Redirect URL: `https://sovereignapp.dev/api/auth/vercel/callback`
- Copy `oac_*` client ID → `VERCEL_CLIENT_ID`
- Copy client secret → `VERCEL_CLIENT_SECRET`
- Copy integration slug → `VERCEL_INTEGRATION_SLUG`

### Supabase OAuth App
- Go to [app.supabase.com](https://app.supabase.com) → Account → OAuth Apps → Create App
- Redirect URI: `https://sovereignapp.dev/auth/supabase/callback`
- Copy client ID → `SUPABASE_OAUTH_CLIENT_ID` and `VITE_SUPABASE_OAUTH_CLIENT_ID`
- Copy client secret → `SUPABASE_OAUTH_CLIENT_SECRET`

### Cron Secret
- Run: `openssl rand -hex 32`
- Add the output as `CRON_SECRET` in Vercel env vars
- The cron job at `vercel.json` passes this automatically as `x-cron-secret` header

### Supabase SQL Migrations
Run these in order in the [Supabase SQL editor](https://supabase.com/dashboard):
1. `api/migrations/verify-schema.sql` — check what exists
2. `api/migrations/ensure-schema.sql` — add anything missing
3. `api/migrations/check-lessons.sql` — check lesson count
4. `api/migrations/seed-lessons.sql` — seed if count is 0

---

## How to verify everything is working

Run through this checklist after any deploy or when debugging:

- [ ] Landing page loads at `https://sovereignapp.dev`
- [ ] Idea input accepts text, placeholder cycles
- [ ] Short idea (<200 chars): submit goes straight to generation spinner
- [ ] Long idea (200+ chars): submit shows "Extracting your brief…" then brief confirmation screen
- [ ] Brief confirmation shows Playfair heading, acid green app name, feature list
- [ ] Generation SSE stream produces progress messages, then shows app preview (name, files, tier)
- [ ] "Try a different version" regenerates with visually distinct result
- [ ] Email capture saves (check Supabase → waitlist table)
- [ ] GitHub OAuth redirects to github.com/login/oauth/authorize correctly
- [ ] GitHub callback stores token and redirects to Vercel OAuth
- [ ] Vercel callback stores token and redirects to `/building`
- [ ] Build pipeline runs: repo created, files pushed, Vercel project created
- [ ] Deployment polls to READY, live URL captured
- [ ] Confetti screen shows live URL + repo link
- [ ] Welcome email arrives (check Resend dashboard for delivery)
- [ ] Magic link → dashboard shows the build with correct status
- [ ] Lessons API responds: `curl https://sovereignapp.dev/api/lessons`

---

## Troubleshooting

### `502` on any `/api/*` route
1. Check Vercel function logs
2. Run: `grep -rn "from '\." api/ --include="*.ts" | grep -v "\.js'"` — must return zero results (broken `.js` import = 502)
3. Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel — missing env vars produce identical 502s

### Build stuck on "Provisioning…" forever
- Check `SUPABASE_SERVICE_ROLE_KEY` in Vercel — corruption or wrong value causes silent 401s
- Verify `deleted_at` and `next_steps` columns exist on builds table (run `verify-schema.sql`)
- Check `api/build-status.ts` logs in Vercel for the actual error code

### Generation returns 504
- `api/generate.ts` must have `export const maxDuration = 300` and `vercel.json` must have `"functions": { "api/*.ts": { "maxDuration": 300 } }`
- Check both are present

### Supabase OAuth not working
- Verify `SUPABASE_OAUTH_CLIENT_ID`, `SUPABASE_OAUTH_CLIENT_SECRET`, `VITE_SUPABASE_OAUTH_CLIENT_ID` are set in Vercel
- Verify redirect URI `https://sovereignapp.dev/auth/supabase/callback` is registered in Supabase OAuth App settings
- After adding env vars, trigger a redeploy: `git commit --allow-empty -m 'chore: redeploy' && git push`

### Emails not sending
- Check `RESEND_API_KEY` is set in Vercel
- Check Resend dashboard for bounce/delivery errors
- Email features are optional — the build flow works without them

### Cron not running
- Verify `CRON_SECRET` is set in Vercel
- Check `vercel.json` has the cron entry for `/api/expire-builds`
- Test manually: `curl -H "x-cron-secret: <your-secret>" https://sovereignapp.dev/api/expire-builds`

---

## Key files reference

| File | Purpose |
|------|---------|
| `api/generate.ts` | SSE app generation — Sonnet 4.6, 300s timeout, prompt caching |
| `api/extract-brief.ts` | Brief extraction — Haiku, <3s, skips short ideas |
| `api/run-build.ts` | Full build pipeline — GitHub + Vercel + Supabase provisioning |
| `api/auth/github/callback.ts` | GitHub OAuth token exchange |
| `api/auth/vercel/callback.ts` | Vercel OAuth token exchange |
| `api/auth/supabase/callback.ts` | Supabase OAuth token exchange |
| `api/expire-builds.ts` | Daily cron — day 5 warning + day 7 soft delete |
| `api/lessons.ts` | GET /api/lessons — public knowledge base |
| `api/_systemPrompt.ts` | Generation system prompt — 15 Sovereign Standards |
| `api/migrations/ensure-schema.sql` | Idempotent migration — safe to run any time |
| `scripts/check-env.ts` | Live env var PRESENT/MISSING report |
| `scripts/env-checklist.md` | Definitive env var reference |
