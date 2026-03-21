// api/generate.ts — Vercel Serverless Function (Node.js runtime)
//
// POST /api/generate
// Body: { idea: string, variationHint?: string, attempt?: number, email?: string }
// Returns: AppSpec JSON
//
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'
import { SYSTEM_PROMPT } from './_systemPrompt.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

interface NextStep {
  title: string
  description: string
  action: string
  priority: 'high' | 'medium' | 'low'
}

interface AppSpec {
  appName: string
  tagline: string
  primaryColor: string
  appType: 'landing-page' | 'saas' | 'waitlist'
  template: string
  tier: 'SIMPLE' | 'STANDARD' | 'COMPLEX'
  activeStandards: string[]
  nextSteps: NextStep[]
}

const EMPTY: AppSpec = {
  appName: '',
  tagline: '',
  primaryColor: '',
  appType: 'landing-page',
  template: '',
  tier: 'SIMPLE',
  activeStandards: [],
  nextSteps: [],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown'
  const ipRl = checkRateLimit(`generate:${ip}`, 20, 60 * 60 * 1000)
  if (!ipRl.allowed) {
    res.setHeader('Retry-After', String(ipRl.retryAfter ?? 3600))
    res.status(429).json({ error: `Too many requests. Retry after ${ipRl.retryAfter ?? 3600}s.` })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set' })
    return
  }

  let idea: string
  let email: string
  let variationHint: string
  let attempt: number
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    idea          = (body?.idea          as string | undefined)?.trim() ?? ''
    email         = (body?.email         as string | undefined)?.trim() ?? ''
    variationHint = (body?.variationHint as string | undefined)?.trim() ?? ''
    attempt       = typeof body?.attempt === 'number' ? body.attempt : 1
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  if (!idea) {
    res.status(400).json({ error: '`idea` is required' })
    return
  }

  const MAX_IDEA_LENGTH = 2000
  if (idea.length > MAX_IDEA_LENGTH) {
    res.status(400).json({
      error: `Your idea description is too long. Please keep it under ${MAX_IDEA_LENGTH} characters (yours is ${idea.length}).`,
    })
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
          `&deleted_at=is.null` +
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

  // ── Build user message with combined length cap ──────────────────────────
  const MAX_COMBINED_LENGTH = 3000
  const baseMessage = idea.slice(0, 2500)
  const hint = variationHint
    ? `\n\nVARIATION INSTRUCTION (attempt ${attempt} of 3): ${variationHint}`
    : ''
  const userMessage = (baseMessage + hint).slice(0, MAX_COMBINED_LENGTH)

  try {
    const client = new Anthropic({ apiKey })

    // ── Inner try/catch: isolate Anthropic API errors from logic errors ────
    let response: Awaited<ReturnType<typeof client.messages.create>>
    try {
      response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
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
              tier: {
                type: 'string',
                enum: ['SIMPLE', 'STANDARD', 'COMPLEX'],
                description:
                  'The complexity tier assigned to this app based on its idea. SIMPLE = personal/portfolio/landing, STANDARD = SaaS/membership/booking, COMPLEX = fintech/multi-user/e-commerce.',
              },
              activeStandards: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'List of standard names activated for this app, e.g. ["design", "accessibility", "seo", "performance", "content", "legal"]. Include all that apply based on the tier and app context.',
              },
              nextSteps: {
                type: 'array',
                description: 'Exactly 3 recommended next steps tailored to this specific app, ordered by impact.',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Short action title — under 8 words.' },
                    description: { type: 'string', description: 'One sentence. Specific to this app. What it does and why it matters.' },
                    action: {
                      type: 'string',
                      enum: [
                        'connect_domain', 'add_analytics', 'add_monitoring', 'add_auth',
                        'add_payments', 'add_email', 'invite_collaborator', 'add_seo',
                        'add_backup', 'upgrade_pro', 'add_staging', 'add_tests',
                      ],
                    },
                    priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  },
                  required: ['title', 'description', 'action', 'priority'],
                  additionalProperties: false,
                },
              },
            },
            required: ['appName', 'tagline', 'primaryColor', 'appType', 'template', 'tier', 'activeStandards', 'nextSteps'],
            additionalProperties: false,
          },
        },
      ],
        tool_choice: { type: 'tool', name: 'generate_app_spec' },
        messages: [
          {
            role: 'user',
            content: `Idea: "${userMessage}"`,
          },
        ],
      })
    } catch (anthropicErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ae = anthropicErr as any
      console.error('[generate] Anthropic error status:', ae?.status)
      console.error('[generate] Anthropic error message:', ae?.message)
      console.error('[generate] Anthropic error_type:', ae?.error?.type)
      console.error('[generate] Anthropic error_message:', ae?.error?.message)
      console.error('[generate] Prompt chars:', userMessage.length)
      console.error('[generate] Anthropic full:', JSON.stringify(anthropicErr, Object.getOwnPropertyNames(anthropicErr as object)))
      if (ae?.status === 400) {
        res.status(400).json({ error: 'Your idea is too detailed for one generation. Try a shorter description.' })
        return
      }
      if (ae?.status === 413) {
        res.status(413).json({ error: 'Prompt too large. Please shorten your idea and try again.' })
        return
      }
      if (ae?.status === 429) {
        res.status(429).json({ error: 'Generation service rate limit reached. Try again in a moment.' })
        return
      }
      if (ae?.status === 529 || ae?.status === 503) {
        res.status(503).json({ error: 'Generation service is busy. Please try again in a moment.' })
        return
      }
      throw anthropicErr
    }

    console.log('[generate] stop_reason:', response.stop_reason, 'input_tokens:', response.usage.input_tokens, 'output_tokens:', response.usage.output_tokens)

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (!toolBlock) {
      throw new Error('No tool_use block in response — stop_reason: ' + response.stop_reason)
    }

    const spec = toolBlock.input as AppSpec
    console.log('[generate] spec keys:', Object.keys(spec))
    console.log('[generate] template present:', !!spec.template, 'length:', spec.template?.length ?? 0)

    if (!spec.template) {
      throw new Error(`template missing from tool output — stop_reason: ${response.stop_reason}, output_tokens: ${response.usage.output_tokens}`)
    }

    res.status(200).json({
      appName: spec.appName,
      tagline: spec.tagline,
      primaryColor: spec.primaryColor,
      appType: spec.appType,
      template: spec.template,
      tier: spec.tier ?? 'SIMPLE',
      activeStandards: spec.activeStandards ?? [],
      nextSteps: spec.nextSteps ?? [],
    })
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any
    console.error('[generate] UNCAUGHT ERROR')
    console.error('[generate] type:', anyErr?.constructor?.name)
    console.error('[generate] message:', anyErr?.message)
    console.error('[generate] status:', anyErr?.status)
    console.error('[generate] error_type:', anyErr?.error?.type)
    console.error('[generate] error_message:', anyErr?.error?.message)
    console.error('[generate] prompt chars:', typeof userMessage === 'string' ? userMessage.length : 'unknown')
    console.error('[generate] full error:', JSON.stringify(err, Object.getOwnPropertyNames(err as object)))
    const message =
      err instanceof Anthropic.APIError
        ? `Anthropic API error ${err.status}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err)
    res.status(500).json({ ...EMPTY, error: message })
  }
}
