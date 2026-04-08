// api/lib/extractBrandFromPdf.ts — Extract brand tokens from a brand guide PDF via Sonnet vision
//
// Sends the PDF to Claude Sonnet as a document, asks for brand token extraction.
// Returns BrandTokens or null on any failure. Never throws.

import Anthropic from '@anthropic-ai/sdk'
import type { BrandTokens } from './extractBrandFromUrl.js'

export async function extractBrandFromPdf(
  pdfBase64: string,
): Promise<BrandTokens | null> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return null

    const client = new Anthropic({ apiKey })

    const res = await client.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: `This is a brand guide or design document. Extract the brand tokens and return ONLY this JSON:
{
  "primaryColor": "#hex of main brand color or null",
  "secondaryColor": "#hex of secondary color or null",
  "backgroundColor": "#hex of background color or null",
  "fontFamily": "primary font name or null",
  "tone": "minimal|bold|playful|professional",
  "brandVoice": "one sentence description of brand tone and voice, or null"
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
      primaryColor?: string | null
      secondaryColor?: string | null
      backgroundColor?: string | null
      fontFamily?: string | null
      tone?: string
      brandVoice?: string | null
    }

    if (!parsed.primaryColor) return null

    const validTones = ['minimal', 'bold', 'playful', 'professional']

    return {
      primaryColor: parsed.primaryColor,
      secondaryColor: parsed.secondaryColor ?? undefined,
      backgroundColor: parsed.backgroundColor ?? undefined,
      fontFamily: parsed.fontFamily ?? undefined,
      tone: (validTones.includes(parsed.tone ?? '') ? parsed.tone : 'professional') as BrandTokens['tone'],
      brandVoice: parsed.brandVoice ?? undefined,
      sourceUrl: 'pdf-upload',
    }
  } catch (err) {
    console.error('[extractBrandFromPdf]', err)
    return null
  }
}
