#!/usr/bin/env npx tsx
//
// scripts/fix-vercel-json.ts
//
// For every complete build: fetches vercel.json from the GitHub repo,
// removes X-Frame-Options, adds frame-ancestors to CSP, pushes the update,
// then triggers a Vercel redeploy.
//
// Run with: npx tsx scripts/fix-vercel-json.ts

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

// ── The canonical vercel.json for all generated apps ─────────────────────────
const CANONICAL_VERCEL_JSON = {
  rewrites: [{ source: '/((?!api/).*)', destination: '/index.html' }],
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'self' https://visila.com",
        },
      ],
    },
  ],
}

const CANONICAL_CONTENT = JSON.stringify(CANONICAL_VERCEL_JSON, null, 2)

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getGitHubFile(repoPath: string, token: string): Promise<{ content: string; sha: string; tokenUsed: string } | null> {
  const tryFetch = async (t: string) =>
    fetch(
      `https://api.github.com/repos/${repoPath}/contents/vercel.json`,
      { headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github.v3+json' } },
    )

  let res = await tryFetch(token)

  // On 401, retry with SOVEREIGN_GITHUB_TOKEN
  if (res.status === 401) {
    const sovereignToken = process.env.SOVEREIGN_GITHUB_TOKEN
    if (sovereignToken && sovereignToken !== token) {
      console.log('  → build token expired, retrying with SOVEREIGN_GITHUB_TOKEN')
      res = await tryFetch(sovereignToken)
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.warn(`  ⚠ fallback token also failed ${res.status}: ${body.slice(0, 200)}`)
        return null
      }
      const data = await res.json() as { content: string; sha: string }
      return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha, tokenUsed: sovereignToken }
    }
    const body = await res.text().catch(() => '')
    console.warn(`  ⚠ GitHub read failed 401 (no fallback available): ${body.slice(0, 100)}`)
    return null
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.warn(`  ⚠ GitHub read failed ${res.status}: ${body.slice(0, 200)}`)
    return null
  }
  const data = await res.json() as { content: string; sha: string }
  return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha, tokenUsed: token }
}

function needsUpdate(currentJson: string): boolean {
  try {
    const parsed = JSON.parse(currentJson) as {
      headers?: Array<{ headers?: Array<{ key: string; value: string }> }>
    }
    const headers = parsed.headers?.[0]?.headers ?? []
    const hasXFrame = headers.some((h) => h.key === 'X-Frame-Options')
    const csp = headers.find((h) => h.key === 'Content-Security-Policy')
    const hasFrameAncestors = csp?.value?.includes('frame-ancestors') ?? false
    return hasXFrame || !hasFrameAncestors
  } catch {
    return true  // can't parse → replace it
  }
}

async function pushGitHubFile(repoPath: string, sha: string, token: string): Promise<boolean> {
  // token is whichever token successfully read the file
  const res = await fetch(
    `https://api.github.com/repos/${repoPath}/contents/vercel.json`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'fix: allow dashboard preview iframe, tighten CSP frame-ancestors',
        content: Buffer.from(CANONICAL_CONTENT).toString('base64'),
        sha,
      }),
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`  ✗ GitHub push failed ${res.status}: ${body.slice(0, 200)}`)
    return false
  }
  return true
}

async function triggerRedeploy(vercelProjectId: string): Promise<boolean> {
  const teamQ = `teamId=${encodeURIComponent(VERCEL_TEAM_ID)}`
  const listRes = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(vercelProjectId)}&${teamQ}&limit=1`,
    { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } },
  )
  if (!listRes.ok) return false
  const listData = await listRes.json() as { deployments?: Array<{ uid: string; name?: string }> }
  const latest = listData.deployments?.[0]
  if (!latest?.uid) return false

  const redeployRes = await fetch(
    `https://api.vercel.com/v13/deployments?forceNew=1&${teamQ}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: latest.name, deploymentId: latest.uid, target: 'production' }),
    },
  )
  return redeployRes.ok
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  checkConfig()
  console.log('\n🔧 fix-vercel-json — patching X-Frame-Options on all complete builds\n')

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/builds?select=id,app_name,repo_url,vercel_project_id,github_token&deleted_at=is.null&status=eq.complete`,
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
    console.error('❌ Failed to fetch builds:', res.status, body)
    process.exit(1)
  }

  const builds = await res.json() as Array<{
    id: string
    app_name: string
    repo_url: string | null
    vercel_project_id: string | null
    github_token: string | null
  }>

  console.log(`Found ${builds.length} complete build(s).\n`)

  let patched = 0
  let skipped = 0
  let failed = 0

  for (const build of builds) {
    console.log(`── ${build.app_name} (${build.id.slice(0, 8)})`)

    if (!build.repo_url) {
      console.log('  ⚠ no repo_url — skipping')
      skipped++
      continue
    }

    if (!build.github_token) {
      console.log('  ⚠ no github_token — skipping')
      skipped++
      continue
    }

    const repoPath = build.repo_url.replace('https://github.com/', '')

    const file = await getGitHubFile(repoPath, build.github_token)
    if (!file) {
      skipped++
      continue
    }

    if (!needsUpdate(file.content)) {
      console.log('  ✓ already up to date — skipping')
      skipped++
      continue
    }

    console.log('  → needs update (has X-Frame-Options or missing frame-ancestors)')

    const pushed = await pushGitHubFile(repoPath, file.sha, file.tokenUsed)
    if (!pushed) {
      failed++
      continue
    }
    console.log('  ✓ vercel.json pushed')

    if (build.vercel_project_id) {
      const redeployed = await triggerRedeploy(build.vercel_project_id)
      if (redeployed) {
        console.log('  ✓ redeploy triggered')
      } else {
        console.warn('  ⚠ push succeeded but redeploy failed — will pick up on next GitHub push')
      }
    } else {
      console.warn('  ⚠ no vercel_project_id — push succeeded, redeploy skipped')
    }

    patched++
  }

  console.log(`\n✅ Done. Patched: ${patched}  Already up to date: ${skipped}  Failed: ${failed}`)
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err)
  process.exit(1)
})
