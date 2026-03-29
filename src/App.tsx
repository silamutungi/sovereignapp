import { useState, useEffect, useRef, useCallback, type KeyboardEvent, type FormEvent, type RefObject } from 'react'
import { t, type Locale } from './lib/i18n'
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
          sovereign
        </a>
        {/* FIX 3 — nav: logo | How it works · Dashboard only */}
        <div className="nav-r">
          <a href="#how-it-works" className="nav-link">{t(locale, 'nav.howItWorks')}</a>
          <a href="/dashboard" className="nav-link">{t(locale, 'nav.dashboard')}</a>
        </div>
      </nav>
    </header>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero({
  locale,
  path,
  setPath,
}: {
  locale: Locale
  path: 'dev' | 'idea'
  setPath: (p: 'dev' | 'idea') => void
}) {
  const door = path === 'idea' ? 'idea' : 'dev'

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setPath(path === 'idea' ? 'dev' : 'idea')
      }
    },
    [path, setPath],
  )

  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-ring" aria-hidden="true"><span className="ring-dot" /></div>
      <div className="hero-ring hero-ring-2" aria-hidden="true"><span className="ring-dot" /></div>

      <p className="hero-eye">{t(locale, `hero.${door}.eyebrow`)}</p>
      <h1 className="hero-h" id="hero-heading">
        <span>{t(locale, `hero.${door}.line1`)}</span><br />
        <span>{t(locale, `hero.${door}.line2`)}</span><br />
        <em>{t(locale, `hero.${door}.line3`)}</em>
      </h1>
      <p className="hero-sub">{t(locale, `hero.${door}.sub`)}</p>

      <div
        className="toggle"
        role="group"
        aria-label={t(locale, 'toggle.label')}
        onKeyDown={handleKeyDown}
      >
        <span className="toggle-lbl">{t(locale, 'toggle.label')}</span>
        <button
          className={`t-opt${path === 'idea' ? ' on' : ''}`}
          aria-pressed={path === 'idea'}
          onClick={() => setPath('idea')}
        >
          {t(locale, 'toggle.idea')}
        </button>
        <button
          className={`t-opt${path === 'dev' ? ' on' : ''}`}
          aria-pressed={path === 'dev'}
          onClick={() => setPath('dev')}
        >
          {t(locale, 'toggle.dev')}
        </button>
      </div>
    </section>
  )
}

// ── DevPanel ─────────────────────────────────────────────────────────────────
const CMD = 'npx sovereign-app@latest'
const STACKS = ['React + Vite', 'TypeScript', 'Tailwind', 'Supabase', 'Vercel', 'GitHub']

function DevPanel({ locale }: { locale: Locale }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(CMD).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') handleCopy()
  }, [handleCopy])

  return (
    <section className="dev-panel" aria-label="Developer path">
      <div className="dev-inner">
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
            {copied ? t(locale, 'dev.copied') : t(locale, 'dev.copy')}
          </span>
        </div>

        <div className="pills" aria-label="Supported stacks">
          {STACKS.map((s) => (
            <span key={s} className="pill">{s}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── NdevPanel ────────────────────────────────────────────────────────────────
const PLACEHOLDERS = [
  'A booking app for my yoga studio…',
  'A client portal for my consulting practice…',
  'A marketplace where local chefs sell meal kits…',
  'A membership community for independent photographers…',
]

interface AppFileEntry {
  path: string
  content: string
}

interface AppBrief {
  name: string
  description: string
  target_user: string
  features: string[]
  entities: string[]
  tone: 'minimal' | 'bold' | 'playful' | 'professional' | 'warm'
}

interface AppSpec {
  appName: string
  tagline: string
  primaryColor: string
  appType: 'landing-page' | 'saas' | 'marketplace' | 'social' | 'tool' | 'ecommerce'
  files: AppFileEntry[]
  supabaseSchema: string
  setupInstructions: string
  tier?: 'SIMPLE' | 'STANDARD' | 'COMPLEX'
  activeStandards?: string[]
  heroImageUrl?: string | null
}

// ── callGenerateAPI — SSE-aware fetch helper ──────────────────────────
type GenerateResult = { spec: AppSpec } | { error: string }

async function callGenerateAPI(
  body: Record<string, unknown>,
  onProgress: (msg: string) => void,
): Promise<GenerateResult> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream')) {
    // Pre-flight error (rate limit, validation) — JSON response
    const data = await res.json() as { error?: string; message?: string }
    return { error: data.error ?? data.message ?? 'Something went wrong.' }
  }

  // Stream SSE events
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      if (buffer.trim()) {
        console.warn('[generate] SSE stream closed with unprocessed buffer (' + buffer.length + ' chars):', buffer.slice(0, 300))
      }
      break
    }
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const json = line.slice(6).trim()
      if (!json) continue
      try {
        const event = JSON.parse(json) as {
          type: string
          message?: string
          spec?: AppSpec
          error?: string
        }
        if (event.type === 'progress' && event.message) {
          onProgress(event.message)
        } else if (event.type === 'done' && event.spec) {
          return { spec: event.spec }
        } else if (event.type === 'error') {
          return { error: event.error ?? 'Generation failed.' }
        }
      } catch (parseErr) {
        console.warn('[generate] Failed to parse SSE line:', String(parseErr), line.slice(0, 200))
      }
    }
  }

  return { error: 'Generation stream ended without result.' }
}

