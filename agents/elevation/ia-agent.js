// agents/elevation/ia-agent.js
import { AgentBase } from '../../shared/agent-base-class.js'

export class IAAgent extends AgentBase {
  constructor() {
    super({ name: 'ia-agent', phase: 'elevation', version: '1.0.0' })
  }

  async run(context) {
    const { brief } = context
    this.log('info', 'Building information architecture')

    const pages = this.determinePages(brief)
    const navigation = this.buildNavigation(pages, brief)
    const urlStructure = this.buildURLStructure(pages)

    return {
      pages,
      navigation,
      url_structure: urlStructure,
      primary_action: this.identifyPrimaryAction(brief),
      principle: "Don't Make Me Think — Steve Krug",
    }
  }

  determinePages(brief) {
    const pages = [
      { name: 'Home', path: '/', type: 'marketing', purpose: 'Landing and primary CTA' },
    ]

    if (brief.complexity !== 'SIMPLE') {
      pages.push({ name: 'Login', path: '/login', type: 'auth', purpose: 'Sign in' })
      pages.push({ name: 'Signup', path: '/signup', type: 'auth', purpose: 'Create account' })
      pages.push({ name: 'Dashboard', path: '/dashboard', type: 'app', purpose: 'Main app view' })
    }

    if (brief.complexity === 'COMPLEX') {
      pages.push({ name: 'Settings', path: '/settings', type: 'app', purpose: 'Account and preferences' })
    }

    // Add feature-specific pages based on tech requirements
    if (brief.tech_requirements?.includes('Stripe')) {
      pages.push({ name: 'Billing', path: '/billing', type: 'app', purpose: 'Subscription management' })
    }

    return pages
  }

  buildNavigation(pages, _brief) {
    const marketing = pages.filter(p => p.type === 'marketing').map(p => p.name)
    const app = pages.filter(p => p.type === 'app').map(p => p.name)
    const auth = pages.filter(p => p.type === 'auth').map(p => p.name)

    return {
      primary: marketing,
      app_nav: app,
      auth_links: auth,
      footer: ['Privacy', 'Terms'],
    }
  }

  buildURLStructure(pages) {
    return pages.reduce((acc, p) => {
      acc[p.name.toLowerCase()] = p.path
      return acc
    }, {})
  }

  identifyPrimaryAction(brief) {
    if (brief.tech_requirements?.includes('Supabase Auth')) return 'Get started free'
    if (brief.tech_requirements?.includes('Stripe')) return 'Start your free trial'
    return 'Try it now'
  }
}

export default async function run(context) {
  return new IAAgent().execute(context)
}
