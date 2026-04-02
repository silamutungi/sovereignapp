// api/_designSystem.ts — Generated Design System Engine
//
// Before Sonnet writes code, Haiku generates a complete, named, WCAG AA-compliant
// color token set — derived from the app's category, idea, and mood.
// Every generated app gets its own design identity.

import Anthropic from '@anthropic-ai/sdk'

const MODEL_FAST = 'claude-haiku-4-5-20251001'

// ── Types ────────────────────────────────────────────────────────────────────

export type AppCategory =
  | 'MARKETPLACE'
  | 'SAAS_TOOL'
  | 'BOOKING_SCHEDULING'
  | 'DIRECTORY_LISTING'
  | 'COMMUNITY_SOCIAL'
  | 'PORTFOLIO_SHOWCASE'
  | 'INTERNAL_TOOL'
  | 'ECOMMERCE_RETAIL'
  | 'RESTAURANT_HOSPITALITY'

export type DesignToken = {
  primary:              string
  primary_dark:         string
  accent:               string
  accent_dark:          string
  bg_base_light:        string
  bg_raised_light:      string
  bg_base_dark:         string
  bg_raised_dark:       string
  text_primary_light:   string
  text_primary_dark:    string
  text_secondary_light: string
  text_secondary_dark:  string
  separator_light:      string
  separator_dark:       string
}

export type TypographySystem = {
  font_primary:   string
  font_mono:      string
  scale: {
    large_title:  string
    title_1:      string
    title_2:      string
    title_3:      string
    headline:     string
    body:         string
    callout:      string
    subhead:      string
    footnote:     string
    caption:      string
  }
  weights: {
    regular:      number
    medium:       number
    semibold:     number
    bold:         number
  }
  tracking: {
    display:      string
    title:        string
    body:         string
    caption:      string
    overline:     string
  }
  leading: {
    tight:        number
    normal:       number
    relaxed:      number
    loose:        number
  }
}

export type DesignSystem = {
  palette_name:  string
  mood:          string
  category:      AppCategory
  tokens:        DesignToken
  typography:    TypographySystem
  css:           string
}

// ── Category → AppCategory mapping ───────────────────────────────────────────
// Maps the lowercase categories from generate.ts classification to AppCategory

const CATEGORY_MAP: Record<string, AppCategory> = {
  marketplace:   'MARKETPLACE',
  saas:          'SAAS_TOOL',
  tool:          'SAAS_TOOL',
  productivity:  'SAAS_TOOL',
  social:        'COMMUNITY_SOCIAL',
  ecommerce:     'ECOMMERCE_RETAIL',
  content:       'PORTFOLIO_SHOWCASE',
  game:          'COMMUNITY_SOCIAL',
  finance:       'SAAS_TOOL',
  health:        'BOOKING_SCHEDULING',
  other:         'SAAS_TOOL',
}

export function mapCategory(raw: string): AppCategory {
  return CATEGORY_MAP[raw.toLowerCase()] ?? 'SAAS_TOOL'
}

// ── Category palette personalities ───────────────────────────────────────────

interface CategoryPalette {
  mood: string
  tokens: DesignToken
}

