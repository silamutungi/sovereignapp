// src/pages/Changelog.tsx — Sovereign Changelog
//
// Route: /changelog
// Hardcoded release history. No API. No auth.
// Design: paper background, timeline layout, Playfair + DM Mono.

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChangelogEntry {
  date: string
  version?: string
  tag: 'feature' | 'fix' | 'improvement' | 'security' | 'infra'
  title: string
  description: string
}

// ── Release data ───────────────────────────────────────────────────────────────

const ENTRIES: ChangelogEntry[] = [
  {
    date: 'March 28, 2026',
    tag: 'fix',
    title: 'Preview iframe now loads in dashboard',
    description:
      'Vercel SSO protection was being enabled by default on every staging project, causing the dashboard preview to show a blank screen. SSO protection is now disabled immediately after project creation. All existing builds were backfilled.',
  },
  {
    date: 'March 28, 2026',
    tag: 'feature',
    title: 'Claim flow — transfer your app to your own account',
    description:
      'Staged apps now live on the Sovereign team temporarily. Once you are ready, the Claim button transfers your GitHub repo and Vercel project to your own account. You own everything.',
  },
  {
    date: 'March 26, 2026',
    tag: 'feature',
    title: 'Edit pipeline — live edits to generated apps',
    description:
      'Dashboard now supports direct edits to your generated app. Changes deploy automatically to Vercel. React apps detect the right file to edit (Home.tsx or App.tsx). Stable project alias is stored so the URL never changes across redeploys.',
  },
  {
    date: 'March 26, 2026',
    tag: 'feature',
    title: 'Sovereign Coach — always-present AI assistant',
    description:
      'Every dashboard now surfaces a coaching banner with time-sensitive recommendations. The coach knows your app age, previous activity, and the accumulated lessons from every previous build. Strategy coaching, not just edit assistance.',
  },
  {
    date: 'March 24, 2026',
    tag: 'security',
    title: 'SSO protection disabled on all preview projects',
    description:
      'Confirmed that all Vercel preview URLs on the sovereign-staging team required login by default. Automated disable runs immediately on project creation. Backfill script applied to all existing builds.',
  },
  {
    date: 'March 23, 2026',
    tag: 'feature',
    title: 'Brief extraction — structured app spec before build',
    description:
      'Long ideas (200+ characters) are now extracted into a structured brief before generation. Name, target user, features, and entities are shown for confirmation. You can edit the brief or approve it as-is. Short ideas skip extraction entirely.',
  },
  {
    date: 'March 23, 2026',
    tag: 'improvement',
    title: 'Sonnet 4.6 for generation — 80% cost reduction',
    description:
      'After a cost audit, generation switched from Opus to Sonnet 4.6. 18-file React app generation is handled reliably at significantly lower cost. Haiku is used for extraction and classification tasks with bounded output.',
  },
  {
    date: 'March 23, 2026',
    tag: 'security',
    title: 'CSP connect-src — Supabase calls no longer silently blocked',
    description:
      "Every generated app's Content-Security-Policy now includes connect-src covering Supabase and its WebSocket endpoint. Previously, default-src 'self' was silently blocking all database calls in generated apps.",
  },
  {
    date: 'March 22, 2026',
    tag: 'fix',
    title: 'TypeScript build failures in generated apps resolved',
    description:
      'Generated apps were failing tsc with React namespace errors (React.FormEvent, React.ReactNode without React imported) and router v5 syntax (useHistory, Switch). Generation prompt now enforces named type imports and React Router v6 patterns exclusively.',
  },
  {
    date: 'March 21, 2026',
    tag: 'feature',
    title: 'Multi-file React app generation — 18 files per build',
    description:
      'Apps now generate as complete React + TypeScript + Tailwind projects with 18 essential files: pages, components, Supabase client, types, and full Vite configuration. Single-file HTML generation retired.',
  },
  {
    date: 'March 21, 2026',
    tag: 'feature',
    title: 'Dashboard with magic link auth',
    description:
      'Authenticated dashboard launched. Magic link auth: request a link, click it, session stored in sessionStorage only. One-time use, 24-hour expiry, enforced server-side. See all your builds, launch URLs, and repo links.',
  },
  {
    date: 'March 20, 2026',
    tag: 'feature',
    title: 'Preview regeneration — try before you build',
    description:
      'Up to 3 previews before committing to a build. Each regeneration uses variation hints to ensure meaningful visual differences. Navigate between versions to compare. Build uses whichever version is showing when you confirm.',
  },
  {
    date: 'March 20, 2026',
    tag: 'infra',
    title: 'End-to-end build pipeline confirmed working',
    description:
      'Complete flow verified: idea input → app spec → GitHub OAuth → Vercel OAuth → repo created → 6 files pushed → deployment → READY → welcome email. First successful end-to-end build completed.',
  },
  {
    date: 'March 20, 2026',
    version: '1.0.0',
    tag: 'feature',
    title: 'Sovereign App launches',
    description:
      'Build without permission. Describe your idea, connect GitHub and Vercel, and get a live app with a real URL in minutes. You own the code, the repo, and the deployment. No lock-in.',
  },
]

