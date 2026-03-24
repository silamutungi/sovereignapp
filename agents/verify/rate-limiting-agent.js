// agents/verify/rate-limiting-agent.js
// Verifies all public API routes have checkRateLimit.
// Returns: { routes_checked: number, routes_protected: number, missing: string[] }

import { AgentBase } from '../../shared/agent-base-class.js'

// Utility/helper files that intentionally do not have rate limiting
const EXEMPT_PATTERNS = [
  /^api\/_/,        // underscore-prefixed helper files
  /^api\/migrations\//,
  /^api\/webhooks\//, // webhooks use their own signature verification
]

class RateLimitingAgent extends AgentBase {
  constructor() {
    super({ name: 'rate-limiting-agent', phase: 'verify', version: '1.0.0' })
  }

  async run(context) {
    const { generatedFiles, architectureSpec } = context

    if (!generatedFiles || typeof generatedFiles !== 'object') {
      throw new Error('rate-limiting-agent requires generatedFiles in context')
    }

    this.log('info', 'Verifying rate limiting on all public API routes')

    const publicRoutes = []
    const protected_routes = []
    const missing = []

    for (const [filename, content] of Object.entries(generatedFiles)) {
      // Only inspect API route files
      if (!filename.startsWith('api/') || !filename.endsWith('.ts')) continue

      // Skip exempt files
      if (EXEMPT_PATTERNS.some(p => p.test(filename))) {
        this.log('debug', `Skipping exempt file: ${filename}`)
        continue
      }

      publicRoutes.push(filename)

      // Check for rate limit import
      const hasImport = /import.*checkRateLimit/.test(content)
      // Check for rate limit call
      const hasCall = /checkRateLimit\s*\(/.test(content)
      // Check rate limit is early in the handler (before business logic)
      const callPosition = content.indexOf('checkRateLimit(')
      const firstAwait = content.indexOf('await ')
      const isFirstCheck = callPosition !== -1 && (firstAwait === -1 || callPosition < firstAwait + 200)

      if (!hasImport || !hasCall) {
        missing.push(filename)
        this.logIssue({
          severity: 'critical',
          message: `Public API route missing checkRateLimit`,
          file: filename,
        })
      } else if (!isFirstCheck) {
        // Rate limit exists but may not be the first check
        missing.push(filename)
        this.logIssue({
          severity: 'high',
          message: `checkRateLimit is not the first logic check — business logic may run before rate limit`,
          file: filename,
        })
      } else {
        protected_routes.push(filename)
      }

      // Also verify Retry-After header is set on 429
      if (hasCall && !content.includes('Retry-After')) {
        this.logIssue({
          severity: 'medium',
          message: `Route has checkRateLimit but missing Retry-After header on 429 response`,
          file: filename,
        })
      }
    }

    // Cross-check against architectureSpec expected routes
    if (architectureSpec?.api_routes) {
      for (const expectedRoute of architectureSpec.api_routes) {
        if (!publicRoutes.includes(expectedRoute) && !EXEMPT_PATTERNS.some(p => p.test(expectedRoute))) {
          this.logIssue({
            severity: 'medium',
            message: `Expected API route "${expectedRoute}" not found in generated files`,
            file: expectedRoute,
          })
        }
      }
    }

    const routes_checked = publicRoutes.length
    const routes_protected = protected_routes.length

    this.log('info', 'Rate limiting check complete', {
      routes_checked,
      routes_protected,
      missing: missing.length,
    })

    return { routes_checked, routes_protected, missing }
  }

  async verify(output) {
    if (output.missing.length > 0) {
      this.log('error', `${output.missing.length} public routes are unprotected by rate limiting`, {
        missing: output.missing,
      })
    }
    return output
  }

  async scoreOutput(output) {
    const protectionRate =
      output.routes_checked > 0
        ? Math.round((output.routes_protected / output.routes_checked) * 100)
        : 100

    return {
      dimension: 'rate_limiting',
      overall_score: protectionRate,
      routes_checked: output.routes_checked,
      routes_protected: output.routes_protected,
    }
  }
}

export default async function run(context) {
  return new RateLimitingAgent().execute(context)
}
