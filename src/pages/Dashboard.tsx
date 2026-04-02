// src/pages/Dashboard.tsx — Visila Dashboard (Phase 2)
//
// Three states:
//   A — Email gate      (no token, no session)
//   B — Token verify    (?token=xxx in URL)
//   C — Authenticated   (sovereign_user in sessionStorage)
//
// Auth: magic link → sessionStorage only (never localStorage)
// Session key: 'sovereign_user' → JSON.stringify({ email: string })

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import VisilaLogo from '../components/VisilaLogo'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Build {
  id: string
  app_name: string
  idea: string
  status: 'pending' | 'building' | 'complete' | 'error'
  deploy_url: string | null
  repo_url: string | null
  step: string | null
  error: string | null
  next_steps: NextStep[] | null
  supabase_schema: string | null
  supabase_mode: string | null
  staging: boolean | null
  claimed_at: string | null
  claim_status: string | null
  claimed_url: string | null
  created_at: string
  confidence_score: number | null
  launch_gate_passed: boolean | null
}

interface NextStep {
  title: string
  description: string
  action: string
  priority: 'high' | 'medium' | 'low'
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(iso))
}

function getSession(): { email: string } | null {
  try {
    const raw = sessionStorage.getItem('sovereign_user')
    if (!raw) return null
    return JSON.parse(raw) as { email: string }
  } catch {
    return null
  }
}

// ── STATE A — Email gate ───────────────────────────────────────────────────────

