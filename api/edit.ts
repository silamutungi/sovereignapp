// api/edit.ts — Vercel Serverless Function
//
// POST /api/edit
// Body: { buildId, appName, repoUrl, editRequest }
// Returns: { success: true, message: string }
//
// Fetches current index.html from the user's GitHub repo, runs the edit
// through Claude, and pushes the updated file back. Vercel auto-deploys.
//
// Rate limit: 10 edits per hour per IP

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'

// SECURITY AUDIT
// - Rate limited: 10/hr per IP
// - editRequest length capped at 1000 chars
// - HTML output validated before push (must contain doctype/html tag)
// - github_token fetched from Supabase (never from client)
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

    // Fetch build to retrieve github_token
    const { data: build, error: buildError } = await supabase
      .from('builds')
      .select('github_token, email')
      .eq('id', buildId)
      .is('deleted_at', null)
      .single()

    if (buildError || !build) {
      res.status(404).json({ error: 'Build not found' })
      return
    }

    // Parse owner/repo from repoUrl (format: https://github.com/owner/repo)
    const repoPath = String(repoUrl).replace('https://github.com/', '')

    // Fetch current index.html from GitHub
    const githubRes = await fetch(
      `https://api.github.com/repos/${repoPath}/contents/index.html`,
      {
        headers: {
          Authorization: `Bearer ${build.github_token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    )

    if (!githubRes.ok) {
      res.status(500).json({ error: 'Could not read your app code' })
      return
    }

    const fileData = await githubRes.json() as { content: string; sha: string }
    const currentHtml = Buffer.from(fileData.content, 'base64').toString('utf-8')

    // Generate updated HTML via Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
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
      res.status(500).json({ error: 'Could not generate the edit' })
      return
    }

    // Push updated file to GitHub
    const pushRes = await fetch(
      `https://api.github.com/repos/${repoPath}/contents/index.html`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${build.github_token}`,
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
      res.status(500).json({ error: 'Could not save the change' })
      return
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
