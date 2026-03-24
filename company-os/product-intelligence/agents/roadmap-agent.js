// company-os/product-intelligence/agents/roadmap-agent.js
// Feature prioritization agent using RICE scoring framework.
//
// RICE: Reach × Impact × Confidence / Effort

import { AgentBase } from '../../../shared/agent-base-class.js'

export class RoadmapAgent extends AgentBase {
  constructor() {
    super({
      name: 'roadmap-agent',
      phase: 'product-intelligence',
      version: '1.0.0',
    })
  }

  /**
   * Run the roadmap agent.
   *
   * @param {object} context
   * @param {Array<RawFeature>} [context.features] — list of candidate features to score
   * @param {string} [context.app_type] — 'saas' | 'marketplace' | 'consumer' | 'ecommerce' | 'developer-tools'
   * @param {string} [context.stage] — 'pre-launch' | 'early' | 'growth' | 'scale'
   * @param {string[]} [context.strategic_goals] — current quarter goals (e.g. 'increase d7 retention', 'reduce churn')
   * @returns {{ prioritized_features: Feature[], next_sprint: string[], deferred: string[] }}
   */
  async run(context) {
    const {
      features = [],
      app_type = 'saas',
      stage = 'early',
      strategic_goals = [],
    } = context

    this.log('info', `Running roadmap prioritization for ${app_type} at ${stage} stage with ${features.length} features`)

    // Enrich and score features
    const scored = features.map(f => this.scoreFeature(f, app_type, stage, strategic_goals))

    // Sort by RICE score descending
    scored.sort((a, b) => b.rice_score - a.rice_score)

    // If no features provided, generate suggestions
    const prioritized_features = scored.length > 0
      ? scored
      : this.suggestFeatures(app_type, stage, strategic_goals)

    // Divide into next sprint vs deferred
    const sprint_threshold = this.getSprintThreshold(stage)
    const next_sprint = prioritized_features
      .filter(f => f.rice_score >= sprint_threshold && f.effort !== 'xl')
      .slice(0, 5)
      .map(f => f.title)

    const deferred = prioritized_features
      .filter(f => f.rice_score < sprint_threshold || f.effort === 'xl')
      .map(f => f.title)

    return {
      prioritized_features,
      next_sprint,
      deferred,
      scoring_method: 'RICE (Reach × Impact × Confidence / Effort)',
      sprint_threshold,
    }
  }

  scoreFeature(feature, app_type, stage, strategic_goals) {
    const {
      title,
      description = '',
      reach = 50,         // % of users affected per month
      impact = 2,         // 0.25, 0.5, 1, 2, 3 (massive)
      confidence = 80,    // % confidence in estimates
      effort = 'medium',  // person-weeks: xs=0.5, s=1, m=2, l=4, xl=8+
    } = feature

    const effortWeeks = this.effortToWeeks(effort)
    const rice_score = Math.round((reach * impact * (confidence / 100)) / effortWeeks)

    // Adjust for strategic alignment
    const strategic_boost = strategic_goals.some(goal =>
      (description + title).toLowerCase().includes(goal.toLowerCase())
    ) ? 1.2 : 1.0

    return {
      title,
      description,
      reach,
      impact,
      confidence,
      effort,
      effort_weeks: effortWeeks,
      rice_score: Math.round(rice_score * strategic_boost),
      strategic_aligned: strategic_boost > 1,
      priority: rice_score >= 100 ? 'critical' : rice_score >= 50 ? 'high' : rice_score >= 20 ? 'medium' : 'low',
    }
  }

  effortToWeeks(effort) {
    const map = { xs: 0.5, s: 1, m: 2, l: 4, xl: 8, medium: 2, small: 1, large: 4 }
    return map[effort?.toLowerCase()] || 2
  }

  getSprintThreshold(stage) {
    const thresholds = { 'pre-launch': 30, early: 20, growth: 15, scale: 10 }
    return thresholds[stage] || 20
  }

