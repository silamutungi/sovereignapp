// server/generate.ts
//
// Server-side only. Called by:
//   - vite.config.ts plugin middleware (npm run dev)
//   - api/generate.ts Vercel serverless function (production)
//
// Never imported by the browser bundle.

import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '../api/_systemPrompt'

export interface NextStep {
  title: string
  description: string
  action: string
  priority: 'high' | 'medium' | 'low'
}

export interface AppSpec {
  appName: string
  tagline: string
  primaryColor: string
  appType: 'landing-page' | 'saas' | 'waitlist'
  template: string
  tier: 'SIMPLE' | 'STANDARD' | 'COMPLEX'
  activeStandards: string[]
  nextSteps: NextStep[]
}

export interface GenerateResult extends AppSpec {
  success: boolean
  error?: string
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

export async function generateAppSpec(idea: string): Promise<GenerateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { ...EMPTY, success: false, error: 'ANTHROPIC_API_KEY is not set' }
  }

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
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
          content: `Idea: "${idea}"`,
        },
      ],
    })

    // tool_choice forces exactly one tool_use block — find and narrow it
    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (!toolBlock) {
      throw new Error('No tool_use block in response — unexpected stop_reason: ' + response.stop_reason)
    }

    const spec = toolBlock.input as AppSpec

    return {
      success: true,
      appName: spec.appName,
      tagline: spec.tagline,
      primaryColor: spec.primaryColor,
      appType: spec.appType,
      template: spec.template,
      tier: spec.tier ?? 'SIMPLE',
      activeStandards: spec.activeStandards ?? [],
      nextSteps: spec.nextSteps ?? [],
    }
  } catch (err) {
    const message =
      err instanceof Anthropic.APIError
        ? `Anthropic API error ${err.status}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err)

    return { ...EMPTY, success: false, error: message }
  }
}
