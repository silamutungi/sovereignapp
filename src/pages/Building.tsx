import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BuildStatus {
  status: 'pending_github' | 'pending_vercel' | 'queued' | 'building' | 'done' | 'failed'
  step: string | null
  appName: string
  repoUrl: string | null
  deployUrl: string | null
  error: string | null
}

// ── Step definitions (ordered) ────────────────────────────────────────────────

interface LogStep {
  // The `step` string value written by run-build that activates this entry
  matchOn: string | string[]
  label: string
  icon: string
  urlKey?: 'repoUrl' | 'deployUrl'
  terminal?: boolean
}

const LOG_STEPS: LogStep[] = [
  { matchOn: 'Reading your idea…',           icon: '✦',  label: 'Reading your idea' },
  { matchOn: 'Creating your GitHub repo…',   icon: '⚙',  label: 'Creating your GitHub repo…' },
  { matchOn: ['Repo created at', 'Deploying to Vercel…'], icon: '✅', label: 'Repo created', urlKey: 'repoUrl' },
  { matchOn: 'Deploying to Vercel…',         icon: '⚙',  label: 'Deploying to Vercel…' },
  { matchOn: ['Live at', 'Sending your live URL…', 'done'], icon: '✅', label: 'Live on Vercel', urlKey: 'deployUrl' },
  { matchOn: 'Sending your live URL…',       icon: '📧', label: 'Sending your live URL…' },
  { matchOn: 'done',                         icon: '🎉', label: 'You own everything. Welcome to Sovereign.', terminal: true },
]

// Returns index of the most advanced step reached given the current step string.
function resolvedStepIndex(step: string | null): number {
  if (!step) return -1
  // Walk backwards so we return the last fully-completed step
  for (let i = LOG_STEPS.length - 1; i >= 0; i--) {
    const matchers = Array.isArray(LOG_STEPS[i].matchOn)
      ? LOG_STEPS[i].matchOn as string[]
      : [LOG_STEPS[i].matchOn as string]
    if (matchers.some((m) => step.startsWith(m) || step === m)) return i
  }
  return -1
}

// ── Styles (inline — Building page is standalone, not shared with App.css) ───

