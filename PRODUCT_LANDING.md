# Product Requirements — Sovereign Landing Page Rebuild
**Status:** Draft — Awaiting approval before implementation
**Author:** Autonomous PRD session
**Date:** 2026-03-24
**Version:** 1.0

---

## What we're building

We are rebuilding the Sovereign landing page so it works as both the front door and a living proof of concept. The page has two versions — one for people with app ideas who can't code, and one for developers who want a faster build pipeline — with a single toggle to switch between them. Both versions share the same structure and brand, but the headline, subhead, input, and social proof change depending on who is reading. The default view is for the idea person. Every design choice on this page — the typography, the spacing, the copy, the animations — follows the exact same 15-standard system that Sovereign applies to every app it generates. A small badge at the bottom confirms that this page was built with Sovereign. When someone lands here, they should feel like they just found the tool they did not know existed.

---

## Who it's for

### Door 1 — The Idea Person (default)

**Who they are:** Non-technical founders, solopreneurs, and freelancers who have been sitting on an idea for months. They tried Lovable or Webflow and got stuck. They have a vision but can't write code. They are not afraid of technology — they just don't have time to learn it.

**What keeps them up at night:**
- "I know what I want to build. I just can't build it."
- "I spent $3,000 on a developer who built the wrong thing."
- "I don't want to depend on a no-code platform that can disappear tomorrow."

**What makes them click:** Seeing their idea generate a real app — not a mockup, not a template, an actual deployable React app with their name on it — before they are asked for a credit card.

**The proof point they need:** Someone like them shipped something real. Not a tech person. A florist who built a booking app. A consultant who launched a client portal.

---

### Door 2 — The Developer (secondary)

**Who they are:** Solo developers and small agency owners who are tired of scaffolding the same boilerplate for every project. They know React, TypeScript, and Supabase. They want to skip the setup and get to the interesting work. They use Cursor or GitHub Copilot but they still spend two hours configuring every new project.

**What keeps them up at night:**
- "I waste the first day of every project on the same setup."
- "I want to own the output. No vendor lock-in."
- "I need to bring my own API keys — I'm not trusting my data to a SaaS black box."

**What makes them click:** A one-line terminal command. Immediate access. No friction. They want to see `npx sovereign-app@latest` and have it just work.

**The proof point they need:** Full code ownership. GitHub repo. Runs locally. No Sovereign dependency after generation.

---

## The aha moment

**For the idea person:** The moment their idea disappears from the text box and comes back as an app name, a color palette, and a list of files — before they sign up for anything. The feeling is: *"It understood what I meant."*

**For the developer:** The moment they run the command and see 19 production-ready files appear in their directory in under 90 seconds. The feeling is: *"I just saved a day of work."*

Both aha moments happen before any OAuth. Generation is always the first act.

---

## Copy hierarchy

### Nav

| Element | Copy |
|---------|------|
| Logo | `sovereign` |
| Links | How it works · Pricing · Dashboard |
| Primary CTA | Start building |

The logo uses the Playfair Display serif wordmark. No tagline in the nav — the hero handles positioning.

---

### Hero (shared across both doors, language changes per toggle)

**Door 1 — Idea Person (default)**

| Element | Copy |
|---------|------|
| Eyebrow | Your idea. Your code. Your app. |
| H1 line 1 | Describe what you want. |
| H1 line 2 | We build it. |
| H1 line 3 (italic) | You own it. |
| Subhead | Type your idea below. Sovereign generates a complete, deployable app — React, TypeScript, live on Vercel — in minutes. No code required. |
| Toggle label | I am a… |
| Toggle option 1 (default) | Idea person |
| Toggle option 2 | Developer |

**Door 2 — Developer**

| Element | Copy |
|---------|------|
| Eyebrow | Open source. Full control. Zero lock-in. |
| H1 line 1 | Your scaffold. |
| H1 line 2 | Your keys. |
| H1 line 3 (italic) | Your codebase. |
| Subhead | One command generates a 19-file React + TypeScript + Supabase app with RLS, rate limiting, security headers, and a CI/CD pipeline. Yours to own, extend, and deploy anywhere. |

---

### Input section (Door 1 — Idea Person only)

| Element | Copy |
|---------|------|
| Textarea label | What do you want to build? |
| Placeholder (rotating) | "A booking app for my yoga studio…" / "A client portal for my consulting practice…" / "A marketplace where local chefs sell meal kits…" / "A membership community for independent photographers…" |
| Submit button | Generate my app → |
| Loading state | Reading your idea… |
| Below input | Free. No signup to generate. |

---

### Terminal section (Door 2 — Developer only)

