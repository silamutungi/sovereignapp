#!/usr/bin/env npx tsx
//
// scripts/vercel-anon-key-sweep.ts
//
// Vercel-first sweep: the DB-based sweep (fix-supabase-publishable-key.ts) is
// blind because `builds.supabase_anon_key` was never populated for most
// complete builds. The real risk is deployed user apps whose Vercel
// VITE_SUPABASE_ANON_KEY env var still holds the legacy JWT (disabled by
// Supabase on 2026-04-09). This sweep iterates every complete build's
// vercel_project_id, fetches the live Vercel env, and classifies the anon
// key. Dry-run by default. Pass --fix to PATCH legacy entries to the current
// sb_publishable_ key and trigger a production redeploy.
//
// Usage:
//   npx tsx scripts/vercel-anon-key-sweep.ts              # dry run
//   npx tsx scripts/vercel-anon-key-sweep.ts --fix        # patch + redeploy
//
// On macOS, wrap with `caffeinate -i` for long runs.
//
// Reads from env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//                 SOVEREIGN_VERCEL_TOKEN, SOVEREIGN_VERCEL_TEAM_ID,
//                 VITE_SUPABASE_ANON_KEY (required for --fix — must be
//                 sb_publishable_ format; used as the replacement value).

import * as fs from 'fs'
import * as path from 'path'

// ── .env loader — .env.local takes precedence over .env ─────────────────────
for (const file of ['.env.local', '.env']) {
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
  } catch { /* file not present is fine */ }
}

const SUPABASE_URL     = process.env.SUPABASE_URL              ?? ''
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const VERCEL_TOKEN     = process.env.SOVEREIGN_VERCEL_TOKEN    ?? ''
const VERCEL_TEAM_ID   = process.env.SOVEREIGN_VERCEL_TEAM_ID  ?? ''
const CURRENT_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY    ?? ''

const FIX_MODE   = process.argv.includes('--fix')
const BATCH_SIZE = 5
const DELAY_MS   = 2000

function requireEnv(): void {
  const missing: string[] = []
  if (!SUPABASE_URL)   missing.push('SUPABASE_URL')
  if (!SERVICE_KEY)    missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!VERCEL_TOKEN)   missing.push('SOVEREIGN_VERCEL_TOKEN')
  if (!VERCEL_TEAM_ID) missing.push('SOVEREIGN_VERCEL_TEAM_ID')
  if (FIX_MODE && !CURRENT_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY (required for --fix)')
  if (missing.length > 0) {
    console.error('Missing env vars:', missing.join(', '))
    process.exit(1)
  }
  if (FIX_MODE && !CURRENT_ANON_KEY.startsWith('sb_publishable_')) {
    console.error('Refusing to --fix: VITE_SUPABASE_ANON_KEY is not in sb_publishable_ format.')
    console.error(`  Prefix seen: ${CURRENT_ANON_KEY.slice(0, 10)}`)
    process.exit(1)
  }
}

// ── Types ───────────────────────────────────────────────────────────────────
interface BuildRow {
  id: string
  app_name: string | null
  email: string | null
  vercel_project_id: string | null
  created_at: string
}

interface VercelEnv {
  id: string
  key: string
  value?: string
  target: string[]
  type: string
}

type KeyStatus = 'legacy' | 'current' | 'missing' | 'sensitive' | 'unknown' | 'error'

interface Row {
  build_id: string
  app_name: string
  email: string
  vercel_project_id: string
  key_prefix: string
  status: KeyStatus
  env_id?: string
  action: string
  error?: string
}

const teamQ = `teamId=${encodeURIComponent(VERCEL_TEAM_ID)}`

// ── Supabase ────────────────────────────────────────────────────────────────
async function fetchBuilds(): Promise<BuildRow[]> {
  const url = `${SUPABASE_URL}/rest/v1/builds?status=eq.complete&vercel_project_id=not.is.null&select=id,app_name,email,vercel_project_id,created_at&order=created_at.desc`
  const res = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } })
  if (!res.ok) throw new Error(`Supabase select failed: ${res.status} ${await res.text()}`)
  return await res.json() as BuildRow[]
}

