# Landing Page Agent Briefs
**Project:** Sovereign landing page rebuild
**Classification:** STANDARD tier — user interaction, conversion, two-audience split
**Status:** Creative briefs only. No code.

---

## EXECUTIVE SUMMARY

Every agent brief below converges on the same finding: the landing page's single job is to collapse the distance between "I have an idea" and "I am watching my app generate." The page fails when it asks visitors to understand Sovereign before they experience it. It succeeds when experiencing it *is* understanding it. The toggle, the headline, the stats — none of these are the product. The textarea is the product. The terminal command is the product. Every design decision, every word, every affordance on this page must serve one goal: get the visitor's cursor into the input or their finger on the copy button before they have time to wonder whether Sovereign is for them. The aha moment is not a claim. It is an event. The page's job is to make that event happen as fast as possible.

---

## AGENT 1 — JONY IVE (Design)

*Standard 1: Design — The Jony Ive standard*

### What is the single dominant visual element?

The textarea. Not the logo. Not the headline. The textarea — or on the developer door, the terminal command block — is the only thing on this page with full visual weight. Everything above it is context. Everything below it is justification. The eye must land on the input before it lands anywhere else. This is achieved through placement (center, vertical optical center of the viewport on desktop and top-third on mobile), scale (taller than any textarea on a competitor's page — 120px minimum height, expands as the user types), and restraint (nothing nearby competes for attention).

On the developer door: the command block replaces the textarea. Same dominant placement. Different affordance.

### What gets removed that other landing pages keep?

- Hero image or product screenshot. The product is interactive — a screenshot is inferior to the real thing.
- Feature grid with icons. Features are not the story. The transformation is the story.
- Testimonial carousel. Carousels are for people who cannot decide which proof point is strongest. Decide.
- A "How it works" section with numbered circles and abstract icons. Real steps replace abstract steps.
- Navigation dropdowns. One page. Five links maximum. No dropdowns.
- Animated gradient hero backgrounds. Paper (`#f2efe8`) is the background. It communicates calm confidence, not hype.
- The word "platform." The word "solution." The phrase "all-in-one." These have never once convinced a visitor of anything.
- A sticky newsletter popup. The input is already on the page. Never interrupt the moment you're trying to create.

### What does the white space communicate?

Confidence. Companies that have nothing to hide leave room to breathe. The paper background with generous vertical rhythm between sections tells the visitor: we are not desperate for your attention, we are comfortable waiting for you to read at your own pace. White space is not absence — it is the product saying "we know what we are."

Specific applications:
- 160px between the hero toggle and the textarea section on desktop
- 96px section padding above and below every section
- 48px between the H2 and the body copy within each section
- The "Built with Visila" badge floats in its own 40px vertical breathing room in the footer
- The stats section: stats are separated by the negative space between them, not by lines or dividers

### What is the one interaction that creates delight?

The generation stream. The moment the visitor submits their idea, the textarea transforms — it does not disappear, it collapses to a "reading…" state — and the progress messages appear below it as SSE events stream in. The visitor watches Sovereign think in real time. This is not a loading spinner. It is a window into the process. Each progress message appears with a 200ms fade-in. The sequence might read:

```
Reading your idea…
Identifying key features…
Designing your information architecture…
Applying 15 quality standards…
Generating 19 files…
```

When the result arrives, the spec panel slides up (translateY 24px → 0, opacity 0 → 1, 300ms ease-out). The app name appears in Playfair Display at 28px. The primary color renders as a 40px filled circle. The file tree appears below.

This is the page's one moment of delight. Everything else serves it. Nothing else competes with it.

---

## AGENT 2 — APPLE COPYWRITER (Copy)

*Standard 2: Copy & Voice — Apple content strategist standard*

### Hero headline (max 6 words)

**Door 1 (idea person):**
> Your idea, live today.

Three words carry the promise. "Your idea" — ownership from the first phrase. "live today" — the timeline that changes everything. The comma is load-bearing: it makes you pause on "your idea" before hearing the answer.

**Door 2 (developer):**
> Your scaffold. Your rules.

Parallel structure. Ownership repeated. No verb needed — the nouns do the work.

### Hero subhead (max 12 words, 8th grade)

**Door 1:**
> Describe your app. We generate it. You own the code.

Twelve words. Three sentences. Three promises. No jargon. Reading level: grade 5.

**Door 2:**
> One command. 19 files. Production-ready. No Sovereign dependency.

Four noun phrases. Each one answers a developer's objection before it's raised.

### CTA text (max 3 words)

**Door 1:** `Generate my app`
**Door 2:** `Copy command`

Both are specific. Both use first person ("my") or action ownership ("Copy"). Neither says "Get started." Neither says "Try for free." Neither says "Learn more."

### What words are banned on this page?

The following words and phrases are banned. If any appear in the implementation, they must be removed before launch:

| Banned | Reason |
|--------|--------|
| Platform | Means nothing. Everyone is a platform. |
| Solution | Corporate. Nobody calls their product a solution to their own face. |
| Seamless | Has never been true once in the history of software. |
| Powerful | Every product claims to be powerful. |
| Intuitive | If you have to say it, it isn't. |
| Get started | Passive, generic, says nothing about what happens next. |
| Sign up for free | The word "free" belongs in pricing, not CTAs. |
| All-in-one | Synonym for "we can't decide what our product is." |
| Revolutionary | Banned in 2010. Still banned. |
| Leverage | Business jargon. Banned from every screen. |
| Utilize | Use "use." |
| Best-in-class | Self-awarded superlative. Meaningless. |
| We're excited to | Nobody is excited. Write what the user will feel, not what you feel. |
| Game-changing | See: Revolutionary. |
| Cutting-edge | See: Powerful. |
| World-class | Use world-class behavior. Don't claim it. |
| Journey | Unless you mean the band. |

### Tone in one word

**Assured.**

Not excited (excitement belongs to the user, not the product). Not humble (false modesty is still dishonesty). Not clever (cleverness serves the writer, not the reader). Assured: we know what this is, we know who it's for, we are comfortable letting you decide.

---

## AGENT 3 — SETH GODIN (Positioning)

*Standard 3: Marketing & Positioning — Seth Godin standard*

### What is the specific person this page is written for?

**Primary (Door 1):** The 34-year-old solopreneur who has described their app idea to three different developers, received three different quotes between $8,000 and $22,000, and is now wondering if they should "just learn to code." They are not afraid of technology. They use Notion, Stripe, Canva. They have a working business. They have a clear idea. What they lack is the 18 months it would take to build it themselves and the budget to pay someone else. They tried Bubble and felt limited. They tried Webflow and needed a developer anyway. They are exactly one "what if I could just describe it and it builds itself" moment away from becoming a Sovereign user.

**Secondary (Door 2):** The freelance developer who has built the same React + Supabase boilerplate seventeen times and is charging clients for work they could automate. They use VS Code, Cursor, and GitHub Copilot. They are productive. They are also tired. They want to go from "client gave me a brief" to "running app in development" in under ten minutes. They are skeptical of tools that take control away from them. Their one non-negotiable: they must own the output completely.

### What is the remarkable thing — the purple cow?

**You generate before you sign up.**

This is the remark. Every competitor — Lovable, Builder.io, Webflow, v0, Bolt — requires account creation before the product does anything interesting. Sovereign inverts this. The generation happens first. The signup happens after the visitor has already seen their idea become an app. By the time they're asked to connect GitHub, they already own the result emotionally.

The remark is not the 15 quality standards. The remark is not BYOK. The remark is not the 19-file scaffold. The remark is: **you see your app before you give us anything.** That is the thing worth talking about. That is what gets shared.

### What does this page say that no competitor can say?

> "The code you get is completely free of Sovereign. Once you build, you never need us again."

No competitor can say this. Lovable has a Lovable dependency in the output. Builder.io requires Builder.io for CMS. v0 produces components, not apps. Webflow is the host. Every alternative creates some form of lock-in — either in the code, the hosting, the CMS, or the data layer.

Sovereign generates standard Vite + React + TypeScript + Tailwind + Supabase. The output runs identically whether Sovereign exists or not. This is not a positioning claim. It is a technical fact. Lead with the technical fact.

### What is the smallest viable audience?

**For Door 1:** Solo founders who have already tried and been frustrated by one alternative. Not people who have never heard of no-code tools — they need too much education. Not enterprises — they have developers. The specific person: one idea, no technical co-founder, willing to connect their GitHub account on day one.

**For Door 2:** Freelance developers and solo agency owners handling 2–8 client projects per year. Not junior developers who need to learn the stack. Not engineering teams who already have internal tooling. The specific person: experienced enough to recognize good boilerplate, busy enough to hate writing it again.

If Sovereign serves these two specific people excellently, everyone else is gravy.

---

## AGENT 4 — GARY VEE (Growth)

*Standard 4: Attention & Growth — Gary Vaynerchuk standard*

### What is the viral hook?

The generated spec result screen. Specifically: the moment the visitor's idea becomes an app name + primary color + 19 file names. This is a screenshot moment. It should be designed with the screenshot in mind.

The result panel must be readable in a screenshot: large app name in Playfair Display, the primary color circle, the tier badge, the file tree. When someone screenshots this and captions it "I just described my idea and this happened," they are doing Sovereign's marketing. Design the result panel so that screenshot reads well without context.

Secondary hook: the stats. "$0 to generate. 90 seconds to deploy." These numbers are shareable. They live as a stats strip that can be screenshotted in isolation.

### What makes someone screenshot this and share it?

Three moments, in order of likelihood:

1. **The result screen.** Their idea rendered as a real app spec. The feeling is "I can't believe this just happened from one sentence." This is the natural share moment. The result screen must have a share button: "Share this spec →" copies a link to a static spec preview (future feature) or copies the app name + tier + primary CTA copy to clipboard.

2. **The generation stream.** Watching the SSE messages arrive in real time is its own kind of magic. A screen recording of this travels. The generation stream should be clean enough to record — no debug messages, no "chunk received" noise, only meaningful progress lines.

3. **The "Built with Visila" badge.** When someone discovers the landing page itself is a Sovereign app, that is a share moment. "Wait, this page was built with the tool?" The badge at the bottom is the reveal.

### What is the "Built with Visila" badge strategy?

The badge is not a vanity label. It is a proof of standard. By placing it on the landing page, Sovereign commits: the 15 standards we apply to generated apps are applied to this page. No exceptions.

Growth mechanism: every app generated by Sovereign includes an optional "Built with Visila" badge (user can remove it). The landing page's badge is the canonical example — it shows users what the badge looks like and how it's used. When users leave the badge in their own apps, they create a distributed network of Sovereign discovery surfaces. One click on any badge brings a visitor to `visila.com`. The badge is not a tracking pixel. It is a doorway.

Badge copy options tested in order of preference:
1. `✦ Built with Visila` — clean, specific, curiosity-inducing
2. `Made with Sovereign` — generic
3. `Powered by Sovereign` — implies dependency (contradicts the message)

Use option 1.

### How does this page generate word of mouth?

Four mechanisms, only one of which requires action from Sovereign:

1. **The generation moment.** Passive. Users share screenshots of their app specs naturally.
2. **The waitlist email.** Active. The waitlist confirmation email includes: "Tell one person who's frustrated with Lovable or Cursor." This is the one explicit ask.
3. **The badge network.** Passive. Every app that keeps the badge generates discovery.
4. **The tagline itself.** "Build without permission." This is a philosophy, not a feature. Philosophies travel faster than features. People repeat taglines when they resonate with an identity they hold. The idea that you don't need permission to build something — that lands.

---

## AGENT 5 — NEIL PATEL (SEO)

*Standard 5: SEO & Conversion — Neil Patel standard*

### Primary keyword

`build app without coding`

Search intent: navigational/transactional. User knows they want to build something, is actively looking for a tool. High commercial intent. Low competition relative to generic keywords like "no-code app builder" where Webflow, Bubble, and Glide have established authority.

### Secondary keywords (max 5)

1. `AI app generator from description` — captures the generation-first differentiator
2. `deploy React app without code` — developer crossover term; captures people who know the stack but not the build process
3. `generate full stack app idea` — long-tail, high intent
4. `bring your own API key app builder` — emerging search term as BYOK becomes a known concept
5. `sovereign app builder` — branded, for when the product has name recognition

### Meta title (max 60 chars)

```
Sovereign — Build apps without writing code
```

44 characters. Brand first (Sovereign is the anchor). Outcome second. No keyword stuffing.

### Meta description (max 155 chars)

```
Describe your app idea. Sovereign generates 19 production-ready files — React, TypeScript, Supabase — and deploys it live. You own the code. Free to start.
```

155 characters exactly. Hits: what you do (describe idea), what it produces (19 files, specific stack), outcome (deploy live, own code), conversion signal (free to start).

### H1, H2, H3 hierarchy

```
H1: Your idea, live today.          [Door 1 default]
  H2: How it works
    H3: Describe your idea
    H3: We generate your app
    H3: You own everything
  H2: Your data stays yours
  H2: What others are building     [social proof section]
  H2: Simple pricing
  H2: Start building today         [final CTA]

H1: Your scaffold. Your rules.      [Door 2 — swap when toggled, via aria-live]
  H2: How it works
    H3: Run one command
    H3: 19 files, zero opinions
    H3: Extend and deploy anywhere
  H2: Bring your own keys
  H2: What developers are shipping
  H2: Simple pricing
  H2: Start today
```

Note: The H1 is swapped dynamically when the toggle changes, with `aria-live="polite"` on the region so screen readers announce the change. Search engines index the default (Door 1). The developer door is served dynamically and not indexed as a separate URL unless we implement proper routing.

### What schema markup does this page need?

**SoftwareApplication** schema on the root `<main>`:
```json
{
  "@type": "SoftwareApplication",
  "name": "Sovereign",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "description": "AI app generator that builds production-ready React apps from a plain English description."
}
```

**FAQPage** schema (to capture "People also ask" boxes):
Questions to mark up:
- "Does Sovereign own my code?" → Answer: No. The code goes into your GitHub repo on the first commit.
- "Do I need to know how to code?" → Answer: No. Describe your idea in plain English.
- "What does Sovereign generate?" → Answer: 19 files — React, TypeScript, Tailwind, Supabase — deployed to Vercel.
- "Is there a free plan?" → Answer: Yes. Generate 3 apps per day for free. No card required.

---

## AGENT 6 — DON NORMAN (Affordances)

*Standard 6: Usability — Don Norman, The Design of Everyday Things*

### What does every interactive element communicate about itself?

**Textarea (Door 1):**
- Shape: rectangular, slightly rounded (8px radius), full width of the content column
- Border: `1px solid #d4d0c8` at rest — visible enough to signal "this is a field" without shouting
- Placeholder text teaches: rotating examples show exactly the format and depth of idea the system can handle
- On focus: border shifts to `#0e0d0b` (full ink), subtle box-shadow appears — the field "wakes up"
- Resize handle visible on desktop — signals that you can write more
- Below the field: character count appears on focus ("0 / 2000") — signals there is a limit but it's generous
- The submit button is visually attached to the bottom-right of the textarea, not floating independently — signals that pressing it acts on the contents of this specific field

**Command block (Door 2):**
- Monospace font signals "this is code"
- Dollar sign prefix signals "this is a terminal command"
- A copy icon (not a button with text) sits at the right — the convention is universal among developers
- On click: icon swaps to a checkmark for 1500ms — confirms the action without requiring a toast notification

**Toggle (both doors):**
- Two pills side by side — not a checkbox, not a dropdown — pills signal discrete choices
- The active pill has full ink fill — unambiguously selected
- The inactive pill has a border but no fill — clearly available but not selected
- `aria-pressed` on each pill communicates state to screen readers
- Keyboard: arrow keys move between options (developer convention for pill groups)

**Buttons:**
- Primary (acid green fill, ink text): "Generate my app" — the most important action
- Secondary (ink fill, paper text): "Connect GitHub" — required next step, clearly ranked below primary
- Ghost (transparent, ink border): "Try again" / "Start over" — recovery actions, visually de-emphasized
- Disabled state: 40% opacity, `cursor: not-allowed` — signals unavailability without hiding the button

### Where will users look first, second, third?

**Desktop F-pattern (idea person):**
1. Logo (top left — identity anchor)
2. H1 "Your idea, live today." (optical center, large Playfair Display type)
3. Textarea (below H1, full width — the dominant interactive element)
4. Submit button (attached to textarea, bottom right)
5. "Free. No signup to generate." microcopy (below button — addresses the hesitation)

**Mobile scroll pattern:**
1. H1 (full width, 32px — fills the viewport)
2. Subhead (11px, 3 lines max)
3. Toggle (centered, 44px tap targets)
4. Textarea (fills width, 100px default height)
5. Submit button (full width, 52px tall — thumb-reachable)

### What affordance does the idea input field have?

The textarea must communicate: **"Write as much or as little as you want."**

This is achieved through:
- Minimum height of 100px (3–4 lines visible — more than a one-line search box, less than a word processor)
- Auto-expanding on type (up to 200px before scroll) — signals that more content is welcomed
- Rotating placeholder text (every 3.5 seconds) that demonstrates both short ideas ("A booking app for my yoga studio") and long ideas ("A client portal where consulting clients can see project status, upload documents, and approve invoices") — signals the range of acceptable input
- No character counter at rest — showing a limit before the user starts typing creates anxiety; show it only after they start typing or exceed 500 characters
- No surrounding decorative elements that compete for attention — the field is alone in the center of the section

### What happens on every hover, tap, and focus state?

**Textarea:**
- Hover: border brightens slightly (from `#d4d0c8` to `#b8b4ac`) — signals interactivity
- Focus: border goes full ink (`#0e0d0b`), soft shadow appears, label moves above field if floating label pattern is used
- Active (typing): no visual change — the act of typing is its own feedback

**Submit button:**
- Rest: acid green fill, ink text, full opacity
- Hover: 8% darker green — barely perceptible, confirms interactivity
- Active (click): scale to 0.97 for 100ms — physical press feedback
- Loading: spinner replaces text, disabled, opacity 0.7
- Error: button returns to rest state, error message appears below

**Toggle pills:**
- Hover on inactive pill: border darkens — signals clickability
- Click: 150ms transition between states — fast enough to feel responsive, slow enough to be perceptible
- Active pill: no hover state — selected state is already the most visually prominent state

**Nav links:**
- Hover: underline appears — 1px, offset 3px — conventional link affordance
- Active page (if applicable): ink text, full weight

---

## AGENT 7 — STEVE KRUG (Simplicity)

*Standard 7: Simplicity — Steve Krug, Don't Make Me Think*

### What is the one thing a visitor must do?

**Door 1:** Put their idea in the textarea and press enter.
**Door 2:** See the command and copy it.

Everything else on this page is support structure for one of these two actions. If a visitor does one of these two things, the page has succeeded regardless of whether they convert immediately.

### What is removed vs every competitor's landing page?

| Element | On competitor pages | On Sovereign |
|---------|-------------------|--------------|
| Hero image/mockup | Product screenshots, dashboard previews | Not present — the live product is the demo |
| Feature comparison table | ✓ (almost universal) | Not present — comparison is not Sovereign's story |
| "Trusted by" logo strip | ✓ (usually fabricated for early-stage products) | Not present until there are real logos to show |
| Pricing toggle (monthly/annual) | ✓ | Not present — annual billing not yet built |
| Cookie consent banner blocking content | ✓ (GDPR theater) | Minimal or not present — Sovereign does not use ad tracking |
| Social media icons in nav | ✓ | Not present — links to nowhere hurt credibility |
| Exit-intent popup | ✓ | Never. |
| Live chat widget covering content | ✓ | Never. |
| Countdown timer | ✓ (manipulative) | Never. |
| Confetti on page load | Some | Never on the landing page — confetti belongs on the success state |

### The 3-second test: what does someone understand in 3 seconds?

A stranger dropped on this page with no context reads, in order:
1. `sovereign` (the logo — identity)
2. `Your idea, live today.` (the H1 — the promise)
3. The textarea with placeholder "A booking app for my yoga studio…" (the mechanism — what they are supposed to do)

In 3 seconds: "This is a tool called Sovereign. I describe an idea. Something happens." That is sufficient. The "something happens" curiosity is what makes them read further or type directly.

If any visitor does not understand all three of those things in 3 seconds, the page has failed.

### What questions does this page leave unanswered that it shouldn't?

These questions must be answered on the page, in the section where they will arise:

| Question | Where it arises | Where it's answered |
|----------|----------------|-------------------|
| What does "live" mean? Do I need to pay for hosting? | After reading the H1 | In the subhead: "...deployed to Vercel. Free to start." |
| What do I get exactly? | After seeing the textarea | In the "How it works" step 2: "19 production-ready files..." |
| Do I own the code? | After seeing step 2 | In "How it works" step 3 and again in BYOK section |
| What is the catch? | After seeing "$0" | Pricing note: "No card. No catch." |
| What if it generates something I don't like? | During the generation result | The "Try again" button and "Regenerate" option |
| Can I use this if I know how to code? | Anywhere | The toggle answers this before the question forms |
| What does it generate for my specific type of app? | After typing | The spec result screen — app name, type, tier, standards |
| Is Sovereign going to own my idea? | Somewhere around pricing | BYOK section: "Your data never touches Sovereign's servers." |

No question appears after the FAQ if those answers live in context on the page.

---

## AGENT 8 — ROSENFELD (Information Architecture)

*Standard 8: Information Architecture — Rosenfeld, Morville & Arango*

### What is the navigation structure?

**Primary nav (5 items maximum):**
```
sovereign    [logo, links home]    How it works   Pricing   Dashboard   [Start building →]
```

- "How it works" → anchor link to `#how-it-works` section
- "Pricing" → anchor link to `#pricing` section
- "Dashboard" → `/dashboard` route (for users who have already built)
- "Start building" → anchor link to `#build` section (the input or command), styled as primary CTA pill

**No secondary nav.** No mega-menu. No dropdowns. The page is a single scroll — navigation is mostly anchor links.

**Footer nav (mirrors primary, adds legal):**
```
How it works   Pricing   Dashboard   GitHub
Privacy · Terms · Security
```

### How does someone who wants to read more find it?

The IA assumes two reading patterns:
1. **Scanner:** reads headlines only → understands the product → types idea or copies command → converts
2. **Deep reader:** reads everything → needs all questions answered → needs body copy that satisfies curiosity without padding

For the deep reader, each section's body copy is the "read more." There are no links away from the page for additional information. Docs are linked in the nav as "coming soon" — they do not exist yet and linking to a 404 is worse than not linking. The BYOK section has one "Read the security model →" link — this will 404 until a security model page exists, so it is conditional: show only when the linked page exists.

### How does someone who wants to start now find it?

The input / command block is in the Hero section — above the fold on desktop and mobile. The nav has "Start building →" as the rightmost item. The final section before the footer is a second CTA section. Three surfaces, zero friction.

The scroll behavior: on nav "Start building →" click, smooth-scroll to the `#build` section and focus the textarea (Door 1) or select the command text (Door 2). This is 1 click from anywhere on the page to being in the input.

### Where does the developer path diverge from the idea person path?

Both paths share the same URL and page structure. Divergence happens via the toggle:

```
Shared → [Hero section, toggle visible]
    ↓                    ↓
Idea door             Dev door
(textarea)          (command block)
    ↓                    ↓
How it works        How it works
(generate steps)    (CLI steps)
    ↓                    ↓
BYOK (subtle)      BYOK (prominent)
    ↓                    ↓
Social proof        Social proof
(founder quote)     (dev quote)
    ↓                    ↓
[Pricing — shared across both doors]
[Footer — shared across both doors]
```

The developer door never asks for an email. The idea person door asks for an email only after generation. Both paths reach pricing without any gate.

---

## AGENT 9 — JEFF PATTON (User Story Mapping)

*Standard 9: User Story Mapping — Jeff Patton*

### Idea person journey: awareness → interest → desire → action

**Awareness (how they arrive):**
"I googled 'how to build an app without coding' or followed a link from someone who shared a generated app spec. I have no strong prior impression of Sovereign."

**Interest (what keeps them on the page):**
They read the H1: "Your idea, live today." They see the textarea. They notice the placeholder cycling through examples that sound like their idea. They read the subhead: "Describe your app. We generate it. You own the code." That last sentence — "you own the code" — is the trust hook. They have been burned before by platforms that own the output.

**Desire (what makes them want it):**
They scroll to "How it works" and read step 2: "19 production-ready files — React, TypeScript, Supabase..." They do not know what React is, but the number 19 and the words "production-ready" communicate seriousness. They see the stats: "$0 to generate. 90 seconds." They scroll to pricing and see there is a free tier. They are now in the consideration zone.

**Action (what makes them type):**
They scroll back to the top (or the nav "Start building →" button scrolls them there). They type their idea. They press Enter. They watch the generation stream. They see their app name appear. That is the conversion. Everything after is logistics.

**Where the journey currently stalls on the page:**
- After the hero, if the H1 is not strong enough to justify scrolling further
- On the result screen, if the "Connect GitHub" step feels overwhelming ("I have to do what now?")
- At pricing, if the paid tier descriptions don't justify the upgrade

### Developer journey: awareness → interest → desire → action

**Awareness:**
"I saw `npx sovereign-app@latest` in a thread or was linked by a colleague. I am immediately skeptical — I have seen ten tools like this and they all disappoint me."

**Interest:**
They toggle to "Developer." They read the H1: "Your scaffold. Your rules." The possessive "your" twice in four words speaks to their core objection before it's raised. They see the command block. They read the stack pills: React + Vite · TypeScript · Tailwind · Supabase. These are their exact stack. Interest unlocked.

**Desire:**
They scroll to "How it works" and read step 2: "RLS on every table. Rate limiting on every route. CSP headers in vercel.json. No Sovereign import in the output." They have never seen a generator make these specific claims. They are now actively evaluating.

**Action:**
They copy the command. They open a terminal. They are now in the product. The landing page's job is done.

**Where the journey currently stalls:**
- If the developer toggle is not immediately visible — they will leave before they find it
- If the "19 files" claim is not substantiated by specifics — "19 files" sounds like a template, not a codebase
- If there is no evidence that the output is actually clean, idiomatic code (the "view generated code" link, when built, addresses this)

### The job-to-be-done for each

**Idea person:** "Help me hire a developer that costs $0, is available right now, and gives me something I can show someone tomorrow."

**Developer:** "Give me back the two hours I spend on boilerplate at the start of every project. I will take it from there."

---

## AGENT 10 — MARTY CAGAN (Product)

*Standard 10: Product Requirements — Marty Cagan + Sondra Orozco*

### What is the core value proposition in one sentence?

**For the idea person:**
Sovereign turns a plain English description into a deployed React app — with no code written by you and no lock-in ever.

**For the developer:**
Sovereign generates the boilerplate you've been writing by hand for years, with all the security defaults you forget to add in a rush.

**Combined (the landing page version):**
Your idea becomes a production-ready app, deployed and owned by you, in under 90 seconds.

### What assumption is this page testing?

**Primary assumption:** That the generation-before-signup mechanic converts better than signup-before-generation. The page is built on the bet that removing the auth gate from the first value moment increases the percentage of visitors who experience the product.

**Secondary assumption:** That "you own the code" is a strong enough differentiator to compete with tools that have more brand recognition. We are testing whether code ownership is a meaningful purchase driver for the idea person audience, not just the developer audience.

**Tertiary assumption:** That a two-door design serves both audiences better than a single generic message, and that the toggle does not confuse visitors who don't know which door they are.

### What metric tells us if this page is working?

**Primary metric:** Generation starts per 100 visitors (generation conversion rate). A visitor who presses "Generate my app" has engaged with the core product. This is the most meaningful signal and the only one that directly measures the page's job.

**Target:** ≥12% of unique visitors start a generation. Below 8% means the page is not communicating the product clearly enough. Above 20% means we have product-market fit signal.

**Secondary metrics:**
- GitHub OAuth starts per generation start (measures build intent following generation)
- Toggle engagement rate (measures whether the developer door is discoverable)
- Waitlist email captures (measures intent from visitors not yet ready to build)

**Anti-metric:** Time on page. A longer time on page could mean confusion, not engagement. Do not optimize for time on page.

### What would make us redesign this in 30 days?

- Generation conversion rate below 8% after 500 unique visitors
- Evidence that visitors don't understand what happens when they press "Generate" (user research: "I thought it would just show me a template")
- Evidence that the toggle is invisible (toggle engagement rate below 5%)
- Net Promoter Score below 30 among users who completed a generation
- Any accessibility failure that blocks a significant user segment from using the input

---

## AGENT 11 — SONDRA OROZCO (Living Brief)

*Standard 10 extended: Living product brief — Orozco*

### What does this page need to update automatically as Sovereign grows?

**Build count:** The stats strip should pull from a live counter. "3,421 apps generated" is more powerful than "$0 to generate" once there is real volume. This number should update from the database without a deploy. Component fetches `GET /api/stats` on load and hydrates the count client-side. Falls back to a round number if the fetch fails.

**Waitlist count:** "Join 847 others" on the waitlist CTA. Fetches from the same `/api/stats` endpoint. Adds urgency without false urgency — it is a real number.

**Recent builds:** A "What people are building" strip showing the last 10 app names generated (not the code — just the name, type, and tier). This is a social proof ticker that updates in real time. Requires a `GET /api/recent-builds` endpoint that returns sanitized app names (no emails, no personal data).

### What is static vs dynamic content?

| Content | Type | Update mechanism |
|---------|------|-----------------|
| H1, subhead, copy | Static | Deploy |
| Pricing | Static | Deploy |
| Feature bullets | Static | Deploy |
| Rotating placeholder text | Static | Deploy |
| Build count | Dynamic | API fetch on load |
| Waitlist count | Dynamic | API fetch on load |
| Recent app names | Dynamic | API fetch on load |
| Testimonials | Static until CMS built | Deploy |
| "Built with Visila" badge | Static | Never changes |

### How does the page evolve as the build count grows?

**0–100 builds:** No social proof counter. Stats are claims: "19 files generated," "15 quality standards." The product itself is the proof.

**100–1,000 builds:** Add "X apps built this week" to the stats strip. Add one real testimonial (first user willing to go on record).

**1,000–10,000 builds:** Replace the 4-stat grid with testimonials + a build counter. Add "What people are building" recent-builds ticker.

**10,000+ builds:** The page becomes a community surface. Recent builds becomes a gallery. Testimonials become case studies. The generation input moves to a dedicated `/build` page. The landing page becomes pure positioning.

---

## AGENT 12 — DAVID ALLEN (GTD)

*Standard 11: Execution — David Allen, Getting Things Done*

### What is the next action for each visitor type?

**Type 1 — Ready to build now:**
Next action: type idea → press enter. The textarea is visible above the fold. No scroll required. Zero friction.

**Type 2 — Interested but skeptical:**
Next action: read "How it works." The scroll anchor is clear. The three steps answer the core skepticism: "will it actually generate something real?"

**Type 3 — Developer evaluating:**
Next action: copy the command, run it in a spare terminal. The command is copyable with one click. They don't need to read anything else.

**Type 4 — Ready to commit but not right now:**
Next action: join the waitlist. The waitlist form is in the final section of the page. It is not the primary CTA — it is the capture net for visitors who need more time.

**Type 5 — Confused (wrong audience, wrong time):**
Next action: leave. This is acceptable. The page should not try to convert everyone. It should convert the right people efficiently and let the wrong people go quickly. A confused visitor who stays is worse than a confused visitor who bounces — they consume support resources.

### Is there any ambiguity about what to do next?

Single ambiguity to eliminate: **"I pressed generate — now what? Am I being signed up for something?"**

This is resolved by the post-generation state: after the spec appears, the copy reads "Like what you see? Connect your GitHub to build it." This is explicit: GitHub OAuth only happens if they actively choose to build. Generating is free and anonymous. Building is opt-in.

No other ambiguity should exist. If a visitor reads the page and is unsure whether they should type in the textarea or scroll further, the page has failed.

### What captures the visitor who isn't ready to build yet?

The waitlist form — but only if it is positioned correctly. It must not feel like a consolation prize. The framing:

> "Not ready to build yet? Get notified when Builder and Team plans launch — and be first in line for early pricing."

This converts visitors who are interested in the paid features but don't need to generate an app today. It also builds the list for the Stripe launch.

A secondary capture: the "idea" is saved in the URL on generation. If a visitor generates a spec but doesn't connect GitHub, their idea persists in `?idea=` on the URL. If they bookmark the page and return, their idea is pre-filled.

---

## AGENT 13 — NNG HEURISTICS (Usability)

*Standard 14: Nielsen Norman Group — 10 Usability Heuristics*

### Visibility of system status

**What the page communicates about what Sovereign does:**

The system status is visible at every stage of the generation flow:

- **Before generating:** Placeholder text in the textarea shows examples of valid ideas. The button label "Generate my app" tells the user exactly what will happen.
- **During generating:** SSE progress messages appear in real time below the textarea: "Reading your idea…" → "Identifying features…" → "Generating 19 files…". A progress indicator (not a spinner — a line of text) shows the system is working. The user is never staring at a blank screen.
- **After generating:** The spec panel appears with the app name, primary color, tier badge, and file tree. A success state is visually distinct from the loading state.
- **On error:** A human-readable error message appears: "Generation failed. Your idea was saved — try again or rewrite it slightly." Retry button immediately available.

Never: a blank screen, a silent failure, or a generic "loading…" with no additional information.

### Error prevention

**What stops a visitor from misunderstanding the product:**

1. **The toggle is labeled.** "I am a…" before the pill options tells the visitor that a choice is being offered, not that they are in the wrong section.

2. **The textarea placeholder teaches.** Rotating examples show the format: "A booking app for my yoga studio…" — this prevents the common error of typing "I want an app" (too vague) or "React + Supabase + Auth with email verification and OAuth" (too technical).

3. **The submit button is disabled until there is content.** An empty textarea produces a disabled button. This prevents the confusion of "I pressed the button and nothing happened."

4. **The BYOK section is explicit.** It prevents the misunderstanding "if I generate an app, Sovereign will have my data." The section addresses this before the user has to ask.

5. **The pricing note "No card. No catch." is adjacent to "$0."** This prevents the misread of "free means there's a hidden cost later."

### Recognition over recall

**Familiar patterns used:**

- Textarea for idea input — the most familiar input pattern for open-ended text. No custom input widget.
- Dollar sign prefix on the terminal command — universal developer convention.
- Copy icon (clipboard) next to the command — universal developer convention.
- Pill toggle — widely understood pattern for selecting between two modes.
- Pricing cards with a "featured" badge — universal SaaS pricing pattern.
- Footer with copyright + links — universal web convention.

**Nothing on this page requires the user to remember how to use it.** Every affordance is self-evident from prior web experience.

### Help and documentation

**Where someone goes if confused:**

The page itself is the documentation. Each section answers the question that the previous section raised. No external links required for understanding.

Escalation path:
1. Question answered on the page → resolved
2. Question not answered → FAQ in the footer (future feature)
3. Question requires real help → "Contact us" link in the footer (mailto: link)

The "Docs (coming)" nav link sets expectations: documentation will exist, it doesn't yet. This is more honest than linking to a placeholder page.

---

## AGENT 14 — WCAG AA (Accessibility)

*Standard 12: Accessibility — WCAG 2.1 AA*

### Color contrast requirements for all text

| Element | Text color | Background | Ratio | Passes AA |
|---------|-----------|-----------|-------|-----------|
| H1, H2, body | `#0e0d0b` | `#f2efe8` | 16.2:1 | ✅ |
| Secondary text, captions | `#6b6862` | `#f2efe8` | 4.51:1 | ✅ (barely — do not darken background) |
| Nav links | `#0e0d0b` | `#f2efe8` | 16.2:1 | ✅ |
| Primary button text | `#0e0d0b` | `#8ab800` | 4.6:1 | ✅ |
| BYOK section body | `#c8c4bc` | `#0e0d0b` | 11:1 | ✅ |
| BYOK section secondary | `#8a8580` | `#0e0d0b` | 5.2:1 | ✅ |
| Badge text | `#6b6862` | `#ffffff` | 4.6:1 | ✅ |
| Toggle active (ink bg) | `#f2efe8` | `#0e0d0b` | 16.2:1 | ✅ |
| Toggle inactive | `#0e0d0b` | `#ffffff` | 19:1 | ✅ |
| Disabled button | `#0e0d0b` at 40% opacity | `#8ab800` | ~2:1 | ⚠️ Acceptable for disabled state per WCAG exception |
| Error text | `#dc2626` | `#f2efe8` | 4.5:1 | ✅ (exact value — verify in implementation) |
| Progress messages during generation | `#6b6862` | `#f2efe8` | 4.51:1 | ✅ |

**Rule:** `#6b6862` is only used on `#f2efe8` (paper) or `#ffffff` backgrounds. Never on `#0e0d0b` or any dark section.

### Focus states for all interactive elements

Every interactive element must have a visible focus indicator. The default browser outline is acceptable but a custom one is preferred:

```css
:focus-visible {
  outline: 2px solid #0e0d0b;
  outline-offset: 3px;
  border-radius: 2px;
}
```

This gives a consistent, high-contrast focus ring (16.2:1 on the paper background) without the blue browser default that clashes with the brand.

**Elements requiring explicit focus state testing:**
- All nav links
- Toggle pills (both)
- Textarea
- Submit button (all states)
- Command copy button
- Pricing CTA buttons
- Waitlist email input and submit button
- Footer links
- Language selector buttons

### Alt text strategy for all images

**Images on this page:**

| Image | Alt text |
|-------|----------|
| Sovereign logo (if SVG/img) | `Sovereign` |
| Primary color circle in spec result | `[App name] primary color: [hex value]` |
| GitHub icon in OAuth button | `""` (decorative — button text "Connect GitHub" carries the label) |
| Vercel icon in OAuth button | `""` (decorative) |
| Language flag icons (if used) | `""` (decorative — button text "EN", "ES" etc. carries the label) |
| Any screenshot or mockup added later | Describe the content: "Generated app spec for a yoga studio booking app showing 19 files and a green primary color" |

**Rule:** Never use an image to convey information that is not also present as text.

### Mobile tap target sizes

All interactive elements must meet 44×44px minimum touch target per WCAG 2.5.5 (AAA) and iOS HIG (44pt). The AA standard is 24×24px — we hold ourselves to the higher standard.

| Element | Minimum rendered size |
|---------|----------------------|
| Nav links | 44px height (enforce with `min-height: 44px; padding`) |
| Toggle pills | 44px height, 80px min-width |
| Submit button | 52px height, full content width on mobile |
| Command copy button | 44×44px |
| Pricing CTA buttons | 52px height, full width on mobile |
| Waitlist submit button | 52px height, full width on mobile |
| Footer links | 44px height minimum |
| Language selector buttons | 44×44px |

**Spacing between tap targets:** Minimum 8px between any two tappable elements.

---

## AGENT 15 — RESILIENCE (Recovery)

*Standard 15: Resilience & Recovery — iOS HIG + Material Design*

### What if the build fails on the landing page demo?

There is no live "demo" on the landing page — the product itself is the demo. When a visitor presses "Generate," they are using the real API.

**Failure scenario: `/api/generate` returns a 5xx:**
- The generating state terminates
- A human error message appears: "Something went wrong. Your idea is saved — try again or rewrite it slightly."
- A "Try again" button appears below the error message
- The textarea is restored with their original idea pre-filled
- No blank screen at any point

**Failure scenario: generation times out after 300s:**
- Same behavior as 5xx, with message: "That took longer than expected. Try a shorter idea or try again in a moment."

**Failure scenario: rate limit hit (429):**
- Message: "You've generated [3] apps today. Free plan limit is 3 per day. Come back tomorrow or upgrade for unlimited."
- The waitlist CTA is shown inline below the error as a secondary action

### What if the visitor is on a slow connection?

**Page load (slow 3G, ~1 second):**
- HTML renders first — the H1 and textarea are visible as soon as HTML parses
- Fonts load from Google Fonts with `font-display: swap` — system fallback renders immediately, Playfair/DM Mono swap in when loaded
- CSS loads from the same Vite bundle — no render-blocking stylesheets
- No hero image means no large network request blocking first paint

**During generation on a slow connection:**
- The SSE stream opens and the first progress message appears within 2 seconds: "Reading your idea…"
- If the SSE connection drops mid-stream, the generating state remains visible for 30 more seconds before timing out with: "Connection lost. Try again."
- The textarea re-fills with their original idea

**Critical path:** The textarea and submit button must be functional before any non-essential scripts load. The generation flow must not depend on analytics, chat widgets, or marketing scripts loading first.

### What if JavaScript fails to load?

This page requires JavaScript for generation — there is no server-side rendering of the generation stream. However, the no-JS fallback must not be a blank page.

**No-JS fallback (`<noscript>` tag):**
```html
<noscript>
  <div style="padding: 2rem; text-align: center; font-family: Georgia, serif;">
    <h1>Sovereign requires JavaScript to generate apps.</h1>
    <p>Please enable JavaScript in your browser to use Sovereign.</p>
    <p>Questions? <a href="mailto:hello@visila.com">hello@visila.com</a></p>
  </div>
</noscript>
```

This is not a designed component — it is a functional fallback. The CSS-in-`style` attribute approach ensures it renders without the stylesheet.

### What is the no-JS fallback?

Beyond the `<noscript>` message:

- The page title, H1, and meta description carry the positioning even without JS
- The nav links are `<a href>` anchor links — they function without JS
- The footer links are `<a href>` — they function without JS
- The language selector does not work without JS — acceptable, it is an enhancement
- The toggle does not work without JS — the default (Door 1, idea person) is the `<noscript>` view

The page communicates what Sovereign is even when it cannot demonstrate it. That is the minimum acceptable standard.

---

## BYOK AGENT — BRING YOUR OWN KEY

### How is BYOK presented to idea people? (subtle)

For the idea person, BYOK is a reassurance, not a feature. They do not know what an API key is. What they need to understand is: their data is safe.

**Positioning:** Privacy and ownership, not technical capability.

**Placement:** A single sentence in the BYOK section body: "Your data never touches Sovereign's servers. Every app connects to your own Supabase database from day one."

**What is not said:** "Anthropic key," "API endpoint," "model inference." These are implementation details that create anxiety in a non-technical audience. The promise is: your data is yours. The technical mechanism is irrelevant to them.

**Copy for idea person BYOK:**
> **Your data stays yours.**
> Every app Sovereign builds connects to your own Supabase database. Your idea, your users, your data — none of it passes through Sovereign's servers. We build the pipeline. You own everything it produces.

### How is BYOK presented to developers? (prominent)

For the developer, BYOK is a feature and a trust signal. They have been burned by tools that store their keys or proxy their API calls through the tool's own infrastructure at a markup.

**Positioning:** Control and cost efficiency.

**Placement:** A dedicated section within the developer door content, including a code example.

**Copy for developer BYOK:**
> **Your keys. Your costs. Your call.**
> Pass `--anthropic-key` and your generations never go through Sovereign's infrastructure. Same for `--supabase-token` and `--vercel-token`. Run it fully air-gapped against a local Supabase instance. Sovereign is a generator, not a gateway.

**Code example:**
```
$ npx sovereign-app@latest --anthropic-key sk-... --local
```

### What is the exact copy for the BYOK proposition?

**Universal one-line version (used in pricing, footer, badge tooltip):**
> Your generations, your keys, your data. No Sovereign dependency in the output.

**Headline version (BYOK section H2, Door 1):**
> Your data never leaves your hands.

**Headline version (BYOK section H2, Door 2):**
> Your keys. Your Supabase. Your Vercel.

### Where does it live in the page hierarchy?

Between "How it works" and "Social proof." This placement is deliberate:

- After "How it works" → the visitor now understands the mechanism
- Before "Social proof" → the visitor's next objection is "but do I trust them with my data?"
- BYOK answers the trust objection before the social proof asks them to convert

The section uses the dark (`#0e0d0b`) background — it is the only dark section on the page, which signals: this is important, pay attention. The visual contrast forces the eye to stop.

---

## SEO + CONTENT AGENT

### What blog posts or docs does this page link to?

**Phase 1 (now):** The page links to nothing external except GitHub. No blog exists. No docs exist. Links to non-existent pages hurt credibility more than having no links. Footer nav includes "Docs (coming)" as a plain text label, not a link.

**Phase 2 (when content exists):** The following content pages would each attract organic search traffic and link back to the product:

| Page | Target keyword | What it ranks for |
|------|---------------|------------------|
| `/docs/getting-started` | sovereign app tutorial | Users who need hand-holding |
| `/docs/security-model` | BYOK app builder security | Trust-building for technical buyers |
| `/blog/build-app-without-code` | build app without coding | Top-of-funnel awareness |
| `/blog/react-supabase-boilerplate` | react supabase starter | Developer acquisition |
| `/built-with-sovereign` | built with sovereign | Badge click destination |
| `/compare/lovable-alternative` | lovable alternative | Competitor comparison |

None of these are built yet. They are listed here so they are not forgotten when content strategy begins.

### What is the content strategy that makes this page rank?

**Short term (domain authority ≈ 0):**

Do not compete on generic keywords. Target long-tail, high-intent keywords with less competition:
- "describe your app get code" — almost no content ranking for this exact phrase
- "generate react app from description free" — low competition
- "deploy supabase app without developer" — very low competition

These convert better than generic terms anyway — the person searching these phrases knows exactly what they want.

**Medium term (after 50+ builds and some testimonials):**

The "What people are building" section becomes a content engine. Each generated app name (sanitized) adds keyword diversity to the page naturally. 50 app names cover 50 different niches and their corresponding long-tail keywords.

**The PageRank signal that matters most:**

When users share their "Built with Visila" apps and those apps carry the badge that links back to `visila.com`, those are natural backlinks from real projects on real domains. This is a better long-term SEO strategy than any content calendar.

### What questions does this page answer that people are Googling?

These are the exact questions that should be answerable by reading the page. If a visitor Googles one of these and lands on this page and does not find the answer, the page has failed its SEO job:

| Google query | Answer on the page |
|-------------|-------------------|
| "how to build an app without coding free" | Hero + pricing ($0 tier) |
| "does sovereign own my code" | BYOK section + "How it works" step 3 |
| "what does sovereign generate" | "How it works" step 2: 19 files, React/TS/Tailwind/Supabase |
| "sovereign app pricing" | Pricing section |
| "sovereign app vs lovable" | Not explicitly addressed — the positioning answers this implicitly (code ownership differentiator) |
| "can I use my own API key" | BYOK section |
| "how long does sovereign take to build an app" | Stats: 90 seconds |
| "what stack does sovereign use" | "How it works" step 2 and developer door tech pills |

---

## "BUILT WITH SOVEREIGN" BADGE AGENT

### Design: what does the badge look like?

```
[ ✦ Built with Visila ]
```

**Specifications:**

- Container shape: pill (border-radius 999px)
- Container size: height 28px, horizontal padding 12px
- Background: `#ffffff`
- Border: `1px solid #e5e7eb` at rest
- Text: "Built with Visila" in DM Mono, 11px, `#6b6862`, letter-spacing 0.02em
- Icon: `✦` (U+2726 Black Four Pointed Star) in `#8ab800`, 9px, 6px right margin from text
- Hover state: border color `#0e0d0b`, text color `#0e0d0b`, transition 150ms ease
- Cursor: pointer (it is a link)
- No box shadow. No background color change on hover. Only the border and text shift.

The badge is small, quiet, and legible. It does not shout. It is the last thing you notice on the page, which makes it more interesting when you do notice it.

### Placement: where on the page?

**On the Sovereign landing page:** Footer, centered, above the copyright line. After the language selector. It is the second-to-last element on the page.

```
[ EN  ES  FR  DE ]

[ ✦ Built with Visila ]

© 2026 Sovereign App · Privacy · Terms · Security
```

**On every generated app:** Bottom of the footer, same position. The badge appears by default in the generated app's CLAUDE.md template with instructions for how to remove it. It is not hard-coded — the user can delete one line to remove it.

### Copy: what does it say?

`Built with Visila`

Not "Powered by Sovereign" — "powered by" implies dependency. Not "Made with Sovereign" — generic. "Built with" is the right register: it names a tool, not a dependency. It is the same phrasing as "Designed in Figma" or "Deployed on Vercel."

The `✦` is Sovereign's recurring mark — it appears in the logo area, in the generation stream ("Applying ✦ standards..."), and in the badge. It should feel like a signature.

### Link: where does it go?

**Phase 1 (now):** `https://visila.com` — back to the landing page. This is acceptable because the landing page is itself an example of a Sovereign-built product. The loop is honest.

**Phase 2:** `https://visila.com/built-with-sovereign` — a showcase page listing apps built with Sovereign, their stacks, the founders' names. This is the destination worth building when there are 20+ real apps to show.

The link opens in a new tab (`target="_blank" rel="noreferrer"`) when the badge appears on a generated app. On the Sovereign landing page itself, the badge links to `#` (prevents pointless same-page navigation) or to the showcase page when it exists.

### Story: what does it prove?

The badge on the Sovereign landing page makes one claim: **Sovereign holds itself to the same standard it sets for users.**

The 15 standards in VISILA_STANDARDS.md are not rules Sovereign applies to other people's apps while exempting its own. This page was built using the same generation pipeline, the same design tokens, the same quality checklist. The badge is the receipt.

For the visitor, the badge creates a moment of recognition: "Wait — this page itself was generated by the tool?" That realization does more for conversion than any copy claim. Showing is more convincing than telling. The badge is how the page shows its own credentials.

For the user who keeps the badge on their own app: they are making the same statement. "I hold my product to these standards." The badge is a quality signal from them to their own users.

---

*All 18 agent briefs are complete. No code has been written. The executive summary at the top of this document synthesizes the core finding across all agents.*

*Next step: founder reviews and approves LANDING_AGENTS.md and PRODUCT_LANDING.md before implementation begins.*
