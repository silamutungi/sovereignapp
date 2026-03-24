// confidence/engine/evaluators/code-quality-evaluator.js
// Evaluates code quality practices in a project directory

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

export function evaluate(projectPath) {
  const issues = []
  let score = 100

  const checks = [
    checkAnyType(projectPath, issues),
    checkFunctionLength(projectPath, issues),
    checkErrorHandling(projectPath, issues),
    checkConsoleLog(projectPath, issues),
    checkTodoComments(projectPath, issues),
    checkAntipatterns(projectPath, issues),
  ]

  const totalPenalty = checks.reduce((sum, c) => sum + c.penalty, 0)
  score = Math.max(0, 100 - totalPenalty)

  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const passed = criticalIssues.length === 0 && score >= 70

  return {
    dimension: 'code-quality',
    score,
    issues,
    passed,
    summary: passed
      ? `Code quality checks passed (${score}/100)`
      : `Code quality issues found: ${criticalIssues.length} critical, ${issues.length - criticalIssues.length} other`,
  }
}

function checkAnyType(projectPath, issues) {
  // Only scan src/ — api/ uses req:any/res:any as a documented pattern (no @vercel/node types)
  const srcDir = join(projectPath, 'src')
  let anyCount = 0
  const filesWithAny = []

  if (existsSync(srcDir)) {
    const files = getAllFiles(srcDir, '.ts').concat(getAllFiles(srcDir, '.tsx'))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      // Count :any but ignore eslint-disable lines and comments
      const lines = content.split('\n').filter(l => !l.trim().startsWith('//') && !l.includes('eslint-disable'))
      const matches = lines.join('\n').match(/:\s*any\b/g) || []
      if (matches.length > 5) { // 5 per file threshold
        anyCount += matches.length - 5
        filesWithAny.push({ file: file.replace(projectPath, ''), count: matches.length })
      }
    }
  }

  if (anyCount > 0) {
    issues.push({
      severity: 'low',
      message: `'any' type overused in src/ (${anyCount} excess uses). Files: ${filesWithAny.map(f => f.file).join(', ')}`,
      fix: 'Replace any with specific types or unknown. Use generics where applicable.',
    })
  }

  return { penalty: Math.min(anyCount * 2, 20) }
}

function checkFunctionLength(projectPath, issues) {
  const dirs = [join(projectPath, 'src'), join(projectPath, 'api')]
  let penalty = 0

  for (const dir of dirs) {
    const files = getAllFiles(dir, '.ts').concat(getAllFiles(dir, '.tsx'))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      // Find function boundaries by tracking braces
      let inFunction = false
      let braceDepth = 0
      let functionStart = -1
      let functionName = ''

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const funcMatch = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(.*\)\s*=>))/)

        if (!inFunction && funcMatch) {
          inFunction = true
          functionStart = i
          functionName = funcMatch[1] || funcMatch[2] || 'anonymous'
          braceDepth = 0
        }

        if (inFunction) {
          for (const char of line) {
            if (char === '{') braceDepth++
            if (char === '}') braceDepth--
          }

          if (braceDepth <= 0 && functionStart !== -1) {
            const functionLength = i - functionStart + 1
            // React components and API handlers routinely exceed 80 lines.
            // Flag only egregiously long functions (>300 lines) as medium,
            // and very long (>500 lines) as high.
            if (functionLength > 500) {
              issues.push({ severity: 'high', message: `Function '${functionName}' is ${functionLength} lines — consider splitting`, file: file.replace(projectPath, ''), fix: 'Extract into smaller components or helper functions' })
              penalty += 10
            } else if (functionLength > 300) {
              issues.push({ severity: 'low', message: `Function '${functionName}' is ${functionLength} lines`, file: file.replace(projectPath, '') })
              penalty += 3
            }
            inFunction = false
            functionStart = -1
          }
        }
      }
    }
  }

  return { penalty: Math.min(penalty, 30) }
}

