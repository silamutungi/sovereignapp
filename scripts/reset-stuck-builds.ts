#!/usr/bin/env npx tsx
//
// scripts/reset-stuck-builds.ts
//
// Finds builds stuck in 'building' state for >30 minutes, checks their
// actual Vercel deployment state, and resolves them to 'complete' or 'error'.
//
// Run with: npx tsx scripts/reset-stuck-builds.ts

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
const SUPABASE_URL   = process.env.SUPABASE_URL              ?? ''
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const VERCEL_TOKEN   = process.env.SOVEREIGN_VERCEL_TOKEN    ?? ''
const VERCEL_TEAM_ID = process.env.SOVEREIGN_VERCEL_TEAM_ID  ?? ''

function checkConfig() {
  const missing: string[] = []
  if (!SUPABASE_URL)   missing.push('SUPABASE_URL')
  if (!SERVICE_KEY)    missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!VERCEL_TOKEN)   missing.push('SOVEREIGN_VERCEL_TOKEN')
  if (!VERCEL_TEAM_ID) missing.push('SOVEREIGN_VERCEL_TEAM_ID')
  if (missing.length > 0) {
    console.error('❌ Missing required env vars:', missing.join(', '))
    process.exit(1)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  checkConfig()

  console.log('\n🔧 reset-stuck-builds — resolving builds stuck in building state >30min\n')

  // Query builds stuck in 'building' for more than 30 minutes
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/builds?select=id,app_name,vercel_project_id,updated_at&deleted_at=is.null&status=eq.building&updated_at=lt.${encodeURIComponent(cutoff)}`,
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
    console.error('❌ Failed to fetch stuck builds:', res.status, body)
    process.exit(1)
  }

  const builds = await res.json() as Array<{
    id: string
    app_name: string
    vercel_project_id: string | null
    updated_at: string
  }>

  if (builds.length === 0) {
    console.log('✅ No stuck builds found.')
    return
  }

  console.log(`Found ${builds.length} stuck build(s):\n`)

  let resolved = 0
  let failed = 0

  for (const build of builds) {
    const stuckMins = Math.round((Date.now() - new Date(build.updated_at).getTime()) / 60000)
    console.log(`── ${build.app_name} (${build.id.slice(0, 8)}) — stuck for ${stuckMins} min`)

    let newStatus = 'complete'  // optimistic default if no deployment found
    let newError: string | null = null

    if (build.vercel_project_id) {
      try {
        const deployRes = await fetch(
          `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(build.vercel_project_id)}&teamId=${encodeURIComponent(VERCEL_TEAM_ID)}&limit=1`,
          { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
        )

        if (deployRes.ok) {
          const deployData = await deployRes.json() as {
            deployments?: Array<{ uid: string; readyState?: string; state?: string }>
          }
          const latest = deployData.deployments?.[0]
          const state  = latest?.readyState ?? latest?.state ?? 'NONE'

          console.log(`  → Vercel state: ${state}`)

          if (state === 'READY') {
            newStatus = 'complete'
          } else if (state === 'ERROR' || state === 'CANCELED') {
            newStatus = 'error'
            newError  = 'Deployment failed'
          } else {
            // BUILDING, INITIALIZING, QUEUED, or anything else → resolve optimistically
            console.log(`  → Unresolved state (${state}) — resolving optimistically as complete`)
            newStatus = 'complete'
          }
        } else {
          const body = await deployRes.text().catch(() => '')
          console.warn(`  ⚠ Vercel API error ${deployRes.status}: ${body.slice(0, 200)} — resolving optimistically`)
        }
      } catch (err) {
        console.warn(`  ⚠ Vercel check failed: ${err} — resolving optimistically`)
      }
    } else {
      console.log('  → No vercel_project_id — resolving optimistically as complete')
    }

    // Update Supabase
    const patch = await fetch(
      `${SUPABASE_URL}/rest/v1/builds?id=eq.${encodeURIComponent(build.id)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: newStatus,
          step: null,
          ...(newError ? { error: newError } : {}),
        }),
      },
    )

    if (patch.ok) {
      console.log(`  ✓ Resolved to '${newStatus}'`)
      resolved++
    } else {
      const body = await patch.text().catch(() => '')
      console.error(`  ✗ Supabase PATCH failed ${patch.status}: ${body.slice(0, 200)}`)
      failed++
    }
  }

  console.log(`\n✅ Done. Resolved: ${resolved}  Failed: ${failed}`)
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err)
  process.exit(1)
})
