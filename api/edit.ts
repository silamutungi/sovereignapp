// api/edit.ts — Vercel Serverless Function
//
// POST /api/edit
// Body: { buildId, appName, repoUrl, editRequest }
// Returns: { ok: true } immediately after triggering the Vercel redeploy.
//
// Status resolution happens in build-status.ts: when it detects a build
// in 'building' state with a vercel_project_id, it checks Vercel's latest
// deployment and auto-updates to 'complete' or 'error'. The dashboard's
// existing 4s polling loop picks up the change automatically.
//
// Rate limit: 10 edits per hour per IP

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'

export const MODEL_GENERATION = 'claude-sonnet-4-6'

// SECURITY AUDIT
// - Rate limited: 10/hr per IP
// - editRequest length capped at 1000 chars
// - HTML output validated before push (must contain doctype/html tag)
// - SOVEREIGN_GITHUB_TOKEN used for GitHub ops, falls back to build.github_token
// - SOVEREIGN_VERCEL_TOKEN + SOVEREIGN_VERCEL_TEAM_ID used for Vercel redeploy
// - build must not be soft-deleted
// - always UPDATE existing build row — never INSERT

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  console.log('[edit] START', new Date().toISOString())

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    'unknown'

  const rateLimitResult = checkRateLimit(`edit:${ip}`, 10, 60 * 60 * 1000)
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', String(rateLimitResult.retryAfter ?? 3600))
    res.status(429).json({ error: `Too many edits. Retry after ${rateLimitResult.retryAfter ?? 3600}s.` })
    return
  }

  const { buildId, appName, repoUrl, editRequest } =
    (req.body ?? {}) as Record<string, unknown>

  if (!buildId || !repoUrl || !editRequest) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  if (typeof editRequest !== 'string' || editRequest.trim().length === 0) {
    res.status(400).json({ error: 'Edit request cannot be empty' })
    return
  }

  if (editRequest.length > 1000) {
    res.status(400).json({ error: 'Edit request too long (max 1000 chars)' })
    return
  }

  const supabase = getSupabase()

  // Helper — always UPDATE the existing build row, never INSERT
  const setBuildStatus = async (status: string, step: string | null, error: string | null = null) => {
    await supabase
      .from('builds')
      .update({ status, step, ...(error !== null ? { error } : {}) })
      .eq('id', buildId)
  }

  try {
    // ── Fetch build ─────────────────────────────────────────────────────────
    console.log('[edit] fetching build...', new Date().toISOString())
    const { data: build, error: buildError } = await supabase
      .from('builds')
      .select('github_token, email, vercel_project_id')
      .eq('id', buildId)
      .is('deleted_at', null)
      .single()

    console.log('[edit] got build', new Date().toISOString(), 'error:', buildError?.message ?? 'none')

    if (buildError || !build) {
      console.error('[edit] build not found, buildId:', buildId)
      res.status(404).json({ error: 'Build not found' })
      return
    }

    // Prefer SOVEREIGN_GITHUB_TOKEN; fall back to stored user token
    const githubToken = process.env.SOVEREIGN_GITHUB_TOKEN ?? build.github_token
    console.log('[edit] using token:', process.env.SOVEREIGN_GITHUB_TOKEN ? 'sovereign' : 'user', new Date().toISOString())
    if (!githubToken) {
      console.error('[edit] no GitHub token available')
      res.status(500).json({ error: "We couldn't make that change. Please try again in a moment." })
      return
    }

    // Mark build as building so the dashboard reflects the edit immediately
    await setBuildStatus('building', 'Applying your edit…')

    const repoPath = String(repoUrl).replace('https://github.com/', '')
    console.log('[edit] repo target:', repoPath, 'buildId:', buildId)

    // ── Fetch current index.html from GitHub ─────────────────────────────────
    console.log('[edit] fetching file...', new Date().toISOString())
    const githubRes = await fetch(
      `https://api.github.com/repos/${repoPath}/contents/index.html`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    )

    if (!githubRes.ok) {
      const body = await githubRes.text().catch(() => '')
      console.error('[edit] GitHub read failed:', githubRes.status, body)
      await setBuildStatus('error', null, 'Could not read app code from GitHub')
      res.status(500).json({ error: 'Could not read your app code' })
      return
    }

    const fileData = await githubRes.json() as { content: string; sha: string }
    const currentHtml = Buffer.from(fileData.content, 'base64').toString('utf-8')
    console.log('[edit] got file, sha:', fileData.sha, 'length:', currentHtml.length, new Date().toISOString())

    // ── Generate updated HTML via Claude ─────────────────────────────────────
    console.log('[edit] generating edit...', new Date().toISOString())
    await setBuildStatus('building', 'Generating your edit…')

    const message = await anthropic.messages.create({
      model: MODEL_GENERATION,
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `You are editing a web app. Return ONLY the complete updated index.html file. No explanation, no markdown, no code fences. Just the raw HTML.

Here is the current index.html:

${currentHtml}

The user wants this change: ${editRequest}

Apply the change. Keep everything else identical. Return the complete updated index.html.`,
        },
      ],
    })

    const updatedHtml = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    if (!updatedHtml.includes('<!DOCTYPE') && !updatedHtml.includes('<html')) {
      console.error('[edit] Claude returned non-HTML output, length:', updatedHtml.length)
      await setBuildStatus('error', null, 'Could not generate the edit')
      res.status(500).json({ error: 'Could not generate the edit' })
      return
    }
    console.log('[edit] edit generated, length:', updatedHtml.length, new Date().toISOString())

    // ── Push updated file to GitHub ──────────────────────────────────────────
    console.log('[edit] pushing to github...', new Date().toISOString())
    await setBuildStatus('building', 'Pushing your change…')

    const pushRes = await fetch(
      `https://api.github.com/repos/${repoPath}/contents/index.html`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Edit: ${String(editRequest).slice(0, 50)}`,
          content: Buffer.from(updatedHtml).toString('base64'),
          sha: fileData.sha,
        }),
      },
    )

    if (!pushRes.ok) {
      const pushBody = await pushRes.text().catch(() => '')
      console.error('[edit] GitHub push FAILED:', pushRes.status, pushBody)
      await setBuildStatus('error', null, 'Could not push change to GitHub')
      res.status(500).json({ error: 'Could not save the change' })
      return
    }

    const pushData = await pushRes.json() as { commit?: { sha: string } }
    console.log('[edit] pushed to github, commit sha:', pushData.commit?.sha ?? 'unknown', new Date().toISOString())

    // ── Trigger Vercel redeploy ───────────────────────────────────────────────
    // Returns immediately — build-status.ts polls Vercel and resolves the status
    console.log('[edit] triggering redeploy...', new Date().toISOString())
    await setBuildStatus('building', 'Deploying your edit…')

    const vcProjectId = build.vercel_project_id
    const vcTeamId    = process.env.SOVEREIGN_VERCEL_TEAM_ID
    const vcToken     = process.env.SOVEREIGN_VERCEL_TOKEN

    console.log('[edit] vercel ids — projectId:', vcProjectId ?? 'MISSING', 'teamId:', vcTeamId ?? 'MISSING', 'token:', !!vcToken, new Date().toISOString())

    if (vcProjectId && vcTeamId && vcToken) {
      const deployListRes = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(vcProjectId)}&teamId=${encodeURIComponent(vcTeamId)}&limit=1`,
        { headers: { Authorization: `Bearer ${vcToken}` } },
      )
      console.log('[edit] deploy list status:', deployListRes.status, new Date().toISOString())

      if (deployListRes.ok) {
        const deployList = await deployListRes.json() as { deployments?: Array<{ uid: string; name?: string; state?: string }> }
        const latest = deployList.deployments?.[0]
        console.log('[edit] latestDeployment shape:', JSON.stringify(latest ?? {}).slice(0, 500), new Date().toISOString())

        if (latest?.uid) {
          const redeployRes = await fetch(
            `https://api.vercel.com/v13/deployments?forceNew=1&teamId=${encodeURIComponent(vcTeamId)}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${vcToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name:         latest.name,
                deploymentId: latest.uid,
                target:       'production',
              }),
            },
          )

          const redeployBody = await redeployRes.text().catch(() => '')
          console.log('[edit] redeploy response status:', redeployRes.status, new Date().toISOString())
          console.log('[edit] redeploy body:', JSON.stringify(redeployBody).slice(0, 300), new Date().toISOString())

          if (!redeployRes.ok) {
            console.warn('[edit] Vercel redeploy non-fatal:', redeployRes.status, redeployBody)
          }
        } else {
          console.warn('[edit] no existing deployment found for project:', vcProjectId, new Date().toISOString())
        }
      } else {
        const listBody = await deployListRes.text().catch(() => '')
        console.warn('[edit] deploy list failed:', deployListRes.status, listBody, new Date().toISOString())
      }
    } else {
      console.warn('[edit] missing Vercel env vars — relying on GitHub auto-deploy', new Date().toISOString())
    }

    // Return immediately — build-status.ts will detect READY state and resolve
    console.log('[edit] returning 200', new Date().toISOString())
    void appName
    res.status(200).json({ ok: true, message: 'Edit deployed' })

  } catch (err) {
    console.error('[edit] Error:', err, new Date().toISOString())
    try { await setBuildStatus('error', null, 'Something went wrong during the edit') } catch { /* ignore */ }
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
