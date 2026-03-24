// confidence/engine/evaluators/security-evaluator.js
// Evaluates security practices in a project directory

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

export function evaluate(projectPath) {
  const issues = []
  let score = 100

  const checks = [
    checkRateLimiting(projectPath, issues),
    checkRLSPresence(projectPath, issues),
    checkNoSecretsInCode(projectPath, issues),
    checkCSPHeaders(projectPath, issues),
    checkInputValidation(projectPath, issues),
    checkNoEval(projectPath, issues),
    checkHTTPS(projectPath, issues),
    checkAuthChecks(projectPath, issues),
  ]

  const totalPenalty = checks.reduce((sum, c) => sum + c.penalty, 0)
  score = Math.max(0, 100 - totalPenalty)

  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const passed = criticalIssues.length === 0 && score >= 85

  return {
    dimension: 'security',
    score,
    issues,
    passed,
    summary: passed
      ? `Security checks passed (${score}/100)`
      : `Security issues found: ${criticalIssues.length} critical, ${issues.length - criticalIssues.length} other`,
  }
}

function checkRateLimiting(projectPath, issues) {
  const apiDir = join(projectPath, 'api')
  if (!existsSync(apiDir)) return { penalty: 0 }

  const apiFiles = getAllFiles(apiDir, '.ts').concat(getAllFiles(apiDir, '.js'))
    .filter(f => {
      const name = f.split('/').pop() || ''
      // Skip: utility files (prefixed _), migrations, auth callbacks, cron-only endpoints
      if (name.startsWith('_')) return false
      if (f.includes('migrations')) return false
      if (f.includes('/auth/')) return false
      // expire-builds is a cron endpoint protected by CRON_SECRET, not rate limit
      if (name.includes('expire') || name.includes('cron')) return false
      return true
    })

  let penalty = 0
  for (const file of apiFiles) {
    const content = readFileSync(file, 'utf-8')
    if (!content.includes('checkRateLimit') && content.includes('export default')) {
      issues.push({
        severity: 'high',
        message: `API route missing rate limiting: ${file.replace(projectPath, '')}`,
        file: file.replace(projectPath, ''),
        fix: "Add checkRateLimit from './_rateLimit.js' as first check in handler",
      })
      penalty += 5
    }
  }

  return { penalty: Math.min(penalty, 25) }
}

function checkRLSPresence(projectPath, issues) {
  const migrationDirs = [
    join(projectPath, 'supabase', 'migrations'),
    join(projectPath, 'api', 'migrations'),
  ]

  let hasRLS = false
  for (const dir of migrationDirs) {
    if (!existsSync(dir)) continue
    const sqlFiles = getAllFiles(dir, '.sql')
    for (const file of sqlFiles) {
      const content = readFileSync(file, 'utf-8')
      if (content.includes('ENABLE ROW LEVEL SECURITY')) {
        hasRLS = true
        break
      }
    }
  }

  if (!hasRLS) {
    issues.push({
      severity: 'critical',
      message: 'No RLS (Row Level Security) found in migrations. This is a CVE-class vulnerability.',
      file: 'supabase/migrations/',
      fix: 'Add ALTER TABLE t ENABLE ROW LEVEL SECURITY with explicit policies to every user-data table',
    })
    return { penalty: 30 }
  }

  return { penalty: 0 }
}

function checkNoSecretsInCode(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const srcFiles = getAllFiles(srcDir, '.ts').concat(getAllFiles(srcDir, '.tsx'))
  let penalty = 0

  const secretPatterns = [
    /service_role/i,
    /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+/,
    /sk-[a-zA-Z0-9]{20,}/,
    /SUPABASE_SERVICE_ROLE/,
  ]

  for (const file of srcFiles) {
    const content = readFileSync(file, 'utf-8')
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        issues.push({
          severity: 'critical',
          message: `Potential secret found in client-side file: ${file.replace(projectPath, '')}`,
          file: file.replace(projectPath, ''),
          fix: 'Move secrets to server-side API routes only',
        })
        penalty += 20
        break
      }
    }
  }

  return { penalty: Math.min(penalty, 40) }
}

