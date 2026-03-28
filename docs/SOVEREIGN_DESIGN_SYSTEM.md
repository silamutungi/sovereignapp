# Sovereign Design System
### The locked design standard for every app generated on Sovereign

This is a **constraint document**, not a suggestion document. Every rule here is enforced in generation and audited automatically after every build. When any other file contradicts this document, this document wins.

---

## SECTION 1 — PHILOSOPHY

> "Every app Sovereign generates should feel like it was designed by Apple and built by Google. The user did nothing to earn this — it is the default. Complexity belongs to the system, not the user."

Sovereign generates apps that non-developers could charge for on day one. Not prototypes. Not demos. World-class products, by default.

The standard: remove everything that is not essential. Make complexity invisible. Design outcomes, not features. Details are not details — they make the product. Every screen has one primary purpose. One dominant action. One clear next step.

The design model draws from Jony Ive's work at Apple: products that feel inevitable, as if they could not have been designed any other way.

---

## SECTION 2 — SPACING SYSTEM

Base unit: **8px**. All spacing is a multiple of 8.

| Token | Value | Usage |
|---|---|---|
| xs  | 4px  | Icon gaps, tight inline spacing |
| sm  | 8px  | Label-to-input gap |
| md  | 16px | Component padding, row gaps |
| lg  | 24px | Section inner padding |
| xl  | 32px | Between components |
| 2xl | 48px | Between sections |
| 3xl | 64px | Page-level vertical rhythm |

**Rule: No arbitrary spacing values. Every gap, padding, and margin must be one of the values above.**

Section padding: `py-20 md:py-32`
Content max-width: `max-w-5xl mx-auto px-6`
Mobile-first. Every layout works at 320px minimum width.

---

## SECTION 3 — TYPOGRAPHY SCALE

### Typefaces

**SERIF** — headings, hero, display
```
font-family: 'Playfair Display', Georgia, serif
```
Weights: 400 (regular), 700 (bold) only.

**MONO** — labels, nav, buttons, metadata, body text
```
font-family: 'DM Mono', 'Courier New', monospace
```
Weight: 400 only.

Tailwind config:
```js
fontFamily: {
  serif: ['"Playfair Display"', 'Georgia', 'serif'],
  mono:  ['"DM Mono"', '"Courier New"', 'monospace'],
}
```

### Scale

| Name    | Size     | Usage |
|---|---|---|
| Display | 3.5rem   | Hero headline only |
| H1      | 2.5rem   | Page title |
| H2      | 2rem     | Section heading |
| H3      | 1.5rem   | Card or panel heading |
| H4      | 1.25rem  | Subsection heading |
| Body    | 1rem     | Minimum for body text |
| Small   | 0.875rem | Secondary text, captions |
| Micro   | 0.75rem  | Absolute minimum anywhere |

### Rules

- **Nothing below 12px (0.75rem) anywhere, ever.**
- **Body text minimum 16px (1rem) on all screen sizes.**
- Line-height: 1.6 on body text, 1.2 on headings.
- Heading hierarchy must be logical — no skipped levels (H1 → H2 → H3).
- Exactly one H1 per page.

---

## SECTION 4 — COLOR SYSTEM

All colors are CSS custom properties. **Never hardcode hex values in component styles.**

### CSS Custom Properties

```css
:root {
  --color-bg:             #f2efe8;
  --color-bg-surface:     #ffffff;
  --color-bg-muted:       #e8e4da;
  --color-text:           #0e0d0b;
  --color-text-secondary: #6b6862;
  --color-text-muted:     #9a9690;
  --color-border:         #d0cdc4;
  --color-accent:         #8ab800;
  --color-accent-hover:   #7aa300;
  --color-success:        #16a34a;
  --color-warning:        #d97706;
  --color-error:          #dc2626;
  --color-info:           #2563eb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg:             #0e0d0b;
    --color-bg-surface:     #1a1917;
    --color-bg-muted:       #2a2925;
    --color-text:           #f2efe8;
    --color-text-secondary: #5a5850;
    --color-text-muted:     #3a3830;
    --color-border:         #2a2925;
    --color-accent:         #c8f060;
    --color-accent-hover:   #d4f070;
    --color-success:        #4ade80;
    --color-warning:        #fbbf24;
    --color-error:          #f87171;
    --color-info:           #60a5fa;
  }
}
```

