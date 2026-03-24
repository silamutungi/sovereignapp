// agents/elevation/insight-agent.js
import { AgentBase } from '../../shared/agent-base-class.js'

export class InsightAgent extends AgentBase {
  constructor() {
    super({ name: 'insight-agent', phase: 'elevation', version: '1.0.0' })
  }

  async run(context) {
    const { brief } = context
    this.log('info', 'Generating strategic insights from brief')

    const coreJob = this.identifyCoreJob(brief)
    const mvpFeatures = this.prioritizeForMVP(brief.features || [])
    const risks = this.identifyRisks(brief)
    const differentiators = this.findDifferentiators(brief)

    return {
      core_job_to_be_done: coreJob,
      mvp_features: mvpFeatures,
      deferred_features: (brief.features || []).filter(f => !mvpFeatures.includes(f)),
      risks: risks,
      differentiators: differentiators,
      first_principles_summary: `${brief.app_name} solves ${coreJob} for ${brief.target_user}.`,
    }
  }

  identifyCoreJob(brief) {
    return `${brief.problem_statement?.slice(0, 100) || 'manage ' + (brief.features?.[0] || 'tasks')} efficiently`
  }

  prioritizeForMVP(features) {
    // Ship the fewest features that deliver the core job
    return features.slice(0, 3)
  }

  identifyRisks(brief) {
    const risks = []
    if (brief.complexity === 'COMPLEX') {
      risks.push({
        risk: 'Build complexity may extend timeline',
        mitigation: 'Ship MVP, iterate based on user feedback',
      })
    }
    if (brief.tech_requirements?.includes('Stripe')) {
      risks.push({
        risk: 'Payment integration adds compliance burden',
        mitigation: 'Start with free tier, add billing in phase 2',
      })
    }
    if (brief.tech_requirements?.includes('Supabase Auth')) {
      risks.push({
        risk: 'Auth flows require careful UX design to avoid drop-off',
        mitigation: 'Magic link over password — lower friction, higher conversion',
      })
    }
    return risks
  }

  findDifferentiators(brief) {
    return [
      `Designed specifically for ${brief.target_user}`,
      'Built and deployed in minutes, not months',
      'Production-grade security and accessibility from day one',
    ]
  }
}

export default async function run(context) {
  return new InsightAgent().execute(context)
}
