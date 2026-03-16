// api/generate.ts — Vercel Serverless Function (Node.js runtime)
//
// POST /api/generate
// Body: { idea: string }
// Returns: AppSpec JSON
//
// Self-contained: no imports from src/ or server/.

import Anthropic from '@anthropic-ai/sdk'

interface AppSpec {
  appName: string
  tagline: string
  primaryColor: string
  appType: 'landing-page' | 'saas' | 'waitlist'
  template: string
}

const EMPTY: AppSpec = {
  appName: '',
  tagline: '',
  primaryColor: '',
  appType: 'landing-page',
  template: '',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set' })
    return
  }

  let idea: string
  let email: string
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    idea  = (body?.idea  as string | undefined)?.trim() ?? ''
    email = (body?.email as string | undefined)?.trim() ?? ''
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  if (!idea) {
    res.status(400).json({ error: '`idea` is required' })
    return
  }

  // ── Rate limit: max 10 generate calls per email per 24 hours ──────────────
  // Only enforced when the caller supplies an email address.
  if (email) {
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const countRes = await fetch(
        `${supabaseUrl}/rest/v1/builds` +
          `?email=eq.${encodeURIComponent(email)}` +
          `&created_at=gt.${encodeURIComponent(since)}` +
          `&select=id`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: 'count=exact',
            Range: '0-0',
          },
        },
      )
      const contentRange = countRes.headers.get('content-range') ?? ''
      const countMatch = contentRange.match(/\/(\d+)$/)
      const todayCount = countMatch ? parseInt(countMatch[1], 10) : 0

      if (todayCount >= 10) {
        res.status(429).json({
          error: 'too_many_requests',
          message: 'Too many requests today. Try again tomorrow.',
        })
        return
      }
    }
  }

  try {
    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      tools: [
        {
          name: 'generate_app_spec',
          description: 'Generate a complete app specification from a founder idea',
          input_schema: {
            type: 'object' as const,
            properties: {
              appName: {
                type: 'string',
                description:
                  'Short, memorable app name relevant to the idea. 2–3 words max. No generic words like "App" or "Pro".',
              },
              tagline: {
                type: 'string',
                description:
                  'One compelling sentence (under 12 words) that explains the unique value proposition.',
              },
              primaryColor: {
                type: 'string',
                description:
                  'A hex color code that fits the mood and purpose of the app. e.g. #4F46E5 for a professional tool, #10B981 for a health app.',
              },
              appType: {
                type: 'string',
                enum: ['landing-page', 'saas', 'waitlist'],
                description:
                  'The best-fit app type. Use "waitlist" for early-stage ideas, "saas" for subscription tools, "landing-page" for everything else.',
              },
              template: {
                type: 'string',
                description:
                  'A complete, self-contained index.html string with beautiful inline CSS. Use the primaryColor for accents and CTAs. Show the appName as an h1, the tagline as a subtitle, and a prominent CTA button. Modern, clean, minimal design. No external dependencies — all styles inline.',
              },
            },
            required: ['appName', 'tagline', 'primaryColor', 'appType', 'template'],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'generate_app_spec' },
      messages: [
        {
          role: 'user',
          content: `You are a world-class product designer and startup advisor. A founder has described their idea. Generate a complete, compelling app specification.

Idea: "${idea}"

Make the appName memorable and specific to this idea. Write a tagline that could go on a YC application. Choose a primaryColor that reflects the app's personality. Build a beautiful template that could be shown to investors today.`,
        },
      ],
    })

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (!toolBlock) {
      throw new Error('No tool_use block in response — stop_reason: ' + response.stop_reason)
    }

    const spec = toolBlock.input as AppSpec
    res.status(200).json({
      appName: spec.appName,
      tagline: spec.tagline,
      primaryColor: spec.primaryColor,
      appType: spec.appType,
      template: spec.template,
    })
  } catch (err) {
    const message =
      err instanceof Anthropic.APIError
        ? `Anthropic API error ${err.status}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err)
    res.status(500).json({ ...EMPTY, error: message })
  }
}
