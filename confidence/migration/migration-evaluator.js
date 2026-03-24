// confidence/migration/migration-evaluator.js
// Evaluates the effort required to migrate a project to Sovereign standards.
//
// Input:  projectPath — absolute path to any project directory
// Output: MigrationReport (see schema below)

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { estimateEffort } from './effort-estimator.js'
import { process as runEvaluator } from '../engine/aggregator.js'

const TARGET_SCORE = 85

// ─── MIGRATION PLAN STEP TEMPLATES ───────────────────────────────────────────

const MIGRATION_STEPS = {
  add_rls: {
    step: 'Enable Row Level Security on all Supabase tables',
    dimension: 'security',
    effort: '30 min per table',
    impact: 20,
  },
  add_rate_limiting: {
    step: 'Add checkRateLimit to all API route handlers',
    dimension: 'security',
    effort: '15 min per route',
    impact: 10,
  },
  add_csp: {
    step: 'Add Content-Security-Policy headers with connect-src to vercel.json',
    dimension: 'security',
    effort: '30 min',
    impact: 8,
  },
  add_env_example: {
    step: 'Create .env.example listing all required environment variables',
    dimension: 'documentation',
    effort: '15 min',
    impact: 4,
  },
  add_readme: {
    step: 'Write README.md with setup instructions, stack description, and local dev guide',
    dimension: 'documentation',
    effort: '45 min',
    impact: 5,
  },
  add_claude_md: {
    step: 'Create CLAUDE.md so AI-assisted development sessions have project context',
    dimension: 'documentation',
    effort: '30 min',
    impact: 3,
  },
  add_tests: {
    step: 'Write unit tests for core components and utility functions',
    dimension: 'test_coverage',
    effort: '1 hour per component',
    impact: 8,
  },
  fix_typescript: {
    step: 'Fix TypeScript errors — add missing types, remove @ts-ignore suppressions',
    dimension: 'code_quality',
    effort: '10 min per error',
    impact: 7,
  },
  fix_accessibility: {
    step: 'Fix accessibility issues — contrast ratios, ARIA labels, semantic HTML',
    dimension: 'accessibility',
    effort: '20 min per issue',
    impact: 8,
  },
  add_migrations: {
    step: 'Create supabase/migrations/ directory with schema SQL files',
    dimension: 'architecture',
    effort: '1 hour',
    impact: 6,
  },
  add_vite_env: {
    step: 'Add src/vite-env.d.ts with Vite client type reference',
    dimension: 'code_quality',
    effort: '5 min',
    impact: 3,
  },
  add_error_boundary: {
    step: 'Wrap root component with React Error Boundary',
    dimension: 'ux',
    effort: '30 min',
    impact: 5,
  },
  fix_csp_connect_src: {
    step: 'Add connect-src to CSP — missing connect-src blocks all Supabase API calls',
    dimension: 'security',
    effort: '15 min',
    impact: 15,
  },
  add_gitignore: {
    step: 'Create .gitignore with node_modules, dist, .env entries',
    dimension: 'architecture',
    effort: '5 min',
    impact: 4,
  },
  remove_secrets: {
    step: 'Move service role keys and API secrets from client-side code to API routes',
    dimension: 'security',
    effort: '30 min per secret',
    impact: 25,
  },
  add_input_validation: {
    step: 'Add input validation (type checks, length limits) to all public API endpoints',
    dimension: 'security',
    effort: '20 min per endpoint',
    impact: 8,
  },
  add_soft_deletes: {
    step: 'Add deleted_at column to user-data tables and update queries to filter deleted rows',
    dimension: 'architecture',
    effort: '30 min per table',
    impact: 4,
  },
  add_loading_states: {
    step: 'Add loading spinner or skeleton to every async data-fetch in the UI',
    dimension: 'ux',
    effort: '20 min per component',
    impact: 5,
  },
  add_empty_states: {
    step: 'Add empty state UI (illustration + copy + primary CTA) for every list view',
    dimension: 'ux',
    effort: '20 min per view',
    impact: 4,
  },
  add_meta_tags: {
    step: 'Add title, meta description, and OpenGraph tags to index.html or page head',
    dimension: 'seo',
    effort: '20 min',
    impact: 5,
  },
}

// ─── QUICK WIN DEFINITIONS ────────────────────────────────────────────────────

