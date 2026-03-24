# Sovereign — Engineering Rules

Rules that apply to every session, every commit, every generated scaffold.

---

## The Quality Standard — The Jony Ive Bar

Every generated app must pass this test before shipping:
**"Would this feel at home in an Apple keynote?"**

Every scaffold must also pass:
**"Would a senior engineer at Stripe, Linear, or Vercel be proud of this?"**

This is not a landing page generator. Every app Sovereign builds is indistinguishable from a product that went through 6 months of design sprints and a senior engineering team.

---

## Pre-Ship Quality Gate

Before marking any generated scaffold as complete, verify ALL of the following:

### Build
- [ ] `npm run build` exits 0 locally
- [ ] No TypeScript errors (`tsc` clean)
- [ ] No console errors on page load
- [ ] No relative imports missing `.js` extensions in `api/` files
- [ ] No curly/smart quotes inside string literals

### Design
- [ ] Every page looks beautiful at 375px (mobile-first)
- [ ] Typography has clear hierarchy — serif headlines, mono body
- [ ] Spacing uses the 4/8/16/24/32/48/64px scale
- [ ] Colors never more than 5 in the entire app
- [ ] Every interactive element has hover, focus, and active states
- [ ] WCAG AA contrast (4.5:1 text, 3:1 UI) on every element

### Engineering
- [ ] Loading states on every async operation (skeleton or spinner)
- [ ] Error states with recovery actions on every async operation
- [ ] Empty states with helpful copy and a primary action
- [ ] Error boundaries wrapping major page sections
- [ ] All routes load without blank screens

### Content
- [ ] No lorem ipsum — not even in development
- [ ] All CTAs tell the user exactly what happens next
- [ ] Error messages are human, not technical
- [ ] Every empty state is warm and helpful

### Motion
- [ ] Key elements fade+translate in on entrance (200ms)
- [ ] Smooth transitions between states (150-300ms)
- [ ] Delight moments on success (confetti on RSVP confirm, etc.)
- [ ] Nothing gratuitous — every animation has a purpose

---

## Scaffold Templates

**Always run `npm run build` locally before considering a scaffold template production-ready.**
Never ship a template that hasn't passed a clean build. Vercel's build environment is stricter than `vite dev` — tsc runs before Vite and will catch errors that the dev server silently ignores.

---

## Generated App Code

**No curly/smart quotes inside string literals.**
Claude uses Unicode curly apostrophes (') and smart quotes (" ") in prose. Inside a JS/TS string literal they terminate the string early and cause cascading tsc failures. Use double quotes or template literals when a string contains an apostrophe.

**No React namespace type references.**
With `"jsx":"react-jsx"`, use named type imports: `import { type FormEvent } from 'react'`. Never `React.FormEvent`, `React.ReactNode`, etc.

**No path aliases.**
Never `@/components/Foo`. Always `../components/Foo`. vite.config.ts does not define aliases.

**Every import must resolve.**
Every import statement must reference a file that exists in the generated files array. Dead imports fail tsc immediately.

---

## API Routes (`api/`)

**All relative imports must end in `.js`.**
Node ESM requires explicit `.js` extensions on relative imports. Missing extensions cause `ERR_MODULE_NOT_FOUND` on every cold start in production.

**Every route must be rate limited.**
Use `checkRateLimit` from `./_rateLimit.js` as the first check in every handler.

**Never log env var values.**
Use `echo "Set: ${#VAR} chars"` to verify length. Never print the value.
