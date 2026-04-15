// api/brain-recommendations.ts — Brain 2.5 on-demand structural recommendations
//
// POST /api/brain-recommendations
// Body: { buildId }
// Returns: RecommendationReport (full report with recommendations[])
//
// Reads the static app_manifest + app_topology from the build (populated by
// run-build.ts) and asks Haiku for 3-7 ranked structural gaps with ready-to-
// paste edit instructions. Persists the full report to builds.structural_recommendations.
//
// Distinct from /api/brain-audit:
//   - brain-audit:           heavyweight file-scanning health audit (~120s, RLS,
//                            secret scanning, alt text, hardcoded colors)
//   - brain-recommendations: lightweight Haiku reasoning over manifest/topology
//                            (~3s, no GitHub fetches, no auto-fixes)
//
// Rate limit: 30/hr per IP — cheap call, founder may run it repeatedly while
// iterating on their app.

import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp } from './_rateLimit.js'
import { generateRecommendations } from './lib/structuralRecommendations.js'
import type { AppManifest } from './lib/generateManifest.js'
import type { AppTopology } from './lib/buildTopology.js'

export const maxDuration = 30

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

  const ip = getClientIp(req)
  const rl = checkRateLimit(`brain-recommendations:${ip}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: 'Rate limit exceeded' })
    return
  }

  let body: { buildId?: unknown }
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  const buildId = typeof body.buildId === 'string' ? body.buildId.trim() : ''
  if (!buildId) {
    res.status(400).json({ error: 'buildId required' })
    return
  }

  const supabase = getSupabase()

  try {
    const { data: build, error } = await supabase
      .from('builds')
      .select('id, app_name, idea, app_category, app_manifest, app_topology')
      .eq('id', buildId)
      .is('deleted_at', null)
      .single()

    if (error || !build) {
      res.status(404).json({ error: 'Build not found' })
      return
    }

    const report = await generateRecommendations(
      build.id,
      build.app_name ?? 'this app',
      build.idea ?? '',
      build.app_category ?? 'other',
      build.app_manifest as AppManifest | null,
      build.app_topology as AppTopology | null,
    )

    // Persist the full report — overwrite any prior recommendations for this build.
    await supabase
      .from('builds')
      .update({ structural_recommendations: report })
      .eq('id', build.id)
      .then(({ error: updateErr }) => {
        if (updateErr) {
          console.warn('[brain-recommendations] persist failed:', updateErr.message)
        }
      })

    res.status(200).json(report)
  } catch (err) {
    console.error('[brain-recommendations] unhandled error:', err)
    res.status(500).json({ error: 'Recommendations failed' })
  }
}
