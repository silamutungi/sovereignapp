// api/generate.ts — Vercel Serverless Function (Node.js runtime)
//
// POST /api/generate
// Body: { idea: string, variationHint?: string, attempt?: number, email?: string }
// Returns: AppSpec JSON
//
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'
import { generateDesignSystem, mapCategory } from './_designSystem.js'
import { ACCESSIBILITY_RULES } from './lib/accessibility-rules.js'
import { buildContentLayer } from './lib/content-strategy.js'
import { UX_KNOWLEDGE_LAYER } from './lib/ux-knowledge.js'
import { SYSTEM_PROMPT } from './_systemPrompt.js'
import { resolveHeroImage } from './lib/images.js'
import { buildCategoryBrief, formatCategoryBriefForPrompt, detectIntent } from './lib/categoryIntelligence.js'
import { MANDATORY_PAGES, MANDATORY_PAGES_ENFORCEMENT } from './lib/mandatoryPages.js'
import { validateGenerated } from './lib/validateGenerated.js'
import { generateManifest } from './lib/generateManifest.js'
import { buildTopology } from './lib/buildTopology.js'
import { buildCompletenessContract } from './lib/completenessContract.js'
import { checkBuildQuota } from './lib/quotaCheck.js'

// Model constants — change here to swap models across the file
// MODEL_GENERATION: multi-file React app codegen (18+ files, structured tool call)
//   Sonnet handles complex multi-file generation reliably at ~80% lower cost than Opus
// MODEL_FAST: extraction, classification, summarization — not yet used in this file
export const MODEL_GENERATION = 'claude-sonnet-4-6'
export const MODEL_FAST = 'claude-haiku-4-5-20251001'

async function summarizeIfLong(idea: string): Promise<string> {
  const wordCount = idea.split(/\s+/).length;
  if (wordCount <= 800) return idea;

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return idea

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: MODEL_FAST,
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `You are summarizing a product idea for an app builder. Extract and preserve:
- What the app does (core purpose)
- Who it's for (target user)
- The 5-8 most important features
- Any specific technical requirements or integrations mentioned
- The business model if mentioned

Discard: company background, market analysis, competitive landscape, roadmap phases beyond MVP, team bios, funding details.

Respond with a concise product brief under 400 words. Do not add commentary.

PRODUCT IDEA:
${idea}`
    }]
  })

  const summary = response.content[0].type === 'text' ? response.content[0].text : idea;
  console.log(`[summarize] Compressed ${wordCount} words → ${summary.split(/\s+/).length} words`);
  return summary;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