function NdevPanel({ locale }: { locale: Locale }) {
  const [value, setValue] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('idea') ?? ''
  })
  const [phIdx, setPhIdx] = useState(0)
  const [stage, setStage] = useState<'idle' | 'generating' | 'result' | 'connect' | 'briefConfirm'>('idle')
  const [spec, setSpec] = useState<AppSpec | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generatingMessage, setGeneratingMessage] = useState('Generating your app…')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [brief, setBrief] = useState<AppBrief | null>(null)
  const [resolvedIdea, setResolvedIdea] = useState('')
  const [briefEditing, setBriefEditing] = useState(false)
  const [briefEditText, setBriefEditText] = useState('')
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const ideaRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-resize the idea textarea whenever value changes (handles chip clicks too)
  useEffect(() => {
    const el = ideaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [value])
  const [allSpecs, setAllSpecs] = useState<AppSpec[]>([])
  const [currentSpecIdx, setCurrentSpecIdx] = useState(0)
  const [previewAttempt, setPreviewAttempt] = useState(1)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [readyToBuild, setReadyToBuild] = useState(false)

  useEffect(() => {
    if (value) return
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3500)
    return () => clearInterval(id)
  }, [value])

  const runGeneration = useCallback(async (ideaToUse: string) => {
    setIsExtracting(false)
    setGenerateError(null)
    setGeneratingMessage('Generating your app…')
    setStage('generating')
    try {
      const result = await callGenerateAPI(
        { idea: ideaToUse, ...(email ? { email } : {}) },
        (msg) => setGeneratingMessage(msg),
      )
      if ('error' in result) {
        setGenerateError(result.error)
        setStage('idle')
        return
      }
      const data = result.spec
      setSpec(data)
      setAllSpecs([data])
      setCurrentSpecIdx(0)
      setPreviewAttempt(1)
      setReadyToBuild(false)
      setStage('result')
    } catch {
      setGenerateError('Network error. Please try again.')
      setStage('idle')
    }
  }, [email])

  const handleSubmitIdea = useCallback(async () => {
    if (stage !== 'idle' || isExtracting) return
    const trimmed = value.trim()

    // Short ideas — skip extraction entirely, zero latency
    if (trimmed.length < 200 && !trimmed.includes('\n')) {
      setResolvedIdea(trimmed)
      await runGeneration(trimmed)
      return
    }

    // Long or multiline ideas — extract brief first
    setIsExtracting(true)
    try {
      const res = await fetch('/api/extract-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: trimmed }),
      })
      if (!res.ok) throw new Error('extraction failed')
      const data = await res.json() as AppBrief & { skipped?: boolean; error?: string }
      if (data.skipped || data.error) {
        setResolvedIdea(trimmed)
        await runGeneration(trimmed)
      } else {
        setBrief(data)
        setBriefEditing(false)
        setBriefEditText(`${data.name} — ${data.description}. Features: ${data.features.join(', ')}`)
        setIsExtracting(false)
        setStage('briefConfirm')
      }
    } catch {
      // Network error — never block the user, fall back silently
      setResolvedIdea(trimmed)
      await runGeneration(trimmed)
    }
  }, [stage, isExtracting, value, runGeneration])

  const handleBriefConfirm = useCallback(async () => {
    if (!brief) return
    const formatted = `${brief.name} — ${brief.description}. Features: ${brief.features.join(', ')}`
    setResolvedIdea(formatted)
    await runGeneration(formatted)
  }, [brief, runGeneration])

  const handleBriefEditConfirm = useCallback(async () => {
    const trimmed = briefEditText.trim()
    setResolvedIdea(trimmed)
    setBriefEditing(false)
    await runGeneration(trimmed)
  }, [briefEditText, runGeneration])

  const handleEmailSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setEmailError('Please enter a valid email address')
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

  const handleEditEmail = useCallback(() => {
    setStage('result')
    setTimeout(() => { emailInputRef.current?.focus() }, 0)
  }, [])

  const handleProceedToBuild = useCallback(() => {
    setReadyToBuild(true)
  }, [])

  const handleRegenerate = useCallback(async () => {
    if (isRegenerating || previewAttempt >= 3) return
    const currentAttempt = previewAttempt
    const nextAttempt = currentAttempt + 1
    const variationHint = nextAttempt === 2
      ? 'Generate a completely different visual direction from the first attempt. Use a different color palette, different layout structure, and different typographic approach. Same idea, fresh perspective.'
      : 'Generate a third distinct visual direction. This must look meaningfully different from both previous attempts. Different color family, different layout, different mood — minimal if the others were expressive, bold if the others were subtle.'
    setIsRegenerating(true)
    setPreviewAttempt(nextAttempt)
    try {
      const result = await callGenerateAPI(
        { idea: resolvedIdea || value.trim(), variationHint, attempt: nextAttempt, ...(email ? { email } : {}) },
        () => { /* progress during regen — no visible indicator needed */ },
      )
      if ('error' in result) {
        setPreviewAttempt(currentAttempt)
        setIsRegenerating(false)
        return
      }
      const data = result.spec
      const newSpecs = [...allSpecs, data]
      setAllSpecs(newSpecs)
      setCurrentSpecIdx(newSpecs.length - 1)
      setSpec(data)
    } catch {
      setPreviewAttempt(currentAttempt)
    }
    setIsRegenerating(false)
  }, [isRegenerating, previewAttempt, allSpecs, resolvedIdea, value, email])

  const handlePrevPreview = useCallback(() => {
    if (currentSpecIdx <= 0) return
    const newIdx = currentSpecIdx - 1
    setCurrentSpecIdx(newIdx)
    setSpec(allSpecs[newIdx])
  }, [currentSpecIdx, allSpecs])

  const handleNextPreview = useCallback(() => {
    if (currentSpecIdx >= allSpecs.length - 1) return
    const newIdx = currentSpecIdx + 1
    setCurrentSpecIdx(newIdx)
    setSpec(allSpecs[newIdx])
  }, [currentSpecIdx, allSpecs])

  // Called when the user clicks "Connect GitHub".
  // 1. Creates a build record in Supabase (returns buildId).
  // 2. Redirects to GitHub OAuth with buildId as `state`.
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
          appName:          spec.appName,
          idea:             resolvedIdea || value.trim(),
          files:            spec.files,
          supabaseSchema:   spec.supabaseSchema,
          setupInstructions: spec.setupInstructions,
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
  }, [email, spec, resolvedIdea, value, starting])

  const CHIPS = [
    'A booking app for my yoga studio',
    'A client portal for my consulting practice',
    'A marketplace for local chefs',
    'A membership community for photographers',
  ]

  return (
    <section className="ndev-panel" aria-label="Idea path">
      <h2 className="ndev-h">{t(locale, 'ndev.h')}</h2>
      <p className="ndev-sub">{t(locale, 'ndev.sub')}</p>

      <div className="pbox">
        {stage === 'idle' && (
          <>
            <div className="chips">
              {CHIPS.map((chip) => (
                <button key={chip} className="chip" onClick={() => setValue(chip)}>
                  {chip}
                </button>
              ))}
            </div>
            <textarea
              ref={ideaRef}
              className="ndev-ta"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={PLACEHOLDERS[phIdx]}
              rows={3}
              aria-label={t(locale, 'ndev.h')}
            />
            {generateError && (
              <p className="ndev-email-err" role="alert">{generateError}</p>
            )}
            <button
              className="gobtn"
              onClick={() => { void handleSubmitIdea() }}
              disabled={!value.trim() || isExtracting}
              style={{ opacity: isExtracting ? 0.7 : undefined }}
              aria-label={isExtracting ? 'Reading your idea…' : t(locale, 'ndev.btn')}
            >
              {isExtracting ? 'Reading your idea…' : t(locale, 'ndev.btn')}
            </button>
            {isExtracting && (
              <p className="extracting-note" aria-live="polite">
                Extracting your brief…
              </p>
            )}
          </>
        )}

        {stage === 'briefConfirm' && brief && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '20px', fontWeight: 600, color: '#0e0d0b', margin: '0 0 16px', lineHeight: 1.3 }}>
                Here's what we're building.
              </p>
              <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 700, color: '#8ab800', margin: '0 0 8px', lineHeight: 1.2 }}>
                {brief.name}
              </p>
              <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: '#6b6862', margin: '0 0 20px', lineHeight: 1.6 }}>
                {brief.description}
              </p>
              <ul style={{ listStyle: 'none', margin: '0 0 24px', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {brief.features.map((f) => (
                  <li key={f} style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#0e0d0b', display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: 1.5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8ab800', flexShrink: 0, marginTop: '5px' }} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {briefEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <textarea
                  value={briefEditText}
                  onChange={(e) => setBriefEditText(e.target.value)}
                  rows={5}
                  style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#0e0d0b', background: '#f9f7f2', border: '1px solid #d8d4ca', borderRadius: '6px', padding: '12px', resize: 'vertical', lineHeight: 1.6 }}
                  aria-label="Edit your brief"
                />
                <button
                  onClick={() => { void handleBriefEditConfirm() }}
                  disabled={!briefEditText.trim()}
                  style={{ width: '100%', padding: '14px', background: '#8ab800', color: '#0e0d0b', border: 'none', cursor: briefEditText.trim() ? 'pointer' : 'default', fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 500, borderRadius: '6px', opacity: briefEditText.trim() ? 1 : 0.6 }}
                  type="button"
                >
                  Build with edited brief →
                </button>
                <button
                  onClick={() => setBriefEditing(false)}
                  style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #d8d4ca', color: '#6b6862', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '12px', borderRadius: '6px' }}
                  type="button"
                >
                  ← Back
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => { void handleBriefConfirm() }}
                  style={{ width: '100%', padding: '14px', background: '#8ab800', color: '#0e0d0b', border: 'none', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 500, borderRadius: '6px' }}
                  type="button"
                >
                  Looks good, build it →
                </button>
                <button
                  onClick={() => setBriefEditing(true)}
                  style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #d8d4ca', color: '#0e0d0b', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '12px', borderRadius: '6px' }}
                  type="button"
                >
                  Edit brief →
                </button>
              </div>
            )}
          </div>
        )}

        {stage === 'generating' && (
          <div className="gen-loading" role="status" aria-live="polite">
            <span className="gen-spinner" aria-hidden="true" />
            <p>{generatingMessage}</p>
          </div>
        )}

        {(stage === 'result' || stage === 'connect') && spec && (
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

            {stage === 'result' && !readyToBuild && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', marginBottom: '8px' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#6b6862', letterSpacing: '0.06em' }}>
                    PREVIEW {currentSpecIdx + 1} OF 3
                  </span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {currentSpecIdx > 0 && (
                      <button
                        onClick={handlePrevPreview}
                        style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#6b6862', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        type="button"
                      >
                        ← Previous version
                      </button>
                    )}
                    {currentSpecIdx < allSpecs.length - 1 && (
                      <button
                        onClick={handleNextPreview}
                        style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#6b6862', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        type="button"
                      >
                        Next version →
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }} aria-label={`${previewAttempt} of 3 versions generated`}>
                  {[1, 2, 3].map(n => (
                    <div key={n} style={{ width: 6, height: 6, borderRadius: '50%', background: n <= previewAttempt ? '#8ab800' : '#d8d4ca' }} />
                  ))}
                </div>
              </>
            )}

            <div className="gen-preview-wrap" style={{ borderColor: spec.primaryColor + '55', position: 'relative', minHeight: '280px', padding: '24px' }}>
              <p className="gen-preview-label">Generated app</p>

              {spec.heroImageUrl ? (
                <div style={{
                  borderRadius: 12,
                  overflow: 'hidden',
                  position: 'relative',
                  aspectRatio: '16/9',
                  background: spec.primaryColor + '22'
                }}>
                  <img
                    src={spec.heroImageUrl}
                    alt={spec.appName}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '20px 24px'
                  }}>
                    <p style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: '22px',
                      fontWeight: 600,
                      color: '#ffffff',
                      margin: 0,
                      lineHeight: 1.2,
                      textShadow: '0 1px 4px rgba(0,0,0,0.4)'
                    }}>{spec.appName}</p>
                    <p style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.85)',
                      margin: '4px 0 0',
                      textShadow: '0 1px 3px rgba(0,0,0,0.4)'
                    }}>{spec.tagline}</p>
                  </div>
                  {spec.tier && (
                    <div style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '10px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#ffffff',
                      background: 'rgba(0,0,0,0.45)',
                      padding: '3px 8px',
                      borderRadius: 100,
                      backdropFilter: 'blur(4px)'
                    }}>{spec.tier}</div>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: spec.primaryColor, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} aria-hidden="true" />
                    <div>
                      <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '18px', fontWeight: 600, color: '#0e0d0b', margin: 0, lineHeight: 1.2 }}>{spec.appName}</p>
                      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#6b6862', margin: '3px 0 0' }}>{spec.tagline}</p>
                    </div>
                  </div>

                  <div style={{ background: '#0e0d0b', borderRadius: 8, padding: '12px 16px', maxHeight: 160, overflowY: 'auto' }}>
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b6862', margin: '0 0 8px' }}>
                      {(Array.isArray(spec.files) ? spec.files : []).length} files generated
                    </p>
                    {(Array.isArray(spec.files) ? spec.files : []).map(f => (
                      <p key={f.path} style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#c8c4bc', margin: '2px 0', lineHeight: 1.4 }}>{f.path}</p>
                    ))}
                  </div>

                  {spec.tier && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: spec.primaryColor, border: `1px solid ${spec.primaryColor}55`, padding: '2px 8px', borderRadius: 100 }}>{spec.tier}</span>
                      {(Array.isArray(spec.activeStandards) ? spec.activeStandards : []).slice(0, 3).map(s => (
                        <span key={s} style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: '#6b6862' }}>{s}</span>
                      ))}
                    </div>
                  )}
                </>
              )}

              {isRegenerating && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(242,239,232,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: '12px', color: '#6b6862', borderRadius: 'inherit' }} aria-live="polite">
                  <span>Generating new version…</span>
                </div>
              )}
            </div>

            {(stage !== 'result' || readyToBuild) && (
              <p className="gen-live-msg">
                ✦ This is your app — let's make it live
              </p>
            )}

            {stage === 'result' && !readyToBuild && (
              <div style={{ paddingTop: '24px', borderTop: '1px solid #d8d4ca', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={handleProceedToBuild}
                  style={{ width: '100%', padding: '14px', background: '#0e0d0b', color: '#f2efe8', border: 'none', cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 500, borderRadius: '6px' }}
                  type="button"
                >
                  ✦ Build this app — I own everything →
                </button>
                {previewAttempt < 3 && (
                  <button
                    onClick={() => { void handleRegenerate() }}
                    disabled={isRegenerating}
                    style={{ width: '100%', padding: '14px', background: 'transparent', border: '1px solid #d8d4ca', color: '#0e0d0b', cursor: isRegenerating ? 'default' : 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '13px', borderRadius: '6px', opacity: isRegenerating ? 0.6 : 1 }}
                    type="button"
                  >
                    {isRegenerating ? 'Generating new version…' : `Try a different version (${3 - previewAttempt} left)`}
                  </button>
                )}
                {previewAttempt === 3 && (
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#6b6862', textAlign: 'center', margin: 0 }}>
                    That's your last preview. Pick your favourite — you can always edit it after you build.
                  </p>
                )}
              </div>
            )}

            {stage === 'result' && readyToBuild && (
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

            {stage === 'connect' && rateLimited && (
              <div className="gen-connect" role="alert">
                <p className="gen-connect-lbl" style={{ color: 'var(--ink)', fontWeight: 500 }}>
                  You've used your 3 free builds. Upgrade to Builder to keep building.
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
                  Upgrade to Builder →
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

                  <div
                    className="gen-oauth-btn"
                    style={{ borderColor: spec.primaryColor + '22', opacity: 0.3, cursor: 'default' }}
                    aria-label="Database choice happens on the next screen"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
                    </svg>
                    Connect Database
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '10px' }}>
                  GitHub → Vercel → Database in sequence
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

// ── HowItWorks ────────────────────────────────────────────────────────────────
function HowItWorks({ locale, path }: { locale: Locale; path: 'dev' | 'idea' }) {
  const { ref, inView } = useInView()
  const door = path === 'idea' ? 'idea' : 'dev'

  const steps = [
    { icon: t(locale, `how.${door}.s1.icon`), h: t(locale, `how.${door}.s1.h`), b: t(locale, `how.${door}.s1.b`) },
    { icon: t(locale, `how.${door}.s2.icon`), h: t(locale, `how.${door}.s2.h`), b: t(locale, `how.${door}.s2.b`) },
    { icon: t(locale, `how.${door}.s3.icon`), h: t(locale, `how.${door}.s3.h`), b: t(locale, `how.${door}.s3.b`) },
  ]

  return (
    <section
      id="how-it-works"
      ref={ref as RefObject<HTMLElement>}
      className={`how reveal${inView ? ' in' : ''}`}
      aria-labelledby="how-heading"
    >
      <h2 className="how-h" id="how-heading">{t(locale, 'how.h')}</h2>
      <div className="how-steps">
        {steps.map((step, i) => (
          <article key={i} className="how-step">
            <span className="how-icon" aria-hidden="true">{step.icon}</span>
            <h3 className="how-step-h">{step.h}</h3>
            <p className="how-step-b">{step.b}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

// ── BYOK ──────────────────────────────────────────────────────────────────────
function BYOK({ locale, path }: { locale: Locale; path: 'dev' | 'idea' }) {
  const { ref, inView } = useInView()
  const door = path === 'idea' ? 'idea' : 'dev'

  return (
    <section
      ref={ref as RefObject<HTMLElement>}
      className={`byok reveal${inView ? ' in' : ''}`}
      aria-labelledby="byok-heading"
    >
      <p className="byok-eye">{t(locale, `byok.${door}.eye`)}</p>
      <h2 className="byok-h" id="byok-heading">{t(locale, `byok.${door}.h`)}</h2>
      <p className="byok-b">{t(locale, `byok.${door}.b`)}</p>

      {door === 'idea' ? (
        <p className="byok-detail">{t(locale, 'byok.idea.detail')}</p>
      ) : (
        <div className="byok-cmd-wrap">
          <code className="byok-code">{t(locale, 'byok.dev.code')}</code>
        </div>
      )}

    </section>
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function Stats({ locale }: { locale: Locale }) {
  const { ref, inView } = useInView()

  const stats = [
    { valKey: 'stat.1.val', lblKey: 'stat.1.lbl' },
    { valKey: 'stat.2.val', lblKey: 'stat.2.lbl' },
    { valKey: 'stat.3.val', lblKey: 'stat.3.lbl' },
    { valKey: 'stat.4.val', lblKey: 'stat.4.lbl' },
  ]

  return (
    <section
      ref={ref as RefObject<HTMLElement>}
      className={`stats${inView ? ' in' : ''}`}
      aria-label="Key statistics"
    >
      {stats.map(({ valKey, lblKey }) => (
        <article key={valKey} className="stat">
          <span className="sn">{t(locale, valKey)}</span>
          <span className="sl">{t(locale, lblKey)}</span>
        </article>
      ))}
    </section>
  )
}

// ── Pricing ──────────────────────────────────────────────────────────────────
function Pricing({ locale }: { locale: Locale }) {
  const { ref, inView } = useInView()

  // FIX 3 — scrollToWaitlist removed; plan buttons now scroll to build flow

  const scrollToBuildFlow = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <section
      id="pricing"
      ref={ref as RefObject<HTMLElement>}
      className={`pricing reveal${inView ? ' in' : ''}`}
      aria-labelledby="pricing-heading"
    >
      <h2 className="pricing-h" id="pricing-heading">{t(locale, 'pricing.h')}</h2>
      <p className="pricing-sub">{t(locale, 'pricing.sub')}</p>

      <div className="plans">
        {/* Free */}
        <article className="plan" aria-label="Free plan">
          <p className="pname">{t(locale, 'plan.free.name')}</p>
          <p className="pprice">{t(locale, 'plan.free.price')}</p>
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

        {/* Builder (featured) */}
        <article className="plan featured" aria-label="Builder plan">
          <span className="pbadge">{t(locale, 'plan.builder.badge')}</span>
          <p className="pname">{t(locale, 'plan.builder.name')}</p>
          <p className="pprice">{t(locale, 'plan.builder.price')}</p>
          <p className="pperiod">{t(locale, 'plan.builder.period')}</p>
          <ul className="pfeats">
            <li>{t(locale, 'plan.builder.f1')}</li>
            <li>{t(locale, 'plan.builder.f2')}</li>
            <li>{t(locale, 'plan.builder.f3')}</li>
            <li>{t(locale, 'plan.builder.f4')}</li>
            <li>{t(locale, 'plan.builder.f5')}</li>
          </ul>
          <p className="plan-byok-note">✦ {t(locale, 'plan.builder.byok')}</p>
          <button className="pbtn" onClick={scrollToBuildFlow}>{t(locale, 'plan.builder.btn')}</button>
          <p className="pnote">{t(locale, 'plan.builder.note')}</p>
        </article>

        {/* Team */}
        <article className="plan" aria-label="Team plan">
          <p className="pname">{t(locale, 'plan.team.name')}</p>
          <p className="pprice">{t(locale, 'plan.team.price')}</p>
          <p className="pperiod">{t(locale, 'plan.team.period')}</p>
          <ul className="pfeats">
            <li>{t(locale, 'plan.team.f1')}</li>
            <li>{t(locale, 'plan.team.f2')}</li>
            <li>{t(locale, 'plan.team.f3')}</li>
            <li>{t(locale, 'plan.team.f4')}</li>
            <li>{t(locale, 'plan.team.f5')}</li>
          </ul>
          <p className="plan-byok-note">✦ {t(locale, 'plan.team.byok')}</p>
          <button className="pbtn" onClick={scrollToBuildFlow}>{t(locale, 'plan.team.btn')}</button>
          <p className="pnote">{t(locale, 'plan.team.note')}</p>
        </article>
      </div>

      <div className="promise-row" aria-label="Pricing promise">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p>🔒 {t(locale, 'pricing.promise')}</p>
      </div>
    </section>
  )
}

// ── Waitlist ──────────────────────────────────────────────────────────────────
// FIX 3 — founding price CTA wired to build flow (scroll to top)
function Waitlist({ locale }: { locale: Locale }) {
  const { ref, inView } = useInView()

  const scrollToBuildFlow = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <section
      id="waitlist"
      ref={ref as RefObject<HTMLElement>}
      className={`wl reveal${inView ? ' in' : ''}`}
      aria-labelledby="waitlist-heading"
    >
      <p className="wleye">{t(locale, 'wl.eye')}</p>
      <h2 className="wlh" id="waitlist-heading">
        {t(locale, 'wl.h1')} <em>{t(locale, 'wl.h2')}</em>
      </h2>
      <p className="wlsub">
        {t(locale, 'wl.sub1')}<strong>Builder for $19/mo.</strong><br />
        {t(locale, 'wl.sub2')}
      </p>

      <button type="button" className="wlbtn" onClick={scrollToBuildFlow}>
        {t(locale, 'wl.btn')}
      </button>

      <p className="wlnote">{t(locale, 'wl.note')}</p>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer({ locale, setLocale }: { locale: Locale; setLocale: (l: Locale) => void }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* Logo */}
        <a href="/" className="footer-logo" aria-label="Sovereign App home">sovereign</a>

        {/* Nav links */}
        <nav className="footer-nav" aria-label="Footer navigation">
          <a href="#how-it-works" className="flink">{t(locale, 'nav.howItWorks')}</a>
          <a href="#pricing" className="flink">{t(locale, 'nav.pricing')}</a>
          <a href="/dashboard" className="flink">{t(locale, 'nav.dashboard')}</a>
        </nav>

        {/* Promise */}
        <p className="footer-promise">
          {t(locale, 'footer.promise').split('\n').map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </p>

        {/* Language selector */}
        <div className="footer-langs" role="navigation" aria-label="Language selector">
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

        {/* Built with Sovereign badge */}
        <span className="sovereign-badge">
          <span className="badge-icon" aria-hidden="true">✦</span>
          {t(locale, 'badge.label')}
        </span>

        {/* Legal */}
        <p className="footer-legal">
          {t(locale, 'footer.legal')}
          {' · '}
          <a href="/privacy" className="flink">{t(locale, 'footer.privacy')}</a>
          {' · '}
          <a href="/terms" className="flink">{t(locale, 'footer.terms')}</a>
          {' · '}
          <a href="/security" className="flink">{t(locale, 'footer.security')}</a>
        </p>
      </div>
    </footer>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [locale, setLocale] = useState<Locale>('en')
  const [path, setPath] = useState<'dev' | 'idea'>('idea')

  // Sync locale with localStorage (preference, not auth)
  useEffect(() => {
    const saved = localStorage.getItem('sovereign_locale') as Locale | null
    if (saved && ['en', 'es', 'fr', 'de'].includes(saved)) setLocale(saved)
  }, [])

  const handleSetLocale = useCallback((l: Locale) => {
    setLocale(l)
    localStorage.setItem('sovereign_locale', l)
  }, [])

  // Sync path with URL param — ?for=idea or ?for=dev
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const forParam = params.get('for')
    if (forParam === 'dev') setPath('dev')
    else setPath('idea')
  }, [])

  const handleSetPath = useCallback((p: 'dev' | 'idea') => {
    setPath(p)
    const url = new URL(window.location.href)
    url.searchParams.set('for', p)
    window.history.replaceState({}, '', url.toString())
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return (
    <>
      <a href="#main-content" className="skip-link">{t(locale, 'skip')}</a>
      <LangBar locale={locale} setLocale={handleSetLocale} />
      <Nav locale={locale} />
      <main id="main-content">
        <Hero locale={locale} path={path} setPath={handleSetPath} />
        {path === 'dev' ? <DevPanel locale={locale} /> : <NdevPanel locale={locale} />}
        <HowItWorks locale={locale} path={path} />
        <BYOK locale={locale} path={path} />
        <Stats locale={locale} />
        {/* FIX 3 — Pricing moved to immediately above footer */}
        <Waitlist locale={locale} />
        <Pricing locale={locale} />
      </main>
      <Footer locale={locale} setLocale={handleSetLocale} />
    </>
  )
}
