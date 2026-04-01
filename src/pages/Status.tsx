// src/pages/Status.tsx — Visila System Status Page
//
// Route: /status
// Shows live health of Visila and all its dependencies.
// Polls /api/system-status every 60 seconds. No auth required.

import { useEffect, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

type SystemStatus = 'operational' | 'degraded' | 'down' | 'maintenance'
type Overall = 'operational' | 'degraded' | 'down'

interface SystemResult {
  name: string
  status: SystemStatus
  message: string | null
  checked_at: string
}

interface StatusData {
  overall: Overall
  systems: SystemResult[]
  checked_at: string
}

// ── Hardcoded incidents ────────────────────────────────────────────────────────

interface Incident {
  date: string
  title: string
  description: string
  status: 'resolved' | 'monitoring' | 'investigating'
}

const INCIDENTS: Incident[] = [
  {
    date: 'March 28, 2026',
    title: 'Preview iframe not loading',
    description:
      'Vercel SSO protection was enabled by default on all new staging projects, blocking preview iframes in the Visila dashboard. SSO protection has been disabled on all projects. Existing builds were backfilled via migration script.',
    status: 'resolved',
  },
]

// ── Status badge config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  SystemStatus,
  { label: string; dotColor: string; bgColor: string; textColor: string }
> = {
  operational: {
    label: 'Operational',
    dotColor: '#FF1F6E',
    bgColor: 'rgba(138,184,0,0.10)',
    textColor: '#4a6400',
  },
  degraded: {
    label: 'Degraded',
    dotColor: '#d97706',
    bgColor: 'rgba(217,119,6,0.10)',
    textColor: '#92400e',
  },
  down: {
    label: 'Disruption',
    dotColor: '#d63b2f',
    bgColor: 'rgba(214,59,47,0.10)',
    textColor: '#a32d2d',
  },
  maintenance: {
    label: 'Maintenance',
    dotColor: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.10)',
    textColor: '#1e40af',
  },
}

const OVERALL_CONFIG: Record<
  Overall,
  { label: string; dotColor: string }
> = {
  operational: { label: 'All systems operational', dotColor: '#FF1F6E' },
  degraded:    { label: 'Some systems degraded',   dotColor: '#d97706' },
  down:        { label: 'Service disruption',       dotColor: '#d63b2f' },
}

// ── System description copy ────────────────────────────────────────────────────

const SYSTEM_DESCRIPTIONS: Record<string, string> = {
  'Build Pipeline':       'Apps generating normally',
  'GitHub Integration':   'Repo creation working',
  'Vercel Deployment':    'Deployments live',
  'Supabase':             'Database connections healthy',
  'Email (Resend)':       'Welcome emails sending',
  'Visila Dashboard':  'Dashboard accessible',
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
          aria-label="Visila home"
        >
          visila
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

// ── Status badge ──────────────────────────────────────────────────────────────

function Badge({ status }: { status: SystemStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: '11px',
        letterSpacing: '0.04em',
        padding: '3px 8px',
        borderRadius: '2px',
        background: cfg.bgColor,
        color: cfg.textColor,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  )
}

// ── System row ────────────────────────────────────────────────────────────────

function SystemRow({ system }: { system: SystemResult }) {
  const desc = SYSTEM_DESCRIPTIONS[system.name] ?? null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '16px 0',
        borderBottom: '1px solid #e8e4dd',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '14px',
            color: '#0e0d0b',
            fontWeight: 500,
          }}
        >
          {system.name}
        </div>
        {system.status === 'operational' && desc && (
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '12px',
              color: '#6b6862',
              marginTop: '3px',
            }}
          >
            {desc}
          </div>
        )}
        {system.status !== 'operational' && system.message && (
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '12px',
              color: STATUS_CONFIG[system.status].textColor,
              marginTop: '3px',
            }}
          >
            {system.message}
          </div>
        )}
      </div>
      <Badge status={system.status} />
    </div>
  )
}

// ── Incident card ─────────────────────────────────────────────────────────────

