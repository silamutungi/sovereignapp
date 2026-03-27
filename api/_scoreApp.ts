// api/_scoreApp.ts — In-memory app confidence scorer
//
// Runs all 10 Sovereign Standards dimensions against the generated file content
// (AppFileEntry[]) without reading from the filesystem. Designed to run inside
// a Vercel serverless function after generation and before final status update.
//
// Returns a ConfidenceScore (0–100) + per-dimension breakdown.

export interface DimensionScore {
  dimension: string
  score: number
  passed: boolean
  issues: string[]
}

export interface ConfidenceScore {
  overall: number
  band: 'EXCEPTIONAL' | 'STRONG' | 'GOOD' | 'ADEQUATE' | 'NEEDS_IMPROVEMENT' | 'CRITICAL'
  launchGatePassed: boolean
  dimensions: DimensionScore[]
}

interface AppFile {
  path: string
  content: string
}

// ── Weights (must sum to 100) ─────────────────────────────────────────────────
const WEIGHTS: Record<string, number> = {
  security:      25,
  ux:            20,
  code_quality:  15,
  architecture:  15,
  accessibility: 10,
  performance:    5,
  seo:            5,
  documentation:  3,
  i18n:           1,
  test_coverage:  1,
}

function band(score: number): ConfidenceScore['band'] {
  if (score >= 90) return 'EXCEPTIONAL'
  if (score >= 80) return 'STRONG'
  if (score >= 70) return 'GOOD'
  if (score >= 60) return 'ADEQUATE'
  if (score >= 50) return 'NEEDS_IMPROVEMENT'
  return 'CRITICAL'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function filesByType(files: AppFile[], ext: string): AppFile[] {
  return files.filter(f => f.path.endsWith(ext))
}

function contentOf(files: AppFile[], pathFragment: string): string {
  return files.find(f => f.path.includes(pathFragment))?.content ?? ''
}

function hasPattern(content: string, pattern: RegExp | string): boolean {
  return typeof pattern === 'string'
    ? content.includes(pattern)
    : pattern.test(content)
}

function allContent(files: AppFile[], ext?: string): string {
  const filtered = ext ? filesByType(files, ext) : files
  return filtered.map(f => f.content).join('\n')
}

// ── Dimension evaluators ──────────────────────────────────────────────────────

function scoreSecurity(files: AppFile[]): DimensionScore {
  const issues: string[] = []
  let score = 100

  const vercelJson = contentOf(files, 'vercel.json')
  const apiContent = allContent(files.filter(f => f.path.startsWith('api/')))
  const allSrc = allContent(files)

  if (!hasPattern(vercelJson, 'Content-Security-Policy')) {
    issues.push('No CSP header in vercel.json')
    score -= 20
  }
  if (!hasPattern(vercelJson, 'frame-ancestors') && !hasPattern(vercelJson, 'X-Frame-Options')) {
    issues.push('No clickjacking protection')
    score -= 10
  }
  if (apiContent && !hasPattern(apiContent, 'checkRateLimit')) {
    issues.push('No rate limiting detected in API routes')
    score -= 20
  }
  if (hasPattern(allSrc, /process\.env\.[A-Z_]{5,}/)) {
    // Fine — env vars are expected
  }
  if (hasPattern(allSrc, /(password|secret|token)\s*=\s*["'][^"']{8,}/i)) {
    issues.push('Possible hardcoded secret detected')
    score -= 30
  }
  if (hasPattern(allSrc, 'dangerouslySetInnerHTML')) {
    issues.push('dangerouslySetInnerHTML used — verify input is sanitized')
    score -= 15
  }

  return { dimension: 'security', score: Math.max(0, score), passed: score >= 80, issues }
}

function scoreUX(files: AppFile[]): DimensionScore {
  const issues: string[] = []
  let score = 100
  const tsx = allContent(files, '.tsx')
  const ts  = tsx + allContent(files, '.ts')

  if (!hasPattern(ts, /isLoading|loading|setLoading|isPending/)) {
    issues.push('No loading states detected')
    score -= 20
  }
  if (!hasPattern(ts, /error|setError|isError|catch/)) {
    issues.push('No error handling detected')
    score -= 20
  }
  if (!hasPattern(ts, /empty|no data|get started|no .* yet/i)) {
    issues.push('No empty states detected')
    score -= 10
  }
  if (!hasPattern(tsx, /md:|lg:|sm:/)) {
    issues.push('No responsive breakpoints (Tailwind md:/lg:) found')
    score -= 15
  }
  if (!hasPattern(tsx, /transition|animate|duration/)) {
    issues.push('No transitions/animations found')
    score -= 10
  }

  return { dimension: 'ux', score: Math.max(0, score), passed: score >= 70, issues }
}

function scoreCodeQuality(files: AppFile[]): DimensionScore {
  const issues: string[] = []
  let score = 100
  const tsx = allContent(files, '.tsx')
  const allTs = tsx + allContent(files, '.ts')

  if (hasPattern(allTs, /React\.(useState|useEffect|useCallback|useMemo|useRef|ReactNode|FormEvent|ChangeEvent|KeyboardEvent)/)) {
    issues.push('React.* namespace usage detected — use named imports')
    score -= 20
  }
  if (hasPattern(allTs, /console\.log/)) {
    issues.push('console.log statements found in production code')
    score -= 10
  }
  if (hasPattern(allTs, /@ts-ignore|@ts-expect-error/)) {
    issues.push('@ts-ignore suppression found')
    score -= 10
  }
  if (!files.some(f => f.path.endsWith('.tsx') || f.path.endsWith('.ts'))) {
    issues.push('No TypeScript files — JavaScript only')
    score -= 20
  }
  if (hasPattern(allTs, /@\//)) {
    issues.push('@/ path aliases used — not supported in generated apps')
    score -= 15
  }

  return { dimension: 'code_quality', score: Math.max(0, score), passed: score >= 75, issues }
}

function scoreArchitecture(files: AppFile[]): DimensionScore {
  const issues: string[] = []
  let score = 100

  const hasPages     = files.some(f => f.path.startsWith('src/pages/'))
  const hasComponents = files.some(f => f.path.startsWith('src/components/'))
  const hasLib       = files.some(f => f.path.startsWith('src/lib/'))
  const hasVercelJson = files.some(f => f.path === 'vercel.json')
  const hasPackageJson = files.some(f => f.path === 'package.json')

  if (!hasPages) { issues.push('No src/pages/ directory'); score -= 15 }
  if (!hasComponents) { issues.push('No src/components/ directory'); score -= 10 }
  if (!hasLib) { issues.push('No src/lib/ directory'); score -= 5 }
  if (!hasVercelJson) { issues.push('vercel.json missing'); score -= 20 }
  if (!hasPackageJson) { issues.push('package.json missing'); score -= 20 }

  // Penalise monolithic files > 600 lines
  for (const f of files.filter(f => f.path.endsWith('.tsx') || f.path.endsWith('.ts'))) {
    const lines = f.content.split('\n').length
    if (lines > 600) {
      issues.push(`${f.path} is ${lines} lines — consider splitting`)
      score -= 10
    }
  }

  return { dimension: 'architecture', score: Math.max(0, score), passed: score >= 75, issues }
}

function scoreAccessibility(files: AppFile[]): DimensionScore {
  const issues: string[] = []
  let score = 100
  const tsx = allContent(files, '.tsx')
  const html = contentOf(files, 'index.html')
  const allHtml = tsx + html

  if (hasPattern(allHtml, /<img/i) && !hasPattern(allHtml, /alt=/)) {
    issues.push('img tags missing alt attributes')
    score -= 20
  }
  if (!hasPattern(allHtml, /aria-label|aria-labelledby|aria-describedby/)) {
    issues.push('No ARIA labels found')
    score -= 15
  }
  if (!hasPattern(allHtml, /<main|<nav|<header|<footer|<section/i)) {
    issues.push('No semantic HTML landmarks (main, nav, header, footer)')
    score -= 15
  }
  if (!hasPattern(allHtml, /focus:|focus-visible:/)) {
    issues.push('No focus styles — keyboard navigation may be broken')
    score -= 10
  }

  return { dimension: 'accessibility', score: Math.max(0, score), passed: score >= 70, issues }
}

function scorePerformance(files: AppFile[]): DimensionScore {
  const issues: string[] = []
  let score = 100
  const tsx = allContent(files, '.tsx')

  // Check for large inline base64 images
  if (hasPattern(tsx, /data:image\/[^;]{3,10};base64,[A-Za-z0-9+/]{200,}/)) {
    issues.push('Large base64 inline image detected — use external URL')
    score -= 20
  }
  // Synchronous loops over large datasets
  if (hasPattern(tsx, /\.forEach|\.map|\.filter|\.reduce/)) {
    // Common patterns — not penalised
  }
  if (!hasPattern(contentOf(files, 'vite.config'), 'build')) {
    issues.push('No vite build config — production optimisation may be missing')
    score -= 10
  }

  return { dimension: 'performance', score: Math.max(0, score), passed: score >= 70, issues }
}

function scoreSEO(files: AppFile[]): DimensionScore {
  const issues: string[] = []
  let score = 100
  const html = contentOf(files, 'index.html')

  if (!hasPattern(html, /<title/i)) { issues.push('Missing <title> tag'); score -= 20 }
  if (!hasPattern(html, /meta.*description/i)) { issues.push('Missing meta description'); score -= 15 }
  if (!hasPattern(html, /og:title|og:description|og:image/i)) { issues.push('Missing Open Graph tags'); score -= 15 }
  if (!hasPattern(html, /robots/i)) { issues.push('No robots meta tag'); score -= 5 }
  if (!hasPattern(html, /canonical/i)) { issues.push('No canonical URL'); score -= 5 }

  return { dimension: 'seo', score: Math.max(0, score), passed: score >= 60, issues }
}

function scoreDocumentation(files: AppFile[]): DimensionScore {
  const issues: string[] = []
  let score = 100

  if (!files.some(f => f.path === 'README.md')) { issues.push('README.md missing'); score -= 30 }
  if (!files.some(f => f.path === 'CLAUDE.md')) { issues.push('CLAUDE.md missing'); score -= 20 }
  if (!files.some(f => f.path === '.env.example')) { issues.push('.env.example missing'); score -= 20 }

  return { dimension: 'documentation', score: Math.max(0, score), passed: score >= 60, issues }
}

function scoreI18n(files: AppFile[]): DimensionScore {
  const issues: string[] = []
  let score = 80 // Start at 80 — no generated app has full i18n out of the box
  const tsx = allContent(files, '.tsx')

  if (hasPattern(tsx, /src\/lib\/i18n|useTranslation|i18next/)) {
    score = 90  // Has i18n setup
  } else {
    issues.push('No i18n library detected — hardcoded strings only')
  }

  return { dimension: 'i18n', score, passed: score >= 60, issues }
}

function scoreTestCoverage(files: AppFile[]): DimensionScore {
  const issues: string[] = []
  const hasTests = files.some(f => f.path.includes('.test.') || f.path.includes('.spec.'))
  const score = hasTests ? 70 : 30

  if (!hasTests) {
    issues.push('No test files found — add tests before shipping to production')
  }

  return { dimension: 'test_coverage', score, passed: hasTests, issues }
}

// ── Main scorer ───────────────────────────────────────────────────────────────

export function scoreApp(files: AppFile[]): ConfidenceScore {
  const dimensions: DimensionScore[] = [
    scoreSecurity(files),
    scoreUX(files),
    scoreCodeQuality(files),
    scoreArchitecture(files),
    scoreAccessibility(files),
    scorePerformance(files),
    scoreSEO(files),
    scoreDocumentation(files),
    scoreI18n(files),
    scoreTestCoverage(files),
  ]

  const overall = Math.round(
    dimensions.reduce((sum, d) => {
      const w = WEIGHTS[d.dimension] ?? 0
      return sum + (d.score * w) / 100
    }, 0),
  )

  // Launch gate: security must pass + overall >= 60
  const securityDim = dimensions.find(d => d.dimension === 'security')
  const launchGatePassed = overall >= 60 && (securityDim?.passed ?? false)

  return {
    overall,
    band: band(overall),
    launchGatePassed,
    dimensions,
  }
}