const CATEGORY_PALETTE: Record<AppCategory, CategoryPalette> = {
  MARKETPLACE: {
    mood: 'warm, trustworthy, human',
    tokens: {
      primary:              '#C84B11',
      primary_dark:         '#E8622A',
      accent:               '#D97706',
      accent_dark:          '#FBBF24',
      bg_base_light:        '#FFFDF9',
      bg_raised_light:      '#FFF8F0',
      bg_base_dark:         '#1C1A18',
      bg_raised_dark:       '#2C2A26',
      text_primary_light:   '#1A0F00',
      text_primary_dark:    '#FAF7F2',
      text_secondary_light: 'rgba(26, 15, 0, 0.6)',
      text_secondary_dark:  'rgba(250, 247, 242, 0.55)',
      separator_light:      'rgba(26, 15, 0, 0.1)',
      separator_dark:       'rgba(250, 247, 242, 0.1)',
    },
  },
  SAAS_TOOL: {
    mood: 'crisp, professional, focused',
    tokens: {
      primary:              '#2563EB',
      primary_dark:         '#3B82F6',
      accent:               '#0EA5E9',
      accent_dark:          '#38BDF8',
      bg_base_light:        '#FAFAFA',
      bg_raised_light:      '#F4F4F5',
      bg_base_dark:         '#0F172A',
      bg_raised_dark:       '#1E293B',
      text_primary_light:   '#09090B',
      text_primary_dark:    '#F8FAFC',
      text_secondary_light: 'rgba(9, 9, 11, 0.6)',
      text_secondary_dark:  'rgba(248, 250, 252, 0.55)',
      separator_light:      'rgba(9, 9, 11, 0.08)',
      separator_dark:       'rgba(248, 250, 252, 0.08)',
    },
  },
  BOOKING_SCHEDULING: {
    mood: 'calm, reliable, organised',
    tokens: {
      primary:              '#0D9488',
      primary_dark:         '#14B8A6',
      accent:               '#0891B2',
      accent_dark:          '#22D3EE',
      bg_base_light:        '#F8FFFE',
      bg_raised_light:      '#F0FDFB',
      bg_base_dark:         '#0F1F1E',
      bg_raised_dark:       '#162726',
      text_primary_light:   '#042F2E',
      text_primary_dark:    '#F0FDFA',
      text_secondary_light: 'rgba(4, 47, 46, 0.6)',
      text_secondary_dark:  'rgba(240, 253, 250, 0.55)',
      separator_light:      'rgba(4, 47, 46, 0.1)',
      separator_dark:       'rgba(240, 253, 250, 0.1)',
    },
  },
  DIRECTORY_LISTING: {
    mood: 'clean, neutral, scannable',
    tokens: {
      primary:              '#52525B',
      primary_dark:         '#71717A',
      accent:               '#3B82F6',
      accent_dark:          '#60A5FA',
      bg_base_light:        '#FAFAFA',
      bg_raised_light:      '#F4F4F5',
      bg_base_dark:         '#18181B',
      bg_raised_dark:       '#27272A',
      text_primary_light:   '#09090B',
      text_primary_dark:    '#FAFAFA',
      text_secondary_light: 'rgba(9, 9, 11, 0.6)',
      text_secondary_dark:  'rgba(250, 250, 250, 0.55)',
      separator_light:      'rgba(9, 9, 11, 0.08)',
      separator_dark:       'rgba(250, 250, 250, 0.08)',
    },
  },
  COMMUNITY_SOCIAL: {
    mood: 'energetic, friendly, expressive',
    tokens: {
      primary:              '#7C3AED',
      primary_dark:         '#8B5CF6',
      accent:               '#EC4899',
      accent_dark:          '#F472B6',
      bg_base_light:        '#FDFAFF',
      bg_raised_light:      '#F5F0FF',
      bg_base_dark:         '#12091F',
      bg_raised_dark:       '#1E1230',
      text_primary_light:   '#1A0533',
      text_primary_dark:    '#FAF5FF',
      text_secondary_light: 'rgba(26, 5, 51, 0.6)',
      text_secondary_dark:  'rgba(250, 245, 255, 0.55)',
      separator_light:      'rgba(26, 5, 51, 0.1)',
      separator_dark:       'rgba(250, 245, 255, 0.1)',
    },
  },
  PORTFOLIO_SHOWCASE: {
    mood: 'bold, editorial, minimal',
    tokens: {
      primary:              '#171717',
      primary_dark:         '#404040',
      accent:               '#DC2626',
      accent_dark:          '#EF4444',
      bg_base_light:        '#FFFFFF',
      bg_raised_light:      '#F5F5F5',
      bg_base_dark:         '#0A0A0A',
      bg_raised_dark:       '#171717',
      text_primary_light:   '#0A0A0A',
      text_primary_dark:    '#FAFAFA',
      text_secondary_light: 'rgba(10, 10, 10, 0.6)',
      text_secondary_dark:  'rgba(250, 250, 250, 0.55)',
      separator_light:      'rgba(10, 10, 10, 0.08)',
      separator_dark:       'rgba(250, 250, 250, 0.08)',
    },
  },
  INTERNAL_TOOL: {
    mood: 'functional, dense, efficient',
    tokens: {
      primary:              '#334155',
      primary_dark:         '#475569',
      accent:               '#2563EB',
      accent_dark:          '#3B82F6',
      bg_base_light:        '#F8FAFC',
      bg_raised_light:      '#F1F5F9',
      bg_base_dark:         '#0F172A',
      bg_raised_dark:       '#1E293B',
      text_primary_light:   '#0F172A',
      text_primary_dark:    '#F8FAFC',
      text_secondary_light: 'rgba(15, 23, 42, 0.6)',
      text_secondary_dark:  'rgba(248, 250, 252, 0.55)',
      separator_light:      'rgba(15, 23, 42, 0.08)',
      separator_dark:       'rgba(248, 250, 252, 0.08)',
    },
  },
  ECOMMERCE_RETAIL: {
    mood: 'aspirational, premium, desirable',
    tokens: {
      primary:              '#18181B',
      primary_dark:         '#27272A',
      accent:               '#CA8A04',
      accent_dark:          '#EAB308',
      bg_base_light:        '#FFFEF7',
      bg_raised_light:      '#FDFDF0',
      bg_base_dark:         '#0C0C0A',
      bg_raised_dark:       '#1A1A16',
      text_primary_light:   '#0C0C0A',
      text_primary_dark:    '#FEFCE8',
      text_secondary_light: 'rgba(12, 12, 10, 0.6)',
      text_secondary_dark:  'rgba(254, 252, 232, 0.55)',
      separator_light:      'rgba(12, 12, 10, 0.08)',
      separator_dark:       'rgba(254, 252, 232, 0.08)',
    },
  },
  RESTAURANT_HOSPITALITY: {
    mood: 'appetising, warm, inviting',
    tokens: {
      primary:              '#991B1B',
      primary_dark:         '#DC2626',
      accent:               '#CA8A04',
      accent_dark:          '#EAB308',
      bg_base_light:        '#FFFBF7',
      bg_raised_light:      '#FFF5EC',
      bg_base_dark:         '#1C1410',
      bg_raised_dark:       '#2A1F18',
      text_primary_light:   '#1C0A00',
      text_primary_dark:    '#FFF7ED',
      text_secondary_light: 'rgba(28, 10, 0, 0.6)',
      text_secondary_dark:  'rgba(255, 247, 237, 0.55)',
      separator_light:      'rgba(28, 10, 0, 0.1)',
      separator_dark:       'rgba(255, 247, 237, 0.1)',
    },
  },
}