// ── Tag config ─────────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<ChangelogEntry['tag'], { label: string; color: string; bg: string }> = {
  feature:     { label: 'Feature',     color: '#4a6400', bg: 'rgba(138,184,0,0.10)' },
  fix:         { label: 'Fix',         color: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
  improvement: { label: 'Improvement', color: '#0e5c8a', bg: 'rgba(14,92,138,0.10)' },
  security:    { label: 'Security',    color: '#a32d2d', bg: 'rgba(214,59,47,0.10)' },
  infra:       { label: 'Infra',       color: '#6b6760', bg: 'rgba(107,103,96,0.10)' },
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 28px',
          borderBottom: '1px solid #ccc8bf',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(242, 239, 232, 0.92)',
          backdropFilter: 'blur(8px)',
          WebkitTransform: 'translateZ(0)',
        }}
      >
        <a
          href="/"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '17px',
            fontWeight: 900,
            color: '#0e0d0b',
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
          aria-label="Sovereign App home"
        >
          sovereign
        </a>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <a
            href="/#how-it-works"
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '13px',
              color: '#6b6760',
              textDecoration: 'none',
            }}
          >
            How it works
          </a>
          <a
            href="/dashboard"
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '13px',
              color: '#6b6760',
              textDecoration: 'none',
            }}
          >
            Dashboard
          </a>
        </div>
      </nav>
    </header>
  )
}

// ── Tag badge ─────────────────────────────────────────────────────────────────

function Tag({ type }: { type: ChangelogEntry['tag'] }) {
  const cfg = TAG_CONFIG[type]
  return (
    <span
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: '10px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '2px 7px',
        borderRadius: '2px',
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  )
}

// ── Entry ──────────────────────────────────────────────────────────────────────

function Entry({ entry }: { entry: ChangelogEntry }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        gap: '0 32px',
        padding: '28px 0',
        borderBottom: '1px solid #e8e4dd',
      }}
    >
      {/* Date column */}
      <div style={{ paddingTop: '2px' }}>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '12px',
            color: '#6b6862',
            lineHeight: 1.5,
          }}
        >
          {entry.date}
        </div>
        {entry.version && (
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '11px',
              color: '#8ab800',
              marginTop: '4px',
              letterSpacing: '0.04em',
            }}
          >
            v{entry.version}
          </div>
        )}
      </div>

      {/* Content column */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <Tag type={entry.tag} />
        </div>
        <h3
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '22px',
            fontWeight: 700,
            color: '#0e0d0b',
            margin: '0 0 8px',
            lineHeight: 1.3,
          }}
        >
          {entry.title}
        </h3>
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '16px',
            color: '#6b6862',
            margin: 0,
            lineHeight: 1.7,
          }}
        >
          {entry.description}
        </p>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Changelog() {
  return (
    <div style={{ minHeight: '100vh', background: '#f2efe8' }}>
      <Nav />

      <main
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '64px 24px 96px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '56px' }}>
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '40px',
              fontWeight: 700,
              color: '#0e0d0b',
              margin: '0 0 12px',
              lineHeight: 1.15,
            }}
          >
            Changelog
          </h1>
          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '14px',
              color: '#6b6862',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Every fix, feature, and improvement — in order.
          </p>
        </div>

        {/* Entries */}
        <section aria-label="Changelog entries">
          <div style={{ borderTop: '1px solid #e8e4dd' }}>
            {ENTRIES.map((entry, i) => (
              <Entry key={i} entry={entry} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
