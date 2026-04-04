// api/lib/visionMap.ts — Vision mapping for Brain
//
// Receives a screenshot + component index, asks Haiku to identify
// which visual zone the user's edit instruction refers to, and maps
// it to exact file coordinates.
//
// Never throws — returns null on any failure.

import type Anthropic from '@anthropic-ai/sdk'

const MODEL_FAST = 'claude-haiku-4-5-20251001'

export interface ComponentEntry {
  name: string
  file: string
  line_start: number | null
  line_end: number | null
  type: string | null
  description: string | null
  visible_text: string[]
}

export interface VisionMapResult {
  visual_zone: string
  matched_components: string[]
  target_files: string[]
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

export async function visionMap(
  instruction: string,
  screenshotUrl: string,
  componentIndex: ComponentEntry[],
  anthropic: Anthropic,
): Promise<VisionMapResult | null> {
  try {
    // 1. Fetch the screenshot as base64
    const imgRes = await fetch(screenshotUrl, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!imgRes.ok) {
      console.warn('[visionMap] screenshot fetch failed:', imgRes.status)
      return null
    }
    const imgBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(imgBuffer).toString('base64')
    const mediaType = 'image/webp'

    // 2. Build the component index context
    const indexContext = componentIndex.map((c) =>
      c.name + ' (' + (c.type ?? 'unknown') + ') \u2192 ' + c.file +
      ':' + (c.line_start ?? '?') + '-' + (c.line_end ?? '?') + '\n' +
      '  Visible text: ' + (c.visible_text.length > 0 ? c.visible_text.join(' | ') : 'none'),
    ).join('\n\n')

    // 3. Call Claude vision (Haiku) with image + text
    const response = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `You are looking at a screenshot of a live web app.

A user wants to make this change: "${instruction}"

COMPONENT INDEX (maps visual elements to code files):
${indexContext}

Look at the screenshot. Identify which visual zone the user's instruction refers to. Match it to the component index.

CUSTOMER LANGUAGE GUIDE:
Customers are non-technical founders. They describe what they see, not what it is called in code. Learn to map their language to visual zones:

Visual/feeling language — look for the dominant element they describe:
- "the top part", "first thing you see", "when you open it" → hero section
- "feels boring", "needs more energy", "make it pop" → hero or primary CTA
- "looks too plain", "feels cheap", "not professional" → overall design, likely hero or color scheme
- "the banner", "the big image", "the background photo" → hero image
- "the colors feel off", "wrong colors", "clashing" → CSS custom properties, primary color vars

Pointing language — match their description to visible text in the component index:
- "the button that says X" → find component with "X" in visible_text
- "where it says X" → find component with "X" in visible_text
- "the section with X" → find component whose description matches
- "the big heading", "the main title" → hero section headline
- "the three boxes", "the grid", "the cards" → feature or listing grid component
- "the top bar", "the menu", "the links at the top" → nav component

Problem language — identify what is broken visually:
- "spacing looks weird", "too cramped", "too much space" → layout component
- "hard to read", "font is wrong", "text is tiny" → typography in that section
- "looks broken on mobile" → responsive layout issue in the component
- "button doesn't stand out", "can't find the button" → CTA component

Comparison language — map aspiration to the closest visual zone:
- "more like Airbnb/Stripe/Apple" → hero section and overall visual hierarchy
- "more premium", "more modern", "cleaner" → hero section, color scheme
- "more like a real startup" → hero section, social proof section

CRITICAL: Always look at the screenshot first. The customer is describing something they can see. Find it visually, then match it to the component index. Never guess from the instruction alone.

Return only valid JSON:
{
  "visual_zone": "description of the visual area you identified in the screenshot",
  "matched_components": ["ComponentName1", "ComponentName2"],
  "target_files": ["src/pages/Home.tsx"],
  "confidence": "high" | "medium" | "low",
  "reasoning": "one sentence: what you see and why these files"
}

Rules:
- visual_zone must describe what you actually see in the screenshot — not what you expect to see
- matched_components must be names that exist in the component index above
- target_files must be file paths from the component index
- If the instruction is ambiguous or you cannot locate the zone visually, set confidence to "low"
- Return only JSON. No fences. No explanation.`,
            },
          ],
        },
      ],
    })

    // 4. Parse the response
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    // Defensive JSON extraction
    let parsed: unknown
    if (text.startsWith('{')) {
      parsed = JSON.parse(text)
    } else {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) {
        console.warn('[visionMap] Haiku did not return JSON:', text.slice(0, 100))
        return null
      }
      parsed = JSON.parse(match[0])
    }

    const result = parsed as VisionMapResult

    console.log('[visionMap] zone:', result.visual_zone)
    console.log('[visionMap] files:', result.target_files.join(', '))
    console.log('[visionMap] confidence:', result.confidence)

    return result
  } catch (err) {
    console.warn('[visionMap] failed (non-fatal):', err instanceof Error ? err.message : String(err))
    return null
  }
}