// ── Apple HIG Typography — shared by all categories ─────────────────────────

const APPLE_HIG_TYPE_SYSTEM = {
  scale: {
    large_title: '2.125rem',   // 34px
    title_1:     '1.75rem',    // 28px
    title_2:     '1.375rem',   // 22px
    title_3:     '1.25rem',    // 20px
    headline:    '1.0625rem',  // 17px
    body:        '1.0625rem',  // 17px
    callout:     '1rem',       // 16px
    subhead:     '0.9375rem',  // 15px
    footnote:    '0.8125rem',  // 13px
    caption:     '0.75rem',    // 12px
  },
  weights: {
    regular:  400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },
  tracking: {
    display:  '0.012em',
    title:    '0em',
    body:     '-0.025em',
    caption:  '0em',
    overline: '0.08em',
  },
  leading: {
    tight:   1.2,
    normal:  1.3,
    relaxed: 1.5,
    loose:   1.6,
  },
}

const CATEGORY_TYPOGRAPHY: Record<AppCategory, { font_primary: string }> = {
  MARKETPLACE:             { font_primary: "'Inter', system-ui, sans-serif" },
  SAAS_TOOL:               { font_primary: "'Inter', system-ui, sans-serif" },
  BOOKING_SCHEDULING:      { font_primary: "'Inter', system-ui, sans-serif" },
  DIRECTORY_LISTING:       { font_primary: "'Inter', system-ui, sans-serif" },
  COMMUNITY_SOCIAL:        { font_primary: "'Plus Jakarta Sans', system-ui, sans-serif" },
  PORTFOLIO_SHOWCASE:      { font_primary: "'DM Sans', system-ui, sans-serif" },
  INTERNAL_TOOL:           { font_primary: "'Inter', system-ui, sans-serif" },
  ECOMMERCE_RETAIL:        { font_primary: "'Inter', system-ui, sans-serif" },
  RESTAURANT_HOSPITALITY:  { font_primary: "'Lato', system-ui, sans-serif" },
}

