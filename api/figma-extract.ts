// api/figma-extract.ts — POST /api/figma-extract
// Extracts color and typography design tokens from a Figma file
// and returns a tokens.css file with CSS custom properties.
//
// SECURITY: figma_token is provided by the user for their own Figma file.
// It is never stored — used only for the duration of this request.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Rate limiting ────────────────────────────────────────────────────────
  const { checkRateLimit, getClientIp } = await import('./_rateLimit.js')
  const ip = getClientIp(req)
  const rl = checkRateLimit(`figma-extract:${ip}`, 10, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    return res.status(429).json({ error: 'Rate limit exceeded' })
  }

  // ── STEP 1 — Validate inputs ─────────────────────────────────────────────
  const { figma_url, figma_token } = req.body ?? {}

  if (!figma_url || typeof figma_url !== 'string') {
    return res.status(400).json({ error: 'figma_url is required' })
  }

  const FIGMA_URL_RE = /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/
  if (!FIGMA_URL_RE.test(figma_url)) {
    return res.status(400).json({
      error: 'figma_url must be a valid Figma file or design URL',
    })
  }

  if (!figma_token || typeof figma_token !== 'string' || !figma_token.trim()) {
    return res.status(400).json({ error: 'figma_token is required' })
  }

  // ── STEP 2 — Extract file key ────────────────────────────────────────────
  const match = figma_url.match(FIGMA_URL_RE)
  const fileKey = match![1]
  console.log(`[figma-extract] file key: ${fileKey}`)

  const headers = { 'X-Figma-Token': figma_token.trim() }

  try {
    // ── STEP 3 — Fetch styles ──────────────────────────────────────────────
    const stylesRes = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/styles`,
      { headers },
    )

    if (stylesRes.status === 403) {
      return res.status(401).json({ error: 'Invalid Figma token' })
    }
    if (stylesRes.status === 404) {
      return res.status(404).json({ error: 'Figma file not found' })
    }
    if (!stylesRes.ok) {
      throw new Error(`Figma styles API returned ${stylesRes.status}`)
    }

    const stylesData = await stylesRes.json()
    const allStyles: Array<{ node_id: string; name: string; style_type: string }> =
      stylesData.meta?.styles ?? []

    const colorStyles = allStyles.filter((s) => s.style_type === 'FILL')
    const textStyles = allStyles.filter((s) => s.style_type === 'TEXT')

    console.log(
      `[figma-extract] styles found: ${colorStyles.length} colors, ${textStyles.length} typography`,
    )

    // ── STEP 4 — Fetch node details ────────────────────────────────────────
    const allRelevant = [...colorStyles, ...textStyles]
    const nodeIds = allRelevant.map((s) => s.node_id).slice(0, 50)

    interface FigmaNode {
      document?: {
        fills?: Array<{ color?: { r: number; g: number; b: number; a: number } }>
        style?: {
          fontFamily?: string
          fontSize?: number
          fontWeight?: number
          lineHeightPx?: number
        }
      }
    }

    let nodes: Record<string, FigmaNode> = {}

    if (nodeIds.length > 0) {
      const nodesRes = await fetch(
        `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIds.join(',')}`,
        { headers },
      )

      if (nodesRes.status === 403) {
        return res.status(401).json({ error: 'Invalid Figma token' })
      }
      if (nodesRes.status === 404) {
        return res.status(404).json({ error: 'Figma file not found' })
      }
      if (!nodesRes.ok) {
        throw new Error(`Figma nodes API returned ${nodesRes.status}`)
      }

      const nodesData = await nodesRes.json()
      nodes = nodesData.nodes ?? {}
    }

    // ── STEP 5 — Generate tokens.css ───────────────────────────────────────
    const toKebab = (name: string): string =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    const toHex = (r: number, g: number, b: number): string => {
      const ch = (v: number) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, '0')
      return `${ch(r)}${ch(g)}${ch(b)}`
    }

    const colorLines: string[] = []
    const typographyLines: string[] = []

    for (const style of colorStyles) {
      const node = nodes[style.node_id]
      const fill = node?.document?.fills?.[0]
      if (!fill?.color) continue
      const { r, g, b } = fill.color
      colorLines.push(
        `  --color-${toKebab(style.name)}: #${toHex(r, g, b)};`,
      )
    }

    for (const style of textStyles) {
      const node = nodes[style.node_id]
      const s = node?.document?.style
      if (!s) continue
      const key = toKebab(style.name)
      if (s.fontFamily) typographyLines.push(`  --font-${key}: '${s.fontFamily}';`)
      if (s.fontSize != null) typographyLines.push(`  --text-${key}-size: ${s.fontSize}px;`)
      if (s.fontWeight != null) typographyLines.push(`  --text-${key}-weight: ${s.fontWeight};`)
      if (s.lineHeightPx != null)
        typographyLines.push(`  --text-${key}-line-height: ${s.lineHeightPx}px;`)
    }

    const sections: string[] = []
    if (colorLines.length > 0) {
      sections.push(`  /* Colors */\n${colorLines.join('\n')}`)
    }
    if (typographyLines.length > 0) {
      sections.push(`  /* Typography */\n${typographyLines.join('\n')}`)
    }

    const tokens = sections.length > 0
      ? `:root {\n${sections.join('\n\n')}\n}\n`
      : `:root {\n  /* No styles extracted */\n}\n`

    console.log(`[figma-extract] tokens.css generated: ${tokens.length} chars`)

    // ── STEP 6 — Return ────────────────────────────────────────────────────
    return res.status(200).json({
      tokens,
      colors: colorLines.length,
      typography: textStyles.filter((s) => nodes[s.node_id]?.document?.style).length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[figma-extract] error: ${message}`)
    return res.status(500).json({ error: 'Extraction failed' })
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
}