| Element | Copy |
|---------|------|
| H2 | Scaffold in seconds. Ship in minutes. |
| Subhead | Sovereign generates a production-ready codebase — not a template. Bring your own Anthropic key and run it locally, or let Sovereign handle the cloud. |
| Command | `npx sovereign-app@latest` |
| Copy label | Copy |
| Copied label | Copied ✓ |
| Stack pills | React + Vite · TypeScript · Tailwind · Supabase · Vercel · GitHub |

---

### How it works (shared, content swaps per toggle)

**Door 1 — Three steps**

| Step | Icon | Headline | Body |
|------|------|----------|------|
| 1 | → | Describe your idea | Write a sentence or a paragraph. The longer the description, the better the app. Sovereign extracts the key features automatically. |
| 2 | ✦ | We generate your app | 19 production-ready files — React components, a Supabase database schema, security headers, and full TypeScript types. Streaming live as you watch. |
| 3 | ↗ | You own everything | Connect GitHub and Vercel. Your code goes into your repo. Your app deploys to Vercel staging. You own the code and the domain. |

**Door 2 — Three steps**

| Step | Icon | Headline | Body |
|------|------|----------|------|
| 1 | $ | Run one command | `npx sovereign-app@latest` — answer three prompts, or pass flags. Works with your existing Anthropic key. |
| 2 | ✦ | 19 files, zero opinions | React + Vite + TypeScript + Tailwind + Supabase. RLS on every table. Rate limiting on every route. CSP headers in `vercel.json`. No Sovereign dependency in the output. |
| 3 | ↗ | Extend and deploy | Standard Vite project. Push to GitHub, deploy to Vercel, point your domain. Or run it locally forever. |

---

### BYOK section (see full spec below)

Headline varies per door — see BYOK spec section.

---

### Social proof (see full spec below)

---

### Pricing

Section headline: `Simple pricing.`
Section subhead: `Start free. Own your code from day one.`

---

### "Built with Sovereign" badge

See badge spec section below.

---

### Footer

See footer spec section below.

---

## Feature inventory

In document order:

| # | Section | Purpose |
|---|---------|---------|
| 1 | Persistent nav | Brand anchor, primary CTA, dashboard link |
| 2 | Hero | Positioning statement, toggle, instant orientation |
| 3 | Input (Door 1) / Terminal (Door 2) | The aha moment — product in use, above the fold |
| 4 | How it works | 3-step trust builder — demystify the process |
| 5 | Live example | One real app, generated by Sovereign, with "Built with Sovereign" link — see the output before committing |
| 6 | BYOK callout | Transparency on keys and data — handles objection before it's raised |
| 7 | Social proof | Trust before the ask |
| 8 | Pricing | Explicit tiers — close the loop before confusion sets in |
| 9 | Final CTA | One more chance to generate / install |
| 10 | "Built with Sovereign" badge | This page is proof of concept |
| 11 | Footer | Legal, links, language, promise |

---

## Two-door design spec

### Architecture

A single toggle sits inside the Hero section. It controls a `path` state variable that flows down as a prop to every section that has path-specific content. The URL updates with `?for=dev` or `?for=idea` on toggle so links can be shared. Default is `idea`.

Toggle options:
- `idea` — "Idea person" (default)
- `dev` — "Developer"

Sections that change per path:
- Hero: headline, subhead, eyebrow
- Input zone: shows textarea (idea) or terminal block (dev)
- How it works: step copy changes
- BYOK section: headline and emphasis change
- Social proof: testimonials swap

Sections that are identical:
- Nav
- Stats row
- Pricing
- Final CTA
- Badge
- Footer

### Toggle design

```
I am a…  [ Idea person ]  [ Developer ]
```

- Pills side by side, no gap
- Active pill: `#0e0d0b` background, `#f2efe8` text
- Inactive pill: `transparent` background, `#0e0d0b` text, `1px solid #e5e7eb` border
- Font: DM Mono, 13px
- Toggle label: DM Mono, 12px, `#6b6862`, left of pills
- No visual separator between label and pills — the label is prefix text
- Keyboard accessible: arrow keys move between options
- `aria-pressed` on each option, `role="group"` on container

---

## BYOK section spec

### Placement

Between "How it works" and "Social proof." Full-width section with `#0e0d0b` (ink) background, `#f2efe8` (paper) text. Creates visual contrast rhythm on the page.

### Door 1 — Idea Person

