# Visila — Architecture Decisions

Product and engineering decisions with full context. Referenced in CLAUDE.md.
Update this file whenever a significant decision is made or revisited.

---

## [Working apps, not landing pages]

**Context:** Early Visila scaffolds generated functional but visually minimal apps — essentially wireframes with Tailwind classes. Founders receiving these felt the output was too basic to share.

**Decision:** Every app Visila generates is indistinguishable from a product that went through 6 months of design sprints and a senior engineering team. The standard is: "Would this feel at home in an Apple keynote?" (the Jony Ive bar). Not a starter kit. Not a wireframe. A working, beautiful app.

**Rationale:** Visila's core promise is "Build without permission" — founders shipping something they're proud of in minutes. If the output needs weeks of design work before it can be shown to users, Visila has not delivered on that promise. The alternative (fast but ugly) is the Lovable/bolt.new gap Visila is designed to close.

**What this means for generation:**
- Every page has loading states, error states, and empty states
- Typography has real hierarchy (large serif headlines, mono body)
- Animations use fade+translateY on entrance, 150-300ms transitions
- Delight moments: confetti on success actions, heartbeat on key emojis
- Copy is real and brand-appropriate — never lorem ipsum
- Mobile-first: every page works beautifully at 375px

**Decided:** 2026-03-23.

---

## [Staging builds deploy to Visila's Vercel team]

**Context:** Originally run-build.ts used the user's Vercel OAuth token for all Vercel API calls, which caused confusion about where apps were deployed and who owned them.

**Decision:** All staging builds (apps generated before the user claims ownership) deploy to Visila's own Vercel team using VISILA_VERCEL_TOKEN and VISILA_VERCEL_TEAM_ID. The user's vercel_token is captured and stored but never used during the build pipeline. It is reserved for the future claim flow (ownership transfer).

**Rationale:** Users should be able to see their app immediately without needing to set up their own Vercel account first. The staging period (default 7 days) gives them time to decide whether to claim the app and move it to their own account.

**Decided:** 2026-03-23.

---

## [brief extraction runs before OAuth]

**Context:** Users pasting long PRDs into the idea input wanted confirmation that Visila understood their idea before committing to the OAuth flow.

**Decision:** POST /api/extract-brief runs after idea submit, before GitHub/Vercel OAuth begins. For ideas 200+ chars or multiline, it extracts a structured AppBrief and shows a confirmation screen. Short ideas skip extraction and proceed immediately. Extraction failure always falls back to raw idea — never blocks the user.

**Rationale:** Reduces wasted OAuth flows and gives founders confidence that Visila read their PRD correctly. The confirmation screen ("Looks good, build it →" / "Edit brief →") is the moment of commitment before irreversible work begins.

**Decided:** 2026-03-23.

---

## [Sonnet 4.6 for generation, Haiku for extraction]

**Context:** Generation was originally on Claude Opus 4.6. A cost audit found no measurable quality difference on 18-file React scaffold generation.

**Decision:** Generation (api/generate.ts) uses MODEL_GENERATION = 'claude-sonnet-4-6'. Extraction and classification (api/extract-brief.ts) use MODEL_FAST = 'claude-haiku-4-5-20251001'. Only reconsider Opus if generation quality measurably degrades.

**Rationale:** Sonnet 4.6 handles structured tool_use generation of 18+ files reliably at ~80% lower cost than Opus. Haiku is sufficient for bounded JSON output tasks under 500 tokens.

**Decided:** 2026-03-23.

---

## [Single system prompt source — api/_systemPrompt.ts]

**Context:** The generation system prompt was duplicated across api/generate.ts and server/generate.ts. They diverged twice across sessions.

**Decision:** All generation system prompt content lives exclusively in api/_systemPrompt.ts. Both api/generate.ts and server/generate.ts import the SYSTEM_PROMPT constant from there. One edit, both files updated.

**Rationale:** Any prompt fix applied to one file must manually be applied to the other — confirmed to fail in two sessions. Single source eliminates the failure mode entirely.

**Decided:** 2026-03-20.

---

## [Magic link auth, sessionStorage only]

**Context:** Dashboard auth needed to be simple and secure. Password resets and forgotten-password flows add friction and support burden.

**Decision:** Auth uses magic links only. Session stored in sessionStorage (never localStorage) as { email }. Token is 64-char random hex (256-bit). One-time use, 24h expiry, enforced server-side.

**Rationale:** No passwords to forget, no reset flow to build. sessionStorage clears on tab close — appropriate for a dashboard accessed on shared devices.

**Decided:** 2026-03-20.

---

## [Lessons knowledge base — auto-capture build failures]

**Context:** Visila needed a way to learn from build failures without requiring manual triage after every failed build.

**Decision:** Every build failure caught by the outer provisionErr catch in run-build.ts is automatically inserted into the lessons table via recordFailureLesson(). Category is inferred from the error message. The solution field starts empty — to be reviewed and filled in manually. GET /api/lessons serves them publicly for apps with non-empty solutions.

**Rationale:** Auto-capture means no failure is silently lost. Manual solution curation means only verified, useful lessons are served. High-count lessons will eventually be fed back into the generation system prompt automatically.

**Decided:** 2026-03-23.
