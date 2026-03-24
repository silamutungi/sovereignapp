// confidence/engine/evaluators/accessibility-evaluator.js
// Evaluates accessibility practices in a project directory

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

export function evaluate(projectPath) {
  const issues = []
  let score = 100

  const checks = [
    checkImgAltText(projectPath, issues),
    checkInteractiveElementLabels(projectPath, issues),
    checkHeadingHierarchy(projectPath, issues),
    checkFormLabels(projectPath, issues),
    checkPositiveTabIndex(projectPath, issues),
    checkFocusVisible(projectPath, issues),
  ]

  const totalPenalty = checks.reduce((sum, c) => sum + c.penalty, 0)
  score = Math.max(0, 100 - totalPenalty)

  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const passed = criticalIssues.length === 0 && score >= 70

  return {
    dimension: 'accessibility',
    score,
    issues,
    passed,
    summary: passed
      ? `Accessibility checks passed (${score}/100)`
      : `Accessibility issues found: ${criticalIssues.length} critical, ${issues.length - criticalIssues.length} other`,
  }
}

function checkImgAltText(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const tsxFiles = getAllFiles(srcDir, '.tsx').concat(getAllFiles(srcDir, '.jsx'))
  let missingAlt = 0
  let penalty = 0

  for (const file of tsxFiles) {
    const content = readFileSync(file, 'utf-8')
    const imgTags = content.match(/<img\b[^>]*>/g) || []

    for (const tag of imgTags) {
      if (!/\balt\s*[={\s]/.test(tag)) {
        missingAlt++
        issues.push({
          severity: 'high',
          message: `<img> missing alt attribute in ${file.replace(projectPath, '')}`,
          file: file.replace(projectPath, ''),
          fix: 'Add alt="" (decorative) or alt="description" (meaningful) to every <img> tag',
        })
        penalty += 10
      }
    }
  }

  return { penalty: Math.min(penalty, 30) }
}

function checkInteractiveElementLabels(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const tsxFiles = getAllFiles(srcDir, '.tsx').concat(getAllFiles(srcDir, '.jsx'))
  let unlabeled = 0
  let penalty = 0

  for (const file of tsxFiles) {
    const content = readFileSync(file, 'utf-8')

    // Find <button> tags that have no text content or aria-label
    // Split by button open tags and check what follows
    const buttonMatches = content.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || []
    for (const buttonBlock of buttonMatches) {
      const hasAriaLabel = /aria-label\s*[={\s]/.test(buttonBlock)
      const hasAriaLabelledBy = /aria-labelledby\s*[={\s]/.test(buttonBlock)
      // Strip all JSX tags and check if there's visible text
      const innerText = buttonBlock
        .replace(/<[^>]+>/g, '')
        .replace(/\{[^}]*\}/g, 'X') // JSX expressions treated as text
        .trim()

      if (!hasAriaLabel && !hasAriaLabelledBy && innerText.length === 0) {
        unlabeled++
        issues.push({
          severity: 'high',
          message: `<button> with no accessible text or aria-label in ${file.replace(projectPath, '')}`,
          file: file.replace(projectPath, ''),
          fix: 'Add visible text content or aria-label to every <button>',
        })
        penalty += 10
      }
    }

    // Check icon buttons (button with only an svg/icon child)
    const iconButtonMatches = content.match(/<button\b[^>]*>\s*(?:<svg|<Icon)[^<]*(?:<\/svg>|>|/>)\s*<\/button>/g) || []
    for (const btn of iconButtonMatches) {
      if (!/aria-label/.test(btn)) {
        issues.push({
          severity: 'high',
          message: `Icon-only <button> missing aria-label in ${file.replace(projectPath, '')}`,
          file: file.replace(projectPath, ''),
          fix: 'Add aria-label="description" to icon-only buttons',
        })
        penalty += 10
        unlabeled++
      }
    }
  }

  return { penalty: Math.min(penalty, 30) }
}

function checkHeadingHierarchy(projectPath, issues) {
  const pagesDir = join(projectPath, 'src', 'pages')
  if (!existsSync(pagesDir)) return { penalty: 0 }

  const pageFiles = getAllFiles(pagesDir, '.tsx').concat(getAllFiles(pagesDir, '.jsx'))
  let penalty = 0

  for (const file of pageFiles) {
    const content = readFileSync(file, 'utf-8')
    const isHomePage = file.toLowerCase().includes('home') || file.toLowerCase().includes('index')

    const headingMatches = content.match(/<h([1-6])\b/g) || []
    const levels = headingMatches.map(m => parseInt(m.replace('<h', ''), 10))

    if (isHomePage && !levels.includes(1)) {
      issues.push({
        severity: 'medium',
        message: `Home page ${file.replace(projectPath, '')} has no <h1> — every page needs a top-level heading`,
        file: file.replace(projectPath, ''),
        fix: 'Add an <h1> to the home page for screen reader navigation and SEO',
      })
      penalty += 10
    }

    // Check for skipped levels (e.g., h1 → h3 without h2)
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) {
        issues.push({
          severity: 'medium',
          message: `Heading level skipped in ${file.replace(projectPath, '')} — found h${levels[i - 1]} followed by h${levels[i]}`,
          file: file.replace(projectPath, ''),
          fix: `Add h${levels[i - 1] + 1} before h${levels[i]} — do not skip heading levels`,
        })
        penalty += 10
        break
      }
    }
  }

  return { penalty: Math.min(penalty, 20) }
}

