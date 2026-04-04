// api/monitor.ts — Vercel Serverless Function
//
// POST /api/monitor
// Body: { buildId, editRequest, confidence, validationResults, changedFiles }
// Returns: { hint } or { hint: null } if nothing worth flagging
//
// Post-deploy monitoring check (Prompt C). Called fire-and-forget from edit.ts
// after every successful edit. Uses Haiku to generate proactive Brain hints
// based on edit history and app trajectory.
//
// Rate limit: 30/hr per IP

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'
import { appendLesson } from './lib/lessons.js'

const MODEL_FAST = 'claude-haiku-4-5-20251001'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    'unknown'

  const rl = checkRateLimit(`monitor:${ip}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: 'Rate limited' })
    return
  }

  const { buildId, editRequest, confidence, validationResults, changedFiles } =
    (req.body ?? {}) as Record<string, unknown>

  if (!buildId || !editRequest) {
    res.status(400).json({ error: 'Missing buildId or editRequest' })
    return
  }

  try {
    const supabase = getSupabase()

    // Fetch build context
    const { data: build } = await supabase
      .from('builds')
      .select('idea, app_type, deploy_url, repo_url')
      .eq('id', buildId)
      .is('deleted_at', null)
      .single()

    if (!build) {
      res.status(404).json({ error: 'Build not found' })
      return
    }

    // Fetch recent edit history (last 5 edits)
    const { data: recentEdits } = await supabase
      .from('edit_messages')
      .select('content, metadata, created_at')
      .eq('build_id', buildId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(5)

    // Count total edits
    const { count: editCount } = await supabase
      .from('edit_messages')
      .select('id', { count: 'exact', head: true })
      .eq('build_id', buildId)
      .eq('role', 'user')

    const recentEditList = (recentEdits ?? []).map((e) => ({
      instruction: typeof e.content === 'string' ? e.content.slice(0, 100) : '',
      files_changed: (e.metadata as Record<string, unknown>)?.files_changed ?? 'unknown',
    }))

    // Compute validation stats
    const validationArray = Array.isArray(validationResults) ? validationResults : []
    const validationPassCount = validationArray.filter((v: { passed?: boolean }) => v?.passed).length
    const validationTotalCount = validationArray.length

    const changedFilesList = Array.isArray(changedFiles) ? changedFiles : []

    const monitorPrompt = `You are Visila Brain — a proactive co-founder intelligence layer. You monitor apps after every deployment and surface insights the builder did not ask for but needs to know.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APP CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
App idea: ${build.idea ?? 'unknown'}
App type: ${build.app_type ?? 'web app'}
App URL: ${build.deploy_url ?? 'unknown'}
Total edits to date: ${editCount ?? 0}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT JUST CHANGED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User instruction: "${String(editRequest).slice(0, 500)}"
Files changed: ${changedFilesList.join(', ') || 'unknown'}
Confidence of last edit: ${confidence ?? 'unknown'}
Validation checks passed: ${validationPassCount}/${validationTotalCount}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECENT EDIT HISTORY (last 5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${recentEditList.map((e) => `- "${e.instruction}" -> ${e.files_changed} files`).join('\n') || '(no history)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR JOB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generate ONE proactive Brain hint. Not a response to the edit. An independent observation about the app's trajectory.

Categories to draw from (pick the most relevant ONE):
- INCOMPLETE_FEATURE: "You added X but Y is still missing — users who try to do Z will hit a dead end."
- PATTERN_DETECTED: "You have edited the hero section 4 times. Consider locking it and moving to retention features."
- NEXT_LOGICAL_STEP: "Most {app_type} apps add {feature} at this stage. You do not have it yet."
- QUALITY_SIGNAL: "The last 3 edits all touched the same file. This may indicate a design decision that needs rethinking."
- COMPETITIVE_GAP: "{app_type} competitors typically have {X}. You are missing it."
- VALIDATION_WARNING: "The last edit had low confidence. You should preview {specific area} before sharing with users."

Return a JSON object:

{
  "category": "INCOMPLETE_FEATURE" | "PATTERN_DETECTED" | "NEXT_LOGICAL_STEP" | "QUALITY_SIGNAL" | "COMPETITIVE_GAP" | "VALIDATION_WARNING",
  "headline": "8 words max. Direct. No fluff.",
  "detail": "2 sentences max. What is the issue and what to do about it. Be specific to this app.",
  "suggested_prompt": "A ready-to-use edit instruction the user can click to act on this.",
  "priority": "high" | "medium" | "low"
}

RULES:
- Only surface something genuinely useful. If nothing is worth flagging, return null.
- Never repeat a hint that was already surfaced in the last 3 edits.
- Be specific to this app's idea and type — not generic advice.
- The suggested_prompt must be immediately paste-able into the edit box.
- Do not mention Visila, AI, or technical implementation details. Speak as a co-founder, not as a system.

Return only valid JSON or null. No fences.`

    const monitorMsg = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 512,
      messages: [{ role: 'user', content: monitorPrompt }],
    })

    const monitorRaw = monitorMsg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    // Handle null response (nothing worth flagging)
    if (monitorRaw === 'null' || monitorRaw === '') {
      console.log('[monitor] no hint to surface')
      res.status(200).json({ hint: null })
      return
    }

    const hint = JSON.parse(monitorRaw) as {
      category?: string
      headline?: string
      detail?: string
      suggested_prompt?: string
      priority?: string
    } | null

    if (!hint || !hint.headline) {
      console.log('[monitor] hint was null or empty')
      res.status(200).json({ hint: null })
      return
    }

    // Store hint in edit_messages as a 'brain' role message for retrieval
    await supabase.from('edit_messages').insert({
      build_id: buildId,
      role: 'sovereign',
      content: hint.headline,
      message_type: 'brain_hint',
      metadata: {
        category: hint.category,
        detail: hint.detail,
        suggested_prompt: hint.suggested_prompt,
        priority: hint.priority,
        source: 'monitor',
      },
    })

    console.log(`[monitor] hint surfaced: ${hint.category} — ${hint.headline}`)

    // Append Brain observation to LESSONS.md — fire-and-forget
    if (hint.headline && build.repo_url) {
      const monitorRepoPath = String(build.repo_url).replace('https://github.com/', '')
      const [monitorOwner, monitorRepo] = monitorRepoPath.split('/')
      if (monitorOwner && monitorRepo) {
        appendLesson(
          monitorOwner, monitorRepo, 'brain_observations',
          (hint.category ?? 'observation') + ': ' + hint.headline + ' \u2014 ' + (hint.detail ?? ''),
          process.env.SOVEREIGN_GITHUB_TOKEN ?? '',
        ).catch(() => {})
      }
    }

    res.status(200).json({ hint })
  } catch (err) {
    console.error('[monitor] Error:', err)
    // Non-fatal — never block the edit flow
    res.status(200).json({ hint: null })
  }
}
