// api/generate.ts — Vercel Serverless Function (Node.js runtime)
//
// POST /api/generate
// Body: { idea: string, variationHint?: string, attempt?: number, email?: string }
// Returns: AppSpec JSON
//
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'
import { generateDesignSystem, mapCategory } from './_designSystem.js'
import { SYSTEM_PROMPT } from './_systemPrompt.js'
import { resolveHeroImage } from './lib/images.js'

// Model constants — change here to swap models across the file
// MODEL_GENERATION: multi-file React app codegen (18+ files, structured tool call)
//   Sonnet handles complex multi-file generation reliably at ~80% lower cost than Opus
// MODEL_FAST: extraction, classification, summarization — not yet used in this file
export const MODEL_GENERATION = 'claude-sonnet-4-6'
export const MODEL_FAST = 'claude-haiku-4-5-20251001'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

// Allow up to 300 seconds — needed for multi-file generation on Vercel Pro
export const maxDuration = 300

interface NextStep {
  title: string
  description: string
  action: string
  priority: 'high' | 'medium' | 'low'
}

interface AppFileEntry {
  path: string
  content: string
}

interface AppSpec {
  appName: string
  tagline: string
  primaryColor: string
  appType: 'landing-page' | 'saas' | 'marketplace' | 'social' | 'tool' | 'ecommerce'
  files: AppFileEntry[]
  supabaseSchema: string
  setupInstructions: string
  tier: 'SIMPLE' | 'STANDARD' | 'COMPLEX'
  activeStandards: string[]
  nextSteps: NextStep[]
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
        res.setHeader('Retry-After', '86400')
        res.status(429).json({
          error: 'too_many_requests',
          message: 'Too many requests today. Try again tomorrow.',
        })
        return
      }
    }
  }

  // ── Fetch top recurring lessons from Brain (best-effort, non-blocking) ─────
  // Lessons with build_count >= 3 are confirmed recurring patterns. Injecting
  // them into the user message (not system prompt) preserves prompt caching
  // while ensuring Claude applies the most-needed fixes proactively.
  let lessonContext = ''
  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      const lessonRes = await fetch(
        `${supabaseUrl}/rest/v1/lessons?solution=neq.&build_count=gte.3&order=build_count.desc&select=solution,category&limit=8`,
        {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
          signal: controller.signal,
        },
      )
      clearTimeout(timeout)
      if (lessonRes.ok) {
        const rows = await lessonRes.json() as Array<{ solution: string; category: string }>
        if (rows.length > 0) {
          lessonContext = '\n\nRECURRING LESSONS FROM PRODUCTION (apply these proactively in every generated app):\n' +
            rows.map((r) => `- [${r.category}] ${r.solution}`).join('\n')
          console.log('[generate] injected', rows.length, 'recurring lessons into context')
        }
      }
    }
  } catch {
    // Non-fatal — skip lesson injection, proceed with generation
    console.warn('[generate] lesson fetch skipped (non-fatal)')
  }

  // ── Build user message with combined length cap ──────────────────────────
  const MAX_COMBINED_LENGTH = 3500
  const baseMessage = idea.slice(0, 2500)
  const hint = variationHint
    ? `\n\nVARIATION INSTRUCTION (attempt ${attempt} of 3): ${variationHint}`
    : ''
  const userMessage = (baseMessage + hint + lessonContext).slice(0, MAX_COMBINED_LENGTH)

  // ── All validation passed — switch to SSE streaming ─────────────────────
  const startedAt = Date.now()
  console.log('[generate] SSE start, idea_chars:', userMessage.length, 'time:', new Date().toISOString())

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  // Disable gzip — compression buffers the entire stream and defeats SSE
  res.setHeader('Content-Encoding', 'identity')
  res.flushHeaders()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flush = () => { if (typeof (res as any).flush === 'function') (res as any).flush() }

  // Await the write so large payloads are fully queued before we end the response
  const sendEvent = (data: object): Promise<void> =>
    new Promise<void>((resolve) => {
      const payload = `data: ${JSON.stringify(data)}\n\n`
      res.write(payload, () => { flush(); resolve() })
    })

  // SSE keepalive — prevents Vercel edge / proxies from dropping idle connections
  const keepalive = setInterval(() => {
    try {
      res.write(': keepalive\n\n')
      flush()
    } catch {
      // connection already closed — interval will be cleared in finally
    }
  }, 8_000)

  const endStream = () => {
    clearInterval(keepalive)
    res.end()
  }

  await sendEvent({ type: 'progress', message: 'Designing your app…' })

  // ── Layer 1: Input moderation (fail open — if the call errors, continue) ──
  try {
    const moderationClient = new Anthropic({ apiKey })
    const modRes = await moderationClient.messages.create({
      model: MODEL_FAST,
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `You are a content moderator. Does this app idea request anything that is: adult content, pornography, gambling, weapons, drugs, illegal activity, or hate speech?

App idea: ${userMessage.slice(0, 500)}

Return only JSON: { "flagged": boolean, "reason": string }
If not flagged, reason should be empty string.`,
      }],
    })
    const modRaw = modRes.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()
    const modMatch = modRaw.match(/\{[\s\S]*?\}/)
    if (modMatch) {
      const modParsed = JSON.parse(modMatch[0]) as { flagged: boolean; reason: string }
      if (modParsed.flagged === true) {
        console.log('[generate] moderation flagged:', modParsed.reason)
        await sendEvent({ type: 'error', error: "We can't build that. Visila is for legitimate businesses only." })
        endStream()
        return
      }
    }
  } catch {
    // Fail open — moderation error must not block legitimate users
    console.warn('[generate] moderation check failed (non-fatal), continuing')
  }

  const PROGRESS_THRESHOLDS = [2000, 5000, 9000, 12000]
  const PROGRESS_MESSAGES = [
    'Writing your landing page…',
    'Building auth and dashboard…',
    'Creating your database schema…',
    'Finishing up…',
  ]

  // ── MIGRATION: run in Supabase SQL Editor before deploying ─────────────
  // ALTER TABLE builds ADD COLUMN IF NOT EXISTS app_category text;
  // ALTER TABLE builds ADD COLUMN IF NOT EXISTS parity_features jsonb;
  // ALTER TABLE builds ADD COLUMN IF NOT EXISTS competitors jsonb;

  try {
    const client = new Anthropic({ apiKey })

    // ── Helper: race a promise against a timeout ───────────────────────────
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
        ),
      ])

    // ── Step 1: Classify app category and identify top competitors ─────────
    let appCategory = 'other'
    let competitors: string[] = []
    let parityFeatures: string[] = []

    try {
      const classifyMsg = await withTimeout(
        client.messages.create({
          model: MODEL_FAST,
          max_tokens: 150,
          messages: [{
            role: 'user',
            content: `Classify this app idea into one of these categories: saas, marketplace, social, ecommerce, tool, content, game, productivity, finance, health, other\n\nApp idea: ${userMessage.slice(0, 300)}\n\nReturn only JSON: { "category": string, "competitors": ["name1", "name2", "name3"] }\nList the 3 most well-known direct competitors. If none exist, return empty array.`,
          }],
        }),
        3000,
      )
      const classifyRaw = classifyMsg.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('')
        .trim()
      const classifyMatch = classifyRaw.match(/\{[\s\S]*?\}/)
      if (classifyMatch) {
        const parsed = JSON.parse(classifyMatch[0]) as { category: string; competitors: string[] }
        appCategory = parsed.category ?? 'other'
        competitors = Array.isArray(parsed.competitors) ? parsed.competitors.slice(0, 3) : []
        console.log('[generate] category:', appCategory, 'competitors:', competitors.join(', '))
      }
    } catch (classifyErr) {
      console.warn('[generate] category classification failed (non-fatal):', classifyErr instanceof Error ? classifyErr.message : String(classifyErr))
    }

    // ── Step 2: Research parity features for top 2 competitors ─────────────
    if (competitors.length > 0) {
      const topTwo = competitors.slice(0, 2)
      const featureSets: string[][] = []

      for (const competitor of topTwo) {
        try {
          const featureMsg = await withTimeout(
            client.messages.create({
              model: MODEL_FAST,
              max_tokens: 150,
              messages: [{
                role: 'user',
                content: `What are the 5 core features that make ${competitor} valuable to its users? Return only a JSON array of feature names, max 5 items, no explanation.`,
              }],
            }),
            3000,
          )
          const featureRaw = featureMsg.content
            .filter((b) => b.type === 'text')
            .map((b) => (b as { type: 'text'; text: string }).text)
            .join('')
            .trim()
          const featureMatch = featureRaw.match(/\[[\s\S]*?\]/)
          if (featureMatch) {
            const features = JSON.parse(featureMatch[0]) as string[]
            if (Array.isArray(features)) featureSets.push(features.filter((f) => typeof f === 'string'))
          }
        } catch (featureErr) {
          console.warn(`[generate] feature fetch for "${competitor}" failed (non-fatal):`, featureErr instanceof Error ? featureErr.message : String(featureErr))
        }
      }

      // Deduplicate features across competitors
      const seen = new Set<string>()
      for (const set of featureSets) {
        for (const f of set) {
          const key = f.toLowerCase().trim()
          if (!seen.has(key)) {
            seen.add(key)
            parityFeatures.push(f)
          }
        }
      }
      console.log('[generate] parity features identified:', parityFeatures.length)
    }

    // ── Step 3: Build competitive context string for injection ──────────────
    let competitiveContext = ''
    if (parityFeatures.length > 0) {
      competitiveContext = `\n\nCOMPETITIVE CONTEXT:\nThis app competes with: ${competitors.join(', ')}\nCore parity features to include: ${parityFeatures.join(', ')}\nBuild all parity features into the initial app. Do not mention competitors in the UI copy.`
    } else if (appCategory !== 'other') {
      competitiveContext = `\n\nAPP CATEGORY: ${appCategory}\nBuild the standard features expected for this category.`
    }

    // ── Design system generation ────────────────────────────────────────────
    // Haiku generates a named, WCAG AA-compliant palette per app
    const designCategory = mapCategory(appCategory)
    let designSystemCSS = ''
    let designSystemMood = ''
    try {
      const ds = await generateDesignSystem(
        userMessage.slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, '').trim(),
        userMessage,
        designCategory,
      )
      designSystemCSS = ds.css
      designSystemMood = ds.mood
      console.log('[generate] design system:', ds.palette_name, '| mood:', ds.mood)
    } catch (dsErr) {
      console.warn('[generate] design system failed (non-fatal):', dsErr instanceof Error ? dsErr.message : String(dsErr))
    }

    // ── Hero image resolution ─────────────────────────────────────────────────
    // Priority: Gemini → OpenAI → Unsplash → Pexels → null
    // All logic lives in api/lib/images.ts

    // Step 1 — Generate image prompt via Haiku
    let imagePrompt: string | null = null
    try {
      const imgPromptRes = await client.messages.create({
        model: MODEL_FAST,
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `The user wants to build this app: ${userMessage.slice(0, 500)}

Write a single image generation prompt for a hero image for this app's landing page. The image should:
- Be photorealistic and high quality
- Visually represent what the app does or the feeling it creates
- Work as a full-width hero background (landscape orientation)
- Have a clean area for text overlay (not too busy)
- Feel premium, editorial, and brand-appropriate

Return only the image prompt text, nothing else. Max 100 words.`
        }]
      })
      imagePrompt = (imgPromptRes.content[0] as { type: string; text: string }).text.trim()
      console.log('[generate] image prompt:', imagePrompt.slice(0, 80))
    } catch (e) {
      console.log('[generate] image prompt generation failed:', e)
    }

    // Step 2 — Resolve hero image (Gemini → OpenAI → Unsplash → Pexels → null)
    const heroImageUrl = await resolveHeroImage(imagePrompt ?? userMessage.slice(0, 60))

    // Inject the permanent hero URL into the user message.
    // Claude reads HERO_IMAGE_URL and uses it as-is — no URL generation needed.
    const heroImageInjection = heroImageUrl
      ? `\n\nHERO_IMAGE_URL = ${heroImageUrl}`
      : ''

    // Inject the design system CSS so Sonnet uses these tokens in src/index.css
    // instead of the default Visila palette from the system prompt.
    const designSystemInjection = designSystemCSS
      ? `\n\nDESIGN_SYSTEM_CSS — Use this EXACT CSS in src/index.css instead of the default :root block:\n${designSystemCSS}\n\nDESIGN_MOOD: ${designSystemMood}. Let this mood inform typography weight, spacing density, and animation choices.`
      : ''

    const finalUserMessage = userMessage + heroImageInjection + designSystemInjection + competitiveContext

    console.log('[generate] Creating Anthropic stream...')
    const stream = client.messages.stream({
      // Sonnet 4.6: handles 18-file React/TS/Tailwind generation at ~80% lower cost than Opus.
      // Do not downgrade to Haiku — structured tool_use with 18 files requires Sonnet-class reasoning.
      model: MODEL_GENERATION,
      max_tokens: 24000,
      // Prompt caching: cache_control marks the system prompt as cacheable.
      // Anthropic caches it for ~5 minutes. The system prompt is ~6000 tokens — caching it
      // reduces input token costs by ~90% on repeated generation calls.
      // Format: array of TextBlockParam instead of plain string.
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [
        {
          name: 'generate_app_spec',
          description: 'Generate a complete multi-file React/TS/Tailwind/Supabase app from a founder idea',
          input_schema: {
            type: 'object' as const,
            properties: {
              files: {
                type: 'array',
                description: 'GENERATE THIS FIRST. Complete array of all 18 Phase 1 scaffold files. Every file must have complete, working content — never truncated, never placeholder. Write all 18 files before writing supabaseSchema.',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string', description: 'File path relative to repo root, e.g. "src/pages/Home.tsx"' },
                    content: { type: 'string', description: 'Complete file content. No comments. No console.log. No placeholder text. Under 100 lines per component where possible.' },
                  },
                  required: ['path', 'content'],
                  additionalProperties: false,
                },
              },
              appName: {
                type: 'string',
                description: 'Short, memorable app name relevant to the idea. 2–3 words max. No generic words like "App" or "Pro".',
              },
              tagline: {
                type: 'string',
                description: 'One compelling sentence (under 12 words) that explains the unique value proposition.',
              },
              primaryColor: {
                type: 'string',
                description: 'A hex color code that fits the mood and purpose of the app. e.g. #4F46E5 for a professional tool, #10B981 for a health app.',
              },
              appType: {
                type: 'string',
                enum: ['landing-page', 'saas', 'marketplace', 'social', 'tool', 'ecommerce'],
                description: 'The best-fit app type. landing-page = public-facing site only, saas = subscription service, marketplace = buyers and sellers, social = community/network, tool = single-purpose utility, ecommerce = product sales.',
              },
              supabaseSchema: {
                type: 'string',
                description: 'Complete Supabase SQL schema. Includes CREATE TABLE, ALTER TABLE ENABLE ROW LEVEL SECURITY, CREATE POLICY for all operations, and CREATE INDEX. Use auth.uid() = user_id for user-owned data. Use standard SQL compatible with PostgreSQL 15.',
              },
              setupInstructions: {
                type: 'string',
                description: 'Numbered plain-English steps for the owner to activate the app after deployment. Always includes: create Supabase project, run the SQL schema, set environment variables in Vercel, any app-specific configuration steps.',
              },
              tier: {
                type: 'string',
                enum: ['SIMPLE', 'STANDARD', 'COMPLEX'],
                description: 'SIMPLE = personal/portfolio/landing, STANDARD = SaaS/membership/booking, COMPLEX = fintech/multi-user/e-commerce.',
              },
              activeStandards: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of standard names activated for this app based on tier and context.',
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
            required: ['appName', 'tagline', 'primaryColor', 'appType', 'files', 'supabaseSchema', 'setupInstructions', 'tier', 'activeStandards', 'nextSteps'],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'generate_app_spec' },
      messages: [
        {
          role: 'user',
          content: `Idea: "${finalUserMessage}"`,
        },
      ],
    })

    // Log stream-level errors (connection drops, API errors mid-stream)
    stream.on('error', (streamErr) => {
      console.error('[generate] Stream error event:', streamErr)
    })

    let nextThresholdIdx = 0
    let inputJsonChars = 0
    stream.on('inputJson', (_delta: string, snapshot: unknown) => {
      inputJsonChars = typeof snapshot === 'string' ? snapshot.length : 0
      while (
        nextThresholdIdx < PROGRESS_THRESHOLDS.length &&
        inputJsonChars >= PROGRESS_THRESHOLDS[nextThresholdIdx]
      ) {
        // Fire-and-forget progress events — don't await inside a sync callback
        void sendEvent({ type: 'progress', message: PROGRESS_MESSAGES[nextThresholdIdx] })
        nextThresholdIdx++
      }
    })

    console.log('[generate] Awaiting finalMessage...')
    const message = await stream.finalMessage()
    const elapsed = Date.now() - startedAt
    console.log(
      '[generate] finalMessage resolved:',
      'stop_reason:', message.stop_reason,
      'input_tokens:', message.usage.input_tokens,
      'output_tokens:', message.usage.output_tokens,
      'elapsed_ms:', elapsed,
      'inputJson_chars:', inputJsonChars,
    )

    const toolBlock = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (!toolBlock) {
      console.error('[generate] No tool_use block. Content types:', message.content.map(b => b.type))
      await sendEvent({ type: 'error', error: `No tool_use block in response — stop_reason: ${message.stop_reason}` })
      endStream()
      return
    }

    const spec = toolBlock.input as AppSpec
    console.log(
      '[generate] spec:',
      'files:', spec.files?.length ?? 0,
      'supabaseSchema_chars:', spec.supabaseSchema?.length ?? 0,
      'keys:', Object.keys(spec).join(','),
    )

    if (!spec.files || spec.files.length === 0) {
      console.error('[generate] files array empty. stop_reason:', message.stop_reason, 'output_tokens:', message.usage.output_tokens)
      await sendEvent({ type: 'error', error: `files array missing or empty — stop_reason: ${message.stop_reason}, output_tokens: ${message.usage.output_tokens}` })
      endStream()
      return
    }

    const donePayload = {
      type: 'done',
      spec: {
        appName: spec.appName,
        tagline: spec.tagline,
        primaryColor: spec.primaryColor,
        appType: spec.appType,
        files: spec.files,
        supabaseSchema: spec.supabaseSchema ?? '',
        setupInstructions: spec.setupInstructions ?? '',
        tier: spec.tier ?? 'SIMPLE',
        activeStandards: spec.activeStandards ?? [],
        nextSteps: spec.nextSteps ?? [],
        appCategory,
        competitors,
        parityFeatures,
        heroImageUrl: heroImageUrl ?? null,
      },
    }
    const doneJson = JSON.stringify(donePayload)
    console.log('[generate] Sending done event, payload_bytes:', doneJson.length)
    await sendEvent(donePayload)
    console.log('[generate] Done event write callback fired, ending stream. elapsed_ms:', Date.now() - startedAt)
    endStream()
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any
    const elapsed = Date.now() - startedAt
    console.error('[generate] CAUGHT ERROR after', elapsed, 'ms')
    console.error('[generate] error type:', anyErr?.constructor?.name)
    console.error('[generate] error message:', anyErr?.message)
    console.error('[generate] error status:', anyErr?.status)
    console.error('[generate] error.error:', JSON.stringify(anyErr?.error))
    console.error('[generate] prompt chars:', typeof userMessage === 'string' ? userMessage.length : 'unknown')
    const errMsg =
      err instanceof Anthropic.APIError
        ? `Anthropic API error ${err.status}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err)
    await sendEvent({ type: 'error', error: errMsg })
    endStream()
  }
}
