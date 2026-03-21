// src/pages/Dashboard.tsx — Sovereign Dashboard (Phase 2)
//
// Three states:
//   A — Email gate      (no token, no session)
//   B — Token verify    (?token=xxx in URL)
//   C — Authenticated   (sovereign_user in sessionStorage)
//
// Auth: magic link → sessionStorage only (never localStorage)
// Session key: 'sovereign_user' → JSON.stringify({ email: string })

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

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
  created_at: string
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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
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

// ── Wordmark ───────────────────────────────────────────────────────────────────

function Wordmark({ dark }: { dark?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: '20px',
        fontWeight: 400,
        color: dark ? '#f2efe8' : '#0e0d0b',
      }}
    >
      Sovereign<span style={{ color: '#8ab800' }}>.</span>
    </span>
  )
}

// ── STATE A — Email gate ───────────────────────────────────────────────────────

function EmailGate({ onVerified }: { onVerified: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
          <Wordmark />
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
                      background: '#8ab800',
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
                      color: '#8ab800',
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
                <input
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
                    outline: 'none',
                    display: 'block',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#0e0d0b')}
                  onBlur={(e) => (e.target.style.borderColor = '#d8d4ca')}
                />
                {error && (
                  <p
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
          </div>
        </div>
      </div>
    </>
  )
}

// ── STATE B — Token verification ───────────────────────────────────────────────

function TokenVerify({
  token,
  onSuccess,
}: {
  token: string
  onSuccess: (email: string) => void
}) {
  const navigate = useNavigate()
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const didVerify = useRef(false)

  useEffect(() => {
    if (didVerify.current) return
    didVerify.current = true

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
  }, [token, onSuccess])

  if (verifyError) {
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
              <Wordmark />
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
        <Wordmark />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#8ab800',
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

// ── STATE C — Authenticated dashboard ─────────────────────────────────────────

function AuthDashboard({ email }: { email: string }) {
  const navigate = useNavigate()
  const [builds, setBuilds] = useState<Build[]>([])
  const [loading, setLoading] = useState(true)

  // Edit drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [currentBuild, setCurrentBuild] = useState<Build | null>(null)
  const [editInput, setEditInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const editInputRef = useRef<HTMLTextAreaElement>(null)

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null)

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
      setBuilds(data.builds ?? [])
    } catch (err) {
      // Fail softly — don't blank the page
      console.warn('[dashboard] Failed to fetch builds', err)
    } finally {
      setLoading(false)
    }
  }, [email])

  useEffect(() => {
    void fetchBuilds()
  }, [fetchBuilds])

  // Toast auto-clear
  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(null), 3000)
    return () => clearTimeout(t)
  }, [toastMessage])

  const openEditDrawer = useCallback((build: Build) => {
    setCurrentBuild(build)
    setIsDrawerOpen(true)
    setEditError(null)
    setTimeout(() => editInputRef.current?.focus(), 350)
  }, [])

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false)
    setCurrentBuild(null)
    setEditInput('')
    setEditError(null)
  }, [])

  const submitEdit = useCallback(async () => {
    if (!currentBuild || !editInput.trim()) return
    setIsSubmitting(true)
    setEditError(null)
    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildId: currentBuild.id,
          appName: currentBuild.app_name,
          repoUrl: currentBuild.repo_url,
          editRequest: editInput,
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        setEditError(data.error ?? 'Something went wrong. Please try again.')
        setIsSubmitting(false)
        return
      }
      closeDrawer()
      setToastMessage('Change applied — deploying now')
      setTimeout(() => { void fetchBuilds() }, 5000)
    } catch {
      setEditError('Network error. Please try again.')
      setIsSubmitting(false)
    }
  }, [currentBuild, editInput, closeDrawer, fetchBuilds])

  // Stats
  const totalBuilds = builds.length
  const liveBuilds = builds.filter((b) => b.status === 'complete').length

  // Next steps from most recent complete build
  const latestComplete = builds.find((b) => b.status === 'complete')
  const nextSteps: NextStep[] = latestComplete?.next_steps ?? []

  return (
    <>
      <style>{`
        @keyframes slideProgress {
          0% { left: -60%; width: 60%; }
          100% { left: 100%; width: 60%; }
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateX(-50%) translateY(6px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        * { box-sizing: border-box; }
        .edit-input-row { display: flex; gap: 12px; align-items: flex-start; }
        .edit-textarea { font-size: 14px; }
        @media (max-width: 640px) {
          .edit-input-row { flex-direction: column; gap: 10px; }
          .edit-textarea { font-size: 16px !important; width: 100%; }
          .edit-submit-btn { width: 100%; padding: 14px; white-space: normal; align-self: stretch; }
        }
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
        <Wordmark dark />
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
              background: '#8ab800',
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
          <em style={{ color: '#8ab800' }}>you own.</em>
        </h1>

        {/* Stats row */}
        <div style={{ marginTop: '32px', display: 'flex' }}>
          {[
            { value: loading ? '—' : String(totalBuilds), label: 'Apps built' },
            { value: loading ? '—' : String(liveBuilds), label: 'Live now' },
            { value: loading ? '—' : String(liveBuilds), label: 'Repos owned' },
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
            builds.map((build) => <AppCard key={build.id} build={build} onEdit={openEditDrawer} />)
          )}
        </div>
      </div>

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
              <button
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
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = '#0e0d0b')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = '#d8d4ca')
                }
              >
                {step.priority === 'high' && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#8ab800',
                      flexShrink: 0,
                    }}
                  />
                )}
                {step.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit drawer ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#0e0d0b',
          padding: '28px 32px',
          borderTop: '2px solid #8ab800',
          transform: isDrawerOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 1000,
        }}
      >
        {/* Close button */}
        <button
          onClick={closeDrawer}
          style={{
            position: 'absolute',
            top: '20px',
            right: '24px',
            background: 'none',
            border: 'none',
            color: '#6b6862',
            fontSize: '20px',
            cursor: 'pointer',
            lineHeight: 1,
            padding: '4px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f2efe8')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6b6862')}
        >
          ✕
        </button>

        <p
          style={{
            font: '11px/1 DM Mono, Courier New, monospace',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#6b6862',
            margin: '0 0 6px',
          }}
        >
          Editing
        </p>
        <p
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '18px',
            fontWeight: 400,
            color: '#f2efe8',
            margin: '0 0 20px',
          }}
        >
          {currentBuild?.app_name}
        </p>

        <div className="edit-input-row">
          <textarea
            ref={editInputRef}
            value={editInput}
            onChange={(e) => {
              setEditInput(e.target.value)
              const el = e.target
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 200) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeDrawer()
            }}
            placeholder="e.g. Change the hero text to say Welcome back…"
            rows={3}
            className="edit-textarea"
            style={{
              flex: 1,
              font: '14px/1.6 DM Mono, Courier New, monospace',
              background: '#1a1917',
              border: '0.5px solid rgba(242,239,232,0.2)',
              borderRadius: '8px',
              color: '#f2efe8',
              padding: '12px',
              outline: 'none',
              resize: 'none',
              minHeight: '72px',
              maxHeight: '200px',
              overflowY: 'auto',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#8ab800')}
            onBlur={(e) =>
              (e.target.style.borderColor = 'rgba(242,239,232,0.2)')
            }
          />
          <button
            onClick={() => { void submitEdit() }}
            disabled={isSubmitting || !editInput.trim()}
            className="edit-submit-btn"
            style={{
              background: '#8ab800',
              color: '#0e0d0b',
              border: 'none',
              borderRadius: '6px',
              padding: '14px 24px',
              font: '500 12px/1 DM Mono, Courier New, monospace',
              cursor: isSubmitting || !editInput.trim() ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: isSubmitting ? 0.7 : 1,
              alignSelf: 'flex-end',
            }}
          >
            {isSubmitting ? 'Applying…' : 'Apply changes →'}
          </button>
        </div>

        {editError && (
          <p
            style={{
              font: '12px/1 DM Mono, Courier New, monospace',
              color: '#c0392b',
              margin: '8px 0 0',
            }}
          >
            {editError}
          </p>
        )}
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0e0d0b',
            color: '#f2efe8',
            padding: '12px 24px',
            font: '13px/1 DM Mono, Courier New, monospace',
            border: '1px solid #8ab800',
            zIndex: 2000,
            animation: 'fadeIn 0.2s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {toastMessage}
        </div>
      )}
    </>
  )
}

// ── App card ───────────────────────────────────────────────────────────────────

function AppCard({
  build,
  onEdit,
}: {
  build: Build
  onEdit: (b: Build) => void
}) {
  const [hovered, setHovered] = useState(false)

  const statusColor = {
    complete: '#8ab800',
    building: '#8ab800',
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
              background: '#8ab800',
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
            color: '#8ab800',
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

      {/* Action buttons */}
      {build.status === 'complete' && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => onEdit(build)}
            style={{
              background: '#0e0d0b',
              color: '#f2efe8',
              border: 'none',
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
            href="/"
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
    </div>
  )
}

// ── Dashboard (root) ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

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
    return <TokenVerify token={token} onSuccess={handleVerifySuccess} />
  }

  if (state === 'auth' && authEmail) {
    return <AuthDashboard email={authEmail} />
  }

  return <EmailGate onVerified={(email) => { setAuthEmail(email); setState('auth') }} />
}
