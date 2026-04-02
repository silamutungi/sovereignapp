#!/usr/bin/env npx tsx
//
// scripts/backfill-rls.ts
//
// Enables RLS on all public tables for a given Supabase project.
//
// Usage:
//   npx tsx scripts/backfill-rls.ts <project-ref>
//
// Requires SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN in .env or environment.

import * as fs from 'fs'
import * as path from 'path'

// ── Load .env ──────────────────────────────────────────────────────────────────
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

// ── Args ───────────────────────────────────────────────────────────────────────
const projectRef = process.argv[2]
if (!projectRef) {
  console.error('Usage: npx tsx scripts/backfill-rls.ts <project-ref> [--token <SUPABASE_ACCESS_TOKEN>]')
  process.exit(1)
}

const tokenIdx = process.argv.indexOf('--token')
const mgmtToken = (tokenIdx !== -1 && process.argv[tokenIdx + 1])
  ? process.argv[tokenIdx + 1]
  : process.env.SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN
if (!mgmtToken) {
  console.error('Missing token. Set SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN in .env or pass --token <value>')
  process.exit(1)
}

// ── Step 1: List public tables before ──────────────────────────────────────────
async function query(sql: string): Promise<unknown> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mgmtToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SQL failed (${res.status}): ${err}`)
  }
  return res.json()
}

async function main() {
  console.log(`\nBackfilling RLS for project: ${projectRef}\n`)

  // Get tables and their current RLS status
  const tablesResult = await query(`
    SELECT t.tablename, c.relrowsecurity
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
    WHERE t.schemaname = 'public'
    ORDER BY t.tablename;
  `) as Array<{ tablename: string; relrowsecurity: boolean }>

  if (!Array.isArray(tablesResult) || tablesResult.length === 0) {
    console.log('No public tables found.')
    return
  }

  console.log('Tables found:')
  for (const t of tablesResult) {
    const status = t.relrowsecurity ? 'RLS ON' : 'RLS OFF ← will fix'
    console.log(`  ${t.tablename}: ${status}`)
  }

  const needsFix = tablesResult.filter(t => !t.relrowsecurity)
  if (needsFix.length === 0) {
    console.log('\nAll tables already have RLS enabled. Nothing to do.')
    return
  }

  // Run the safety-net SQL
  console.log(`\nEnabling RLS on ${needsFix.length} table(s)...`)
  await query(`
    DO $$
    DECLARE
      t text;
    BEGIN
      FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
      LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      END LOOP;
    END $$;
  `)

  // Verify
  const after = await query(`
    SELECT t.tablename, c.relrowsecurity
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
    WHERE t.schemaname = 'public'
    ORDER BY t.tablename;
  `) as Array<{ tablename: string; relrowsecurity: boolean }>

  console.log('\nAfter backfill:')
  for (const t of after) {
    console.log(`  ${t.tablename}: ${t.relrowsecurity ? 'RLS ON ✓' : 'RLS OFF ✗'}`)
  }

  const stillOff = after.filter(t => !t.relrowsecurity)
  if (stillOff.length > 0) {
    console.error(`\nWARNING: ${stillOff.length} table(s) still without RLS!`)
    process.exit(1)
  }

  console.log('\nDone. All tables secured.')
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
