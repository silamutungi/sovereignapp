// api/lib/extractBrandFromFigma.ts — Extract brand tokens from a Figma file URL
//
// Uses Figma REST API to read color styles and text styles.
// Requires FIGMA_ACCESS_TOKEN env var. Returns BrandTokens or null. Never throws.

import type { BrandTokens } from './extractBrandFromUrl.js'

interface FigmaStyle {
  key: string
  name: string
  style_type: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID'
  description: string
}

interface FigmaStylesResponse {
  status?: number
  error?: boolean
  meta?: { styles: FigmaStyle[] }
}

interface FigmaNodeFill {
  type: string
  color?: { r: number; g: number; b: number; a?: number }
}

interface FigmaNodeStyle {
  fontFamily?: string
  fontSize?: number
}

interface FigmaNode {
  document?: {
    children?: FigmaNode[]
  }
  children?: FigmaNode[]
  fills?: FigmaNodeFill[]
  style?: FigmaNodeStyle
  type?: string
  name?: string
}

interface FigmaNodesResponse {
  nodes?: Record<string, { document?: FigmaNode }>
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export async function extractBrandFromFigma(figmaUrl: string): Promise<BrandTokens | null> {
  try {
    const token = process.env.FIGMA_ACCESS_TOKEN
    if (!token) {
      console.warn('[extractBrandFromFigma] FIGMA_ACCESS_TOKEN not set — skipping')
      return null
    }

    // Parse file key from URL
    const match = figmaUrl.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/)
    if (!match) return null
    const fileKey = match[1]

    const headers = { 'X-Figma-Token': token }

    // Fetch styles metadata
    const stylesRes = await fetch(`https://api.figma.com/v1/files/${fileKey}/styles`, {
      headers,
      signal: AbortSignal.timeout(10000),
    })
    if (!stylesRes.ok) {
      console.warn('[extractBrandFromFigma] Figma API returned', stylesRes.status)
      return null
    }
    const stylesData = await stylesRes.json() as FigmaStylesResponse
    const styles = stylesData?.meta?.styles ?? []

    // Separate fill and text styles
    const fillStyles = styles.filter((s) => s.style_type === 'FILL')
    const textStyles = styles.filter((s) => s.style_type === 'TEXT')

    // Collect node IDs to fetch actual color/font values
    const nodeIds = [...fillStyles.slice(0, 5), ...textStyles.slice(0, 3)].map((s) => s.key)

    let primaryColor: string | null = null
    let secondaryColor: string | undefined
    let fontFamily: string | undefined

    if (nodeIds.length > 0) {
      // Fetch node details for color and font values
      const nodesRes = await fetch(
        `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIds.join(',')}`,
        { headers, signal: AbortSignal.timeout(10000) },
      )
      if (nodesRes.ok) {
        const nodesData = await nodesRes.json() as FigmaNodesResponse
        const nodes = nodesData?.nodes ?? {}

        // Extract colors from fill style nodes
        const colors: string[] = []
        for (const nodeId of fillStyles.slice(0, 5).map((s) => s.key)) {
          const node = nodes[nodeId]?.document
          if (node?.fills) {
            for (const fill of node.fills) {
              if (fill.type === 'SOLID' && fill.color) {
                colors.push(rgbToHex(fill.color.r, fill.color.g, fill.color.b))
              }
            }
          }
        }
        if (colors.length > 0) primaryColor = colors[0]
        if (colors.length > 1) secondaryColor = colors[1]

        // Extract font from text style nodes
        for (const nodeId of textStyles.slice(0, 3).map((s) => s.key)) {
          const node = nodes[nodeId]?.document
          if (node?.style?.fontFamily) {
            fontFamily = node.style.fontFamily
            break
          }
        }
      }
    }

    // Fallback: infer from style names if node fetch didn't yield colors
    if (!primaryColor) {
      // Look for styles with "primary", "brand", "accent" in the name
      const primaryStyle = fillStyles.find((s) =>
        /primary|brand|accent|main/i.test(s.name),
      )
      // If we found a named style but couldn't resolve it, we still have no color
      if (!primaryStyle) return null
      // Without the actual color value, we can't return useful tokens
      return null
    }

    // Infer tone from style names
    let tone: BrandTokens['tone'] = 'professional'
    const allNames = styles.map((s) => s.name.toLowerCase()).join(' ')
    if (/bold|strong|heavy/i.test(allNames)) tone = 'bold'
    else if (/playful|fun|bright/i.test(allNames)) tone = 'playful'
    else if (/minimal|clean|simple/i.test(allNames)) tone = 'minimal'

    return {
      primaryColor,
      secondaryColor,
      fontFamily,
      tone,
      sourceUrl: figmaUrl,
    }
  } catch (err) {
    console.error('[extractBrandFromFigma]', err)
    return null
  }
}
