// confidence/engine/evaluators/documentation-evaluator.js
// Evaluates documentation quality in a project directory

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

export function evaluate(projectPath) {
  const issues = []
  let score = 100

  const checks = [
    checkReadme(projectPath, issues),
    checkClaudeMd(projectPath, issues),
    checkEnvExample(projectPath, issues),
    checkPackageDescription(projectPath, issues),
    checkApiJsDocs(projectPath, issues),
    checkComplexFunctionComments(projectPath, issues),
  ]

  const totalPenalty = checks.reduce((sum, c) => sum + c.penalty, 0)
  score = Math.max(0, 100 - totalPenalty)

  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const passed = criticalIssues.length === 0 && score >= 70

  return {
    dimension: 'documentation',
    score,
    issues,
    passed,
    summary: passed
      ? `Documentation checks passed (${score}/100)`
      : `Documentation issues found: ${criticalIssues.length} critical, ${issues.length - criticalIssues.length} other`,
  }
}

function checkReadme(projectPath, issues) {
  const readmePath = join(projectPath, 'README.md')

  if (!existsSync(readmePath)) {
    issues.push({
      severity: 'high',
      message: 'README.md missing — every project needs a README',
      file: 'README.md',
      fix: 'Create README.md with: app name, description, setup instructions, env vars, and how to run locally',
    })
    return { penalty: 20 }
  }

  const content = readFileSync(readmePath, 'utf-8')
  if (content.length < 500) {
    issues.push({
      severity: 'medium',
      message: `README.md is only ${content.length} chars — too short to be useful (minimum 500)`,
      file: 'README.md',
      fix: 'Expand README with: project description, setup steps, env vars needed, how to run, deployment notes',
    })
    return { penalty: 10 }
  }

  return { penalty: 0 }
}

function checkClaudeMd(projectPath, issues) {
  const claudePath = join(projectPath, 'CLAUDE.md')

  if (!existsSync(claudePath)) {
    issues.push({
      severity: 'medium',
      message: 'CLAUDE.md missing — Claude Code has no context for this project',
      file: 'CLAUDE.md',
      fix: 'Create CLAUDE.md with: stack overview, file structure, database schema, env vars, and hard-won lessons',
    })
    return { penalty: 10 }
  }

  return { penalty: 0 }
}

function checkEnvExample(projectPath, issues) {
  const envExamplePath = join(projectPath, '.env.example')

  if (!existsSync(envExamplePath)) {
    issues.push({
      severity: 'high',
      message: '.env.example missing — contributors have no reference for required environment variables',
      file: '.env.example',
      fix: 'Create .env.example with all required env vars (with placeholder values, no real secrets)',
    })
    return { penalty: 15 }
  }

  return { penalty: 0 }
}

function checkPackageDescription(projectPath, issues) {
  const pkgPath = join(projectPath, 'package.json')
  if (!existsSync(pkgPath)) return { penalty: 0 }

  let pkg
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  } catch {
    return { penalty: 0 }
  }

  if (!pkg.description || pkg.description.trim() === '') {
    issues.push({
      severity: 'low',
      message: 'package.json missing description field',
      file: 'package.json',
      fix: 'Add a "description" field to package.json: "description": "A short description of your app"',
    })
    return { penalty: 5 }
  }

  return { penalty: 0 }
}

function checkApiJsDocs(projectPath, issues) {
  const apiDir = join(projectPath, 'api')
  if (!existsSync(apiDir)) return { penalty: 0 }

  const apiFiles = getAllFiles(apiDir, '.ts').filter(
    f => !f.includes('node_modules') && !f.includes('migrations')
  )

  if (apiFiles.length === 0) return { penalty: 0 }

  let withDocs = 0
  for (const file of apiFiles) {
    const content = readFileSync(file, 'utf-8')
    if (content.includes('/**')) {
      withDocs++
    }
  }

  const coverage = withDocs / apiFiles.length
  if (coverage < 0.5) {
    issues.push({
      severity: 'low',
      message: `Only ${withDocs}/${apiFiles.length} API routes have JSDoc comments (/** ... */)`,
      fix: 'Add JSDoc to each API route describing: @param, @returns, rate limits, auth requirements',
    })
    return { penalty: 5 }
  }

  return { penalty: 0 }
}

function checkComplexFunctionComments(projectPath, issues) {
  const dirs = [join(projectPath, 'src'), join(projectPath, 'api')]
  let complexFilesWithoutComments = 0
  let complexFilesCount = 0

  for (const dir of dirs) {
    const files = getAllFiles(dir, '.ts').concat(getAllFiles(dir, '.tsx'))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const lineCount = content.split('\n').length

      if (lineCount > 100) {
        complexFilesCount++
        const hasComments = /\/\/|\/\*/.test(content)
        if (!hasComments) {
          complexFilesWithoutComments++
        }
      }
    }
  }

  if (complexFilesCount > 0 && complexFilesWithoutComments > 0) {
    issues.push({
      severity: 'low',
      message: `${complexFilesWithoutComments} complex file(s) (>100 lines) have no comments`,
      fix: 'Add inline comments explaining non-obvious logic in files over 100 lines',
    })
  }

  // Info only — no penalty
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