| Element | Copy |
|---------|------|
| Eyebrow | Your keys. Your data. |
| H2 | Sovereign never reads your app's data. |
| Body | Every app Sovereign generates connects to your own Supabase database. Your data never touches Sovereign's servers. Your GitHub repo is yours from the first commit. We host the build pipeline — you own everything it produces. |
| Detail line | Anthropic key optional: use Sovereign's shared model or bring your own for full privacy. |
| Link | How data stays yours → |

### Door 2 — Developer

| Element | Copy |
|---------|------|
| Eyebrow | Bring your own stack. |
| H2 | Your Anthropic key. Your Supabase org. Your Vercel team. |
| Body | Pass `--anthropic-key`, `--supabase-token`, and `--vercel-token` and Sovereign never stores a credential. Run it fully offline against a local Supabase instance. Every generated file is standard React — no Sovereign import, no Sovereign dependency, no phone-home. |
| Code block | `npx sovereign-app@latest --anthropic-key sk-... --local` |
| Link | Read the security model → |

### Visual treatment

- Dark section: `#0e0d0b` bg, `#f2efe8` body text, `#c8c4bc` secondary text
- The eyebrow uses the acid green `#8ab800`
- H2 uses Playfair Display, 36px, `#f2efe8`
- No icons — copy carries the weight
- Section padding: 96px vertical

---

## Social proof spec

### Placement

After BYOK, before Pricing. Light background (`#f2efe8`).

### What proof points to use

**Phase 1 (pre-traction):** Capability claims with specificity, not testimonials. Real metrics from the live product.

| Proof point | Copy |
|-------------|------|
| Build time | Apps generated in under 90 seconds |
| File output | 19 production-ready files per build |
| Standards | 15 quality standards applied to every app |
| Code ownership | 100% of the output is yours — no Sovereign dependency |

Layout: 4-stat grid. Each stat: large number in Playfair Display, label in DM Mono below. The numbers are in `#0e0d0b`. No icons.

**Phase 2 (post-traction):** Replace the stat grid with 3 testimonial cards. One from an idea person (non-developer), one from a developer, one from a team. Each card: quote, name, title, avatar placeholder. Door 1 shows the idea person testimonial first. Door 2 shows the developer testimonial first.

Testimonial card format:
```
"[Quote — one sentence. Maximum 140 characters.]"
— Name, Title
```

Door 1 slot (idea person testimonial — to be filled with real user):
```
"I described my yoga studio app on a Tuesday. By Wednesday it was live and I had my first booking."
— [First name], [Occupation], [City]
```

Door 2 slot (developer testimonial — to be filled):
```
"I ran npx sovereign-app@latest before my morning coffee. The scaffold it generates would have taken me three hours to write."
— [First name], [Role], [Company size] person team
```

### Trust signal below testimonials

```
🔒  No card required to generate.  Your code is yours from the first commit.
```

---

## "Built with Sovereign" badge spec

### What it is

A small, permanent, unobtrusive badge on the landing page itself that demonstrates dog-fooding. The page was built by Sovereign's own Standards Engine. The badge links to a dedicated "Built with Sovereign" showcase page (future feature) or back to the top of the landing page for now.

### Design

```
[ ✦ Built with Sovereign ]
```

- Container: `border: 1px solid #e5e7eb`, `border-radius: 999px`, `padding: 6px 14px`
- Background: `#ffffff`
- Text: DM Mono, 11px, `#6b6862`
- Icon: `✦` in acid green `#8ab800`, 10px, left of text
- Hover: border color `#0e0d0b`, text color `#0e0d0b`
- Transition: `border-color 150ms ease, color 150ms ease`

### Placement

In the footer, centered, above the copyright line. Not in the hero — it should feel earned, not self-promotional. The badge is the last thing you read on the page, not the first.

### Link target

For now: `#` (no-op scroll to top). When the showcase page is built, points to `/built-with-sovereign`.

### What it implies

By placing it on the landing page, we are saying: the standards we apply to every generated app are the same standards this page was built to. It is a contract with the user: we hold ourselves to the same bar we set for them.

---

## Pricing section spec

### Structure

Three tiers. The tier system reflects the current product reality: 7-day staging, BYOK coming, Stripe not yet built. Pricing calls to waitlist/coming soon until Stripe is wired.

### Tier 1 — Free

| Field | Value |
|-------|-------|
| Name | Free |
| Price | $0 |
| Period | forever |
| Features | 3 app generations per day · 7-day staging on Sovereign · Your GitHub repo, yours to keep · 15 quality standards on every build |
| CTA | Start building |
| Note | No card. No catch. |
| CTA action | Scroll to idea input / terminal |

### Tier 2 — Builder (featured)