### WCAG AA Pre-verified Combinations

- `--color-text` on `--color-bg` ✓
- `--color-text` on `--color-bg-surface` ✓
- `--color-accent` on `--color-bg` (light mode only) ✓
- `--color-accent` on `--color-bg` (dark mode only) ✓

### Acid Green — Two Variants, One Rule

- On dark (`#0e0d0b`): use `#c8f060`
- On light (`#f2efe8`): use `#8ab800`
- **Never use `#c8f060` on a light background** — insufficient contrast, fails WCAG AA
- **Never use `#8ab800` on a dark background** — insufficient contrast, fails WCAG AA
- Never use `#6b6862` on any dark background — fails completely
- On dark backgrounds, secondary text = `#c8c4bc` (11:1 contrast on ink)

---

## SECTION 5 — COMPONENT LIBRARY

### Primary Button

```css
background: var(--color-accent);
color: #0e0d0b;
font-family: 'DM Mono', monospace;
font-size: 14px;
font-weight: 500;
padding: 12px 24px;
border-radius: 8px;
border: none;
cursor: pointer;
transition: opacity 150ms ease;
/* hover: */ opacity: 0.85;
/* focus: */ outline: 2px solid var(--color-accent); outline-offset: 2px;
/* disabled: */ opacity: 0.4; cursor: not-allowed;
```

Button text color is determined by brightness formula:
```
brightness = (R×299 + G×587 + B×114) / 1000
> 128 → use #1a1a1a text
≤ 128 → use #ffffff text
```

### Secondary Button

Same as primary, plus:
```css
background: transparent;
color: var(--color-text);
border: 1px solid var(--color-text);
```

### Text Input

```css
background: var(--color-bg-surface);
color: var(--color-text);
border: 1px solid var(--color-border);
border-radius: 8px;
padding: 12px 16px;
font-family: 'DM Mono', monospace;
font-size: 14px;
width: 100%;
/* focus: */ border-color: var(--color-accent); outline: none;
            box-shadow: 0 0 0 3px rgba(138, 184, 0, 0.15);
/* error:  */ border-color: var(--color-error);
/* disabled: */ opacity: 0.5;
```

### Label (always present, always visible)

```css
font-family: 'DM Mono', monospace;
font-size: 12px;
color: var(--color-text-secondary);
letter-spacing: 0.04em;
text-transform: uppercase;
margin-bottom: 8px;
display: block;
```

**Rule: Never use placeholder as a substitute for a label. Labels must be visible before, during, and after input.**

### Card

```css
background: var(--color-bg-surface);
border: 1px solid var(--color-border);
border-radius: 12px;
padding: 24px;
/* No drop shadows */
```

### Interactive Card

All card properties plus:
```css
cursor: pointer;
transition: border-color 150ms ease;
/* hover: */ border-color: var(--color-accent);
/* focus: */ outline: 2px solid var(--color-accent);
```

### Empty State (required on every list or table that can be empty)

```
[Centered inline SVG icon]
[Heading: contextual — "No orders yet", "Nothing here yet"]
[One sentence of context]
[Optional primary CTA button]
```

Empty states are not an afterthought. They are the first thing a new user sees. Design them with the same care as the happy path.

### Loading Skeleton

```css
background: var(--color-bg-muted);
border-radius: 4px;
/* Same dimensions as the content it replaces */
animation: skeleton-pulse 1.5s ease infinite;

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
```

### Hero Section (iOS Safari rule)

Use `backgroundImage` inline style on the `<section>` element — **never an `<img>` tag for hero backgrounds**.

`height: 100%` resolves to 0 on iOS Safari when the parent uses `min-height`. The hero image disappears on scroll or reload.

```tsx
<section
  style={{
    backgroundImage: 'url(IMAGE_URL)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }}
  className="relative min-h-screen flex items-center overflow-hidden"
>
  <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
  <div className="relative z-10">
    {/* content */}
  </div>
</section>
```

**One image rule: exactly one image per app (the hero). Zero images in feature sections, cards, or anywhere below the hero.**

---

## SECTION 6 — RESPONSIVE RULES

Three breakpoints:

| Name    | Range        |
|---|---|
| Mobile  | < 768px      |
| Tablet  | 768px–1024px |
| Desktop | > 1024px     |

