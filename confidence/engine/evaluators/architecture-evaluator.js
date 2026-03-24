// confidence/engine/evaluators/architecture-evaluator.js
// Evaluates architectural structure and organisation in a project directory

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

export function evaluate(projectPath) {
  const issues = []
  let score = 100

  const checks = [
    checkComponentsDirectory(projectPath, issues),
    checkPagesDirectory(projectPath, issues),
    checkLibDirectory(projectPath, issues),
    checkApiDirectory(projectPath, issues),
    checkSupabaseClientInComponents(projectPath, issues),
    checkNoHardcodedEnvVars(projectPath, issues),
  ]

  const totalPenalty = checks.reduce((sum, c) => sum + c.penalty, 0)
  score = Math.max(0, 100 - totalPenalty)

  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const passed = criticalIssues.length === 0 && score >= 70

  return {
    dimension: 'architecture',
    score,
    issues,
    passed,
    summary: passed
      ? `Architecture checks passed (${score}/100)`
      : `Architecture issues found: ${criticalIssues.length} critical, ${issues.length - criticalIssues.length} other`,
  }
}

function checkComponentsDirectory(projectPath, issues) {
  const componentsDir = join(projectPath, 'src', 'components')
  if (!existsSync(componentsDir)) {
    issues.push({
      severity: 'medium',
      message: 'src/components/ directory missing — reusable components have no designated home',
      fix: 'Create src/components/ and move shared components there (Navbar, Footer, Button, etc.)',
    })
    return { penalty: 10 }
  }
  return { penalty: 0 }
}

function checkPagesDirectory(projectPath, issues) {
  const pagesDir = join(projectPath, 'src', 'pages')
  if (!existsSync(pagesDir)) {
    issues.push({
      severity: 'medium',
      message: 'src/pages/ directory missing — page-level components have no designated home',
      fix: 'Create src/pages/ and move route-level components there (Home.tsx, Dashboard.tsx, etc.)',
    })
    return { penalty: 10 }
  }
  return { penalty: 0 }
}

function checkLibDirectory(projectPath, issues) {
  const libDir = join(projectPath, 'src', 'lib')
  const utilsDir = join(projectPath, 'src', 'utils')

  if (!existsSync(libDir) && !existsSync(utilsDir)) {
    issues.push({
      severity: 'low',
      message: 'Neither src/lib/ nor src/utils/ exists — utility functions and client libraries have no home',
      fix: 'Create src/lib/ for client libraries (supabase.ts, api.ts) and shared utilities',
    })
    return { penalty: 5 }
  }
  return { penalty: 0 }
}

function checkApiDirectory(projectPath, issues) {
  const apiDir = join(projectPath, 'api')
  if (!existsSync(apiDir)) {
    issues.push({
      severity: 'low',
      message: 'No api/ directory found — serverless functions not present',
      fix: 'Create api/ directory for Vercel serverless functions. Sovereign apps use api/ for backend logic.',
    })
  }
  // Info only — no penalty (not every app needs API routes)
  return { penalty: 0 }
}

function checkSupabaseClientInComponents(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const componentsDir = join(srcDir, 'components')
  const pagesDir = join(srcDir, 'pages')

  const checkDirs = [componentsDir, pagesDir].filter(existsSync)
  let penalty = 0

  for (const dir of checkDirs) {
    const files = getAllFiles(dir, '.tsx').concat(getAllFiles(dir, '.ts'))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      // createClient called directly in a component/page instead of importing from lib/supabase
      if (/\bcreateClient\s*\(/.test(content)) {
        issues.push({
          severity: 'high',
          message: `Direct createClient() call in ${file.replace(projectPath, '')} — Supabase client should be a singleton in src/lib/supabase.ts`,
          file: file.replace(projectPath, ''),
          fix: "Remove createClient() from components. Import supabase from '../lib/supabase' instead.",
        })
        penalty += 10
      }
    }
  }

  return { penalty: Math.min(penalty, 20) }
}

function checkNoHardcodedEnvVars(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const files = getAllFiles(srcDir, '.ts').concat(getAllFiles(srcDir, '.tsx'))
  let penalty = 0

  // Pattern: hardcoded Supabase URLs (e.g., https://abc123.supabase.co)
  const hardcodedUrlPattern = /https?:\/\/[a-z0-9]{20,}\.supabase\.co/i

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    // Skip the supabase.ts lib file itself — it's expected to have the URL via env var
    if (file.endsWith('supabase.ts') && file.includes('lib')) continue

    if (hardcodedUrlPattern.test(content)) {
      issues.push({
        severity: 'critical',
        message: `Hardcoded Supabase URL found in ${file.replace(projectPath, '')} — secrets must not be in source code`,
        file: file.replace(projectPath, ''),
        fix: 'Use import.meta.env.VITE_SUPABASE_URL instead of hardcoding the URL',
      })
      penalty += 20
    }
  }

  return { penalty: Math.min(penalty, 40) }
}

function getAllFiles(dir, ext) {
  if (!existsSync(dir)) return []
  const files = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
      files.push(...getAllFiles(fullPath, ext))
    } else if (entry.endsWith(ext)) {
      files.push(fullPath)
    }
  }
  return files
}
