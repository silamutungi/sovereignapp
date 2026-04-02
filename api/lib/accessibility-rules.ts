export const ACCESSIBILITY_RULES = `
---
## Accessibility Rules
Apply to every generated app. No exceptions. No overrides.

### Typography
- Minimum body font size: 17px. Absolute floor: 11px.
- Never use font-weight 100–300 below 20px. Use 400+ at small sizes.
- Line height: minimum 1.5 for all body text.

### Color & Contrast
- Body text (<18px): minimum 4.5:1 contrast ratio against background.
- Large text (≥18px or bold): minimum 3:1 contrast ratio.
- Never use color as the only indicator of state or meaning:
    Error states:   red color + error icon (⚠ or ✕)
    Success states: green color + checkmark icon
    Badges/status:  color + text label or icon
- Always generate both light and dark --color-* tokens even if dark
  mode is not the default.

### Touch Targets
- Every interactive element (button, link, input, icon button)
  must be at least 44×44px.
- Minimum 12px padding around elements with a visible border or bezel.
- Minimum 24px padding around borderless interactive elements.
- Never place two interactive elements closer than 8px edge-to-edge.

### Semantics & Structure
- Use semantic HTML only:
    <nav> <main> <section> <article> <header> <footer> <button> <a>
- Never use <div> or <span> as interactive elements.
  Buttons must be <button>. Links must be <a href>.
- Every <img> must have a descriptive alt attribute.
  Decorative images: alt=""
- Every form input must have an associated <label> element.
  Never rely on placeholder text alone as a label.
- Heading hierarchy must be sequential:
  One <h1> per page → <h2> → <h3>. Never skip levels.
- Icon buttons with no visible text label must have:
  aria-label="[action description]"

### Motion & Media
- Never autoplay video or audio. Always render visible play/pause controls.
- Never use flashing or strobing effects.
- Include this block in the root CSS of every generated app:

    /* Respect user motion preferences */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }

### Focus & Keyboard
- Never remove the default focus ring without replacing it with a
  visible custom one.
- Include this block in the root CSS of every generated app:

    /* Always show a visible focus indicator */
    :focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

- Tab order must follow the visual reading order of the page.
- Modals and drawers must trap focus while open and return focus
  to the trigger element on close.

### Why these rules are non-negotiable
These are not aesthetic preferences. They are a baseline contract
with every user of every app Visila generates:
- :focus-visible is required for keyboard and assistive technology users.
- prefers-reduced-motion is required for users with vestibular disorders.
- Contrast ratios are required for low vision and color blind users.
- Semantic HTML gives VoiceOver compatibility and SEO for free.
- Touch target minimums apply to everyone using a phone one-handed.
Removing or weakening any of these rules breaks the app for a real
subset of real users.
---
`;