const QUICK_WIN_CHECKLIST = [
  {
    key: 'missing_env_example',
    check: (p) => !existsSync(join(p, '.env.example')),
    action: 'Create .env.example with required environment variable keys (no values)',
    effort: '15 min',
    score_impact: 4,
  },
  {
    key: 'missing_vite_env',
    check: (p) => existsSync(join(p, 'src')) && !existsSync(join(p, 'src', 'vite-env.d.ts')),
    action: 'Add src/vite-env.d.ts with "/// <reference types="vite/client" />"',
    effort: '5 min',
    score_impact: 3,
  },
  {
    key: 'missing_gitignore',
    check: (p) => !existsSync(join(p, '.gitignore')),
    action: 'Create .gitignore with node_modules/, dist/, .env entries',
    effort: '5 min',
    score_impact: 4,
  },
  {
    key: 'missing_readme',
    check: (p) => !existsSync(join(p, 'README.md')),
    action: 'Write README.md — setup instructions, tech stack, local dev commands',
    effort: '30 min',
    score_impact: 5,
  },
  {
    key: 'missing_claude_md',
    check: (p) => !existsSync(join(p, 'CLAUDE.md')),
    action: 'Create CLAUDE.md with stack summary and key architecture decisions',
    effort: '30 min',
    score_impact: 3,
  },
  {
    key: 'missing_csp_connect_src',
    check: (p) => {
      const vj = join(p, 'vercel.json')
      if (!existsSync(vj)) return false
      const content = readFileSync(vj, 'utf-8')
      return !content.includes('connect-src')
    },
    action: 'Add connect-src to CSP in vercel.json — this blocks all Supabase calls without it',
    effort: '15 min',
    score_impact: 10,
  },
  {
    key: 'missing_vercel_json',
    check: (p) => !existsSync(join(p, 'vercel.json')),
    action: 'Create vercel.json with SPA rewrite rule and security headers',
    effort: '20 min',
    score_impact: 8,
  },
  {
    key: 'missing_migrations_dir',
    check: (p) =>
      !existsSync(join(p, 'supabase', 'migrations')) &&
      !existsSync(join(p, 'api', 'migrations')),
    action: 'Create supabase/migrations/ directory and move schema SQL into versioned files',
    effort: '45 min',
    score_impact: 6,
  },
]

// ─── CORE SCAN ───────────────────────────────────────────────────────────────

function scanProjectBasics(projectPath) {
  const issues = []

  // Check for common missing items
  if (!existsSync(join(projectPath, '.env.example'))) {
    issues.push({ type: 'missing_env_example', severity: 'medium', dimension: 'documentation', message: 'Missing .env.example' })
  }
  if (!existsSync(join(projectPath, 'README.md'))) {
    issues.push({ type: 'documentation', severity: 'low', dimension: 'documentation', message: 'Missing README.md' })
  }
  if (!existsSync(join(projectPath, 'CLAUDE.md'))) {
    issues.push({ type: 'documentation', severity: 'low', dimension: 'documentation', message: 'Missing CLAUDE.md' })
  }
  if (!existsSync(join(projectPath, '.gitignore'))) {
    issues.push({ type: 'add_gitignore', severity: 'medium', dimension: 'architecture', message: 'Missing .gitignore' })
  }
  if (!existsSync(join(projectPath, 'vercel.json'))) {
    issues.push({ type: 'missing_vercel_json', severity: 'high', dimension: 'security', message: 'Missing vercel.json — no security headers configured' })
  }

  // CSP connect-src check
  const vercelJsonPath = join(projectPath, 'vercel.json')
  if (existsSync(vercelJsonPath)) {
    const content = readFileSync(vercelJsonPath, 'utf-8')
    if (!content.includes('connect-src')) {
      issues.push({ type: 'missing_rls', severity: 'high', dimension: 'security', message: 'CSP missing connect-src — all Supabase calls blocked in production' })
    }
  }

  // RLS check
  const migrationDirs = [
    join(projectPath, 'supabase', 'migrations'),
    join(projectPath, 'api', 'migrations'),
  ]
  let hasRLS = false
  for (const dir of migrationDirs) {
    if (!existsSync(dir)) continue
    const sqlFiles = getAllFiles(dir, '.sql')
    for (const f of sqlFiles) {
      if (readFileSync(f, 'utf-8').includes('ENABLE ROW LEVEL SECURITY')) {
        hasRLS = true
        break
      }
    }
  }
  if (!hasRLS) {
    issues.push({ type: 'missing_rls', severity: 'critical', dimension: 'security', message: 'No RLS found in migrations — CVE-class vulnerability' })
  }

  // vite-env.d.ts check
  const srcDir = join(projectPath, 'src')
  if (existsSync(srcDir) && !existsSync(join(srcDir, 'vite-env.d.ts'))) {
    issues.push({ type: 'typescript_fix', severity: 'medium', dimension: 'code_quality', message: 'Missing src/vite-env.d.ts — tsc will fail on import.meta.env' })
  }

  // Rate limiting check
  const apiDir = join(projectPath, 'api')
  if (existsSync(apiDir)) {
    const apiFiles = getAllFiles(apiDir, '.ts').concat(getAllFiles(apiDir, '.js'))
      .filter(f => !f.includes('_rateLimit') && !f.includes('migrations'))
    let missingRL = 0
    for (const f of apiFiles) {
      const content = readFileSync(f, 'utf-8')
      if (content.includes('export default') && !content.includes('checkRateLimit')) {
        missingRL++
      }
    }
    if (missingRL > 0) {
      issues.push({
        type: 'missing_rate_limit',
        severity: 'high',
        dimension: 'security',
        message: `${missingRL} API route(s) missing rate limiting`,
      })
    }
  }

  // Secret exposure check
  if (existsSync(srcDir)) {
    const srcFiles = getAllFiles(srcDir, '.ts').concat(getAllFiles(srcDir, '.tsx'))
    const secretPatterns = [/service_role/i, /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/, /sk-[a-zA-Z0-9]{20,}/]
    for (const f of srcFiles) {
      const content = readFileSync(f, 'utf-8')
      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          issues.push({
            type: 'secret_exposure',
            severity: 'critical',
            dimension: 'security',
            message: `Possible secret in client-side file: ${f.replace(projectPath, '')}`,
          })
          break
        }
      }
    }
  }

  // Test coverage check
  const testDirs = [join(projectPath, '__tests__'), join(projectPath, 'tests'), join(projectPath, 'src', '__tests__')]
  const hasTests = testDirs.some(d => existsSync(d)) ||
    getAllFiles(join(projectPath, 'src'), '.test.ts').length > 0 ||
    getAllFiles(join(projectPath, 'src'), '.spec.ts').length > 0
  if (!hasTests) {
    issues.push({ type: 'missing_test', severity: 'medium', dimension: 'test_coverage', message: 'No test files found' })
  }

  return issues
}

