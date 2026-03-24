// company-os/product-intelligence/agents/analytics-agent.js
// Analytics setup recommendation agent — checks what is configured and what events to track.

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { AgentBase } from '../../../shared/agent-base-class.js'

const ANALYTICS_PROVIDERS = ['posthog', 'mixpanel', 'amplitude', 'segment', 'heap', 'plausible', 'fathom']

export class AnalyticsAgent extends AgentBase {
  constructor() {
    super({
      name: 'analytics-agent',
      phase: 'product-intelligence',
      version: '1.0.0',
    })
  }

  /**
   * Run the analytics agent.
   *
   * @param {object} context
   * @param {string} [context.project_path] — path to project directory
   * @param {string} [context.app_type] — 'saas' | 'marketplace' | 'consumer' | 'ecommerce' | 'developer-tools'
   * @param {string[]} [context.features] — list of app features (auth, payments, dashboard, etc.)
   * @returns {{ configured: boolean, recommended_events: string[], funnel: object, recommendations: string[] }}
   */
  async run(context) {
    const {
      project_path = null,
      app_type = 'saas',
      features = [],
    } = context

    this.log('info', `Running analytics audit for ${app_type} app`)

    let configured = false
    let detected_provider = null
    const setup_issues = []

    if (project_path) {
      const detection = this.detectAnalyticsSetup(project_path)
      configured = detection.configured
      detected_provider = detection.provider
      setup_issues.push(...detection.issues)
    }

    const recommended_events = this.buildRecommendedEvents(app_type, features)
    const funnel = this.buildFunnelDefinition(app_type, features)
    const recommendations = this.buildRecommendations(configured, detected_provider, app_type, setup_issues)

    return {
      configured,
      detected_provider,
      recommended_events,
      funnel,
      recommendations,
      setup_issues,
    }
  }

  detectAnalyticsSetup(projectPath) {
    const issues = []
    let configured = false
    let provider = null

    // Check package.json for analytics libraries
    const pkgPath = join(projectPath, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
        for (const p of ANALYTICS_PROVIDERS) {
          if (Object.keys(allDeps).some(dep => dep.includes(p))) {
            configured = true
            provider = p
            break
          }
        }
      } catch { /* ignore */ }
    }

    // Check src/ for analytics initialization calls
    const srcDir = join(projectPath, 'src')
    if (existsSync(srcDir) && !configured) {
      const filesToCheck = [
        join(srcDir, 'main.tsx'),
        join(srcDir, 'main.ts'),
        join(srcDir, 'index.tsx'),
        join(srcDir, 'App.tsx'),
      ]
      for (const f of filesToCheck) {
        if (!existsSync(f)) continue
        const content = readFileSync(f, 'utf-8')
        for (const p of ANALYTICS_PROVIDERS) {
          if (content.toLowerCase().includes(p)) {
            configured = true
            provider = p
            break
          }
        }
        if (configured) break
      }
    }

    // Check .env.example for analytics keys
    const envExamplePath = join(projectPath, '.env.example')
    if (existsSync(envExamplePath)) {
      const content = readFileSync(envExamplePath, 'utf-8')
      for (const p of ANALYTICS_PROVIDERS) {
        if (content.toUpperCase().includes(p.toUpperCase())) {
          configured = true
          provider = provider || p
          break
        }
      }
    }

    if (!configured) {
      issues.push('No analytics library detected — add PostHog or Mixpanel to track user behavior')
    }