// ── Vercel ──────────────────────────────────────────────────────────────────
// List returns Vercel-encrypted envelope values (eyJ2…/"v":"v2"), not plaintext.
// `decrypt=true` on the list endpoint is a no-op. Only the single-env endpoint
// (/v1/projects/{id}/env/{envId}?decrypt=true) returns the real value.
async function fetchVercelEnv(projectId: string): Promise<VercelEnv[]> {
  const url = `https://api.vercel.com/v10/projects/${projectId}/env?${teamQ}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } })
  if (!res.ok) throw new Error(`Vercel env list ${res.status}: ${await res.text()}`)
  const body = await res.json() as { envs: VercelEnv[] }
  return body.envs ?? []
}

interface DecryptedEnv { value: string; decrypted: boolean; type: string }

async function fetchDecryptedEnv(projectId: string, envId: string): Promise<DecryptedEnv | null> {
  const url = `https://api.vercel.com/v1/projects/${projectId}/env/${envId}?${teamQ}&decrypt=true`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } })
  if (!res.ok) return null
  const body = await res.json() as { value?: string; decrypted?: boolean; type?: string }
  return { value: body.value ?? '', decrypted: body.decrypted ?? false, type: body.type ?? '' }
}

async function patchVercelEnv(projectId: string, envId: string, value: string): Promise<void> {
  // Minimal body — leaves target and type unchanged on the existing entry.
  const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env/${envId}?${teamQ}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(`Vercel env PATCH ${res.status}: ${await res.text()}`)
}

async function redeployProduction(projectId: string): Promise<boolean> {
  const listRes = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&target=production&limit=1&${teamQ}`, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  })
  if (!listRes.ok) return false
  const listBody = await listRes.json() as { deployments: Array<{ uid: string }> }
  const uid = listBody.deployments?.[0]?.uid
  if (!uid) return false
  const redRes = await fetch(`https://api.vercel.com/v13/deployments?${teamQ}&forceNew=1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: projectId, deploymentId: uid, target: 'production' }),
  })
  return redRes.ok
}

// ── Classify ────────────────────────────────────────────────────────────────
function classify(value: string | undefined, type: string): { status: KeyStatus; prefix: string } {
  if (value === undefined || value === null || value === '') {
    if (type === 'sensitive') return { status: 'sensitive', prefix: '(sensitive)' }
    return { status: 'unknown', prefix: '(no value)' }
  }
  const prefix = value.slice(0, 16)
  if (value.startsWith('eyJ'))              return { status: 'legacy',  prefix }
  if (value.startsWith('sb_publishable_'))  return { status: 'current', prefix }
  return { status: 'unknown', prefix }
}

async function inspect(b: BuildRow): Promise<Row> {
  const row: Row = {
    build_id: b.id,
    app_name: b.app_name ?? '(no name)',
    email: b.email ?? '(no email)',
    vercel_project_id: b.vercel_project_id as string,
    key_prefix: '',
    status: 'unknown',
    action: '',
  }
  try {
    const envs = await fetchVercelEnv(b.vercel_project_id as string)
    const prodEnv = envs.find(e => e.key === 'VITE_SUPABASE_ANON_KEY' && e.target.includes('production'))
    if (!prodEnv) {
      row.status = 'missing'
      row.key_prefix = '(not set)'
      row.action = 'add key (manual)'
      return row
    }
    row.env_id = prodEnv.id

    // Two-step: list gives only the Vercel-encrypted envelope, single-env
    // endpoint returns the decrypted plaintext (or flags it as sensitive).
    const decrypted = await fetchDecryptedEnv(b.vercel_project_id as string, prodEnv.id)
    if (!decrypted) {
      row.status = 'error'
      row.key_prefix = '(fetch failed)'
      row.action = 'could not fetch env'
      return row
    }
    if (!decrypted.decrypted || !decrypted.value) {
      row.status = 'sensitive'
      row.key_prefix = '(sensitive)'
      row.action = 'sensitive (manual check)'
      return row
    }
    const c = classify(decrypted.value, decrypted.type)
    row.status = c.status
    row.key_prefix = c.prefix
    row.action =
      c.status === 'legacy'    ? (FIX_MODE ? 'PATCH + redeploy' : 'needs rotation')
    : c.status === 'current'   ? 'ok'
    : c.status === 'sensitive' ? 'sensitive (manual check)'
    : c.status === 'missing'   ? 'add key (manual)'
    :                            'unknown format'
  } catch (e) {
    row.status = 'error'
    row.action = 'error'
    row.error = e instanceof Error ? e.message : String(e)
  }
  return row
}

