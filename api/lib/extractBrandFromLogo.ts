// api/lib/extractBrandFromLogo.ts — Extract brand tokens from a logo image via Haiku vision
//
// Sends the logo to Claude Haiku as a base64 image, asks for color/tone analysis.
// Returns BrandTokens or null on any failure. Never throws.

import Anthropic from '@anthropic-ai/sdk'

export interface BrandTokens {
  primaryColor: string
  secondaryColor?: string
  backgroundColor?: string
  fontFamily?: string
  logoUrl?: string
  tone?: 'minimal' | 'bold' | 'playful' | 'professional'
  sourceUrl: string
}

type MediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

export async function extractBrandFromLogo(
  imageBase64: string,
  mimeType: string,
): Promise<BrandTokens | null> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return null

    const client = new Anthropic({ apiKey })

    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as MediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Analyze this logo/brand image and return ONLY a JSON object with these fields:
{
  "primaryColor": "#hex of the most dominant brand color",
  "secondaryColor": "#hex of secondary color if present, or null",
  "backgroundColor": "#hex of background if not white/transparent, or null",
  "tone": "minimal" | "bold" | "playful" | "professional",
  "fontStyle": "serif" | "sans-serif" | "display" | "monospace" or null
}
No explanation. Raw JSON only.`,
          },
        ],
      }],
    })

    const text = (res.content[0] as { type: string; text: string }).text.trim()

    // Defensive JSON extraction — model may return prose before JSON
    let jsonStr = text
    if (!jsonStr.startsWith('{')) {
      const match = jsonStr.match(/\{[\s\S]*\}/)
      if (!match) return null
      jsonStr = match[0]
    }
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```/g, '')

    const parsed = JSON.parse(jsonStr) as {
      primaryColor?: string
      secondaryColor?: string | null
      backgroundColor?: string | null
      tone?: string
      fontStyle?: string | null
    }

    if (!parsed.primaryColor) return null

    // Map fontStyle to a Google Fonts family hint
    const fontMap: Record<string, string> = {
      'serif': 'Georgia',
      'sans-serif': 'Inter',
      'display': 'Playfair Display',
      'monospace': 'JetBrains Mono',
    }

    return {
      primaryColor: parsed.primaryColor,
      secondaryColor: parsed.secondaryColor ?? undefined,
      backgroundColor: parsed.backgroundColor ?? undefined,
      fontFamily: parsed.fontStyle ? fontMap[parsed.fontStyle] : undefined,
      tone: (['minimal', 'bold', 'playful', 'professional'].includes(parsed.tone ?? '') ? parsed.tone : 'professional') as BrandTokens['tone'],
      sourceUrl: 'logo-upload',
    }
  } catch (err) {
    console.error('[extractBrandFromLogo]', err)
    return null
  }
}
