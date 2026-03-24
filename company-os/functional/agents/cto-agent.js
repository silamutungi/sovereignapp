// company-os/functional/agents/cto-agent.js — CTO technical architecture review agent
// Always unlocked.

import { AgentBase } from '../../../shared/agent-base-class.js'

const SECURITY_CHECKS = [
  { key: 'has_rls', label: 'Row-Level Security on all tables', weight: 15 },
  { key: 'has_https', label: 'HTTPS enforced everywhere', weight: 10 },
  { key: 'has_env_vars', label: 'Secrets in environment variables (not hardcoded)', weight: 15 },
  { key: 'has_input_validation', label: 'Server-side input validation', weight: 10 },
  { key: 'has_rate_limiting', label: 'Rate limiting on all API routes', weight: 10 },
  { key: 'has_auth_middleware', label: 'Auth validation on protected routes', weight: 15 },
  { key: 'has_csp_headers', label: 'Content Security Policy headers', weight: 10 },
  { key: 'no_url_parse', label: 'No deprecated url.parse() usage', weight: 5 },
  { key: 'has_soft_deletes', label: 'Soft deletes on user data tables', weight: 5 },
  { key: 'has_security_comments', label: 'Security audit comments on API routes', weight: 5 },
]

export class CTOAgent extends AgentBase {
  constructor() {
    super({ name: 'cto-agent', phase: 'architecture-review', version: '1.0.0' })
  }

  static isUnlocked(_context) {
    return true // Always unlocked
  }

  /**
   * @param {object} context
   * @param {string} [context.stack] — e.g. 'react-vite-supabase' | 'nextjs-postgres' | 'remix'
   * @param {string[]} [context.features]
   * @param {number} [context.user_count]
   * @param {boolean} [context.has_rls]
   * @param {boolean} [context.has_https]
   * @param {boolean} [context.has_env_vars]
   * @param {boolean} [context.has_input_validation]
   * @param {boolean} [context.has_rate_limiting]
   * @param {boolean} [context.has_auth_middleware]
   * @param {boolean} [context.has_csp_headers]
   * @param {boolean} [context.no_url_parse]
   * @param {boolean} [context.has_soft_deletes]
   * @param {boolean} [context.has_security_comments]
   * @param {string} [context.db_type] — 'supabase' | 'postgres' | 'mysql' | 'sqlite'
   * @param {string} [context.hosting] — 'vercel' | 'railway' | 'render' | 'aws'
   * @returns {{ debt_areas: string[], scaling_recommendations: string[], security_score: number, next_actions: string[] }}
   */
  async run(context) {
    this.log('info', 'Running technical architecture review', { stack: context.stack })

    const debt_areas = this._identifyDebtAreas(context)
    const scaling_recommendations = this._buildScalingRecommendations(context)
    const security_score = this._computeSecurityScore(context)
    const next_actions = this._buildNextActions(context, debt_areas, security_score)

    this.log('info', 'Architecture review complete', { security_score, debt_count: debt_areas.length })

    return {
      debt_areas,
      scaling_recommendations,
      security_score,
      next_actions,
    }
  }

  _computeSecurityScore(context) {
    let score = 0
    let total = 0
    for (const check of SECURITY_CHECKS) {
      total += check.weight
      if (context[check.key]) {
        score += check.weight
      }
    }
    return total > 0 ? Math.round((score / total) * 100) : 0
  }

  _identifyDebtAreas(context) {
    const debt = []

    if (!context.has_rls && context.db_type === 'supabase') {
      debt.push('Missing Row-Level Security on Supabase tables — direct client queries bypass auth entirely (CVE-class vulnerability)')
    }
    if (!context.has_input_validation) {
      debt.push('No server-side input validation — API endpoints accept arbitrary payloads')
    }
    if (!context.has_rate_limiting) {
      debt.push('No rate limiting — API routes are vulnerable to abuse and cost amplification attacks')
    }
    if (!context.has_auth_middleware) {
      debt.push('Protected routes lack auth middleware — unauthenticated users can access private data')
    }
    if (!context.has_csp_headers) {
      debt.push('Missing Content Security Policy headers — XSS attacks can exfiltrate user data')
    }
    if (!context.no_url_parse && context.no_url_parse !== undefined) {
      debt.push('Legacy url.parse() in use — replace with WHATWG URL API (new URL())')
    }
    if (!context.has_env_vars) {
      debt.push('Secrets may be hardcoded — all credentials must live in environment variables')
    }
    if (context.has_payments && !context.has_webhook_validation) {
      debt.push('Payment webhooks lack signature validation — replay attacks can trigger fake events')
    }
    if (context.user_count > 1000 && !context.has_indexes) {
      debt.push('No database indexes defined — query performance will degrade as user count grows')
    }
    if (context.user_count > 5000 && !context.has_caching) {
      debt.push('No caching layer — repeated expensive queries will bottleneck at scale')
    }
    if (!context.has_error_boundaries) {
      debt.push('No React Error Boundaries — unhandled errors crash the entire app instead of isolated components')
    }
    if (!context.has_loading_states) {
      debt.push('Missing loading states on async operations — users see blank UI during data fetches')
    }
    if (context.stack && context.stack.includes('vite') && !context.has_vite_env_dts) {
      debt.push('Missing src/vite-env.d.ts — tsc will fail with "Property env does not exist on type ImportMeta"')
    }

    return debt
  }