function buildMigrationPlan(issues, currentScore) {
  const gap = TARGET_SCORE - currentScore
  if (gap <= 0) return []

  const plan = []
  const seenSteps = new Set()

  // Priority order: critical security first, then high, then medium
  const sorted = [...issues].sort((a, b) => {
    const priority = { critical: 0, high: 1, medium: 2, low: 3 }
    return (priority[a.severity] || 3) - (priority[b.severity] || 3)
  })

  for (const issue of sorted) {
    const type = issue.type
    const stepDef = MIGRATION_STEPS[type]
    if (!stepDef || seenSteps.has(type)) continue
    seenSteps.add(type)
    plan.push({ ...stepDef })
  }

  // If still below target, add general improvement steps
  if (plan.length < 5) {
    const fallbackSteps = [
      'add_tests', 'fix_accessibility', 'add_loading_states', 'add_empty_states', 'add_meta_tags',
    ]
    for (const key of fallbackSteps) {
      if (!seenSteps.has(key) && MIGRATION_STEPS[key]) {
        seenSteps.add(key)
        plan.push({ ...MIGRATION_STEPS[key] })
      }
    }
  }

  return plan
}

function getQuickWins(projectPath) {
  const wins = []
  for (const item of QUICK_WIN_CHECKLIST) {
    try {
      if (item.check(projectPath)) {
        wins.push({
          action: item.action,
          effort: item.effort,
          score_impact: item.score_impact,
        })
      }
    } catch {
      // Ignore fs errors in quick win checks
    }
  }
  return wins
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * Evaluates migration effort for a project directory.
 *
 * @param {string} projectPath — absolute path to the project root
 * @returns {Promise<MigrationReport>}
 */
export async function evaluate(projectPath) {
  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`)
  }

  // Run the full confidence engine to get current score
  let currentScore = 0
  let confidenceReport = null
  try {
    confidenceReport = await runEvaluator(projectPath)
    currentScore = confidenceReport.overall_score || 0
  } catch {
    // Fall back to a quick scan if the full evaluator fails
    currentScore = quickScoreEstimate(projectPath)
  }

  const gap = Math.max(0, TARGET_SCORE - currentScore)
  const issues = scanProjectBasics(projectPath)

  // Merge issues from confidence report if available
  const allIssues = confidenceReport
    ? [...issues, ...(confidenceReport.all_issues || []).map(i => ({
        ...i,
        dimension: i.dimension || 'general',
      }))]
    : issues

  // Deduplicate by message
  const seen = new Set()
  const uniqueIssues = allIssues.filter(i => {
    const key = i.message
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const effortResult = estimateEffort(uniqueIssues)
  const migrationPlan = buildMigrationPlan(uniqueIssues, currentScore)
  const quickWins = getQuickWins(projectPath)

  return {
    current_score: currentScore,
    target_score: TARGET_SCORE,
    gap,
    effort_estimate: {
      hours: effortResult.total_hours,
      days: effortResult.total_days,
    },
    migration_plan: migrationPlan,
    quick_wins: quickWins,
    issues: uniqueIssues,
    effort_by_dimension: effortResult.by_dimension,
    effort_by_severity: effortResult.by_severity,
    evaluated_at: new Date().toISOString(),
    already_at_target: gap === 0,
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function quickScoreEstimate(projectPath) {
  const checks = [
    existsSync(join(projectPath, 'README.md')),
    existsSync(join(projectPath, '.env.example')),
    existsSync(join(projectPath, 'vercel.json')),
    existsSync(join(projectPath, 'src', 'vite-env.d.ts')),
    existsSync(join(projectPath, 'supabase', 'migrations')),
    existsSync(join(projectPath, '.gitignore')),
    existsSync(join(projectPath, 'CLAUDE.md')),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function getAllFiles(dir, ext) {
  if (!existsSync(dir)) return []
  const files = []
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        files.push(...getAllFiles(fullPath, ext))
      } else if (entry.endsWith(ext)) {
        files.push(fullPath)
      }
    }
  } catch {
    // Ignore unreadable directories
  }
  return files
}
