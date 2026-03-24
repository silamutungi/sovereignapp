// agents/vision/design-agent.js
// Applies Don Norman's Design of Everyday Things: affordances, feedback, mapping,
// constraints, discoverability. Takes DesignTokens. Returns ComponentDesignSpec.
import { AgentBase } from '../../shared/agent-base-class.js'

export class DesignAgent extends AgentBase {
  constructor() {
    super({ name: 'design-agent', phase: 'vision', version: '1.0.0' })
  }

  async run(context) {
    const { brief, designTokens, ia } = context
    this.log('info', 'Specifying component design system')

    const components = this.specifyComponents(brief, designTokens, ia)
    const patterns = this.definePatterns(designTokens)
    const qualityChecklist = this.buildQualityChecklist()

    return {
      components,
      patterns,
      quality_checklist: qualityChecklist,
      norman_principles: [
        'Affordance: every interactive element looks interactive',
        'Feedback: every action has an immediate visible response',
        'Mapping: controls are placed near what they affect',
        'Constraints: guide users toward correct actions',
        'Discoverability: all features are findable without documentation',
      ],
    }
  }

  specifyComponents(brief, tokens, ia) {
    const palette = tokens?.palette || {}
    const primary = palette.primary || '#c8f060'
    const textOnPrimary = palette.text_on_primary || '#1a1a1a'

    return {
      Button: {
        variants: ['primary', 'secondary', 'ghost', 'destructive'],
        primary: {
          background: primary,
          color: textOnPrimary,
          border: 'none',
          border_radius: `${tokens?.border_radius || 6}px`,
          padding: '12px 24px',
          font: `500 16px ${tokens?.typography?.body || 'DM Mono'}`,
          hover: 'opacity: 0.9; transform: translateY(-1px)',
          active: 'transform: translateY(0)',
          disabled: 'opacity: 0.4; cursor: not-allowed',
          focus: `outline: 2px solid ${primary}; outline-offset: 2px`,
        },
        norman_affordance: 'Raised shadow on hover communicates pressability',
      },

      Input: {
        border: `1px solid #d1d5db`,
        border_radius: `${tokens?.border_radius || 6}px`,
        padding: '10px 14px',
        font: `16px ${tokens?.typography?.body || 'DM Mono'}`,
        focus: `border-color: ${primary}; box-shadow: 0 0 0 3px ${primary}33`,
        error: 'border-color: #ef4444',
        label: { font: `500 14px ${tokens?.typography?.body || 'DM Mono'}`, margin_bottom: '6px' },
        helper_text: { font: `12px ${tokens?.typography?.body || 'DM Mono'}`, color: '#6b7280' },
        norman_feedback: 'Focus ring confirms field is active; error state shows exactly what is wrong',
      },

      Card: {
        background: palette.surface || '#ffffff',
        border: '1px solid #e5e7eb',
        border_radius: `${(tokens?.border_radius || 6) * 2}px`,
        padding: '24px',
        shadow: '0 1px 3px rgba(0,0,0,0.1)',
        hover_shadow: '0 4px 12px rgba(0,0,0,0.15)',
        transition: tokens?.motion?.transition || '0.15s ease',
      },

      Navbar: {
        height: '64px',
        background: palette.background || '#f2efe8',
        border_bottom: '1px solid #e5e7eb',
        padding: '0 24px',
        logo_font: `600 20px ${tokens?.typography?.heading || 'Playfair Display'}`,
        cta: { component: 'Button', variant: 'primary' },
        mobile_breakpoint: '768px',
      },

      EmptyState: {
        icon_size: '48px',
        icon_color: '#d1d5db',
        heading: { font: `600 18px ${tokens?.typography?.heading || 'Playfair Display'}` },
        body: { font: `14px ${tokens?.typography?.body || 'DM Mono'}`, color: '#6b7280' },
        cta: { component: 'Button', variant: 'primary' },
        norman_discoverability: 'Empty state always has a primary action — never leave users stuck',
      },

      Toast: {
        variants: ['success', 'error', 'info', 'warning'],
        position: 'bottom-right',
        duration_ms: 4000,
        success: { background: '#f0fdf4', border: '1px solid #86efac', icon: 'check' },
        error: { background: '#fef2f2', border: '1px solid #fca5a5', icon: 'x-circle' },
        norman_feedback: 'Every async action must resolve with a visible success or error toast',
      },

      Modal: {
        overlay: 'rgba(0,0,0,0.5)',
        background: palette.surface || '#ffffff',
        border_radius: `${(tokens?.border_radius || 6) * 2}px`,
        padding: '32px',
        max_width: '560px',
        close_button: { position: 'top-right', size: '24px' },
        norman_constraint: 'Modal locks focus — keyboard Escape always closes',
      },

      LoadingSpinner: {
        color: primary,
        sizes: { sm: '16px', md: '24px', lg: '48px' },
        norman_feedback: 'Any async operation > 200ms shows a spinner',
      },
    }
  }

  definePatterns(tokens) {
    return {
      entrance_animation: {
        initial: 'opacity: 0; transform: translateY(8px)',
        animate: 'opacity: 1; transform: translateY(0)',
        duration: tokens?.motion?.entrance || '0.4s ease',
        note: 'Use IntersectionObserver — only animate when element enters viewport',
      },
      form_pattern: {
        layout: 'single column, labels above inputs',
        submit: 'primary Button, full-width on mobile',
        error_display: 'inline below the relevant field, never in a modal',
        loading: 'disable submit button and show spinner during request',
      },
      responsive: {
        breakpoints: { mobile: '375px', tablet: '768px', desktop: '1280px' },
        mobile_first: true,
      },
    }
  }

  buildQualityChecklist() {
    return [
      'Every interactive element has a hover and focus state',
      'Every async operation has a loading state',
      'Every error has a recovery action',
      'Every empty state has a primary action',
      'No lorem ipsum — real copy only',
      'WCAG AA contrast on every text element',
      'Works at 375px mobile width',
    ]
  }
}

export default async function run(context) {
  return new DesignAgent().execute(context)
}
