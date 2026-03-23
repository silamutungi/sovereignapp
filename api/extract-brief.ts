// api/extract-brief.ts — Vercel Serverless Function
//
// POST /api/extract-brief
// Body: { idea: string }
// Returns: AppBrief | { skipped: true, idea: string } | { error: 'extraction_failed', idea: string }
//
// Extracts a structured brief from a long-form idea before OAuth begins.
// Short ideas (under 200 chars, no newlines) are returned as-is — no API call.
//
// Rate limit: 60 requests per hour per IP

import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'

// MODEL_FAST: brief extraction is classification + summarization — bounded JSON output under 500 tokens.
// Haiku is sufficient for this task and is ~3x cheaper than Sonnet.
// Do not upgrade to Sonnet — the output schema is fixed and the task requires no complex reasoning.
export const MODEL_FAST = 'claude-haiku-4-5-20251001'

// SECURITY AUDIT
// - Rate limited: 60/hr per IP
// - idea capped at 5000 chars before sending to API
// - No secrets exposed in responses
// - JSON parse failure returns safe fallback — never throws to client

const SYSTEM_PROMPT = `You are an app brief extractor for Sovereign, a platform that builds and deploys real apps. Extract the core app intent from the user's input into a structured brief. Return JSON only — no markdown, no preamble, no backticks.

Required format:
{
  "name": "inferred app name (2 words max, Title Case)",
  "description": "one sentence, plain English, 8th grade reading level",
  "target_user": "who this is for in 5 words or less",
  "features": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "entities": ["entity 1", "entity 2", "entity 3"],
  "tone": "minimal | bold | playful | professional | warm"
}

Rules:
- Maximum 5 features, pick the most essential
- Maximum 5 entities (database tables)
- If the input is already short and clear, return it faithfully
- Never invent features not implied by the input
- Features should be user-facing actions, not technical details`

export interface AppBrief {
  name: string
  description: string
  target_user: string
  features: string[]
  entities: string[]
  tone: 'minimal' | 'bold' | 'playful' | 'professional' | 'warm'
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const config = { api: { bodyParser: { sizeLimit: '100kb' } } }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    'unknown'

  const rl = checkRateLimit(`extract-brief:${ip}`, 60, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: `Too many requests. Retry after ${rl.retryAfter ?? 3600}s.` })
    return
  }

  const { idea } = (req.body ?? {}) as { idea?: unknown }

  if (!idea || typeof idea !== 'string' || !idea.trim()) {
    res.status(400).json({ error: 'idea is required' })
    return
  }

  // Short, simple ideas don't need extraction — return immediately without an API call
  if (idea.length < 200 && !idea.includes('\n')) {
    res.status(200).json({ skipped: true, idea })
    return
  }

  const truncated = idea.slice(0, 5000)

  try {
    const msg = await anthropic.messages.create({
      // MODEL_FAST: brief extraction is classification + summarization — haiku is sufficient, 3x cheaper than sonnet
      model: MODEL_FAST,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: truncated }],
    })

    const raw = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    try {
      const brief = JSON.parse(raw) as AppBrief
      res.status(200).json(brief)
    } catch {
      // Haiku returned malformed JSON — fall back to raw idea so caller can proceed
      console.error('[extract-brief] JSON parse failed, raw:', raw.slice(0, 200))
      res.status(200).json({ error: 'extraction_failed', idea })
    }
  } catch (err) {
    console.error('[extract-brief] API error:', err)
    res.status(200).json({ error: 'extraction_failed', idea })
  }
}
