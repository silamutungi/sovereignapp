// agents/build/error-handling-agent.js
// Takes all generated code context. Checks for missing try/catch and error states.
// Produces error handling report and patched files.
// Returns: { issues_found: Issue[], patches_applied: number }

import { AgentBase } from '../../shared/agent-base-class.js'

// Patterns indicating async operations without error handling
const ASYNC_WITHOUT_CATCH = /await\s+\w+\s*\(/g
const HAS_TRY_CATCH = /try\s*\{[\s\S]*?\}\s*catch/g

// API call patterns that require error handling
const FETCH_PATTERN = /\bfetch\s*\(/g
const SUPABASE_PATTERN = /\.from\s*\(['"][^'"]+['"]\)/g
const ASYNC_FN_PATTERN = /async\s+(?:function\s+\w+|\(\s*\w*\s*\)\s*=>|\w+\s*=>)/g

// UI error state requirements — every async operation needs an error message display
const LOADING_STATE = /\[is(?:Loading|Fetching|Submitting)\]/g
const ERROR_STATE = /\b(?:error|errorMessage|errorText)\b/g

// React Error Boundary import check
const ERROR_BOUNDARY_IMPORT = /ErrorBoundary/g

class ErrorHandlingAgent extends AgentBase {
  constructor() {
    super({ name: 'error-handling-agent', phase: 'build', version: '1.0.0' })
  }

  async run(context) {
    const { generatedFiles } = context

    if (!generatedFiles || typeof generatedFiles !== 'object') {
      throw new Error('error-handling-agent requires generatedFiles in context')
    }

    this.log('info', 'Scanning generated files for error handling gaps', {
      total_files: Object.keys(generatedFiles).length,
    })

    const issues_found = []
    const patched_files = {}
    let patches_applied = 0

    for (const [filename, content] of Object.entries(generatedFiles)) {
      if (typeof content !== 'string') {
        patched_files[filename] = content
        continue
      }

      const fileIssues = []

      // Check API route files for missing try/catch
      if (filename.startsWith('api/')) {
        const apiIssues = this._checkApiErrorHandling(content, filename)
        fileIssues.push(...apiIssues)
      }

      // Check frontend TSX files for missing error states
      if (filename.endsWith('.tsx') || filename.endsWith('.ts')) {
        const frontendIssues = this._checkFrontendErrorHandling(content, filename)
        fileIssues.push(...frontendIssues)
      }

      issues_found.push(...fileIssues)

      // Patch API files: wrap bare async calls in try/catch
      let patched = content
      if (filename.startsWith('api/') && fileIssues.some(i => i.type === 'missing_try_catch')) {
        patched = this._patchApiTryCatch(content, filename)
        if (patched !== content) patches_applied++
      }

      patched_files[filename] = patched
    }

    // Verify main.tsx has ErrorBoundary
    const mainTsx = generatedFiles['src/main.tsx'] || ''
    if (!ERROR_BOUNDARY_IMPORT.test(mainTsx)) {
      issues_found.push({
        severity: 'high',
        type: 'missing_error_boundary',
        message: 'src/main.tsx does not wrap the app in an ErrorBoundary',
        file: 'src/main.tsx',
      })
    }
    ERROR_BOUNDARY_IMPORT.lastIndex = 0

    this.log('info', 'Error handling scan complete', {
      issues_found: issues_found.length,
      patches_applied,
    })

    for (const issue of issues_found) {
      this.logIssue(issue)
    }

    return { issues_found, patches_applied, patched_files }
  }

  _checkApiErrorHandling(content, filename) {
    const issues = []

    // Count await calls
    const awaitMatches = content.match(ASYNC_WITHOUT_CATCH) || []
    const hasTryCatch = HAS_TRY_CATCH.test(content)
    HAS_TRY_CATCH.lastIndex = 0

    if (awaitMatches.length > 0 && !hasTryCatch) {
      issues.push({
        severity: 'critical',
        type: 'missing_try_catch',
        message: `${awaitMatches.length} await call(s) with no try/catch block`,
        file: filename,
      })
    }

    // Check for bare Supabase calls without error destructuring
    const supabaseMatches = content.match(SUPABASE_PATTERN) || []
    if (supabaseMatches.length > 0 && !content.includes('{ error }') && !content.includes('{ data, error }')) {
      issues.push({
        severity: 'high',
        type: 'supabase_error_unhandled',
        message: 'Supabase query results not destructuring error — silent failures possible',
        file: filename,
      })
    }
    SUPABASE_PATTERN.lastIndex = 0

    // Check for missing catch logging
    if (hasTryCatch && !content.includes('console.error') && !content.includes('logger.error')) {
      issues.push({
        severity: 'medium',
        type: 'missing_error_logging',
        message: 'try/catch block found but no error logging — add console.error(err) in catch',
        file: filename,
      })
    }

    return issues
  }

  _checkFrontendErrorHandling(content, filename) {
    const issues = []

    // Check for fetch/async calls without error state
    const hasFetch = FETCH_PATTERN.test(content)
    FETCH_PATTERN.lastIndex = 0
    const hasSupabase = SUPABASE_PATTERN.test(content)
    SUPABASE_PATTERN.lastIndex = 0

    if ((hasFetch || hasSupabase) && !ERROR_STATE.test(content)) {
      ERROR_STATE.lastIndex = 0
      issues.push({
        severity: 'high',
        type: 'missing_ui_error_state',
        message: 'Component makes async calls but has no error state variable',
        file: filename,
      })
    }
    ERROR_STATE.lastIndex = 0

    // Check for loading state
    if ((hasFetch || hasSupabase) && !LOADING_STATE.test(content)) {
      LOADING_STATE.lastIndex = 0
      if (!content.includes('isLoading') && !content.includes('loading')) {
        issues.push({
          severity: 'medium',
          type: 'missing_loading_state',
          message: 'Component makes async calls but has no loading state — users see no feedback',
          file: filename,
        })
      }
    }
    LOADING_STATE.lastIndex = 0

    return issues
  }

  _patchApiTryCatch(content, filename) {
    // Wrap the entire handler body in try/catch if missing
    if (HAS_TRY_CATCH.test(content)) {
      HAS_TRY_CATCH.lastIndex = 0
      return content
    }
    HAS_TRY_CATCH.lastIndex = 0

    this.log('debug', `Patching missing try/catch in ${filename}`)

    // Heuristic: wrap content between the first opening brace and matching close of default export
    return content.replace(
      /(export default async function\s+\w+\s*\([^)]*\)\s*\{)\n([\s\S]*?)(\n\})/,
      (_, open, body, close) => {
        const indented = body
          .split('\n')
          .map(l => '  ' + l)
          .join('\n')
        return `${open}\n  try {\n${indented}\n  } catch (err) {\n    console.error('[${filename}]', err)\n    return res.status(500).json({ error: 'Internal server error' })\n  }${close}`
      }
    )
  }

  async verify(output) {
    const criticalCount = output.issues_found.filter(i => i.severity === 'critical').length
    if (criticalCount > 0) {
      this.log('warn', `${criticalCount} critical error handling issues remain after patching`)
    }
    return output
  }
}

export default async function run(context) {
  return new ErrorHandlingAgent().execute(context)
}
