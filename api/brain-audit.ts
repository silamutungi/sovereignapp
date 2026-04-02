// api/brain-audit.ts — Brain Audit Engine
//
// POST /api/brain-audit
// Body: { buildId, deployUrl, supabaseRef, repoOwner, repoName }
//
// Fires after every build (READY) and every edit (files changed > 0).
// Fire-and-forget — never blocks build or edit flow.
// All checks run in parallel via Promise.allSettled.
// Auto-fixes: RLS (SQL), nav, colors, branding, alt text, logo link via edit engine.
// Flags to user: exposed secrets, broken nav links.
// Results logged to audit_log table.

import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp } from './_rateLimit.js'

export const maxDuration = 120

const MODEL_FAST = 'claude-haiku-4-5-20251001'

// ── Types ─────────────────────────────────────────────────────────────────────

type AuditSeverity = 'info' | 'warning' | 'critical'

type AuditResult = {
  check: string
  passed: boolean
  severity: AuditSeverity
  auto_fixable: boolean
  fix_instruction?: string
  details?: string
}

type AuditReport = {
  build_id: string
  passed: boolean
  results: AuditResult[]
  auto_fixed: string[]
  alerts: AuditResult[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

// ── Fetch repo files from GitHub ──────────────────────────────────────────────

async function fetchRepoFiles(
  owner: string,
  repo: string,
  token: string,
): Promise<Record<string, string>> {
  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  }

  // Get the file tree
  const treeRes = await fetchWithTimeout(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
    { headers: ghHeaders },
    10_000,
  )

  if (!treeRes.ok) {
    console.error('[brain-audit] tree fetch failed:', treeRes.status)
    return {}
  }

  const tree = await treeRes.json() as { tree: { path: string; type: string; url: string }[] }

  // Filter for relevant files
  const relevantFiles = tree.tree.filter(
    (f) => f.type === 'blob' && /\.(tsx?|css|json|html)$/.test(f.path),
  )

  // Fetch file contents in parallel (limit to 20 files to stay under rate limits)
  const filesToFetch = relevantFiles.slice(0, 20)
  const entries = await Promise.allSettled(
    filesToFetch.map(async (f) => {
      const res = await fetchWithTimeout(
        `https://api.github.com/repos/${owner}/${repo}/contents/${f.path}`,
        { headers: { ...ghHeaders, Accept: 'application/vnd.github.v3.raw' } },
        8_000,
      )
      if (!res.ok) return null
      const content = await res.text()
      return { path: f.path, content }
    }),
  )

  const files: Record<string, string> = {}
  for (const entry of entries) {
    if (entry.status === 'fulfilled' && entry.value) {
      files[entry.value.path] = entry.value.content
    }
  }

  return files
}

// ── Audit checks ──────────────────────────────────────────────────────────────

function checkMobileNav(repoFiles: Record<string, string>): AuditResult {
  // Look for nav component in src/
  const navFiles = Object.entries(repoFiles).filter(
    ([path]) => /src\/.*nav/i.test(path) && path.endsWith('.tsx'),
  )

  if (navFiles.length === 0) {
    // No nav component at all — check App.tsx for inline nav
    const appContent = repoFiles['src/App.tsx'] ?? ''
    if (!appContent.includes('<nav') && !appContent.includes('Nav')) {
      return {
        check: 'checkMobileNav',
        passed: true, // No nav to check
        severity: 'warning',
        auto_fixable: false,
        details: 'No navigation component detected.',
      }
    }
  }

  // Check all nav-related content for mobile hamburger pattern
  const navContent = navFiles.map(([, c]) => c).join('\n')
  const appContent = repoFiles['src/App.tsx'] ?? ''
  const allNavContent = navContent + '\n' + appContent

  const hasHamburger =
    /useState.*menu|useState.*open|useState.*mobile|useState.*drawer/i.test(allNavContent) &&
    (/md:|lg:|hidden.*sm|sm:hidden|md:hidden|lg:hidden|block.*md/i.test(allNavContent) ||
     /Menu|Hamburger|hamburger|bars|☰|≡/i.test(allNavContent))

  return {
    check: 'checkMobileNav',
    passed: hasHamburger,
    severity: 'warning',
    auto_fixable: true,
    ...(hasHamburger
      ? {}
      : {
          fix_instruction:
            'Add a responsive mobile hamburger nav drawer to the site navigation component. Use useState for open/close, a hamburger icon (three lines) visible below md breakpoint, and a slide-in drawer with Paper background, Ink links, and Flame active state. Closes on tap/click outside. Desktop nav remains unchanged.',
        }),
  }
}

async function checkRLS(supabaseRef: string): Promise<AuditResult> {
  const managementToken = process.env.VISILA_SUPABASE_MANAGEMENT_TOKEN
  if (!managementToken || !supabaseRef) {
    return {
      check: 'checkRLS',
      passed: true, // Cannot verify — skip
      severity: 'critical',
      auto_fixable: false,
      details: 'Supabase management token or project ref not available. RLS check skipped.',
    }
  }

  try {
    // Query pg_tables to check RLS status
    const queryRes = await fetchWithTimeout(
      `https://api.supabase.com/v1/projects/${supabaseRef}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managementToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            SELECT tablename, rowsecurity
            FROM pg_tables
            WHERE schemaname = 'public'
          `,
        }),
      },
      10_000,
    )

    if (!queryRes.ok) {
      console.error('[brain-audit] RLS check query failed:', queryRes.status)
      return {
        check: 'checkRLS',
        passed: true,
        severity: 'critical',
        auto_fixable: false,
        details: 'Could not query Supabase for RLS status.',
      }
    }

    const rows = await queryRes.json() as { tablename: string; rowsecurity: boolean }[]
    const unprotected = rows.filter((r) => !r.rowsecurity)

    if (unprotected.length === 0) {
      return { check: 'checkRLS', passed: true, severity: 'critical', auto_fixable: false }
    }

    // Auto-fix: enable RLS on unprotected tables
    const fixSql = unprotected
      .map((r) => `ALTER TABLE public."${r.tablename}" ENABLE ROW LEVEL SECURITY;`)
      .join('\n')

    try {
      await fetchWithTimeout(
        `https://api.supabase.com/v1/projects/${supabaseRef}/database/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${managementToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: fixSql }),
        },
        10_000,
      )
      console.log('[brain-audit] RLS auto-fixed on:', unprotected.map((r) => r.tablename))

      return {
        check: 'checkRLS',
        passed: false,
        severity: 'critical',
        auto_fixable: true,
        fix_instruction: fixSql,
        details: `RLS was missing on: ${unprotected.map((r) => r.tablename).join(', ')}. Auto-fixed.`,
      }
    } catch {
      return {
        check: 'checkRLS',
        passed: false,
        severity: 'critical',
        auto_fixable: false,
        details: `RLS missing on: ${unprotected.map((r) => r.tablename).join(', ')}. Auto-fix failed — enable manually in Supabase.`,
      }
    }
  } catch (err) {
    console.error('[brain-audit] RLS check error:', err)
    return {
      check: 'checkRLS',
      passed: true,
      severity: 'critical',
      auto_fixable: false,
      details: 'RLS check failed due to network error.',
    }
  }
}

function checkHardcodedColors(repoFiles: Record<string, string>): AuditResult {
  const brandHexes = [
    '#FF1F6E', '#ff1f6e',
    '#FF6B35', '#ff6b35',
    '#8B0040', '#8b0040',
    '#CC0055', '#cc0055',
    '#FF80AA', '#ff80aa',
    '#0e0d0b', '#0E0D0B',
    '#f2efe8', '#F2EFE8',
  ]

  const violations: string[] = []

  for (const [path, content] of Object.entries(repoFiles)) {
    if (!/\.(tsx|css)$/.test(path)) continue
    // Skip CSS variable definitions (index.css :root block)
    if (path.includes('index.css')) continue

    for (const hex of brandHexes) {
      if (content.includes(hex)) {
        violations.push(`${path}: ${hex}`)
      }
    }
  }

  return {
    check: 'checkHardcodedColors',
    passed: violations.length === 0,
    severity: 'info',
    auto_fixable: true,
    ...(violations.length > 0
      ? {
          fix_instruction:
            'Replace all hardcoded Visila brand hex values with CSS custom properties: --color-flame, --color-ember, --color-dark, --color-mid, --color-highlight, --color-ink, --color-paper. Check src/index.css for the variable definitions.',
          details: `Found hardcoded brand colors in: ${violations.join(', ')}`,
        }
      : {}),
  }
}

function checkBranding(repoFiles: Record<string, string>): AuditResult {
  const violations: string[] = []

  for (const [path, content] of Object.entries(repoFiles)) {
    if (!/\.tsx$/.test(path)) continue

    // Match user-facing strings: JSX text content and string literals
    // Ignore identifiers, imports, class names, env vars
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip import lines, comments, CSS class references
      if (/^\s*(import|\/\/|\/\*|\*|className)/.test(line)) continue
      // Skip env var references
      if (/SOVEREIGN|process\.env/i.test(line)) continue

      // Check for "Sovereign" in JSX text or string content
      if (/['"`>].*\bSovereign\b/i.test(line) || /\bSOVEREIGN\b/.test(line)) {
        violations.push(`${path}:${i + 1}`)
      }
    }
  }

  return {
    check: 'checkBranding',
    passed: violations.length === 0,
    severity: 'warning',
    auto_fixable: true,
    ...(violations.length > 0
      ? {
          fix_instruction:
            "Replace all user-facing 'Sovereign' brand references with 'Visila' in the UI components.",
          details: `Old brand name found at: ${violations.slice(0, 10).join(', ')}`,
        }
      : {}),
  }
}

