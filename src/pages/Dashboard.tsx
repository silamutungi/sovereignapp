// src/pages/Dashboard.tsx — Sovereign Dashboard (Phase 2)
//
// Three states:
//   A — Email gate      (no token, no session)
//   B — Token verify    (?token=xxx in URL)
//   C — Authenticated   (sovereign_user in sessionStorage)
//
// Auth: magic link → sessionStorage only (never localStorage)
// Session key: 'sovereign_user' → JSON.stringify({ email: string })

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
  supabase_schema: string | null
  supabase_mode: string | null
  claimed_at: string | null
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

// ── Chat/Preview Panel ─────────────────────────────────────────────────────────

interface ChatMsg {
  id: number
  role: 'user' | 'sovereign'
  text: string
  previewLink?: boolean
}

const SUGGESTION_CHIPS = ['Change colors', 'Edit headline', 'Add section', 'Fix a bug']

function EditPanel({
  build,
  onClose,
  onEditSuccess,
}: {
  build: Build
  onClose: () => void
  onEditSuccess: (msg: string) => void
}) {
  const [tab, setTab] = useState<'chat' | 'preview'>('chat')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [iframeBlocked, setIframeBlocked] = useState(false)
  const [deployReady, setDeployReady] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const iframeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deployPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const counter = useRef(0)

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  // Lock body scroll while panel is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Focus input when switching to chat
  useEffect(() => {
    if (tab === 'chat') setTimeout(() => inputRef.current?.focus(), 80)
  }, [tab])

  function push(msg: Omit<ChatMsg, 'id'>) {
    setMessages(prev => [...prev, { ...msg, id: ++counter.current }])
  }

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    push({ role: 'user', text })
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setBusy(true)
    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildId: build.id,
          appName: build.app_name,
          repoUrl: build.repo_url,
          editRequest: text,
        }),
      })
      const data = await res.json() as { ok?: boolean; success?: boolean; error?: string }
      if (!res.ok || (!data.ok && !data.success)) {
        push({ role: 'sovereign', text: data.error ?? 'Something went wrong. Please try again.' })
      } else {
        setDeployReady(false)
        push({ role: 'sovereign', text: 'Done — your change is deploying now.', previewLink: true })
        onEditSuccess('Change applied — deploying now')

        // Poll build-status until 'complete', then refresh the preview iframe
        if (deployPollRef.current) clearInterval(deployPollRef.current)
        let attempts = 0
        deployPollRef.current = setInterval(async () => {
          attempts++
          try {
            const statusRes = await fetch(`/api/build-status?id=${encodeURIComponent(build.id)}`)
            if (statusRes.ok) {
              const statusData = await statusRes.json() as { status?: string }
              if (statusData.status === 'complete') {
                clearInterval(deployPollRef.current!)
                deployPollRef.current = null
                setDeployReady(true)
                setPreviewKey((k) => k + 1)
                setIframeBlocked(false)
                onEditSuccess('Live — see your changes')
              } else if (statusData.status === 'error') {
                clearInterval(deployPollRef.current!)
                deployPollRef.current = null
              }
            }
          } catch { /* non-fatal */ }
          if (attempts >= 30) {  // stop after 2.5 min
            clearInterval(deployPollRef.current!)
            deployPollRef.current = null
          }
        }, 5000)
      }
    } catch {
      push({ role: 'sovereign', text: 'Network error. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const previewUrl = build.deploy_url ?? ''
  const previewDomain = previewUrl.replace('https://', '').split('/')[0] ?? previewUrl

  return (
    <>
      <style>{`
        .ep-overlay {
          position: fixed; inset: 0; z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.55);
        }
        .ep-panel {
          background: #0e0d0b;
          display: flex; flex-direction: column;
          width: 480px; height: min(700px, 90vh);
          border-radius: 12px; overflow: hidden;
        }
        .ep-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 20px 0; flex-shrink: 0;
        }
        .ep-toggle-wrap { padding: 12px 20px; flex-shrink: 0; }
        .ep-toggle {
          display: flex; background: #1a1917;
          border-radius: 10px; padding: 4px;
        }
        .ep-tab-btn {
          flex: 1; padding: 9px 0; border: none; cursor: pointer;
          font: 15px/1 DM Mono, Courier New, monospace;
          border-radius: 7px;
          transition: background 0.15s, color 0.15s;
        }
        .ep-tab-btn.active  { background: #f2efe8; color: #0e0d0b; font-weight: 700; }
        .ep-tab-btn.inactive { background: transparent; color: #f2efe8; font-weight: 400; }
        .ep-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        .ep-chat-scroll {
          flex: 1; overflow-y: auto; padding: 16px 20px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .ep-chat-scroll::-webkit-scrollbar { width: 4px; }
        .ep-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .ep-chat-scroll::-webkit-scrollbar-thumb { background: #3a3830; border-radius: 2px; }
        .ep-msg-user {
          align-self: flex-end; max-width: 80%;
          background: #8ab800; color: #0e0d0b;
          padding: 10px 14px;
          border-radius: 12px 12px 2px 12px;
          font: 14px/1.5 DM Mono, Courier New, monospace;
          word-break: break-word;
        }
        .ep-msg-sov { align-self: flex-start; max-width: 80%; display: flex; gap: 8px; align-items: flex-start; }
        .ep-avatar {
          width: 24px; height: 24px; border-radius: 50%;
          background: #8ab800; color: #0e0d0b;
          font: 700 11px/24px DM Mono, Courier New, monospace;
          text-align: center; flex-shrink: 0;
        }
        .ep-bubble {
          background: #1a1917; color: #c8c4bc;
          padding: 10px 14px;
          border-radius: 2px 12px 12px 12px;
          font: 14px/1.5 DM Mono, Courier New, monospace;
          word-break: break-word;
        }
        .ep-preview-link {
          display: inline-block; margin-top: 6px;
          color: #8ab800; cursor: pointer;
          font: 13px/1 DM Mono, Courier New, monospace;
          background: none; border: none; padding: 0;
        }
        .ep-preview-link:hover { text-decoration: underline; }
        .ep-typing { display: flex; gap: 4px; align-items: center; padding: 2px 0; }
        .ep-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #6b6862;
          animation: epDotBounce 1.2s ease-in-out infinite;
        }
        .ep-dot:nth-child(2) { animation-delay: 0.2s; }
        .ep-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes epDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }
        .ep-input-area {
          flex-shrink: 0; padding: 8px 20px 16px;
          border-top: 0.5px solid #2a2925;
        }
        .ep-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .ep-chip {
          font: 12px/1 DM Mono, Courier New, monospace; color: #f2efe8;
          background: #1a1917; border: 0.5px solid #3a3830;
          border-radius: 100px; padding: 5px 10px; cursor: pointer;
          transition: background 0.12s;
        }
        .ep-chip:hover { background: #2a2925; }
        .ep-send-row { display: flex; gap: 8px; align-items: flex-end; }
        .ep-textarea {
          flex: 1; background: #1a1917; color: #f2efe8;
          border: 0.5px solid #3a3830; border-radius: 8px;
          padding: 10px 12px;
          font: 16px/1.5 DM Mono, Courier New, monospace;
          resize: none; min-height: 44px; max-height: 140px;
          overflow-y: auto;
        }
        .ep-textarea::placeholder { color: #6b6862; }
        .ep-textarea:focus { border-color: #8ab800; }
        .ep-textarea:focus-visible { outline: 2px solid #8ab800; outline-offset: 2px; }
        .ep-send-btn {
          width: 40px; height: 40px; border-radius: 8px;
          background: #8ab800; color: #0e0d0b;
          border: none; cursor: pointer; font-size: 18px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: opacity 0.12s;
        }
        .ep-send-btn:disabled { opacity: 0.4; cursor: default; }
        .ep-preview-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        .ep-browser-chrome {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px; background: #1a1917;
          border-bottom: 0.5px solid #2a2925; flex-shrink: 0;
        }
        .ep-browser-dots { display: flex; gap: 5px; flex-shrink: 0; }
        .ep-browser-dot { width: 10px; height: 10px; border-radius: 50%; }
        .ep-url-pill {
          flex: 1; background: #0e0d0b; border-radius: 4px;
          padding: 5px 10px;
          font: 11px/1 DM Mono, Courier New, monospace; color: #6b6862;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ep-iframe { flex: 1; border: none; width: 100%; }
        .ep-preview-footer {
          display: flex; gap: 10px; align-items: center; justify-content: space-between;
          padding: 12px 20px; border-top: 0.5px solid #2a2925; flex-shrink: 0;
        }
        .ep-back-btn {
          font: 12px/1 DM Mono, Courier New, monospace; color: #f2efe8;
          background: none; border: 0.5px solid #3a3830;
          border-radius: 6px; padding: 8px 14px; cursor: pointer;
        }
        .ep-back-btn:hover { border-color: #f2efe8; }
        .ep-open-btn {
          font: 12px/1 DM Mono, Courier New, monospace; color: #0e0d0b;
          background: #8ab800; border: none; border-radius: 6px;
          padding: 8px 14px; cursor: pointer; text-decoration: none;
          display: inline-flex; align-items: center; gap: 4px;
        }
        @keyframes epSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .ep-overlay { background: transparent; align-items: flex-end; justify-content: flex-start; }
          .ep-panel { width: 100%; height: 100%; border-radius: 0; animation: epSlideUp 0.32s cubic-bezier(0.16, 1, 0.3, 1); }
        }
      `}</style>

      <div
        className="ep-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="ep-panel">

          {/* Header */}
          <div className="ep-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8ab800', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ font: 'italic 15px/1 "DM Mono", Courier New, monospace', color: '#f2efe8' }}>
                {build.app_name}
              </span>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#6b6862', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '4px' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f2efe8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6b6862')}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Tab toggle */}
          <div className="ep-toggle-wrap">
            <div className="ep-toggle">
              <button className={`ep-tab-btn ${tab === 'chat' ? 'active' : 'inactive'}`} onClick={() => setTab('chat')}>Chat</button>
              <button className={`ep-tab-btn ${tab === 'preview' ? 'active' : 'inactive'}`} onClick={() => setTab('preview')}>Preview</button>
            </div>
          </div>

          {/* Body */}
          <div className="ep-body">

            {tab === 'chat' && (
              <>
                {/* Message list */}
                <div ref={scrollRef} className="ep-chat-scroll">
                  {messages.length === 0 && (
                    <p style={{ font: '12px/1.6 DM Mono, Courier New, monospace', color: '#6b6862', margin: 0 }}>
                      Describe a change — Sovereign will apply it to your live app.
                    </p>
                  )}
                  {messages.map((msg) =>
                    msg.role === 'user' ? (
                      <div key={msg.id} className="ep-msg-user">{msg.text}</div>
                    ) : (
                      <div key={msg.id} className="ep-msg-sov">
                        <div className="ep-avatar">S</div>
                        <div className="ep-bubble">
                          {msg.text}
                          {msg.previewLink && (
                            <>
                              {' '}
                              <button className="ep-preview-link" onClick={() => setTab('preview')}>
                                {deployReady ? 'See live changes →' : 'See preview →'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  )}
                  {busy && (
                    <div className="ep-msg-sov">
                      <div className="ep-avatar">S</div>
                      <div className="ep-bubble">
                        <div className="ep-typing">
                          <div className="ep-dot" />
                          <div className="ep-dot" />
                          <div className="ep-dot" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input area */}
                <div className="ep-input-area">
                  <div className="ep-chips">
                    {SUGGESTION_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        className="ep-chip"
                        onClick={() => { setInput(chip); inputRef.current?.focus() }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <div className="ep-send-row">
                    <textarea
                      ref={inputRef}
                      className="ep-textarea"
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value)
                        const el = e.target
                        el.style.height = 'auto'
                        el.style.height = Math.min(el.scrollHeight, 140) + 'px'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
                        if (e.key === 'Escape') onClose()
                      }}
                      placeholder="Describe a change…"
                      rows={1}
                    />
                    <button
                      className="ep-send-btn"
                      onClick={() => void send()}
                      disabled={busy || !input.trim()}
                      aria-label="Send"
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </>
            )}

            {tab === 'preview' && (
              <div className="ep-preview-body">
                <div className="ep-browser-chrome">
                  <div className="ep-browser-dots">
                    <div className="ep-browser-dot" style={{ background: '#ff5f57' }} />
                    <div className="ep-browser-dot" style={{ background: '#febc2e' }} />
                    <div className="ep-browser-dot" style={{ background: '#28c840' }} />
                  </div>
                  <div className="ep-url-pill">{previewDomain}</div>
                </div>
                {iframeBlocked ? (
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
                  }}>
                    <span style={{ fontSize: 32 }}>🔒</span>
                    <p style={{ font: '13px/1.6 DM Mono, Courier New, monospace', color: '#c8c4bc', textAlign: 'center', margin: 0 }}>
                      Preview requires opening in a new tab.<br />
                      <span style={{ color: '#6b6862', fontSize: 11 }}>Vercel deployment protection is active.</span>
                    </p>
                    <a href={previewUrl} target="_blank" rel="noreferrer" className="ep-open-btn" style={{ fontSize: 14, padding: '10px 20px' }}>
                      Open in new tab ↗
                    </a>
                  </div>
                ) : (
                  <iframe
                    key={`${previewUrl}-${previewKey}`}
                    src={previewUrl}
                    className="ep-iframe"
                    title={`Preview of ${build.app_name}`}
                    onLoad={() => {
                      if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current)
                    }}
                    onError={() => {
                      if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current)
                      setIframeBlocked(true)
                    }}
                    ref={(el) => {
                      if (el) {
                        if (iframeTimerRef.current) clearTimeout(iframeTimerRef.current)
                        iframeTimerRef.current = setTimeout(() => {
                          try {
                            // Cross-origin iframe: if we can't read contentDocument it's blocked
                            const doc = el.contentDocument
                            if (!doc || doc.body?.innerHTML === '') setIframeBlocked(true)
                          } catch {
                            setIframeBlocked(true)
                          }
                        }, 4000)
                      }
                    }}
                  />
                )}
                <div className="ep-preview-footer">
                  <button className="ep-back-btn" onClick={() => setTab('chat')}>← Back to chat</button>
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="ep-open-btn">Open ↗</a>
                </div>
              </div>
            )}

          </div>
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

  // Edit panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [panelBuild, setPanelBuild] = useState<Build | null>(null)

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

  const openPanel = useCallback((build: Build) => {
    setPanelBuild(build)
    setIsPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setIsPanelOpen(false)
    setPanelBuild(null)
  }, [])

  // Stats
  const totalBuilds = builds.length
  const liveBuilds = builds.filter((b) => b.status === 'complete').length

  // Next steps from most recent complete build
  const latestComplete = builds.find((b) => b.status === 'complete')
  const nextSteps: NextStep[] = Array.isArray(latestComplete?.next_steps) ? latestComplete.next_steps : []

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
            builds.map((build) => <AppCard key={build.id} build={build} onEdit={openPanel} />)
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

      {/* ── Chat/Preview panel ───────────────────────────────────────────── */}
      {isPanelOpen && panelBuild && (
        <EditPanel
          build={panelBuild}
          onClose={closePanel}
          onEditSuccess={(msg) => {
            setToastMessage(msg)
            setTimeout(() => { void fetchBuilds() }, 5000)
          }}
        />
      )}

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
      <style>{`.setup-modal-overlay{position:fixed;inset:0;z-index:1100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);padding:24px} .setup-modal{background:#0e0d0b;border-radius:12px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden} .setup-sql{flex:1;overflow-y:auto;background:#111009;padding:16px 20px;font:12px/1.7 DM Mono,Courier New,monospace;color:#c8c4bc;white-space:pre-wrap;word-break:break-all;border:none;resize:none;width:100%;box-sizing:border-box} .setup-sql:focus-visible{outline:2px solid #8ab800;outline-offset:-2px} .setup-sql::-webkit-scrollbar{width:4px} .setup-sql::-webkit-scrollbar-thumb{background:#3a3830;border-radius:2px}`}</style>
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
                background: copied ? '#2a3d0e' : '#8ab800',
                color: copied ? '#8ab800' : '#0e0d0b',
                border: copied ? '1px solid #8ab800' : 'none',
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

// ── App card ───────────────────────────────────────────────────────────────────

function AppCard({
  build,
  onEdit,
}: {
  build: Build
  onEdit: (b: Build) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)

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

      {/* Setup DB chip — only for builds the user must configure themselves.
          Sovereign-hosted builds (sovereign / sovereign_temporary) already have
          the schema running on Sovereign's DB — nothing for the user to do. */}
      {build.supabase_schema && !build.claimed_at && (build.supabase_mode == null || build.supabase_mode === 'own') && (
        <button
          onClick={() => setSetupOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            background: 'transparent',
            color: '#8ab800',
            border: '1px solid #8ab80055',
            font: '11px/1 DM Mono, Courier New, monospace',
            cursor: 'pointer',
            borderRadius: '100px',
            marginBottom: '12px',
            transition: 'border-color 0.15s, background 0.15s',
            minHeight: '28px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#8ab80010'
            e.currentTarget.style.borderColor = '#8ab800'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = '#8ab80055'
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8ab800', flexShrink: 0, display: 'inline-block' }} />
          Setup DB
        </button>
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

      {/* Setup DB Modal */}
      {setupOpen && <SetupDBModal build={build} onClose={() => setSetupOpen(false)} />}
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
