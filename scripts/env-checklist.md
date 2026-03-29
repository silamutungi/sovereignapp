# Sovereign — Environment Variables Checklist

This is the **definitive reference** for every environment variable Sovereign depends on.
Run `npx tsx scripts/check-env.ts` to get a live PRESENT/MISSING report.

Last updated: 2026-03-23

---

## Anthropic

| Var | Purpose | Where to get it | Fail mode |
|-----|---------|-----------------|-----------|
| `ANTHROPIC_API_KEY` | Anthropic API — app generation, chat, editing, brief extraction | [console.anthropic.com](https://console.anthropic.com) → API Keys | **Hard fail** — 5xx on all AI routes |

---

## Supabase (Sovereign's own project)

| Var | Purpose | Where to get it | Fail mode |
|-----|---------|-----------------|-----------|
| `SUPABASE_URL` | Project URL for all server-side DB operations | Supabase dashboard → Project Settings → API → Project URL | **Hard fail** — every DB route fails |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — bypasses RLS. Never expose to client | Supabase dashboard → Project Settings → API → service_role key | **Hard fail** — every DB route fails |
| `VITE_SUPABASE_URL` | Same URL — public, used by the frontend React app | Same as SUPABASE_URL | **Hard fail** — frontend can't reach DB |
| `VITE_SUPABASE_ANON_KEY` | Anon key — public, used by frontend + injected into generated apps | Supabase dashboard → Project Settings → API → anon key | **Hard fail** — frontend + generated apps broken |

> **Note:** `SUPABASE_URL` and `VITE_SUPABASE_URL` are the same value. `SUPABASE_SERVICE_ROLE_KEY` is server-only — never add it as `VITE_*`.

---

## GitHub OAuth

| Var | Purpose | Where to get it | Fail mode |
|-----|---------|-----------------|-----------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID — server-side token exchange | [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps → Create or select app | **Hard fail** — GitHub OAuth broken |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | Same location | **Hard fail** — GitHub OAuth broken |
| `VITE_GITHUB_CLIENT_ID` | Same client ID — public, used by frontend to build OAuth URL | Same value as `GITHUB_CLIENT_ID` | **Hard fail** — OAuth URL not built |

> **Setup:** Callback URL to register: `https://visila.com/api/auth/github/callback`
> For local dev also add: `http://localhost:5173/api/auth/github/callback`

---

## Vercel OAuth (Marketplace Integration)

| Var | Purpose | Where to get it | Fail mode |
|-----|---------|-----------------|-----------|
| `VERCEL_CLIENT_ID` | Vercel marketplace integration client ID (starts with `oac_`) | [vercel.com/docs/integrations](https://vercel.com/docs/integrations) → Create Integration → OAuth credentials | **Hard fail** — Vercel OAuth broken |
| `VERCEL_CLIENT_SECRET` | Vercel integration client secret | Same location | **Hard fail** — Vercel OAuth broken |
| `VERCEL_INTEGRATION_SLUG` | Marketplace listing slug (e.g. `sovereign-app`) | Set when creating the Vercel integration | **Hard fail** — OAuth redirect URL not built |

> **Setup:** Redirect URL to register: `https://visila.com/api/auth/vercel/callback`

---

## Supabase OAuth (for users connecting their own Supabase)

| Var | Purpose | Where to get it | Fail mode |
|-----|---------|-----------------|-----------|
| `SUPABASE_OAUTH_CLIENT_ID` | Supabase OAuth App client ID — user account token exchange | [app.supabase.com](https://app.supabase.com) → Account → OAuth Apps → Sovereign | **Hard fail** — Supabase OAuth step broken. **Known value: `4c2d6168-822f-4f0f-9052-56393a467ae3`** |
| `SUPABASE_OAUTH_CLIENT_SECRET` | Supabase OAuth App client secret | Same page — copy Secret field | **Hard fail** — Supabase OAuth step broken. ⚠️ Secret not in any local env file — get from dashboard |
| `VITE_SUPABASE_OAUTH_CLIENT_ID` | Same client ID — public, used by frontend to build OAuth URL | Same value as `SUPABASE_OAUTH_CLIENT_ID` | **Hard fail** — Supabase OAuth button broken. **Known value: `4c2d6168-822f-4f0f-9052-56393a467ae3`** |

> **Setup:** Redirect URI to register: `https://visila.com/auth/supabase/callback`
> **Status:** Client ID values known. Secret requires dashboard. Run `scripts/set-vercel-env.ts` with fresh Vercel token to set the IDs automatically.

---

## Sovereign Staging Vercel Team (generated apps deploy here)

| Var | Purpose | Where to get it | Fail mode |
|-----|---------|-----------------|-----------|
| `VISILA_VERCEL_TEAM_ID` | Sovereign's staging Vercel team ID (team_*) — all generated apps deploy here | Vercel dashboard → Team Settings → General → Team ID | **Hard fail** — staging builds cannot deploy |
| `VISILA_VERCEL_TOKEN` | Token scoped to sovereign staging team — used for all Vercel API calls during builds | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create token scoped to staging team | **Hard fail** — staging builds cannot deploy |

> **Architecture:** Generated apps deploy to Sovereign's staging team, NOT the user's Vercel account. The user's `vercel_token` is preserved on the build record for future use in the claim flow (ownership transfer).

---

## Sovereign Infrastructure (sovereign-hosted DB provisioning)

| Var | Purpose | Where to get it | Fail mode |
|-----|---------|-----------------|-----------|
| `VISILA_SUPABASE_REF` | Sovereign's own Supabase project ref (e.g. `abcdefghij`) | Supabase dashboard → Project Settings → General → Reference ID | Optional — sovereign-hosted path disabled if missing |
| `VISILA_SUPABASE_MANAGEMENT_TOKEN` | Personal access token — runs schema SQL via Management API | [app.supabase.com](https://app.supabase.com) → Account → Access Tokens → Generate | Optional — sovereign-hosted path disabled if missing |
| `SUPABASE_ORG_ID` | Sovereign's Supabase org ID — used when creating new projects | Supabase dashboard → Organization Settings → General → Organization ID | Optional — project creation disabled if missing |

---

## Email (Resend)

| Var | Purpose | Where to get it | Fail mode |
|-----|---------|-----------------|-----------|
| `RESEND_API_KEY` | Resend email API — welcome emails, magic links, expiry warnings | [resend.com](https://resend.com) → API Keys → Create Key | Optional — emails silently skipped, all other features work |

---

## Security

| Var | Purpose | Where to get it | Fail mode |
|-----|---------|-----------------|-----------|
| `CRON_SECRET` | Protects `/api/expire-builds` from unauthorized calls | Generate with `openssl rand -hex 32` | **Hard fail** — expire-builds cron will 5xx |

> **Setup:** Add to Vercel env vars, then Vercel cron will pass it automatically as `x-cron-secret` header.

---

## Vercel System Variables (auto-set by Vercel, do not configure)

| Var | Purpose | Auto-set by |
|-----|---------|-------------|
| `VERCEL_ENV` | `production`, `preview`, or `development` | Vercel deployment system |
| `VERCEL_URL` | Preview deployment URL (no https://) | Vercel deployment system |

> These do NOT need to be added manually — Vercel injects them automatically.

---

## Local Development Only (optional)

| Var | Purpose | Default |
|-----|---------|---------|
| `PORT` | Local dev server port | `5173` |

---

## Status Summary

| Category | Vars | Status |
|----------|------|--------|
| Anthropic | 1 | ✅ Assumed set (API works in production) |
| Supabase (Sovereign) | 4 | ✅ Confirmed set (builds work) |
| GitHub OAuth | 3 | ✅ Confirmed set (GitHub OAuth works) |
| Vercel OAuth | 3 | ✅ Confirmed set (Vercel OAuth works) |
| Supabase OAuth | 3 | ⚠️ NOT SET — Supabase OAuth step non-functional |
| Sovereign Infrastructure | 3 | ⚠️ NOT SET — sovereign-hosted DB path disabled |
| Email | 1 | ✅ Assumed set (welcome emails work) |
| Security | 1 | ⚠️ NOT SET — expire-builds cron non-functional |

> Run `npx tsx scripts/check-env.ts` to get the live status.