function getTypography(category: AppCategory): TypographySystem {
  return {
    font_primary: CATEGORY_TYPOGRAPHY[category].font_primary,
    font_mono: "'JetBrains Mono', 'Courier New', monospace",
    ...APPLE_HIG_TYPE_SYSTEM,
  }
}

// ── CSS generation ───────────────────────────────────────────────────────────

function tokensToCSS(tokens: DesignToken, typo: TypographySystem): string {
  return `:root {
  /* Brand */
  --color-primary:          ${tokens.primary};
  --color-accent:           ${tokens.accent};

  /* Backgrounds — Apple HIG two-layer system */
  --color-bg:               ${tokens.bg_base_light};
  --color-bg-surface:       ${tokens.bg_raised_light};
  --color-bg-muted:         ${tokens.bg_raised_light};

  /* Text — WCAG AA compliant */
  --color-text:             ${tokens.text_primary_light};
  --color-text-secondary:   ${tokens.text_secondary_light};
  --color-text-muted:       ${tokens.text_secondary_light};

  /* Separators */
  --color-border:           ${tokens.separator_light};

  /* Semantic */
  --color-accent-hover:     ${tokens.accent};
  --color-success:          #16a34a;
  --color-warning:          #d97706;
  --color-error:            #dc2626;
  --color-info:             #2563eb;

  /* ── TYPOGRAPHY — Apple HIG scale ── */
  --font-primary:           ${typo.font_primary};
  --font-mono:              ${typo.font_mono};

  --text-large-title:       ${typo.scale.large_title};
  --text-title-1:           ${typo.scale.title_1};
  --text-title-2:           ${typo.scale.title_2};
  --text-title-3:           ${typo.scale.title_3};
  --text-headline:          ${typo.scale.headline};
  --text-body:              ${typo.scale.body};
  --text-callout:           ${typo.scale.callout};
  --text-subhead:           ${typo.scale.subhead};
  --text-footnote:          ${typo.scale.footnote};
  --text-caption:           ${typo.scale.caption};

  --weight-regular:         ${typo.weights.regular};
  --weight-medium:          ${typo.weights.medium};
  --weight-semibold:        ${typo.weights.semibold};
  --weight-bold:            ${typo.weights.bold};

  --tracking-display:       ${typo.tracking.display};
  --tracking-title:         ${typo.tracking.title};
  --tracking-body:          ${typo.tracking.body};
  --tracking-caption:       ${typo.tracking.caption};
  --tracking-overline:      ${typo.tracking.overline};

  --leading-tight:          ${typo.leading.tight};
  --leading-normal:         ${typo.leading.normal};
  --leading-relaxed:        ${typo.leading.relaxed};
  --leading-loose:          ${typo.leading.loose};
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary:          ${tokens.primary_dark};
    --color-accent:           ${tokens.accent_dark};
    --color-bg:               ${tokens.bg_base_dark};
    --color-bg-surface:       ${tokens.bg_raised_dark};
    --color-bg-muted:         ${tokens.bg_raised_dark};
    --color-text:             ${tokens.text_primary_dark};
    --color-text-secondary:   ${tokens.text_secondary_dark};
    --color-text-muted:       ${tokens.text_secondary_dark};
    --color-border:           ${tokens.separator_dark};
    --color-accent-hover:     ${tokens.accent_dark};
    --color-success:          #4ade80;
    --color-warning:          #fbbf24;
    --color-error:            #f87171;
    --color-info:             #60a5fa;
  }
}

@media (prefers-color-scheme: dark) {
  img:not([src*=".svg"]) {
    filter: brightness(0.9);
  }
}

html {
  color-scheme: light dark;
}`
}

// ── Haiku refinement prompt ──────────────────────────────────────────────────

