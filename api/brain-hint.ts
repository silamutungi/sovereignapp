// api/brain-hint.ts — POST /api/brain-hint
//
// Called after every successful edit deployment.
// Returns a contextual hint for the founder: blue (next step), green (milestone), or none.
// Amber hints are intercepted on the frontend before calling the edit API — this endpoint
// handles proactive and milestone hints only.
//
// Body: { build_id, app_type, edit_instruction, edit_count, features_built, last_hint_type }
// Returns: { show_hint, hint_type, hint_body, hint_action, hint_action_label }
//
// Rate limit: 30/hr per IP

// SECURITY AUDIT
// - Rate limited: 30/hr per IP
// - No sensitive data logged
// - Non-fatal: always returns 200 with show_hint: false on error

import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, getClientIp } from './_rateLimit.js'

const MODEL_FAST = 'claude-haiku-4-5-20251001'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = getClientIp(req)
  const rl = checkRateLimit(`brain-hint:${ip}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  const { build_id, app_type, edit_instruction, edit_count, features_built, last_hint_type } =
    (req.body ?? {}) as {
      build_id?: string
      app_type?: string
      edit_instruction?: string
      edit_count?: number
      features_built?: string[]
      last_hint_type?: string | null
    }

  if (!build_id || edit_instruction === undefined || edit_instruction === null) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  const count = Number(edit_count ?? 0)

  // ── Competitive edge hint — fires once on the very first edit ──────────
  // If the build has known competitors, prompt the founder to differentiate.
  if (count === 1) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseUrl && serviceKey) {
        const buildRes = await fetch(
          `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(build_id)}&deleted_at=is.null&select=competitors`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        )
        if (buildRes.ok) {
          const rows = await buildRes.json() as Array<{ competitors: string[] | null }>
          const storedCompetitors = rows[0]?.competitors
          if (Array.isArray(storedCompetitors) && storedCompetitors.length > 0) {
            return res.status(200).json({
              show_hint: true,
              hint_type: 'green',
              hint_body: `You've matched the core features of ${storedCompetitors[0]}. Here's what could set you apart:`,
              hint_action: `What would make this more unique than ${storedCompetitors[0]}? Suggest 3 specific differentiators.`,
              hint_action_label: 'Find my edge →',
            })
          }
        }
      }
    } catch (compErr) {
      console.warn('[brain-hint] competitive edge fetch failed (non-fatal):', compErr instanceof Error ? compErr.message : String(compErr))
    }
  }

  // No hint for the first two edits — let the user orient
  if (count < 2) {
    res.status(200).json({ show_hint: false, hint_type: null, hint_body: null, hint_action: null, hint_action_label: null })
    return
  }

  try {
    // ── Green milestone hints — fixed edit counts, no AI needed ─────────────
    const MILESTONE_COUNTS = [5, 10, 20]
    if (MILESTONE_COUNTS.includes(count) && last_hint_type !== 'green') {
      const milestones: Record<number, string> = {
        5:  `${count} changes in. Your app is finding its shape.`,
        10: `${count} edits. Most founders stop at one. You keep refining. That's the difference.`,
        20: `${count} iterations. The app you have now is not the one you started with. It's better.`,
      }
      return res.status(200).json({
        show_hint: true,
        hint_type: 'green',
        hint_body: milestones[count],
        hint_action: null,
        hint_action_label: null,
      })
    }

    // Skip blue if last hint was also blue — no two blues in a row
    if (last_hint_type === 'blue') {
      return res.status(200).json({ show_hint: false, hint_type: null, hint_body: null, hint_action: null, hint_action_label: null })
    }

    // ── Blue post-edit hint — co-founder insight on what they just changed ──
    const featureList = Array.isArray(features_built) && features_built.length > 0
      ? features_built.join(', ')
      : 'none listed'

    const prompt = `You are a startup co-founder advisor. A founder just made this change to their app: ${String(edit_instruction).slice(0, 300)}

Their app: ${app_type ?? 'web app'}
Total edits so far: ${count}
Recent sovereign messages (what's been built): ${featureList}

Give one specific, actionable next step that builds on what they just did. Think like a YC partner — focus on getting users, reducing churn, or increasing conversion. Be specific to what they just changed, not generic.

Return only JSON (no other text):
{
  "show_hint": true,
  "hint_type": "blue",
  "hint_body": "<one sentence, specific to the edit>",
  "hint_action": "<optional: exact prompt the user can send to build the logical next thing, max 80 chars, or null if no obvious next step>",
  "hint_action_label": "<3 words max, or null>"
}`

    const message = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(200).json({ show_hint: false, hint_type: null, hint_body: null, hint_action: null, hint_action_label: null })
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      show_hint: boolean
      hint_type: string | null
      hint_body: string | null
      hint_action: string | null
      hint_action_label: string | null
    }

    res.status(200).json(parsed)
  } catch (err) {
    console.error('[brain-hint] error (non-fatal):', err instanceof Error ? err.message : String(err))
    // Non-fatal — return no hint rather than exposing the error
    res.status(200).json({ show_hint: false, hint_type: null, hint_body: null, hint_action: null, hint_action_label: null })
  }
}