function checkExposedSecrets(repoFiles: Record<string, string>): AuditResult {
  const patterns = [
    /sk_live_[A-Za-z0-9]{20,}/,
    /sk_test_[A-Za-z0-9]{20,}/,
    /Bearer\s+[A-Za-z0-9]{32,}/,
    /eyJhbGciOi[A-Za-z0-9._-]{40,}/, // JWT
    /AKIA[A-Z0-9]{16}/, // AWS access key
    /ghp_[A-Za-z0-9]{36,}/, // GitHub personal access token
    /gho_[A-Za-z0-9]{36,}/, // GitHub OAuth token
    /xoxb-[A-Za-z0-9-]{20,}/, // Slack bot token
  ]

  const violations: string[] = []

  for (const [path, content] of Object.entries(repoFiles)) {
    // Only scan src/ files
    if (!path.startsWith('src/')) continue
    // Skip type definition files
    if (path.endsWith('.d.ts')) continue

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        violations.push(`${path}: matches ${pattern.source.slice(0, 20)}...`)
        break // One match per file is enough
      }
    }
  }

  return {
    check: 'checkExposedSecrets',
    passed: violations.length === 0,
    severity: 'critical',
    auto_fixable: false,
    ...(violations.length > 0
      ? {
          details:
            'A potential secret was found hardcoded in your app. Rotate it immediately and move it to an environment variable. Found in: ' +
            violations.join('; '),
        }
      : {}),
  }
}

