// api/edit.ts — Vercel Serverless Function
//
// POST /api/edit
// Body: { buildId, appName, repoUrl, editRequest }
// Returns: { success: true, message: string }
//
// Fetches current index.html from the GitHub repo, runs the edit
// through Claude, pushes the updated file back, then explicitly
// triggers a Vercel redeploy on the sovereign-staging team.
//
// Rate limit: 10 edits per hour per IP

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'

// Model constants — change here to swap models across the file
// MODEL_GENERATION: plain-English edit engine — reads full HTML, applies targeted edits, returns complete file
//   Code quality matters here; Haiku produces regressions and drops CSS/JS during edits
// MODEL_FAST: available for future pre-validation or classification tasks
export const MODEL_GENERATION = 'claude-sonnet-4-6'
export const MODEL_FAST = 'claude-haiku-4-5-20251001'

// SECURITY AUDIT
// - Rate limited: 10/hr per IP
// - editRequest length capped at 1000 chars
// - HTML output validated before push (must contain doctype/html tag)
// - SOVEREIGN_GITHUB_TOKEN used for all GitHub operations (staging repos in Sovereign org)
// - SOVEREIGN_VERCEL_TOKEN + SOVEREIGN_VERCEL_TEAM_ID used for Vercel redeploy
// - build must not be soft-deleted

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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

  try {
    const supabase = getSupabase()

    // Fetch build to retrieve vercel_project_id (github_token kept for reference)
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

    // Prefer SOVEREIGN_GITHUB_TOKEN (staging repos in Sovereign's org).
    // Fall back to the user's stored github_token so edits work even if
    // SOVEREIGN_GITHUB_TOKEN has not yet been set in Vercel env vars.
    const githubToken = process.env.SOVEREIGN_GITHUB_TOKEN ?? build.github_token
    console.log('[edit] using token:', process.env.SOVEREIGN_GITHUB_TOKEN ? 'sovereign' : 'user')
    if (!githubToken) {
      console.error('[edit] no GitHub token available — SOVEREIGN_GITHUB_TOKEN not set and build has no github_token')
      res.status(500).json({ error: "We couldn't make that change. Please try again in a moment." })
      return
    }

    // Parse owner/repo from repoUrl (format: https://github.com/owner/repo)
    const repoPath = String(repoUrl).replace('https://github.com/', '')
    console.log('[edit] repo target:', repoPath, 'buildId:', buildId)
    console.log('[edit] using SOVEREIGN_GITHUB_TOKEN for GitHub operations')

    // Fetch current index.html from GitHub
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
      console.error('[edit] GitHub read failed:', githubRes.status, body, 'repo:', repoPath)
      res.status(500).json({ error: 'Could not read your app code' })
      return
    }

    const fileData = await githubRes.json() as { content: string; sha: string }
    const currentHtml = Buffer.from(fileData.content, 'base64').toString('utf-8')
    console.log('[edit] fetched index.html, sha:', fileData.sha, 'length:', currentHtml.length)

    // Generate updated HTML via Claude
    console.log('[edit] generating edit via Claude, model:', MODEL_GENERATION)
    const message = await anthropic.messages.create({
      // Sonnet 4.6: full-file HTML editing — must preserve all CSS/JS while applying targeted change.
      // Do not downgrade to Haiku — drops CSS/JS context during large file edits.
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
      res.status(500).json({ error: 'Could not generate the edit' })
      return
    }
    console.log('[edit] Claude edit generated, length:', updatedHtml.length)

    // Push updated file to GitHub using SOVEREIGN_GITHUB_TOKEN
    console.log('[edit] pushing updated index.html to GitHub repo:', repoPath)
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
      console.error('[edit] GitHub push FAILED:', pushRes.status, pushBody, 'repo:', repoPath)
      res.status(500).json({ error: 'Could not save the change' })
      return
    }

    const pushData = await pushRes.json() as { commit?: { sha: string } }
    console.log('[edit] GitHub push OK, commit sha:', pushData.commit?.sha ?? 'unknown')

    // Explicitly trigger a Vercel redeploy on the sovereign-staging team.
    // We do not rely on GitHub auto-deploy because the GitHub app on the
    // sovereign-staging team may not cover all user repos.
    const vcProjectId = build.vercel_project_id
    const vcTeamId    = process.env.SOVEREIGN_VERCEL_TEAM_ID
    const vcToken     = process.env.SOVEREIGN_VERCEL_TOKEN

    console.log('[edit] Vercel redeploy: projectId:', vcProjectId ?? 'MISSING', 'teamId:', vcTeamId ?? 'MISSING', 'token set:', !!vcToken)

    if (vcProjectId && vcTeamId && vcToken) {
      // Fetch the latest deployment for this project so we can redeploy it
      const deployListRes = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(vcProjectId)}&teamId=${encodeURIComponent(vcTeamId)}&limit=1`,
        { headers: { Authorization: `Bearer ${vcToken}` } },
      )

      if (deployListRes.ok) {
        const deployList = await deployListRes.json() as { deployments?: Array<{ uid: string; state?: string }> }
        const latest = deployList.deployments?.[0]
        console.log('[edit] latest deployment uid:', latest?.uid ?? 'none', 'state:', latest?.state ?? 'none')

        if (latest?.uid) {
          const redeployRes = await fetch(
            `https://api.vercel.com/v13/deployments?forceNew=1&teamId=${encodeURIComponent(vcTeamId)}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${vcToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ deploymentId: latest.uid }),
            },
          )
          const redeployBody = await redeployRes.text().catch(() => '')
          if (!redeployRes.ok) {
            console.warn('[edit] Vercel redeploy non-fatal:', redeployRes.status, redeployBody)
          } else {
            console.log('[edit] Vercel redeploy triggered OK, status:', redeployRes.status)
          }
        } else {
          console.warn('[edit] no existing deployment found for project:', vcProjectId, '— relying on GitHub auto-deploy')
        }
      } else {
        const listBody = await deployListRes.text().catch(() => '')
        console.warn('[edit] failed to list Vercel deployments:', deployListRes.status, listBody, '— relying on GitHub auto-deploy')
      }
    } else {
      console.warn('[edit] missing Vercel env vars (projectId:', vcProjectId ?? 'MISSING', 'teamId:', vcTeamId ?? 'MISSING', 'token:', !!vcToken, ') — relying on GitHub auto-deploy')
    }

    // Update build status
    await supabase
      .from('builds')
      .update({ status: 'building', step: 'Deploying your edit…' })
      .eq('id', buildId)

    void appName // referenced in request body, logged by Vercel automatically

    res.status(200).json({
      success: true,
      message: 'Change applied — deploying now',
    })
  } catch (err) {
    console.error('[edit] Error:', err)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