    return { configured, provider, issues }
  }

  buildRecommendedEvents(app_type, features) {
    const baseEvents = [
      'page_viewed — every route change',
      'session_started — user opens the app',
      'error_occurred — any caught error with message and source',
    ]

    const authEvents = [
      'signup_started — user begins registration',
      'signup_completed — user successfully created account',
      'login_succeeded — user authenticated',
      'login_failed — authentication failed (log reason, not credentials)',
      'password_reset_requested',
    ]

    const billingEvents = [
      'upgrade_clicked — user clicked upgrade CTA (record which plan)',
      'checkout_started — user entered checkout flow',
      'subscription_created — successful payment',
      'subscription_cancelled — record cancellation reason if collected',
      'payment_failed — record decline reason from payment processor',
    ]

    const typeEvents = {
      saas: [
        'feature_used — user performed a core app action (record feature name)',
        'project_created — user created a new workspace or project',
        'invite_sent — user invited a team member',
        'export_completed — user exported data',
        'integration_connected — user connected a third-party integration',
      ],
      marketplace: [
        'listing_viewed — user viewed a product or service listing',
        'search_performed — user searched (record query, result count)',
        'transaction_initiated — buyer clicked "Buy" or "Book"',
        'transaction_completed — payment confirmed',
        'review_submitted — user left a review',
        'seller_onboarded — new seller completed setup',
      ],
      consumer: [
        'content_viewed — user viewed a piece of content',
        'content_created — user posted or created content',
        'share_triggered — user shared content externally',
        'follow_action — user followed another user',
        'notification_tapped — user opened a push notification',
      ],
      ecommerce: [
        'product_viewed — user viewed a product page',
        'cart_item_added — product added to cart',
        'cart_abandoned — user left with items in cart (trigger recovery)',
        'checkout_started',
        'purchase_completed — record order value, product IDs, payment method',
        'return_requested',
      ],
      'developer-tools': [
        'install_completed — user ran install command',
        'first_successful_use — user completed core task for the first time (magic moment)',
        'documentation_page_viewed',
        'error_encountered — record error code and context',
        'api_call_made — for SDK tracking',
        'upgrade_to_paid — OSS to commercial conversion',
      ],
    }

    const events = [...baseEvents]

    const hasAuth = features.includes('auth') || features.includes('login') || features.includes('signup')
    const hasBilling = features.includes('billing') || features.includes('payments') || features.includes('stripe')

    if (hasAuth) events.push(...authEvents)
    if (hasBilling) events.push(...billingEvents)
    events.push(...(typeEvents[app_type] || typeEvents.saas))

    return events
  }

  buildFunnelDefinition(app_type, features) {
    const funnels = {
      saas: {
        acquisition: ['landing_page_visited', 'signup_started', 'signup_completed'],
        activation: ['first_login', 'project_created', 'feature_used_first_time'],
        retention: ['day_1_return', 'day_7_return', 'day_30_return'],
        revenue: ['upgrade_clicked', 'checkout_started', 'subscription_created'],
        referral: ['invite_sent', 'invite_accepted'],
      },
      ecommerce: {
        discovery: ['landing_page_visited', 'search_performed', 'product_viewed'],
        consideration: ['cart_item_added', 'checkout_started'],
        conversion: ['payment_info_entered', 'purchase_completed'],
        retention: ['order_delivered', 'review_submitted', 'repeat_purchase'],
      },
      marketplace: {
        supply_acquisition: ['seller_signup', 'first_listing_created', 'listing_published'],
        demand_acquisition: ['buyer_signup', 'first_search', 'first_listing_viewed'],
        transaction: ['contact_initiated', 'offer_made', 'transaction_completed'],
        retention: ['repeat_transaction', 'review_submitted'],
      },
      consumer: {
        acquisition: ['install', 'signup'],
        activation: ['first_session', 'magic_moment_reached'],
        habit: ['day_1_return', 'day_7_return', 'day_30_return'],
        viral: ['share_triggered', 'friend_joined_from_share'],
      },
      'developer-tools': {
        discovery: ['github_star', 'docs_visited', 'npm_install'],
        activation: ['first_successful_use', 'first_project_created'],
        adoption: ['daily_use_day_7', 'integration_added'],
        revenue: ['upgrade_to_paid', 'team_seat_added'],
      },
    }

    return funnels[app_type] || funnels.saas
  }

  buildRecommendations(configured, provider, app_type, issues) {
    const recs = []

    if (!configured) {
      recs.push('Install PostHog (npm install posthog-js) — self-hostable, generous free tier, built-in session recording.')
      recs.push('Add posthog.init() in src/main.tsx before ReactDOM.createRoot() — captures all pageviews automatically.')
    } else {
      recs.push(`${provider} is configured — verify it is initializing before the first page render.`)
    }

    recs.push('Identify your activation event (the first action that predicts long-term retention) and track it explicitly.')
    recs.push('Create a retention cohort in your analytics tool: users who completed activation event, grouped by week.')
    recs.push('Set up a funnel for your core conversion path — this shows exactly where users drop off.')

    if (app_type === 'saas') {
      recs.push('Track feature_used with feature_name property — this shows which features drive retention.')
    }

    return recs
  }

  async verify(output) {
    if (typeof output.configured !== 'boolean') throw new Error('AnalyticsAgent: configured must be a boolean')
    if (!Array.isArray(output.recommended_events)) throw new Error('AnalyticsAgent: recommended_events must be an array')
    if (typeof output.funnel !== 'object') throw new Error('AnalyticsAgent: funnel must be an object')
    return output
  }
}

export default AnalyticsAgent
