#!/usr/bin/env npx tsx
//
// scripts/check-env.ts
//
// Checks every environment variable Sovereign depends on.
// Run with: npx tsx scripts/check-env.ts
//
// Prints PRESENT / MISSING for each variable, grouped by category.
// A missing "hard fail" variable means the corresponding API route will 5xx.

import * as fs from 'fs'
import * as path from 'path'

// Load .env and .env.local into process.env before checking
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
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* file not found — skip */ }
}

interface EnvVar {
  name: string
  files: string[]
  failMode: 'hard' | 'optional'
  purpose: string
}

const ENV_VARS: Record<string, EnvVar[]> = {
  'Anthropic': [
    {
      name: 'ANTHROPIC_API_KEY',
      files: ['api/generate.ts', 'api/chat.ts', 'api/edit.ts', 'api/extract-brief.ts', 'server/generate.ts'],
      failMode: 'hard',
      purpose: 'Anthropic API — app generation, chat, editing, brief extraction',
    },
  ],

  'Supabase (Sovereign project)': [
    {
      name: 'SUPABASE_URL',
      files: ['api/*.ts', 'api/auth/*/callback.ts', 'api/dashboard/builds.ts'],
      failMode: 'hard',
      purpose: 'Supabase project URL — used by every API route for database access',
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      files: ['api/*.ts', 'api/auth/*/callback.ts', 'api/dashboard/builds.ts'],
      failMode: 'hard',
      purpose: 'Service role key — bypasses RLS, server-side only, never expose to client',
    },
    {
      name: 'VITE_SUPABASE_URL',
      files: ['src/lib/supabase.ts'],
      failMode: 'hard',
      purpose: 'Supabase URL — public, used by the frontend React app',
    },
    {
      name: 'VITE_SUPABASE_ANON_KEY',
      files: ['src/lib/supabase.ts', 'api/run-build.ts'],
      failMode: 'hard',
      purpose: 'Supabase anon key — public, used by frontend + injected into generated apps',
    },
  ],

  'GitHub OAuth': [
    {
      name: 'GITHUB_CLIENT_ID',
      files: ['api/auth/github/callback.ts'],
      failMode: 'hard',
      purpose: 'GitHub OAuth App client ID — token exchange in GitHub callback',
    },
    {
      name: 'GITHUB_CLIENT_SECRET',
      files: ['api/auth/github/callback.ts'],
      failMode: 'hard',
      purpose: 'GitHub OAuth App client secret — never expose to client',
    },
    {
      name: 'VITE_GITHUB_CLIENT_ID',
      files: ['src/App.tsx'],
      failMode: 'hard',
      purpose: 'GitHub OAuth App client ID — public, used to build the frontend OAuth URL',
    },
  ],

  'Vercel OAuth': [
    {
      name: 'VERCEL_CLIENT_ID',
      files: ['api/auth/vercel/callback.ts'],
      failMode: 'hard',
      purpose: 'Vercel marketplace integration client ID (oac_*)',
    },
    {
      name: 'VERCEL_CLIENT_SECRET',
      files: ['api/auth/vercel/callback.ts'],
      failMode: 'hard',
      purpose: 'Vercel marketplace integration client secret',
    },
    {
      name: 'VERCEL_INTEGRATION_SLUG',
      files: ['api/auth/github/callback.ts'],
      failMode: 'hard',
      purpose: 'Vercel marketplace listing slug (e.g. "sovereign-app") — used to build Vercel OAuth URL',
    },
  ],

  'Supabase OAuth (user accounts)': [
    {
      name: 'SUPABASE_OAUTH_CLIENT_ID',
      files: ['api/auth/supabase/callback.ts'],
      failMode: 'hard',
      purpose: 'Supabase OAuth App client ID — token exchange for user-owned Supabase',
    },
    {
      name: 'SUPABASE_OAUTH_CLIENT_SECRET',
      files: ['api/auth/supabase/callback.ts'],
      failMode: 'hard',
      purpose: 'Supabase OAuth App client secret',
    },
    {
      name: 'VITE_SUPABASE_OAUTH_CLIENT_ID',
      files: ['src/App.tsx'],
      failMode: 'hard',
      purpose: 'Supabase OAuth App client ID — public, used to build the frontend OAuth URL',
    },
  ],

  'Sovereign Infrastructure': [
    {
      name: 'SOVEREIGN_SUPABASE_REF',
      files: ['api/run-build.ts'],
      failMode: 'optional',
      purpose: "Sovereign's own Supabase project ref — enables sovereign-hosted DB provisioning path",
    },
    {
      name: 'SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN',
      files: ['api/run-build.ts'],
      failMode: 'optional',
      purpose: "Management API token — runs schema SQL in Sovereign's Supabase via Management API",
    },
    {
      name: 'SUPABASE_ORG_ID',
      files: ['api/run-build.ts'],
      failMode: 'optional',
      purpose: "Sovereign's Supabase organization ID — used when creating new Supabase projects",
    },
  ],

  'Email (Resend)': [
    {
      name: 'RESEND_API_KEY',
      files: ['api/run-build.ts', 'api/send-welcome.ts', 'api/_sendMagicLink.ts', 'api/expire-builds.ts'],
      failMode: 'optional',
      purpose: 'Resend email API key — welcome email, magic links, expiry warnings. App functions without it but no emails are sent.',
    },
  ],

  'Security': [
    {
      name: 'CRON_SECRET',
      files: ['api/expire-builds.ts'],
      failMode: 'hard',
      purpose: 'Secret header value for Vercel cron endpoint — prevents unauthorized triggering of expire-builds',
    },
  ],
}

