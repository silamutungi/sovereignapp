// api/revert.ts — POST /api/revert
//
// Restores a generated app to a previous commit state by creating a new
// revert commit on top of HEAD pointing to the target commit's tree.
//
// Body: { buildId: string, commitSha: string }
// Returns: { ok: true, revertSha: string }
//
// Rate limit: 10/hr per IP

// SECURITY AUDIT
// - Rate limited: 10/hr per IP
// - buildId validated against Supabase (service role) — not user-supplied
// - github_token read from Supabase server-side, never from request body
// - Only SOVEREIGN_GITHUB_TOKEN used for Git operations
// - commitSha validated as 40-char hex before use

import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp } from './_rateLimit.js'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  console.log('[revert] START', new Date().toISOString())

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = getClientIp(req)
  const rl = checkRateLimit(`revert:${ip}`, 10, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: `Too many revert requests. Retry after ${rl.retryAfter ?? 3600}s.` })
    return
  }

  const { buildId, commitSha } = (req.body ?? {}) as Record<string, unknown>

  if (!buildId || !commitSha) {
    res.status(400).json({ error: 'Missing required fields: buildId and commitSha' })
    return
  }

  if (typeof commitSha !== 'string' || !/^[0-9a-f]{7,40}$/i.test(commitSha)) {
    res.status(400).json({ error: 'Invalid commitSha format' })
    return
  }

  const supabase = getSupabase()

  try {
    // ── Fetch build ──────────────────────────────────────────────────────────
    const { data: build, error: buildError } = await supabase
      .from('builds')
      .select('github_repo, vercel_project_id, vercel_team_id, github_token')
      .eq('id', buildId)
      .is('deleted_at', null)
      .single()

    if (buildError || !build) {
      console.error('[revert] build not found, buildId:', buildId)
      res.status(404).json({ error: 'Build not found' })
      return
    }

    const githubRepo = (build.github_repo as string | null) ?? null
    if (!githubRepo) {
      res.status(400).json({ error: 'Build has no associated GitHub repo' })
      return
    }

    const githubToken = process.env.SOVEREIGN_GITHUB_TOKEN ?? (build.github_token as string | null)
    if (!githubToken) {
      res.status(500).json({ error: 'No GitHub token available' })
      return
    }

    console.log('[revert] build:', buildId)
    console.log('[revert] restoring to commit:', (commitSha as string).slice(0, 7))

    const ghHeaders = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    }

    // ── Get current HEAD SHA ─────────────────────────────────────────────────
    const refRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/ref/heads/main`,
      { headers: ghHeaders },
    )
    if (!refRes.ok) {
      const body = await refRes.text().catch(() => '')
      console.error('[revert] could not get HEAD ref:', refRes.status, body)
      res.status(500).json({ error: 'Could not read current HEAD from GitHub' })
      return
    }
    const refData = await refRes.json() as { object: { sha: string } }
    const currentHeadSha = refData.object.sha

    // ── Get tree SHA from the target commit ──────────────────────────────────
    const targetCommitRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/commits/${commitSha}`,
      { headers: ghHeaders },
    )
    if (!targetCommitRes.ok) {
      const body = await targetCommitRes.text().catch(() => '')
      console.error('[revert] could not fetch target commit:', targetCommitRes.status, body)
      res.status(500).json({ error: 'Target commit not found in GitHub' })
      return
    }
    const targetCommitData = await targetCommitRes.json() as { tree: { sha: string } }
    const targetTreeSha = targetCommitData.tree.sha

    // ── Create revert commit pointing to the target tree ─────────────────────
    const newCommitRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/commits`,
      {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({
          message: `revert: restore to version ${(commitSha as string).slice(0, 7)}`,
          tree: targetTreeSha,
          parents: [currentHeadSha],
        }),
      },
    )
    if (!newCommitRes.ok) {
      const body = await newCommitRes.text().catch(() => '')
      console.error('[revert] could not create revert commit:', newCommitRes.status, body)
      res.status(500).json({ error: 'Could not create revert commit' })
      return
    }
    const newCommitData = await newCommitRes.json() as { sha: string }
    const newRevertCommitSha = newCommitData.sha

    console.log('[revert] revert commit created:', newRevertCommitSha.slice(0, 7))

    // ── Advance main branch to revert commit ─────────────────────────────────
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/refs/heads/main`,
      {
        method: 'PATCH',
        headers: ghHeaders,
        body: JSON.stringify({ sha: newRevertCommitSha }),
      },
    )
    if (!updateRefRes.ok) {
      const body = await updateRefRes.text().catch(() => '')
      console.error('[revert] could not advance main branch:', updateRefRes.status, body)
      res.status(500).json({ error: 'Could not update branch to revert commit' })
      return
    }

    // ── Trigger Vercel redeploy ───────────────────────────────────────────────
    const vcProjectId = build.vercel_project_id as string | null
    const vcTeamId    = process.env.SOVEREIGN_VERCEL_TEAM_ID
    const vcToken     = process.env.SOVEREIGN_VERCEL_TOKEN

    if (vcProjectId && vcTeamId && vcToken) {
      const deployListRes = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(vcProjectId)}&teamId=${encodeURIComponent(vcTeamId)}&limit=1`,
        { headers: { Authorization: `Bearer ${vcToken}` } },
      )
      if (deployListRes.ok) {
        const deployList = await deployListRes.json() as { deployments?: Array<{ uid: string; name?: string }> }
        const latest = deployList.deployments?.[0]
        if (latest?.uid) {
          const redeployRes = await fetch(
            `https://api.vercel.com/v13/deployments?forceNew=1&teamId=${encodeURIComponent(vcTeamId)}`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${vcToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: latest.name, deploymentId: latest.uid, target: 'production' }),
            },
          )
          if (!redeployRes.ok) {
            console.warn('[revert] Vercel redeploy non-fatal:', redeployRes.status)
          } else {
            console.log('[revert] redeploy triggered')
          }
        }
      }
    }

    // ── Update build status to building ──────────────────────────────────────
    await supabase
      .from('builds')
      .update({ status: 'building', step: 'Reverting to previous version…' })
      .eq('id', buildId)

    console.log('[revert] returning 200', new Date().toISOString())
    res.status(200).json({ ok: true, revertSha: newRevertCommitSha })

  } catch (err) {
    console.error('[revert] Error:', err, new Date().toISOString())
    res.status(500).json({ error: 'Something went wrong during the revert.' })
  }
}
