#!/usr/bin/env npx tsx
//
// scripts/create-lessons-table.ts
//
// Creates the lessons table and seeds it with founder notes from CLAUDE.md.
// Requires a Supabase personal access token (NOT the service role key).
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=<token> npx tsx scripts/create-lessons-table.ts
//
// Get a token at: https://app.supabase.com/account/tokens
//
// What this does:
//   1. Creates the lessons table via Management API (DDL)
//   2. Seeds it with lessons from api/migrations/seed-lessons.sql (DML via REST API)
//   3. Prints the final lesson count

import * as fs from 'fs'
import * as path from 'path'

const PROJECT_REF = 'gudiuktjzynkjvtqmuvi'
const SUPABASE_URL = 'https://gudiuktjzynkjvtqmuvi.supabase.co'

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

function getEnv(key: string): string | undefined {
  return process.env[key] || envMain[key] || envLocal[key]
}

const MGMT_TOKEN   = process.env.SUPABASE_ACCESS_TOKEN
const SERVICE_KEY  = getEnv('SUPABASE_SERVICE_ROLE_KEY')

if (!MGMT_TOKEN) {
  console.error('✗ SUPABASE_ACCESS_TOKEN not set.')
  console.error('  Get a token at: https://app.supabase.com/account/tokens')
  console.error('  Run: SUPABASE_ACCESS_TOKEN=<token> npx tsx scripts/create-lessons-table.ts')
  process.exit(1)
}

if (!SERVICE_KEY) {
  console.error('✗ SUPABASE_SERVICE_ROLE_KEY not set (needed for seeding)')
  process.exit(1)
}

async function runSQL(sql: string): Promise<unknown> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const body = await res.json()
  if (res.status !== 200) throw new Error(`SQL failed (${res.status}): ${JSON.stringify(body)}`)
  return body
}

// Parse INSERT statements from a SQL file into JSON objects
function parseSeedSQL(sql: string): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = []
  // Match: INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES ( ... );
  const regex = /INSERT INTO lessons\s*\([^)]+\)\s*VALUES\s*\(\s*([\s\S]*?)\s*\);/gi
  let match
  while ((match = regex.exec(sql)) !== null) {
    try {
      const raw = match[1]
      // Split into 5 parts by comma, respecting single-quoted strings
      const parts: string[] = []
      let current = ''
      let inString = false
      let i = 0
      while (i < raw.length) {
        const ch = raw[i]
        if (ch === "'" && raw[i-1] !== '\\') {
          inString = !inString
          current += ch
        } else if (ch === ',' && !inString) {
          parts.push(current.trim())
          current = ''
        } else {
          current += ch
        }
        i++
      }
      parts.push(current.trim())

      if (parts.length === 5) {
        const unquote = (s: string) => s.replace(/^'|'$/g, '').replace(/''/g, "'")
        results.push({
          category: unquote(parts[0]),
          source: unquote(parts[1]),
          problem: unquote(parts[2]),
          solution: unquote(parts[3]),
          applied_automatically: parts[4].trim() === 'true',
        })
      }
    } catch {
      // skip malformed
    }
  }
  return results
}

async function main() {
  console.log('\nSovereign — Lessons Table Setup')
  console.log('='.repeat(40))

  // Step 1: Create table via Management API
  console.log('\nStep 1: Creating lessons table...')
  const createSQL = fs.readFileSync(
    path.resolve(process.cwd(), 'api/migrations/create-lessons-table.sql'),
    'utf-8'
  )
  // Split into individual statements (Management API takes one at a time)
  const statements = createSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))

  for (const stmt of statements) {
    try {
      await runSQL(stmt)
      console.log(`  ✓ ${stmt.slice(0, 60).replace(/\n/g, ' ')}...`)
    } catch (e) {
      // "already exists" errors are fine
      const msg = String(e)
      if (msg.includes('already exists') || msg.includes('42P07') || msg.includes('42710')) {
        console.log(`  ○ Already exists: ${stmt.slice(0, 50).replace(/\n/g, ' ')}`)
      } else {
        console.error(`  ✗ Failed: ${msg}`)
      }
    }
  }

  // Step 2: Check current lesson count via REST API
  console.log('\nStep 2: Checking current lesson count...')
  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/lessons?select=id`, {
    headers: {
      'apikey': SERVICE_KEY!,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'count=exact',
    },
  })
  const countHeader = countRes.headers.get('content-range')
  const existingCount = parseInt(countHeader?.split('/')[1] ?? '0', 10) || 0
  console.log(`  Current count: ${existingCount}`)

  if (existingCount > 0) {
    console.log('  ✓ Already seeded — skipping')
    console.log('\n✓ Done. Lessons table ready.')
    return
  }

  // Step 3: Parse and bulk insert seed lessons
  console.log('\nStep 3: Seeding lessons...')
  const seedSQL = fs.readFileSync(
    path.resolve(process.cwd(), 'api/migrations/seed-lessons.sql'),
    'utf-8'
  )
  const lessons = parseSeedSQL(seedSQL)
  console.log(`  Parsed ${lessons.length} lessons from seed file`)

  if (lessons.length === 0) {
    console.error('  ✗ Could not parse any lessons from seed file')
    process.exit(1)
  }

  // Bulk insert via REST API
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/lessons`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY!,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(lessons),
  })

  if (insertRes.status === 201 || insertRes.status === 200) {
    console.log(`  ✓ Inserted ${lessons.length} lessons`)
  } else {
    const errBody = await insertRes.json()
    console.error(`  ✗ Insert failed (${insertRes.status}): ${JSON.stringify(errBody)}`)
    process.exit(1)
  }

  // Step 4: Confirm final count
  const finalRes = await fetch(`${SUPABASE_URL}/rest/v1/lessons?select=id`, {
    headers: {
      'apikey': SERVICE_KEY!,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'count=exact',
    },
  })
  const finalHeader = finalRes.headers.get('content-range')
  const finalCount = finalHeader?.split('/')[1] ?? '?'
  console.log(`\n✓ Done. ${finalCount} lessons in table.`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
