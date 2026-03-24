// confidence/engine/evaluators/i18n-evaluator.js
// Evaluates internationalisation readiness in a project directory
// Score starts at 80 (i18n is a bonus standard) — add points for presence of i18n patterns

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'

export function evaluate(projectPath) {
  const issues = []
  // i18n is a bonus standard: start at 80, add points for good practices
  let score = 80

  const { bonus: i18nBonus, info: i18nInfo } = checkI18nFile(projectPath, issues)
  const { penalty: datePenalty } = checkHardcodedDateFormats(projectPath, issues)
  const { penalty: currencyPenalty } = checkHardcodedCurrency(projectPath, issues)
  const { bonus: intlBonus, info: intlInfo } = checkIntlApiUsage(projectPath, issues)

  score = Math.min(100, score + i18nBonus + intlBonus)
  score = Math.max(0, score - datePenalty - currencyPenalty)

  const criticalIssues = issues.filter(i => i.severity === 'critical')
  const passed = criticalIssues.length === 0 && score >= 60

  const infos = [i18nInfo, intlInfo].filter(Boolean)

  return {
    dimension: 'i18n',
    score,
    issues,
    passed,
    summary: passed
      ? `i18n checks passed (${score}/100)${infos.length > 0 ? ' — ' + infos.join('; ') : ''}`
      : `i18n issues found. Score: ${score}/100${infos.length > 0 ? ' — ' + infos.join('; ') : ''}`,
  }
}

function checkI18nFile(projectPath, issues) {
  const srcDir = join(projectPath, 'src')
  if (!existsSync(srcDir)) return { bonus: 0, info: null }

  const i18nFile = join(srcDir, 'i18n.ts')
  const i18nDir = join(srcDir, 'i18n')
  const localesDir = join(srcDir, 'locales')

  if (existsSync(i18nFile)) {
    issues.push({
      severity: 'low',
      message: 'i18n.ts found — internationalisation is configured',
      fix: '',
    })
    return { bonus: 20, info: 'i18n.ts present (+20)' }
  }

  if (existsSync(i18nDir) || existsSync(localesDir)) {
    issues.push({
      severity: 'low',
      message: `i18n directory found (${existsSync(i18nDir) ? 'src/i18n/' : 'src/locales/'}) — internationalisation is configured`,
      fix: '',
    })
    return { bonus: 15, info: 'i18n directory present (+15)' }
  }

  // Not present — info only
  issues.push({
    severity: 'low',
    message: 'No i18n.ts or i18n/ directory found — app is English-only',
    fix: 'Create src/i18n.ts with translations keyed by locale (en, es, fr, de). Export a t(key) helper.',
  })

  return { bonus: 0, info: null }
}

function checkHardcodedDateFormats(projectPath, issues) {
  const dirs = [join(projectPath, 'src'), join(projectPath, 'api')]
  let penalty = 0

  const hardcodedDatePatterns = [
    /['"`]MM\/DD\/YYYY['"`]/,
    /['"`]DD\/MM\/YYYY['"`]/,
    /['"`]YYYY-MM-DD['"`]/,
    /['"`]\d{1,2}\/\d{1,2}\/\d{4}['"`]/,
  ]

  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    const files = getAllFiles(dir, '.ts').concat(getAllFiles(dir, '.tsx'))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      for (const pattern of hardcodedDatePatterns) {
        if (pattern.test(content)) {
          issues.push({
            severity: 'medium',
            message: `Hardcoded date format string found in ${file.replace(projectPath, '')} — date formats are locale-specific`,
            file: file.replace(projectPath, ''),
            fix: "Use Intl.DateTimeFormat or date-fns format() with user locale instead of hardcoded date strings",
          })
          penalty += 10
          break
        }
      }
    }
  }

  return { penalty: Math.min(penalty, 20) }
}

function checkHardcodedCurrency(projectPath, issues) {
  const dirs = [join(projectPath, 'src'), join(projectPath, 'api')]
  let penalty = 0

  // Match hardcoded '$' inline in JSX/template strings (not in import paths or URLs)
  const currencyPattern = /['"`>]\$\d|>\s*\$\s*{|\$\s*\d+\.\d{2}/

  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    const files = getAllFiles(dir, '.tsx').concat(getAllFiles(dir, '.jsx'))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      if (currencyPattern.test(content)) {
        issues.push({
          severity: 'low',
          message: `Hardcoded '$' currency symbol found in ${file.replace(projectPath, '')} — currency symbols are locale-specific`,
          file: file.replace(projectPath, ''),
          fix: "Use Intl.NumberFormat with style:'currency', currency:'USD' or a t('price', {amount}) translation key",
        })
        penalty += 5
        break
      }
    }
  }

  return { penalty: Math.min(penalty, 10) }
}

function checkIntlApiUsage(projectPath, issues) {
  const dirs = [join(projectPath, 'src'), join(projectPath, 'api')]
  let hasIntl = false

  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    const files = getAllFiles(dir, '.ts').concat(getAllFiles(dir, '.tsx'))
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      if (/\bIntl\b/.test(content) || /\bnew\s+Intl\./.test(content)) {
        hasIntl = true
        break
      }
    }
    if (hasIntl) break
  }

  if (hasIntl) {
    return { bonus: 10, info: 'Intl API used (+10)' }
  }

  issues.push({
    severity: 'low',
    message: 'Intl API not found — consider using Intl.DateTimeFormat, Intl.NumberFormat for locale-aware formatting',
    fix: "Use new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(amount)",
  })

  return { bonus: 0, info: null }
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