  _buildScalingRecommendations(context) {
    const recs = []
    const users = context.user_count ?? 0

    if (users < 100) {
      recs.push('Pre-100 users: focus on product-market fit, not infrastructure. Manual processes are acceptable.')
      recs.push('Add error monitoring (Sentry free tier) before first external users — silent failures are the biggest early-stage risk.')
    }

    if (users >= 100 && users < 1000) {
      recs.push('100–1000 users: add database indexes on high-frequency query columns (email, user_id, created_at).')
      recs.push('Introduce CDN caching for static assets — Vercel handles this automatically with proper Cache-Control headers.')
      recs.push('Set up uptime monitoring (Better Uptime or Vercel Analytics) before you have customers who notice downtime.')
    }

    if (users >= 1000 && users < 10000) {
      recs.push('1k–10k users: add connection pooling (PgBouncer / Supabase connection pooler) to prevent exhausting DB connections.')
      recs.push('Extract heavy background jobs (emails, exports, reports) to a queue (Inngest, Trigger.dev) rather than inline in API routes.')
      recs.push('Add read replicas or query caching (Redis/Upstash) for read-heavy endpoints.')
    }

    if (users >= 10000) {
      recs.push('10k+ users: consider edge functions for geographically distributed latency reduction.')
      recs.push('Introduce a dedicated data warehouse (BigQuery, Redshift) for analytics — never run reports against the production DB.')
      recs.push('Evaluate microservice extraction for high-load domains — but only after profiling proves a monolith bottleneck.')
    }

    if (context.hosting === 'vercel') {
      recs.push('Vercel serverless functions cold-start under 250ms for small bundles. Keep API route dependencies minimal — no heavy ORM imports.')
    }

    if (context.db_type === 'supabase') {
      recs.push('Use Supabase connection pooler (port 6543) for serverless functions — direct port 5432 exhausts connections at scale.')
    }

    if (context.stack && context.stack.includes('vite')) {
      recs.push('Enable Vite code splitting: dynamic import() for route components reduces initial bundle by 40–60%.')
    }

    return recs
  }

  _buildNextActions(context, debt_areas, security_score) {
    const actions = []

    if (security_score < 40) {
      actions.push('CRITICAL: Security score below 40. Address RLS, input validation, and auth middleware before any public launch.')
    } else if (security_score < 70) {
      actions.push('Add missing security controls: rate limiting, CSP headers, and server-side validation gaps.')
    } else if (security_score < 90) {
      actions.push('Security score is good. Add soft deletes and security audit comments to reach 90+.')
    } else {
      actions.push('Security posture is strong. Schedule quarterly security review as the codebase grows.')
    }

    if (!context.has_ci_cd) {
      actions.push('Set up CI/CD (GitHub Actions): lint + tsc + test on every PR. Blocks regressions before they reach production.')
    }

    if (!context.has_tests) {
      actions.push('Add integration tests for critical paths: auth flow, payment flow, and data mutation routes.')
    }

    if (debt_areas.length > 5) {
      actions.push(`${debt_areas.length} technical debt items identified. Allocate one sprint to address the top 3 before adding features.`)
    }

    if (!context.has_monitoring) {
      actions.push('Add application monitoring: Sentry for errors, Vercel Analytics for performance, and a health endpoint at /api/health.')
    }

    if (!context.has_backups && context.db_type === 'supabase') {
      actions.push('Enable Supabase PITR (Point-in-Time Recovery) for production databases before storing user data.')
    }

    if (actions.length === 0) {
      actions.push('Architecture is in good shape. Focus on performance profiling and adding observability as you scale.')
    }

    return actions
  }
}

export default CTOAgent
