# Sovereign App

Self-hosted AI dev environment bootstrapper. Tagline: "Build without permission."

## Stack
- React + Vite + TypeScript
- Supabase (auth + database)
- Deployed to Vercel → sovereignapp.dev

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview build

## Structure
- src/App.tsx — main landing page (single component file)
- src/App.css — all component styles
- src/styles/tokens.css — CSS design tokens (edit colours/fonts here)
- src/styles/global.css — resets and base styles
- src/lib/i18n.ts — all copy in EN/ES/FR/DE (edit text here)
- src/lib/supabase.ts — Supabase client + joinWaitlist()

## Brand tokens
- Paper: #f2efe8 (main background)
- Ink: #0e0d0b (text + dark sections)
- Green: #c8f060 (primary accent — CTAs only)
- Fonts: Playfair Display (serif headings) + DM Mono (everything else)

## Contrast tokens (WCAG AA verified)
- --text-dim: #6b6862 (4.51:1 on paper) ← use for captions, meta, pills
- --text-on-dark-dim: rgba(255,255,255,0.55) (6.25:1 on ink) ← use for dark section fine print

## Waitlist table (Supabase)
- Table: waitlist
- Columns: id (uuid), email (text, unique), created_at (timestamp), source (text)

## Environment variables
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
Both in .env (already set up, not committed)

## Accessibility
Accessibility is built in by default. Every UI element must meet WCAG AA contrast ratio (4.5:1 for text, 3:1 for UI components). Never use light text on light backgrounds or dark text on dark backgrounds. Always test color combinations before shipping.

## Next steps
- Deploy to Vercel and point sovereignapp.dev DNS
- Wire Stripe for Pro plan ($19/mo) and Team plan ($49/mo)
- Build Phase 2: npx sovereign-app@latest CLI

## Phase 4 — CLI Features

### Figma Design System Import

Three levels of depth, shipped in sequence:

**Level 1 — Token extraction (v1, buildable in days)**
- User provides Figma file URL + personal access token
- Sovereign calls Figma REST API, reads all color styles, text styles, spacing values
- Converts to src/styles/tokens.css in the user's repo
- CSS custom properties: --color-primary, --color-surface, font families, sizes, weights, line heights
- Covers 80% of what developers need from a design handoff

**Level 2 — Component detection (v2, buildable in weeks)**
- Detect the 5 most common components in the Figma file: button, input, card, navbar, modal
- Generate typed React components from each
- Components land in src/components/ in the user's repo
- Developer owns the output — no Sovereign dependency

**Level 3 — Full layout translation (v3, buildable in months)**
- Read entire Figma node tree (frames, auto-layout, instances)
- Solve four hard problems:
  1. Layout translation — auto-layout → CSS flexbox/grid, infer layout even when auto-layout wasn't used
  2. Component recognition — map visual patterns to semantic HTML and React components
  3. Responsive intent — infer mobile behavior from desktop-only frames
  4. Code quality — post-process raw output through Claude API to produce clean, semantic, accessible React + Tailwind
- Claude API is the primary translation layer (not just cleanup)
- This is Sovereign's answer to Figma Make and Builder.io
- Competitive angle: they use AI as a cleanup pass, Sovereign uses it as the core engine

**CLI flow (Phase 4):**
npx sovereign-app@latest
→ "Do you have a Figma design system? (y/n)"
→ Paste Figma file URL
→ Paste Figma personal access token
→ Sovereign extracts tokens → tokens.css committed to repo
→ (Level 2+) Components generated → src/components/

**Key principle:**
Everything extracted from Figma lives in the user's repo in standard files they own. No Sovereign lock-in. If they stop using Sovereign, their tokens and components remain unchanged.
