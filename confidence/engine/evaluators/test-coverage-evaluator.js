// confidence/engine/evaluators/test-coverage-evaluator.js
// Evaluates test coverage presence in a project directory

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, basename } from 'path'

export function evaluate(projectPath) {
  const issues = []
  let score = 100

  const checks = [
    checkTestFilesExist(projectPath, issues),
    checkTestFramework(projectPath, issues),
    checkPageCoverage(projectPath, issues),
    checkTestConfig(projectPath, issues),
  ]

  const totalPenalty = checks.reduce((sum, c) => sum + c.penalty, 0)
  score = Math.max(0, 100 - totalPenalty)

  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const passed = criticalIssues.length === 0 && score >= 60

  return {
    dimension: 'test-coverage',
    score,
    issues,
    passed,
    summary: passed
      ? `Test coverage checks passed (${score}/100)`
      : `Test coverage issues found: ${criticalIssues.length} critical, ${issues.length - criticalIssues.length} other`,
  }
}

function checkTestFilesExist(projectPath, issues) {
  const allTestFiles = [
    ...getAllFiles(projectPath, '.test.ts'),
    ...getAllFiles(projectPath, '.test.tsx'),
    ...getAllFiles(projectPath, '.spec.ts'),
    ...getAllFiles(projectPath, '.spec.tsx'),
  ].filter(f => !f.includes('node_modules'))

  if (allTestFiles.length === 0) {
    issues.push({
      severity: 'high',
      message: 'No test files found (.test.ts, .spec.ts, .test.tsx, .spec.tsx)',
      fix: 'Add at least one test file per page. Start with vitest + React Testing Library.',
    })
    return { penalty: 20 }
  }

  return { penalty: 0 }
}

function checkTestFramework(projectPath, issues) {
  const pkgPath = join(projectPath, 'package.json')
  if (!existsSync(pkgPath)) return { penalty: 0 }

  let pkg
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  } catch {
    return { penalty: 0 }
  }

  const devDeps = pkg.devDependencies || {}
  const deps = pkg.dependencies || {}
  const allDeps = { ...devDeps, ...deps }

  const hasVitest = 'vitest' in allDeps
  const hasJest = 'jest' in allDeps || '@jest/core' in allDeps

  if (!hasVitest && !hasJest) {
    issues.push({
      severity: 'high',
      message: 'Neither vitest nor jest found in package.json devDependencies',
      file: 'package.json',
      fix: 'Add vitest to devDependencies: npm install -D vitest @vitest/ui @testing-library/react',
    })
    return { penalty: 15 }
  }

  return { penalty: 0 }
}

function checkPageCoverage(projectPath, issues) {
  const pagesDir = join(projectPath, 'src', 'pages')
  if (!existsSync(pagesDir)) return { penalty: 0 }

  const pageFiles = getAllFiles(pagesDir, '.tsx').concat(getAllFiles(pagesDir, '.jsx'))
  if (pageFiles.length === 0) return { penalty: 0 }

  // Collect all test file names (basename without extension)
  const allTestFiles = [
    ...getAllFiles(projectPath, '.test.ts'),
    ...getAllFiles(projectPath, '.test.tsx'),
    ...getAllFiles(projectPath, '.spec.ts'),
    ...getAllFiles(projectPath, '.spec.tsx'),
  ].filter(f => !f.includes('node_modules'))

  const testedNames = new Set(
    allTestFiles.map(f => {
      // e.g. Home.test.tsx -> Home, dashboard.spec.ts -> dashboard
      return basename(f)
        .replace('.test.tsx', '')
        .replace('.test.ts', '')
        .replace('.spec.tsx', '')
        .replace('.spec.ts', '')
        .toLowerCase()
    })
  )

  let untestedPages = 0
  let penalty = 0

  for (const pageFile of pageFiles) {
    const pageName = basename(pageFile)
      .replace('.tsx', '')
      .replace('.jsx', '')
      .toLowerCase()

    if (!testedNames.has(pageName)) {
      issues.push({
        severity: 'low',
        message: `Page ${basename(pageFile)} has no corresponding test file`,
        file: pageFile.replace(projectPath, ''),
        fix: `Create ${basename(pageFile).replace('.tsx', '.test.tsx')} with at least a render smoke test`,
      })
      untestedPages++
      penalty += 5
    }
  }

  return { penalty: Math.min(penalty, 20) }
}

function checkTestConfig(projectPath, issues) {
  const vitestConfig = join(projectPath, 'vitest.config.ts')
  const vitestConfigJs = join(projectPath, 'vitest.config.js')
  const jestConfig = join(projectPath, 'jest.config.ts')
  const jestConfigJs = join(projectPath, 'jest.config.js')

  const hasConfig = [vitestConfig, vitestConfigJs, jestConfig, jestConfigJs].some(existsSync)

  if (!hasConfig) {
    issues.push({
      severity: 'low',
      message: 'No test config file found (vitest.config.ts / jest.config.ts)',
      fix: 'Create vitest.config.ts with test environment settings. Ensures consistent test runs.',
    })
    return { penalty: 5 }
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