const S = {
  page: {
    minHeight: '100vh',
    background: '#0e0d0b',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    fontFamily: "'DM Mono', 'Courier New', monospace",
  },
  card: {
    width: '100%',
    maxWidth: '520px',
  },
  wordmark: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    color: '#c8f060',
    marginBottom: '40px',
    textAlign: 'center' as const,
  },
  appName: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#f2efe8',
    marginBottom: '8px',
    textAlign: 'center' as const,
    fontFamily: "'Playfair Display', Georgia, serif",
  },
  subtitle: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: '40px',
    textAlign: 'center' as const,
    lineHeight: 1.6,
  },
  log: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
    marginBottom: '32px',
  },
  logRow: (active: boolean, done: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    opacity: active || done ? 1 : 0.25,
    transition: 'opacity 0.4s ease',
  }),
  logIcon: {
    width: '20px',
    flexShrink: 0,
    fontSize: '14px',
    marginTop: '1px',
  },
  logText: (done: boolean, active: boolean): React.CSSProperties => ({
    fontSize: '13px',
    lineHeight: 1.5,
    color: done ? '#c8f060' : active ? '#f2efe8' : 'rgba(255,255,255,0.45)',
    transition: 'color 0.4s ease',
  }),
  logUrl: {
    fontSize: '11px',
    color: 'rgba(200,240,96,0.6)',
    textDecoration: 'none',
    display: 'block',
    marginTop: '3px',
    wordBreak: 'break-all' as const,
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.2)',
    borderTopColor: '#c8f060',
    borderRadius: '50%',
    animation: 'spin 0.75s linear infinite',
    flexShrink: 0,
    marginTop: '2px',
  },
  errorBox: {
    background: 'rgba(255,80,80,0.1)',
    border: '1px solid rgba(255,80,80,0.3)',
    borderRadius: '8px',
    padding: '16px 20px',
    fontSize: '13px',
    color: '#ff9090',
    lineHeight: 1.6,
    marginBottom: '24px',
  },
  ctaBtn: {
    display: 'block',
    width: '100%',
    background: '#c8f060',
    color: '#0e0d0b',
    fontFamily: "'DM Mono', 'Courier New', monospace",
    fontSize: '14px',
    fontWeight: 700,
    textDecoration: 'none',
    textAlign: 'center' as const,
    padding: '14px 24px',
    borderRadius: '8px',
    letterSpacing: '0.01em',
    marginBottom: '12px',
    transition: 'opacity 0.15s',
  },
  secondaryBtn: {
    display: 'block',
    width: '100%',
    background: 'transparent',
    color: '#c8f060',
    fontFamily: "'DM Mono', 'Courier New', monospace",
    fontSize: '13px',
    fontWeight: 600,
    textDecoration: 'none',
    textAlign: 'center' as const,
    padding: '13px 24px',
    borderRadius: '8px',
    border: '1px solid rgba(200,240,96,0.3)',
    letterSpacing: '0.01em',
    transition: 'opacity 0.15s',
  },
  homeLink: {
    marginTop: '32px',
    textAlign: 'center' as const,
    fontSize: '11px',
    color: 'rgba(255,255,255,0.3)',
  },
  homeLinkA: {
    color: 'rgba(200,240,96,0.5)',
    textDecoration: 'none',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Building() {
  const [searchParams] = useSearchParams()
  const buildId = searchParams.get('id')

  const [status, setStatus] = useState<BuildStatus | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)

  const hasTriggeredRef = useRef(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Trigger run-build once (idempotent — server checks status === 'queued')
  useEffect(() => {
    if (!buildId || hasTriggeredRef.current) return
    hasTriggeredRef.current = true

    fetch('/api/run-build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: buildId }),
    }).catch(() => {/* build-status polling will surface the error */})
  }, [buildId])

  // Poll build status every 2 s
  useEffect(() => {
    if (!buildId) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/build-status?id=${encodeURIComponent(buildId)}`)
        if (!res.ok) return
        const data = await res.json() as BuildStatus
        setStatus(data)
        // Stop polling when terminal
        if (data.status === 'done' || data.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
        }
      } catch {
        setPollError('Lost connection. Refresh to check status.')
      }
    }

    void poll() // immediate first fetch
    pollIntervalRef.current = setInterval(() => { void poll() }, 2000)
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [buildId])

  // ── Render ───────────────────────────────────────────────────────────────

  if (!buildId) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <p style={S.wordmark}>SOVEREIGN</p>
          <p style={{ color: '#ff9090', textAlign: 'center', fontSize: '13px' }}>
            No build ID found. <a href="/" style={S.homeLinkA}>Start over →</a>
          </p>
        </div>
      </div>
    )
  }

  const isDone   = status?.status === 'done'
  const isFailed = status?.status === 'failed'
  const stepIdx  = resolvedStepIndex(status?.step ?? null)

  return (
    <>
      {/* Spinner keyframe — can't use App.css from this standalone page */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <div style={S.page}>
        <div style={S.card}>
          <p style={S.wordmark}>SOVEREIGN</p>

          {status?.appName && (
            <h1 style={S.appName}>{status.appName}</h1>
          )}
          <p style={S.subtitle}>
            {isDone
              ? 'This is yours now. You own everything.'
              : isFailed
              ? 'Something went wrong during provisioning.'
              : 'Provisioning your app — this takes about 30 seconds…'}
          </p>

          {/* Progress log */}
          <div style={S.log}>
            {LOG_STEPS.map((logStep, i) => {
              const done   = i < stepIdx
              const active = i === stepIdx
              const future = i > stepIdx

              if (future && !isDone && !isFailed) return null // only show reached steps

              const urlValue =
                logStep.urlKey === 'repoUrl'   ? status?.repoUrl   ?? null :
                logStep.urlKey === 'deployUrl' ? status?.deployUrl ?? null : null

              // For the "Repo created" and "Live at" entries, show the URL inline
              const displayLabel =
                logStep.urlKey === 'repoUrl' && status?.repoUrl
                  ? `Repo created`
                  : logStep.urlKey === 'deployUrl' && status?.deployUrl
                  ? `Live on Vercel`
                  : logStep.label

              return (
                <div key={i} style={S.logRow(active, done || isDone)}>
                  <span style={S.logIcon}>
                    {active && !isDone && !isFailed
                      ? <span style={S.spinner} aria-hidden="true" />
                      : logStep.icon}
                  </span>
                  <span>
                    <span style={S.logText(done || (isDone && i < LOG_STEPS.length), active)}>
                      {displayLabel}
                    </span>
                    {urlValue && (
                      <a href={urlValue} target="_blank" rel="noreferrer" style={S.logUrl}>
                        {urlValue}
                      </a>
                    )}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Error state */}
          {isFailed && (
            <div style={S.errorBox} role="alert">
              <strong>Build failed:</strong>{' '}
              {status?.error ?? 'Unknown error. Check your GitHub and Vercel connections.'}
            </div>
          )}

          {/* Poll error */}
          {pollError && !isFailed && (
            <div style={S.errorBox} role="alert">{pollError}</div>
          )}

          {/* Done CTAs */}
          {isDone && status?.deployUrl && (
            <>
              <a href={status.deployUrl} target="_blank" rel="noreferrer" style={S.ctaBtn}>
                View Live App →
              </a>
              {status.repoUrl && (
                <a href={status.repoUrl} target="_blank" rel="noreferrer" style={S.secondaryBtn}>
                  View on GitHub →
                </a>
              )}
            </>
          )}

          <p style={S.homeLink}>
            <a href="/" style={S.homeLinkA}>← Back to Sovereign</a>
          </p>
        </div>
      </div>
    </>
  )
}
