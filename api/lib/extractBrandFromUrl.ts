// api/lib/extractBrandFromUrl.ts — Extract brand tokens from a website URL
//
// Scrapes page HTML for CSS custom properties, meta theme-color, Google Fonts,
// and logo images. Returns BrandTokens or null on any failure. Never throws.

export interface BrandTokens {
  primaryColor: string
  secondaryColor?: string
  backgroundColor?: string
  fontFamily?: string
  logoUrl?: string
  tone?: 'minimal' | 'bold' | 'playful' | 'professional'
  brandVoice?: string
  sourceUrl: string
}

// ── CSS custom property patterns (highest confidence) ────────────────────────
const CSS_VAR_PATTERNS = [
  /--(?:color-)?primary\s*:\s*(#[0-9a-fA-F]{3,8})/,
  /--brand(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/,
  /--accent(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/,
  /--color-brand\s*:\s*(#[0-9a-fA-F]{3,8})/,
  /--theme-primary\s*:\s*(#[0-9a-fA-F]{3,8})/,
]

// ── Hex color extraction ─────────────────────────────────────────────────────
const HEX_REGEX = /#[0-9a-fA-F]{6}\b/g

function extractColorsFromCSSVars(html: string): string[] {
  const colors: string[] = []
  const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []
  const combined = styleBlocks.join('\n')
  for (const pattern of CSS_VAR_PATTERNS) {
    const match = combined.match(pattern)
    if (match?.[1]) colors.push(match[1])
  }
  return colors
}

function extractThemeColor(html: string): string | null {
  const match = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["'](#[0-9a-fA-F]{3,8})["']/i)
    ?? html.match(/<meta[^>]*content=["'](#[0-9a-fA-F]{3,8})["'][^>]*name=["']theme-color["']/i)
  return match?.[1] ?? null
}

function extractMostRepeatedHex(html: string): string | null {
  // Scan inline styles and style blocks for hex colors
  const styleContent = (html.match(/style=["'][^"']*["']/gi) ?? []).join(' ')
  const styleBlocks = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join(' ')
  const allContent = styleContent + ' ' + styleBlocks

  const hexes = allContent.match(HEX_REGEX) ?? []
  if (hexes.length === 0) return null

  // Count occurrences, skip near-white (#f..... and #e.....) and near-black (#0..... and #1.....)
  const counts = new Map<string, number>()
  for (const hex of hexes) {
    const lower = hex.toLowerCase()
    if (/^#[ef][0-9a-f]{5}$/i.test(lower)) continue // near-white
    if (/^#[01][0-9a-f]{5}$/i.test(lower)) continue // near-black
    if (lower === '#ffffff' || lower === '#000000') continue
    counts.set(lower, (counts.get(lower) ?? 0) + 1)
  }

  let best: string | null = null
  let bestCount = 0
  for (const [hex, count] of counts) {
    if (count > bestCount) { best = hex; bestCount = count }
  }
  return best
}

// ── Font extraction ──────────────────────────────────────────────────────────
function extractFont(html: string): string | null {
  // Google Fonts link or @import
  const googleFontsMatch = html.match(/fonts\.googleapis\.com\/css2?\?family=([^&"')+]+)/i)
  if (googleFontsMatch?.[1]) {
    return decodeURIComponent(googleFontsMatch[1]).replace(/\+/g, ' ').split(':')[0]
  }

  // Font-family declarations in style blocks (first non-system font)
  const styleBlocks = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join('\n')
  const fontFamilyMatch = styleBlocks.match(/font-family\s*:\s*["']?([^"';,}]+)/i)
  if (fontFamilyMatch?.[1]) {
    const font = fontFamilyMatch[1].trim()
    const systemFonts = ['system-ui', 'sans-serif', 'serif', 'monospace', 'arial', 'helvetica', 'times', 'georgia', 'verdana', 'courier', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI']
    if (!systemFonts.some((s) => font.toLowerCase().startsWith(s.toLowerCase()))) {
      return font
    }
  }
  return null
}

// ── Logo extraction ──────────────────────────────────────────────────────────
function extractLogoUrl(html: string, baseUrl: string): string | null {
  // <img> with logo/brand/icon in src or class
  const imgMatch = html.match(/<img[^>]*src=["']([^"']+(?:logo|brand|icon)[^"']*)["']/i)
    ?? html.match(/<img[^>]*(?:class|alt)=["'][^"']*(?:logo|brand)[^"']*["'][^>]*src=["']([^"']+)["']/i)
  if (imgMatch?.[1]) {
    try { return new URL(imgMatch[1], baseUrl).href } catch { /* skip */ }
  }

  // <link rel="icon"> or <link rel="apple-touch-icon">
  const iconMatch = html.match(/<link[^>]*rel=["'](?:icon|apple-touch-icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:icon|apple-touch-icon|shortcut icon)["']/i)
  if (iconMatch?.[1]) {
    try { return new URL(iconMatch[1], baseUrl).href } catch { /* skip */ }
  }

  return null
}

// ── Tone inference ───────────────────────────────────────────────────────────
function inferTone(html: string): 'minimal' | 'bold' | 'playful' | 'professional' {
  const lower = html.toLowerCase()
  const styleBlocks = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join('\n').toLowerCase()

  // Bold: all-caps logo, bold weights, large headings
  const hasUppercaseLogo = /<(?:h1|span|div)[^>]*class=["'][^"']*logo[^"']*["'][^>]*>[A-Z\s]{3,}</.test(html)
  const hasBoldWeights = /font-weight\s*:\s*(?:800|900|black)/i.test(styleBlocks)
  if (hasUppercaseLogo || hasBoldWeights) return 'bold'

  // Professional: serif fonts
  const hasSerif = /font-family[^;]*(?:Georgia|Playfair|Lora|Merriweather|Crimson|Cormorant)/i.test(styleBlocks)
  if (hasSerif) return 'professional'

  // Playful: rounded corners + bright colors
  const hasRounded = /border-radius\s*:\s*(?:1[2-9]|[2-9]\d|\d{3,})px/i.test(styleBlocks)
  const hasBrightColors = /#(?:ff|fe|fd)[0-9a-f]{4}/i.test(lower)
  if (hasRounded && hasBrightColors) return 'playful'

  return 'minimal'
}

// ── Main export ──────────────────────────────────────────────────────────────
export async function extractBrandFromUrl(url: string): Promise<BrandTokens | null> {
  try {
    // Normalize URL
    let normalizedUrl = url.trim()
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    const res = await fetch(normalizedUrl, {
      headers: { 'User-Agent': 'Visila/1.0 brand-extractor' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()

    // Colors — ordered by confidence
    const cssVarColors = extractColorsFromCSSVars(html)
    const themeColor = extractThemeColor(html)
    const repeatedHex = extractMostRepeatedHex(html)

    const primaryColor = cssVarColors[0] ?? themeColor ?? repeatedHex
    if (!primaryColor) return null // No usable color found

    const secondaryColor = cssVarColors[1] ?? (themeColor && themeColor !== primaryColor ? themeColor : undefined) ?? (repeatedHex && repeatedHex !== primaryColor ? repeatedHex : undefined)

    const fontFamily = extractFont(html) ?? undefined
    const logoUrl = extractLogoUrl(html, normalizedUrl) ?? undefined
    const tone = inferTone(html)

    return {
      primaryColor,
      secondaryColor: secondaryColor ?? undefined,
      fontFamily,
      logoUrl,
      tone,
      sourceUrl: normalizedUrl,
    }
  } catch (err) {
    console.error('[extractBrandFromUrl]', err)
    return null
  }
}
