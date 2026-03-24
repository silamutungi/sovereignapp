// confidence/engine/evaluators/performance-evaluator.js
// Evaluates performance practices in a project directory

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

export function evaluate(projectPath) {
  const issues = []
  let score = 100

  const checks = [
    checkHeavyDependencies(projectPath, issues),
    checkForEachAsync(projectPath, issues),
    checkLazyImports(projectPath, issues),
    checkNPlusOne(projectPath, issues),
    checkImageDimensions(projectPath, issues),
    checkCacheControl(projectPath, issues),
  ]

  const totalPenalty = checks.reduce((sum, c) => sum + c.penalty, 0)
  score = Math.max(0, 100 - totalPenalty)

  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const passed = criticalIssues.length === 0 && score >= 70

  return {
    dimension: 'performance',
    score,
    issues,
    passed,
    summary: passed
      ? `Performance checks passed (${score}/100)`
      : `Performance issues found: ${criticalIssues.length} critical, ${issues.length - criticalIssues.length} other`,
  }
}

function checkHeavyDependencies(projectPath, issues) {
  const pkgPath = join(projectPath, 'package.json')
  if (!existsSync(pkgPath)) {
    issues.push({
      severity: 'high',
      message: 'package.json not found — cannot check dependencies',
      fix: 'Add package.json to the project root',
    })
    return { penalty: 5 }
  }

  let pkg
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  } catch {
    return { penalty: 0 }
  }

  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  }

  const heavyDeps = [
    {
      name: 'moment',
      alternative: 'date-fns or dayjs (much smaller bundle size)',
      penalty: 10,
    },
    {
      name: 'lodash',
      alternative: 'native ES6+ methods or lodash-es for tree-shaking',
      penalty: 10,
    },
  ]

  let penalty = 0
  for (const dep of heavyDeps) {
    if (allDeps[dep.name]) {
      issues.push({
        severity: 'medium',
        message: `Heavy dependency '${dep.name}' found — consider ${dep.alternative}`,
        file: 'package.json',
        fix: `Replace ${dep.name} with ${dep.alternative}`,
      })
      penalty += dep.penalty
    }
  }

  return { penalty }
}

function checkForEachAsync(projectPath, issues) {
  const dirs = [join(projectPath, 'src'), join(projectPath, 'api')]
  let penalty = 0

  for (const dir of dirs) {
    const files = getAllFiles(dir, '.ts').concat(getAllFiles(dir, '.tsx'))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      // Detect .forEach with async callback — this does not await the promises
      if (/\.forEach\s*\(\s*async\s*(?:\(|[a-zA-Z_$])/.test(content)) {
        issues.push({
          severity: 'high',
          message: `Array.forEach with async callback in ${file.replace(projectPath, '')} — forEach does not await promises`,
          file: file.replace(projectPath, ''),
          fix: 'Replace .forEach(async fn) with for...of loop or Promise.all(array.map(async fn))',
        })
        penalty += 15
      }
    }
  }

  return { penalty: Math.min(penalty, 45) }
}

function checkLazyImports(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const files = getAllFiles(srcDir, '.ts').concat(getAllFiles(srcDir, '.tsx'))
  let hasLazyImport = false

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    if (content.includes('React.lazy') || content.includes('lazy(')) {
      hasLazyImport = true
      break
    }
  }

  if (!hasLazyImport) {
    issues.push({
      severity: 'low',
      message: 'No React.lazy() code-splitting found — all components loaded eagerly',
      fix: 'Consider lazy-loading heavy page components: const Page = React.lazy(() => import("./Page"))',
    })
  }

  // Info only — no penalty
  return { penalty: 0 }
}

function checkNPlusOne(projectPath, issues) {
  const dirs = [join(projectPath, 'src'), join(projectPath, 'api')]
  let penalty = 0

  for (const dir of dirs) {
    const files = getAllFiles(dir, '.ts').concat(getAllFiles(dir, '.tsx'))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      let inForEach = false
      let forEachDepth = 0
      let awaitCount = 0
      let forEachStartLine = -1

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        if (!inForEach && /\.forEach\s*\(/.test(line)) {
          inForEach = true
          forEachDepth = 0
          awaitCount = 0
          forEachStartLine = i
        }

        if (inForEach) {
          for (const char of line) {
            if (char === '{') forEachDepth++
            if (char === '}') forEachDepth--
          }
          if (/\bawait\b/.test(line)) awaitCount++

          if (forEachDepth <= 0 && forEachStartLine !== -1 && i > forEachStartLine) {
            if (awaitCount >= 2) {
              issues.push({
                severity: 'high',
                message: `Potential N+1 query pattern in ${file.replace(projectPath, '')} around line ${forEachStartLine + 1} — ${awaitCount} awaits inside forEach`,
                file: file.replace(projectPath, ''),
                fix: 'Batch database queries outside the loop. Use Promise.all or a single query with IN clause.',
              })
              penalty += 20
            }
            inForEach = false
            forEachStartLine = -1
          }
        }
      }
    }
  }

  return { penalty: Math.min(penalty, 40) }
}

function checkImageDimensions(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const tsxFiles = getAllFiles(srcDir, '.tsx')
  let missingDimensions = 0
  let penalty = 0

  for (const file of tsxFiles) {
    const content = readFileSync(file, 'utf-8')
    // Find img tags that don't have both width and height
    const imgTagMatches = content.match(/<img\b[^>]*>/g) || []
    for (const tag of imgTagMatches) {
      const hasWidth = /\bwidth\s*[={\s]/.test(tag)
      const hasHeight = /\bheight\s*[={\s]/.test(tag)
      if (!hasWidth || !hasHeight) {
        missingDimensions++
        issues.push({
          severity: 'low',
          message: `<img> missing ${!hasWidth ? 'width' : ''}${!hasWidth && !hasHeight ? ' and ' : ''}${!hasHeight ? 'height' : ''} in ${file.replace(projectPath, '')} — causes layout shift (CLS)`,
          file: file.replace(projectPath, ''),
          fix: 'Add explicit width and height to all <img> tags to prevent Cumulative Layout Shift',
        })
        penalty += 3
      }
    }
  }

  return { penalty: Math.min(penalty, 15) }
}

function checkCacheControl(projectPath, issues) {
  const apiDir = join(projectPath, 'api')
  if (!existsSync(apiDir)) return { penalty: 0 }

  const apiFiles = getAllFiles(apiDir, '.ts')
  let hasCacheControl = false

  for (const file of apiFiles) {
    const content = readFileSync(file, 'utf-8')
    if (content.includes('Cache-Control') || content.includes('cache-control')) {
      hasCacheControl = true
      break
    }
  }

  if (!hasCacheControl) {
    issues.push({
      severity: 'low',
      message: 'No Cache-Control headers found in API routes — cacheable responses are not being cached',
      fix: "Add res.setHeader('Cache-Control', 'public, max-age=300') to read-only API routes",
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
