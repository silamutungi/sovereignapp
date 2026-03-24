// confidence/engine/evaluators/seo-evaluator.js
// Evaluates SEO practices in a project directory

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

export function evaluate(projectPath) {
  const issues = []
  let score = 100

  const checks = [
    checkTitleTag(projectPath, issues),
    checkMetaDescription(projectPath, issues),
    checkOpenGraph(projectPath, issues),
    checkCanonicalOrRobots(projectPath, issues),
    checkSemanticElements(projectPath, issues),
    checkH1InPages(projectPath, issues),
  ]

  const totalPenalty = checks.reduce((sum, c) => sum + c.penalty, 0)
  score = Math.max(0, 100 - totalPenalty)

  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const passed = criticalIssues.length === 0 && score >= 70

  return {
    dimension: 'seo',
    score,
    issues,
    passed,
    summary: passed
      ? `SEO checks passed (${score}/100)`
      : `SEO issues found: ${criticalIssues.length} critical, ${issues.length - criticalIssues.length} other`,
  }
}

function checkTitleTag(projectPath, issues) {
  const indexPath = join(projectPath, 'index.html')
  if (!existsSync(indexPath)) {
    issues.push({
      severity: 'high',
      message: 'index.html not found — cannot check for title tag',
      fix: 'Create index.html with a <title> tag in <head>',
    })
    return { penalty: 20 }
  }

  const content = readFileSync(indexPath, 'utf-8')
  if (!/<title\b[^>]*>[^<]+<\/title>/i.test(content)) {
    issues.push({
      severity: 'high',
      message: 'index.html missing <title> tag — required for search engine indexing',
      file: 'index.html',
      fix: 'Add <title>App Name — Short Description</title> to the <head>',
    })
    return { penalty: 20 }
  }

  return { penalty: 0 }
}

function checkMetaDescription(projectPath, issues) {
  const indexPath = join(projectPath, 'index.html')
  if (!existsSync(indexPath)) return { penalty: 0 }

  const content = readFileSync(indexPath, 'utf-8')
  if (!/<meta\s[^>]*name\s*=\s*["']description["'][^>]*>/i.test(content)) {
    issues.push({
      severity: 'medium',
      message: 'index.html missing <meta name="description"> — search engines use this for snippet text',
      file: 'index.html',
      fix: 'Add <meta name="description" content="150-160 char description of your app"> to <head>',
    })
    return { penalty: 15 }
  }

  return { penalty: 0 }
}

function checkOpenGraph(projectPath, issues) {
  const indexPath = join(projectPath, 'index.html')
  if (!existsSync(indexPath)) return { penalty: 0 }

  const content = readFileSync(indexPath, 'utf-8')
  let penalty = 0

  if (!content.includes('og:title')) {
    issues.push({
      severity: 'medium',
      message: 'index.html missing og:title meta tag — app will not render well when shared on social media',
      file: 'index.html',
      fix: 'Add <meta property="og:title" content="App Name"> to <head>',
    })
    penalty += 10
  }

  if (!content.includes('og:description')) {
    issues.push({
      severity: 'medium',
      message: 'index.html missing og:description meta tag — social share previews will be incomplete',
      file: 'index.html',
      fix: 'Add <meta property="og:description" content="Description"> to <head>',
    })
    penalty += 10
  }

  return { penalty }
}

function checkCanonicalOrRobots(projectPath, issues) {
  const indexPath = join(projectPath, 'index.html')
  if (!existsSync(indexPath)) return { penalty: 0 }

  const content = readFileSync(indexPath, 'utf-8')
  const hasCanonical = content.includes('rel="canonical"') || content.includes("rel='canonical'")
  const hasRobots = /<meta\s[^>]*name\s*=\s*["']robots["']/i.test(content)

  if (!hasCanonical && !hasRobots) {
    issues.push({
      severity: 'low',
      message: 'index.html has no canonical link or robots meta tag',
      file: 'index.html',
      fix: 'Add <link rel="canonical" href="https://yourdomain.com"> or <meta name="robots" content="index, follow">',
    })
    return { penalty: 5 }
  }

  return { penalty: 0 }
}

function checkSemanticElements(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { penalty: 0 }

  const tsxFiles = getAllFiles(srcDir, '.tsx').concat(getAllFiles(srcDir, '.jsx'))
  const semanticElements = ['<main', '<nav', '<section', '<article', '<header', '<footer']
  const foundTypes = new Set()

  for (const file of tsxFiles) {
    const content = readFileSync(file, 'utf-8')
    for (const el of semanticElements) {
      if (content.includes(el)) {
        foundTypes.add(el)
      }
    }
  }

  if (foundTypes.size < 3) {
    issues.push({
      severity: 'medium',
      message: `Only ${foundTypes.size} semantic HTML element type(s) found (${[...foundTypes].join(', ')}) — use at least 3 for accessibility and SEO`,
      fix: 'Use <main>, <nav>, <header>, <footer>, <section>, <article> in your JSX instead of generic <div>',
    })
    return { penalty: 5 }
  }

  return { penalty: 0 }
}

function checkH1InPages(projectPath, issues) {
  const pagesDir = join(projectPath, 'src', 'pages')
  if (!existsSync(pagesDir)) return { penalty: 0 }

  const pageFiles = getAllFiles(pagesDir, '.tsx').concat(getAllFiles(pagesDir, '.jsx'))
  let hasH1 = false

  for (const file of pageFiles) {
    const content = readFileSync(file, 'utf-8')
    if (/<h1\b/.test(content)) {
      hasH1 = true
      break
    }
  }

  if (!hasH1) {
    issues.push({
      severity: 'medium',
      message: 'No <h1> found in any page component — every page should have a primary heading',
      fix: 'Add an <h1> to each page for SEO and screen reader navigation',
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
