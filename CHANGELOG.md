# Visila Changelog

All notable changes to Visila are documented here.

---

## [2.0.0] — 2026-03-24

### The Company OS Release

Visila v2.0.0 is the most significant release since launch. The entire system was
rebuilt using Visila's own multi-agent pipeline — the ultimate dogfood.

### Added

**Brain System**
- `brain/brain-api.js` — Central learning API. Records lessons, patterns, decisions across all builds.
- `brain/cycle1-per-project.js` — Per-build learning cycle. Extracts lessons after every ship.
- `brain/cycle2-weekly.js` — Weekly synthesis. Identifies recurring patterns and failure modes.
- `brain/cycle3-monthly.js` — Monthly strategic report. Calculates quality trends and prompt improvements.
- `brain/VISILA_RULES.md` — Canonical rules file read by all agents before writing any code.
- `brain/VISILA_PATTERNS.md` — Seeded pattern library from CLAUDE.md lessons.
- `brain/VISILA_ANTIPATTERNS.md` — Known antipatterns with fixes.
- `brain/VISILA_COMPONENT_LIBRARY.md` — Reusable component patterns.
- `src/pages/brain-dashboard.tsx` — Brain dashboard UI.

**30-Agent Pipeline**
- `agents/intake/` — Discovery agent analyzes ideas and classifies complexity.
- `agents/elevation/` — Insight, creative director, and IA agents elevate the brief.
- `agents/vision/` — 8 agents: CEO, product, design, tokens, marketing, SEO, onboarding, i18n.
- `agents/build/` — 9 agents: architect, frontend, backend, content, email, analytics, error-handling, mobile-pwa, documentation.
- `agents/verify/` — 8 agents: security, privacy, rate-limiting, accessibility, UX audit, unit test, E2E test, performance.
- `agents/review/reviewer-agent.js` — Adversarial 3-round review with confidence scoring.
- `agents/ship/shipper-agent.js` — Launch gate check + handoff trigger.

**Confidence Engine**
- 10-dimension evaluation system: security, code quality, performance, accessibility, UX, architecture, test coverage, SEO, documentation, i18n.
- `confidence/engine/aggregator.js` — Weighted aggregation with confidence bands.
- `confidence/engine/score-history.js` — Score trend tracking over time.
- `confidence/reports/report-generator.js` — Reports in JSON, Markdown, and HTML.
- `confidence/migration/` — Migration evaluator and effort estimator.
- `confidence/api/confidence-api.js` — HTTP API for external scoring queries.
- 7 confidence UI components.

**Company OS**
- `company-os/handoff/` — Handoff protocol activates Company OS on every ship.
- `company-os/functional/unlock-system.js` — Progressive agent unlocking based on company metrics.
- `company-os/marketplace/` — 8 marketplace agents (fundraising, PR, compliance, etc.).
- `company-os/knowledge/` — 8 industry knowledge bases + 6 standards files.
- 8 product intelligence agents (growth, SEO, brand, analytics, retention, roadmap, marketing, customer success).
- 6 functional agents (CFO, CTO, CMO, legal, people, CX).

**Coach System**
- `company-os/coach/coach-engine.js` — Aggregates agent recommendations, prioritizes by urgency.
- `company-os/coach/coach-personality.js` — Enforces tone rules and forbidden phrases.
- `company-os/coach/coach-interventions.js` — Timed interventions at key moments.
- `company-os/coach/coach-memory.js` — Remembers user preferences across sessions.
- `company-os/coach/coach-outcomes.js` — Tracks whether recommendations are followed.
- `company-os/coach/coach-weekly-brief.js` — Weekly intelligence brief (5 sections).
- 6 Coach UI components.

**Company OS Dashboard**
- `company-os/dashboard/company-os-dashboard.tsx` — Full Company OS view.
- 6 dashboard components.

**Self-Build Infrastructure**
- `scripts/self-build/architect.js` — Scans codebase, classifies components, produces build plan.
- `scripts/self-build/orchestrator.js` — Manages parallel build groups, monitors progress.
- `scripts/self-build/build-plan.json` — Master build plan with dependency graph.
- `scripts/self-build/pipeline-state.json` — Live build state.
- `scripts/self-build/visila-confidence-report-2026-03-24.md` — Visila's self-assessment.

**Shared Infrastructure**
- `shared/agent-base-class.js` — Base class all 30 agents extend.
- `shared/pipeline-state.js` — Atomic pipeline state management.
- `shared/logger.js` — Structured logging for all agents.

### Self-Assessment Results

Visila scored **87/100 (STRONG)** on its own confidence evaluation.
Launch gate: **PASSED** (threshold: 75).

All 10 dimensions passed their minimums:
- Security: 91/100 ✅
- Documentation: 92/100 ✅
- UX: 88/100 ✅
- Performance: 86/100 ✅
- Architecture: 85/100 ✅
- Code Quality: 84/100 ✅
- Accessibility: 83/100 ✅
- Code Coverage: 71/100 ✅
- SEO: 78/100 ✅
- i18n: 74/100 ✅

### The Dogfood Principle

> Every issue we found in our own code made the evaluators stronger.
> Every fix we made to ourselves is a fix we'll make for every customer.
> We cannot ask of others what we have not asked of ourselves.

---

## [1.x.x] — 2026-03-20 to 2026-03-23

### Visila v1 — The Foundation

- Landing page with ndev (idea) and dev (CLI) toggle
- Brief extraction (extract-brief.ts) for PRDs 200+ chars
- 18-file React/TS/Tailwind app generation (SSE streaming, Sonnet 4.6)
- 3-version preview with regeneration before commit
- GitHub OAuth + Vercel OAuth + Supabase OAuth
- Staging builds deploy to Visila's Vercel team
- GitHub repo creation with 19-file scaffold
- Vercel auto-deploy with polling to READY
- Magic link auth for dashboard access
- Dashboard with build history and live URLs
- 7-day build expiry system
- Lessons knowledge base (42 seed lessons from CLAUDE.md)
- Visila Standards Engine v15 (14 expert layers + Resilience standard)
- Company OS activation on ship (handoff protocol)

### Security

- RLS on all Supabase tables
- Rate limiting on all 9 API routes with Retry-After headers
- CSP with connect-src for Supabase (fixed CVE class from competitor)
- No secrets in client code
- Soft deletes on all user data tables
- Security audit comment block on every API route

---

*"Build without permission. Grow without limits. Scale with a system that never stops learning."*
