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

  // ── System prompt ────────────────────────────────────────────────────────
  let system = `You are Sovereign, the AI assistant built into Sovereign App — a platform that generates and deploys full web apps from plain English descriptions.
Tone: direct, confident, zero filler. 2–3 sentences unless explaining something technical.
No bullet points unless listing multiple distinct items. No "Great question!" or similar.
`

  if (activeApp) {
    // Scoped mode — user is in the Edit Panel for a specific app
    system += `
The user is editing their app: "${activeApp.app_name}"
Idea: ${activeApp.idea}${activeApp.deploy_url ? `\nLive URL: ${activeApp.deploy_url}` : ''}${activeApp.repo_url ? `\nRepo: ${activeApp.repo_url}` : ''}

When the user describes a change to make, respond with this exact JSON structure:
{"reply":"<your response confirming what you'll do>","action":{"type":"edit","editRequest":"<precise instruction for the code change>","appName":"${activeApp.app_name}","buildId":"${activeApp.id}"}}

For any other response (questions, clarifications, etc.):
{"reply":"<your response>","action":null}

ALWAYS return valid JSON only. No markdown fences, no extra text outside the JSON.`
  } else {
    // Global mode — general Sovereign assistant
    if (builds.length > 0) {
      system += `\nThe user has ${builds.length} deployed app${builds.length > 1 ? 's' : ''}:\n`
      builds.slice(0, 5).forEach((b) => {
        system += `- ${b.app_name}: ${b.idea.slice(0, 80)}${b.deploy_url ? ` (${b.deploy_url})` : ''}\n`
      })
    }

    system += `
Respond with this exact JSON structure:
{"reply":"<your response>","action":null}

ALWAYS return valid JSON only. No markdown fences, no extra text outside the JSON.`
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

    // Parse structured response — fall back gracefully if Claude returns plain text
    let reply = raw
    let action: EditAction | null = null

    try {
      const parsed = JSON.parse(raw) as { reply?: string; action?: EditAction | null }
      reply = String(parsed.reply ?? raw)
      action = parsed.action ?? null
    } catch {
      // Claude returned plain text — use as-is, no action
    }

    res.status(200).json({ reply, action })
  } catch (err) {
    console.error('[chat] Error:', err)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
