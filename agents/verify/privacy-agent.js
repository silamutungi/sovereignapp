// agents/verify/privacy-agent.js
// Checks GDPR patterns: consent, data retention, deletion rights.
// Returns: { score: number, gdpr_compliant: boolean, issues: Issue[] }

import { AgentBase } from '../../shared/agent-base-class.js'

// GDPR requirement checks
const GDPR_CHECKS = [
  {
    id: 'consent_ui',
    description: 'Cookie/tracking consent UI present',
    pattern: /consent|cookie(-|\s)banner|gdpr|CookieBanner/i,
    files: ['src'],
    severity: 'high',
    weight: 15,
  },
  {
    id: 'privacy_policy_link',
    description: 'Privacy policy link in footer or navigation',
    pattern: /privacy(-|\s)policy|\/privacy/i,
    files: ['src/components/Footer.tsx', 'src/components/Navbar.tsx'],
    severity: 'medium',
    weight: 10,
  },
  {
    id: 'terms_link',
    description: 'Terms of service link present',
    pattern: /terms(-|\s)(of(-|\s)service|and(-|\s)conditions)|\/terms/i,
    files: ['src/components/Footer.tsx'],
    severity: 'low',
    weight: 5,
  },
  {
    id: 'soft_deletes',
    description: 'Soft delete pattern (deleted_at column) for data retention',
    pattern: /deleted_at/i,
    files: ['api', 'src/types/index.ts'],
    severity: 'high',
    weight: 20,
  },
  {
    id: 'no_pii_in_logs',
    description: 'No PII (email, name) in console.log calls',
    pattern: /console\.(log|info|debug)\s*\([^)]*(?:email|password|name|phone)/i,
    negate: true,
    files: ['api', 'src'],
    severity: 'critical',
    weight: 25,
  },
  {
    id: 'session_storage_not_local',
    description: 'Auth state uses sessionStorage, not localStorage',
    pattern: /localStorage\.setItem\s*\([^)]*(?:token|user|auth|session)/i,
    negate: true,
    files: ['src'],
    severity: 'high',
    weight: 15,
  },
  {
    id: 'data_minimisation',
    description: 'SELECT queries do not use SELECT * (data minimisation)',
    pattern: /\.select\s*\(\s*['"]\*['"]\s*\)/i,
    negate: true,
    files: ['api', 'src'],
    severity: 'medium',
    weight: 10,
  },
]

class PrivacyAgent extends AgentBase {
  constructor() {
    super({ name: 'privacy-agent', phase: 'verify', version: '1.0.0' })
  }

  async run(context) {
    const { generatedFiles } = context

    if (!generatedFiles || typeof generatedFiles !== 'object') {
      throw new Error('privacy-agent requires generatedFiles in context')
    }

    this.log('info', 'Running GDPR/privacy compliance check', {
      files: Object.keys(generatedFiles).length,
    })

    const issues = []
    let score = 100
    let totalWeight = 0

    for (const check of GDPR_CHECKS) {
      totalWeight += check.weight
      const result = this._runCheck(check, generatedFiles)

      if (!result.passed) {
        score -= check.weight
        const issue = {
          severity: check.severity,
          message: `GDPR check failed: ${check.description}`,
          file: result.failedFile || check.files.join(', '),
          check_id: check.id,
        }
        issues.push(issue)
        this.logIssue(issue)
      }
    }

    score = Math.max(0, score)
    const gdpr_compliant = score >= 70 && issues.filter(i => i.severity === 'critical').length === 0

    this.log('info', 'Privacy check complete', {
      score,
      gdpr_compliant,
      issues: issues.length,
    })

    return { score, gdpr_compliant, issues }
  }

  _runCheck(check, generatedFiles) {
    const { pattern, negate, files } = check

    // Find relevant files
    const matchingFiles = Object.entries(generatedFiles).filter(([filename]) =>
      files.some(prefix => filename.startsWith(prefix) || filename === prefix)
    )

    if (matchingFiles.length === 0) {
      // No files to check — treat as not-found (fail for positive checks, pass for negate)
      if (negate) return { passed: true }
      return { passed: false, failedFile: files.join(', ') }
    }

    for (const [filename, content] of matchingFiles) {
      if (typeof content !== 'string') continue

      const found = pattern.test(content)
      pattern.lastIndex = 0

      if (negate && found) {
        // negate check: pattern must NOT be found
        return { passed: false, failedFile: filename }
      }
      if (!negate && found) {
        // positive check: pattern must be found
        return { passed: true }
      }
    }

    // If negate, not finding it anywhere = pass
    if (negate) return { passed: true }
    // Positive check not found in any file = fail
    return { passed: false, failedFile: files.join(', ') }
  }

  async scoreOutput(output) {
    return {
      dimension: 'privacy',
      overall_score: output.score,
      gdpr_compliant: output.gdpr_compliant,
      issues: output.issues.length,
    }
  }
}

export default async function run(context) {
  return new PrivacyAgent().execute(context)
}
