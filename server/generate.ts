// server/generate.ts
//
// Server-side only. Called by:
//   - vite.config.ts plugin middleware (npm run dev)
//   - api/generate.ts Vercel serverless function (production)
//
// Never imported by the browser bundle.

import Anthropic from '@anthropic-ai/sdk'

export interface AppSpec {
  appName: string
  tagline: string
  primaryColor: string
  appType: 'landing-page' | 'saas' | 'waitlist'
  template: string
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

Make the appName memorable and specific to this idea. Write a tagline that could go on a YC application. Choose a primaryColor that reflects the app's personality. Build a beautiful template that could be shown to investors today.

ACCESSIBILITY REQUIREMENTS — non-negotiable:
- All text must meet WCAG AA contrast ratio (4.5:1 minimum)
- Never place light text on light backgrounds
- Never place dark text on dark backgrounds
- If primaryColor is light (luminance > 0.4), use #0e0d0b for text on that color, never white or light gray
- If primaryColor is dark (luminance < 0.4), use #f2efe8 for text on that color, never black or dark gray
- Button text must always contrast against button background
- Input placeholder text must be at least #767676 on white
- Focus states must be visible — use a 2px outline in the primaryColor or a contrasting color
- Never use color alone to convey information
- All interactive elements must be at least 44x44px touch target
- Every image must have descriptive alt text
- All form inputs must have visible labels, not just placeholders`,
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
