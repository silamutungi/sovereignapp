// agents/intake/discovery-agent.js
import { AgentBase } from '../../shared/agent-base-class.js'

export class DiscoveryAgent extends AgentBase {
  constructor() {
    super({ name: 'discovery-agent', phase: 'intake', version: '1.0.0' })
  }

  async run(context) {
    const { idea } = context
    this.log('info', 'Analyzing idea for complexity and tier')
    this.loadSovereignRules()

    // Extract core elements
    const complexity = this.classifyComplexity(idea)
    const features = this.extractFeatures(idea)
    const targetUser = this.inferTargetUser(idea)
    const appName = this.suggestName(idea)
    const techRequirements = this.inferTechRequirements(idea, features)
    const activeTiers = this.determineTiers(complexity, features)

    const brief = {
      app_name: appName,
      problem_statement: this.extractProblem(idea),
      target_user: targetUser,
      features: features,
      complexity: complexity,
      tech_requirements: techRequirements,
      active_tiers: activeTiers,
      confidence: 0.85,
    }

    await this.recordPattern({
      name: 'idea-to-brief extraction',
      description: `Successfully extracted brief for ${complexity} app`,
      when_to_use: 'When analyzing user ideas before generation',
      tags: ['intake', 'extraction'],
    })

    return brief
  }

  classifyComplexity(idea) {
    const wordCount = idea.split(/\s+/).length
    const complexKeywords = [
      'payment', 'auth', 'stripe', 'subscription', 'api', 'real-time',
      'webhook', 'oauth', 'dashboard', 'analytics',
    ]
    const complexCount = complexKeywords.filter(k => idea.toLowerCase().includes(k)).length
    if (complexCount >= 3 || wordCount > 150) return 'COMPLEX'
    if (complexCount >= 1 || wordCount > 50) return 'STANDARD'
    return 'SIMPLE'
  }

  extractFeatures(idea) {
    const featurePatterns = [
      /user (can|should|will) ([^.]+)/gi,
      /ability to ([^.]+)/gi,
      /feature[s]?:? ([^.]+)/gi,
    ]
    const features = []
    for (const pattern of featurePatterns) {
      const matches = [...idea.matchAll(pattern)]
      for (const match of matches) {
        const feature = (match[2] || match[1]).trim().slice(0, 80)
        if (feature && !features.includes(feature)) features.push(feature)
      }
    }
    if (features.length === 0) {
      // Fallback: extract noun phrases
      const words = idea.split(/\s+/).slice(0, 50)
      features.push(words.slice(0, 10).join(' '))
    }
    return features.slice(0, 8)
  }

  inferTargetUser(idea) {
    const userKeywords = {
      'small business': 'small business owners',
      'freelancer': 'freelancers',
      'team': 'teams',
      'developer': 'developers',
      'student': 'students',
      'creator': 'content creators',
    }
    for (const [k, v] of Object.entries(userKeywords)) {
      if (idea.toLowerCase().includes(k)) return v
    }
    return 'individuals and teams'
  }

  suggestName(idea) {
    const words = idea
      .split(/\s+/)
      .filter(w => w.length > 4 && !/^(with|that|this|have|will|your|from|they|when|also)$/i.test(w))
    const base = words[0] || 'App'
    const suffixes = ['Hub', 'Flow', 'Pro', 'Base', 'Stack', 'Space']
    return (
      base.charAt(0).toUpperCase() +
      base.slice(1).toLowerCase() +
      suffixes[Math.floor(Math.random() * suffixes.length)]
    )
  }

  extractProblem(idea) {
    const sentences = idea.split(/[.!?]/).filter(s => s.trim().length > 20)
    return sentences[0]?.trim() || idea.slice(0, 100)
  }

  inferTechRequirements(idea, _features) {
    const reqs = ['React', 'TypeScript', 'Vite', 'Tailwind CSS']
    if (idea.toLowerCase().includes('auth') || idea.toLowerCase().includes('login'))
      reqs.push('Supabase Auth')
    if (idea.toLowerCase().includes('data') || idea.toLowerCase().includes('database'))
      reqs.push('Supabase Database')
    if (idea.toLowerCase().includes('payment') || idea.toLowerCase().includes('stripe'))
      reqs.push('Stripe')
    if (idea.toLowerCase().includes('email'))
      reqs.push('Resend')
    return reqs
  }

  determineTiers(complexity, _features) {
    const tiers = ['tier1'] // always active
    if (complexity !== 'SIMPLE') tiers.push('tier2')
    if (complexity === 'COMPLEX') tiers.push('tier3')
    return tiers
  }
}

export default async function run(context) {
  const agent = new DiscoveryAgent()
  return agent.execute(context)
}
