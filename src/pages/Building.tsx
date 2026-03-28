import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BuildStatus {
  status: 'pending_github' | 'pending_vercel' | 'queued' | 'building' | 'complete' | 'error'
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
  { matchOn: 'Creating your GitHub repo…',    icon: '⚙',  label: 'Creating your GitHub repo…' },
  { matchOn: 'Repo created at',               icon: '✅', label: 'Repo created', urlKey: 'repoUrl' },
  { matchOn: 'Provisioning your database…',   icon: '⚙',  label: 'Provisioning your database…' },
  { matchOn: 'Creating your Supabase project…', icon: '⚙', label: 'Creating your Supabase project…' },
  { matchOn: 'Waiting for database to be ready…', icon: '⏳', label: 'Waiting for database to be ready…' },
  { matchOn: 'Running your schema…',          icon: '⚙',  label: 'Running your schema…' },
  { matchOn: 'Securing your tables…',         icon: '⚙',  label: 'Securing your tables…' },
  { matchOn: 'Database ready ✓',              icon: '✅', label: 'Database ready ✓' },
  { matchOn: 'Deploying to Vercel…',          icon: '⚙',  label: 'Deploying to Vercel…' },
  { matchOn: ['Live at', 'Sending your live URL…', 'done'], icon: '✅', label: 'Live on Vercel', urlKey: 'deployUrl' },
  { matchOn: 'done',                          icon: '✦', label: 'You own everything. Welcome to Sovereign.', terminal: true },
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
  const [searchParams, setSearchParams] = useSearchParams()
  const buildId = searchParams.get('id')

  const [status, setStatus] = useState<BuildStatus | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  // supabaseRetry=true shows the retry UI and blocks run-build from auto-firing
  const [supabaseRetry, setSupabaseRetry] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [dbChoice, setDbChoice] = useState<'own' | 'sovereign' | null>(() => {
    if (!buildId) return null
    // If returning from a failed OAuth, reset localStorage so run-build does not
    // auto-fire before the user re-authorizes.
    if (new URLSearchParams(window.location.search).get('supabase_error') === 'true') {
      localStorage.removeItem(`sb_choice_${buildId}`)
      return null
    }
    return (localStorage.getItem(`sb_choice_${buildId}`) as 'own' | 'sovereign') ?? null
  })

  const hasTriggeredRef        = useRef(false)
  const pollIntervalRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const consecutiveErrorsRef   = useRef(0)
  const pollStartRef           = useRef(Date.now())
  const supabaseErrorHandledRef = useRef(false)
  const pollIntervalMsRef      = useRef(4000)   // start at 4s, backs off on 429
  const MAX_POLL_MS            = 5 * 60 * 1000  // 5 minutes
  const MAX_CONSECUTIVE_ERRORS = 3
  const BASE_POLL_MS           = 4000
  const MAX_BACKOFF_MS         = 15000

  // Shared helper — used inside the poll callback and in render logic below.
  const isSupabaseProvisioningError = (s: string) => {
    const l = s.toLowerCase()
    return (
      l.includes('reconnect') ||
      l.includes('supabase oauth token') ||
      l.includes('no supabase organisation found on this account') ||
      l.includes('no supabase organisation found') ||
      l.includes('supabase project')
    )
  }

  // Trigger run-build once — but only after the user has chosen their database.
  // dbChoice === null means the choice UI is still showing; we wait.
  useEffect(() => {
    if (!buildId || hasTriggeredRef.current) return
    if (dbChoice === null) return  // wait for user to pick db
    hasTriggeredRef.current = true

    fetch('/api/run-build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: buildId, supabaseChoice: dbChoice }),
    }).catch(() => {/* build-status polling will surface the error */})
  }, [buildId, dbChoice])

  // If the build is already past 'queued' (e.g. user refreshes mid-build),
  // skip the db choice UI — the choice was already made and honoured.
  useEffect(() => {
    if (!buildId || dbChoice !== null) return
    if (status && status.status !== 'queued') {
      // Build is in progress or done — treat as if choice was already made
      setDbChoice('sovereign')
    }
  }, [buildId, dbChoice, status])

  // Detect ?supabase_error=true from a failed OAuth callback, clean the URL,
  // and surface the retry UI. Runs once per mount.
  useEffect(() => {
    if (supabaseErrorHandledRef.current) return
    if (searchParams.get('supabase_error') === 'true') {
      supabaseErrorHandledRef.current = true
      setSupabaseRetry(true)
      const next = new URLSearchParams(searchParams)
      next.delete('supabase_error')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Poll build status — starts at 4s, backs off to 15s on 429, resets on success
  useEffect(() => {
    if (!buildId) return

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }

    const restartInterval = () => {
      stopPolling()
      pollIntervalRef.current = setInterval(() => { void poll() }, pollIntervalMsRef.current)
    }

    const poll = async () => {
      // 5-minute hard timeout
      if (Date.now() - pollStartRef.current > MAX_POLL_MS) {
        stopPolling()
        setPollError("This is taking longer than expected. Check your email — we'll send your live URL when it's ready.")
        return
      }

      try {
        const res = await fetch(`/api/build-status?id=${encodeURIComponent(buildId)}`)

        if (res.status === 429) {
          // Back off — double interval up to max
          pollIntervalMsRef.current = Math.min(pollIntervalMsRef.current * 2, MAX_BACKOFF_MS)
          restartInterval()
          return
        }

        if (!res.ok) {
          consecutiveErrorsRef.current++
          if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
            stopPolling()
            setPollError('Something went wrong checking your build status. Please refresh and try again.')
          }
          return
        }

        // Reset backoff on any successful response
        if (pollIntervalMsRef.current !== BASE_POLL_MS) {
          pollIntervalMsRef.current = BASE_POLL_MS
          restartInterval()
        }
        consecutiveErrorsRef.current = 0  // reset on success
        const data = await res.json() as BuildStatus
        setStatus(data)
        if (data.status === 'complete' || data.status === 'error') {
          stopPolling()
        }
        // Trigger reconnect UI for queued builds with a Supabase error AND
        // for error-state builds where Supabase provisioning failed.
        if (
          data.error && isSupabaseProvisioningError(data.error) &&
          (data.status === 'queued' || data.status === 'error')
        ) {
          if (!supabaseRetry && buildId) {
            setSupabaseRetry(true)
            setDbChoice(null)
            localStorage.removeItem(`sb_choice_${buildId}`)
          }
        }
      } catch {
        consecutiveErrorsRef.current++
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
          stopPolling()
          setPollError('Lost connection. Please refresh and try again.')
        }
      }
    }

    void poll() // immediate first fetch
    pollIntervalRef.current = setInterval(() => { void poll() }, pollIntervalMsRef.current)
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [buildId])

  // ── Database choice handler ───────────────────────────────────────────────

  const handleDbChoice = (choice: 'own' | 'sovereign') => {
    if (!buildId) return
    localStorage.setItem(`sb_choice_${buildId}`, choice)
    if (choice === 'sovereign') {
      setDbChoice('sovereign')
    } else {
      // Redirect to Supabase OAuth — token exchange happens in the callback
      const clientId    = import.meta.env.VITE_SUPABASE_OAUTH_CLIENT_ID as string | undefined
      const redirectUri = `${window.location.origin}/auth/supabase/callback`
      if (!clientId) {
        console.error('[building] VITE_SUPABASE_OAUTH_CLIENT_ID not set')
        setPollError('Supabase OAuth is not configured. Please contact support or choose "Use Sovereign\'s for now" to continue.')
        return
      }
      const oauthUrl =
        `https://api.supabase.com/v1/oauth/authorize` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&state=${encodeURIComponent(buildId)}`
      // No scope parameter — Supabase Management API OAuth does not accept a scope param.
      window.location.href = oauthUrl
    }
  }

  // ── Supabase reconnect (clears token + resets build, re-shows db choice) ─
  // Calls reset-build to wipe supabase_token and reset status to 'queued',
  // clears localStorage, then hard-navigates back to the building page so
  // the database choice UI reappears cleanly.

  const handleSupabaseReconnect = async () => {
    if (!buildId || retrying) return
    setRetrying(true)
    try {
      await fetch('/api/reset-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: buildId }),
      })
    } catch {
      // Proceed with redirect even if reset fails — worst case, build-status
      // polling will detect the queued state after the user re-authorizes.
    }
    localStorage.removeItem(`sb_choice_${buildId}`)
    window.location.href = `/building?id=${encodeURIComponent(buildId)}`
  }

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

  const isDone   = status?.status === 'complete'
  const isFailed = status?.status === 'error'
  const stepIdx  = resolvedStepIndex(status?.step ?? null)
  const needsSupabaseRetry = !retrying && (
    supabaseRetry ||
    (!!status?.error && isSupabaseProvisioningError(status.error)) ||
    (!!pollError && isSupabaseProvisioningError(pollError))
  )

  const isLoginConnectionError = isFailed &&
    !!status?.error &&
    status.error.toLowerCase().includes("login connection")

  const canRetryFromCheckpoint = isFailed && !needsSupabaseRetry && !isLoginConnectionError && !retrying

  const handleRetryFromCheckpoint = async () => {
    if (!buildId || retrying) return
    setRetrying(true)
    try {
      await fetch('/api/run-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: buildId, supabaseChoice: dbChoice ?? 'sovereign', forceRetry: true }),
      })
      setRetrying(false)
    } catch {
      setRetrying(false)
    }
  }

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

          {/* ── Supabase reconnect (any Supabase provisioning error) ── */}
          {needsSupabaseRetry && !isDone && (
            <div style={{ marginBottom: '32px' }}>
              <p style={{ ...S.subtitle, marginBottom: '24px', color: 'rgba(255,255,255,0.6)' }}>
                We couldn't connect your Supabase account. Tap below to try again.
              </p>
              <button
                onClick={() => { void handleSupabaseReconnect() }}
                disabled={retrying}
                style={{
                  display: 'block',
                  width: '100%',
                  background: '#c8f060',
                  color: '#0e0d0b',
                  fontFamily: "'DM Mono', 'Courier New', monospace",
                  fontSize: '14px',
                  fontWeight: 700,
                  border: 'none',
                  padding: '14px 24px',
                  borderRadius: '8px',
                  cursor: retrying ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.01em',
                  opacity: retrying ? 0.6 : 1,
                }}
              >
                {retrying ? 'Resetting…' : 'Reconnect Supabase →'}
              </button>
            </div>
          )}

          {/* ── Database choice (shown before build starts, first time) ── */}
          {status?.status === 'queued' && dbChoice === null && !needsSupabaseRetry && (
            <div style={{ marginBottom: '32px' }}>
              <p style={{ ...S.subtitle, marginBottom: '24px' }}>
                Where should your database live?
              </p>
              <button
                onClick={() => handleDbChoice('own')}
                style={{
                  display: 'block',
                  width: '100%',
                  background: '#c8f060',
                  color: '#0e0d0b',
                  fontFamily: "'DM Mono', 'Courier New', monospace",
                  fontSize: '14px',
                  fontWeight: 700,
                  border: 'none',
                  padding: '14px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '12px',
                  letterSpacing: '0.01em',
                }}
              >
                Connect your Supabase →
              </button>
              <button
                onClick={() => handleDbChoice('sovereign')}
                style={{
                  display: 'block',
                  width: '100%',
                  background: 'transparent',
                  color: 'rgba(200,240,96,0.7)',
                  fontFamily: "'DM Mono', 'Courier New', monospace",
                  fontSize: '13px',
                  fontWeight: 400,
                  border: 'none',
                  padding: '8px 0',
                  cursor: 'pointer',
                  letterSpacing: '0.01em',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(200,240,96,0.3)',
                }}
              >
                Use Sovereign's for now →
              </button>
            </div>
          )}

          <p style={S.subtitle}>
            {isDone
              ? 'This is yours now. You own everything.'
              : needsSupabaseRetry
              ? ''
              : isFailed
              ? 'Something went wrong during provisioning.'
              : dbChoice === null && status?.status === 'queued'
              ? ''
              : 'Provisioning your app — this takes about 60 seconds…'}
          </p>

          {/* Progress log — only shown after db choice is made and no retry needed */}
          <div style={{ ...S.log, display: (dbChoice === null && status?.status === 'queued') || needsSupabaseRetry ? 'none' : 'flex' }}>
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

          {/* Login Connection error — manual Vercel fallback */}
          {isLoginConnectionError && (
            <div style={S.errorBox} role="alert">
              <strong>Vercel link failed.</strong>{' '}
              We couldn't connect Vercel to your repo automatically.{' '}
              <a
                href={`https://vercel.com/new/git/import?s=${encodeURIComponent(status?.repoUrl ?? '')}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#c8f060', textDecoration: 'underline' }}
              >
                Click here to connect manually →
              </a>
            </div>
          )}

          {/* General error with retry-from-checkpoint */}
          {isFailed && !needsSupabaseRetry && !isLoginConnectionError && (
            <div style={S.errorBox} role="alert">
              <strong>Build failed:</strong>{' '}
              {status?.error ?? 'Unknown error. Check your GitHub and Vercel connections.'}
            </div>
          )}
          {canRetryFromCheckpoint && (
            <button
              onClick={() => { void handleRetryFromCheckpoint() }}
              disabled={retrying}
              style={{ ...S.ctaBtn, marginTop: '12px', opacity: retrying ? 0.6 : 1, cursor: retrying ? 'not-allowed' : 'pointer' }}
            >
              {retrying ? 'Retrying…' : 'Retry from last checkpoint →'}
            </button>
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
              <p style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
                <a href="/dashboard" style={{ color: 'rgba(138,184,0,0.8)', textDecoration: 'none' }}>
                  Manage this app in your dashboard →
                </a>
              </p>
            </>
          )}

          {(!status || isDone || isFailed) && (
            <p style={S.homeLink}>
              <a href="/" style={S.homeLinkA}>← Back to Sovereign</a>
            </p>
          )}
        </div>
      </div>
    </>
  )
}
