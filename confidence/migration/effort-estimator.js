// confidence/migration/effort-estimator.js
// Estimates effort to fix issues by type and severity.

// Effort per severity level (hours)
const EFFORT_BY_SEVERITY = {
  critical: 4,
  high: 2,
  medium: 1,
  low: 0.5,
}

// Effort map for specific issue types
const EFFORT_BY_ISSUE_TYPE = {
  missing_rls: {
    hours: 0.5,
    description: 'Add RLS policies to one Supabase table (ALTER TABLE + CREATE POLICY)',
  },
  missing_rate_limit: {
    hours: 0.25,
    description: 'Add checkRateLimit to one API route',
  },
  missing_test: {
    hours: 1,
    description: 'Write unit tests for one component or utility',
  },
  accessibility_fix: {
    hours: 0.33,
    description: 'Fix one accessibility issue (contrast, aria label, semantic HTML)',
  },
  typescript_fix: {
    hours: 0.17,
    description: 'Fix one TypeScript error or add a missing type',
  },
  documentation: {
    hours: 0.5,
    description: 'Write or update documentation for one file (README, CLAUDE.md, inline)',
  },
  csp_header: {
    hours: 0.25,
    description: 'Add or correct a Content-Security-Policy header in vercel.json',
  },
  secret_exposure: {
    hours: 1,
    description: 'Move a secret from client-side code to a server-side API route',
  },
  input_validation: {
    hours: 0.5,
    description: 'Add input validation to one API route handler',
  },
  missing_env_example: {
    hours: 0.25,
    description: 'Create or update .env.example with required variable keys',
  },
  missing_error_boundary: {
    hours: 0.5,
    description: 'Add a React Error Boundary component',
  },
  missing_loading_state: {
    hours: 0.33,
    description: 'Add loading state UI to one async operation',
  },
  missing_empty_state: {
    hours: 0.33,
    description: 'Add empty state UI to one list or data view',
  },
  soft_delete: {
    hours: 0.5,
    description: 'Add deleted_at column and update queries for one table',
  },
  missing_index: {
    hours: 0.17,
    description: 'Add a database index to one frequently queried column',
  },
}

/**
 * Estimates total effort for a list of issues.
 *
 * @param {Array<{ severity: string, type?: string, message?: string }>} issues
 * @returns {{ total_hours: number, by_severity: object, by_dimension: object, breakdown: Array }}
 */
export function estimateEffort(issues) {
  let total_hours = 0
  const by_severity = { critical: 0, high: 0, medium: 0, low: 0 }
  const by_dimension = {}
  const breakdown = []

  for (const issue of issues) {
    const severity = issue.severity || 'medium'
    const issueType = issue.type || null
    const dimension = issue.dimension || 'general'

    // Use specific type hours if available, otherwise fall back to severity-based estimate
    let hours
    if (issueType && EFFORT_BY_ISSUE_TYPE[issueType]) {
      hours = EFFORT_BY_ISSUE_TYPE[issueType].hours
    } else {
      hours = EFFORT_BY_SEVERITY[severity] || 1
    }

    total_hours += hours
    by_severity[severity] = (by_severity[severity] || 0) + hours
    by_dimension[dimension] = (by_dimension[dimension] || 0) + hours

    breakdown.push({
      issue: issue.message || issue.type || 'Unknown issue',
      severity,
      dimension,
      hours,
      description: issueType ? (EFFORT_BY_ISSUE_TYPE[issueType]?.description || '') : `${severity} severity fix`,
    })
  }

  // Round to 1 decimal place
  total_hours = Math.round(total_hours * 10) / 10

  for (const key of Object.keys(by_severity)) {
    by_severity[key] = Math.round(by_severity[key] * 10) / 10
  }
  for (const key of Object.keys(by_dimension)) {
    by_dimension[key] = Math.round(by_dimension[key] * 10) / 10
  }

  return {
    total_hours,
    total_days: Math.round((total_hours / 6) * 10) / 10, // 6-hour productive day
    by_severity,
    by_dimension,
    breakdown,
  }
}

/**
 * Returns effort metadata for a specific issue type.
 *
 * @param {string} issueType — one of the keys in EFFORT_BY_ISSUE_TYPE
 * @returns {{ hours: number, description: string } | null}
 */
export function getEffortForIssueType(issueType) {
  return EFFORT_BY_ISSUE_TYPE[issueType] || null
}

/**
 * Returns the full effort map, useful for displaying estimates in UI.
 *
 * @returns {object}
 */
export function getEffortMap() {
  return { ...EFFORT_BY_ISSUE_TYPE }
}

/**
 * Returns the severity-based fallback effort map.
 *
 * @returns {object}
 */
export function getSeverityEffortMap() {
  return { ...EFFORT_BY_SEVERITY }
}
