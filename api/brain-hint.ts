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

  if (!build_id || !edit_instruction) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  const count = Number(edit_count ?? 0)

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

    // ── Blue proactive hint — Claude detects missing features ────────────────
    const featureList = Array.isArray(features_built) && features_built.length > 0
      ? features_built.join(', ')
      : 'none listed'

    const prompt = `You are Sovereign's Brain — a co-founder who sees what the founder hasn't thought of yet.

App type: ${app_type ?? 'web app'}
Features built: ${featureList}
Last edit: "${String(edit_instruction).slice(0, 200)}"
Edit count: ${count}

Decide whether to suggest ONE specific next step that would meaningfully improve this app's success.

Rules:
- Only suggest if there is a clear, valuable gap not already in the features list
- Be concrete — name the exact feature, not a category
- Max 2 sentences, calm and direct tone
- If the app already looks complete, do not force a suggestion

Return JSON only (no other text):
{
  "show_hint": boolean,
  "hint_type": "blue" | null,
  "hint_body": string | null,
  "hint_action": string | null,
  "hint_action_label": string | null
}

If showing a hint: hint_action = exact edit instruction (max 60 chars), hint_action_label = "Add it →"
If not showing: all values null except show_hint false.`

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
