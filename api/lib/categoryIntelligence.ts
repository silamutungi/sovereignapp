import Anthropic from '@anthropic-ai/sdk'
import { matchDesignProfile, type DesignProfile } from './designVocabulary.js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export type IntentType = 'app' | 'landing' | 'both'

const APP_INTENT_SIGNALS = [
  'dashboard', 'sidebar', 'nav items', 'tabs', 'cards', 'charts',
  'logged-in', 'logged in', 'authenticated', 'admin', 'panel',
  'feed', 'data table', 'settings', 'profile page', 'stat card',
  'toggle', 'pie chart', 'bar chart', 'line chart', 'notifications',
  'inbox', 'activity feed', 'kanban', 'calendar view', 'user list',
]

const LANDING_INTENT_SIGNALS = [
  'hero section', 'pricing section', 'testimonials', 'waitlist',
  'landing page', 'homepage', 'above the fold', 'call to action',
  'social proof', 'feature grid', 'how it works',
]

export function detectIntent(idea: string): IntentType {
  const lower = idea.toLowerCase()
  const appHits = APP_INTENT_SIGNALS.filter((s) => lower.includes(s)).length
  const landingHits = LANDING_INTENT_SIGNALS.filter((s) => lower.includes(s)).length

  if (appHits >= 2 && landingHits === 0) return 'app'
  if (landingHits >= 2 && appHits === 0) return 'landing'
  if (appHits >= 1 && landingHits >= 1) return 'both'
  // If the idea describes specific interior pages or UI components, it's an app
  if (appHits >= 1) return 'app'
  return 'both'
}

export type CategoryBrief = {
  category: string
  tableStakes: string[]
  leapfrogOpportunities: string[]
  avoidPatterns: string[]
  competitorNames: string[]
  designProfile: DesignProfile
  intentType: IntentType
}

export async function buildCategoryBrief(
  appIdea: string,
  appCategory: string
): Promise<CategoryBrief | null> {
  try {
    const research = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      tools: [
        {
          type: 'web_search_20250305' as const,
          name: 'web_search',
        },
      ],
      messages: [
        {
          role: 'user',
          content: `You are researching competitors for a new app in the ${appCategory} category.

App idea: "${appIdea}"

Do 2 quick web searches:
1. Search for the top 2-3 existing apps/competitors in this exact niche
2. Search for user complaints about those competitors (Reddit, Product Hunt reviews, app store reviews)

Then respond ONLY with a JSON object (no markdown, no backticks) in this exact shape:
{
  "category": "${appCategory}",
  "tableStakes": ["feature users expect as minimum", "another must-have"],
  "leapfrogOpportunities": ["pain point competitors have that you can solve", "another gap"],
  "avoidPatterns": ["UX mistake competitors make", "another antipattern"],
  "competitorNames": ["CompetitorA", "CompetitorB"]
}

Keep each array to 2-3 items maximum. Be specific and actionable, not generic.`,
        },
      ],
    })

    // Extract the final text block (after tool use)
    const textBlock = research.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    if (!textBlock) return null

    // Strip markdown code fences if present
    let cleaned = textBlock.trim()
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')

    // If the model returned prose instead of JSON, extract the JSON object
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error(`No JSON object found in response: "${cleaned.slice(0, 100)}"`)
      }
      cleaned = jsonMatch[0]
    }

    const parsed = JSON.parse(cleaned) as Omit<CategoryBrief, 'designProfile' | 'intentType'>
    return {
      ...parsed,
      designProfile: matchDesignProfile(parsed.category),
      intentType: detectIntent(appIdea),
    }
  } catch (e) {
    console.error('[categoryIntelligence] failed, continuing without brief:', e)
    return null
  }
}

export function formatCategoryBriefForPrompt(brief: CategoryBrief): string {
  return `
CATEGORY INTELLIGENCE BRIEF
============================
Category: ${brief.category}
Competitors researched: ${brief.competitorNames.join(', ')}

TABLE STAKES (must include or users will leave):
${brief.tableStakes.map((f) => `- ${f}`).join('\n')}

LEAPFROG OPPORTUNITIES (what competitors are missing — build these to win):
${brief.leapfrogOpportunities.map((f) => `- ${f}`).join('\n')}

AVOID (patterns that frustrate users in this category):
${brief.avoidPatterns.map((f) => `- ${f}`).join('\n')}

Use this intelligence to make design and feature decisions.
Table stakes must appear in the generated app.
Leapfrog opportunities should be included where feasible.
============================
`
}
