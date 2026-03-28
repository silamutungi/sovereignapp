#!/usr/bin/env npx tsx
//
// scripts/backfill-sso.ts
//
// Disables Vercel SSO protection on all existing staging builds so their
// preview iframes load publicly without requiring a Vercel login.
//
// Usage:
//   npx tsx scripts/backfill-sso.ts
//
// Env vars required (set in .env or shell):
//   SOVEREIGN_VERCEL_TOKEN
//   SOVEREIGN_VERCEL_TEAM_ID
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

const token       = process.env.SOVEREIGN_VERCEL_TOKEN
const teamId      = process.env.SOVEREIGN_VERCEL_TEAM_ID
const supabaseUrl = process.env.SUPABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!token)       { console.error('Error: SOVEREIGN_VERCEL_TOKEN is not set');       process.exit(1) }
if (!supabaseUrl) { console.error('Error: SUPABASE_URL is not set');                 process.exit(1) }
if (!serviceKey)  { console.error('Error: SUPABASE_SERVICE_ROLE_KEY is not set');    process.exit(1) }

async function fetchStagingBuilds(): Promise<Array<{ id: string; app_name: string; vercel_project_id: string }>> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/builds?staging=eq.true&claimed_at=is.null&deleted_at=is.null&vercel_project_id=not.is.null&select=id,app_name,vercel_project_id`,
    {
      headers: {
        apikey: serviceKey!,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase query failed (${res.status}): ${body}`)
  }
  return res.json() as Promise<Array<{ id: string; app_name: string; vercel_project_id: string }>>
}

async function disableSso(projectId: string): Promise<{ ok: boolean; error?: string }> {
  const teamQ = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}${teamQ}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ssoProtection: null }),
    },
  )
  if (res.ok) return { ok: true }
  const body = await res.text().catch(() => '')
  return { ok: false, error: `HTTP ${res.status}: ${body}` }
}

async function main(): Promise<void> {
  console.log('Fetching staging builds from Supabase…')
  const builds = await fetchStagingBuilds()

  if (builds.length === 0) {
    console.log('No staging builds found with a vercel_project_id.')
    return
  }

  console.log(`Found ${builds.length} staging build(s). Disabling SSO protection…\n`)

  let passed = 0
  let failed = 0

  for (const build of builds) {
    const result = await disableSso(build.vercel_project_id)
    if (result.ok) {
      console.log(`✓  ${build.app_name} (${build.vercel_project_id})`)
      passed++
    } else {
      console.error(`✗  ${build.app_name} (${build.vercel_project_id}) — ${result.error}`)
      failed++
    }
    // Small delay to avoid Vercel rate limiting
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\nDone. ${passed} succeeded, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

void main()
