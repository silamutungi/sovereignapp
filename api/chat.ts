// api/chat.ts — Vercel Serverless Function
//
// POST /api/chat
// Body: { message: string, context: { activeApp?, builds? } }
// Returns: { reply: string, action?: EditAction | null }
//
// Routes to either global assistant or app-scoped assistant based on context.
// When activeApp is present the system prompt includes full app context and
// Claude is instructed to return a structured edit action when the user wants
// a change made.
//
// Rate limit: 30 requests per hour per IP

import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'

// Model constants — change here to swap models across the file
// MODEL_GENERATION: used for chat — must parse intent and emit structured JSON edit actions
//   Haiku is unreliable for strict JSON adherence; Sonnet required for edit intent detection
// MODEL_FAST: available for future simple classification tasks in this file
export const MODEL_GENERATION = 'claude-sonnet-4-6'
export const MODEL_FAST = 'claude-haiku-4-5-20251001'

// SECURITY AUDIT
// - Rate limited: 30/hr per IP
// - message capped at 2000 chars
// - No secrets exposed in responses
// - activeApp / builds context is user-supplied — never trusted for auth

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const config = { api: { bodyParser: { sizeLimit: '100kb' } } }

interface ActiveApp {
  id: string
  app_name: string
  deploy_url: string | null
  repo_url: string | null
  idea: string
  created_at?: string
  updated_at?: string
  expires_at?: string
  status?: string
  staging?: boolean | null
  claimed_at?: string | null
}

interface ChatContext {
  activeApp?: ActiveApp
  builds?: ActiveApp[]
}

export interface EditAction {
  type: 'edit'
  editRequest: string
  appName: string
  buildId: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    'unknown'

