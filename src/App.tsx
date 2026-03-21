import { useState, useEffect, useRef, useCallback } from 'react'
import { t, type Locale } from './lib/i18n'
import { joinWaitlist } from './lib/supabase'
import './styles/global.css'
import './App.css'

// ── useInView ────────────────────────────────────────────────────────────────
function useInView() {
  const ref = useRef<HTMLElement | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold: 0.08 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return { ref, inView }
}

// ── LangBar ──────────────────────────────────────────────────────────────────
const LANGS: Locale[] = ['en', 'es', 'fr', 'de']

function LangBar({ locale, setLocale }: { locale: Locale; setLocale: (l: Locale) => void }) {
  return (
    <div className="lang-bar" role="navigation" aria-label="Language selector">
      {LANGS.map((l) => (
        <button
          key={l}
          className={`lang-btn${locale === l ? ' active' : ''}`}
          aria-pressed={locale === l}
          onClick={() => setLocale(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

// ── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ locale }: { locale: Locale }) {
  return (
    <header>
      <nav className="nav" aria-label="Main navigation">
        <a href="/" className="logo" aria-label="Sovereign App home">
          sovereign<em>_app</em>
        </a>
        <div className="nav-r">
          <a href="#docs" className="nav-link">{t(locale, 'nav.docs')}</a>
          <a href="https://github.com" className="nav-link" target="_blank" rel="noreferrer">{t(locale, 'nav.github')}</a>
          <a href="#waitlist" className="nav-link nav-cta">{t(locale, 'nav.waitlist')}</a>
        </div>
      </nav>
    </header>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ locale, path, setPath }: { locale: Locale; path: 'dev' | 'ndev'; setPath: (p: 'dev' | 'ndev') => void }) {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-ring" aria-hidden="true"><span className="ring-dot" /></div>
      <div className="hero-ring hero-ring-2" aria-hidden="true"><span className="ring-dot" /></div>

      <p className="hero-eye">{t(locale, 'hero.eyebrow')}</p>
      <h1 className="hero-h" id="hero-heading">
        <span>{t(locale, 'hero.line1')}</span><br />
        <span>{t(locale, 'hero.line2')}</span><br />
        <em>{t(locale, 'hero.line3')}</em>
      </h1>
      <p className="hero-sub">
        {t(locale, 'hero.sub1')}<br />
        <strong>{t(locale, 'hero.sub2')}</strong>{t(locale, 'hero.sub3')}
      </p>

      <div className="toggle" role="group" aria-label={t(locale, 'toggle.label')}>
        <span className="toggle-lbl">{t(locale, 'toggle.label')}</span>
        <button
          className={`t-opt${path === 'dev' ? ' on' : ''}`}
          aria-pressed={path === 'dev'}
          onClick={() => setPath('dev')}
        >
          {t(locale, 'toggle.dev')}
        </button>
        <button
          className={`t-opt${path === 'ndev' ? ' on' : ''}`}
          aria-pressed={path === 'ndev'}
          onClick={() => setPath('ndev')}
        >
          {t(locale, 'toggle.ndev')}
        </button>
      </div>
    </section>
  )
}

// ── DevPanel ─────────────────────────────────────────────────────────────────
const CMD = 'npx sovereign-app@latest'
const STACKS = ['React + Vite', 'Next.js', 'Vue', 'SvelteKit', 'Supabase', 'Vercel']

function DevPanel({ locale }: { locale: Locale }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(CMD).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') handleCopy()
  }, [handleCopy])

  return (
    <section className="dev-panel" aria-label="Developer path">
      <div className="dev-grid">
        <div className="dev-left">
          <h2 className="dev-h">
            {t(locale, 'dev.h').split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </h2>
          <p className="dev-sub">{t(locale, 'dev.sub')}</p>

          <div
            className="cmd"
            role="button"
            tabIndex={0}
            aria-label={`${CMD} — ${t(locale, 'dev.copy')}`}
            onClick={handleCopy}
            onKeyDown={handleKeyDown}
          >
            <span className="cmd-prompt" aria-hidden="true">$</span>
            <span className="cmd-text">{CMD}</span>
            <span className={copied ? 'cmd-done' : 'cmd-copy'} aria-live="polite">
              {copied ? '✓' : t(locale, 'dev.copy')}
            </span>
          </div>

          <div className="pills" aria-label="Supported stacks">
            {STACKS.map((s) => (
              <span key={s} className="pill">{s}</span>
            ))}
          </div>
        </div>

        <div className="dev-right">
          <blockquote className="qcard">
            <p>
              <span className="qhl">{t(locale, 'q1.hl')}</span>{' '}
              {t(locale, 'q1.rest')}
            </p>
            <cite className="qs">{t(locale, 'q1.src')}</cite>
          </blockquote>

          <blockquote className="qcard">
            <p>
              <span className="qhl">{t(locale, 'q2.hl')}</span>{' '}
              {t(locale, 'q2.rest')}
            </p>
            <cite className="qs">{t(locale, 'q2.src')}</cite>
          </blockquote>
        </div>
      </div>
    </section>
  )
}

// ── NdevPanel ────────────────────────────────────────────────────────────────
const PLACEHOLDERS = [
  'A simple blog where I can write and publish posts…',
  'A SaaS dashboard with user auth and analytics…',
  'An e-commerce store with a product catalog…',
  'A todo app with team collaboration…',
]

interface AppSpec {
  appName: string
  tagline: string
  primaryColor: string
  appType: 'landing-page' | 'saas' | 'waitlist'
  template: string
}

function NdevPanel({ locale }: { locale: Locale }) {
  const [value, setValue] = useState('')
  const [phIdx, setPhIdx] = useState(0)
  const [stage, setStage] = useState<'idle' | 'generating' | 'result' | 'confirm' | 'connect'>('idle')
  const [spec, setSpec] = useState<AppSpec | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const emailInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (value) return
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3500)
    return () => clearInterval(id)
  }, [value])

  const handleBuild = useCallback(async () => {
    if (stage !== 'idle') return
    setGenerateError(null)
    setStage('generating')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass email when available so the daily rate limit can be enforced.
        body: JSON.stringify({ idea: value.trim(), ...(email ? { email } : {}) }),
      })
      const data = await res.json() as AppSpec & { error?: string }
      if (res.status === 429) {
        setGenerateError(data.error === 'too_many_requests'
          ? (data as unknown as { message: string }).message
          : 'Too many requests. Try again later.')
        setStage('idle')
        return
      }
      if (!res.ok || data.error) {
        setGenerateError(data.error ?? 'Something went wrong. Please try again.')
        setStage('idle')
        return
      }
      console.log('[generate] template length:', data.template?.length ?? 0)
      setSpec(data)
      setStage('result')
    } catch {
      setGenerateError('Network error. Please try again.')
      setStage('idle')
    }
  }, [stage, value, email])

  const handleEmailSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address')
      return
    }
    setEmailError(null)
    setStage('confirm')
  }, [email])

  const handleConfirmEmail = useCallback(() => {
    // Fire-and-forget — don't block the connect screen on email delivery
    void fetch('/api/send-welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        projectName: spec?.appName ?? '',
        liveUrl: 'https://sovereignapp.dev',
        repoUrl: 'https://github.com/silamutungi/sovereignapp',
      }),
    })
    setStage('connect')
  }, [email, spec])

  const handleEditEmail = useCallback(() => {
    setStage('result')
    // Focus the email input after React re-renders
    setTimeout(() => { emailInputRef.current?.focus() }, 0)
  }, [])

  const CHIPS = ['chip.1', 'chip.2', 'chip.3', 'chip.4']

  // Called when the user clicks "Connect GitHub".
  // 1. Creates a build record in Supabase (returns buildId).
  // 2. Redirects to GitHub OAuth with buildId as `state`.
  // The GitHub callback → Vercel callback chain completes the OAuth loop,
  // then redirects to /building?id=buildId.
  const handleGitHubConnect = useCallback(async () => {
    if (!email || !spec || starting) return
    setStartError(null)
    setStarting(true)
    try {
      const res = await fetch('/api/start-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          appName:  spec.appName,
          idea:     value.trim(),
          template: spec.template,
        }),
      })
      const data = await res.json() as { buildId?: string; error?: string; message?: string }
      if (data.error === 'rate_limited') {
        setRateLimited(true)
        setStarting(false)
        return
      }
      if (!data.buildId) {
        setStartError(data.error ?? 'Could not start build. Please try again.')
        setStarting(false)
        return
      }
      const redirectUri = `${window.location.origin}/api/auth/github/callback`
      const githubOAuthUrl =
        `https://github.com/login/oauth/authorize` +
        `?client_id=${encodeURIComponent(import.meta.env.VITE_GITHUB_CLIENT_ID ?? '')}` +
        `&scope=repo` +
        `&state=${encodeURIComponent(data.buildId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}`
      window.location.href = githubOAuthUrl
    } catch {
      setStartError('Network error. Please try again.')
      setStarting(false)
    }
  }, [email, spec, value, starting])

  return (
    <section className="ndev-panel" aria-label="No-code path">
      <h2 className="ndev-h">{t(locale, 'ndev.h')}</h2>
      <p className="ndev-sub">{t(locale, 'ndev.sub')}</p>

      <div className="pbox">
        {stage === 'idle' && (
          <>
            <div className="chips">
              {CHIPS.map((k) => (
                <button key={k} className="chip" onClick={() => setValue(t(locale, k))}>
                  {t(locale, k)}
                </button>
              ))}
            </div>
            <textarea
              className="ndev-ta"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={PLACEHOLDERS[phIdx]}
              rows={4}
              aria-label={t(locale, 'ndev.h')}
            />
            <div className="ai-badge" aria-hidden="true">
              <span className="aidot" />
              {t(locale, 'ndev.badge')}
            </div>
            {generateError && (
              <p className="ndev-email-err" role="alert">{generateError}</p>
            )}
            <button
              className="gobtn"
              onClick={() => { void handleBuild() }}
              disabled={!value.trim()}
              aria-label={t(locale, 'ndev.btn')}
            >
              {t(locale, 'ndev.btn')}
            </button>
          </>
        )}

        {stage === 'generating' && (
          <div className="gen-loading" role="status" aria-live="polite">
            <span className="gen-spinner" aria-hidden="true" />
            <p>Generating your app…</p>
          </div>
        )}

        {(stage === 'result' || stage === 'confirm' || stage === 'connect') && spec && (
          <div className="gen-result">
            <div className="gen-header">
              <div
                className="gen-swatch"
                style={{
                  background: spec.primaryColor,
                  border: `2px solid ${spec.primaryColor}`,
                }}
                aria-label={`Brand color: ${spec.primaryColor}`}
              />
              <div className="gen-identity">
                <p className="gen-appname">{spec.appName}</p>
                <p className="gen-tagline">{spec.tagline}</p>
              </div>
            </div>

            <div className="gen-preview-wrap" style={{ borderColor: spec.primaryColor + '55' }}>
              <p className="gen-preview-label">Preview</p>
              <iframe
                className="gen-preview"
                srcDoc={spec.template}
                title={`Preview of ${spec.appName}`}
                sandbox="allow-scripts"
              />
              <div className="gen-preview-fade" aria-hidden="true">
                <span className="gen-preview-hint">Scroll to see more ↓</span>
              </div>
            </div>

            <p className="gen-live-msg">
              ✦ This is your app — let's make it live
            </p>

            {stage === 'result' && (
              <form className="gen-email-form" onSubmit={handleEmailSubmit} noValidate>
                <label htmlFor="gen-email" className="gen-email-lbl">
                  Where should we send your live URL?
                </label>
                <input
                  ref={emailInputRef}
                  id="gen-email"
                  type="email"
                  className="ndev-email-input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  aria-label="Your email address"
                />
                {emailError && (
                  <p className="ndev-email-err" role="alert">{emailError}</p>
                )}
                {(() => {
                  const isLight = parseInt(spec.primaryColor.replace('#', ''), 16) > 0x888888
                  return (
                    <button
                      type="submit"
                      className="gobtn"
                      style={{
                        background: spec.primaryColor,
                        color: isLight ? '#0e0d0b' : '#f2efe8',
                      }}
                      disabled={!email.trim()}
                    >
                      Continue →
                    </button>
                  )
                })()}
              </form>
            )}

            {stage === 'confirm' && (
              <div className="gen-email-form">
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b6862', margin: '0 0 8px' }}>
                  Building for
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', border: '1px solid #d8d4ca', background: 'white', margin: '0 0 16px', borderRadius: '6px' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: '#0e0d0b', flex: 1 }}>
                    {email}
                  </span>
                  <button
                    onClick={handleEditEmail}
                    style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#8ab800', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
                <button
                  className="gobtn"
                  onClick={handleConfirmEmail}
                  style={{ background: '#0e0d0b', color: '#f2efe8', width: '100%', fontFamily: 'DM Mono, monospace', fontSize: '13px', padding: '14px' }}
                  type="button"
                >
                  Yes, that's right — continue →
                </button>
              </div>
            )}

            {stage === 'connect' && rateLimited && (
              <div className="gen-connect" role="alert">
                <p className="gen-connect-lbl" style={{ color: 'var(--ink)', fontWeight: 500 }}>
                  You've used your 3 free builds. Upgrade to Pro to keep building.
                </p>
                <a
                  href="/#pricing"
                  className="gobtn"
                  style={{ display: 'block', textAlign: 'center', textDecoration: 'none', background: 'var(--green)', color: 'var(--ink)', marginTop: '12px' }}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  Upgrade to Pro →
                </a>
              </div>
            )}

            {stage === 'connect' && !rateLimited && (
              <div className="gen-connect">
                <p className="gen-connect-lbl">Connect your accounts to deploy in 60 seconds</p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#6b6862', margin: '0 0 20px' }}>
                  Building for{' '}
                  <span style={{ color: '#0e0d0b' }}>{email}</span>
                  {' · '}
                  <button
                    onClick={handleEditEmail}
                    style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#8ab800', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    type="button"
                  >
                    Change
                  </button>
                </p>
                {startError && (
                  <p className="ndev-email-err" role="alert">{startError}</p>
                )}
                <div className="gen-connect-btns">
                  {/* Step 1 — GitHub. Clicking this creates the build record,
                      then the OAuth chain (GitHub → Vercel) completes automatically. */}
                  <button
                    className="gen-oauth-btn"
                    style={{ borderColor: spec.primaryColor + '66' }}
                    onClick={() => { void handleGitHubConnect() }}
                    disabled={starting}
                    aria-label="Connect GitHub — starts the deployment"
                  >
                    {starting ? (
                      <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} aria-hidden="true" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                    )}
                    {starting ? 'Starting…' : 'Connect GitHub'}
                  </button>

                  {/* Step 2 — Vercel is triggered automatically from the GitHub callback.
                      This button is shown for context but the flow is handled server-side. */}
                  <div
                    className="gen-oauth-btn"
                    style={{ borderColor: spec.primaryColor + '33', opacity: 0.45, cursor: 'default' }}
                    aria-label="Vercel connection happens automatically after GitHub"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 1L24 22H0L12 1z"/>
                    </svg>
                    Connect Vercel
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '10px' }}>
                  GitHub → Vercel connection happens automatically in sequence
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="ndev-note">{t(locale, 'ndev.note')}</p>
    </section>
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────────
const STATS = [
  { val: '$100+', label: 'stat.1', type: 'bad' },
  { val: '$1k',   label: 'stat.2', type: 'bad' },
  { val: '$0',    label: 'stat.3', type: 'good' },
  { val: '90s',   label: 'stat.4', type: 'good' },
]

function Stats({ locale }: { locale: Locale }) {
  const { ref, inView } = useInView()

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={`stats${inView ? ' in' : ''}`}
      aria-label="Key statistics"
    >
      {STATS.map(({ val, label, type }) => (
        <article key={label} className="stat">
          <span className={`sn ${type}`}>{val}</span>
          <span className="sl">{t(locale, label)}</span>
        </article>
      ))}
    </section>
  )
}

// ── Pricing ──────────────────────────────────────────────────────────────────
function Pricing({ locale }: { locale: Locale }) {
  const { ref, inView } = useInView()

  const scrollToWaitlist = useCallback(() => {
    const section = document.querySelector('#waitlist')
    section?.scrollIntoView({ behavior: 'smooth' })
    // Focus the email input after scroll completes
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('#wl-email')
      input?.focus()
    }, 500)
  }, [])

  const scrollToBuildFlow = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <section
      id="pricing"
      ref={ref as React.RefObject<HTMLElement>}
      className={`pricing reveal${inView ? ' in' : ''}`}
      aria-labelledby="pricing-heading"
    >
      <h2 className="pricing-h" id="pricing-heading">
        {t(locale, 'pricing.h').split('\n').map((line, i) => (
          <span key={i}>{line}{i === 0 && <br />}</span>
        ))}
      </h2>
      <p className="pricing-promise">{t(locale, 'pricing.promise')}</p>

      <div className="plans">
        {/* Free */}
        <article className="plan" aria-label="Free plan">
          <p className="pname">{t(locale, 'plan.free.name')}</p>
          <p className="pprice">$0</p>
          <p className="pperiod">{t(locale, 'plan.free.period')}</p>
          <ul className="pfeats">
            <li>{t(locale, 'plan.free.f1')}</li>
            <li>{t(locale, 'plan.free.f2')}</li>
            <li>{t(locale, 'plan.free.f3')}</li>
            <li>{t(locale, 'plan.free.f4')}</li>
          </ul>
          <button className="pbtn" onClick={scrollToBuildFlow}>{t(locale, 'plan.free.btn')}</button>
          <p className="pnote">{t(locale, 'plan.free.note')}</p>
        </article>

        {/* Pro */}
        <article className="plan featured" aria-label="Pro plan">
          <span className="pbadge">{t(locale, 'plan.pro.badge')}</span>
          <p className="pname">{t(locale, 'plan.pro.name')}</p>
          <p className="pprice">$19</p>
          <p className="pperiod">{t(locale, 'plan.pro.period')}</p>
          <ul className="pfeats">
            <li>{t(locale, 'plan.pro.f1')}</li>
            <li>{t(locale, 'plan.pro.f2')}</li>
            <li>{t(locale, 'plan.pro.f3')}</li>
            <li>{t(locale, 'plan.pro.f4')}</li>
          </ul>
          <button className="pbtn" onClick={scrollToWaitlist}>{t(locale, 'plan.pro.btn')}</button>
          <p className="pnote">{t(locale, 'plan.pro.note')}</p>
        </article>

        {/* Team */}
        <article className="plan" aria-label="Team plan">
          <p className="pname">{t(locale, 'plan.team.name')}</p>
          <p className="pprice">$49</p>
          <p className="pperiod">{t(locale, 'plan.team.period')}</p>
          <ul className="pfeats">
            <li>{t(locale, 'plan.team.f1')}</li>
            <li>{t(locale, 'plan.team.f2')}</li>
            <li>{t(locale, 'plan.team.f3')}</li>
            <li>{t(locale, 'plan.team.f4')}</li>
          </ul>
          <button className="pbtn" onClick={scrollToWaitlist}>{t(locale, 'plan.team.btn')}</button>
          <p className="pnote">{t(locale, 'plan.team.note')}</p>
        </article>
      </div>

      <div className="promise-row" aria-label="Pricing promise">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p><strong>{t(locale, 'promise.strong')}</strong> {t(locale, 'promise.body')}</p>
      </div>
    </section>
  )
}

