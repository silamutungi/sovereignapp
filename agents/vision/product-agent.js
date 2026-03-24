// agents/vision/product-agent.js
// Applies Jeff Patton's User Story Mapping methodology: backbone → walking skeleton →
// full story map. Returns ProductSpec.
import { AgentBase } from '../../shared/agent-base-class.js'

export class ProductAgent extends AgentBase {
  constructor() {
    super({ name: 'product-agent', phase: 'vision', version: '1.0.0' })
  }

  async run(context) {
    const { brief, insights } = context
    this.log('info', 'Building product specification and user story map')

    const personas = this.buildPersonas(brief)
    const storyMap = this.buildStoryMap(brief, insights)
    const mvpScope = this.defineMVPScope(storyMap, insights)
    const acceptanceCriteria = this.buildAcceptanceCriteria(mvpScope)

    return {
      personas,
      story_map: storyMap,
      mvp_scope: mvpScope,
      acceptance_criteria: acceptanceCriteria,
      patton_principle: 'Build shared understanding first — story maps are conversations, not contracts',
    }
  }

  buildPersonas(brief) {
    const primary = {
      name: this.inferPersonaName(brief?.target_user),
      role: brief?.target_user || 'professional',
      goal: brief?.problem_statement?.slice(0, 100) || 'work more efficiently',
      frustration: `Current tools don't solve this quickly`,
      success_metric: 'Completes core task in under 2 minutes',
    }
    return [primary]
  }

  buildStoryMap(brief, insights) {
    // Backbone: the high-level user journey activities
    const backbone = this.buildBackbone(brief)
    // Walking skeleton: the minimum path through the backbone
    const walkingSkeleton = backbone.map(activity => ({
      activity: activity.name,
      minimum_task: activity.tasks[0] || activity.name,
    }))

    return {
      backbone,
      walking_skeleton: walkingSkeleton,
      mvp_features: insights?.mvp_features || brief?.features?.slice(0, 3) || [],
      future_features: insights?.deferred_features || brief?.features?.slice(3) || [],
    }
  }

  buildBackbone(brief) {
    const hasAuth = brief?.tech_requirements?.includes('Supabase Auth')
    const activities = []

    if (hasAuth) {
      activities.push({
        name: 'Onboard',
        tasks: ['Sign up', 'Verify email', 'Complete profile'],
      })
    }

    activities.push({
      name: 'Discover',
      tasks: ['Land on home page', 'Understand value prop', 'Click primary CTA'],
    })

    activities.push({
      name: 'Activate',
      tasks: [
        `Use core feature: ${brief?.features?.[0] || 'main action'}`,
        'See results',
        'Share or save',
      ],
    })

    if (brief?.complexity !== 'SIMPLE') {
      activities.push({
        name: 'Retain',
        tasks: ['Return to dashboard', 'Complete second session', 'Invite collaborator'],
      })
    }

    if (brief?.tech_requirements?.includes('Stripe')) {
      activities.push({
        name: 'Monetize',
        tasks: ['Hit free tier limit', 'View upgrade prompt', 'Enter payment details'],
      })
    }

    return activities
  }

  defineMVPScope(storyMap, insights) {
    return {
      included: insights?.mvp_features || storyMap.mvp_features,
      excluded: storyMap.future_features,
      rationale: 'Ship the walking skeleton. Validate before expanding.',
      estimated_pages: storyMap.backbone.length + 1, // +1 for landing
    }
  }

  buildAcceptanceCriteria(mvpScope) {
    return mvpScope.included.map(feature => ({
      feature,
      given: `A user is on the relevant page`,
      when: `They interact with "${feature}"`,
      then: `The action completes without errors and confirms success visually`,
    }))
  }

  inferPersonaName(targetUser) {
    const names = {
      'freelancers': 'Alex',
      'developers': 'Jordan',
      'teams': 'Sam',
      'students': 'Riley',
      'content creators': 'Casey',
      'small business owners': 'Morgan',
    }
    return names[targetUser] || 'Taylor'
  }
}

export default async function run(context) {
  return new ProductAgent().execute(context)
}