function checkCSPHeaders(projectPath, issues) {
  const vercelJson = join(projectPath, 'vercel.json')
  if (!existsSync(vercelJson)) {
    issues.push({
      severity: 'medium',
      message: 'No vercel.json found — CSP headers not configured',
      file: 'vercel.json',
      fix: "Add Content-Security-Policy header with connect-src 'self' https://*.supabase.co",
    })
    return { penalty: 10 }
  }

  const content = readFileSync(vercelJson, 'utf-8')
  if (!content.includes('connect-src')) {
    issues.push({
      severity: 'high',
      message: 'CSP missing connect-src — all Supabase calls will be blocked in production',
      file: 'vercel.json',
      fix: "Add connect-src 'self' https://*.supabase.co wss://*.supabase.co to CSP header",
    })
    return { penalty: 15 }
  }

  return { penalty: 0 }
}

function checkInputValidation(projectPath, issues) {
  const apiDir = join(projectPath, 'api')
  if (!existsSync(apiDir)) return { penalty: 0 }

  const apiFiles = getAllFiles(apiDir, '.ts')
    .filter(f => !f.includes('_') && !f.includes('migrations'))

  let missingValidation = 0
  for (const file of apiFiles) {
    const content = readFileSync(file, 'utf-8')
    if (content.includes('req.body') && !content.includes('typeof') && !content.includes('!')) {
      missingValidation++
    }
  }

  if (missingValidation > 2) {
    issues.push({
      severity: 'medium',
      message: `${missingValidation} API routes may be missing input validation`,
      file: 'api/',
      fix: 'Validate req.body fields: type, length, required fields before using them',
    })
    return { penalty: 10 }
  }

  return { penalty: 0 }
}

function checkNoEval(projectPath, issues) {
  const allDirs = [join(projectPath, 'src'), join(projectPath, 'api')]
  let penalty = 0

  for (const dir of allDirs) {
    if (!existsSync(dir)) continue
    const files = getAllFiles(dir, '.ts').concat(getAllFiles(dir, '.tsx'))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      // Strip template literal strings to avoid false positives from string content
      const codeOnly = content.replace(/`[^`]*`/gs, '""')
      if (/\beval\s*\(/.test(codeOnly) || (codeOnly.includes('dangerouslySetInnerHTML') && !codeOnly.includes('// safe'))) {
        issues.push({
          severity: 'high',
          message: `Dangerous code pattern found: ${file.replace(projectPath, '')}`,
          file: file.replace(projectPath, ''),
          fix: 'Remove eval() and dangerouslySetInnerHTML. Use safe alternatives.',
        })
        penalty += 15
      }
    }
  }

  return { penalty: Math.min(penalty, 30) }
}

function checkHTTPS(projectPath, issues) {
  const vercelJson = join(projectPath, 'vercel.json')
  if (!existsSync(vercelJson)) return { penalty: 0 }

  const content = readFileSync(vercelJson, 'utf-8')
  if (content.includes('"http://"') || content.includes("'http://'")) {
    issues.push({
      severity: 'medium',
      message: 'HTTP (not HTTPS) URL found in vercel.json',
      file: 'vercel.json',
      fix: 'Use HTTPS for all external URLs',
    })
    return { penalty: 5 }
  }

  return { penalty: 0 }
}

function checkAuthChecks(projectPath, issues) {
  const apiDir = join(projectPath, 'api')
  if (!existsSync(apiDir)) return { penalty: 0 }

  // Look for protected routes without auth checks
  const protectedRoutes = ['dashboard', 'run-build', 'edit']
  let missingAuth = 0

  for (const route of protectedRoutes) {
    const routeFile = join(apiDir, `${route}.ts`)
    if (!existsSync(routeFile)) continue
    const content = readFileSync(routeFile, 'utf-8')
    if (!content.includes('auth') && !content.includes('token') && !content.includes('session')) {
      missingAuth++
    }
  }

  if (missingAuth > 0) {
    issues.push({
      severity: 'high',
      message: `${missingAuth} protected API routes may lack authentication checks`,
      file: 'api/',
      fix: 'Add auth token validation before processing requests on protected routes',
    })
    return { penalty: missingAuth * 5 }
  }

  return { penalty: 0 }
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
