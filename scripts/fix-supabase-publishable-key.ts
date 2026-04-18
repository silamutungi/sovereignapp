#!/usr/bin/env npx tsx
//
// scripts/fix-supabase-publishable-key.ts
//
// Backfills the correct Supabase publishable key (sb_publishable_...) onto a
// specific build's Vercel project. Fixes apps provisioned before the pipeline
// was updated — their VITE_SUPABASE_ANON_KEY is the legacy JWT, disabled by
// Supabase on 2026-04-09. Result: signup fails with "Legacy API keys disabled".
//
// Usage:
//   npx tsx scripts/fix-supabase-publishable-key.ts <buildId>
//   npx tsx scripts/fix-supabase-publishable-key.ts --repo=weir-51fe48
//   npx tsx scripts/fix-supabase-publishable-key.ts --all-legacy
//
// Reads from .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//                  SOVEREIGN_VERCEL_TOKEN, SOVEREIGN_VERCEL_TEAM_ID

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

const SUPABASE_URL   = process.env.SUPABASE_URL              ?? ''
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const VERCEL_TOKEN   = process.env.SOVEREIGN_VERCEL_TOKEN    ?? ''
const VERCEL_TEAM_ID = process.env.SOVEREIGN_VERCEL_TEAM_ID  ?? ''

function requireEnv() {
  const missing: string[] = []
  if (!SUPABASE_URL)   missing.push('SUPABASE_URL')
  if (!SERVICE_KEY)    missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!VERCEL_TOKEN)   missing.push('SOVEREIGN_VERCEL_TOKEN')
  if (!VERCEL_TEAM_ID) missing.push('SOVEREIGN_VERCEL_TEAM_ID')
  if (missing.length > 0) {
    console.error('Missing env vars:', missing.join(', '))
    process.exit(1)
  }
}

// ── Types ───────────────────────────────────────────────────────────────────
interface BuildRow {
  id: string
  app_name: string
  repo_url: string | null
  deploy_url: string | null
  vercel_project_id: string | null
  supabase_token: string | null
  supabase_project_ref: string | null
  supabase_anon_key: string | null
}

interface ApiKeyEntry {
  api_key: string | null
  name: string
  type: 'legacy' | 'publishable' | 'secret' | null
}

// ── Supabase (Sovereign DB) ─────────────────────────────────────────────────
async function findBuilds(filter: { id?: string; repo?: string; allLegacy?: boolean }): Promise<BuildRow[]> {
  const base = `${SUPABASE_URL}/rest/v1/builds?select=id,app_name,repo_url,deploy_url,vercel_project_id,supabase_token,supabase_project_ref,supabase_anon_key`
  let url = base
  if (filter.id) url += `&id=eq.${encodeURIComponent(filter.id)}`
  else if (filter.repo) url += `&repo_url=ilike.*${encodeURIComponent(filter.repo)}*`
  else if (filter.allLegacy) url += `&supabase_anon_key=like.eyJ*&status=eq.complete`
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase select failed: ${res.status}`)
  return await res.json() as BuildRow[]
}

async function updateBuildKey(id: string, newKey: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/builds?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ supabase_anon_key: newKey }),
  })
  if (!res.ok) throw new Error(`Supabase builds update failed: ${res.status}`)
}

// ── Supabase Management API (user's project) ────────────────────────────────
async function fetchPublishableKey(supabaseToken: string, projectRef: string): Promise<string> {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/api-keys?reveal=true`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${supabaseToken}` } })
  if (!res.ok) throw new Error(`Supabase api-keys ${res.status}: ${await res.text()}`)
  const keys = await res.json() as ApiKeyEntry[]
  const publishable = keys.find(k => k.type === 'publishable')?.api_key
  if (!publishable) throw new Error(`No publishable key on project ${projectRef} — enable new API keys in Supabase dashboard`)
  return publishable
}

// ── Vercel (Sovereign-staging) ──────────────────────────────────────────────
const teamQ = `teamId=${encodeURIComponent(VERCEL_TEAM_ID)}`

async function vercelListEnv(projectId: string): Promise<Array<{ id: string; key: string; target: string[] }>> {
  const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?${teamQ}`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Vercel env list ${res.status}: ${await res.text()}`)
  const body = await res.json() as { envs: Array<{ id: string; key: string; target: string[] }> }
  return body.envs
}

async function vercelUpsertEnv(projectId: string, key: string, value: string, existingId: string | undefined): Promise<void> {
  const payload = { key, value, target: ['production', 'preview', 'development'], type: 'encrypted' }
  const url = existingId
    ? `https://api.vercel.com/v10/projects/${projectId}/env/${existingId}?${teamQ}`
    : `https://api.vercel.com/v10/projects/${projectId}/env?${teamQ}`
  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Vercel env ${existingId ? 'PATCH' : 'POST'} ${res.status}: ${await res.text()}`)
}

async function vercelFindLatestProductionDeployment(projectId: string): Promise<{ uid: string; ref: string } | null> {
  const res = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&target=production&limit=1&${teamQ}`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })
  if (!res.ok) return null
  const body = await res.json() as { deployments: Array<{ uid: string; meta?: { githubCommitRef?: string } }> }
  const d = body.deployments?.[0]
  if (!d) return null
  return { uid: d.uid, ref: d.meta?.githubCommitRef ?? 'main' }
}