**Mobile-first.** Base styles are mobile. Override upward.

Grid system:
- Mobile:  1 column, 16px gutters
- Tablet:  2 columns, 24px gutters
- Desktop: 12 columns, 24px gutters, max-width 1280px

Rules:
- **No horizontal scroll at any breakpoint, ever.**
- **Touch targets minimum 44px × 44px.** (`min-h-[44px] min-w-[44px]`)
- 8px minimum spacing between adjacent touch targets.
- Font sizes never shrink below the defined minimum at any breakpoint.
- Navigation collapses to a hamburger on mobile (≤ 768px).
- Use `min-width` not `width` on buttons containing text — allows text expansion.

---

## SECTION 7 — MOTION

Four transition durations only:

| Duration | Usage |
|---|---|
| 0ms   | Focus rings, active state press feedback |
| 150ms | Hover states, button press |
| 250ms | Panels, dropdowns, tooltips |
| 400ms | Page transitions, modals, full-screen overlays |

Easing: `ease-in`, `ease-in-out`.
**No bounces, springs, or purely decorative animation.**

Fade-in on scroll entry (via IntersectionObserver):
- `opacity: 0 → 1`, `translateY(4px) → translateY(0)`, 300ms `ease-out`
- Observer fires once, disconnects immediately — no performance cost.
- Only elements below the fold animate in. Elements visible on load render immediately.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**`prefers-reduced-motion` must be respected. All transitions → 0ms.**

---

## SECTION 8 — ACCESSIBILITY

Every generated app must satisfy all ten requirements. These are non-negotiable.

1. All text passes WCAG AA contrast ratio (4.5:1 minimum; 3:1 for large text 18px+)
2. Full keyboard navigation — no mouse-only interactions anywhere
3. Visible focus states on every interactive element (`focus:ring-2 focus:ring-accent`) — never hidden with `outline: none`
4. `alt` text on every `<img>` element; decorative images use `alt=""`
5. Every `<input>` linked to a `<label>` via `for`/`id` — placeholder is not a label
6. `aria-label` on every icon button (buttons containing only an SVG or icon)
7. Exactly one `<h1>` per page
8. Logical heading hierarchy — H1 → H2 → H3, no levels skipped
9. Color is never the sole carrier of information — always pair with text or icon
10. Error messages use `aria-live="polite"` for screen reader announcement

---

## SECTION 9 — DEFAULT INCLUSIONS

Every app generated by Sovereign ships these fifteen items by default:

1. Mobile-responsive layout at all breakpoints
2. Sticky nav with mobile hamburger menu
3. Empty states on every data view
4. Loading skeletons on every async operation
5. Form validation with inline error messages
6. Success states after every form submission
7. 404 page with navigation back to home
8. Error boundary catching JavaScript errors gracefully
9. Page `<title>` and `<meta name="description">`
10. Open Graph tags (`og:title`, `og:description`, `og:image`)
11. Inline SVG favicon in brand color
12. Footer with app name, year, and basic links
13. Full keyboard navigation
14. Focus management on route changes
15. `prefers-reduced-motion` respected

Security defaults also generated by the build pipeline:
- CSP in `vercel.json` covering `default-src`, Google Fonts, Supabase
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `frame-ancestors 'self' https://sovereignapp.dev`
- RLS on every Supabase table with explicit policies

---

## SECTION 10 — AUDIT CHECKLIST (35 checks)

This checklist is enforced automatically after every build. Failures are auto-corrected where possible, then logged. The score (0–100) is stored in `builds.audit_score` and shown on the build completion screen.

### TYPOGRAPHY (5)
- [ ] No font-size below 12px anywhere
- [ ] Body text minimum 16px on all screens
- [ ] Exactly one H1 per page
- [ ] Heading hierarchy is logical (no levels skipped)
- [ ] Line-height 1.6+ on body text

### COLOUR (6)
- [ ] All colors use CSS custom properties (`var(--color-*)`)
- [ ] `:root` defines both light and dark variants
- [ ] No hardcoded hex values in component styles
- [ ] Status colors used semantically only
- [ ] Color is never the sole carrier of information
- [ ] All color combinations pass WCAG AA

### SPACING (3)
- [ ] No arbitrary spacing outside the 8px grid scale
- [ ] Touch targets minimum 44px on mobile
- [ ] No horizontal overflow at any breakpoint

