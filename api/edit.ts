// api/edit.ts — Vercel Serverless Function
//
// POST /api/edit
// Body: { buildId, appName, repoUrl, editRequest }
// Returns: { success: true, message: string }
//
// Fetches current index.html from the GitHub repo, runs the edit
// through Claude, pushes the updated file back, triggers a Vercel
// redeploy, then polls until the deployment reaches READY state.
// Build status is updated throughout — never inserts a new row.
//
// Rate limit: 10 edits per hour per IP

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'

// Allow up to 5 minutes so polling doesn't cut off mid-deploy
export const config = { maxDuration: 300 }

// Model constants
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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
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
  const setBuildStatus = async (
    status: string,
    step: string | null,
    error: string | null = null,
  ) => {
    await supabase
      .from('builds')
      .update({ status, step, ...(error !== null ? { error } : {}) })
      .eq('id', buildId)
  }

  try {
    // Fetch build record
    const { data: build, error: buildError } = await supabase
      .from('builds')
      .select('github_token, email, vercel_project_id')
      .eq('id', buildId)
      .is('deleted_at', null)
      .single()

    if (buildError || !build) {
      console.error('[edit] build not found, buildId:', buildId, 'error:', buildError?.message)
      res.status(404).json({ error: 'Build not found' })
      return
    }

    // Prefer SOVEREIGN_GITHUB_TOKEN; fall back to stored user token
    const githubToken = process.env.SOVEREIGN_GITHUB_TOKEN ?? build.github_token
    console.log('[edit] using token:', process.env.SOVEREIGN_GITHUB_TOKEN ? 'sovereign' : 'user')
    if (!githubToken) {
      console.error('[edit] no GitHub token available')
      res.status(500).json({ error: "We couldn't make that change. Please try again in a moment." })
      return
    }

    // Mark build as 'building' immediately so the dashboard reflects the edit
    await setBuildStatus('building', 'Applying your edit…')

    const repoPath = String(repoUrl).replace('https://github.com/', '')
    console.log('[edit] repo target:', repoPath, 'buildId:', buildId)

    // ── Step 1: Fetch current index.html from GitHub ─────────────────────────
    console.log('[edit] fetching index.html from GitHub…')
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
    console.log('[edit] fetched index.html, sha:', fileData.sha, 'length:', currentHtml.length)

    // ── Step 2: Generate updated HTML via Claude ─────────────────────────────
    console.log('[edit] generating edit via Claude, model:', MODEL_GENERATION)
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
    console.log('[edit] Claude edit generated, length:', updatedHtml.length)

    // ── Step 3: Push updated file to GitHub ──────────────────────────────────
    console.log('[edit] pushing updated index.html to GitHub repo:', repoPath)
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
    console.log('[edit] GitHub push OK, commit sha:', pushData.commit?.sha ?? 'unknown')

    // ── Step 4: Trigger Vercel redeploy ───────────────────────────────────────
    await setBuildStatus('building', 'Deploying your edit…')

    const vcProjectId = build.vercel_project_id
    const vcTeamId    = process.env.SOVEREIGN_VERCEL_TEAM_ID
    const vcToken     = process.env.SOVEREIGN_VERCEL_TOKEN

    console.log('[edit] Vercel redeploy: projectId:', vcProjectId ?? 'MISSING', 'teamId:', vcTeamId ?? 'MISSING', 'token set:', !!vcToken)

    let newDeployId: string | null = null

    if (vcProjectId && vcTeamId && vcToken) {
      // Fetch latest deployment to get uid + name for the redeploy call
      const deployListRes = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(vcProjectId)}&teamId=${encodeURIComponent(vcTeamId)}&limit=1`,
        { headers: { Authorization: `Bearer ${vcToken}` } },
      )

      if (deployListRes.ok) {
        const deployList = await deployListRes.json() as { deployments?: Array<{ uid: string; name?: string; state?: string }> }
        const latest = deployList.deployments?.[0]
        console.log('[edit] latestDeployment shape:', JSON.stringify(latest ?? {}).slice(0, 500))

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
          if (!redeployRes.ok) {
            console.warn('[edit] Vercel redeploy non-fatal:', redeployRes.status, redeployBody)
          } else {
            try {
              const redeployData = JSON.parse(redeployBody) as { id?: string; uid?: string }
              newDeployId = redeployData.id ?? redeployData.uid ?? null
              console.log('[edit] Vercel redeploy triggered OK, new deploymentId:', newDeployId)
            } catch {
              console.warn('[edit] could not parse redeploy response:', redeployBody.slice(0, 200))
            }
          }
        } else {
          console.warn('[edit] no existing deployment found for project:', vcProjectId)
        }
      } else {
        const listBody = await deployListRes.text().catch(() => '')
        console.warn('[edit] failed to list Vercel deployments:', deployListRes.status, listBody)
      }
    } else {
      console.warn('[edit] missing Vercel env vars — relying on GitHub auto-deploy')
    }

    // ── Step 5: Poll until deployment reaches READY (max 180s) ───────────────
    // Polling happens server-side so the build status is authoritative.
    // The client waits for this response; maxDuration: 300 prevents timeout.
    if (newDeployId && vcTeamId && vcToken) {
      console.log('[edit] polling deployment:', newDeployId)
      const POLL_MAX_MS      = 180_000
      const POLL_INTERVAL_MS = 3_000
      const pollDeadline     = Date.now() + POLL_MAX_MS
      let   resolved         = false

      while (!resolved && Date.now() < pollDeadline) {
        await sleep(POLL_INTERVAL_MS)

        let pollOk  = false
        let state: string | undefined

        try {
          const pollRes = await fetch(
            `https://api.vercel.com/v13/deployments/${encodeURIComponent(newDeployId)}?teamId=${encodeURIComponent(vcTeamId)}`,
            { headers: { Authorization: `Bearer ${vcToken}` } },
          )
          if (pollRes.ok) {
            const pollData = await pollRes.json() as { readyState?: string; state?: string }
            state  = pollData.readyState ?? pollData.state
            pollOk = true
            console.log('[edit] deployment state:', state)
          } else {
            console.warn('[edit] poll request failed:', pollRes.status)
          }
        } catch (pollErr) {
          console.warn('[edit] poll threw:', pollErr)
        }

        if (!pollOk) continue

        if (state === 'READY') {
          await setBuildStatus('complete', null, null)
          console.log('[edit] deployment READY — build marked complete')
          resolved = true
        } else if (state === 'ERROR' || state === 'CANCELED') {
          await setBuildStatus('error', null, 'Edit deployment failed')
          console.log('[edit] deployment', state, '— build marked error')
          resolved = true
        }
        // BUILDING / QUEUED — keep polling
      }

      if (!resolved) {
        // Timed out — deploy is probably still running; optimistically mark complete
        await setBuildStatus('complete', null, null)
        console.log('[edit] poll timed out after 180s — optimistically marking complete')
      }
    } else {
      // No deploy ID to poll — optimistically resolve; auto-deploy will handle it
      await setBuildStatus('complete', null, null)
      console.log('[edit] no deploymentId to poll — optimistically marking complete')
    }

    void appName

    res.status(200).json({
      success: true,
      message: 'Change applied — your app is updating',
    })
  } catch (err) {
    console.error('[edit] Error:', err)
    // Best-effort: reset status so the dashboard doesn't stay stuck on 'building'
    try {
      await setBuildStatus('error', null, 'Something went wrong during the edit')
    } catch { /* ignore */ }
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
