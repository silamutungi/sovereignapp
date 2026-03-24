// agents/vision/onboarding-agent.js
// Designs the first-run experience, empty states, progressive disclosure, and
// activation milestones. Returns OnboardingSpec.
import { AgentBase } from '../../shared/agent-base-class.js'

export class OnboardingAgent extends AgentBase {
  constructor() {
    super({ name: 'onboarding-agent', phase: 'vision', version: '1.0.0' })
  }

  async run(context) {
    const { brief, insights, ia } = context
    this.log('info', 'Designing onboarding and first-run experience')

    const firstRunFlow = this.designFirstRunFlow(brief, ia)
    const emptyStates = this.designEmptyStates(brief, insights)
    const progressiveDisclosure = this.designProgressiveDisclosure(brief)
    const activationMilestones = this.defineActivationMilestones(brief, insights)

    return {
      first_run_flow: firstRunFlow,
      empty_states: emptyStates,
      progressive_disclosure: progressiveDisclosure,
      activation_milestones: activationMilestones,
      principle: 'Users do not read — they scan. Every step must be obvious.',
      delight_moments: this.identifyDelightMoments(brief),
    }
  }

  designFirstRunFlow(brief, ia) {
    const hasAuth = brief?.tech_requirements?.includes('Supabase Auth')
    const steps = []

    if (hasAuth) {
      steps.push({
        step: 1,
        screen: 'Signup',
        goal: 'Create account with minimal friction',
        copy: {
          heading: `Create your ${brief?.app_name} account`,
          subheading: 'Takes less than a minute.',
          cta: 'Create account',
        },
        ux_rules: [
          'Email + password only — no phone, no username',
          'Show password strength inline',
          'Magic link as alternative to password',
          'No redirect after signup — stay in flow',
        ],
      })

      steps.push({
        step: 2,
        screen: 'Welcome',
        goal: 'Orient user and set expectations',
        copy: {
          heading: `Welcome to ${brief?.app_name}`,
          subheading: `Here is what you can do next.`,
          cta: 'Get started',
        },
        ux_rules: [
          'Single screen — no multi-step wizard unless truly necessary',
          'Skip button always visible',
          'Progress indicator if >2 steps',
        ],
      })
    }

    steps.push({
      step: steps.length + 1,
      screen: 'Dashboard',
      goal: `Show the user their first ${brief?.features?.[0] || 'item'}`,
      copy: {
        heading: `Your ${brief?.app_name} is ready`,
        subheading: `Start with your first ${brief?.features?.[0] || 'action'}.`,
        cta: `Create your first ${brief?.features?.[0]?.split(' ')[0] || 'item'}`,
      },
      ux_rules: [
        'Empty state with a clear primary action — never a blank screen',
        'Inline tooltip on first interactive element',
        'Confetti or delight animation on first completion',
      ],
    })

    return { steps, total_steps: steps.length, skip_allowed: true }
  }

  designEmptyStates(brief, insights) {
    const coreFeature = insights?.mvp_features?.[0] || brief?.features?.[0] || 'item'
    return [
      {
        screen: 'Dashboard',
        scenario: 'No items yet',
        illustration: 'inbox-empty', // icon name
        heading: `No ${coreFeature}s yet`,
        body: `Create your first ${coreFeature} to get started.`,
        primary_action: `Create ${coreFeature}`,
        rule: 'Never show a blank screen — always provide a next action',
      },
      {
        screen: 'Search',
        scenario: 'No search results',
        illustration: 'search-empty',
        heading: 'Nothing found',
        body: 'Try a different search term, or create a new one.',
        primary_action: `Create ${coreFeature}`,
      },
    ]
  }

  designProgressiveDisclosure(brief) {
    return {
      principle: 'Show the minimum needed to complete the immediate task',
      levels: [
        {
          level: 1,
          label: 'Core',
          description: 'Fields and actions required to complete the primary task',
          always_visible: true,
        },
        {
          level: 2,
          label: 'Advanced',
          description: 'Optional settings revealed on demand via "Advanced options" toggle',
          visible_on_demand: true,
          trigger: '"Advanced options" link below the form',
        },
        {
          level: 3,
          label: 'Expert',
          description: 'Power user settings in dedicated Settings page',
          visible_in_settings: true,
        },
      ],
    }
  }

  defineActivationMilestones(brief, insights) {
    const coreFeature = insights?.mvp_features?.[0] || brief?.features?.[0] || 'first item'
    return [
      {
        milestone: 'Signup',
        definition: 'Account created',
        metric: 'signup_completed',
        delight: false,
      },
      {
        milestone: 'First action',
        definition: `Created first ${coreFeature}`,
        metric: 'first_item_created',
        delight: true, // confetti
      },
      {
        milestone: 'Activated',
        definition: `Completed core workflow end-to-end once`,
        metric: 'core_workflow_completed',
        delight: true,
      },
      {
        milestone: 'Retained',
        definition: 'Returned on day 3',
        metric: 'day3_return',
        delight: false,
      },
    ]
  }

  identifyDelightMoments(brief) {
    return [
      { trigger: 'First item created', effect: 'Confetti burst, 4 seconds' },
      { trigger: 'Core workflow completed', effect: 'Success toast with positive copy' },
      { trigger: 'Profile complete', effect: 'Progress bar fills with animation' },
    ]
  }
}

export default async function run(context) {
  return new OnboardingAgent().execute(context)
}
