#!/usr/bin/env npx tsx
//
// scripts/set-vercel-env.ts
//
// Sets all required Vercel environment variables for the Sovereign project.
// Requires a valid Vercel personal access token.
//
// Usage:
//   VERCEL_ACCESS_TOKEN=<token> npx tsx scripts/set-vercel-env.ts
//
// Get a fresh token at: https://vercel.com/account/tokens
// The token needs "Full Access" scope (or at minimum project read/write).

import * as fs from 'fs'
import * as path from 'path'

// ── Config ────────────────────────────────────────────────────────────────────

const TEAM_ID    = 'team_3htcJhkd4KThrSE3itrDkLvh'
const PROJECT_ID = 'prj_I52Ahy6XezsK8LHf9lmgXpn3qImb'  // from OIDC token

const ALL_TARGETS = ['production', 'preview', 'development']

// ── Load env files ────────────────────────────────────────────────────────────

function loadEnvFile(file: string): Record<string, string> {
  try {
    const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8')
    const result: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      result[key] = val
    }
    return result
  } catch {
    return {}
  }
}

const envMain  = loadEnvFile('.env')
const envLocal = loadEnvFile('.env.local')
const envTest  = loadEnvFile('.env.test')

function getEnv(key: string): string | undefined {
  return envMain[key] || envLocal[key] || envTest[key] || process.env[key]
}

// ── Token ─────────────────────────────────────────────────────────────────────

const TOKEN = process.env.VERCEL_ACCESS_TOKEN || getEnv('VERCEL_ACCESS_TOKEN')
if (!TOKEN) {
  console.error('✗ VERCEL_ACCESS_TOKEN not set.')
  console.error('  Get a fresh token at: https://vercel.com/account/tokens')
  console.error('  Run: VERCEL_ACCESS_TOKEN=<token> npx tsx scripts/set-vercel-env.ts')
  process.exit(1)
}

// ── Vars to set ───────────────────────────────────────────────────────────────

const VARS_TO_SET: Array<{key: string; value: string | undefined; sensitive: boolean}> = [
  {
    key: 'VITE_SUPABASE_ANON_KEY',
    value: getEnv('VITE_SUPABASE_ANON_KEY'),
    sensitive: false,
  },
  {
    key: 'VITE_SUPABASE_OAUTH_CLIENT_ID',
    value: getEnv('VITE_SUPABASE_OAUTH_CLIENT_ID') || '4c2d6168-822f-4f0f-9052-56393a467ae3',
    sensitive: false,
  },
  {
    key: 'SUPABASE_OAUTH_CLIENT_ID',
    value: getEnv('SUPABASE_OAUTH_CLIENT_ID') || '4c2d6168-822f-4f0f-9052-56393a467ae3',
    sensitive: false,
  },
  {
    key: 'SUPABASE_OAUTH_CLIENT_SECRET',
    value: getEnv('SUPABASE_OAUTH_CLIENT_SECRET'),
    sensitive: true,
  },
  {
    key: 'CRON_SECRET',
    value: getEnv('CRON_SECRET'),
    sensitive: true,
  },
]

// ── Vercel API helpers ────────────────────────────────────────────────────────

async function vercelFetch(path: string, options: RequestInit = {}): Promise<{status: number; body: unknown}> {
  const url = `https://api.vercel.com${path}?teamId=${TEAM_ID}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    },
  })
  const body = await res.json()
  return { status: res.status, body }
}

async function getExistingEnvVars(): Promise<Map<string, string>> {
  const { status, body } = await vercelFetch(`/v10/projects/${PROJECT_ID}/env`)
  if (status !== 200) {
    throw new Error(`Failed to list env vars: ${status} — ${JSON.stringify(body)}`)
  }
  const envs = (body as {envs: Array<{key: string; id: string}>}).envs
  const map = new Map<string, string>()
  for (const e of envs) {
    map.set(e.key, e.id)
  }
  return map
}

async function setEnvVar(key: string, value: string, existingId: string | undefined): Promise<void> {
  const payload = {
    key,
    value,
    target: ALL_TARGETS,
    type: 'encrypted',
  }

  if (existingId) {
    // PATCH existing
    const { status, body } = await vercelFetch(`/v10/projects/${PROJECT_ID}/env/${existingId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    if (status !== 200) throw new Error(`PATCH failed: ${status} — ${JSON.stringify(body)}`)
    console.log(`  ✓ UPDATED  ${key}`)
  } else {
    // POST new
    const { status, body } = await vercelFetch(`/v10/projects/${PROJECT_ID}/env`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (status !== 200 && status !== 201) throw new Error(`POST failed: ${status} — ${JSON.stringify(body)}`)
    console.log(`  ✓ CREATED  ${key}`)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nSovereign — Vercel Env Var Setup')
  console.log('='.repeat(40))

  // Validate token
  const { status: userStatus } = await vercelFetch('/v2/user')
  if (userStatus !== 200) {
    console.error(`✗ Token invalid or unauthorized (HTTP ${userStatus})`)
    console.error('  Get a fresh "Full Access" token at: https://vercel.com/account/tokens')
    process.exit(1)
  }
  console.log('✓ Token valid\n')

  // Get existing vars
  let existing: Map<string, string>
  try {
    existing = await getExistingEnvVars()
    console.log(`Found ${existing.size} existing env vars on project\n`)
  } catch (e) {
    console.error('✗ Could not list existing vars:', String(e))
    process.exit(1)
  }

  // Set each var
  let success = 0, skipped = 0, failed = 0

  for (const v of VARS_TO_SET) {
    if (!v.value) {
      console.log(`  ○ SKIPPED  ${v.key}  (not found in local env files — add manually)`)
      skipped++
      continue
    }
    try {
      await setEnvVar(v.key, v.value, existing.get(v.key))
      success++
    } catch (e) {
      console.error(`  ✗ FAILED   ${v.key}: ${String(e)}`)
      failed++
    }
  }

  console.log('\n' + '='.repeat(40))
  console.log(`Set: ${success}  Skipped: ${skipped}  Failed: ${failed}`)

  if (success > 0) {
    console.log('\n⚡ Trigger redeploy to pick up new vars:')
    console.log("   git commit --allow-empty -m 'chore: redeploy with env vars' && git push")
  }
  if (skipped > 0) {
    console.log('\n⚠ Skipped vars must be added manually in Vercel dashboard:')
    console.log('  https://vercel.com/juapath/sovereignapp/settings/environment-variables')
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
