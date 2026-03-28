# Sovereign Design System

The authoritative reference for every visual, interaction, and structural decision in Sovereign-generated apps. Sections 1–10 define the system. Sections 11–12 define the defaults every app ships with.

---

## Section 1: Typography

**Headings:** Playfair Display — elegant, authoritative serif. Weights: 400, 600, 800.
**Body, code, UI:** DM Mono — clean, technical monospace. Weights: 400, 500.
**Loading:** Google Fonts CDN with `font-display: swap`.
**Fallbacks:** Playfair Display → Georgia, serif. DM Mono → Courier New, monospace.

Tailwind config:
```
fontFamily: {
  serif: ['"Playfair Display"', 'Georgia', 'serif'],
  mono:  ['"DM Mono"', '"Courier New"', 'monospace'],
}
```

Rules:
- All headings (h1–h3): `font-serif` class
- All body text, labels, buttons, inputs, code: `font-mono` class
- Minimum body font size: 16px
- Minimum any text: 12px
- Line height body: minimum 1.5

---

## Section 2: Colour Tokens

Base palette (light mode defaults):

| Token | Hex | Usage |
|-------|-----|-------|
| Paper | `#f2efe8` | Main background |
| Ink | `#0e0d0b` | Primary text, dark sections |
| Acid Green (light) | `#8ab800` | CTAs on light backgrounds |
| Acid Green (dark) | `#c8f060` | CTAs on dark backgrounds |
| Dim / paper | `#6b6862` | Captions, meta (paper bg only) |
| Dim / dark | `#c8c4bc` | Secondary text on dark backgrounds |

**The acid green rule:** two variants, one background dependency.
- On dark (`#0e0d0b`): use `#c8f060`
- On light (`#f2efe8`): use `#8ab800`
- NEVER use `#c8f060` on a light background (insufficient contrast)
- NEVER use `#8ab800` on a dark background (insufficient contrast)
- NEVER use `#6b6862` on any dark background — fails WCAG AA

All colours are implemented as CSS custom properties. See Section 11.

---

## Section 3: Spacing & Layout

- 8px base grid. All spacing is a multiple of 8.
- Section padding: `py-20 md:py-32`
- Content max-width: `max-w-5xl mx-auto px-6`
- Mobile-first. Every layout works at 320px.
- Breakpoints: `sm:` 640px, `md:` 768px, `lg:` 1024px, `xl:` 1280px

---

## Section 4: Interactive Elements

- Minimum touch target: 44×44px (`min-h-[44px] min-w-[44px]`)
- Focus ring: `focus:outline-none focus:ring-2 focus:ring-primary`
- Five button states: default → hover → active → loading → success/error
- Hover: opacity shift or colour shift — never layout shift
- Active: `scale-[0.97]` on press
- Disabled: `opacity-50 cursor-not-allowed`

---

## Section 5: Motion

Motion explains change. It does not entertain.

**Allowed:**
- Fade-in on scroll entry: `opacity-0 → opacity-100`, `translateY(4px) → translateY(0)`, 300ms ease-out
- Hover colour/scale shift on interactive elements
- Button `scale-[0.97]` on press

**Not allowed:**
- Staggered section entrance cascades
- Looping animations
- Animations that run on page load without user action
- Motion for decoration only

---

## Section 6: Component Patterns

**Hero:**
- `backgroundImage` inline style on `<section>` — never an `<img>` tag (iOS Safari h-full bug)
- Pattern: `style={{ backgroundImage: 'url(...)', backgroundSize: 'cover', backgroundPosition: 'center' }}`
- Overlay: `<div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80">`
- Content: `<div className="relative z-10">` — H1 in font-serif + one CTA
- Exactly ONE image per app. Zero in features sections, cards, or anywhere below the hero.

**Navbar:**
- Sticky top, `bg-ink`, `text-paper`, responsive hamburger on mobile
- Auth-aware: shows Login/Signup when logged out, email + logout when authenticated

**Footer:**
- `bg-ink`, links to `/privacy` and `/terms`, copyright, app-specific

---

## Section 7: Copy & Voice

- 8th grade reading level maximum. Short sentences. Active voice.
- Headlines state the outcome, not the feature.
- CTAs are specific verbs: "Start building" not "Get started"
- Error messages: what went wrong + exactly how to fix it. Never raw error codes.
- Empty states: headline + one sentence of context + one clear action
- No lorem ipsum anywhere — not even in development

---

## Section 8: Accessibility (WCAG 2.1 AA)

Non-negotiable on every generated app:

- All text: 4.5:1 contrast ratio minimum (3:1 for large text 18px+)
- Interactive elements: keyboard navigable, visible focus states — never hidden
- Form inputs: always have associated `<label>` above the input, never placeholder-only
- Color: never the only way to convey information — always pair with text or icon
- Images: descriptive `alt` text; decorative images have `alt=""`
- ARIA roles on custom components (modals, dropdowns, tabs)
- Skip to main content link at top of page
- Touch targets: minimum 44×44px with 8px spacing between them

---

## Section 9: Security Defaults

Generated into every app via the build pipeline:

- CSP in `vercel.json`: `default-src 'self'`, Google Fonts whitelisted, Supabase whitelisted
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `frame-ancestors 'self' https://sovereignapp.dev`
- `X-Frame-Options`: set programmatically by the build pipeline (not in generated app code)
- RLS enabled on every Supabase table with explicit policies
- No service role key ever in client code
- Soft deletes on all user data tables

---

## Section 10: The Audit Checklist (35 checks)

Run before any app is considered shippable.

**Design (4)**
- [ ] Would a non-developer be proud to show this to a client?
- [ ] Does every interactive element look interactive without explanation?
- [ ] Are all empty, loading, and error states designed?
- [ ] Does it look and feel like a $10,000 agency built it?

