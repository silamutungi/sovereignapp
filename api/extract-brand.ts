// api/extract-brand.ts — Vercel Serverless Function
//
// POST /api/extract-brand
// Body: { url?, logoBase64?, mimeType?, figmaUrl?, pdfBase64?, screenshotBase64?, screenshotMimeType? }
// Returns: { tokens: BrandTokens | null }
//
// Merge priority (highest first): logo → figmaUrl → url → pdf → screenshot

import { checkRateLimit } from './_rateLimit.js'
import { extractBrandFromUrl } from './lib/extractBrandFromUrl.js'
import { extractBrandFromLogo } from './lib/extractBrandFromLogo.js'
import { extractBrandFromFigma } from './lib/extractBrandFromFigma.js'
import { extractBrandFromPdf } from './lib/extractBrandFromPdf.js'
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
  let figmaUrl: string | undefined
  let pdfBase64: string | undefined
  let screenshotBase64: string | undefined
  let screenshotMimeType: string | undefined
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    url = (body?.url as string | undefined)?.trim()
    logoBase64 = (body?.logoBase64 as string | undefined)
    mimeType = (body?.mimeType as string | undefined)?.trim()
    figmaUrl = (body?.figmaUrl as string | undefined)?.trim()
    pdfBase64 = (body?.pdfBase64 as string | undefined)
    screenshotBase64 = (body?.screenshotBase64 as string | undefined)
    screenshotMimeType = (body?.screenshotMimeType as string | undefined)?.trim()
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  if (!url && !logoBase64 && !figmaUrl && !pdfBase64 && !screenshotBase64) {
    res.status(400).json({ error: 'Provide at least one of: url, logoBase64, figmaUrl, pdfBase64, screenshotBase64' })
    return
  }

  // Validate file sizes — reject base64 over ~10MB (for PDFs)
  if (logoBase64 && logoBase64.length > 2_800_000) {
    res.status(400).json({ error: 'Logo too large. Max 2MB.' })
    return
  }
  if (pdfBase64 && pdfBase64.length > 14_000_000) {
    res.status(400).json({ error: 'PDF too large. Max 10MB.' })
    return
  }
  if (screenshotBase64 && screenshotBase64.length > 14_000_000) {
    res.status(400).json({ error: 'Screenshot too large. Max 10MB.' })
    return
  }

  // Run all extractions in parallel
  const [urlTokens, logoTokens, figmaTokens, pdfTokens, screenshotTokens] = await Promise.all([
    url ? extractBrandFromUrl(url) : Promise.resolve(null),
    logoBase64 && mimeType ? extractBrandFromLogo(logoBase64, mimeType) : Promise.resolve(null),
    figmaUrl ? extractBrandFromFigma(figmaUrl) : Promise.resolve(null),
    pdfBase64 ? extractBrandFromPdf(pdfBase64) : Promise.resolve(null),
    // Screenshots reuse the logo extractor (same Haiku vision analysis)
    screenshotBase64 && screenshotMimeType ? extractBrandFromLogo(screenshotBase64, screenshotMimeType) : Promise.resolve(null),
  ])

  // Merge priority: logo → figma → url → pdf → screenshot
  // Each source fills in missing fields; higher priority sources are never overwritten
  const sources: (BrandTokens | null)[] = [logoTokens, figmaTokens, urlTokens, pdfTokens, screenshotTokens]
  let tokens: BrandTokens | null = null

  for (const source of sources) {
    if (!source) continue
    if (!tokens) {
      tokens = { ...source }
    } else {
      // Fill in any missing fields from lower-priority sources
      if (!tokens.primaryColor) tokens.primaryColor = source.primaryColor
      if (!tokens.secondaryColor) tokens.secondaryColor = source.secondaryColor
      if (!tokens.backgroundColor) tokens.backgroundColor = source.backgroundColor
      if (!tokens.fontFamily) tokens.fontFamily = source.fontFamily
      if (!tokens.logoUrl) tokens.logoUrl = source.logoUrl
      if (!tokens.tone) tokens.tone = source.tone
      if (!tokens.brandVoice) tokens.brandVoice = source.brandVoice
    }
  }

  res.status(200).json({ tokens })
}