async function fixRow(row: Row): Promise<void> {
  if (row.status !== 'legacy' || !row.env_id) return
  try {
    await patchVercelEnv(row.vercel_project_id, row.env_id, CURRENT_ANON_KEY)
    const redeployed = await redeployProduction(row.vercel_project_id)
    row.action = redeployed ? 'PATCHED + redeployed' : 'PATCHED (redeploy failed)'
    row.status = 'current'
    row.key_prefix = CURRENT_ANON_KEY.slice(0, 16)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    row.action = `FAIL: ${msg.slice(0, 80)}`
  }
}

// ── Table render ────────────────────────────────────────────────────────────
function renderTable(rows: Row[]): void {
  const headers = ['build_id', 'app_name', 'email', 'project_id', 'status', 'prefix', 'action']
  const data = rows.map(r => [
    r.build_id.slice(0, 8),
    (r.app_name ?? '').slice(0, 20),
    (r.email ?? '').slice(0, 28),
    r.vercel_project_id,
    r.status,
    r.key_prefix,
    r.action + (r.error ? ` — ${r.error.slice(0, 60)}` : ''),
  ])
  const widths = headers.map((h, i) => Math.max(h.length, ...data.map(row => String(row[i] ?? '').length)))
  const fmt = (cells: Array<string | number | undefined>) =>
    cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join(' │ ')
  console.log(fmt(headers))
  console.log(widths.map(w => '─'.repeat(w)).join('─┼─'))
  for (const r of data) console.log(fmt(r))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  requireEnv()

  console.log(FIX_MODE
    ? '=== Vercel anon key sweep — --fix MODE (will PATCH + redeploy) ==='
    : '=== Vercel anon key sweep — DRY RUN (no writes) ===')
  console.log(`Team: ${VERCEL_TEAM_ID}`)
  console.log(`Batch: ${BATCH_SIZE} projects in parallel, ${DELAY_MS}ms between batches`)
  console.log('')

  const builds = await fetchBuilds()
  console.log(`Found ${builds.length} complete builds with vercel_project_id.\n`)
  if (builds.length === 0) { console.log('Nothing to scan.'); return }

  const rows: Row[] = []
  for (let i = 0; i < builds.length; i += BATCH_SIZE) {
    const batch = builds.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(inspect))
    rows.push(...results)
    const done = Math.min(i + BATCH_SIZE, builds.length)
    process.stderr.write(`\rInspected ${done}/${builds.length}`)
    if (i + BATCH_SIZE < builds.length) await sleep(DELAY_MS)
  }
  process.stderr.write('\n\n')

  renderTable(rows)
  console.log('')

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  console.log('Summary:', JSON.stringify(counts))

  if (!FIX_MODE) {
    const legacyCount = counts.legacy ?? 0
    if (legacyCount > 0) {
      console.log(`\n${legacyCount} legacy entr${legacyCount === 1 ? 'y' : 'ies'} found. Re-run with --fix to patch and redeploy.`)
    }
    return
  }

  const legacy = rows.filter(r => r.status === 'legacy')
  if (legacy.length === 0) { console.log('No legacy keys to fix.'); return }

  console.log(`\nFixing ${legacy.length} legacy entr${legacy.length === 1 ? 'y' : 'ies'}...\n`)
  for (let i = 0; i < legacy.length; i += BATCH_SIZE) {
    const batch = legacy.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(fixRow))
    const done = Math.min(i + BATCH_SIZE, legacy.length)
    process.stderr.write(`\rFixed ${done}/${legacy.length}`)
    if (i + BATCH_SIZE < legacy.length) await sleep(DELAY_MS)
  }
  process.stderr.write('\n\n')

  console.log('After --fix:')
  renderTable(rows)
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
