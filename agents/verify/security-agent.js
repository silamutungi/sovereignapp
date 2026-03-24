// agents/verify/security-agent.js
// Wraps the confidence/engine/evaluators/security-evaluator.js.
// Runs security evaluation and produces SecurityReport.
// Returns: { score: number, issues: Issue[], passed: boolean }

import { AgentBase } from '../../shared/agent-base-class.js'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '../..')

class SecurityAgent extends AgentBase {
  constructor() {
    super({ name: 'security-agent', phase: 'verify', version: '1.0.0' })
  }

  async run(context) {
    const { generatedFiles, projectPath } = context

    this.log('info', 'Running security evaluation')

    // Load the security evaluator
    let evaluator
    try {
      const mod = await import(`${ROOT}/confidence/engine/evaluators/security-evaluator.js`)
      evaluator = mod
    } catch (err) {
      this.log('warn', 'Could not load security evaluator — using built-in checks', {
        error: err.message,
      })
      evaluator = null
    }

    let score = 100
    let issues = []
    let passed = true

    if (evaluator && projectPath) {
      // Use the evaluator against a real project path
      try {
        const result = evaluator.evaluate(projectPath)
        score = result.score
        issues = result.issues
        passed = result.passed

        this.log('info', 'Security evaluator result', {
          score,
          issues: issues.length,
          passed,
        })
      } catch (err) {
        this.log('warn', 'Security evaluator threw — falling back to built-in checks', {
          error: err.message,
        })
      }
    }

    // Always run built-in checks on the raw file content as well
    if (generatedFiles) {
      const builtInResult = this._runBuiltInChecks(generatedFiles)
      issues = this._mergeIssues(issues, builtInResult.issues)
      // Recalculate score with combined issues
      const criticalCount = issues.filter(i => i.severity === 'critical').length
      const highCount = issues.filter(i => i.severity === 'high').length
      const mediumCount = issues.filter(i => i.severity === 'medium').length
      const penalty = criticalCount * 20 + highCount * 10 + mediumCount * 5
      score = Math.max(0, Math.min(100, score - penalty + builtInResult.bonusPoints))
      passed = criticalCount === 0 && score >= 75
    }

    for (const issue of issues) {
      this.logIssue(issue)
    }

    return { score, issues, passed }
  }

  _runBuiltInChecks(generatedFiles) {
    const issues = []
    let bonusPoints = 0

    for (const [filename, content] of Object.entries(generatedFiles)) {
      if (typeof content !== 'string') continue

      // Check: no secrets hardcoded in source
      const secretPatterns = [
        { pattern: /sk-[a-zA-Z0-9]{32,}/g, label: 'OpenAI API key' },
        { pattern: /eyJ[a-zA-Z0-9_-]{20,}/g, label: 'JWT token' },
        { pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"]\S+['"]/g, label: 'Supabase service role key' },
      ]
      for (const { pattern, label } of secretPatterns) {
        if (pattern.test(content)) {
          issues.push({
            severity: 'critical',
            message: `Possible ${label} hardcoded in source`,
            file: filename,
          })
        }
        pattern.lastIndex = 0
      }

      // Check: no eval() usage
      if (/\beval\s*\(/.test(content)) {
        issues.push({ severity: 'critical', message: 'eval() usage detected', file: filename })
      }

      // Check: no url.parse() — must use WHATWG URL API
      if (/url\.parse\s*\(/.test(content) || /require\(['"]url['"]\)/.test(content)) {
        issues.push({
          severity: 'high',
          message: 'url.parse() detected — use new URL() instead',
          file: filename,
        })
      }

      // Check: API routes have checkRateLimit
      if (filename.startsWith('api/') && !filename.split('/').pop().startsWith('_')) {
        if (!content.includes('checkRateLimit')) {
          issues.push({
            severity: 'critical',
            message: 'API route missing checkRateLimit',
            file: filename,
          })
        } else {
          bonusPoints += 2
        }
      }

      // Check: no process.env values logged
      if (/console\.(log|info|debug)\s*\([^)]*process\.env/.test(content)) {
        issues.push({
          severity: 'critical',
          message: 'process.env value being logged — secrets exposure risk',
          file: filename,
        })
      }

      // Check: CSP in vercel.json
      if (filename === 'vercel.json') {
        if (!content.includes('connect-src')) {
          issues.push({
            severity: 'high',
            message: 'vercel.json CSP missing connect-src — all Supabase calls will be blocked',
            file: filename,
          })
        } else {
          bonusPoints += 5
        }
        if (!content.includes('Content-Security-Policy')) {
          issues.push({
            severity: 'high',
            message: 'vercel.json missing Content-Security-Policy header',
            file: filename,
          })
        }
      }
    }

    return { issues, bonusPoints }
  }

  _mergeIssues(existing, incoming) {
    const seen = new Set(existing.map(i => `${i.file}:${i.message}`))
    const merged = [...existing]
    for (const issue of incoming) {
      const key = `${issue.file}:${issue.message}`
      if (!seen.has(key)) {
        merged.push(issue)
        seen.add(key)
      }
    }
    return merged
  }

  async scoreOutput(output) {
    return {
      dimension: 'security',
      overall_score: output.score,
      passed: output.passed,
      issues: output.issues.length,
    }
  }
}

export default async function run(context) {
  return new SecurityAgent().execute(context)
}