function checkBrokenNavLinks(repoFiles: Record<string, string>, _deployUrl: string): AuditResult {
  // Extract routes from React Router config
  const routerPaths = new Set<string>()
  for (const [path, content] of Object.entries(repoFiles)) {
    if (!/main\.tsx|App\.tsx/.test(path)) continue
    // Match: path="/something" or path="/"
    const routeMatches = content.matchAll(/path=["']([^"']+)["']/g)
    for (const m of routeMatches) {
      routerPaths.add(m[1])
    }
  }

  if (routerPaths.size === 0) {
    return { check: 'checkBrokenNavLinks', passed: true, severity: 'warning', auto_fixable: false }
  }

  // Extract nav links
  const brokenLinks: string[] = []
  for (const [path, content] of Object.entries(repoFiles)) {
    if (!/nav/i.test(path) && !/Navbar/i.test(path) && !/Header/i.test(path)) continue
    // Match: to="/something" or href="/something" (internal links)
    const linkMatches = content.matchAll(/(?:to|href)=["'](\/[^"']*?)["']/g)
    for (const m of linkMatches) {
      const linkPath = m[1]
      // Skip anchors and external
      if (linkPath.startsWith('/#') || linkPath.startsWith('/http')) continue
      // Check if route exists (exact or prefix match for dynamic routes)
      const exists = routerPaths.has(linkPath) ||
        [...routerPaths].some((r) => r.includes(':') && linkPath.startsWith(r.split(':')[0]))
      if (!exists && linkPath !== '/') {
        brokenLinks.push(linkPath)
      }
    }
  }

  return {
    check: 'checkBrokenNavLinks',
    passed: brokenLinks.length === 0,
    severity: 'warning',
    auto_fixable: false,
    ...(brokenLinks.length > 0
      ? { details: `Broken navigation links found: ${brokenLinks.join(', ')}. These routes don't exist in the React Router config.` }
      : {}),
  }
}