function checkErrorHandling(projectPath, issues) {
  const dirs = [join(projectPath, 'src'), join(projectPath, 'api')]
  let missingErrorHandling = 0
  let penalty = 0

  for (const dir of dirs) {
    const files = getAllFiles(dir, '.ts').concat(getAllFiles(dir, '.tsx'))
    for (const file of files) {
      // Test files use assertions not try/catch — skip them
      if (file.includes('.test.') || file.includes('.spec.')) continue
      // API utility files (prefixed _) intentionally propagate errors to callers — skip them
      const basename = file.split('/').pop() || ''
      if (basename.startsWith('_')) continue
      const content = readFileSync(file, 'utf-8')
      // Count async functions
      const asyncFunctions = (content.match(/async\s+(?:function\s+\w+|\w+\s*=>|\()/g) || []).length
      const tryCatches = (content.match(/try\s*\{/g) || []).length

      if (asyncFunctions > 0 && tryCatches === 0 && asyncFunctions > tryCatches) {
        const unhandled = asyncFunctions - tryCatches
        if (unhandled > 0) {
          issues.push({
            severity: 'medium',
            message: `${unhandled} async function(s) without try/catch in ${file.replace(projectPath, '')}`,
            file: file.replace(projectPath, ''),
            fix: 'Wrap async operations in try/catch to handle errors gracefully',
          })
          missingErrorHandling++
          penalty += 5
        }
      }
    }
  }

  return { penalty: Math.min(penalty, 30) }
}

function checkConsoleLog(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const files = getAllFiles(srcDir, '.ts').concat(getAllFiles(srcDir, '.tsx'))
  let count = 0
  let penalty = 0

  for (const file of files) {
    // Test files use console.log for test output — skip them
    if (file.includes('.test.') || file.includes('.spec.')) continue
    const content = readFileSync(file, 'utf-8')
    const consoleLogs = (content.match(/\bconsole\.log\s*\(/g) || []).length
    if (consoleLogs > 0) {
      issues.push({
        severity: 'low',
        message: `${consoleLogs} console.log statement(s) in ${file.replace(projectPath, '')}`,
        file: file.replace(projectPath, ''),
        fix: 'Remove console.log before shipping. Use a logging library or remove debug logs.',
      })
      count += consoleLogs
      penalty += consoleLogs * 2
    }
  }

  return { penalty: Math.min(penalty, 10) }
}

function checkTodoComments(projectPath, issues) {
  const dirs = [join(projectPath, 'src'), join(projectPath, 'api')]
  let count = 0
  let penalty = 0

  for (const dir of dirs) {
    const files = getAllFiles(dir, '.ts').concat(getAllFiles(dir, '.tsx'))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      // Strip template literal strings to avoid false positives in string content
      const codeOnly = content.replace(/`[^`]*`/gs, '""')
      const todos = (codeOnly.match(/\/\/\s*(TODO|FIXME|HACK)\b/gi) || []).length
      if (todos > 0) {
        issues.push({
          severity: 'low',
          message: `${todos} TODO/FIXME/HACK comment(s) in ${file.replace(projectPath, '')}`,
          file: file.replace(projectPath, ''),
          fix: 'Resolve or track TODOs in your issue tracker before shipping',
        })
        count += todos
        penalty += todos * 3
      }
    }
  }

  return { penalty: Math.min(penalty, 15) }
}

function checkAntipatterns(projectPath, issues) {
  const dirs = [join(projectPath, 'src'), join(projectPath, 'api')]
  let penalty = 0

  // Skip files that are known to contain antipattern examples intentionally
  const SKIP_FILES = ['_systemPrompt.ts', 'SOVEREIGN_ANTIPATTERNS.md', 'SOVEREIGN_PATTERNS.md']

  // Known antipatterns from SOVEREIGN_ANTIPATTERNS patterns
  const antipatterns = [
    {
      pattern: /\burl\.parse\s*\(/,
      message: "url.parse() is deprecated and has security issues (CVE class)",
      fix: "Use new URL(string) from the WHATWG URL API instead",
      severity: 'critical',
    },
    {
      pattern: /React\.\w+(?:Event|Node|Ref|Element|Component)\b/,
      message: "React.* namespace type usage requires React in scope (causes tsc failures with react-jsx)",
      fix: "Use named type imports: import { type FormEvent, type ReactNode } from 'react'",
      severity: 'high',
    },
    {
      pattern: /from ['"]@\//,
      message: "Path alias @/ used — not configured by default in Sovereign scaffold",
      fix: "Use relative imports (../../) or configure paths in tsconfig.json and vite.config.ts",
      severity: 'medium',
    },
    {
      pattern: /useHistory\s*\(/,
      message: "useHistory is React Router v5 — not available in v6",
      fix: "Use useNavigate() from react-router-dom (React Router v6)",
      severity: 'high',
    },
    {
      pattern: /<Switch\b/,
      message: "<Switch> is React Router v5 — not available in v6",
      fix: "Use <Routes> from react-router-dom (React Router v6)",
      severity: 'high',
    },
    {
      pattern: /localStorage\.setItem\s*\(\s*['"][^'"]*(?:token|auth|session|user)[^'"]*['"]/i,
      message: "Auth/session data stored in localStorage — use sessionStorage instead",
      fix: "Replace localStorage with sessionStorage for auth state. See CLAUDE.md security rules.",
      severity: 'high',
    },
  ]

  for (const dir of dirs) {
    const files = getAllFiles(dir, '.ts').concat(getAllFiles(dir, '.tsx'))
    for (const file of files) {
      // Skip files that intentionally contain antipattern examples
      if (SKIP_FILES.some(skip => file.includes(skip))) continue
      const content = readFileSync(file, 'utf-8')
      // Strip template literal strings to avoid false positives in string content
      const codeOnly = content.replace(/`[^`]*`/gs, '""').replace(/'[^']*'/g, '""').replace(/"[^"]*"/g, '""')
      for (const ap of antipatterns) {
        if (ap.pattern.test(codeOnly)) {
          issues.push({
            severity: ap.severity,
            message: `Antipattern in ${file.replace(projectPath, '')}: ${ap.message}`,
            file: file.replace(projectPath, ''),
            fix: ap.fix,
          })
          penalty += 10
        }
      }
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
