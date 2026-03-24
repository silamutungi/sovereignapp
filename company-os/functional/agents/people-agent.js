// company-os/functional/agents/people-agent.js — Hiring and team recommendations agent
// UNLOCKS: when team_size > 1

import { AgentBase } from '../../../shared/agent-base-class.js'

export class PeopleAgent extends AgentBase {
  constructor() {
    super({ name: 'people-agent', phase: 'people-strategy', version: '1.0.0' })
  }

  static isUnlocked(context) {
    return context.team_size != null && context.team_size > 1
  }

  /**
   * @param {object} context
   * @param {number} [context.team_size]
   * @param {string[]} [context.current_roles] — e.g. ['founder', 'cto', 'designer']
   * @param {string} [context.stage] — 'pre-seed' | 'seed' | 'series-a' | 'growth'
   * @param {string} [context.revenue_model]
   * @param {number} [context.user_count]
   * @param {boolean} [context.has_technical_founder]
   * @param {boolean} [context.has_design]
   * @param {boolean} [context.has_sales]
   * @param {boolean} [context.has_marketing]
   * @param {string} [context.biggest_bottleneck] — 'engineering' | 'sales' | 'marketing' | 'ops' | 'product'
   * @returns {{ next_hire: string, interview_questions: string[], team_structure: object, culture_pillars: string[] }}
   */
  async run(context) {
    this.log('info', 'Running people strategy analysis', { team_size: context.team_size, stage: context.stage })

    const next_hire = this._determineNextHire(context)
    const interview_questions = this._buildInterviewQuestions(context, next_hire)
    const team_structure = this._buildTeamStructure(context)
    const culture_pillars = this._buildCulturePillars(context)

    this.log('info', 'People strategy complete', { next_hire })

    return {
      next_hire,
      interview_questions,
      team_structure,
      culture_pillars,
    }
  }

  _determineNextHire(context) {
    const bottleneck = context.biggest_bottleneck
    const stage = context.stage ?? 'seed'
    const team = context.current_roles ?? []
    const users = context.user_count ?? 0

    if (bottleneck) {
      const roleMap = {
        engineering: 'Senior Full-Stack Engineer — own the product surface and shipping velocity',
        sales: 'Account Executive (first sales hire) — own the revenue pipeline end to end',
        marketing: 'Growth Marketer / Content Lead — own top-of-funnel acquisition',
        ops: 'Operations Manager — own processes, vendors, and internal tooling',
        product: 'Product Manager — own roadmap prioritization and user research',
      }
      return roleMap[bottleneck] ?? 'Generalist operator to remove the most painful daily bottleneck'
    }

    if (!context.has_technical_founder) {
      return 'CTO / Technical Co-founder — no technical founder is the most critical early gap. Hire for this before anything else.'
    }

    if (!context.has_sales && stage !== 'pre-seed' && users < 1000) {
      return 'First Sales Hire (AE or Founder-led Sales Specialist) — nothing matters more than revenue at this stage'
    }

    if (!context.has_design && team.length > 3) {
      return 'Product Designer — craft is a competitive moat. Hire a designer before the third engineer.'
    }

    if (!context.has_marketing && users < 500) {
      return 'Growth Marketer — owned distribution beats paid at this stage. Hire someone who can write and experiment.'
    }

    if (stage === 'series-a') {
      if (!team.includes('vp-engineering') && team.length > 8) {
        return 'VP of Engineering — at 8+ engineers, a great VP multiplies output. A bad one blocks it. Take your time.'
      }
      return 'Customer Success Manager — at Series A, retention is the growth engine. Own onboarding and expansion revenue.'
    }

    return 'Next hire should address your highest-churn function. Track where you spend the most unscalable time.'
  }

  _buildInterviewQuestions(context, next_hire) {
    const role = next_hire.toLowerCase()
    const isEngineering = role.includes('engineer') || role.includes('cto') || role.includes('technical')
    const isSales = role.includes('sales') || role.includes('account')
    const isDesign = role.includes('design')
    const isMarketing = role.includes('market') || role.includes('growth')
    const isProduct = role.includes('product') || role.includes('pm')
    const isOps = role.includes('ops') || role.includes('operations')

    const universal = [
      'Tell me about the last time you had to ship something under significant constraint — time, resources, or clarity. How did you decide what to cut?',
      'Describe the highest-leverage thing you did in your last role that no one asked you to do.',
      'What do you do when you disagree with a decision that has already been made?',
      'How do you know when a project is done?',
    ]

    if (isEngineering) {
      return [
        ...universal,
        'Walk me through a production incident you owned. What was the root cause, and what systemic change did you make afterward?',
        'How do you decide between building a feature correctly and shipping it fast? Give a real example.',
        'What is the hardest technical decision you have ever made, and would you make it the same way again?',
        'How do you stay current with the ecosystem without getting distracted by every new tool?',
      ]
    }

    if (isSales) {
      return [
        ...universal,
        'Walk me through your most memorable lost deal. What did you learn?',
        'How do you qualify leads? What questions do you ask in the first 5 minutes to decide if it is worth pursuing?',
        'Describe a time you had to sell something that was not fully built yet. How did you handle objections?',
        'What does your ideal week look like? How do you manage a pipeline across 30+ accounts?',
      ]
    }

    if (isDesign) {
      return [
        ...universal,
        'Walk me through a design decision you made that was not just an aesthetic choice — what impact did it have?',
        'How do you handle feedback from stakeholders that conflicts with what you know is best for the user?',
        'Show me a design you are not proud of and explain why.',
        'How do you design for accessibility from the start, not as an afterthought?',
      ]
    }

    if (isMarketing) {
      return [
        ...universal,
        'What is the most creative growth experiment you have run? What was the result?',
        'How do you prioritize across SEO, paid, content, and community when budget is limited?',
        'Describe a campaign that failed. What did you learn and what would you do differently?',
        'How do you measure marketing attribution in a multi-touch environment?',
      ]
    }

    if (isProduct) {
      return [
        ...universal,
        'Tell me about a time you killed a feature you personally liked because the data said to. How did you make the call?',
        'How do you decide what not to build? What framework do you use for ruthless prioritization?',
        'Describe a time you had to advocate for the user against strong internal pressure to ship something harmful.',
        'How do you run a discovery process when you have no time and unlimited opinions?',
      ]
    }

    if (isOps) {
      return [
        ...universal,
        'Tell me about a broken process you inherited. How did you fix it without disrupting the team?',
        'How do you decide when to automate versus when to keep a process manual?',
        'Describe the most complex cross-functional project you managed. How did you maintain alignment?',
        'How do you handle a vendor who is underperforming on a critical dependency?',
      ]
    }

    return [
      ...universal,
      'What would your first 30 days look like in this role?',
      'What is the one thing you need from leadership to do your best work?',
    ]
  }

