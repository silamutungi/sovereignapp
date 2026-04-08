// api/extract-brand.ts — Vercel Serverless Function
//
// POST /api/extract-brand
// Body: { url?: string, logoBase64?: string, mimeType?: string }
// Returns: { tokens: BrandTokens | null }

import { checkRateLimit } from './_rateLimit.js'
import { extractBrandFromUrl } from './lib/extractBrandFromUrl.js'
import { extractBrandFromLogo } from './lib/extractBrandFromLogo.js'
import type { BrandTokens } from './lib/extractBrandFromUrl.js'

export const maxDuration = 15

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown'
  const rl = checkRateLimit(`extract-brand:${ip}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: 'Too many requests.' })
    return
  }

  let url: string | undefined
  let logoBase64: string | undefined
  let mimeType: string | undefined
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    url = (body?.url as string | undefined)?.trim()
    logoBase64 = (body?.logoBase64 as string | undefined)
    mimeType = (body?.mimeType as string | undefined)?.trim()
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  if (!url && !logoBase64) {
    res.status(400).json({ error: 'Provide url or logoBase64' })
    return
  }

  // Validate logo size — reject base64 over ~2MB
  if (logoBase64 && logoBase64.length > 2_800_000) {
    res.status(400).json({ error: 'Logo too large. Max 2MB.' })
    return
  }

  // Run both extractions in parallel if both provided
  const [urlTokens, logoTokens] = await Promise.all([
    url ? extractBrandFromUrl(url) : Promise.resolve(null),
    logoBase64 && mimeType ? extractBrandFromLogo(logoBase64, mimeType) : Promise.resolve(null),
  ])

  // Merge: logo takes priority for colors, URL fills gaps
  let tokens: BrandTokens | null = null
  if (logoTokens && urlTokens) {
    tokens = {
      primaryColor: logoTokens.primaryColor,
      secondaryColor: logoTokens.secondaryColor ?? urlTokens.secondaryColor,
      backgroundColor: logoTokens.backgroundColor ?? urlTokens.backgroundColor,
      fontFamily: urlTokens.fontFamily ?? logoTokens.fontFamily,
      logoUrl: urlTokens.logoUrl,
      tone: logoTokens.tone ?? urlTokens.tone,
      sourceUrl: urlTokens.sourceUrl,
    }
  } else {
    tokens = logoTokens ?? urlTokens
  }

  res.status(200).json({ tokens })
}