function IncidentCard({ incident }: { incident: Incident }) {
  const isResolved = incident.status === 'resolved'
  return (
    <div
      style={{
        padding: '20px',
        border: '1px solid #e8e4dd',
        borderRadius: '4px',
        background: '#faf9f6',
        marginBottom: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '13px' }}>{isResolved ? '✓' : '●'}</span>
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isResolved ? '#4a6400' : '#92400e',
          }}
        >
          {incident.status} — {incident.date}
        </span>
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '14px',
          color: '#0e0d0b',
          fontWeight: 500,
          marginBottom: '6px',
        }}
      >
        {incident.title}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '13px',
          color: '#6b6862',
          lineHeight: 1.6,
        }}
      >
        {incident.description}
      </div>
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '16px 0',
            borderBottom: '1px solid #e8e4dd',
          }}
        >
          <div
            style={{
              width: '40%',
              height: '14px',
              background: '#e8e4dd',
              borderRadius: '2px',
            }}
          />
          <div
            style={{
              width: '80px',
              height: '22px',
              background: '#e8e4dd',
              borderRadius: '2px',
            }}
          />
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Status() {
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  async function fetchStatus() {
    try {
      const res = await fetch('/api/system-status')
      if (!res.ok) throw new Error('Failed to fetch status')
      const json = await res.json() as StatusData
      setData(json)
      setLastChecked(new Date())
      setSecondsAgo(0)
      setError(null)
    } catch {
      setError('Could not load status. Retrying shortly.')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch + 60s poll
  useEffect(() => {
    fetchStatus()
    const poll = setInterval(fetchStatus, 60_000)
    return () => clearInterval(poll)
  }, [])

  // Live "X seconds ago" counter
  useEffect(() => {
    if (!lastChecked) return
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastChecked.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastChecked])

  const overallCfg = data ? OVERALL_CONFIG[data.overall] : null

  function formatSecondsAgo(s: number): string {
    if (s < 5) return 'just now'
    if (s < 60) return `${s}s ago`
    const m = Math.floor(s / 60)
    return `${m}m ago`
  }

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
        {/* ── Overall status header ───────────────────────────────────────── */}
        <div style={{ marginBottom: '48px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#ccc8bf',
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  width: '280px',
                  height: '32px',
                  background: '#e8e4dd',
                  borderRadius: '2px',
                }}
              />
            </div>
          ) : error ? (
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '14px',
                color: '#a32d2d',
              }}
            >
              {error}
            </div>
          ) : overallCfg ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: overallCfg.dotColor,
                    flexShrink: 0,
                    boxShadow: `0 0 0 4px ${overallCfg.dotColor}22`,
                  }}
                />
                <h1
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#0e0d0b',
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {overallCfg.label}
                </h1>
              </div>
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '13px',
                  color: '#6b6862',
                  margin: '0 0 0 28px',
                }}
              >
                Last checked {formatSecondsAgo(secondsAgo)}
              </p>
            </>
          ) : null}
        </div>

        {/* ── Systems list ────────────────────────────────────────────────── */}
        <section aria-label="System status" style={{ marginBottom: '64px' }}>
          <div style={{ borderTop: '1px solid #e8e4dd' }}>
            {loading ? (
              <Skeleton />
            ) : data ? (
              data.systems.map((system) => (
                <SystemRow key={system.name} system={system} />
              ))
            ) : null}
          </div>
        </section>

        {/* ── Incident history ─────────────────────────────────────────────── */}
        <section aria-label="Recent incidents">
          <h2
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '12px',
              fontWeight: 500,
              color: '#6b6862',
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              margin: '0 0 20px',
            }}
          >
            Recent incidents
          </h2>

          {INCIDENTS.length === 0 ? (
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '13px',
                color: '#6b6862',
              }}
            >
              No recent incidents.
            </p>
          ) : (
            INCIDENTS.map((incident, i) => (
              <IncidentCard key={i} incident={incident} />
            ))
          )}
        </section>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