### COMPONENTS (8)
- [ ] Every button has hover, focus, and disabled states
- [ ] Every input has a visible, always-present label
- [ ] Every input has a defined error state
- [ ] Every form has a loading state on the submit button
- [ ] Every list and table has an empty state
- [ ] Every async operation has a loading skeleton
- [ ] No Lorem ipsum or placeholder text anywhere
- [ ] No "undefined", "null", or "[object Object]" visible to users

### STRUCTURE (5)
- [ ] Page has a `<title>` tag
- [ ] Page has `<meta name="description">`
- [ ] Page has Open Graph tags
- [ ] 404 route exists
- [ ] Footer exists

### ACCESSIBILITY (8)
- [ ] All images have `alt` attributes
- [ ] All icon buttons have `aria-label`
- [ ] Focus states are visible on all interactive elements
- [ ] Form inputs linked to labels via `for`/`id`
- [ ] Single H1 per page
- [ ] No heading levels skipped
- [ ] Error messages use `aria-live`
- [ ] Full keyboard navigation throughout

### DARK MODE (3)
- [ ] All colors use CSS custom properties
- [ ] `:root` includes `@media (prefers-color-scheme: dark)` block
- [ ] `<html>` element has `color-scheme="light dark"`

*Total: 35 checks. Score = checks passed / 35 × 100.*

---

## SECTION 11 — DARK MODE SYSTEM

**Principle: Dark mode is not a feature. It is the default. Every generated app supports both modes automatically. Hardcoded hex values in component styles are a design system violation.**

### The CSS Custom Property System

All colors are defined as CSS custom properties on `:root`. Component styles reference only these variables — never raw hex.

```css
/* WRONG — hardcoded hex in component style */
background-color: #f2efe8;

/* RIGHT — CSS custom property */
background-color: var(--color-bg);
```

Full token set: see Section 4.

In Tailwind, extend the theme to map utility classes to the custom properties:
```js
colors: {
  bg:      'var(--color-bg)',
  surface: 'var(--color-bg-surface)',
  muted:   'var(--color-bg-muted)',
  ink:     'var(--color-text)',
  dim:     'var(--color-text-secondary)',
  border:  'var(--color-border)',
  accent:  'var(--color-accent)',
}
```

### HTML Element Declaration

```html
<html lang="en" color-scheme="light dark">
```

`color-scheme="light dark"` tells the browser to render native UI elements (scrollbars, form controls, system dialogs) in the matching mode.

### Image Brightness in Dark Mode

```css
@media (prefers-color-scheme: dark) {
  img:not([src*=".svg"]) {
    filter: brightness(0.9);
  }
}
```

### Audit Enforcement

The post-build audit checks for:
- Hardcoded hex values in component code (outside string literals)
- Missing `prefers-color-scheme: dark` block in CSS
- Missing `color-scheme` attribute on `<html>`

Builds that fail these checks are auto-corrected before the user sees them.

---

## SECTION 12 — TRANSLATION READINESS

**Principle: "Sovereign generates English apps that are ready to become multilingual. The architecture never assumes English is permanent."**

Every generated app is translation-ready by default at zero cost to the English experience.

### The Six Rules

**Rule 1 — `lang` attribute**
`<html lang="en">`. Guaranteed by the build pipeline. Update it when locale changes.

**Rule 2 — Expandable containers**
Allow 30% text expansion. German and Finnish words are 30–40% longer than English.
- Use `min-width` not `width` on buttons with text content
- Never set `overflow: hidden` on containers holding translatable text

**Rule 3 — No inline strings in structural components**
All visible strings in Navbar, Footer, and layout components come from props or named constants — never hardcoded inline.

**Rule 4 — Intl API for dates**
```ts
/* WRONG — hardcodes en-US */
date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/* RIGHT — uses visitor's browser locale */
new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
```

**Rule 5 — Intl API for numbers and currency**
```ts
/* WRONG */
'$' + amount.toFixed(2)

/* RIGHT */
new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount)
```

**Rule 6 — `lang` attribute on locale switch**
```ts
document.documentElement.lang = locale
```

---

*This document is the single source of truth for the Sovereign Design System.*
*When any other file contradicts it, this document wins and the other file updates.*
*Last updated: 2026-03-28.*
