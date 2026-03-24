// confidence/engine/evaluators/ux-evaluator.js
// Evaluates UX quality practices in a project directory

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

export function evaluate(projectPath) {
  const issues = []
  let score = 100

  const checks = [
    checkLoadingStates(projectPath, issues),
    checkErrorStates(projectPath, issues),
    checkEmptyStates(projectPath, issues),
    checkErrorBoundary(projectPath, issues),
    checkNoLoremIpsum(projectPath, issues),
    checkTransitions(projectPath, issues),
    checkMobileViewport(projectPath, issues),
  ]

  const totalPenalty = checks.reduce((sum, c) => sum + c.penalty, 0)
  score = Math.max(0, 100 - totalPenalty)

  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const passed = criticalIssues.length === 0 && score >= 70

  return {
    dimension: 'ux',
    score,
    issues,
    passed,
    summary: passed
      ? `UX checks passed (${score}/100)`
      : `UX issues found: ${criticalIssues.length} critical, ${issues.length - criticalIssues.length} other`,
  }
}

function checkLoadingStates(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const tsxFiles = getAllFiles(srcDir, '.tsx').concat(getAllFiles(srcDir, '.jsx'))
  const loadingPatterns = [
    /\bisLoading\b/,
    /\bskeleton\b/i,
    /LoadingSpinner/,
    /\bloading\s*=\s*true\b/,
    /Spinner/,
    /\bpending\b.*state/i,
    /animate-pulse/,
  ]

  let hasLoadingState = false
  for (const file of tsxFiles) {
    const content = readFileSync(file, 'utf-8')
    if (loadingPatterns.some(p => p.test(content))) {
      hasLoadingState = true
      break
    }
  }

  if (!hasLoadingState) {
    issues.push({
      severity: 'high',
      message: 'No loading states found in any component — async operations need loading indicators',
      fix: 'Add isLoading state to components with async operations. Show <Spinner /> or skeleton UI.',
    })
    return { penalty: 15 }
  }

  return { penalty: 0 }
}

function checkErrorStates(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const tsxFiles = getAllFiles(srcDir, '.tsx').concat(getAllFiles(srcDir, '.jsx'))
  const errorPatterns = [
    /\bisError\b/,
    /\bsetError\b/,
    /error\.message\b/,
    /\berrorMessage\b/,
    /\berror\s*&&\b/,
    /\berror\s*\?\s*/,
  ]

  let hasErrorState = false
  for (const file of tsxFiles) {
    const content = readFileSync(file, 'utf-8')
    if (errorPatterns.some(p => p.test(content))) {
      hasErrorState = true
      break
    }
  }

  if (!hasErrorState) {
    issues.push({
      severity: 'high',
      message: 'No error states found in any component — async operations need error handling UI',
      fix: 'Add error state with recovery action. Example: if (error) return <ErrorMessage retry={fetchData} />',
    })
    return { penalty: 15 }
  }

  return { penalty: 0 }
}

function checkEmptyStates(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const tsxFiles = getAllFiles(srcDir, '.tsx').concat(getAllFiles(srcDir, '.jsx'))
  const emptyPatterns = [
    /EmptyState/,
    /\bisEmpty\b/,
    /\.length\s*===\s*0/,
    /no\s+results/i,
    /empty.*list/i,
    /nothing.*yet/i,
    /no.*found/i,
  ]

  let hasEmptyState = false
  for (const file of tsxFiles) {
    const content = readFileSync(file, 'utf-8')
    if (emptyPatterns.some(p => p.test(content))) {
      hasEmptyState = true
      break
    }
  }

  if (!hasEmptyState) {
    issues.push({
      severity: 'medium',
      message: 'No empty states found — lists and data views need empty state UI',
      fix: 'Add EmptyState component or isEmpty checks with helpful copy and a primary action (e.g., "Create your first...")',
    })
    return { penalty: 10 }
  }

  return { penalty: 0 }
}

function checkErrorBoundary(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const filesToCheck = [
    join(srcDir, 'App.tsx'),
    join(srcDir, 'App.jsx'),
    join(srcDir, 'main.tsx'),
    join(srcDir, 'main.jsx'),
  ]

  let hasErrorBoundary = false
  for (const file of filesToCheck) {
    if (!existsSync(file)) continue
    const content = readFileSync(file, 'utf-8')
    if (content.includes('ErrorBoundary')) {
      hasErrorBoundary = true
      break
    }
  }

  if (!hasErrorBoundary) {
    // Also check components directory
    const componentsDir = join(srcDir, 'components')
    if (existsSync(componentsDir)) {
      const componentFiles = getAllFiles(componentsDir, '.tsx')
      for (const file of componentFiles) {
        const content = readFileSync(file, 'utf-8')
        if (content.includes('ErrorBoundary') || content.includes('componentDidCatch')) {
          hasErrorBoundary = true
          break
        }
      }
    }
  }

  if (!hasErrorBoundary) {
    issues.push({
      severity: 'medium',
      message: 'No ErrorBoundary found in App.tsx or main.tsx — unhandled errors will show a blank screen',
      file: 'src/App.tsx',
      fix: 'Wrap app in <ErrorBoundary> component with a friendly fallback UI and reload option',
    })
    return { penalty: 10 }
  }

  return { penalty: 0 }
}

function checkNoLoremIpsum(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const files = getAllFiles(srcDir, '.tsx')
    .concat(getAllFiles(srcDir, '.jsx'))
    .concat(getAllFiles(srcDir, '.ts'))

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    if (/lorem\s+ipsum/i.test(content)) {
      issues.push({
        severity: 'critical',
        message: `Lorem ipsum placeholder text found in ${file.replace(projectPath, '')} — never ship placeholder content`,
        file: file.replace(projectPath, ''),
        fix: 'Replace lorem ipsum with real or realistic copy. No placeholder text in production.',
      })
      return { penalty: 20 }
    }
  }

  return { penalty: 0 }
}

function checkTransitions(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const cssFiles = getAllFiles(srcDir, '.css')
  let hasTransitions = false

  for (const file of cssFiles) {
    const content = readFileSync(file, 'utf-8')
    if (content.includes('transition') || content.includes('animation')) {
      hasTransitions = true
      break
    }
  }

  if (!hasTransitions) {
    issues.push({
      severity: 'low',
      message: 'No CSS transitions or animations found — consider adding micro-interactions for polish',
      fix: 'Add transition: all 200ms ease on interactive elements. Entrance animations with translateY and opacity.',
    })
  }

  // Info only — no penalty
  return { penalty: 0 }
}

function checkMobileViewport(projectPath, issues) {
  const indexPath = join(projectPath, 'index.html')
  if (!existsSync(indexPath)) return { penalty: 0 }

  const content = readFileSync(indexPath, 'utf-8')
  if (!content.includes('viewport') || !content.includes('width=device-width')) {
    issues.push({
      severity: 'high',
      message: 'index.html missing mobile viewport meta tag — app will not render correctly on mobile',
      file: 'index.html',
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> to <head>',
    })
    return { penalty: 10 }
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
