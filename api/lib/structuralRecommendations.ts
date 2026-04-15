// Brain 2.5 — Structural Recommendations
//
// Reads the static manifest + topology from a build and produces ranked,
// ready-to-paste edit instructions for what the app architecturally lacks.
// Single Haiku call — bounded JSON output, ~3s, fire-and-forget compatible.
//
// Called from api/edit.ts after every successful edit (alongside brainHint)
// and from api/brain-recommendations.ts on demand. Never throws — failure
// always returns an empty report so callers can swallow it without try/catch.

import Anthropic from '@anthropic-ai/sdk'
import type { AppManifest } from './generateManifest.js'
import type { AppTopology } from './buildTopology.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const MODEL_FAST = 'claude-haiku-4-5-20251001'

export interface StructuralRecommendation {
  id: string
  priority: 'p0' | 'p1' | 'p2'
  category:
    | 'missing_state'
    | 'missing_page'
    | 'broken_flow'
    | 'missing_feature'
    | 'accessibility'
    | 'mobile'
  title: string
  description: string
  editInstruction: string
  effort: 'dot' | 'line' | 'loop'
}

export interface RecommendationReport {
  buildId: string
  appName: string
  completenessScore: number
  recommendations: StructuralRecommendation[]
  generatedAt: string
}

const VALID_PRIORITIES = new Set(['p0', 'p1', 'p2'])
const VALID_CATEGORIES = new Set([
  'missing_state',
  'missing_page',
  'broken_flow',
  'missing_feature',
  'accessibility',
  'mobile',
])
const VALID_EFFORTS = new Set(['dot', 'line', 'loop'])

const SYSTEM_PROMPT = `You are Brain, Visila's co-founder intelligence layer.
You analyze the structural state of a generated app and produce specific,
actionable recommendations ordered by impact.

OUTPUT FORMAT: Respond only with valid JSON. No markdown fences. No preamble.
No trailing text. Schema:
{
  "recommendations": [
    {
      "id": "unique-kebab-id",
      "priority": "p0|p1|p2",
      "category": "missing_state|missing_page|broken_flow|missing_feature|accessibility|mobile",
      "title": "Short title, max 8 words",
      "description": "One sentence explaining the gap and why it matters to real users.",
      "editInstruction": "Exact instruction the founder can paste to fix this.",
      "effort": "dot|line|loop"
    }
  ]
}

Priority rules:
- p0: blocks real users (auth broken, no error states, broken nav, orphan pages)
- p1: hurts conversion or credibility (no empty states, no mobile nav, incomplete flows)
- p2: polish and completeness (accessibility, edge cases, additional pages)

Effort rules:
- dot: single component or text change — minutes
- line: one new section or state — hours
- loop: new page or major flow restructure — days

Rules:
- Return 3-7 recommendations maximum
- Order by priority then effort (p0 dot first, p2 loop last)
- Be specific — name the exact page, section, or feature
- Write editInstructions as direct commands the founder pastes into the edit box
- Good: "Add a loading skeleton to the Dashboard page while Supabase data fetches."
- Bad: "Consider adding loading states to improve UX."
- If the app looks genuinely complete, return 1-2 polish items — don't manufacture gaps`

function sanitiseRecommendation(
  raw: unknown,
  index: number,
): StructuralRecommendation | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const priority = typeof r.priority === 'string' && VALID_PRIORITIES.has(r.priority)
    ? (r.priority as StructuralRecommendation['priority'])
    : null
  const category = typeof r.category === 'string' && VALID_CATEGORIES.has(r.category)
    ? (r.category as StructuralRecommendation['category'])
    : null
  const effort = typeof r.effort === 'string' && VALID_EFFORTS.has(r.effort)
    ? (r.effort as StructuralRecommendation['effort'])
    : null
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  const description = typeof r.description === 'string' ? r.description.trim() : ''
  const editInstruction = typeof r.editInstruction === 'string' ? r.editInstruction.trim() : ''

  if (!priority || !category || !effort || !title || !description || !editInstruction) {
    return null
  }

  const id = typeof r.id === 'string' && r.id.trim()
    ? r.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60)
    : `rec-${index + 1}`

  return { id, priority, category, title, description, editInstruction, effort }
}

export async function generateRecommendations(
  buildId: string,
  appName: string,
  appIdea: string,
  category: string,
  manifest: AppManifest | null,
  topology: AppTopology | null,
): Promise<RecommendationReport> {
  const pages = manifest?.pages ?? []
  const features = manifest?.features ?? []
  const gaps = manifest?.completenessGaps ?? []
  const score = manifest?.completenessScore ?? 0
  const orphans = topology?.orphanPages ?? []
  const edges = topology?.edges ?? []
  const warnings = topology?.warnings ?? []

  const emptyReport: RecommendationReport = {
    buildId,
    appName,
    completenessScore: score,
    recommendations: [],
    generatedAt: new Date().toISOString(),
  }

  // No structural data to reason about — skip the API call entirely.
  if (pages.length === 0 && features.length === 0 && gaps.length === 0) {
    console.log('[structuralRecommendations] no manifest data, skipping')
    return emptyReport
  }

  const userMessage = `App: "${appName}"
Category: ${category}
Idea: ${appIdea.slice(0, 1000)}

Structural state:
- Completeness score: ${score}%
- Pages: ${pages.map((p) => `${p.name} (${p.route})`).join(', ') || 'none detected'}
- Features present: ${features.join(', ') || 'none detected'}
- Manifest gaps: ${gaps.join('; ') || 'none recorded'}
- Orphan pages (unreachable): ${orphans.join(', ') || 'none'}
- Navigation edges: ${edges.length} routes mapped
- Structural warnings: ${warnings.join('; ') || 'none'}

Produce structural recommendations.`

  try {
    const response = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .replace(/```json|```/g, '')
      .trim()

    // Defensive JSON extraction — Haiku occasionally prefixes with prose.
    const start = rawText.indexOf('{')
    const end = rawText.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      console.warn('[structuralRecommendations] no JSON object in response:', rawText.slice(0, 100))
      return emptyReport
    }
    const jsonSlice = rawText.slice(start, end + 1)

    const parsed = JSON.parse(jsonSlice) as { recommendations?: unknown[] }
    const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : []
    const recommendations: StructuralRecommendation[] = []
    rawRecs.forEach((raw, idx) => {
      const clean = sanitiseRecommendation(raw, idx)
      if (clean) recommendations.push(clean)
    })

    return {
      buildId,
      appName,
      completenessScore: score,
      recommendations: recommendations.slice(0, 7),
      generatedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[structuralRecommendations] failed:', err)
    return emptyReport
  }
}