function EmailGate({ onVerified }: { onVerified: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Email update flow
  const [showUpdateForm, setShowUpdateForm] = useState(false)
  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateSent, setUpdateSent] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError(null)
      setLoading(true)
      try {
        const res = await fetch('/api/auth/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        })
        if (!res.ok) {
          const data = (await res.json()) as { error?: string }
          setError(data.error ?? 'Something went wrong. Please try again.')
          return
        }
        setSent(true)
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [email],
  )

  const handleUpdateEmail = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setUpdateError(null)
      setUpdateLoading(true)
      try {
        // Step 1: send a magic link to the CURRENT email to verify ownership
        // The link will include ?newEmail= so the landing page triggers the update
        const res = await fetch('/api/auth/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: currentEmail.trim().toLowerCase(),
            newEmail: newEmail.trim().toLowerCase(),
          }),
        })
        if (!res.ok) {
          const data = (await res.json()) as { error?: string }
          setUpdateError(data.error ?? 'Something went wrong. Please try again.')
          return
        }
        setUpdateSent(true)
      } catch {
        setUpdateError('Network error. Please try again.')
      } finally {
        setUpdateLoading(false)
      }
    },
    [currentEmail, newEmail],
  )

  void onVerified // used by parent when token verifies

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing: border-box; }
      `}</style>
      <div
        style={{
          minHeight: '100vh',
          background: '#f2efe8',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Fixed wordmark */}
        <div style={{ padding: '20px 32px', position: 'fixed', top: 0, left: 0 }}>
          <Link to="/" aria-label="Visila home" style={{ textDecoration: 'none' }}>
            <VisilaLogo size="sm" />
          </Link>
        </div>

        {/* Center content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '480px' }}>
            <p
              style={{
                font: '11px/1 DM Mono, Courier New, monospace',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#6b6862',
                margin: '0 0 12px',
              }}
            >
              Access your dashboard
            </p>

            <h1
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '36px',
                fontWeight: 400,
                color: '#0e0d0b',
                margin: '0 0 12px',
                lineHeight: 1.15,
              }}
            >
              Manage your apps.
            </h1>

            <p
              style={{
                font: '13px/1.6 DM Mono, Courier New, monospace',
                color: '#6b6862',
                margin: '0 0 32px',
              }}
            >
              We'll send a link to your inbox —<br />
              no password needed.
            </p>

            {sent ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '20px 0',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#FF1F6E',
                      flexShrink: 0,
                      animation: 'pulse 1.4s infinite',
                    }}
                  />
                  <p
                    style={{
                      font: '13px/1 DM Mono, Courier New, monospace',
                      color: '#0e0d0b',
                      margin: 0,
                    }}
                  >
                    Check your inbox at <strong>{email}</strong>
                  </p>
                </div>
                <p
                  style={{
                    font: '12px/1 DM Mono, Courier New, monospace',
                    color: '#6b6862',
                    margin: '8px 0 0',
                  }}
                >
                  Didn't get it? Check spam or{' '}
                  <button
                    onClick={() => {
                      setSent(false)
                      setEmail('')
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#FF1F6E',
                      cursor: 'pointer',
                      font: '12px/1 DM Mono, Courier New, monospace',
                      padding: 0,
                    }}
                  >
                    request a new link
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={(e) => { void handleSubmit(e) }} noValidate>
                <label
                  htmlFor="dashboard-email"
                  style={{
                    display: 'block',
                    font: '11px/1 DM Mono, Courier New, monospace',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#6b6862',
                    margin: '0 0 8px',
                  }}
                >
                  Email address
                </label>
                <input
                  id="dashboard-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    font: '14px/1 DM Mono, Courier New, monospace',
                    border: '1px solid #d8d4ca',
                    background: 'white',
                    color: '#0e0d0b',
                    display: 'block',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#0e0d0b')}
                  onBlur={(e) => (e.target.style.borderColor = '#d8d4ca')}
                />
                {error && (
                  <p
                    role="alert"
                    style={{
                      font: '12px/1 DM Mono, Courier New, monospace',
                      color: '#c0392b',
                      margin: '8px 0 0',
                    }}
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: '#0e0d0b',
                    color: '#f2efe8',
                    font: '13px/1 DM Mono, Courier New, monospace',
                    border: 'none',
                    cursor: loading ? 'default' : 'pointer',
                    marginTop: '12px',
                    opacity: loading || !email.trim() ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Sending…' : 'Send my dashboard link →'}
                </button>
              </form>
            )}

            {/* Wrong email? — update email flow */}
            {!sent && !showUpdateForm && (
              <button
                onClick={() => {
                  setShowUpdateForm(true)
                  setCurrentEmail(email)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FF1F6E',
                  cursor: 'pointer',
                  font: '12px/1 DM Mono, Courier New, monospace',
                  padding: 0,
                  marginTop: '16px',
                  display: 'block',
                }}
              >
                Wrong email? Update it →
              </button>
            )}

            {showUpdateForm && !updateSent && (
              <div
                style={{
                  marginTop: '24px',
                  padding: '20px',
                  border: '1px solid #d8d4ca',
                  background: 'white',
                }}
              >
                <p
                  style={{
                    font: '11px/1 DM Mono, Courier New, monospace',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#6b6862',
                    margin: '0 0 16px',
                  }}
                >
                  Update your email
                </p>
                <form onSubmit={(e) => { void handleUpdateEmail(e) }} noValidate>
                  <label
                    htmlFor="current-email"
                    style={{
                      display: 'block',
                      font: '11px/1 DM Mono, Courier New, monospace',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#6b6862',
                      margin: '0 0 6px',
                    }}
                  >
                    Current email
                  </label>
                  <input
                    id="current-email"
                    type="email"
                    value={currentEmail}
                    onChange={(e) => setCurrentEmail(e.target.value)}
                    placeholder="old@email.com"
                    autoComplete="email"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      font: '13px/1 DM Mono, Courier New, monospace',
                      border: '1px solid #d8d4ca',
                      background: '#f2efe8',
                      color: '#0e0d0b',
                      display: 'block',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#0e0d0b')}
                    onBlur={(e) => (e.target.style.borderColor = '#d8d4ca')}
                  />
                  <label
                    htmlFor="new-email"
                    style={{
                      display: 'block',
                      font: '11px/1 DM Mono, Courier New, monospace',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#6b6862',
                      margin: '12px 0 6px',
                    }}
                  >
                    New email
                  </label>
                  <input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new@email.com"
                    autoComplete="email"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      font: '13px/1 DM Mono, Courier New, monospace',
                      border: '1px solid #d8d4ca',
                      background: '#f2efe8',
                      color: '#0e0d0b',
                      display: 'block',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#0e0d0b')}
                    onBlur={(e) => (e.target.style.borderColor = '#d8d4ca')}
                  />
                  {updateError && (
                    <p
                      role="alert"
                      style={{
                        font: '12px/1 DM Mono, Courier New, monospace',
                        color: '#c0392b',
                        margin: '8px 0 0',
                      }}
                    >
                      {updateError}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      type="submit"
                      disabled={updateLoading || !currentEmail.trim() || !newEmail.trim()}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#0e0d0b',
                        color: '#f2efe8',
                        font: '12px/1 DM Mono, Courier New, monospace',
                        border: 'none',
                        cursor: updateLoading ? 'default' : 'pointer',
                        opacity: updateLoading || !currentEmail.trim() || !newEmail.trim() ? 0.6 : 1,
                      }}
                    >
                      {updateLoading ? 'Sending…' : 'Send update link →'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUpdateForm(false)
                        setUpdateError(null)
                      }}
                      style={{
                        padding: '12px 16px',
                        background: 'none',
                        color: '#6b6862',
                        font: '12px/1 DM Mono, Courier New, monospace',
                        border: '1px solid #d8d4ca',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {updateSent && (
              <div
                style={{
                  marginTop: '24px',
                  padding: '20px',
                  border: '1px solid #d8d4ca',
                  background: 'white',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#FF1F6E',
                      flexShrink: 0,
                      animation: 'pulse 1.4s infinite',
                    }}
                  />
                  <p
                    style={{
                      font: '13px/1.5 DM Mono, Courier New, monospace',
                      color: '#0e0d0b',
                      margin: 0,
                    }}
                  >
                    Check your inbox at <strong>{currentEmail}</strong> to confirm the change.
                  </p>
                </div>
                <p
                  style={{
                    font: '12px/1.5 DM Mono, Courier New, monospace',
                    color: '#6b6862',
                    margin: '8px 0 0',
                  }}
                >
                  Click the link in that email to update to <strong>{newEmail}</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── STATE B — Token verification ───────────────────────────────────────────────

function TokenVerify({
  token,
  newEmail,
  onSuccess,
}: {
  token: string
  newEmail?: string | null
  onSuccess: (email: string) => void
}) {
  const navigate = useNavigate()
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const didVerify = useRef(false)

  useEffect(() => {
    if (didVerify.current) return
    didVerify.current = true

    // If newEmail is present, this is an email update flow
    if (newEmail) {
      fetch('/api/auth/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newEmail }),
      })
        .then(async (res) => {
          const data = (await res.json()) as { success?: boolean; error?: string }
          if (!res.ok || !data.success) {
            setVerifyError(data.error ?? 'Could not update your email. Please try again.')
            return
          }
          // Clear old session — user must log in again with new email
          sessionStorage.removeItem('sovereign_user')
          window.history.replaceState({}, '', '/dashboard')
          setVerifyError('__update_success__')
        })
        .catch(() => {
          setVerifyError('Network error. Please try again.')
        })
      return
    }

    fetch(`/api/auth/verify-token?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = (await res.json()) as { email?: string; error?: string }
        if (!res.ok || !data.email) {
          setVerifyError(data.error ?? 'This link isn\'t valid or has expired.')
          return
        }
        sessionStorage.setItem(
          'sovereign_user',
          JSON.stringify({ email: data.email }),
        )
        window.history.replaceState({}, '', '/dashboard')
        onSuccess(data.email)
      })
      .catch(() => {
        setVerifyError('Network error. Please try again.')
      })
  }, [token, newEmail, onSuccess])

  if (verifyError) {
    // Email update success — show confirmation and redirect to login
    if (verifyError === '__update_success__') {
      return (
        <>
          <style>{`* { box-sizing: border-box; }`}</style>
          <div
            style={{
              minHeight: '100vh',
              background: '#f2efe8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 24px',
            }}
          >
            <div style={{ maxWidth: '440px', width: '100%' }}>
              <div style={{ marginBottom: '32px' }}>
                <Link to="/" aria-label="Visila home" style={{ textDecoration: 'none' }}>
                  <VisilaLogo size="sm" />
                </Link>
              </div>
              <h2
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '24px',
                  fontWeight: 400,
                  color: '#0e0d0b',
                  margin: '0 0 12px',
                }}
              >
                Email updated
              </h2>
              <p
                style={{
                  font: '13px/1.6 DM Mono, Courier New, monospace',
                  color: '#6b6862',
                  margin: '0 0 24px',
                }}
              >
                Check your new inbox for a fresh login link.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '12px 24px',
                  background: '#0e0d0b',
                  color: '#f2efe8',
                  border: 'none',
                  cursor: 'pointer',
                  font: '13px/1 DM Mono, Courier New, monospace',
                }}
              >
                Back to login →
              </button>
            </div>
          </div>
        </>
      )
    }

    const alreadyUsed = verifyError.includes('already been used')
    const expired = verifyError.includes('expired')

    let message: string
    if (alreadyUsed) {
      message = 'This link has already been used. Each link works once for security.'
    } else if (expired) {
      message = 'This link has expired. Links are valid for 24 hours.'
    } else {
      message = 'This link isn\'t valid or has expired.'
    }

    return (
      <>
        <style>{`* { box-sizing: border-box; }`}</style>
        <div
          style={{
            minHeight: '100vh',
            background: '#f2efe8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
          }}
        >
          <div style={{ maxWidth: '440px', width: '100%' }}>
            <div style={{ marginBottom: '32px' }}>
              <Link to="/" aria-label="Visila home" style={{ textDecoration: 'none' }}>
                <VisilaLogo size="sm" />
              </Link>
            </div>
            <h2
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '24px',
                fontWeight: 400,
                color: '#0e0d0b',
                margin: '0 0 12px',
              }}
            >
              This link isn't valid
            </h2>
            <p
              style={{
                font: '13px/1.6 DM Mono, Courier New, monospace',
                color: '#6b6862',
                margin: 0,
              }}
            >
              {message}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                marginTop: '24px',
                padding: '12px 24px',
                background: '#0e0d0b',
                color: '#f2efe8',
                border: 'none',
                cursor: 'pointer',
                font: '13px/1 DM Mono, Courier New, monospace',
              }}
            >
              Request a new link →
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } * { box-sizing: border-box; }`}</style>
      <div
        style={{
          minHeight: '100vh',
          background: '#f2efe8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <Link to="/" aria-label="Visila home" style={{ textDecoration: 'none' }}>
          <VisilaLogo size="sm" />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#FF1F6E',
              animation: 'pulse 1.4s infinite',
            }}
          />
          <p
            style={{
              font: '13px/1 DM Mono, Courier New, monospace',
              color: '#6b6862',
              margin: 0,
            }}
          >
            Verifying your link…
          </p>
        </div>
      </div>
    </>
  )
}

// ── (Edit experience lives at /app/:buildId/edit — see src/pages/EditApp.tsx) ──

// ── STATE C — Authenticated dashboard ─────────────────────────────────────────

function AuthDashboard({ email }: { email: string }) {
  const navigate = useNavigate()
  const [builds, setBuilds] = useState<Build[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(null), 2500)
    return () => clearTimeout(t)
  }, [toastMessage])

  const fetchBuilds = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/dashboard/builds?email=${encodeURIComponent(email)}`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        console.error('[dashboard] fetchBuilds failed:', res.status, body.error)
        return
      }
      const data = (await res.json()) as { builds: Build[] }
      const freshBuilds = data.builds ?? []
      setBuilds(freshBuilds)

      // Self-heal: fire build-status for any stuck 'building' builds so the
      // self-heal logic in build-status.ts can resolve them. Non-blocking.
      const buildingBuilds = freshBuilds.filter((b) => b.status === 'building')
      for (const b of buildingBuilds) {
        void fetch(`/api/build-status?id=${encodeURIComponent(b.id)}`).then(async (r) => {
          if (r.ok) {
            const s = await r.json() as { status?: string }
            if (s.status === 'complete' || s.status === 'error') void fetchBuilds()
          }
        }).catch(() => { /* non-fatal */ })
      }
    } catch (err) {
      // Fail softly — don't blank the page
      console.warn('[dashboard] Failed to fetch builds', err)
    } finally {
      setLoading(false)
    }
  }, [email])

  useEffect(() => {
    void fetchBuilds()
    // Poll every 15s while any build might be in progress
    const interval = setInterval(() => void fetchBuilds(), 15000)
    return () => clearInterval(interval)
  }, [fetchBuilds])

  // Stats
  const totalBuilds = builds.length
  const liveBuilds = builds.filter((b) => b.status === 'complete').length

  // Next steps from most recent complete build
  const latestComplete = builds.find((b) => b.status === 'complete')
  const nextSteps: NextStep[] = Array.isArray(latestComplete?.next_steps) ? latestComplete.next_steps : []

  // ── Coach state ──────────────────────────────────────────────────────────
  interface CoachIntervention {
    type: string
    priority: 'high' | 'medium' | 'low'
    message: string
    cta: string
  }
  interface CoachData {
    interventions: CoachIntervention[]
    recommendations: Array<{ category: string; title: string; solution: string; build_count: number }>
    confidenceScore: number | null
    launchGatePassed: boolean | null
  }
  const [coachData, setCoachData] = useState<CoachData | null>(null)
  const [coachDismissed, setCoachDismissed] = useState(false)

  useEffect(() => {
    if (!latestComplete) return
    const fetchCoach = () => {
      fetch(`/api/coach?buildId=${encodeURIComponent(latestComplete.id)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setCoachData(d as CoachData) })
        .catch(() => { /* non-fatal */ })
    }
    fetchCoach()
    const t = setInterval(fetchCoach, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(t)
  }, [latestComplete?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeIntervention = !coachDismissed ? coachData?.interventions?.[0] ?? null : null

  return (
    <>
      <style>{`
        @keyframes slideProgress {
          0% { left: -60%; width: 60%; }
          100% { left: 100%; width: 60%; }
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateX(-50%) translateY(6px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#0e0d0b',
          padding: '0 32px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link to="/" aria-label="Visila home" style={{ textDecoration: 'none', display: 'flex' }}>
            <VisilaLogo size="sm" color="light" />
          </Link>
          <a
            href="/#how-it-works"
            style={{
              font: '11px/1 DM Mono, Courier New, monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#c8c4bc',
              textDecoration: 'none',
            }}
          >
            How it works
          </a>
          <span
            style={{
              font: '11px/1 DM Mono, Courier New, monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#f2efe8',
            }}
          >
            Dashboard
          </span>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <span
            style={{
              font: '11px/1 DM Mono, Courier New, monospace',
              color: '#6b6862',
            }}
          >
            {email}
          </span>
          <button
            onClick={() => navigate('/')}
            style={{
              background: '#FF1F6E',
              color: '#0e0d0b',
              border: 'none',
              padding: '8px 16px',
              font: '500 12px/1 DM Mono, Courier New, monospace',
              cursor: 'pointer',
            }}
          >
            + New app
          </button>
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#f2efe8',
          padding: '48px 32px 32px',
          borderBottom: '1px solid #d8d4ca',
        }}
      >
        <p
          style={{
            font: '11px/1 DM Mono, Courier New, monospace',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#6b6862',
            margin: '0 0 10px',
          }}
        >
          Your workspace
        </p>
        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '36px',
            fontWeight: 400,
            color: '#0e0d0b',
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          Everything you build,<br />
          <em style={{ color: '#FF1F6E' }}>you own.</em>
        </h1>

        {/* Stats row */}
        <div style={{ marginTop: '32px', display: 'flex' }}>
          {[
            { value: loading ? '—' : String(totalBuilds), label: 'Apps built' },
            { value: loading ? '—' : String(liveBuilds), label: 'Live now' },
          ].map((stat, i, arr) => (
            <div
              key={stat.label}
              style={{
                borderRight: i < arr.length - 1 ? '1px solid #d8d4ca' : 'none',
                paddingRight: i < arr.length - 1 ? '24px' : 0,
                marginRight: i < arr.length - 1 ? '24px' : 0,
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '32px',
                  color: '#0e0d0b',
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  font: '11px/1 DM Mono, Courier New, monospace',
                  textTransform: 'uppercase',
                  color: '#6b6862',
                  marginTop: '4px',
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── App grid ────────────────────────────────────────────────────── */}
      <div style={{ background: '#f2efe8' }}>
        <p
          style={{
            font: '11px/1 DM Mono, Courier New, monospace',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#6b6862',
            padding: '32px 32px 20px',
            margin: 0,
          }}
        >
          Your apps
        </p>

        <div
          style={{
            padding: '0 32px 32px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1px',
            background: '#d8d4ca',
            border: '1px solid #d8d4ca',
            margin: '0 32px 0',
          }}
        >
          {loading ? (
            // Skeleton cards
            [0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: '#f2efe8',
                  padding: '28px',
                  minHeight: '180px',
                  opacity: 0.5,
                }}
              />
            ))
          ) : builds.length === 0 ? (
            <div
              style={{
                background: '#f2efe8',
                padding: '80px 40px',
                textAlign: 'center',
                gridColumn: '1 / -1',
              }}
            >
              <h2
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '24px',
                  fontWeight: 400,
                  color: '#0e0d0b',
                  margin: '0 0 10px',
                }}
              >
                No apps yet
              </h2>
              <p
                style={{
                  font: '12px/1 DM Mono, Courier New, monospace',
                  color: '#6b6862',
                  margin: '0 0 24px',
                }}
              >
                Your first build is waiting.
              </p>
              <button
                onClick={() => navigate('/')}
                style={{
                  padding: '12px 24px',
                  background: '#0e0d0b',
                  color: '#f2efe8',
                  border: 'none',
                  cursor: 'pointer',
                  font: '13px/1 DM Mono, Courier New, monospace',
                }}
              >
                Build your first app →
              </button>
            </div>
          ) : (
            builds.map((build) => (
              <AppCard
                key={build.id}
                build={build}
                onEdit={(b: Build) => navigate(`/app/${b.id}/edit`)}
                onBuildClaimed={() => void fetchBuilds()}
                onDelete={(id) => {
                  setBuilds((prev) => prev.filter((b) => b.id !== id))
                  void fetch(
                    `/api/dashboard/builds?id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`,
                    { method: 'DELETE' },
                  ).catch(() => { /* non-fatal — optimistic removal already applied */ })
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Visila Coach ──────────────────────────────────────────────── */}
      {activeIntervention && (
        <div
          style={{
            background: '#0e0d0b',
            padding: '24px 32px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flex: 1 }}>
            <span
              style={{
                font: '10px/1 DM Mono, Courier New, monospace',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#FF1F6E',
                paddingTop: '2px',
                flexShrink: 0,
              }}
            >
              Coach
            </span>
            <p
              style={{
                font: '13px/1.6 DM Mono, Courier New, monospace',
                color: '#f2efe8',
                margin: 0,
                flex: 1,
              }}
            >
              {activeIntervention.message}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
            {latestComplete?.deploy_url && activeIntervention.type === 'LAUNCH' && (
              <button
                onClick={() => {
                  if (latestComplete.deploy_url) {
                    navigator.clipboard.writeText(latestComplete.deploy_url).catch(() => {})
                    setToastMessage('Link copied!')
                  }
                }}
                style={{
                  background: '#FF1F6E',
                  color: '#0e0d0b',
                  border: 'none',
                  padding: '8px 14px',
                  font: '11px/1 DM Mono, Courier New, monospace',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeIntervention.cta}
              </button>
            )}
            {(activeIntervention.type === 'FIRST_DAY' || activeIntervention.type === 'FIRST_WEEK' || activeIntervention.type === 'NO_ACTIVITY') && latestComplete && (
              <button
                onClick={() => latestComplete && navigate(`/app/${latestComplete.id}/edit`)}
                style={{
                  background: '#FF1F6E',
                  color: '#0e0d0b',
                  border: 'none',
                  padding: '8px 14px',
                  font: '11px/1 DM Mono, Courier New, monospace',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeIntervention.cta}
              </button>
            )}
            <button
              onClick={() => setCoachDismissed(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.35)',
                font: '16px/1 DM Mono, Courier New, monospace',
                cursor: 'pointer',
                padding: '4px',
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Next steps chips ─────────────────────────────────────────────── */}
      {nextSteps.length > 0 && (
        <div style={{ padding: '32px', background: '#f2efe8' }}>
          <p
            style={{
              font: '11px/1 DM Mono, Courier New, monospace',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#6b6862',
              margin: '0 0 16px',
            }}
          >
            Recommended next steps
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {nextSteps.map((step) => (
              <div
                key={step.action}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'white',
                  border: '1px solid #d8d4ca',
                  font: '12px/1 DM Mono, Courier New, monospace',
                  color: '#0e0d0b',
                }}
              >
                {step.priority === 'high' && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#FF1F6E',
                      flexShrink: 0,
                    }}
                  />
                )}
                {step.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {toastMessage && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#0e0d0b', color: '#f2efe8', padding: '10px 20px', font: '12px/1 DM Mono, Courier New, monospace', border: '1px solid #FF1F6E', zIndex: 2000, whiteSpace: 'nowrap', borderRadius: 4 }}>
          {toastMessage}
        </div>
      )}
    </>
  )
}

// ── Setup DB Modal ─────────────────────────────────────────────────────────────

function SetupDBModal({ build, onClose }: { build: Build; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const sql = build.supabase_schema ?? ''

  function handleCopy() {
    void navigator.clipboard.writeText(sql).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      <style>{`.setup-modal-overlay{position:fixed;inset:0;z-index:1100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);padding:24px} .setup-modal{background:#0e0d0b;border-radius:12px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden} .setup-sql{flex:1;overflow-y:auto;background:#111009;padding:16px 20px;font:12px/1.7 DM Mono,Courier New,monospace;color:#c8c4bc;white-space:pre-wrap;word-break:break-all;border:none;resize:none;width:100%;box-sizing:border-box} .setup-sql:focus-visible{outline:2px solid #FF1F6E;outline-offset:-2px} .setup-sql::-webkit-scrollbar{width:4px} .setup-sql::-webkit-scrollbar-thumb{background:#3a3830;border-radius:2px}`}</style>
      <div
        className="setup-modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="setup-modal" role="dialog" aria-modal="true" aria-label="Activate your database">

          {/* Header */}
          <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '20px', fontWeight: 400, color: '#f2efe8', margin: '0 0 4px' }}>
                  Activate your database
                </p>
                <p style={{ font: '12px/1.5 DM Mono, Courier New, monospace', color: '#6b6862', margin: 0 }}>
                  Run this in your Supabase SQL editor to create the schema for <strong style={{ color: '#c8c4bc' }}>{build.app_name}</strong>.
                </p>
              </div>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: '#6b6862', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '4px', flexShrink: 0, marginLeft: '16px' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f2efe8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#6b6862')}
                aria-label="Close"
              >✕</button>
            </div>
          </div>

          {/* SQL code block */}
          <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
            <p style={{ font: '10px/1 DM Mono, Courier New, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b6862', margin: '0 0 8px' }}>SQL Schema</p>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: '0 24px', minHeight: 0 }}>
            <textarea className="setup-sql" readOnly value={sql} aria-label="SQL schema to run in Supabase" />
          </div>

          {/* Actions */}
          <div style={{ padding: '16px 24px 24px', display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0, borderTop: '0.5px solid #2a2925', marginTop: '12px' }}>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? '#2a3d0e' : '#FF1F6E',
                color: copied ? '#FF1F6E' : '#0e0d0b',
                border: copied ? '1px solid #FF1F6E' : 'none',
                padding: '10px 20px',
                font: '500 13px/1 DM Mono, Courier New, monospace',
                cursor: 'pointer',
                borderRadius: '6px',
                transition: 'all 0.15s',
                minHeight: '44px',
              }}
            >
              {copied ? '✓ Copied' : 'Copy SQL'}
            </button>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                color: '#f2efe8',
                border: '1px solid #3a3830',
                padding: '10px 20px',
                font: '13px/1 DM Mono, Courier New, monospace',
                borderRadius: '6px',
                textDecoration: 'none',
                minHeight: '44px',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#f2efe8')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#3a3830')}
            >
              Open Supabase ↗
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Claim Modal ────────────────────────────────────────────────────────────────

function ClaimModal({ build, onClose, onClaimed }: { build: Build; onClose: () => void; onClaimed: () => void }) {
  const [step, setStep] = useState<'confirm' | 'claiming' | 'done' | 'error'>('confirm')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [claimedUrl, setClaimedUrl] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll claim_status every 10s after initiating
  useEffect(() => {
    if (step !== 'done') return
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/build-status?id=${encodeURIComponent(build.id)}`)
        if (r.ok) {
          const s = await r.json() as { claim_status?: string }
          if (s.claim_status === 'claimed') {
            if (pollRef.current) clearInterval(pollRef.current)
            onClaimed()
          }
        }
      } catch { /* non-fatal */ }
    }, 10000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [step, build.id, onClaimed])

  const handleClaim = async () => {
    setStep('claiming')
    setErrorMsg(null)
    try {
      const r = await fetch('/api/claim-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ build_id: build.id }),
      })
      const data = await r.json() as { ok?: boolean; error?: string; claimed_url?: string }
      if (!r.ok || !data.ok) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.')
        setStep('error')
        return
      }
      setClaimedUrl(data.claimed_url ?? null)
      setStep('done')
      onClaimed()
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStep('error')
    }
  }

  const steps = [
    { label: 'GitHub', sub: 'Your code', done: true },
    { label: 'Vercel', sub: 'Your deployment', done: true },
    { label: 'Done', sub: 'Check your email', done: step === 'done' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, background: 'rgba(14,13,11,0.7)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#f2efe8', width: '100%', maxWidth: '480px',
          zIndex: 1001, padding: '40px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <p style={{ font: '11px/1 DM Mono, Courier New, monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b6862', margin: '0 0 8px' }}>
              Claim your app
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '24px', fontWeight: 400, color: '#0e0d0b', margin: 0 }}>
              {build.app_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6862', font: '18px/1 DM Mono, Courier New, monospace', padding: '4px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {steps.map((s, i) => (
            <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: s.done ? '#FF1F6E' : '#d8d4ca',
                color: s.done ? '#0e0d0b' : '#6b6862',
                font: '12px/32px DM Mono, Courier New, monospace',
                margin: '0 auto 8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.done ? '✓' : String(i + 1)}
              </div>
              <p style={{ font: '11px/1 DM Mono, Courier New, monospace', fontWeight: 600, color: '#0e0d0b', margin: '0 0 4px' }}>{s.label}</p>
              <p style={{ font: '10px/1.3 DM Mono, Courier New, monospace', color: '#6b6862', margin: 0 }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Content by step */}
        {step === 'confirm' && (
          <>
            <div style={{ background: '#eceae1', padding: '16px', marginBottom: '24px', fontSize: '13px', fontFamily: 'DM Mono, Courier New, monospace', color: '#0e0d0b', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 600 }}>What happens when you claim:</p>
              <p style={{ margin: '0 0 6px' }}>1. GitHub sends you a transfer confirmation email</p>
              <p style={{ margin: '0 0 6px' }}>2. A new Vercel project is created in your account</p>
              <p style={{ margin: 0 }}>3. The staging version is removed</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => void handleClaim()}
                style={{
                  flex: 1, background: '#0e0d0b', color: '#f2efe8', border: 'none',
                  padding: '12px 24px', font: '13px/1 DM Mono, Courier New, monospace',
                  cursor: 'pointer', borderRadius: '4px',
                }}
              >
                Claim app →
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', color: '#6b6862', border: '1px solid #d8d4ca',
                  padding: '12px 20px', font: '13px/1 DM Mono, Courier New, monospace',
                  cursor: 'pointer', borderRadius: '4px',
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'claiming' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid #d8d4ca', borderTopColor: '#FF1F6E', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ font: '13px/1.6 DM Mono, Courier New, monospace', color: '#0e0d0b', margin: 0 }}>
              Initiating transfer…
            </p>
          </div>
        )}

        {step === 'done' && (
          <>
            <div style={{ background: '#eceae1', padding: '16px', marginBottom: '24px' }}>
              <p style={{ font: '12px/1 DM Mono, Courier New, monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FF1F6E', margin: '0 0 8px' }}>
                Transfer initiated
              </p>
              <p style={{ font: '13px/1.6 DM Mono, Courier New, monospace', color: '#0e0d0b', margin: 0 }}>
                Check your email to accept the GitHub transfer. One click and it&apos;s yours.
              </p>
              {claimedUrl && (
                <p style={{ font: '12px/1.5 DM Mono, Courier New, monospace', color: '#6b6862', margin: '12px 0 0' }}>
                  New URL: <a href={claimedUrl} target="_blank" rel="noreferrer" style={{ color: '#FF1F6E', textDecoration: 'none' }}>{claimedUrl.replace('https://', '')}</a>
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                width: '100%', background: '#0e0d0b', color: '#f2efe8', border: 'none',
                padding: '12px 24px', font: '13px/1 DM Mono, Courier New, monospace',
                cursor: 'pointer', borderRadius: '4px',
              }}
            >
              Done
            </button>
          </>
        )}

        {step === 'error' && (
          <>
            <div style={{ background: '#fee2e2', padding: '16px', marginBottom: '24px' }}>
              <p style={{ font: '13px/1.6 DM Mono, Courier New, monospace', color: '#991b1b', margin: 0 }}>
                {errorMsg}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setStep('confirm'); setErrorMsg(null) }}
                style={{
                  flex: 1, background: '#0e0d0b', color: '#f2efe8', border: 'none',
                  padding: '12px 24px', font: '13px/1 DM Mono, Courier New, monospace',
                  cursor: 'pointer', borderRadius: '4px',
                }}
              >
                Try again
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', color: '#6b6862', border: '1px solid #d8d4ca',
                  padding: '12px 20px', font: '13px/1 DM Mono, Courier New, monospace',
                  cursor: 'pointer', borderRadius: '4px',
                }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── App card ───────────────────────────────────────────────────────────────────

function AppCard({
  build,
  onEdit,
  onBuildClaimed,
  onDelete,
}: {
  build: Build
  onEdit: (b: Build) => void
  onBuildClaimed: () => void
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const statusColor = {
    complete: '#FF1F6E',
    building: '#FF1F6E',
    error: '#c0392b',
    pending: '#6b6862',
  }[build.status]

  return (
    <div
      style={{
        background: hovered ? '#eceae1' : '#f2efe8',
        padding: '28px',
        position: 'relative',
        cursor: 'default',
        transition: 'background 0.15s',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top status bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background:
            build.status === 'building' ? 'transparent' : statusColor,
          overflow: 'hidden',
        }}
      >
        {build.status === 'building' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              height: '100%',
              background: '#FF1F6E',
              animation: 'slideProgress 2s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Status badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: statusColor,
            marginRight: '8px',
            flexShrink: 0,
            animation:
              build.status === 'building' ? 'pulse 1.4s infinite' : 'none',
          }}
        />
        <span
          style={{
            font: '11px/1 DM Mono, Courier New, monospace',
            textTransform: 'uppercase',
            color: '#6b6862',
          }}
        >
          {build.status === 'complete'
            ? 'Live'
            : build.status === 'building'
            ? 'Building'
            : build.status === 'error'
            ? 'Error'
            : 'Pending'}
        </span>

        {/* Confidence score badge */}
        {build.status === 'complete' && build.confidence_score !== null && (
          <span
            title={`Visila Standards score: ${build.confidence_score}/100`}
            style={{
              marginLeft: 'auto',
              font: '11px/1 DM Mono, Courier New, monospace',
              color: build.confidence_score >= 80 ? '#3B6D11'
                   : build.confidence_score >= 60 ? '#f97316'
                   : '#c0392b',
              letterSpacing: '0.04em',
            }}
          >
            {build.confidence_score}/100
          </span>
        )}
      </div>

      {/* App name */}
      <p
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '22px',
          fontWeight: 400,
          color: '#0e0d0b',
          margin: '0 0 6px',
          lineHeight: 1.2,
        }}
      >
        {build.app_name}
      </p>

      {/* Idea */}
      <p
        style={{
          font: '12px/1.5 DM Mono, Courier New, monospace',
          color: '#6b6862',
          margin: '0 0 20px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {build.idea}
      </p>

      {/* Deploy URL */}
      {build.status === 'complete' && build.deploy_url && (
        <a
          href={build.deploy_url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block',
            font: '11px/1 DM Mono, Courier New, monospace',
            color: '#FF1F6E',
            textDecoration: 'none',
            marginBottom: '20px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {build.deploy_url.replace('https://', '')}
        </a>
      )}

      {/* Setup DB chip — only for builds the user must configure themselves.
          Visila-hosted builds (sovereign / sovereign_temporary) already have
          the schema running on Visila's DB — nothing for the user to do. */}
      {build.supabase_schema && !build.claimed_at && (build.supabase_mode == null || build.supabase_mode === 'own') && (
        <button
          onClick={() => setSetupOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            background: 'transparent',
            color: '#FF1F6E',
            border: '1px solid #FF1F6E55',
            font: '11px/1 DM Mono, Courier New, monospace',
            cursor: 'pointer',
            borderRadius: '100px',
            marginBottom: '12px',
            transition: 'border-color 0.15s, background 0.15s',
            minHeight: '28px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#FF1F6E10'
            e.currentTarget.style.borderColor = '#FF1F6E'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = '#FF1F6E55'
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF1F6E', flexShrink: 0, display: 'inline-block' }} />
          Setup DB
        </button>
      )}

      {/* Claim app button — shown on staged, unclaimed builds */}
      {build.staging && !build.claimed_at && build.claim_status !== 'claimed' && (
        <div style={{ marginBottom: '12px' }}>
          {build.claim_status === 'transfer_partial' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
              <span style={{ font: '10px/1.4 DM Mono, Courier New, monospace', color: '#f97316' }}>
                Transfer partially completed — check Vercel
              </span>
            </div>
          ) : build.claim_status === 'pending_github_acceptance' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#f97316' }}>
                Check email to accept GitHub transfer
              </span>
            </div>
          ) : null}
          <button
            onClick={() => setClaimOpen(true)}
            disabled={build.claim_status === 'pending_github_acceptance'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: build.claim_status === 'pending_github_acceptance' ? 'transparent' : '#FF1F6E',
              color: build.claim_status === 'pending_github_acceptance' ? '#FF1F6E99' : '#0e0d0b',
              border: build.claim_status === 'pending_github_acceptance' ? '1px solid #FF1F6E40' : 'none',
              font: '11px/1 DM Mono, Courier New, monospace',
              fontWeight: 600,
              cursor: build.claim_status === 'pending_github_acceptance' ? 'default' : 'pointer',
              borderRadius: '4px',
              minHeight: '28px',
            }}
          >
            {build.claim_status === 'pending_github_acceptance' ? 'Transfer pending…' : 'Claim your app →'}
          </button>
        </div>
      )}

      {/* Claimed badge */}
      {build.claim_status === 'claimed' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF1F6E', flexShrink: 0, display: 'inline-block' }} />
          <span style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#FF1F6E' }}>
            Claimed
          </span>
          {build.claimed_url && (
            <a
              href={build.claimed_url}
              target="_blank"
              rel="noreferrer"
              style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#6b6862', textDecoration: 'none', marginLeft: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}
            >
              {build.claimed_url.replace('https://', '')}
            </a>
          )}
        </div>
      )}

      {/* Action buttons */}
      {build.status === 'complete' && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => onEdit(build)}
            style={{
              background: '#0e0d0b',
              color: '#f2efe8',
              border: 'none',
              borderRadius: '4px',
              font: '11px/1 DM Mono, Courier New, monospace',
              padding: '7px 14px',
              cursor: 'pointer',
            }}
          >
            Edit app
          </button>
          {build.repo_url && (
            <button
              onClick={() => window.open(build.repo_url!, '_blank')}
              style={{
                background: 'transparent',
                color: '#0e0d0b',
                border: '1px solid #0e0d0b',
                borderRadius: '4px',
                font: '11px/1 DM Mono, Courier New, monospace',
                padding: '7px 14px',
                cursor: 'pointer',
              }}
            >
              GitHub
            </button>
          )}
          {build.deploy_url && (
            <button
              onClick={() => window.open(build.deploy_url!, '_blank')}
              style={{
                background: 'transparent',
                color: '#0e0d0b',
                border: '1px solid #0e0d0b',
                borderRadius: '4px',
                font: '11px/1 DM Mono, Courier New, monospace',
                padding: '7px 14px',
                cursor: 'pointer',
              }}
            >
              Visit
            </button>
          )}
        </div>
      )}

      {build.status === 'building' && (
        <span
          style={{
            font: '11px/1 DM Mono, Courier New, monospace',
            color: '#6b6862',
          }}
        >
          {build.step ?? 'Building…'}
        </span>
      )}

      {build.status === 'error' && (
        <div>
          <p
            style={{
              font: '11px/1.5 DM Mono, Courier New, monospace',
              color: '#c0392b',
              margin: '0 0 12px',
            }}
          >
            {build.error?.slice(0, 100)}
          </p>
          <a
            href={build.idea ? `/?idea=${encodeURIComponent(build.idea)}` : '/'}
            style={{
              background: 'transparent',
              color: '#0e0d0b',
              border: '1px solid #0e0d0b',
              font: '11px/1 DM Mono, Courier New, monospace',
              padding: '7px 14px',
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Try again
          </a>
        </div>
      )}

      {/* Date */}
      <span
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '20px',
          font: '10px/1 DM Mono, Courier New, monospace',
          color: '#6b6862',
        }}
      >
        {relativeDate(build.created_at)}
      </span>

      {/* Delete */}
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        {confirmDelete ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#6b6862' }}>
              Delete this app?
            </span>
            <button
              onClick={() => onDelete(build.id)}
              style={{
                background: '#c0392b',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                font: '11px/1 DM Mono, Courier New, monospace',
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                background: 'transparent',
                color: '#6b6862',
                border: '1px solid #d8d4ca',
                borderRadius: '4px',
                font: '11px/1 DM Mono, Courier New, monospace',
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              background: 'transparent',
              color: '#6b6862',
              border: 'none',
              font: '11px/1 DM Mono, Courier New, monospace',
              padding: '4px 0',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            Delete
          </button>
        )}
      </div>

      {/* Setup DB Modal */}
      {setupOpen && <SetupDBModal build={build} onClose={() => setSetupOpen(false)} />}

      {/* Claim Modal */}
      {claimOpen && (
        <ClaimModal
          build={build}
          onClose={() => setClaimOpen(false)}
          onClaimed={() => {
            setClaimOpen(false)
            onBuildClaimed()
          }}
        />
      )}
    </div>
  )
}

// ── Dashboard (root) ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const newEmail = searchParams.get('newEmail')

  // Determine initial state
  const session = getSession()

  const [state, setState] = useState<'gate' | 'verify' | 'auth'>(
    token ? 'verify' : session ? 'auth' : 'gate',
  )
  const [authEmail, setAuthEmail] = useState<string>(session?.email ?? '')

  const handleVerifySuccess = useCallback((email: string) => {
    setAuthEmail(email)
    setState('auth')
  }, [])

  if (state === 'verify' && token) {
    return <TokenVerify token={token} newEmail={newEmail} onSuccess={handleVerifySuccess} />
  }

  if (state === 'auth' && authEmail) {
    return <AuthDashboard email={authEmail} />
  }

  return <EmailGate onVerified={(email) => { setAuthEmail(email); setState('auth') }} />
}
