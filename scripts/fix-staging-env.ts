#!/usr/bin/env npx tsx
//
// scripts/fix-staging-env.ts
//
// One-time backfill: injects VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// and SUPABASE_URL into every complete staging Vercel project that is
// missing them, then triggers a redeploy.
//
// Run with: npx tsx scripts/fix-staging-env.ts

import * as fs from 'fs'
import * as path from 'path'

// ── Load .env ────────────────────────────────────────────────────────────────
for (const file of ['.env', '.env.local']) {
  try {
    const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (key && !(key in process.env)) process.env[key] = val
    }
  } catch { /* file not present */ }
}

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL    = process.env.SUPABASE_URL              ?? ''
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const VERCEL_TOKEN    = process.env.SOVEREIGN_VERCEL_TOKEN    ?? ''
const VERCEL_TEAM_ID  = process.env.SOVEREIGN_VERCEL_TEAM_ID  ?? ''
const INJECT_URL      = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const INJECT_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

function checkConfig() {
  const missing: string[] = []
  if (!SUPABASE_URL)    missing.push('SUPABASE_URL')
  if (!SERVICE_KEY)     missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!VERCEL_TOKEN)    missing.push('SOVEREIGN_VERCEL_TOKEN')
  if (!VERCEL_TEAM_ID)  missing.push('SOVEREIGN_VERCEL_TEAM_ID')
  if (!INJECT_URL)      missing.push('VITE_SUPABASE_URL (or SUPABASE_URL)')
  if (!INJECT_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)')
  if (missing.length > 0) {
    console.error('❌ Missing required env vars:', missing.join(', '))
    process.exit(1)
  }
}

// ── Slugify — must match run-build.ts logic ──────────────────────────────────
function toProjectName(appName: string, buildId: string): string {
  const slug   = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const suffix = buildId.replace(/-/g, '').slice(0, 6)
  return `${slug}-${suffix}`
}

// ── Vercel helpers ───────────────────────────────────────────────────────────
const teamQ = `teamId=${encodeURIComponent(VERCEL_TEAM_ID)}`

async function getProjectId(projectName: string): Promise<string | null> {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}?${teamQ}`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
  )
  if (!res.ok) return null
  const data = await res.json() as { id?: string }
  return data.id ?? null
}

async function getProjectEnvKeys(projectId: string): Promise<string[]> {
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?${teamQ}`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
  )
  if (!res.ok) return []
  const data = await res.json() as { envs?: Array<{ key: string }> }
  return (data.envs ?? []).map((e) => e.key)
}

async function injectEnvVars(projectId: string, vars: Array<{ key: string; value: string }>): Promise<boolean> {
  const payload = vars.map(({ key, value }) => ({
    key, value, type: 'encrypted', target: ['production', 'preview', 'development'],
  }))
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?${teamQ}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`  ✗ inject failed ${res.status}:`, body.slice(0, 300))
    return false
  }
  return true
}

async function triggerRedeploy(projectId: string): Promise<boolean> {
  const listRes = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&${teamQ}&limit=1`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
  )
  if (!listRes.ok) {
    console.error(`  ✗ fetch deployments failed ${listRes.status}`)
    return false
  }
  const listData = await listRes.json() as { deployments?: Array<{ uid: string; name?: string }> }
  const latest = listData.deployments?.[0]
  if (!latest?.uid) {
    console.warn(`  ⚠ no deployments found for project ${projectId}`)
    return false
  }

  const redeployRes = await fetch(
    `https://api.vercel.com/v13/deployments?forceNew=1&${teamQ}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: latest.name, deploymentId: latest.uid, target: 'production' }),
    },
  )
  if (!redeployRes.ok) {
    const body = await redeployRes.text().catch(() => '')
    console.error(`  ✗ redeploy failed ${redeployRes.status}:`, body.slice(0, 300))
    return false
  }
  return true
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  checkConfig()

  console.log('\n🔧 fix-staging-env — backfilling Supabase env vars on staging Vercel projects\n')
  console.log('  INJECT_URL:      set:', !!INJECT_URL)
  console.log('  INJECT_ANON_KEY: set:', !!INJECT_ANON_KEY)
  console.log('  VERCEL_TEAM_ID: ', VERCEL_TEAM_ID)
  console.log()

  // Fetch all complete builds (vercel_project_id may be null for older builds)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/builds?select=id,app_name,status,vercel_project_id,repo_url&deleted_at=is.null&status=eq.complete`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Accept: 'application/json',
      },
    },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('❌ Failed to fetch builds from Supabase:', res.status, body)
    process.exit(1)
  }

  const builds = await res.json() as Array<{
    id: string
    app_name: string
    status: string
    vercel_project_id: string | null
    repo_url: string | null
  }>
  console.log(`Found ${builds.length} complete build(s).\n`)

  let fixed = 0
  let skipped = 0
  let failed = 0
  let notFound = 0

  for (const build of builds) {
    const { id, app_name, vercel_project_id } = build
    const projectName = toProjectName(app_name, id)
    console.log(`── ${app_name} (${id.slice(0, 8)}) — project name: ${projectName}`)

    // Resolve Vercel project ID: use stored value if available, else look up by name
    let resolvedProjectId = vercel_project_id
    if (!resolvedProjectId) {
      resolvedProjectId = await getProjectId(projectName)
      if (!resolvedProjectId) {
        console.warn(`  ⚠ project not found on Vercel team — may have been deleted or never deployed`)
        notFound++
        continue
      }
      console.log(`  → resolved project ID: ${resolvedProjectId}`)
    }

    // Check which env vars are already present
    const presentKeys = await getProjectEnvKeys(resolvedProjectId)
    if (presentKeys.includes('VITE_SUPABASE_URL')) {
      console.log('  ✓ VITE_SUPABASE_URL already present — skipping')
      skipped++
      continue
    }

    console.log(`  → VITE_SUPABASE_URL missing (present: ${presentKeys.join(', ') || 'none'}) — injecting…`)
    const injected = await injectEnvVars(resolvedProjectId, [
      { key: 'VITE_SUPABASE_URL',      value: INJECT_URL },
      { key: 'VITE_SUPABASE_ANON_KEY', value: INJECT_ANON_KEY },
      { key: 'SUPABASE_URL',           value: INJECT_URL },
    ])

    if (!injected) {
      failed++
      continue
    }
    console.log('  ✓ env vars injected — triggering redeploy…')

    const redeployed = await triggerRedeploy(resolvedProjectId)
    if (redeployed) {
      console.log('  ✓ redeploy triggered')
    } else {
      console.warn('  ⚠ inject succeeded but redeploy failed — app will update on next push')
    }
    fixed++
  }

  console.log(`\n✅ Done. Fixed: ${fixed}  Skipped (already had vars): ${skipped}  Not found on Vercel: ${notFound}  Failed: ${failed}`)
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err)
  process.exit(1)
})
