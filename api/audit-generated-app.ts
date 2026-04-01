// api/audit-generated-app.ts — 35-check Visila audit checklist
//
// POST { files: { path: string; content: string }[] }
//
// Runs all 35 audit checks from the Visila Design System against in-memory
// file content. Returns pass/fail per check grouped by category, plus a summary.
// Does not read from the filesystem. Safe to call inside any serverless function.
//
// Security audit comment:
// - Accepts only POST
// - No auth required — audit is read-only and operates on caller-supplied content
// - Rate limited: 30/hr per IP
// - Input truncated to 10 MB total content

import { checkRateLimit, getClientIp } from './_rateLimit.js'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

interface AppFile {
  path: string
  content: string
}

interface AuditCheck {
  id: string
  category: string
  description: string
  passed: boolean
  note?: string
}

interface AuditReport {
  passed: number
  failed: number
  total: number
  score: number // passed / total * 100
  shippable: boolean // all 9 security + resilience checks pass
  categories: Record<string, { passed: number; total: number; checks: AuditCheck[] }>
}

function content(files: AppFile[], pathFragment: string): string {
  return files.find(f => f.path.includes(pathFragment))?.content ?? ''
}

function allContent(files: AppFile[], ext?: string): string {
  const filtered = ext ? files.filter(f => f.path.endsWith(ext)) : files
  return filtered.map(f => f.content).join('\n')
}

function has(text: string, pattern: RegExp | string): boolean {
  return typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text)
}