// Allow up to 300 seconds — needed for multi-file generation on Vercel Pro
export const maxDuration = 800

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
  console.log('[generate] GENERATE_START', new Date().toISOString())
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
  let pendingBuildId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let brandTokensRaw: any
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    idea          = (body?.idea          as string | undefined)?.trim() ?? ''
    email         = (body?.email         as string | undefined)?.trim() ?? ''
    variationHint = (body?.variationHint as string | undefined)?.trim() ?? ''
    attempt       = typeof body?.attempt === 'number' ? body.attempt : 1
    pendingBuildId = (body?.pending_build_id as string | undefined)?.trim() ?? ''
    brandTokensRaw = body?.brand_tokens ?? null
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  // idea is required — but use explicit null/undefined check so empty strings
  // from brief extraction fallbacks don't incorrectly trigger 400
  if (idea === null || idea === undefined || idea === '') {
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

  // ── Plan-based build quota ────────────────────────────────────────────────
  if (email) {
    const quota = await checkBuildQuota(email)
    if (!quota.allowed) {
      res.status(402).json({
        error: 'quota_exceeded',
        message: quota.reason,
        current: quota.current,
        limit: quota.limit,
      })
      return
    }
  }

  // ── Summarize long ideas (800+ words) via Haiku ────────────────────────────
  let processedIdea = idea
  try {
    processedIdea = await summarizeIfLong(idea)
  } catch (summarizeErr) {
    console.warn('[generate] summarizeIfLong failed (non-fatal), using original idea:', summarizeErr instanceof Error ? summarizeErr.message : String(summarizeErr))
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
  const baseMessage = processedIdea.slice(0, 1500)
  const hint = variationHint
    ? `\n\nVARIATION INSTRUCTION (attempt ${attempt} of 3): ${variationHint}`
    : ''
  const userMessage = (baseMessage + hint + lessonContext).slice(0, MAX_COMBINED_LENGTH)

  // ── Create pending_specs row for polling clients ────────────────────────
  if (pendingBuildId) {
    try {
      const psUrl = process.env.SUPABASE_URL
      const psKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (psUrl && psKey) {
        await fetch(`${psUrl}/rest/v1/pending_specs`, {
          method: 'POST',
          headers: {
            apikey: psKey,
            Authorization: `Bearer ${psKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            id: pendingBuildId,
            spec: {},
            status: 'generating',
          }),
        })
      }
    } catch {
      console.warn('[generate] pending_specs insert failed (non-fatal)')
    }
  }

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

  // Immediate keepalive — prevents mobile proxies from timing out during pre-processing
  res.write(': keepalive\n\n')
  flush()

  // Await the write so large payloads are fully queued before we end the response
  const sendEvent = (data: object): Promise<void> =>
    new Promise<void>((resolve) => {
      const payload = `data: ${JSON.stringify(data)}\n\n`
      res.write(payload, () => { flush(); resolve() })
    })

  // Keepalive — fires every 8s through the ENTIRE request lifecycle including finalMessage().
  // 8s prevents browsers and proxies from treating the connection as idle.
  const keepalive = setInterval(() => {
    try {
      res.write(': keepalive\n\n')
      flush()
    } catch {
      // connection already closed — interval will be cleared below
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

    // ── Step 1b: Detect intent — app vs landing vs both ─────────────────────
    const intentType = detectIntent(userMessage)
    let intentInjection = ''
    if (intentType === 'app') {
      intentInjection = '\n\nINTENT: Build the authenticated product, not the marketing landing page. The primary page the user lands on after this URL should be the main app interface (dashboard, feed, or core tool). Include a landing/login page as the entry point, but the majority of pages must be the product itself. Build ALL pages described in the idea — do not summarise them as future work.\n'
    } else if (intentType === 'landing') {
      intentInjection = '\n\nINTENT: Build the marketing landing page. Focus on conversion, social proof, and sign-up flow.\n'
    } else {
      intentInjection = '\n\nINTENT: Build both the marketing landing page AND the core authenticated product interface. Minimum pages: landing, sign-in, and the primary app dashboard or tool.\n'
    }
    console.log('[generate] intentType:', intentType)

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

    // ── Step 2b: Category Intelligence — live web research via Haiku + web search ──
    // Timeout: 15s max — web search can hang indefinitely and eat the 300s budget
    let categoryBriefInjection = ''
    let designProfileInjection = ''
    let leapfrogFeatures: string[] = []
    try {
      console.log('[generate] building category brief for:', appCategory)
      const brief = await withTimeout(buildCategoryBrief(userMessage, appCategory), 15_000)
      if (brief) {
        categoryBriefInjection = formatCategoryBriefForPrompt(brief)
        leapfrogFeatures = brief.leapfrogOpportunities
        // Override static competitors with web-researched ones if available
        if (brief.competitorNames.length > 0) {
          competitors = brief.competitorNames
        }
        // Inject design vocabulary profile for this category
        if (brief.designProfile) {
          const dp = brief.designProfile
          designProfileInjection = `\n\n## DESIGN SYSTEM\n` +
            `UI Style: ${dp.style}\n` +
            `Color mood: ${dp.colorMood}\n` +
            `Suggested primary color: ${dp.primaryHex}\n` +
            `Font pairing: ${dp.fontPairing}\n` +
            `Layout pattern: ${dp.layoutPattern}\n` +
            `Key effects: ${dp.keyEffects}\n` +
            `Anti-patterns to avoid: ${dp.antiPatterns.join(', ')}\n`
        }
        console.log('[generate] category brief built, competitors:', brief.competitorNames)
      }
    } catch (e) {
      console.warn('[generate] category brief failed or timed out (non-fatal):', e instanceof Error ? e.message : String(e))
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
    // Timeout: 20s — image resolution should never block generation
    let heroImageUrl: string | null = null
    try {
      heroImageUrl = await withTimeout(
        resolveHeroImage(imagePrompt ?? userMessage.slice(0, 60)),
        20_000,
      )
    } catch (heroErr) {
      console.warn('[generate] hero image failed or timed out (non-fatal):', heroErr instanceof Error ? heroErr.message : String(heroErr))
    }

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

    const contentLayer = buildContentLayer(appCategory, userMessage.slice(0, 500)).slice(0, 1500)
    // TODO Phase 2: replace UX_KNOWLEDGE_LAYER with dynamic RAG retrieval
    // from Supabase vector store — query by build.idea + build.app_type
    // to inject the most relevant chunks from the 6 UX books at build time.
    // Static layer remains as fallback when RAG returns < 3 results.
    const uxLayer = UX_KNOWLEDGE_LAYER.slice(0, 2000)
    const a11yRules = ACCESSIBILITY_RULES.slice(0, 1000)
    const mandatoryPagesInjection = MANDATORY_PAGES[appCategory.toUpperCase()]
      ? '\n\n' + MANDATORY_PAGES[appCategory.toUpperCase()] + '\n\n' + MANDATORY_PAGES_ENFORCEMENT
      : ''

    // ── Fetch Brain wisdom for this category (best-effort, non-blocking) ──
    let brainWisdomInjection = ''
    try {
      const bwSupabaseUrl = process.env.SUPABASE_URL
      const bwServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (bwSupabaseUrl && bwServiceKey) {
        const bwController = new AbortController()
        const bwTimeout = setTimeout(() => bwController.abort(), 2000)
        const encodedType = encodeURIComponent(appCategory)
        const bwRes = await fetch(
          `${bwSupabaseUrl}/rest/v1/brain_patterns?app_type=eq.${encodedType}&pattern_type=eq.missing_feature&order=confidence.desc&limit=5&select=outcome,confidence`,
          {
            headers: { apikey: bwServiceKey, Authorization: `Bearer ${bwServiceKey}` },
            signal: bwController.signal,
          },
        )
        clearTimeout(bwTimeout)
        if (bwRes.ok) {
          const bwRows = await bwRes.json() as Array<{ outcome: string; confidence: number }>
          if (bwRows.length > 0) {
            brainWisdomInjection = '\n\nBRAIN WISDOM FOR ' + appCategory.toUpperCase() + ':\n' +
              'These features are commonly missed by founders in this category and regretted later. Build them now:\n' +
              bwRows.map((p) =>
                '- ' + p.outcome.replace(/_/g, ' ') +
                ' (' + Math.round(p.confidence * 100) + '% of founders needed this)',
              ).join('\n')
            console.log('[generate] injected', bwRows.length, 'brain wisdom patterns for', appCategory)
          }
        }
      }
    } catch {
      console.warn('[generate] brain wisdom fetch skipped (non-fatal)')
    }

    categoryBriefInjection = categoryBriefInjection.slice(0, 1500)
    competitiveContext = competitiveContext.slice(0, 500)

    // Completeness contract — tells Claude what a complete app looks like
    // before it writes a single line of code. Injected at position 3 in
    // finalUserMessage, immediately after the category intelligence brief
    // and before design/UX/accessibility layers. ~1200 chars per category.
    // Same CONTRACTS map is consumed by api/lib/generateManifest.ts so the
    // generation contract and the manifest verification share a source of truth.
    const completenessContractInjection =
      '\n\n' + buildCompletenessContract(appCategory) + '\n'

    // ── Brand token injection (founder's existing brand) ──────────────────────
    let brandInjection = ''
    if (brandTokensRaw && typeof brandTokensRaw === 'object' && brandTokensRaw.primaryColor) {
      const bt = brandTokensRaw as { primaryColor: string; secondaryColor?: string; backgroundColor?: string; fontFamily?: string; tone?: string; brandVoice?: string }
      brandInjection = '\n\nBRAND TOKENS — OVERRIDE DESIGN SYSTEM\n' +
        'The founder has an existing brand. Use these exact values.\n' +
        'These override all default color and font decisions.\n' +
        `Primary color: ${bt.primaryColor}\n` +
        (bt.secondaryColor ? `Secondary color: ${bt.secondaryColor}\n` : '') +
        (bt.backgroundColor ? `Background: ${bt.backgroundColor}\n` : '') +
        (bt.fontFamily ? `Font family: ${bt.fontFamily} — import from Google Fonts\n` : '') +
        `Tone: ${bt.tone ?? 'professional'}\n` +
        (bt.brandVoice ? `Brand voice: ${bt.brandVoice} — match this tone throughout.\n` : '') +
        'Rules:\n' +
        '- Use primaryColor as the main accent throughout\n' +
        '- All CSS custom properties must reference these values\n' +
        '- Do not invent new brand colors — use only what is provided and neutral whites/grays for the rest\n' +
        '- If fontFamily is provided, import it via Google Fonts CDN and use it for all headings'
      console.log('[generate] brand tokens injected:', bt.primaryColor, bt.fontFamily ?? 'no font')
    }

    const finalUserMessage = intentInjection + categoryBriefInjection + completenessContractInjection + designProfileInjection + brandInjection + mandatoryPagesInjection + brainWisdomInjection + userMessage + heroImageInjection + designSystemInjection.slice(0, 4000) + competitiveContext + contentLayer + uxLayer + a11yRules

    const preProcessingMs = Date.now() - startedAt
    console.log('[generate] STREAM_OPEN pre_processing_ms:', preProcessingMs,
      'finalUserMessage_chars:', finalUserMessage.length, 'target: <12000',
      'system_prompt_chars:', SYSTEM_PROMPT.length,
      'categoryBrief_chars:', categoryBriefInjection.length,
      'completenessContract_chars:', completenessContractInjection.length,
      'mandatoryPages_chars:', mandatoryPagesInjection.length,
      'designSystem_chars:', designSystemInjection.slice(0, 4000).length,
      'contentLayer_chars:', contentLayer.length,
      'uxLayer_chars:', uxLayer.length,
      'a11yRules_chars:', a11yRules.length,
    )
    // Guard: if pre-processing ate most of the budget, bail early rather than
    // opening a stream that will be killed mid-generation by Vercel timeout.
    if (preProcessingMs > 240_000) {
      console.error('[generate] pre-processing exceeded 240s, aborting to avoid timeout')
      await sendEvent({ type: 'error', error: 'Generation took too long — please try again with a simpler idea.' })
      endStream()
      return
    }
    const stream = client.messages.stream({
      // Sonnet 4.6: handles 18-file React/TS/Tailwind generation at ~80% lower cost than Opus.
      // Do not downgrade to Haiku — structured tool_use with 18 files requires Sonnet-class reasoning.
      model: MODEL_GENERATION,
      max_tokens: 64000,
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
              supabaseSchema: {
                type: 'string',
                description: 'CRITICAL: Every CREATE TABLE must use IF NOT EXISTS — CREATE TABLE IF NOT EXISTS table_name (...). Never omit IF NOT EXISTS. Multiple builds share the same database instance. GENERATE THIS LAST — after all files are complete. Complete Supabase SQL schema. Includes CREATE TABLE, ALTER TABLE ENABLE ROW LEVEL SECURITY, CREATE POLICY for all operations, and CREATE INDEX. Use auth.uid() = user_id for user-owned data. Use standard SQL compatible with PostgreSQL 15.',
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
    // Also send an SSE error event — finalMessage() will reject, but the client
    // may have already disconnected before the catch block runs.
    stream.on('error', (streamErr) => {
      console.error('[generate] Stream error event:', streamErr)
      void sendEvent({ type: 'error', error: 'Generation stream interrupted — please try again.' })
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

    // Progress pings — real SSE data events every 10s so browsers don't drop the connection.
    // SSE comments (: keepalive) are ignored by some browsers; data events are not.
    const generationPing = setInterval(() => {
      try {
        res.write('data: ' + JSON.stringify({ type: 'progress', message: 'Building your app...' }) + '\n\n')
        flush()
      } catch { /* connection closed */ }
    }, 10_000)

    let message: Anthropic.Message
    try {
      console.log('[generate] Awaiting finalMessage...')
      message = await stream.finalMessage()
      clearInterval(generationPing)
    } catch (streamError) {
      clearInterval(generationPing)
      console.error('[generate] stream error:', streamError)
      await sendEvent({ type: 'error', error: 'Generation failed — please try again with a shorter idea.' })
      endStream()
      return
    }
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

    // Pre-commit validation — static analysis, no AI, <100ms
    const fileMap: Record<string, string> = {}
    for (const f of spec.files) fileMap[f.path] = f.content
    const { files: correctedMap, fixes } = validateGenerated(fileMap)
    if (fixes.length > 0) {
      for (const fix of fixes) console.log('[generate] validateGenerated:', fix)
      spec.files = spec.files.map((f) => ({ ...f, content: correctedMap[f.path] ?? f.content }))
    }

    // App manifest — visila.json committed alongside src/. Pure static analysis,
    // no AI, no network. Non-fatal — generation continues if extraction fails.
    try {
      const manifestFileMap: Record<string, string> = {}
      for (const f of spec.files) manifestFileMap[f.path] = f.content
      const manifest = generateManifest(spec.appName, appCategory, manifestFileMap)
      const manifestJson = JSON.stringify(manifest, null, 2)
      const existingIdx = spec.files.findIndex((f) => f.path === 'visila.json')
      if (existingIdx >= 0) {
        spec.files[existingIdx] = { path: 'visila.json', content: manifestJson }
      } else {
        spec.files.push({ path: 'visila.json', content: manifestJson })
      }
      console.log('[generate] manifest:',
        manifest.completenessScore, '%',
        'pages:', manifest.pages.length,
        'features:', manifest.features.length,
        'gaps:', manifest.completenessGaps.length,
      )
    } catch (manifestErr) {
      console.error('[generate] manifest generation failed (non-fatal):', manifestErr)
    }

    // App topology — page nodes + navigation edges + orphan detection.
    // Logged here for visibility; persisted to builds in run-build.ts.
    try {
      const topologyFileMap: Record<string, string> = {}
      for (const f of spec.files) topologyFileMap[f.path] = f.content
      const topology = buildTopology(topologyFileMap)
      console.log('[generate] topology:',
        topology.nodes.length, 'pages,',
        topology.edges.length, 'edges,',
        topology.orphanPages.length, 'orphans',
      )
      if (topology.warnings.length > 0) {
        console.warn('[generate] topology warnings:', topology.warnings.join(' | '))
      }
    } catch (topologyErr) {
      console.error('[generate] topology generation failed (non-fatal):', topologyErr)
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
        leapfrogFeatures,
      },
    }
    const doneJson = JSON.stringify(donePayload)

    // Empty result guard — if the entire payload is suspiciously small,
    // the generation likely produced truncated or degenerate output.
    if (doneJson.length < 100) {
      console.error('[generate] empty result guard: payload_bytes:', doneJson.length)
      await sendEvent({ type: 'error', error: 'Generation failed — please try again with a shorter idea.' })
      endStream()
      return
    }

    console.log('[generate] Sending done event, payload_bytes:', doneJson.length)
    await sendEvent(donePayload)
    console.log('[generate] Done event write callback fired, ending stream. elapsed_ms:', Date.now() - startedAt)

    // Save spec to pending_specs for polling clients (decoupled from SSE)
    if (pendingBuildId) {
      try {
        const psUrl = process.env.SUPABASE_URL
        const psKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (psUrl && psKey) {
          await fetch(`${psUrl}/rest/v1/pending_specs?id=eq.${encodeURIComponent(pendingBuildId)}`, {
            method: 'PATCH',
            headers: {
              apikey: psKey,
              Authorization: `Bearer ${psKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ spec: donePayload.spec, status: 'done' }),
          })
          console.log('[generate] spec saved to pending_specs for polling:', pendingBuildId)
        }
      } catch (psErr) {
        console.warn('[generate] pending_specs save failed (non-fatal):', psErr)
      }
    }

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

    // Save error to pending_specs for polling clients
    if (pendingBuildId) {
      try {
        const psUrl = process.env.SUPABASE_URL
        const psKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (psUrl && psKey) {
          await fetch(`${psUrl}/rest/v1/pending_specs?id=eq.${encodeURIComponent(pendingBuildId)}`, {
            method: 'PATCH',
            headers: {
              apikey: psKey,
              Authorization: `Bearer ${psKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ status: 'error', error: errMsg }),
          })
        }
      } catch { /* non-fatal */ }
    }

    endStream()
  }
}