// ── Status check ────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD   = '\x1b[1m'
const RESET  = '\x1b[0m'

let totalVars   = 0
let presentVars = 0
let missingHard = 0
let missingOpt  = 0

console.log(`\n${BOLD}Sovereign — Environment Variable Check${RESET}`)
console.log('='.repeat(50))

for (const [category, vars] of Object.entries(ENV_VARS)) {
  console.log(`\n${BOLD}${category}${RESET}`)

  for (const v of vars) {
    totalVars++
    const value = process.env[v.name]
    const present = value !== undefined && value !== ''

    if (present) {
      presentVars++
      const len = value!.length
      console.log(`  ${GREEN}✓ PRESENT${RESET}  ${v.name}  (${len} chars)`)
    } else {
      const tag = v.failMode === 'hard' ? `${RED}✗ MISSING [HARD FAIL]${RESET}` : `${YELLOW}○ MISSING [optional]${RESET}`
      console.log(`  ${tag}  ${v.name}`)
      console.log(`           Purpose: ${v.purpose}`)
      if (v.failMode === 'hard') missingHard++
      else missingOpt++
    }
  }
}

console.log('\n' + '='.repeat(50))
console.log(`${BOLD}Summary${RESET}`)
console.log(`  Total vars:     ${totalVars}`)
console.log(`  Present:        ${GREEN}${presentVars}${RESET}`)
console.log(`  Missing (hard): ${missingHard > 0 ? RED : GREEN}${missingHard}${RESET}`)
console.log(`  Missing (opt):  ${missingOpt > 0 ? YELLOW : GREEN}${missingOpt}${RESET}`)

if (missingHard > 0) {
  console.log(`\n${RED}${BOLD}⚠ ${missingHard} hard-fail variable(s) missing — affected API routes will return 5xx${RESET}`)
  console.log(`  See scripts/env-checklist.md for where to get each value.\n`)
  process.exit(1)
} else if (missingOpt > 0) {
  console.log(`\n${YELLOW}${BOLD}! ${missingOpt} optional variable(s) missing — some features will be disabled${RESET}\n`)
  process.exit(0)
} else {
  console.log(`\n${GREEN}${BOLD}✓ All environment variables present${RESET}\n`)
  process.exit(0)
}