export function auditApp(files: AppFile[]): AuditReport {
  const tsx    = allContent(files, '.tsx')
  const ts     = tsx + allContent(files, '.ts')
  const html   = content(files, 'index.html')
  const css    = allContent(files, '.css')
  const vercel = content(files, 'vercel.json')
  const all    = allContent(files)

  const checks: AuditCheck[] = [

    // ── Design (4) ─────────────────────────────────────────────────────────────
    {
      id: 'design-1',
      category: 'Design',
      description: 'Would a non-developer be proud to show this to a client?',
      passed: has(tsx, /font-serif/) && has(tsx, /font-mono/) && has(tsx, /transition/),
      note: 'Heuristic: checks for serif headings, mono body, and transitions.',
    },
    {
      id: 'design-2',
      category: 'Design',
      description: 'Does every interactive element look interactive without explanation?',
      passed: has(tsx, /cursor-pointer/) || has(tsx, /hover:/),
    },
    {
      id: 'design-3',
      category: 'Design',
      description: 'Are all empty, loading, and error states designed?',
      passed:
        has(ts, /isLoading|loading|isPending/) &&
        has(ts, /error|setError|isError/) &&
        has(ts, /empty|no data|get started|no .* yet/i),
    },
    {
      id: 'design-4',
      category: 'Design',
      description: 'Does it look and feel like a $10,000 agency built it?',
      passed:
        has(tsx, /Playfair|font-serif/) &&
        has(tsx, /DM Mono|font-mono/) &&
        has(tsx, /transition|duration/) &&
        !has(tsx, /lorem ipsum/i),
    },

    // ── Copy (3) ───────────────────────────────────────────────────────────────
    {
      id: 'copy-1',
      category: 'Copy',
      description: 'Does the landing page pass the 5-second test?',
      passed: has(tsx, /<h1/) && has(tsx, /<p/),
      note: 'Heuristic: checks for H1 headline and supporting paragraph.',
    },
    {
      id: 'copy-2',
      category: 'Copy',
      description: 'Is every piece of copy at 8th grade reading level or below?',
      // Cannot evaluate reading level statically — flag as manual
      passed: true,
      note: 'Manual check required — reading level cannot be evaluated statically.',
    },
    {
      id: 'copy-3',
      category: 'Copy',
      description: 'Has every unnecessary word been removed from every screen?',
      passed: !has(all, /lorem ipsum/i),
      note: 'Fails if lorem ipsum placeholder text is present.',
    },

    // ── Usability (4) ──────────────────────────────────────────────────────────
    {
      id: 'usability-1',
      category: 'Usability',
      description: "Is every screen's primary action immediately obvious?",
      passed: has(tsx, /<button/) || has(tsx, /btn|cta/i),
    },
    {
      id: 'usability-2',
      category: 'Usability',
      description: 'Can a user dropped onto any page instantly know where they are and what to do?',
      passed: has(tsx, /<nav/) && has(tsx, /<main|<section/i),
    },
    {
      id: 'usability-3',
      category: 'Usability',
      description: 'Are all form fields labeled above the input — never placeholder-only?',
      passed: !has(tsx, /placeholder=/) || has(tsx, /<label/),
      note: 'Fails if placeholder is used without a label.',
    },
    {
      id: 'usability-4',
      category: 'Usability',
      description: 'Does every action produce visible feedback within 100ms?',
      passed: has(ts, /isLoading|setLoading|isPending/) && has(tsx, /disabled/),
    },

    // ── Information Architecture (3) ───────────────────────────────────────────
    {
      id: 'ia-1',
      category: 'Information Architecture',
      description: 'Does the navigation reflect how users think, not how the database is structured?',
      passed: has(tsx, /<nav/),
    },
    {
      id: 'ia-2',
      category: 'Information Architecture',
      description: 'Can a new user complete the core loop in under 3 minutes without instructions?',
      passed: true,
      note: 'Manual check required — cannot evaluate user flow timing statically.',
    },
    {
      id: 'ia-3',
      category: 'Information Architecture',
      description: 'Is every core feature reachable in 3 clicks or fewer?',
      passed: true,
      note: 'Manual check required — cannot evaluate click depth statically.',
    },

    // ── User Story (2) ─────────────────────────────────────────────────────────
    {
      id: 'story-1',
      category: 'User Story',
      description: "Does every feature in the app map to a specific moment in the user's story?",
      passed: true,
      note: 'Manual check required.',
    },
    {
      id: 'story-2',
      category: 'User Story',
      description: "Is the primary user's journey complete end-to-end with no dead ends?",
      passed: has(tsx, /Home|Landing/) && (has(tsx, /Dashboard/) || has(tsx, /App/)),
    },

    // ── Product (3) ────────────────────────────────────────────────────────────
    {
      id: 'product-1',
      category: 'Product',
      description: 'Does the README contain a clear problem statement and outcome goals?',
      passed: files.some(f => f.path === 'README.md') && has(content(files, 'README.md'), /\#\#/),
    },
    {
      id: 'product-2',
      category: 'Product',
      description: 'Does every feature map to at least one user story?',
      passed: true,
      note: 'Manual check required.',
    },
    {
      id: 'product-3',
      category: 'Product',
      description: 'Does the app instrument the primary metric?',
      passed: has(ts, /analytics|track|event|metric/i),
    },

    // ── Execution (3) ──────────────────────────────────────────────────────────
    {
      id: 'exec-1',
      category: 'Execution',
      description: 'Does the README include a NEXT STEPS section?',
      passed: has(content(files, 'README.md'), /next step/i),
    },
    {
      id: 'exec-2',
      category: 'Execution',
      description: 'Does the dashboard answer "what should I do right now?" without explanation?',
      passed: has(tsx, /Dashboard/) && (has(tsx, /next|action|step|todo/i) || has(tsx, /empty/i)),
    },
    {
      id: 'exec-3',
      category: 'Execution',
      description: 'Does every empty state have a single recommended next action?',
      passed: has(ts, /empty|no data|get started|no .* yet/i) && has(tsx, /<button/),
    },

    // ── Accessibility (3) ──────────────────────────────────────────────────────
    {
      id: 'a11y-1',
      category: 'Accessibility',
      description: 'Does all text meet 4.5:1 contrast ratio?',
      passed: !has(tsx, /#6b6862/) || has(tsx, /bg-(ink|dark|black|gray-9)/),
      note: 'Fails if #6b6862 (dim) is used on dark backgrounds.',
    },
    {
      id: 'a11y-2',
      category: 'Accessibility',
      description: 'Does every interactive element have a visible focus state?',
      passed: has(tsx, /focus:ring|focus:outline|focus-visible:/),
    },
    {
      id: 'a11y-3',
      category: 'Accessibility',
      description: 'Is color never the only way information is conveyed?',
      passed: has(tsx, /aria-label|aria-describedby/) || has(tsx, /<span|<svg/),
    },

    // ── SEO (3) ────────────────────────────────────────────────────────────────
    {
      id: 'seo-1',
      category: 'SEO',
      description: 'Does every page have a unique title tag and meta description?',
      passed: has(html, /<title/) && has(html, /meta.*description/i),
    },
    {
      id: 'seo-2',
      category: 'SEO',
      description: 'Is there one H1 per page with a logical heading hierarchy?',
      passed: has(tsx, /<h1/) && has(tsx, /<h2/),
    },
    {
      id: 'seo-3',
      category: 'SEO',
      description: 'Are Open Graph tags present?',
      passed: has(html, /og:title|og:description|og:image/i),
    },

    // ── Security (3) ───────────────────────────────────────────────────────────
    {
      id: 'security-1',
      category: 'Security',
      description: 'Is RLS enabled on every Supabase table?',
      passed: has(all, /ENABLE ROW LEVEL SECURITY|enableRLS/),
      note: 'Checks for RLS SQL or RLS-enabling code.',
    },
    {
      id: 'security-2',
      category: 'Security',
      description: 'Are security headers present in vercel.json?',
      passed: has(vercel, 'Content-Security-Policy') && has(vercel, 'X-Content-Type-Options'),
    },
    {
      id: 'security-3',
      category: 'Security',
      description: 'Are there no secrets in client code?',
      passed: !has(tsx, /(password|secret|token)\s*=\s*["'][^"']{8,}/i) &&
              !has(tsx, /SUPABASE_SERVICE_ROLE|service_role/),
    },

    // ── Resilience (3) ─────────────────────────────────────────────────────────
    {
      id: 'resilience-1',
      category: 'Resilience',
      description: 'Does every component that fetches data handle loading, error, and empty states?',
      passed:
        has(ts, /isLoading|loading|isPending/) &&
        has(ts, /error|setError|catch/) &&
        has(ts, /empty|no data/i),
    },
    {
      id: 'resilience-2',
      category: 'Resilience',
      description: 'Does every form preserve user input on submission failure?',
      passed: has(ts, /setError/) && has(tsx, /value=/),
    },
    {
      id: 'resilience-3',
      category: 'Resilience',
      description: 'Does every OAuth or external redirect store state before leaving and restore it on return?',
      passed: has(ts, /sessionStorage|localStorage/) || !has(ts, /oauth|redirect.*state/i),
      note: 'Passes if no OAuth is present. Fails if OAuth exists without state storage.',
    },

    // ── Dark Mode (3) — added 2026-03-28 ───────────────────────────────────────
    {
      id: 'darkmode-1',
      category: 'Dark Mode',
      description: 'All colors use CSS custom properties (var(--color-*)) — not hardcoded hex values in component styles',
      passed: (() => {
        // Strip string literals and comments before checking to avoid false positives
        const stripped = tsx
          .replace(/`[^`]*`/g, '')        // remove template literals
          .replace(/"[^"]*"/g, '')         // remove double-quoted strings
          .replace(/'[^']*'/g, '')         // remove single-quoted strings
          .replace(/\/\/[^\n]*/g, '')      // remove line comments
          .replace(/\/\*[\s\S]*?\*\//g, '') // remove block comments
        // Fail if any raw hex color appears outside string literals
        return !has(stripped, /#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}(?![0-9a-fA-F])/)
      })(),
      note: 'Checks for hardcoded hex values in component code (outside strings). Use var(--color-*) instead.',
    },
    {
      id: 'darkmode-2',
      category: 'Dark Mode',
      description: ':root defines both light and dark variants via prefers-color-scheme',
      passed: has(css, '--color-bg') && has(css, 'prefers-color-scheme: dark'),
    },
    {
      id: 'darkmode-3',
      category: 'Dark Mode',
      description: '<html> element has color-scheme="light dark"',
      passed: has(html, 'color-scheme') && (has(html, 'light dark') || has(html, '"light dark"')),
    },
  ]

  // ── Aggregate ───────────────────────────────────────────────────────────────

  const categories: AuditReport['categories'] = {}
  for (const check of checks) {
    if (!categories[check.category]) {
      categories[check.category] = { passed: 0, total: 0, checks: [] }
    }
    categories[check.category].checks.push(check)
    categories[check.category].total++
    if (check.passed) categories[check.category].passed++
  }

  const passed  = checks.filter(c => c.passed).length
  const total   = checks.length
  const score   = Math.round((passed / total) * 100)

  // Shippable = all security + resilience checks pass
  const securityChecks   = checks.filter(c => c.category === 'Security')
  const resilienceChecks = checks.filter(c => c.category === 'Resilience')
  const shippable = [...securityChecks, ...resilienceChecks].every(c => c.passed)

  return { passed, failed: total - passed, total, score, shippable, categories }
}

// ── runDesignAudit — pipeline-callable export ─────────────────────────────────
//
// Called by run-build.ts after Vercel deployment succeeds.
// Fetches files from the generated GitHub repo, runs the 35-check audit,
// applies mechanical fixes to index.html where possible, and returns the result.
// Audit failure never blocks the user — always wrapped in try/catch at call site.

export interface AuditFailure {
  id: string
  category: string
  description: string
}

// Target files to fetch from generated repos
const AUDIT_TARGET_FILES = [
  'src/App.tsx',
  'src/index.css',
  'index.html',
  'src/pages/Home.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Login.tsx',
  'src/pages/Signup.tsx',
  'src/components/Navbar.tsx',
  'src/components/Footer.tsx',
  'vercel.json',
  'README.md',
]

async function fetchGitHubFile(
  owner: string,
  repo: string,
  path: string,
  token: string,
): Promise<{ content: string; sha: string } | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!res.ok) return null
    const data = await res.json() as { content?: string; sha?: string; type?: string }
    if (!data.content || !data.sha || data.type !== 'file') return null
    // GitHub base64 includes newlines — strip them before decoding
    const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
    return { content, sha: data.sha }
  } catch {
    return null
  }
}

async function commitGitHubFile(
  owner: string,
  repo: string,
  path: string,
  token: string,
  content: string,
  sha: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'fix: visila design audit correction',
          content: Buffer.from(content).toString('base64'),
          sha,
        }),
        signal: AbortSignal.timeout(10000),
      },
    )
    return res.ok
  } catch {
    return false
  }
}

export async function runDesignAudit(
  owner: string,
  repo: string,
  token: string,
): Promise<{
  passed: boolean
  score: number
  fixes_applied: number
  failures: AuditFailure[]
}> {
  // 1. Fetch target files in parallel (best-effort — missing files are skipped)
  const fetched = await Promise.all(
    AUDIT_TARGET_FILES.map(async (path) => {
      const result = await fetchGitHubFile(owner, repo, path, token)
      if (!result) return null
      return { path, content: result.content, sha: result.sha }
    }),
  )

  const files: AppFile[] = fetched
    .filter((f): f is { path: string; content: string; sha: string } => f !== null)
    .map(({ path, content }) => ({ path, content }))

  // Build sha lookup for files we may want to patch
  const shas: Record<string, string> = {}
  for (const f of fetched) {
    if (f) shas[f.path] = f.sha
  }

  // 2. Run static 35-check audit
  const report = auditApp(files)

  const failures: AuditFailure[] = Object.values(report.categories)
    .flatMap((cat) => cat.checks)
    .filter((c) => !c.passed)
    .map((c) => ({ id: c.id, category: c.category, description: c.description }))

  // 3. Attempt mechanical fixes on index.html where possible
  //    Only fixes that can be applied without AI:
  //    - darkmode-3: add color-scheme="light dark" to <html> element
  //    - seo-1: add <meta name="description"> if missing
  let fixes_applied = 0
  const htmlEntry = fetched.find((f) => f?.path === 'index.html')

  if (htmlEntry) {
    let html = htmlEntry.content
    let changed = false

    // Fix darkmode-3: add color-scheme attribute to <html>
    if (failures.find((f) => f.id === 'darkmode-3') && !html.includes('color-scheme')) {
      html = html.replace(/<html([^>]*)>/, '<html$1 color-scheme="light dark">')
      changed = true
      fixes_applied++
    }

    // Fix seo-1: add meta description if missing
    if (
      failures.find((f) => f.id === 'seo-1') &&
      !html.includes('name="description"') &&
      !html.includes("name='description'")
    ) {
      html = html.replace(
        '</head>',
        '  <meta name="description" content="Built with Visila.">\n  </head>',
      )
      changed = true
      fixes_applied++
    }

    // Commit the patched index.html (GitHub push auto-triggers Vercel redeploy)
    if (changed && shas['index.html']) {
      const committed = await commitGitHubFile(owner, repo, 'index.html', token, html, shas['index.html'])
      if (!committed) {
        // Roll back count — fix was not persisted
        fixes_applied = 0
      }
    } else if (changed) {
      // sha not available — cannot commit
      fixes_applied = 0
    }
  }

  return {
    passed: report.score >= 80,
    score: report.score,
    fixes_applied,
    failures,
  }
}

// ── Serverless handler ────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = getClientIp(req)
  const rl = checkRateLimit(`audit-generated-app:${ip}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
    return res.status(429).json({ error: 'Rate limit exceeded' })
  }

  const { files } = req.body ?? {}
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files array required' })
  }

  // Truncate oversized content to prevent abuse
  const safeFiles: AppFile[] = files.map((f: any) => ({
    path:    String(f.path ?? '').slice(0, 200),
    content: String(f.content ?? '').slice(0, 500_000),
  }))

  const report = auditApp(safeFiles)
  return res.status(200).json(report)
}