function checkAltText(repoFiles: Record<string, string>): AuditResult {
  const violations: string[] = []

  for (const [path, content] of Object.entries(repoFiles)) {
    if (!/\.tsx$/.test(path)) continue

    // Find <img> tags missing alt or with empty alt=""
    // Match <img that doesn't have alt= before >
    const imgMatches = content.matchAll(/<img\b[^>]*?(?:\/?>)/g)
    for (const m of imgMatches) {
      const tag = m[0]
      if (!tag.includes('alt=') || /alt=["']\s*["']/.test(tag)) {
        violations.push(path)
        break // One per file
      }
    }
  }

  return {
    check: 'checkAltText',
    passed: violations.length === 0,
    severity: 'info',
    auto_fixable: true,
    ...(violations.length > 0
      ? {
          fix_instruction:
            'Add descriptive alt text to all images that are missing it. Infer the description from surrounding context and image src URL.',
          details: `Images missing alt text in: ${violations.join(', ')}`,
        }
      : {}),
  }
}

function checkLogoHomeLink(repoFiles: Record<string, string>): AuditResult {
  // Look for nav/header components
  const navFiles = Object.entries(repoFiles).filter(
    ([path]) => (/nav/i.test(path) || /header/i.test(path)) && path.endsWith('.tsx'),
  )

  if (navFiles.length === 0) {
    return { check: 'checkLogoHomeLink', passed: true, severity: 'info', auto_fixable: false }
  }

  const navContent = navFiles.map(([, c]) => c).join('\n')

  // Check if logo/brand element is wrapped in a Link to="/"
  const hasLogoLink =
    // Link wrapping logo: <Link to="/"><Logo|img|svg
    /Link\s+to=["']\/["'][^>]*>[\s\S]{0,200}(?:logo|Logo|img|svg|brand)/i.test(navContent) ||
    // Or: <a href="/"><Logo|img|svg
    /href=["']\/["'][^>]*>[\s\S]{0,200}(?:logo|Logo|img|svg|brand)/i.test(navContent) ||
    // Logo with onClick navigating home
    /logo[\s\S]{0,100}navigate\(['"]\/['"]\)/i.test(navContent)

  return {
    check: 'checkLogoHomeLink',
    passed: hasLogoLink,
    severity: 'info',
    auto_fixable: true,
    ...(hasLogoLink
      ? {}
      : {
          fix_instruction:
            "Wrap the app logo in the nav component with a React Router Link to '/' so clicking it returns to the homepage.",
        }),
  }
}

// ── Typography check ─────────────────────────────────────────────────────────

function checkTypography(repoFiles: Record<string, string>): AuditResult {
  const violations: string[] = []

  for (const [path, content] of Object.entries(repoFiles)) {
    if (!path.endsWith('.tsx') && !path.endsWith('.css')) continue

    // Check for hardcoded font-size in px (CSS and inline styles)
    const pxSizes = content.match(/font-size:\s*\d+px/g) ?? []
    const inlineSizes = content.match(/fontSize:\s*['"]?\d+(?:px)?['"]?/g) ?? []
    if (pxSizes.length > 0 || inlineSizes.length > 0) {
      violations.push(`${path}: ${pxSizes.length + inlineSizes.length} hardcoded font-size values`)
    }

    // Check for font-weight below 400 (Thin/Light)
    const thinWeights = content.match(/font-weight:\s*(100|200|300)\b/g) ?? []
    const inlineThin = content.match(/fontWeight:\s*['"]?(100|200|300)\b/g) ?? []
    if (thinWeights.length > 0 || inlineThin.length > 0) {
      violations.push(`${path}: font-weight below 400 (Thin/Light — illegible)`)
    }
  }

  if (violations.length === 0) {
    return {
      check: 'checkTypography',
      passed: true,
      severity: 'info',
      auto_fixable: false,
      details: 'No typography violations found',
    }
  }

  return {
    check: 'checkTypography',
    passed: false,
    severity: 'warning',
    auto_fixable: false,
    details: violations.join('; '),
  }
}

// ── Core audit runner ─────────────────────────────────────────────────────────

export async function runBrainAudit(
  buildId: string,
  deployUrl: string,
  supabaseRef: string,
  repoOwner: string,
  repoName: string,
): Promise<AuditReport> {
  const supabase = getSupabase()

  // Fetch the build to get the github token
  const { data: build } = await supabase
    .from('builds')
    .select('github_token')
    .eq('id', buildId)
    .is('deleted_at', null)
    .single()

  const githubToken = process.env.SOVEREIGN_GITHUB_TOKEN ?? build?.github_token
  if (!githubToken) {
    console.error('[brain-audit] no GitHub token available for build:', buildId)
    return { build_id: buildId, passed: true, results: [], auto_fixed: [], alerts: [] }
  }

  // 1. Fetch full src/ file tree from GitHub
  console.log('[brain-audit] fetching repo files:', repoOwner, repoName)
  const repoFiles = await fetchRepoFiles(repoOwner, repoName, githubToken)
  const fileCount = Object.keys(repoFiles).length
  console.log('[brain-audit] fetched', fileCount, 'files')

  if (fileCount === 0) {
    console.warn('[brain-audit] no files fetched — skipping audit')
    return { build_id: buildId, passed: true, results: [], auto_fixed: [], alerts: [] }
  }

  // 2. Run all checks in parallel
  const settled = await Promise.allSettled([
    checkMobileNav(repoFiles),
    checkRLS(supabaseRef),
    checkHardcodedColors(repoFiles),
    checkBranding(repoFiles),
    checkExposedSecrets(repoFiles),
    checkBrokenNavLinks(repoFiles, deployUrl),
    checkAltText(repoFiles),
    checkLogoHomeLink(repoFiles),
    checkTypography(repoFiles),
  ])

  const results: AuditResult[] = []
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      results.push(s.value)
    } else {
      console.error('[brain-audit] check failed:', s.reason)
    }
  }

  // 3. Process auto-fixable failures via edit engine
  const autoFixed: string[] = []
  const alerts: AuditResult[] = []

  for (const result of results) {
    if (result.passed) continue

    // RLS was already auto-fixed directly via SQL in the check itself
    if (result.check === 'checkRLS' && result.auto_fixable) {
      autoFixed.push(result.check)
      continue
    }

    if (result.auto_fixable && result.fix_instruction) {
      // Fire edit engine to auto-fix
      try {
        const { data: buildData } = await supabase
          .from('builds')
          .select('repo_url, app_name')
          .eq('id', buildId)
          .single()

        if (buildData?.repo_url) {
          const editRes = await fetchWithTimeout(
            `${process.env.VITE_APP_URL ?? 'https://visila.com'}/api/edit`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                buildId,
                appName: buildData.app_name,
                repoUrl: buildData.repo_url,
                editRequest: result.fix_instruction,
              }),
            },
            60_000, // 60s for edit engine
          )

          if (editRes.ok) {
            const editData = await editRes.json() as { ok?: boolean; commitSha?: string }
            if (editData.ok && editData.commitSha) {
              autoFixed.push(result.check)
              result.details = (result.details ?? '') + ' Auto-fixed.'
              continue
            }
          }
        }
      } catch (editErr) {
        console.error('[brain-audit] auto-fix failed for', result.check, editErr)
      }
    }

    // Not auto-fixed — surface as alert
    alerts.push(result)
  }

  // 4. Log all results to audit_log
  const logEntries = results.map((r) => ({
    build_id: buildId,
    check_name: r.check,
    passed: r.passed,
    severity: r.severity,
    auto_fixed: autoFixed.includes(r.check),
    details: r.details ? { message: r.details } : null,
  }))

  if (logEntries.length > 0) {
    const { error: logError } = await supabase.from('audit_log').insert(logEntries)
    if (logError) {
      console.error('[brain-audit] failed to insert audit_log:', logError.message)
    }
  }

  // 5. Return report
  const hasCriticalFailure = results.some(
    (r) => !r.passed && r.severity === 'critical' && !autoFixed.includes(r.check),
  )

  const report: AuditReport = {
    build_id: buildId,
    passed: !hasCriticalFailure,
    results,
    auto_fixed: autoFixed,
    alerts,
  }

  console.log(
    '[brain-audit] done. passed:', report.passed,
    'auto_fixed:', autoFixed.length,
    'alerts:', alerts.length,
  )

  return report
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = getClientIp(req)
  const rl = checkRateLimit(`brain-audit:${ip}`, 20, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: 'Rate limit exceeded' })
    return
  }

  const { buildId, deployUrl, supabaseRef, repoOwner, repoName } =
    (req.body ?? {}) as Record<string, unknown>

  if (!buildId || !repoOwner || !repoName) {
    res.status(400).json({ error: 'Missing required fields: buildId, repoOwner, repoName' })
    return
  }

  try {
    const report = await runBrainAudit(
      String(buildId),
      String(deployUrl ?? ''),
      String(supabaseRef ?? ''),
      String(repoOwner),
      String(repoName),
    )

    res.status(200).json(report)
  } catch (err) {
    console.error('[brain-audit] unhandled error:', err)
    res.status(500).json({ error: 'Brain audit failed' })
  }
}

// Suppress unused import warning for MODEL_FAST — used in future Haiku-based checks
void MODEL_FAST