  _buildTeamStructure(context) {
    const stage = context.stage ?? 'seed'
    const team_size = context.team_size ?? 2
    const roles = context.current_roles ?? []

    const structure = {
      current_stage: stage,
      current_size: team_size,
      recommended_structure: {},
      anti_patterns: [],
      next_milestone: '',
    }

    if (stage === 'pre-seed' || team_size <= 3) {
      structure.recommended_structure = {
        model: 'Flat / Full-Stack Founders',
        description: 'Everyone does everything. No hierarchy. Ship fast. Specialise after Series A.',
        ideal_mix: 'Technical co-founder + domain expert co-founder. Add one specialist as needed.',
      }
      structure.anti_patterns = [
        'Do not hire managers before you have something to manage',
        'Avoid creating titles that imply hierarchy before you have earned the right to it',
        'Do not hire a VP of Sales before you have founder-led sales working repeatably',
      ]
      structure.next_milestone = 'Reach 10 paying customers with the founding team before any specialist hire'
    } else if (stage === 'seed' || team_size <= 10) {
      structure.recommended_structure = {
        model: 'Functional Pods',
        description: 'Small cross-functional pods (2–3 people) each owning a product area end to end.',
        ideal_mix: '60% engineering, 20% product/design, 20% GTM. No middle managers yet.',
      }
      structure.anti_patterns = [
        'Avoid hiring senior individual contributors before you have culture and process — they will leave',
        'Do not separate design from engineering — embed one designer per product pod',
        'Resist building an HR function — use a PEO (Rippling, Gusto) until 25+ employees',
      ]
      structure.next_milestone = 'Each pod should have clear ownership, a KPI they own, and the autonomy to ship without cross-team approval'
    } else {
      structure.recommended_structure = {
        model: 'Product-Aligned Teams',
        description: 'Each team owns a product line or customer segment end to end: engineering, design, PM, and GTM in one unit.',
        ideal_mix: 'Staff engineer + PM + designer per product line. Centralized security, infrastructure, and data functions.',
      }
      structure.anti_patterns = [
        'Matrix organizations kill accountability — one person owns each outcome',
        'Avoid span of control above 1:8 (manager to direct reports) in engineering',
        'Do not let product and engineering report to different executives — it creates permanent misalignment',
      ]
      structure.next_milestone = 'Each team should have a two-pizza rule (6–8 people), OKRs they own, and the ability to ship independently'
    }

    return structure
  }

  _buildCulturePillars(context) {
    const stage = context.stage ?? 'seed'
    const pillars = [
      'Ownership over permission — default action, not approval-seeking. Raise concerns early, then execute.',
      'Craft over speed — ship fast, but never ship something you are not proud to put your name on.',
      'Direct communication — kind honesty beats diplomatic vagueness every time. Say the hard thing early.',
      'User obsession — every decision passes one filter: does this make the user more successful?',
    ]

    if (stage === 'pre-seed' || stage === 'seed') {
      pillars.push('Resourcefulness over resources — the constraint is the edge. Find the solution that works with what you have.')
      pillars.push('Learning velocity — the team that learns fastest wins. Document every failure publicly.')
    }

    if (context.has_remote || !context.has_office) {
      pillars.push('Writing first — async by default. Document decisions, post updates, surface blockers in writing before scheduling a meeting.')
      pillars.push('Presence in outcomes, not hours — judge contribution by what shipped, not when Slack was green.')
    }

    if (context.team_size > 10) {
      pillars.push('Disagree and commit — voice your objection clearly once. When the decision is made, execute it fully.')
      pillars.push('Hire for trajectory, not resume — the best hire at this stage is someone who has been growing at 20% per year.')
    }

    return pillars
  }
}

export default PeopleAgent