| Field | Value |
|-------|-------|
| Name | Builder |
| Price | $19 |
| Period | per month |
| Badge | Most popular |
| Features | Unlimited generations · 30-day staging · Bring your own Anthropic key · Priority build queue · Email support |
| CTA | Join waitlist |
| Note | Launching soon. Waitlist is free. |
| CTA action | Scroll to waitlist |

**Why $19 not $19:** The current plan was $19/mo Pro + $49/mo Team. We rename Pro to Builder (clearer for idea people who don't know what "Pro" means relative to what they need) and keep the price.

### Tier 3 — Team

| Field | Value |
|-------|-------|
| Name | Team |
| Price | $49 |
| Period | per month |
| Features | Everything in Builder · 5 seats · Bring your own Vercel team · Shared Supabase org · Priority support |
| CTA | Join waitlist |
| Note | Perfect for small agencies and co-founders. |
| CTA action | Scroll to waitlist |

### Pricing promise

```
🔒  Your code is yours whether you pay or not.
     Cancel any time. No lock-in. No lock-out.
```

### BYOK callout in pricing

Under the Builder and Team tiers, a single line:

```
✦  Bring your own Anthropic key — your generations, your costs, your privacy.
```

This is styled in DM Mono, 12px, acid green `✦`, `#6b6862` text. It is not a feature bullet — it appears as a footer note under the feature list, before the CTA button.

---

## Footer spec

### Structure

```
[ Logo wordmark ]

[ Nav links row ]
How it works   Pricing   Dashboard   Docs (coming)   GitHub

[ Promise statement ]
Every app Sovereign generates is yours — code, data, domain.
No lock-in. No dependency. No permission required.

[ Language selector ]
EN  ES  FR  DE

[ Built with Sovereign badge ]
[ ✦ Built with Sovereign ]

[ Legal row ]
© 2026 Sovereign App  ·  Privacy  ·  Terms  ·  Security
```

### Promise statement

This is not a tagline. It is a one-sentence contract with the user. It lives in the footer of every page. It uses DM Mono, 13px, `#6b6862`.

### Language selector

Same LangBar component as today: EN · ES · FR · DE. Persists across sessions via localStorage (not sessionStorage — this is a preference, not auth).

### Social links

GitHub only. No Twitter/X until there is active presence to link to. Adding ghost links is worse than having none.

---

## Sovereign Standards checklist

This page is classified as **STANDARD** tier (it has user interaction, auth flows, and conversion goals).

| # | Standard | How this page meets it |
|---|----------|----------------------|
| 1 | Design (Jony Ive) | Paper background, Playfair headings, DM Mono body. One primary action per section. Every element earns its place. All 15 Sovereign design tokens applied. Motion only on scroll reveal and toggle transition. |
| 2 | Copy & Voice (Apple) | 8th grade reading level enforced. Headlines state the outcome: "Describe what you want. We build it." CTAs are specific verbs: "Generate my app", "Start building". Zero jargon. No "Get started." |
| 3 | Marketing & Positioning (Seth Godin) | Purple cow is the generation experience itself — nobody shows you the output before asking you to sign in. The 5-second test: "Describe your idea. We generate the app. You own the code." Passes in 3 seconds. |
| 4 | Attention & Growth (Gary Vee) | Hero + input above the fold on mobile. First 3 seconds: eyebrow → H1 → input or command. Every section advances toward generation or conversion. No section exists for decoration. |
| 5 | SEO & Conversion (Neil Patel) | Unique title tag: "Sovereign — Build apps without writing code." Meta description ≤160 chars. One H1 on the page. Semantic HTML throughout: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<article>`. OG tags for both audiences (door 1 default). |
| 6 | Usability (Don Norman) | Every interactive element looks interactive. Toggle pills have clear active/inactive states. Input textarea has a label. Submit button disables while generating. Five feedback states on every button: default, hover, active, loading, success/error. |
| 7 | Simplicity (Steve Krug) | Trunk test passes: user dropped on any section immediately knows it's Sovereign, what it does, what to do next. Words halved twice from first draft. No instructions nobody reads. Toggle is labeled. |
| 8 | Information Architecture (Rosenfeld) | Sections in user mental model order: what is this → how does it work → why trust it → what does it cost → act. Navigation labels use user words, not internal terms. Every section linkable by ID. |
| 9 | User Story Mapping (Patton) | Two complete journeys mapped: idea person arrives → reads → generates → builds / developer arrives → reads → copies command → runs. No dead ends. Every CTA has a clear next action. |
| 10 | Product Requirements (Cagan) | Four risks resolved: Value (generation before signup), Usability (input is a textarea — everyone knows how to use it), Feasibility (SSE streaming already live), Business (3-tier pricing, free generates demand). |
| 11 | Execution (GTD) | Page has one job: generate demand for builds. Every section answers: "What do I do next?" Primary action always visible. No waiting states that strand the user. |
| 12 | Accessibility (WCAG 2.1 AA) | All text ≥4.5:1 contrast on paper background. `#6b6862` only used on paper (passes 4.51:1). Toggle keyboard-accessible with arrow keys. Skip to main content link in `<head>`. All images have alt text. Touch targets ≥44px. Focus-visible on every interactive element. |
| 13 | Security (OWASP) | No secrets in client code. Rate limiting on all API routes called from this page (`/api/generate`, `/api/extract-brief`). CSP headers in `vercel.json` covering all external origins. No localStorage for any auth state. |
| 14 | Nielsen Norman 10 Heuristics | 1. Status: generating state shows SSE progress messages. 2. Match real world: "Generate my app" not "Submit." 3. User control: back to idea at any stage. 4. Consistency: every CTA follows same visual grammar. 5. Error prevention: email validated inline. 6. Recognition: rotating placeholders teach, don't require memory. 7. Flexibility: short ideas skip extraction, long ideas get brief confirmation. 8. Minimalist: no decorative elements. 9. Error recovery: every error message names what went wrong and offers retry. 10. Help: empty generate result offers "Try again" with a new idea. |
| 15 | Resilience & Recovery (iOS HIG) | Three states designed for every async operation: generating (spinner + SSE message), success (spec panel), error (message + retry). SSE stream failure falls back gracefully. Rate limit shows human message + cooldown time. OAuth failure returns user to landing with error param + clear message. No blank screen under any condition. |

---

## What we're NOT building

**Explicit scope cuts — read before writing a single line of code:**

1. **No new pages.** This is a single-page rebuild. `/dashboard`, `/building`, `/brain-dashboard` are untouched.

2. **No new API routes.** All generation, extraction, and waitlist endpoints already exist. This is a frontend rebuild only.

3. **No video.** No hero video, no demo embed, no autoplay. The generation experience itself is the demo — live and interactive.

4. **No testimonial management system.** Testimonials are hardcoded strings in the component for now. A CMS is a Phase 3 item.

5. **No showcase page.** The "Built with Sovereign" badge links to `#` for now. The showcase (`/built-with-sovereign`) is a separate feature.

6. **No Stripe integration.** Pricing CTAs go to waitlist. Billing is Phase 3.

7. **No new i18n keys until copy is finalized.** All new copy goes into `src/lib/i18n.ts` only after this PRD is approved. Do not add keys during the PRD phase.

8. **No live preview iframe.** The result panel shows file list, color swatch, tier, and standards — same as today. A rendered iframe preview is a Phase 2 item (documented in PRODUCT.md).

9. **No A/B testing infrastructure.** One page, one design. No split testing tooling added.

10. **No blog, changelog, or docs section.** Footer links "Docs" as coming soon. No content section on the landing page.

11. **No changes to `api/` directory.** This rebuild touches only `src/App.tsx`, `src/App.css`, `src/lib/i18n.ts`, and possibly `src/styles/tokens.css`.

---

## Success criteria

### Immediate (day 1 after launch)

- [ ] 5-second test: three independent people, given the URL cold, correctly describe what Sovereign does within 5 seconds without asking
- [ ] Both toggle doors fully functional, URL param updates, keyboard accessible
- [ ] Generation flow identical to today — no regression in idea → generate → build path
- [ ] Confidence Engine score on the rebuilt page: ≥90/100 (up from 86)
- [ ] `npm run build` exits 0, zero console errors on page load

### 7-day signal

- [ ] Waitlist signups increase vs. the 7 days prior (baseline to be established)
- [ ] Generation starts increase vs. the 7 days prior
- [ ] Bounce rate on mobile decreases (hero + input above the fold on 375px)

### 30-day signal

- [ ] Idea → generation → GitHub OAuth conversion rate established and ≥15%
- [ ] Developer door receives ≥20% of traffic (indicates both audiences are finding the page)
- [ ] At least 3 organic "Built with Sovereign" mentions (badge drives word of mouth)

### Definition of done

The landing page is done when:
1. A non-developer can arrive, understand the product, type their idea, and reach the generate result — without reading instructions
2. A developer can arrive, see the command, copy it, and understand exactly what they get — without reading documentation
3. Both journeys work on a 375px mobile screen with no horizontal scroll and no content cut off
4. The Sovereign Confidence Engine scores the rebuilt page ≥90/100

---

*This PRD covers the landing page only. It does not authorize changes to any other page, route, or API.*
*Approve this document before any code is written.*