  suggestFeatures(app_type, stage, strategic_goals) {
    const suggestions = {
      saas: [
        { title: 'Onboarding checklist', description: 'In-app checklist guiding new users to activation', reach: 100, impact: 3, confidence: 90, effort: 's' },
        { title: 'Email digest', description: 'Weekly summary email of user activity to drive re-engagement', reach: 70, impact: 2, confidence: 85, effort: 's' },
        { title: 'CSV export', description: 'Export core data to CSV — common request from power users', reach: 40, impact: 1, confidence: 95, effort: 's' },
        { title: 'Team invites', description: 'Allow users to invite teammates to collaborate', reach: 60, impact: 3, confidence: 80, effort: 'm' },
        { title: 'API access', description: 'REST API for enterprise and power users', reach: 20, impact: 3, confidence: 70, effort: 'l' },
        { title: 'SSO / SAML', description: 'Enterprise SSO to unblock large company deals', reach: 10, impact: 3, confidence: 75, effort: 'xl' },
        { title: 'In-app search', description: 'Search across all user-created content', reach: 80, impact: 2, confidence: 85, effort: 'm' },
        { title: 'Audit log', description: 'Log all user actions for admin and compliance', reach: 30, impact: 2, confidence: 90, effort: 'm' },
      ],
      consumer: [
        { title: 'Push notifications', description: 'Re-engage users who have not opened the app in 48 hours', reach: 80, impact: 3, confidence: 75, effort: 'm' },
        { title: 'Social sharing', description: 'One-tap share output to Instagram, Twitter, WhatsApp', reach: 60, impact: 2, confidence: 80, effort: 's' },
        { title: 'Usage streak', description: 'Daily streak mechanic to create habit loop', reach: 100, impact: 3, confidence: 70, effort: 'm' },
        { title: 'Follow / friends', description: 'Social graph — follow other users and see their activity', reach: 70, impact: 3, confidence: 65, effort: 'l' },
        { title: 'Notification preferences', description: 'Let users control notification frequency and types', reach: 90, impact: 2, confidence: 95, effort: 's' },
      ],
      marketplace: [
        { title: 'Saved searches', description: 'Notify buyers when new listings match their saved search', reach: 60, impact: 3, confidence: 80, effort: 'm' },
        { title: 'Seller dashboard', description: 'Analytics for sellers — views, inquiries, conversion rate', reach: 40, impact: 2, confidence: 85, effort: 'm' },
        { title: 'Review system', description: 'Buyer and seller reviews with verified transaction badge', reach: 100, impact: 3, confidence: 90, effort: 'l' },
        { title: 'In-app messaging', description: 'Secure buyer/seller messaging with number masking', reach: 80, impact: 3, confidence: 85, effort: 'l' },
        { title: 'Promoted listings', description: 'Paid featured placement for sellers', reach: 30, impact: 2, confidence: 70, effort: 'm' },
      ],
      ecommerce: [
        { title: 'Cart abandonment email', description: '1h/24h/72h automated sequence for abandoned carts', reach: 70, impact: 3, confidence: 90, effort: 's' },
        { title: 'Product recommendations', description: 'Frequently bought together on product and cart pages', reach: 80, impact: 2, confidence: 85, effort: 'm' },
        { title: 'Review requests', description: 'Post-purchase email asking for review at D+7', reach: 100, impact: 2, confidence: 90, effort: 's' },
        { title: 'Wishlist', description: 'Save products for later — drives return visits and email targeting', reach: 50, impact: 2, confidence: 80, effort: 's' },
        { title: 'One-click reorder', description: 'Reorder from order history in one click', reach: 40, impact: 2, confidence: 85, effort: 's' },
      ],
      'developer-tools': [
        { title: 'CLI autocomplete', description: 'Tab autocomplete for all CLI commands and flags', reach: 90, impact: 2, confidence: 85, effort: 's' },
        { title: 'GitHub Action', description: 'Official GitHub Action for CI/CD integration', reach: 60, impact: 3, confidence: 90, effort: 'm' },
        { title: 'VS Code extension', description: 'VS Code integration for inline usage', reach: 70, impact: 3, confidence: 75, effort: 'l' },
        { title: 'Dashboard', description: 'Web dashboard for usage monitoring and configuration', reach: 40, impact: 2, confidence: 70, effort: 'xl' },
        { title: 'TypeScript types', description: 'Ship TypeScript types with the package', reach: 80, impact: 2, confidence: 95, effort: 's' },
      ],
    }

    const raw = suggestions[app_type] || suggestions.saas
    return raw
      .map(f => this.scoreFeature(f, app_type, stage, strategic_goals))
      .sort((a, b) => b.rice_score - a.rice_score)
  }

  async verify(output) {
    if (!Array.isArray(output.prioritized_features)) throw new Error('RoadmapAgent: prioritized_features must be an array')
    if (!Array.isArray(output.next_sprint)) throw new Error('RoadmapAgent: next_sprint must be an array')
    if (!Array.isArray(output.deferred)) throw new Error('RoadmapAgent: deferred must be an array')
    return output
  }
}

export default RoadmapAgent