async function vercelRedeploy(projectId: string, deploymentUid: string): Promise<void> {
  const res = await fetch(`https://api.vercel.com/v13/deployments?${teamQ}&forceNew=1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: projectId, deploymentId: deploymentUid, target: 'production' }),
  })
  if (!res.ok) throw new Error(`Vercel redeploy ${res.status}: ${await res.text()}`)
}

// ── Main ────────────────────────────────────────────────────────────────────
async function fixOne(build: BuildRow): Promise<void> {
  console.log(`\n→ ${build.app_name} (${build.id})`)
  console.log(`  deploy: ${build.deploy_url ?? '(none)'}`)

  if (!build.supabase_token)      { console.log('  skip: no supabase_token'); return }
  if (!build.supabase_project_ref) { console.log('  skip: no supabase_project_ref'); return }
  if (!build.vercel_project_id)   { console.log('  skip: no vercel_project_id'); return }

  const publishableKey = await fetchPublishableKey(build.supabase_token, build.supabase_project_ref)
  console.log(`  publishable key: ${publishableKey.slice(0, 18)}… (len ${publishableKey.length})`)

  const envs = await vercelListEnv(build.vercel_project_id)
  const existing = envs.find(e => e.key === 'VITE_SUPABASE_ANON_KEY')
  await vercelUpsertEnv(build.vercel_project_id, 'VITE_SUPABASE_ANON_KEY', publishableKey, existing?.id)
  console.log(`  vercel env: ${existing ? 'PATCHED' : 'CREATED'}`)

  await updateBuildKey(build.id, publishableKey)
  console.log(`  builds.supabase_anon_key updated`)

  const latest = await vercelFindLatestProductionDeployment(build.vercel_project_id)
  if (latest) {
    await vercelRedeploy(build.vercel_project_id, latest.uid)
    console.log(`  redeploy triggered`)
  } else {
    console.log(`  redeploy skipped: no prior production deployment found`)
  }
}

async function main() {
  requireEnv()
  const args = process.argv.slice(2)
  const arg = args[0] ?? ''
  let builds: BuildRow[]

  if (arg === '--all-legacy') {
    builds = await findBuilds({ allLegacy: true })
    console.log(`Found ${builds.length} builds with legacy JWT anon key`)
  } else if (arg.startsWith('--repo=')) {
    builds = await findBuilds({ repo: arg.slice('--repo='.length) })
  } else if (arg) {
    builds = await findBuilds({ id: arg })
  } else {
    console.error('Usage:')
    console.error('  npx tsx scripts/fix-supabase-publishable-key.ts <buildId>')
    console.error('  npx tsx scripts/fix-supabase-publishable-key.ts --repo=weir-51fe48')
    console.error('  npx tsx scripts/fix-supabase-publishable-key.ts --all-legacy')
    process.exit(1)
  }

  if (builds.length === 0) { console.error('No builds matched.'); process.exit(1) }

  let ok = 0, fail = 0
  for (const b of builds) {
    try { await fixOne(b); ok++ }
    catch (e) { console.error(`  FAIL: ${String(e)}`); fail++ }
  }
  console.log(`\nDone. OK: ${ok}  Fail: ${fail}`)
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