// ── Waitlist ──────────────────────────────────────────────────────────────────
function Waitlist({ locale }: { locale: Locale }) {
  const { ref, inView } = useInView()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) {
      setError(t(locale, 'wl.err'))
      return
    }
    setError(null)
    setLoading(true)
    const { error: err } = await joinWaitlist(email)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setSuccess(true)
      void fetch('/api/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          projectName: 'Sovereign',
          liveUrl: 'https://sovereignapp.dev',
          repoUrl: 'https://github.com/silamutungi/sovereignapp',
          subject: "You're on the Sovereign waitlist",
          body: [
            "You're in. We'll email you the moment Sovereign is ready to build your first app.",
            '',
            "While you wait — tell one person who's frustrated with Lovable or Cursor. That's all we ask.",
            '',
            '— The Sovereign team',
            'sovereignapp.dev',
          ].join('\n'),
        }),
      })
    }
  }, [email, locale])

  return (
    <section
      id="waitlist"
      ref={ref as React.RefObject<HTMLElement>}
      className={`wl reveal${inView ? ' in' : ''}`}
      aria-labelledby="waitlist-heading"
    >
      <p className="wleye">{t(locale, 'wl.eye')}</p>
      <h2 className="wlh" id="waitlist-heading">
        {t(locale, 'wl.h1')} <em>{t(locale, 'wl.h2')}</em>
      </h2>
      <p className="wlsub">
        {t(locale, 'wl.sub1')}<strong>Pro for $19/mo.</strong><br />
        {t(locale, 'wl.sub2')}
      </p>

      {success ? (
        <div className="wlsuccess" role="status">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p>{t(locale, 'wl.success')}</p>
        </div>
      ) : (
        <form className="wlform" onSubmit={handleSubmit} noValidate>
          <label htmlFor="wl-email" className="sr-only">{t(locale, 'wl.label')}</label>
          <input
            id="wl-email"
            type="email"
            className="wlinput"
            placeholder={t(locale, 'wl.label')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {error && <p className="wlerr" role="alert">{error}</p>}
          <button type="submit" className="wlbtn" disabled={loading}>
            {loading ? '…' : t(locale, 'wl.btn')}
          </button>
        </form>
      )}

      <p className="wlnote">{t(locale, 'wl.note')}</p>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="footer">
      <p className="fcopy">{t(locale, 'footer.copy')}</p>
      <nav aria-label="Footer navigation">
        <a href="#docs" className="flink">{t(locale, 'nav.docs')}</a>
        <a href="https://github.com" className="flink" target="_blank" rel="noreferrer">{t(locale, 'nav.github')}</a>
        <a href="#" className="flink">{t(locale, 'nav.discord')}</a>
        <a href="#" className="flink">{t(locale, 'nav.twitter')}</a>
      </nav>
    </footer>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [locale, setLocale] = useState<Locale>('en')
  const [path, setPath] = useState<'dev' | 'ndev'>('dev')

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return (
    <>
      <a href="#main-content" className="skip-link">{t(locale, 'skip')}</a>
      <LangBar locale={locale} setLocale={setLocale} />
      <Nav locale={locale} />
      <main id="main-content">
        <Hero locale={locale} path={path} setPath={setPath} />
        {path === 'dev' ? <DevPanel locale={locale} /> : <NdevPanel locale={locale} />}
        <Stats locale={locale} />
        <Pricing locale={locale} />
        <Waitlist locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  )
}