const REFINE_SYSTEM = `You are a brand designer. Given an app idea and category, return a refined color palette as JSON. Rules:
- All colors must pass WCAG AA: primary on bg_base must be 4.5:1+, text_primary on bg_base must be 7:1+
- text_secondary and separator values must use rgba() format
- bg_base_light must be a near-white warm or cool tone — never pure #FFFFFF (too clinical)
- bg_base_dark must be a deep near-black — never pure #000000 (too harsh)
- primary and accent must be visually distinct (different hue families)
- primary_dark must be a lighter/brighter variant of primary for dark backgrounds
- The palette must feel cohesive and intentional — like a professional brand, not random colors
- Return ONLY valid JSON matching the exact schema, no explanation`

const REFINE_SCHEMA = `{
  "palette_name": "string — creative 2-word name like 'ChefNear Ember' or 'TaskFlow Arctic'",
  "mood": "string — 3 adjectives",
  "tokens": {
    "primary": "#hex",
    "primary_dark": "#hex",
    "accent": "#hex",
    "accent_dark": "#hex",
    "bg_base_light": "#hex",
    "bg_raised_light": "#hex",
    "bg_base_dark": "#hex",
    "bg_raised_dark": "#hex",
    "text_primary_light": "#hex",
    "text_primary_dark": "#hex",
    "text_secondary_light": "rgba(...)",
    "text_secondary_dark": "rgba(...)",
    "separator_light": "rgba(...)",
    "separator_dark": "rgba(...)"
  }
}`

// ── Validation ───────────────────────────────────────────────────────────────

function isValidHex(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(s)
}

function isValidRgba(s: string): boolean {
  return /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)$/.test(s)
}

function validateTokens(t: DesignToken): boolean {
  const hexFields: (keyof DesignToken)[] = [
    'primary', 'primary_dark', 'accent', 'accent_dark',
    'bg_base_light', 'bg_raised_light', 'bg_base_dark', 'bg_raised_dark',
    'text_primary_light', 'text_primary_dark',
  ]
  const rgbaFields: (keyof DesignToken)[] = [
    'text_secondary_light', 'text_secondary_dark',
    'separator_light', 'separator_dark',
  ]
  return (
    hexFields.every((k) => isValidHex(t[k])) &&
    rgbaFields.every((k) => isValidRgba(t[k]))
  )
}

// ── Core function ────────────────────────────────────────────────────────────

export async function generateDesignSystem(
  appName: string,
  idea: string,
  category: AppCategory,
): Promise<DesignSystem> {
  const defaults = CATEGORY_PALETTE[category]

  // Try Haiku refinement — fall back to category defaults on any failure
  try {
    const client = new Anthropic()
    const res = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `App name: ${appName}
Idea: ${idea.slice(0, 300)}
Category: ${category}
Category mood: ${defaults.mood}
Category defaults (refine these, don't copy verbatim):
primary: ${defaults.tokens.primary}, accent: ${defaults.tokens.accent}
bg_base_light: ${defaults.tokens.bg_base_light}, bg_base_dark: ${defaults.tokens.bg_base_dark}

Return a refined palette as JSON matching this schema:
${REFINE_SCHEMA}`,
      }],
      system: REFINE_SYSTEM,
    })

    const raw = (res.content[0] as { type: string; text: string }).text.trim()
    // Strip markdown fences if present
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const parsed = JSON.parse(jsonStr) as {
      palette_name?: string
      mood?: string
      tokens?: DesignToken
    }

    if (parsed.tokens && validateTokens(parsed.tokens)) {
      const tokens = parsed.tokens
      const typo = getTypography(category)
      console.log('[designSystem] Haiku palette:', parsed.palette_name)
      return {
        palette_name: parsed.palette_name ?? `${appName} ${category}`,
        mood: parsed.mood ?? defaults.mood,
        category,
        tokens,
        typography: typo,
        css: tokensToCSS(tokens, typo),
      }
    }
    console.log('[designSystem] Haiku tokens failed validation, using defaults')
  } catch (e) {
    console.log('[designSystem] Haiku refinement failed (using defaults):', e instanceof Error ? e.message : String(e))
  }

  // Fallback — category defaults always work
  const typo = getTypography(category)
  return {
    palette_name: `${appName} ${defaults.mood.split(',')[0].trim()}`,
    mood: defaults.mood,
    category,
    tokens: defaults.tokens,
    typography: typo,
    css: tokensToCSS(defaults.tokens, typo),
  }
}
