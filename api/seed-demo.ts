// api/seed-demo.ts — Vercel Serverless Function
//
// POST /api/seed-demo
// Body: { buildId }
//
// On-demand demo-data seeding for an already-deployed app. Mirrors the
// post-deploy seed step in api/run-build.ts but runs from a button in
// the edit experience. Haiku generates category-specific INSERT rows
// against the per-build PostgreSQL schema in Visila's shared Supabase.
//
// SECURITY AUDIT
// - Rate limited: 5/hr per IP (heavy — Haiku + write-priv SQL)
// - Idempotent via builds.seeded_at — second click is a no-op
// - Service role key + sovereign management token used server-side only
// - Build must not be soft-deleted

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'

export const maxDuration = 30

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown'
  const rateLimitResult = checkRateLimit(`seed-demo:${ip}`, 5, 60 * 60 * 1000)
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', String(rateLimitResult.retryAfter ?? 3600))
    res.status(429).json({ error: 'Too many seed requests. Try again later.' })
    return
  }

  const { buildId } = (req.body ?? {}) as Record<string, unknown>
  if (!buildId) {
    res.status(400).json({ error: 'Missing buildId' })
    return
  }

  const supabase = getSupabase()

  // Fetch build
  const { data: build, error: buildError } = await supabase
    .from('builds')
    .select('id, idea, app_category, supabase_schema')
    .eq('id', buildId)
    .is('deleted_at', null)
    .single()

  if (buildError || !build) {
    res.status(404).json({ error: 'Build not found' })
    return
  }

  // Idempotency check — return early if already seeded
  const { data: existing } = await supabase
    .from('builds')
    .select('seeded_at')
    .eq('id', buildId)
    .single()

  if (existing?.seeded_at) {
    res.status(200).json({ ok: true, message: 'Demo data already seeded', alreadySeeded: true })
    return
  }

  if (!build.supabase_schema) {
    res.status(400).json({ error: 'No database schema found for this app' })
    return
  }

  const sovereignRef   = process.env.SOVEREIGN_SUPABASE_REF
  const sovereignToken = process.env.SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN

  if (!sovereignRef || !sovereignToken) {
    res.status(500).json({ error: 'Seed credentials not configured' })
    return
  }

  const appSchema = `b${String(buildId).replace(/-/g, '').slice(0, 8)}`

  try {
    // Haiku generates category-specific INSERT statements
    const seedMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are seeding a demo database for a new app so it looks alive on first load.

App idea: ${build.idea ?? 'unknown'}
App category: ${build.app_category ?? 'saas'}
Database schema (the CREATE TABLE statements):
${build.supabase_schema}

Generate realistic, specific INSERT statements for this app.
Rules:
- Use schema prefix: ${appSchema}. before every table name
- Insert 3-6 rows per table (skip auth/users tables entirely)
- Data must be specific to the app idea — not generic "Sample Item 1"
- Use realistic names, amounts, dates, statuses for this industry
- Dates: use NOW() - INTERVAL for past dates, NOW() + INTERVAL for future
- UUIDs: use gen_random_uuid()
- Skip any table with "user" or "account" or "auth" in the name
- For any column named user_id, owner_id, created_by, or any FK to auth.users — omit that column entirely from the INSERT. Do not generate a value for it.
- Return ONLY valid PostgreSQL INSERT statements, nothing else
- No markdown, no explanation, no CREATE statements`,
      }],
    })

    const seedSql = seedMsg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^```sql\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    if (!seedSql || !seedSql.toLowerCase().includes('insert')) {
      res.status(500).json({ error: 'Could not generate seed data' })
      return
    }

    const seedRes = await fetch(
      `https://api.supabase.com/v1/projects/${sovereignRef}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sovereignToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: seedSql }),
      },
    )

    if (!seedRes.ok) {
      const seedErr = await seedRes.text().catch(() => '')
      console.error('[seed-demo] insert failed:', seedRes.status, seedErr.slice(0, 200))
      res.status(500).json({ error: 'Failed to insert demo data' })
      return
    }

    // Mark as seeded — non-fatal if column does not exist yet
    try {
      await supabase
        .from('builds')
        .update({ seeded_at: new Date().toISOString() })
        .eq('id', buildId)
    } catch (markErr) {
      console.warn('[seed-demo] seeded_at update failed (non-fatal):', markErr)
    }

    console.log('[seed-demo] seed data inserted successfully for build:', buildId)
    res.status(200).json({ ok: true, message: 'Demo data seeded successfully' })

  } catch (err) {
    console.error('[seed-demo] error:', err)
    res.status(500).json({ error: 'Something went wrong seeding demo data' })
  }
}