function checkFormLabels(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const tsxFiles = getAllFiles(srcDir, '.tsx').concat(getAllFiles(srcDir, '.jsx'))
  let unlabeledInputs = 0
  let penalty = 0

  for (const file of tsxFiles) {
    const content = readFileSync(file, 'utf-8')

    // Find input elements and check for associated labels
    const inputMatches = content.match(/<input\b[^>]*>/g) || []
    for (const inputTag of inputMatches) {
      // Skip hidden, submit, reset, button inputs
      if (/type\s*=\s*['"](?:hidden|submit|reset|button|checkbox|radio)['"]/i.test(inputTag)) continue

      const hasId = /\bid\s*[={\s]/.test(inputTag)
      const hasAriaLabel = /aria-label\s*[={\s]/.test(inputTag)
      const hasAriaLabelledBy = /aria-labelledby\s*[={\s]/.test(inputTag)
      const hasPlaceholderOnly = /placeholder\s*[={\s]/.test(inputTag) && !hasAriaLabel && !hasId

      // Check if there's a corresponding <label> with htmlFor matching this input's id
      // For simplicity: if no aria-label, aria-labelledby, and no id (for label association) — flag it
      if (!hasAriaLabel && !hasAriaLabelledBy && (!hasId || hasPlaceholderOnly)) {
        unlabeledInputs++
        issues.push({
          severity: 'medium',
          message: `Form <input> may lack accessible label in ${file.replace(projectPath, '')}`,
          file: file.replace(projectPath, ''),
          fix: 'Add <label htmlFor="id"> or aria-label to every form input. Placeholder alone is not sufficient.',
        })
        penalty += 5
      }
    }
  }

  return { penalty: Math.min(penalty, 25) }
}

function checkPositiveTabIndex(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const tsxFiles = getAllFiles(srcDir, '.tsx').concat(getAllFiles(srcDir, '.jsx'))
  let penalty = 0

  for (const file of tsxFiles) {
    const content = readFileSync(file, 'utf-8')
    // Look for tabIndex={N} or tabindex="N" where N > 0
    const tabIndexMatches = content.match(/tabIndex\s*=\s*\{(\d+)\}|tabindex\s*=\s*["'](\d+)["']/g) || []

    for (const match of tabIndexMatches) {
      const value = parseInt(match.replace(/[^0-9]/g, ''), 10)
      if (value > 0) {
        issues.push({
          severity: 'medium',
          message: `Positive tabIndex (${value}) found in ${file.replace(projectPath, '')} — disrupts natural tab order`,
          file: file.replace(projectPath, ''),
          fix: 'Use tabIndex={0} to make an element focusable without changing tab order. Avoid positive tabIndex values.',
        })
        penalty += 5
      }
    }
  }

  return { penalty: Math.min(penalty, 20) }
}

function checkFocusVisible(projectPath, issues) {
  const cssFiles = []
  const srcDir = join(projectPath, 'src')
  const rootDir = projectPath

  if (existsSync(srcDir)) {
    cssFiles.push(...getAllFiles(srcDir, '.css'))
  }
  cssFiles.push(...getAllFiles(rootDir, '.css').filter(f => !f.includes('node_modules') && !f.includes('/src/')))

  let hasFocusVisible = false

  for (const file of cssFiles) {
    const content = readFileSync(file, 'utf-8')
    if (content.includes(':focus-visible')) {
      hasFocusVisible = true
      break
    }
  }

  if (!hasFocusVisible) {
    issues.push({
      severity: 'low',
      message: 'No :focus-visible styles found — keyboard users may not see focus indicators',
      fix: "Add :focus-visible styles: outline: 2px solid #c8f060; outline-offset: 2px on interactive elements",
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
