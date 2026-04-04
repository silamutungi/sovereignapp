// api/build-status.ts — Vercel Serverless Function
//
// GET /api/build-status?id=buildId
// Returns: { status, step, repoUrl, deployUrl, appName, error }
//
// When status is 'building' and vercel_project_id is set, this endpoint
// also checks the latest Vercel deployment state and auto-resolves to
// 'complete' or 'error' — making it self-healing for post-edit deployments.
// The dashboard's existing 4s polling loop picks up changes automatically.
//
// Self-contained: no imports from src/ or server/.

import { checkRateLimit } from './_rateLimit.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { id: buildId } = (req.query ?? {}) as Record<string, string>
    if (!buildId) {
      res.status(400).json({ error: '`id` is required' })
      return
    }

    // Rate limit: 60 per minute per build ID (polled every 4s, build takes ~60s = ~15 polls)
    const rl = checkRateLimit(`build-status:${buildId}`, 60, 60 * 1000)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
      res.status(429).json({ error: `Too many requests. Try again in ${rl.retryAfter}s.` })
      return
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: 'Supabase not configured' })
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dbRes: any
    try {
      dbRes = await fetch(
        `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(buildId)}&deleted_at=is.null&select=status,step,app_name,repo_url,deploy_url,error,vercel_project_id,updated_at,claim_status,audit_score,audit_top_fixes,staging,claimed_at,screenshot_url,try_mode,expires_at`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Accept: 'application/json',
          },
        },
      )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (fetchErr: any) {
      console.error('[build-status] FETCH CRASHED:', fetchErr.message, fetchErr.cause?.message ?? '')
      res.status(502).json({ error: 'Failed to reach Supabase' })
      return
    }

    if (!dbRes.ok) {
      const errorBody = await dbRes.text().catch(() => 'could not read body')
      console.error('[build-status] Supabase FAILED:', dbRes.status, dbRes.statusText, errorBody)
      res.status(502).json({ error: 'Failed to query Supabase' })
      return
    }

    const rows = await dbRes.json() as Array<{
      status: string
      step: string | null
      app_name: string
      repo_url: string | null
      deploy_url: string | null
      error: string | null
      vercel_project_id: string | null
      updated_at: string | null
      claim_status: string | null
      audit_score: number | null
      audit_top_fixes: string[] | null
      staging: boolean | null
      claimed_at: string | null
      screenshot_url: string | null
      try_mode: boolean | null
      expires_at: string | null
    }>

    if (!rows.length) {
      res.status(404).json({ error: 'Build not found' })
      return
    }

    let row = rows[0]

    // ── Auto-resolve building/auditing builds via Vercel deployment state ────
    // 'building' stuck > 30s with a vercel_project_id → check Vercel, resolve.
    // 'auditing' stuck > 5 minutes → resolve (audit is non-blocking, longer budget).
    const buildingThresholdMs = 30 * 1000       // 30s — enough for a redeploy to be queued
    const auditingThresholdMs = 5 * 60 * 1000   // 5 minutes for audit step
    const fixingThresholdMs   = 2 * 60 * 1000   // 2 minutes for autofix + redeploy
    const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0
    const stuckThresholdMs = row.status === 'auditing' ? auditingThresholdMs
      : row.status === 'fixing' ? fixingThresholdMs
      : buildingThresholdMs
    const isStuck = Date.now() - updatedAt > stuckThresholdMs

    if ((row.status === 'building' || row.status === 'auditing' || row.status === 'fixing') && row.vercel_project_id && isStuck) {
      const vcToken  = process.env.SOVEREIGN_VERCEL_TOKEN
      const vcTeamId = process.env.SOVEREIGN_VERCEL_TEAM_ID

      if (vcToken && vcTeamId) {
        try {
          const deployRes = await fetch(
            `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(row.vercel_project_id)}&teamId=${encodeURIComponent(vcTeamId)}&limit=1`,
            { headers: { Authorization: `Bearer ${vcToken}` } },
          )

          if (deployRes.ok) {
            const deployData = await deployRes.json() as {
              deployments?: Array<{ uid: string; url?: string; readyState?: string; state?: string }>
            }
            const latest = deployData.deployments?.[0]
            const state  = latest?.readyState ?? latest?.state

            console.log('[build-status] vercel check — project:', row.vercel_project_id, 'state:', state ?? 'none')

            if (state === 'READY' || state === 'ERROR' || state === 'CANCELED') {
              const newStatus   = state === 'READY' ? 'complete' : 'error'
              const newError    = state === 'READY' ? null : 'Deployment failed'
              // Fetch the project's stable alias rather than the immutable deployment URL
              let newDeployUrl: string | null = null
              if (state === 'READY') {
                try {
                  const projRes = await fetch(
                    `https://api.vercel.com/v9/projects/${encodeURIComponent(row.vercel_project_id)}?teamId=${encodeURIComponent(vcTeamId)}`,
                    { headers: { Authorization: `Bearer ${vcToken}` } },
                  )
                  if (projRes.ok) {
                    const projData = await projRes.json() as {
                      targets?: { production?: { alias?: string[] } }
                    }
                    const alias = projData.targets?.production?.alias?.[0]
                    if (alias) newDeployUrl = alias.startsWith('http') ? alias : `https://${alias}`
                  }
                } catch { /* non-fatal */ }
                // Fall back to raw deployment URL if project fetch failed
                if (!newDeployUrl && latest?.url) newDeployUrl = `https://${latest.url}`
              }

              const patch: Record<string, unknown> = { status: newStatus, step: null }
              if (newError) patch.error = newError
              if (newDeployUrl) patch.deploy_url = newDeployUrl

              // Update Supabase — best-effort, non-blocking for the response
              await fetch(
                `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(buildId)}`,
                {
                  method: 'PATCH',
                  headers: {
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=minimal',
                  },
                  body: JSON.stringify(patch),
                },
              ).catch((e) => console.warn('[build-status] status patch failed (non-fatal):', e))

              console.log('[build-status] auto-resolved build to', newStatus, 'deploy_url:', newDeployUrl ?? 'unchanged')
              row = { ...row, status: newStatus, step: null, error: newError, deploy_url: newDeployUrl ?? row.deploy_url }
            }
          }
        } catch (vcErr) {
          // Non-fatal — return current Supabase status as-is
          console.warn('[build-status] vercel check failed (non-fatal):', vcErr)
        }
      }
    }

    res.status(200).json({
      status:       row.status,
      step:         row.step,
      appName:      row.app_name,
      repoUrl:      row.repo_url,
      deployUrl:    row.deploy_url,
      error:        row.error,
      claim_status: row.claim_status,
      audit_score:  row.audit_score,
      audit_top_fixes: row.audit_top_fixes,
      staging:      row.staging,
      claimed_at:   row.claimed_at,
      screenshot_url: row.screenshot_url,
      try_mode:     row.try_mode,
      expires_at:   row.expires_at,
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
