#!/usr/bin/env npx tsx
//
// scripts/disable-sso-protection.ts
//
// Disables Vercel SSO protection on a single project so the preview iframe
// loads publicly without requiring a Vercel login.
//
// Usage:
//   npx tsx scripts/disable-sso-protection.ts <projectId>
//
// Env vars required (set in .env or shell):
//   SOVEREIGN_VERCEL_TOKEN
//   SOVEREIGN_VERCEL_TEAM_ID

const projectId = process.argv[2]

if (!projectId) {
  console.error('Usage: npx tsx scripts/disable-sso-protection.ts <projectId>')
  process.exit(1)
}

const token  = process.env.SOVEREIGN_VERCEL_TOKEN
const teamId = process.env.SOVEREIGN_VERCEL_TEAM_ID

if (!token) {
  console.error('Error: SOVEREIGN_VERCEL_TOKEN is not set')
  process.exit(1)
}

async function disableSso(pid: string): Promise<void> {
  const teamQ = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  const url   = `https://api.vercel.com/v9/projects/${encodeURIComponent(pid)}${teamQ}`

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ssoProtection: null }),
  })

  if (res.ok) {
    console.log(`SSO protection disabled for project ${pid}`)
    return
  }

  const body = await res.text().catch(() => '(could not read body)')
  console.error(`Failed to disable SSO for project ${pid} — HTTP ${res.status}: ${body}`)
  process.exit(1)
}

void disableSso(projectId)
