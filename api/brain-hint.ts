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

  // ── Fetch build idea + recent edits from Supabase (Bug 2 + Bug 3) ─────
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // ── Audit log helper — fires whenever a hint is delivered (Bug 3 detector) ─
  async function logHintFired(hintType: string): Promise<void> {
    try {
      if (supabaseUrl && serviceKey) {
        await fetch(`${supabaseUrl}/rest/v1/audit_log`, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            check_name: 'brain_hint_fired',
            passed: true,
            severity: 'info',
            details: { build_id, hint_type: hintType, edit_count: count },
          }),
        })
      }
    } catch { /* non-fatal — logging must never block hint delivery */ }
  }

  let buildIdea = app_type ?? 'web app'
  let fetchedFeatures: string[] = Array.isArray(features_built) ? features_built : []

  if (supabaseUrl && serviceKey) {
    // Bug 2 fix — fetch build.idea server-side instead of trusting client app_type
    try {
      const ideaRes = await fetch(
        `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(build_id)}&deleted_at=is.null&select=idea,app_name`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      )
      if (ideaRes.ok) {
        const rows = await ideaRes.json() as Array<{ idea: string | null; app_name: string | null }>
        if (rows[0]?.idea) buildIdea = rows[0].idea
      }
    } catch { /* non-fatal — fall back to client-supplied app_type */ }

    // Bug 3 fix — fetch last 10 edit messages for features_built context
    try {
      const msgRes = await fetch(
        `${supabaseUrl}/rest/v1/edit_messages?build_id=eq.${encodeURIComponent(build_id)}&role=eq.sovereign&order=created_at.desc&limit=10&select=content`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      )
      if (msgRes.ok) {
        const msgs = await msgRes.json() as Array<{ content: string }>
        if (msgs.length > 0) {
          fetchedFeatures = msgs.map((m) => m.content)
        }
      }
    } catch { /* non-fatal — fall back to client-supplied features_built */ }
  }

  // ── Competitive edge hint — fires once on the very first edit ──────────
  // If the build has known competitors, prompt the founder to differentiate.
  if (count === 1) {
    try {
      if (supabaseUrl && serviceKey) {
        const buildRes = await fetch(
          `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(build_id)}&deleted_at=is.null&select=competitors`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        )
        if (buildRes.ok) {
          const rows = await buildRes.json() as Array<{ competitors: string[] | null }>
          const storedCompetitors = rows[0]?.competitors
          if (Array.isArray(storedCompetitors) && storedCompetitors.length > 0) {
            await logHintFired('green')
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
      await logHintFired('green')
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
    const featureList = fetchedFeatures.length > 0
      ? fetchedFeatures.join(', ')
      : 'none listed'

    // BRAIN HINT VOICE — Visila Writing Standard (Apple HIG Writing, December 2025)
    // Voice: co-founder energy — direct, warm, specific. Never generic or sycophantic.
    // Pattern: [specific observation about THIS edit] + [why it matters] + [one next action]
    // Never: "Great job!", "Looks good!", "You might want to consider...", "We noticed..."
    // Always: sentence case, one idea per hint, max 3 sentences, plain English
    const prompt = `You are Brain — Visila's co-founder intelligence. A founder just edited their app.

THEIR EDIT: ${String(edit_instruction).slice(0, 300)}
APP IDEA: ${buildIdea}
TOTAL EDITS: ${count}
FEATURES BUILT: ${featureList}

VOICE RULES (follow exactly):
- Direct and specific to THIS edit — never generic advice
- Co-founder energy — honest, forward-looking, actionable
- One idea per hint — never pack multiple suggestions
- Sentence case throughout — no ALL CAPS in hint body
- Max 2 sentences in hint_body
- NEVER: "Great job!", "Looks good!", "Nice work!" — sycophantic
- NEVER: "You might want to consider..." — too hedged, be direct
- NEVER: "We noticed..." — state the observation directly
- NEVER: generic hints that could apply to any app

GOOD EXAMPLE: "Your pricing page is live but not linked from the nav. Add a Pricing link to complete the flow."
BAD EXAMPLE: "Great update! Your app is looking better and better."

Return only JSON (no other text):
{
  "show_hint": true,
  "hint_type": "blue",
  "hint_body": "<1-2 sentences: specific observation + why it matters>",
  "hint_action": "<exact prompt to build the next thing, max 80 chars, or null>",
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

    if (parsed.show_hint && parsed.hint_type) {
      await logHintFired(parsed.hint_type)
    }

    res.status(200).json(parsed)
  } catch (err) {
    console.error('[brain-hint] error (non-fatal):', err instanceof Error ? err.message : String(err))
    // Non-fatal — return no hint rather than exposing the error
    res.status(200).json({ show_hint: false, hint_type: null, hint_body: null, hint_action: null, hint_action_label: null })
  }
}
