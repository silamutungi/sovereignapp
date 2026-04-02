export const UX_KNOWLEDGE_LAYER = `
---
## UX Knowledge Layer
These principles are distilled from foundational UX literature.
Apply every principle below to every generated app.
They are not optional and do not vary by category.

---
### Information Architecture
Source: Information Architecture for the Web and Beyond — Rosenfeld, Morville, Arango

STRUCTURE
- Every app has three levels: global navigation (always visible),
  local navigation (section-specific), and contextual navigation
  (inline links and related content). Generate all three.
- Navigation must reflect the user's mental model of the content,
  not the developer's model of the database or codebase.
- Users should always be able to answer three questions without
  thinking: Where am I? Where can I go? What will I find there?
- Every page needs a clear "you are here" signal — active nav state,
  breadcrumb, or page title that matches the nav label exactly.

LABELING
- Labels must match the user's vocabulary, not the product's
  internal terminology. Never use internal jargon as navigation labels.
- Each navigation label must be distinct enough that users can
  predict what they'll find before clicking.
- Consistency is non-negotiable: the same concept gets the same
  label everywhere. Never call it "Account" in one place and
  "Profile" in another.

FINDABILITY
- If content exists but users cannot find it, it does not exist.
  Every key feature must be reachable in 3 clicks or fewer from
  the home page.
- Search is a last resort, not a navigation strategy. Primary
  content must be browsable without search.
- Organization schemes must be mutually exclusive and collectively
  exhaustive: every item belongs in exactly one category and every
  item belongs somewhere.

CROSS-CHANNEL CONSISTENCY
- Semantic structures (labels, categories, navigation) must be
  consistent across all surfaces: web, mobile, email, and any
  other touchpoints the app generates.

---
### UX Strategy
Source: UX Strategy — Jaime Levy

VALUE PROPOSITION
- Every generated app must have a clear, specific value proposition
  visible above the fold on the home page. It must answer:
  What is it? Who is it for? Why is it better than the alternative?
- "Better" must be specific. "Easier", "faster", "cheaper" are not
  specific. Name the specific pain removed or outcome delivered.
- Never design a feature without knowing which user problem it solves
  and which business goal it serves. Features without this rationale
  are waste.

COMPETITIVE CLARITY
- Generated apps must look and feel like they understand their
  competitive landscape. A SAAS_TOOL must feel more focused than
  a generic dashboard. A MARKETPLACE must feel more trustworthy
  than Craigslist.
- Differentiation happens at the experience level, not just the
  feature level. Two apps with identical features can have radically
  different perceived value based on UX alone.

CONVERSION FUNNEL
- Every app has a funnel: Aware → Interested → Engaged → Converted.
  Generate UI that moves users through each stage deliberately.
- The home page converts Aware → Interested.
  The onboarding flow converts Interested → Engaged.
  The core feature converts Engaged → Converted.
- Never skip a funnel stage. An app that jumps from hero to sign-up
  form without building interest will have poor conversion.

VALIDATED ASSUMPTIONS
- Generated apps should reflect realistic user behavior, not
  optimistic assumptions. Empty states must acknowledge reality
  ("No bookings yet") not deny it ("Your bookings will appear here").
- Every call-to-action must be grounded in what the user actually
  wants to do at that moment in their journey.

---
### Product Design Principles
Source: Principles of Product Design

USER FIRST
- Every design decision must be traceable to a user need.
  "It looks good" is not a reason. "Users need to find X quickly"
  is a reason.
- Design for the user's goal, not the feature's existence.
  Users don't want to "upload a photo" — they want their profile
  to look trustworthy.

PROBLEM BEFORE SOLUTION
- The most common product design failure is solving the wrong
  problem beautifully. Before generating UI for any feature, define:
  What is the user trying to accomplish? What is stopping them?
  What does success look like?

MEASURABLE OUTCOMES
- Good design changes behavior. Generated apps should be structured
  around outcomes: booking made, item listed, profile completed,
  message sent — not around pages visited or buttons clicked.
- Every primary CTA should connect to a measurable outcome.

ITERATION MINDSET
- Generated apps should be structured to support iteration.
  Ship the core loop first. Make it work before making it beautiful.
  Core loop = the single action that delivers the primary value.

---
### UX Writing & Microcopy
Source: Strategic UX Writing — Unger and Chandler

CLARITY OVER CLEVERNESS
- Every word in the UI must earn its place. If removing a word
  doesn't change the meaning, remove it.
- Never sacrifice clarity for brand voice. A witty error message
  that confuses the user is a bad error message.
- Write for the lowest-context user — someone using the app for
  the first time, in a hurry, on a small screen.

ERROR MESSAGES
- Every error message must do three things:
  1. Say what went wrong in plain language (no technical codes)
  2. Say why it went wrong if it helps the user fix it
  3. Tell the user exactly what to do next
- "Something went wrong" is never acceptable as an error message.
  "We couldn't save your changes — check your connection and try again" is.

EMPTY STATES
- Every list, feed, table, or collection must have a designed
  empty state that:
  1. Acknowledges the emptiness honestly
  2. Explains why it's empty (first use, no results, filtered out)
  3. Provides a clear action to fill it
- Empty states are the highest-leverage UX moment in any app.
  They are the first thing new users see and the moment most
  likely to cause churn if handled poorly.

BUTTON LABELS
- Buttons must describe the outcome, not the action mechanism.
  Not "Submit" — "Save your profile"
  Not "OK" — "Got it" or "Continue"
  Not "Delete" — "Delete this listing permanently"
- Destructive actions must always include what will be destroyed.

CONFIRMATION & FEEDBACK
- Every user action must produce immediate feedback. If an action
  takes more than 1 second, show a loading state.
- Confirmations must be specific: "Profile saved" not "Done".
  "Booking confirmed for Tuesday 3pm" not "Success".
- Undo is always better than a confirmation dialog for reversible
  actions. Confirmation dialogs are for irreversible actions only.

---
### Experience Mapping
Source: Mapping Experiences — Jim Kalbach

USER JOURNEY AWARENESS
- Every generated app spans multiple moments in a user's journey:
  Discovery → Onboarding → First use → Return use → Advocacy.
  Design for all five, not just first use.
- The biggest drop-off in any app is between Onboarding and First
  use. Generate onboarding flows that deliver the first moment of
  value as quickly as possible — before asking users for anything.

TOUCHPOINT CONSISTENCY
- Users interact with apps across multiple touchpoints: the app
  itself, email notifications, error pages, empty states, loading
  states. Every touchpoint must feel like the same product.
- Inconsistency between touchpoints (e.g., formal app tone,
  casual email tone) erodes trust.

BACKSTAGE CLARITY
- Users judge the whole experience, including what happens after
  they take an action. Confirmation emails, receipts, reminders,
  and status updates are part of the UX. Generate copy for these
  wherever the category requires them.

PAIN POINT PRIORITY
- The most valuable design work is eliminating the biggest pain
  points in the user's journey, not adding new features.
  For every category, the primary pain points are known:
  BOOKING_SCHEDULING: uncertainty about confirmation and cancellation
  MARKETPLACE: trust between strangers
  SAAS_TOOL: time to first value
  RESTAURANT_HOSPITALITY: friction between browsing and reserving
  Apply this awareness to every generated layout decision.

---
### User Story Mapping & MVP Scoping
Source: User Story Mapping — Jeff Patton

BUILD LESS, DELIVER MORE
- The best generated app is the smallest one that delivers the
  complete core experience. Every feature beyond the core loop
  adds complexity without guaranteed value.
- Core loop rule: identify the single action that delivers the
  app's primary value and make it take as few steps as possible.
  Everything else is secondary.

WALKING SKELETON
- Every generated app must have a "walking skeleton" — a thin,
  end-to-end version of the core flow that works completely.
  No dead ends. No placeholder buttons. No "coming soon" sections.
  If a nav item links to an empty page, don't generate the nav item.

RELEASE THINKING
- Generate the MVP of every feature, not the full vision.
  A working simple version now beats a broken complex version later.
  Lists before filters. Basic search before advanced search.
  Single image before image gallery.

OUTCOME OVER OUTPUT
- The measure of a generated app is not how many features it has
  but whether a user can accomplish their goal in one session.
  If the core loop requires more than 5 steps, simplify it.
---
`
