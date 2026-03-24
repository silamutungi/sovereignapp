// agents/elevation/creative-director-agent.js
import { AgentBase } from '../../shared/agent-base-class.js'

export class CreativeDirectorAgent extends AgentBase {
  constructor() {
    super({ name: 'creative-director-agent', phase: 'elevation', version: '1.0.0' })
  }

  async run(context) {
    const { brief } = context
    this.log('info', 'Generating design direction')

    const palette = this.generatePalette(brief)
    const typography = {
      heading: 'Playfair Display',
      body: 'DM Mono',
      scale: [12, 14, 16, 18, 24, 32, 48],
    }
    const spacing = [4, 8, 16, 24, 32, 48, 64]

    // Verify WCAG AA compliance using brightness formula from CLAUDE.md
    // brightness = (R×299 + G×587 + B×114) / 1000
    // > 128 = LIGHT → use #1a1a1a text
    // ≤ 128 = DARK → use #ffffff text
    const primaryBrightness = this.calculateBrightness(palette.primary)
    const textOnPrimary = primaryBrightness > 128 ? '#1a1a1a' : '#ffffff'

    const personality = this.inferPersonality(brief)

    return {
      palette: { ...palette, text_on_primary: textOnPrimary },
      typography,
      spacing,
      border_radius: 6,
      motion: {
        entrance: '0.4s ease',
        transition: '0.15s ease',
        delight: '0.6s ease',
      },
      personality,
      quality_standard: 'Jony Ive bar — award-winning design, expert implementation',
    }
  }

  generatePalette(brief) {
    const personality = this.inferPersonality(brief)
    // Default Sovereign brand palette — overridden per personality
    const palettes = {
      professional: {
        primary: '#0f4c81',
        background: '#f8f9fa',
        text: '#0e0d0b',
        surface: '#ffffff',
        muted: '#6b7280',
      },
      creative: {
        primary: '#7c3aed',
        background: '#faf5ff',
        text: '#1e1b4b',
        surface: '#ffffff',
        muted: '#6b7280',
      },
      playful: {
        primary: '#f59e0b',
        background: '#fffbeb',
        text: '#0e0d0b',
        surface: '#ffffff',
        muted: '#92400e',
      },
      modern: {
        primary: '#c8f060',
        background: '#f2efe8',
        text: '#0e0d0b',
        surface: '#ffffff',
        muted: '#6b6862',
      },
    }
    return palettes[personality] || palettes.modern
  }

  calculateBrightness(hex) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return (r * 299 + g * 587 + b * 114) / 1000
  }

  inferPersonality(brief) {
    const idea = (brief.problem_statement || '').toLowerCase()
    if (idea.includes('professional') || idea.includes('enterprise') || idea.includes('corporate'))
      return 'professional'
    if (idea.includes('creative') || idea.includes('design') || idea.includes('art'))
      return 'creative'
    if (idea.includes('fun') || idea.includes('game') || idea.includes('kids'))
      return 'playful'
    return 'modern'
  }
}

export default async function run(context) {
  return new CreativeDirectorAgent().execute(context)
}