  const rl = checkRateLimit(`chat:${ip}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: `Too many requests. Retry after ${rl.retryAfter ?? 3600}s.` })
    return
  }

  const { message, context } =
    (req.body ?? {}) as { message?: unknown; context?: ChatContext }

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  if (message.length > 2000) {
    res.status(400).json({ error: 'message too long (max 2000 chars)' })
    return
  }

  const activeApp = context?.activeApp
  const builds = context?.builds ?? []

  // ── Fetch recurring lessons from Brain (best-effort, 2s timeout) ─────────
  let lessonContext = ''
  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 2000)
      const lr = await fetch(
        `${supabaseUrl}/rest/v1/lessons?solution=neq.&build_count=gte.3&order=build_count.desc&select=solution,category&limit=6`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: ctrl.signal },
      )
      clearTimeout(t)
      if (lr.ok) {
        const rows = await lr.json() as Array<{ solution: string; category: string }>
        if (rows.length > 0) {
          lessonContext = '\n\nPROVEN PATTERNS FROM PRODUCTION (apply these when relevant):\n' +
            rows.map((r) => `- [${r.category}] ${r.solution}`).join('\n')
        }
      }
    }
  } catch {
    // Non-fatal — proceed without lesson context
  }

  // ── System prompt ────────────────────────────────────────────────────────
  let system = `You are Sovereign Coach — the always-present AI brain inside Sovereign App.
You help founders build, ship, iterate, and grow. You are not a chatbot — you are a senior advisor who happens to also write code.
Tone: direct, confident, specific. 2–3 sentences unless explaining something technical.
No bullet points unless listing multiple distinct items. No "Great question!" or similar.
${lessonContext}
`

  if (activeApp) {
    // Scoped mode — user is in the Edit Panel for a specific app
    let expiryNote = ''
    if (activeApp.expires_at) {
      const daysLeft = Math.ceil((new Date(activeApp.expires_at).getTime() - Date.now()) / 86400000)
      if (daysLeft <= 3 && daysLeft > 0 && activeApp.staging && !activeApp.claimed_at) {
        expiryNote = `\n⚠️ URGENT: This app expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} and hasn't been claimed yet. Remind the user to claim it.`
      }
    }
    const statusNote = activeApp.status === 'error' ? '\n⚠️ This app has a build error — help diagnose and fix it.' : ''
    system += `
The user is working on: "${activeApp.app_name}"
Idea: ${activeApp.idea}${activeApp.deploy_url ? `\nLive URL: ${activeApp.deploy_url}` : ''}${activeApp.repo_url ? `\nRepo: ${activeApp.repo_url}` : ''}${expiryNote}${statusNote}

Edit intent: if the user's message contains any of these verbs applied to the app — add, change, remove, make, update, fix, create, build, put, move, replace, delete, redesign, show — treat it as an edit request.

When the user wants a change made, respond with this exact JSON (no markdown fences, no extra text):
{"reply":"<1-2 sentence confirmation of what you'll do>","action":{"type":"edit","editRequest":"<precise instruction for the code change>","appName":"${activeApp.app_name}","buildId":"${activeApp.id}","label":"<verb> to ${activeApp.app_name} →"}}

For coaching, strategy, or any non-edit response:
{"reply":"<1-2 sentence response>","action":null}

CRITICAL: return ONLY the raw JSON object. No \`\`\`json fences, no preamble, no trailing text. The first character of your response must be { and the last must be }.`
  } else {
    // Global / coaching mode — no specific app selected
    if (builds.length > 0) {
      system += `\nThe founder has ${builds.length} deployed app${builds.length > 1 ? 's' : ''}:\n`
      builds.slice(0, 5).forEach((b) => {
        const age = b.created_at
          ? Math.floor((Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : null
        const daysLeft = b.expires_at
          ? Math.ceil((new Date(b.expires_at).getTime() - Date.now()) / 86400000)
          : null
        const urgency = (daysLeft !== null && daysLeft <= 3 && b.staging && !b.claimed_at) ? ` ⚠️ expires in ${daysLeft}d` : ''
        const errFlag = b.status === 'error' ? ' ❌ build error' : ''
        system += `- ${b.app_name} (id:${b.id}): ${b.idea.slice(0, 80)}${age !== null ? ` (${age}d old)` : ''}${b.deploy_url ? ` — ${b.deploy_url}` : ''}${urgency}${errFlag}\n`
      })
    }

    system += `
Your job: help them ship faster, improve what they have, and grow.
If they ask a strategic question — give a concrete, actionable answer.
If they ask a technical question — answer it precisely.
If they seem stuck or unsure — proactively identify the highest-leverage thing to focus on.

Edit intent: if the user's message contains any of these verbs applied to an app — add, change, remove, make, update, fix, create, build, put, move, replace, delete, redesign, show — treat it as an edit request.

If the user wants to make a change to a specific app AND there is exactly one app listed above, return (no markdown fences, raw JSON only):
{"reply":"<1-2 sentence response>","action":{"type":"edit","editRequest":"<precise instruction>","appName":"<app name>","buildId":"<id from the list above>","label":"<verb> to <app name> →"}}

If the user wants to make a change but there are multiple apps and it's unclear which one, return:
{"reply":"<ask which app, 1-2 sentences>","action":{"type":"select_app","editRequest":"<the change they want>","label":"Which app should I update?"}}

For all other responses:
{"reply":"<1-2 sentence response>","action":null}

CRITICAL: return ONLY the raw JSON object. No \`\`\`json fences, no preamble, no trailing text. The first character of your response must be { and the last must be }.`
  }

  try {
    const msg = await anthropic.messages.create({
      // Sonnet 4.6: structured JSON output (reply + optional EditAction) + edit intent detection.
      // Do not downgrade to Haiku — JSON adherence and intent classification fail at 512 tokens on Haiku.
      model: MODEL_GENERATION,
      max_tokens: 512,
      system,
      messages: [{ role: 'user', content: message.trim() }],
    })

    const raw = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    // Strip markdown fences — Claude sometimes wraps JSON in ```json ... ``` even
    // when instructed not to. Without stripping, JSON.parse throws and action is lost.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

    // Parse structured response — fall back gracefully if Claude returns plain text
    let reply = raw
    let action: EditAction | null = null

    try {
      const parsed = JSON.parse(cleaned) as { reply?: string; action?: EditAction | null }
      console.log('chat response parsed:', JSON.stringify(parsed, null, 2))
      reply = String(parsed.reply ?? raw)
      action = parsed.action ?? null
    } catch {
      // Claude returned plain text — use as-is, no action
      console.log('chat response parse failed — raw:', raw.slice(0, 300))
    }

    res.status(200).json({ reply, action })
  } catch (err) {
    console.error('[chat] Error:', err)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
