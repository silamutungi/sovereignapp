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
  const [stage, setStage] = useState<'idle' | 'generating' | 'result' | 'connect'>('idle')
  const [spec, setSpec] = useState<AppSpec | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

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
        body: JSON.stringify({ idea: value.trim() }),
      })
      const data = await res.json() as AppSpec & { error?: string }
      if (!res.ok || data.error) {
        setGenerateError(data.error ?? 'Something went wrong. Please try again.')
        setStage('idle')
        return
      }
      setSpec(data)
      setStage('result')
    } catch {
      setGenerateError('Network error. Please try again.')
      setStage('idle')
    }
  }, [stage, value])

  const handleEmailSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) {
      setEmailError('Please enter a real email address.')
      return
    }
    setEmailError(null)
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

  const CHIPS = ['chip.1', 'chip.2', 'chip.3', 'chip.4']

  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${import.meta.env.VITE_GITHUB_CLIENT_ID}&scope=repo`
  const vercelUrl = `https://vercel.com/oauth/authorize?client_id=${import.meta.env.VITE_VERCEL_CLIENT_ID}`

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

        {(stage === 'result' || stage === 'connect') && spec && (
          <div className="gen-result">
            <div className="gen-header">
              <div
                className="gen-swatch"
                style={{ background: spec.primaryColor }}
                aria-label={`Brand color: ${spec.primaryColor}`}
              />
              <div className="gen-identity">
                <p className="gen-appname">{spec.appName}</p>
                <p className="gen-tagline">{spec.tagline}</p>
              </div>
            </div>

            <div className="gen-preview-wrap" style={{ borderColor: spec.primaryColor + '55' }}>
              <iframe
                className="gen-preview"
                srcDoc={spec.template}
                title={`Preview of ${spec.appName}`}
                sandbox="allow-same-origin"
              />
            </div>

            <p className="gen-live-msg" style={{ color: spec.primaryColor }}>
              ✦ This is your app — let's make it live
            </p>

            {stage === 'result' && (
              <form className="gen-email-form" onSubmit={handleEmailSubmit} noValidate>
                <label htmlFor="gen-email" className="gen-email-lbl">
                  Where should we send your live URL?
                </label>
                <input
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
                <button
                  type="submit"
                  className="gobtn"
                  style={{ background: spec.primaryColor }}
                >
                  Continue →
                </button>
              </form>
            )}

            {stage === 'connect' && (
              <div className="gen-connect">
                <p className="gen-connect-lbl">Connect your accounts to deploy in 60 seconds</p>
                <div className="gen-connect-btns">
                  <a
                    href={githubUrl}
                    className="gen-oauth-btn"
                    style={{ borderColor: spec.primaryColor + '66' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    Connect GitHub
                  </a>
                  <a
                    href={vercelUrl}
                    className="gen-oauth-btn"
                    style={{ borderColor: spec.primaryColor + '66' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 1L24 22H0L12 1z"/>
                    </svg>
                    Connect Vercel
                  </a>
                </div>
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

  return (
    <section
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
            <li className="off">{t(locale, 'plan.free.f4')}</li>
            <li className="off">{t(locale, 'plan.free.f5')}</li>
          </ul>
          <button className="pbtn">{t(locale, 'plan.free.btn')}</button>
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
            <li>{t(locale, 'plan.pro.f5')}</li>
          </ul>
          <button className="pbtn">{t(locale, 'plan.pro.btn')}</button>
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
          <button className="pbtn">{t(locale, 'plan.team.btn')}</button>
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