**Copy (3)**
- [ ] Does the landing page pass the 5-second test?
- [ ] Is every piece of copy at 8th grade reading level or below?
- [ ] Has every unnecessary word been removed from every screen?

**Usability (4)**
- [ ] Is every screen's primary action immediately obvious?
- [ ] Can a user dropped onto any page instantly know where they are and what to do?
- [ ] Are all form fields labeled above the input — never placeholder-only?
- [ ] Does every action produce visible feedback within 100ms?

**Information Architecture (3)**
- [ ] Does the navigation reflect how users think, not how the database is structured?
- [ ] Can a new user complete the core loop in under 3 minutes without instructions?
- [ ] Is every core feature reachable in 3 clicks or fewer?

**User Story (2)**
- [ ] Does every feature in the app map to a specific moment in the user's story?
- [ ] Is the primary user's journey complete end-to-end with no dead ends?

**Product (3)**
- [ ] Does the README contain a clear problem statement and outcome goals?
- [ ] Does every feature map to at least one user story?
- [ ] Does the app instrument the primary metric?

**Execution (3)**
- [ ] Does the README include a NEXT STEPS section?
- [ ] Does the dashboard answer "what should I do right now?" without explanation?
- [ ] Does every empty state have a single recommended next action?

**Accessibility (3)**
- [ ] Does all text meet 4.5:1 contrast ratio?
- [ ] Does every interactive element have a visible focus state?
- [ ] Is color never the only way information is conveyed?

**SEO (3)**
- [ ] Does every page have a unique title tag and meta description?
- [ ] Is there one H1 per page with a logical heading hierarchy?
- [ ] Are Open Graph tags present?

**Security (3)**
- [ ] Is RLS enabled on every Supabase table?
- [ ] Are security headers present in `vercel.json`?
- [ ] Are there no secrets in client code?

**Resilience (3)**
- [ ] Does every component that fetches data handle loading, error, and empty states?
- [ ] Does every form preserve user input on submission failure?
- [ ] Does every OAuth or external redirect store state before leaving and restore it on return?

**Dark Mode (3)** — added 2026-03-28
- [ ] All colors use CSS custom properties (`var(--color-*)`) — not hardcoded hex values in component styles
- [ ] `:root` defines both light and dark variants via `prefers-color-scheme`
- [ ] `<html>` element has `color-scheme="light dark"`

---

*Total: 35 checks. Every check must pass before an app ships.*

---

## Section 11: Dark Mode System

**Principle:** Dark mode is not a feature. It is the default. Every generated app supports both modes automatically. CSS custom properties are the mechanism. Hardcoded hex values in component styles are a design system violation.

### The Custom Property System

All colors are defined as CSS custom properties on `:root`. Component styles reference only these variables — never raw hex.

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

@media (prefers-color-scheme: dark) {
  img:not([src*=".svg"]) {
    filter: brightness(0.9);
  }
}
```

### HTML Element

The `<html>` element carries the color-scheme hint so the browser renders scrollbars, form controls, and system UI in the correct mode:

```html
<html lang="en" color-scheme="light dark">
```

### Usage in Components

```css
/* WRONG — hardcoded hex in component style */
background-color: #f2efe8;

/* RIGHT — CSS custom property */
background-color: var(--color-bg);
```

In Tailwind: extend the theme to map utility classes to the custom properties:
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

### Status Colors

Status colors also adapt. Never hardcode `text-green-600` for success — use `var(--color-success)` so dark mode gets the accessible lighter variant automatically.

### Design System Violations (will be flagged in audit)

- Any raw hex value in component CSS outside of `:root`
- `prefers-color-scheme` media queries with hardcoded hex in component files
- Missing `--color-*` tokens in `:root`
- `color-scheme` attribute missing from `<html>`

---

## Section 12: Translation Readiness

**Principle:** Sovereign generates English apps that are ready to become multilingual apps. The architecture never assumes English is permanent. The UI never assumes one language is enough. Full translation is one prompt away.

### The Six Rules

Every generated app follows these six rules at zero cost to the English experience:

**Rule 1 — `lang` attribute**
The `<html>` element has `lang="en"`. This is guaranteed by `run-build.ts`. Never override it without also updating it when locale changes.

**Rule 2 — Expandable containers**
All layout containers allow 30% text expansion. German and Finnish words are 30–40% longer than English equivalents. Fixed-width containers break translated UIs.
- Use `min-width`, not `width`, for buttons containing text
- `className="min-w-[120px]"` — not `className="w-[120px]"`
- Never set `overflow: hidden` on containers holding translatable text

**Rule 3 — No inline strings in structural components**
No text hardcoded directly inside Navbar, Footer, or card layout components. All visible strings come from props or named constants.
```tsx
/* WRONG */
<button>Sign in</button>  {/* inside Navbar */}

/* RIGHT */
<button>{props.signInLabel ?? 'Sign in'}</button>
```

**Rule 4 — Intl API for dates**
```ts
/* WRONG — hardcodes en-US locale */
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

**Rule 6 — lang attribute update on locale change**
If i18n is added later, the lang attribute must update:
```ts
document.documentElement.lang = locale
```

### When Full i18n IS Generated

Full i18n (`src/lib/i18n.ts`, locale switching UI, RTL support) is only generated when the user explicitly asks for multiple language support. The translation-readiness rules above are the default — they cost nothing and make the upgrade seamless.

### Scoring in the Confidence Engine

| State | Score |
|-------|-------|
| Translation-ready (default, no library) | 85 |
| Has i18n library, no locale switcher | 90 |
| Full i18n with locale switcher | 95 |
| Full i18n + RTL support | 100 |

*Added: 2026-03-28*
