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

const BUILD_STEPS_KEYS = ['build.step1', 'build.step2', 'build.step3', 'build.step4', 'build.step5']

function NdevPanel({ locale }: { locale: Locale }) {
  const [value, setValue] = useState('')
  const [phIdx, setPhIdx] = useState(0)
  const [building, setBuilding] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [done, setDone] = useState(false)

  // Rotate placeholder
  useEffect(() => {
    if (value) return
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3500)
    return () => clearInterval(id)
  }, [value])

  const handleBuild = useCallback(() => {
    if (building || done) return
    setBuilding(true)
    setStepIdx(0)
    let idx = 0
    const advance = () => {
      idx++
      if (idx < BUILD_STEPS_KEYS.length) {
        setStepIdx(idx)
        setTimeout(advance, 650)
      } else {
        setDone(true)
        setBuilding(false)
      }
    }
    setTimeout(advance, 650)
  }, [building, done])

  const CHIPS = ['chip.1', 'chip.2', 'chip.3', 'chip.4']

  return (
    <section className="ndev-panel" aria-label="No-code path">
      <h2 className="ndev-h">{t(locale, 'ndev.h')}</h2>
      <p className="ndev-sub">{t(locale, 'ndev.sub')}</p>

      <div className="pbox">
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

        {building && (
          <p className="build-status" aria-live="polite" aria-atomic="true">
            {t(locale, BUILD_STEPS_KEYS[stepIdx])}
          </p>
        )}
        {done && (
          <p className="build-status done" aria-live="polite">{t(locale, 'build.done')}</p>
        )}

        <button
          className="gobtn"
          onClick={handleBuild}
          disabled={building}
          aria-label={t(locale, 'ndev.btn')}
        >
          {building ? '…' : t(locale, 'ndev.btn')}
        </button>
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
