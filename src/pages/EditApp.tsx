// src/pages/EditApp.tsx — Sovereign Edit Experience
// Route: /app/:buildId/edit
//
// Full-viewport two-column layout: 360px brain panel (left) + live preview (right).
// Mobile (<768px): single column with Chat/Preview tab toggle at top.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Build {
  id: string
  app_name: string
  idea: string | null
  status: string
  deploy_url: string | null
  repo_url: string | null
  staging: boolean | null
  claimed_at: string | null
  claim_status: string | null
  claimed_url: string | null
}

interface Message {
  id: number
  role: 'user' | 'sovereign'
  text: string
  pills?: string[]
  isDeploying?: boolean
}

interface BrainHint {
  type: 'blue' | 'amber' | 'green'
  body: string
  action: string | null
  actionLabel: string | null
}

interface SecurityIssue {
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  file?: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const QUEUE_KEY = (id: string) => `sovereign_queue_${id}`

// Patterns that require amber confirmation before executing
const DANGEROUS_PATTERNS = [
  { pattern: /remove.{0,20}auth/i,          reason: 'remove authentication', safe: 'Add a role-based access check instead of removing auth' },
  { pattern: /disable.{0,20}security/i,     reason: 'disable security controls', safe: null },
  { pattern: /make.{0,20}(everything|all).{0,20}(public|visible)/i, reason: 'expose all data publicly', safe: 'Add a public flag per record so only selected items are visible' },
  { pattern: /delete.{0,20}all/i,           reason: 'delete all records', safe: 'Add a filter to delete only matching records' },
  { pattern: /drop.{0,20}table/i,           reason: 'drop a database table', safe: null },
  { pattern: /service.?role.?key/i,         reason: 'expose a service role key', safe: 'Use the anon key for client-side Supabase calls' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function getEmail(): string | null {
  try {
    const raw = sessionStorage.getItem('sovereign_user')
    if (!raw) return null
    return (JSON.parse(raw) as { email?: string }).email ?? null
  } catch {
    return null
  }
}

function formatOpening(idea: string | null, appName: string): string {
  if (!idea) return `${appName} is live.`
  const clean = idea.replace(/\s+/g, ' ').trim()
  // First sentence longer than 20 chars, or fallback to first 40 chars
  const first = clean.split(/(?<=[.!?])\s+/).find((s) => s.length > 20) ?? clean
  const description = first.length > 90 ? `${first.slice(0, 40)}...` : first
  return `${appName} is live — ${description}`
}

function minsAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'just now'
  if (m === 1) return '1 min ago'
  return `${m} min ago`
}

function getElementArea(xPct: number, yPct: number): string {
  if (yPct < 15) return 'navigation'
  if (yPct < 35) return 'hero section'
  if (yPct > 85) return 'footer'
  if (xPct < 20) return 'left sidebar'
  if (xPct > 80) return 'right sidebar'
  return 'main content area'
}

function checkDanger(text: string): { reason: string; safe: string | null } | null {
  for (const { pattern, reason, safe } of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) return { reason, safe }
  }
  return null
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function EditApp() {
  const { buildId } = useParams<{ buildId: string }>()
  const navigate = useNavigate()

  // Build data
  const [build, setBuild] = useState<Build | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Conversation
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [editCount, setEditCount] = useState(0)

  // Deployment
  const [deploying, setDeploying] = useState(false)
  const [deploySeconds, setDeploySeconds] = useState(0)
  const [previewKey, setPreviewKey] = useState(0)
  const [previewFlash, setPreviewFlash] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  // Layout
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat')
  const [leftTab, setLeftTab] = useState<'chat' | 'brand'>('chat')
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Click-to-describe
  const [clickMode, setClickMode] = useState(false)
  const [clickPopover, setClickPopover] = useState<{ x: number; y: number; area: string } | null>(null)
  const [clickInput, setClickInput] = useState('')

  // Prompt queue (persisted in localStorage)
  const [queue, setQueue] = useState<string[]>([])
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueRunning, setQueueRunning] = useState(false)

  // Brain hints
  const [hint, setHint] = useState<BrainHint | null>(null)
  const [lastHintType, setLastHintType] = useState<string | null>(null)
  const [, setDeployUnhealthy] = useState(false)

  // Live status + deploy timing
  const [lastDeployedAt, setLastDeployedAt] = useState<number | null>(null)
  const [, setLiveTick] = useState(0)

  // Panel theme (persisted)
  const [panelTheme, setPanelTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('sovereign_edit_theme') as 'dark' | 'light') ?? 'dark' } catch { return 'dark' }
  })

  // Security scan
  const [scanResult, setScanResult] = useState<{ passed: boolean; issues: SecurityIssue[]; score: number } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

  // Brand/themes
  const [brandColor, setBrandColor] = useState('#8ab800')
  const [headingFont, setHeadingFont] = useState<'serif' | 'sans' | 'mono'>('serif')
  const [tone, setTone] = useState<'professional' | 'friendly' | 'bold' | 'minimal'>('professional')
  const [brandApplying, setBrandApplying] = useState(false)

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deployTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const iframeContainerRef = useRef<HTMLDivElement>(null)
  const counter = useRef(0)
  const deployStartTimeRef = useRef<number>(0)

  // ── Responsive ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Load build ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const email = getEmail()
    if (!email) { navigate('/dashboard'); return }
    void loadBuild(email)
    if (buildId) {
      const saved = localStorage.getItem(QUEUE_KEY(buildId))
      if (saved) setQueue(JSON.parse(saved) as string[])
    }
  }, [buildId, navigate])

  async function loadBuild(email: string) {
    try {
      const r = await fetch(`/api/dashboard/builds?email=${encodeURIComponent(email)}`)
      if (!r.ok) { setLoadError('Could not load build data'); return }
      const data = await r.json() as { builds?: Build[] }
      const found = (data.builds ?? []).find((b) => b.id === buildId)
      if (!found) { setLoadError('Build not found'); return }
      setBuild(found)
      // Seed opening Sovereign message with condensed brief
      setMessages([{
        id: ++counter.current,
        role: 'sovereign',
        text: formatOpening(found.idea, found.app_name),
      }])
    } catch {
      setLoadError('Network error loading build')
    }
  }

  // ── Scroll to bottom ────────────────────────────────────────────────────────

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy, hint])

  // ── Deploy countdown ────────────────────────────────────────────────────────

  useEffect(() => {
    if (deploying) {
      setDeploySeconds(0)
      deployTimerRef.current = setInterval(() => {
        setDeploySeconds((s) => Math.min(s + 1, 90))
      }, 1000)
    } else {
      if (deployTimerRef.current) clearInterval(deployTimerRef.current)
    }
    return () => {
      if (deployTimerRef.current) clearInterval(deployTimerRef.current)
    }
  }, [deploying])

  // ── Queue persistence ────────────────────────────────────────────────────────

  useEffect(() => {
    if (buildId) localStorage.setItem(QUEUE_KEY(buildId), JSON.stringify(queue))
  }, [queue, buildId])

  // ── Message helpers ──────────────────────────────────────────────────────────

  function pushMsg(msg: Omit<Message, 'id'>) {
    setMessages((prev) => [...prev, { ...msg, id: ++counter.current }])
  }

  // ── Poll build status ────────────────────────────────────────────────────────

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const r = await fetch(`/api/build-status?id=${encodeURIComponent(buildId!)}`)
        if (!r.ok) return
        const data = await r.json() as {
          status?: string
          deployUrl?: string
          staging?: boolean
          claimed_at?: string | null
        }
        if (data.status === 'complete') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setDeploying(false)
          if (data.deployUrl) setBuild((b) => b ? { ...b, deploy_url: data.deployUrl! } : b)
          setPreviewKey((k) => k + 1)
          setIframeLoaded(false)
          // Flash green border
          setPreviewFlash(true)
          setTimeout(() => setPreviewFlash(false), 200)
          // Update deploying message with actual elapsed time
          const elapsed = Math.round((Date.now() - deployStartTimeRef.current) / 1000)
          setMessages((prev) => {
            let lastIdx = -1
            prev.forEach((m, i) => { if (m.isDeploying) lastIdx = i })
            if (lastIdx === -1) return prev
            return prev.map((m, i) => i === lastIdx ? { ...m, text: `Done. Deployed in ${elapsed}s.`, isDeploying: false } : m)
          })
          setLastDeployedAt(Date.now())
          // Post-deploy checks
          void fetchBrainHint()
          if (build?.deploy_url) void verifyDeployment(build.deploy_url)
        } else if (data.status === 'error') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setDeploying(false)
          pushMsg({ role: 'sovereign', text: 'The deployment failed. Check GitHub for build errors, or try the edit again.' })
        }
      } catch { /* non-fatal */ }
      if (attempts >= 30) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setDeploying(false)
      }
    }, 5000)
  }

  // ── Submit edit ──────────────────────────────────────────────────────────────

  const submitEdit = useCallback(async (text: string) => {
    if (!build || !text.trim() || busy || deploying) return

    // Amber intercept — dangerous patterns pause execution
    const danger = checkDanger(text)
    if (danger) {
      setHint({
        type: 'amber',
        body: `This instruction might ${danger.reason}. Review carefully before proceeding.`,
        action: danger.safe,
        actionLabel: 'Safe alternative →',
      })
      return
    }

    pushMsg({ role: 'user', text })
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setBusy(true)
    setHint(null)

    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildId: build.id,
          appName: build.app_name,
          repoUrl: build.repo_url,
          editRequest: text.slice(0, 1000),
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        pushMsg({ role: 'sovereign', text: data.error ?? 'Something went wrong. Please try again.' })
      } else {
        const newCount = editCount + 1
        setEditCount(newCount)
        pushMsg({ role: 'sovereign', text: 'Done — deploying your change now.', isDeploying: true })
        deployStartTimeRef.current = Date.now()
        setDeploying(true)
        startPolling()
      }
    } catch {
      pushMsg({ role: 'sovereign', text: 'Network error. Please check your connection.' })
    } finally {
      setBusy(false)
    }
  }, [build, busy, deploying, editCount])

  // ── Brain hint ────────────────────────────────────────────────────────────────

  async function fetchBrainHint() {
    if (!build || !buildId) return
    try {
      const lastInstruction = messages.filter((m) => m.role === 'user').at(-1)?.text ?? ''
      const res = await fetch('/api/brain-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          build_id: buildId,
          app_type: build.app_name,
          edit_instruction: lastInstruction,
          edit_count: editCount,
          features_built: [],
          last_hint_type: lastHintType,
        }),
      })
      if (!res.ok) return
      const data = await res.json() as {
        show_hint: boolean
        hint_type: string | null
        hint_body: string | null
        hint_action: string | null
        hint_action_label: string | null
      }
      if (data.show_hint && data.hint_type && data.hint_body) {
        setHint({
          type: data.hint_type as 'blue' | 'amber' | 'green',
          body: data.hint_body,
          action: data.hint_action,
          actionLabel: data.hint_action_label,
        })
        setLastHintType(data.hint_type)
      }
    } catch { /* non-fatal */ }
  }

  // ── Verify deployment ─────────────────────────────────────────────────────────

  async function verifyDeployment(url: string) {
    try {
      const res = await fetch('/api/verify-deployment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) return
      const data = await res.json() as { healthy: boolean; reason: string }
      if (!data.healthy) {
        setDeployUnhealthy(true)
        setHint({
          type: 'amber',
          body: "Something looks off with the latest deployment. Want me to check what went wrong?",
          action: `Check why the latest deployment has an issue: ${data.reason.slice(0, 80)}`,
          actionLabel: 'Investigate →',
        })
      } else {
        setDeployUnhealthy(false)
      }
    } catch { /* non-fatal */ }
  }

  // ── Security scan ─────────────────────────────────────────────────────────────

  async function runSecurityScan() {
    if (!buildId || scanning) return
    setScanning(true)
    setScanResult(null)
    try {
      const res = await fetch('/api/security-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ build_id: buildId }),
      })
      if (!res.ok) { setScanning(false); return }
      const data = await res.json() as { passed: boolean; issues: SecurityIssue[]; score: number }
      setScanResult(data)
    } catch { /* non-fatal */ } finally {
      setScanning(false)
    }
  }

  function handleClaimClick() {
    setScanOpen(true)
    void runSecurityScan()
  }

  // ── Prompt queue ──────────────────────────────────────────────────────────────

  function addToQueue(text: string) {
    if (!text.trim()) return
    setQueue((q) => [...q, text.trim()])
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setQueueOpen(true)
  }

  async function runQueue() {
    if (queueRunning || queue.length === 0) return
    setQueueRunning(true)
    const items = [...queue]
    setQueue([])
    for (const item of items) {
      await submitEdit(item)
      // Wait for deploy to complete before next item
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          setDeploying((d) => {
            if (!d) { clearInterval(check); resolve(); }
            return d
          })
        }, 1000)
        setTimeout(() => { clearInterval(check); resolve() }, 150000)
      })
    }
    setQueueRunning(false)
  }

  function removeFromQueue(i: number) {
    setQueue((q) => q.filter((_, idx) => idx !== i))
  }

  // ── Brand form ────────────────────────────────────────────────────────────────

  async function applyBrand() {
    if (!build || brandApplying) return
    setBrandApplying(true)
    const fontMap = { serif: 'Playfair Display', sans: 'Inter', mono: 'DM Mono' }
    const instruction = `Update the app's global brand: primary color ${brandColor}, heading font ${fontMap[headingFont]}, overall tone ${tone}. Apply these consistently across all UI elements, buttons, and headings.`
    await submitEdit(instruction)
    setBrandApplying(false)
  }

  // ── Click-to-describe ─────────────────────────────────────────────────────────

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!clickMode) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xPct = ((e.clientX - rect.left) / rect.width) * 100
    const yPct = ((e.clientY - rect.top) / rect.height) * 100
    const area = getElementArea(xPct, yPct)
    setClickPopover({ x: e.clientX - rect.left, y: e.clientY - rect.top, area })
    setClickInput('')
  }

  function submitClickDescription() {
    if (!clickInput.trim() || !clickPopover) return
    const combined = `${clickPopover.area}: ${clickInput.trim()}`
    setClickPopover(null)
    setClickMode(false)
    setInput(combined)
    void submitEdit(combined)
  }

  // ── Persist panel theme preference ───────────────────────────────────────────

  useEffect(() => {
    try { localStorage.setItem('sovereign_edit_theme', panelTheme) } catch { /* non-fatal */ }
  }, [panelTheme])

  // ── Live status tick (recalculate "X min ago" every 60s) ──────────────────────

  useEffect(() => {
    const id = setInterval(() => setLiveTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  // ── Cleanup on unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (deployTimerRef.current) clearInterval(deployTimerRef.current)
    }
  }, [])

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (!build && !loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0e0d0b' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <span style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#c8f060',
            animation: 'pulse 1.4s infinite',
          }} />
          <span style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#3a3830' }}>Loading…</span>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0e0d0b' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <p style={{ font: '13px/1.5 DM Mono, Courier New, monospace', color: '#f2efe8', margin: 0 }}>{loadError}</p>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: '1px solid #3a3830', color: '#5a5850', font: '11px/1 DM Mono, Courier New, monospace', padding: '8px 16px', cursor: 'pointer', borderRadius: 4 }}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const previewUrl = build!.deploy_url ?? ''
  const isStaging = build!.staging === true && !build!.claimed_at

  // ── Panel theme tokens ────────────────────────────────────────────────────────

  const t = panelTheme === 'light' ? {
    panelBg:             '#f2efe8',
    surface:             '#ffffff',
    border:              '#e8e4da',
    textPrimary:         '#0e0d0b',
    textSecondary:       '#6b6862',
    textDim:             '#9a9890',
    sovereignBubbleBg:   '#ffffff',
    sovereignBubbleText: '#0e0d0b',
    userBubbleBg:        '#8ab800',
    userBubbleText:      '#0e0d0b',
    accent:              '#8ab800',
    avatarBg:            '#141210',
    avatarBorder:        '#8ab800',
    avatarText:          '#8ab800',
    typingDot:           '#c8c4bc',
    panelClass:          'ea-panel-light' as const,
  } : {
    panelBg:             '#0e0d0b',
    surface:             '#1a1917',
    border:              '#1a1917',
    textPrimary:         '#f2efe8',
    textSecondary:       '#5a5850',
    textDim:             '#5a5850',
    sovereignBubbleBg:   '#1a1917',
    sovereignBubbleText: '#c8c4bc',
    userBubbleBg:        '#c8f060',
    userBubbleText:      '#0e0d0b',
    accent:              '#c8f060',
    avatarBg:            '#141210',
    avatarBorder:        '#c8f060',
    avatarText:          '#c8f060',
    typingDot:           '#5a5850',
    panelClass:          '' as const,
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }
        @keyframes glowFlash { 0%{box-shadow:0 0 0 2px #c8f060} 100%{box-shadow:none} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dot1 { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-4px);opacity:1} }
        @keyframes dot2 { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-4px);opacity:1} }
        @media (prefers-reduced-motion: reduce) { *{animation-duration:0.001ms!important;transition-duration:0.001ms!important} }
        .ea-scroll::-webkit-scrollbar{width:3px}
        .ea-scroll::-webkit-scrollbar-thumb{background:#2a2925;border-radius:2px}
        .ea-textarea{resize:none;font:12px/1.6 DM Mono,Courier New,monospace;color:#f2efe8;background:#1a1917;border:0.5px solid #2a2925;border-radius:4px;outline:none;width:100%;box-sizing:border-box;padding:10px 12px;min-height:40px;max-height:120px;overflow-y:auto;transition:border-color .15s,background .15s,color .15s}
        .ea-textarea::placeholder{color:#5a5850}
        .ea-textarea:disabled{opacity:0.75;cursor:default}
        .ea-textarea:focus-visible{outline:1px solid #c8f060;outline-offset:1px;border-color:#c8f060}
        .ea-btn-ghost{background:none;border:1px solid #2a2925;color:#5a5850;font:10px/1 DM Mono,Courier New,monospace;padding:6px 10px;cursor:pointer;border-radius:3px;transition:border-color .15s,color .15s,background .15s}
        .ea-btn-ghost:hover{border-color:#5a5850;color:#f2efe8}
        .ea-btn-ghost:focus-visible{outline:2px solid #c8f060;outline-offset:2px}
        .ea-btn-ghost:disabled{opacity:0.4;cursor:default}
        .ea-btn-green{background:#c8f060;border:none;color:#0e0d0b;font:10px/1 DM Mono,Courier New,monospace;padding:6px 12px;cursor:pointer;border-radius:3px;transition:opacity .15s}
        .ea-btn-green:hover{opacity:.85}
        .ea-btn-green:disabled{opacity:.4;cursor:default}
        .ea-btn-green:focus-visible{outline:2px solid #f2efe8;outline-offset:2px}
        .ea-tab{background:none;border:none;font:10px/1 DM Mono,Courier New,monospace;padding:6px 12px;cursor:pointer;border-radius:3px;transition:background .15s,color .15s}
        .ea-tab.active{background:#1a1917;color:#f2efe8}
        .ea-tab.inactive{color:#5a5850}
        .ea-tab:focus-visible{outline:2px solid #c8f060;outline-offset:2px}
        .hint-fade{animation:fadeIn .2s ease}
        .queue-pill{display:flex;align-items:center;gap:6px;background:#111009;border:1px solid #2a2925;border-radius:4px;padding:6px 10px;font:11px/1.4 DM Mono,Courier New,monospace;color:#c8c4bc;transition:background .15s,border-color .15s,color .15s}
        .queue-pill button{background:none;border:none;color:#5a5850;cursor:pointer;padding:0;font-size:12px;line-height:1;transition:color .12s}
        .queue-pill button:hover{color:#f2efe8}
        /* ── Light mode overrides ─────────────────────────────────────────── */
        .ea-panel-light .ea-textarea{color:#0e0d0b;background:#ffffff;border-color:#e8e4da}
        .ea-panel-light .ea-textarea::placeholder{color:#b8b4ac}
        .ea-panel-light .ea-textarea:focus-visible{border-color:#8ab800;outline-color:#8ab800}
        .ea-panel-light .ea-btn-ghost{color:#0e0d0b;border-color:#c8c4bc}
        .ea-panel-light .ea-btn-ghost:hover{color:#0e0d0b;border-color:#8ab800}
        .ea-panel-light .ea-btn-green{background:#8ab800;color:#ffffff}
        .ea-panel-light .ea-btn-green:focus-visible{outline-color:#0e0d0b}
        .ea-panel-light .ea-tab.active{background:#ffffff;color:#0e0d0b}
        .ea-panel-light .ea-tab.inactive{color:#6b6862}
        .ea-panel-light .ea-scroll::-webkit-scrollbar-thumb{background:#e8e4da}
        .ea-panel-light .queue-pill{background:#ffffff;border-color:#e8e4da;color:#0e0d0b}
        .ea-panel-light .queue-pill button{color:#b8b4ac}
        .ea-panel-light .queue-pill button:hover{color:#0e0d0b}
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0e0d0b' }}>

        {/* ── Top bar ─────────────────────────────────────────────────────────── */}
        <div style={{
          height: 44,
          flexShrink: 0,
          background: '#0e0d0b',
          borderBottom: '1px solid #1a1917',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          gap: 12,
          zIndex: 10,
        }}>
          {/* Left: back */}
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', color: '#5a5850', font: '11px/1 DM Mono, Courier New, monospace', cursor: 'pointer', padding: 0, flexShrink: 0, whiteSpace: 'nowrap' }}
            aria-label="Back to Dashboard"
          >
            ← Dashboard
          </button>

          {/* Center: app name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, justifyContent: 'center' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c8f060', flexShrink: 0, display: 'inline-block' }} />
            <span style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 15,
              color: '#f2efe8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {build!.app_name}
            </span>
          </div>

          {/* Right: URL + claim + ownership */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  font: '10px/1 DM Mono, Courier New, monospace',
                  color: '#5a5850',
                  textDecoration: 'none',
                  background: '#1a1917',
                  padding: '4px 8px',
                  borderRadius: 3,
                  maxWidth: isMobile ? 100 : 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                }}
              >
                {previewUrl.replace('https://', '')}
              </a>
            )}
            {isStaging && (
              <button
                onClick={handleClaimClick}
                style={{ background: '#c8f060', border: 'none', color: '#0e0d0b', font: '10px/1 DM Mono, Courier New, monospace', padding: '5px 10px', cursor: 'pointer', borderRadius: 3, whiteSpace: 'nowrap' }}
              >
                Claim →
              </button>
            )}
            {!isMobile && (
              <span style={{ font: '10px/1 DM Mono, Courier New, monospace', color: '#3a3830', whiteSpace: 'nowrap' }}>
                ↗ GitHub · Vercel · Yours
              </span>
            )}
          </div>
        </div>

        {/* ── Mobile tab toggle ───────────────────────────────────────────────── */}
        {isMobile && (
          <div style={{ display: 'flex', background: '#111009', borderBottom: '1px solid #1a1917', flexShrink: 0 }}>
            <button
              className={`ea-tab ${mobileTab === 'chat' ? 'active' : 'inactive'}`}
              onClick={() => setMobileTab('chat')}
              style={{ flex: 1, borderRadius: 0 }}
            >
              Chat
            </button>
            <button
              className={`ea-tab ${mobileTab === 'preview' ? 'active' : 'inactive'}`}
              onClick={() => setMobileTab('preview')}
              style={{ flex: 1, borderRadius: 0 }}
            >
              Preview
            </button>
          </div>
        )}

        {/* ── Two-column body ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* LEFT COLUMN — Brain Panel */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div
            className={t.panelClass}
            style={{
              width: isMobile ? '100%' : 360,
              flexShrink: 0,
              background: t.panelBg,
              borderRight: isMobile ? 'none' : '2px solid rgba(200,240,96,0.5)',
              display: isMobile && mobileTab !== 'chat' ? 'none' : 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'background .15s',
            }}>

            {/* ── Workspace knowledge bar ──────────────────────────────────── */}
            <div style={{ borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
              <button
                onClick={() => setKnowledgeOpen((o) => !o)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  font: '10px/1 DM Mono, Courier New, monospace',
                  color: panelTheme === 'dark' ? '#8a8880' : t.textSecondary,
                  textAlign: 'left',
                  transition: 'color .15s',
                }}
                aria-expanded={knowledgeOpen}
              >
                <span>Workspace knowledge</span>
                <span style={{ transition: 'transform .15s', transform: knowledgeOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
              </button>
              {knowledgeOpen && (
                <div style={{ padding: '0 16px 12px', animation: 'fadeIn .15s ease' }}>
                  <p style={{ font: '10px/1.6 DM Mono, Courier New, monospace', color: t.textSecondary, margin: '0 0 8px' }}>
                    Your brand · <span style={{ color: brandColor }}>■</span> {brandColor} · {headingFont} headings · {tone} tone
                  </p>
                  <button
                    onClick={() => { setLeftTab('brand'); setKnowledgeOpen(false) }}
                    style={{ background: 'none', border: 'none', color: t.textSecondary, font: '10px/1 DM Mono, Courier New, monospace', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    Edit preferences
                  </button>
                </div>
              )}
            </div>

            {/* ── Left column tabs: Chat | Brand + theme toggle ────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px 0', gap: 4, flexShrink: 0 }}>
              <button
                className={`ea-tab ${leftTab === 'chat' ? 'active' : 'inactive'}`}
                onClick={() => setLeftTab('chat')}
              >
                Chat
              </button>
              <button
                className={`ea-tab ${leftTab === 'brand' ? 'active' : 'inactive'}`}
                onClick={() => setLeftTab('brand')}
              >
                Brand
              </button>
              {/* Theme toggle pill */}
              <button
                onClick={() => setPanelTheme((p) => p === 'dark' ? 'light' : 'dark')}
                title={panelTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={panelTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{
                  marginLeft: 'auto',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: panelTheme === 'dark' ? '#2a2925' : '#e8e4da',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background .15s',
                  color: panelTheme === 'dark' ? '#5a5850' : '#8ab800',
                  padding: 0,
                }}
              >
                {panelTheme === 'dark' ? (
                  /* Moon (crescent) */
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M10.5 7.5a4.5 4.5 0 01-6-6A4.5 4.5 0 1010.5 7.5z" fill="currentColor"/>
                  </svg>
                ) : (
                  /* Sun (circle + rays) */
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="6" r="2.2" fill="currentColor"/>
                    <line x1="6" y1="0.5" x2="6" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="6" y1="10" x2="6" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="0.5" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="10" y1="6" x2="11.5" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="2.05" y1="2.05" x2="3.1" y2="3.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="8.9" y1="8.9" x2="9.95" y2="9.95" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="9.95" y1="2.05" x2="8.9" y2="3.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="3.1" y1="8.9" x2="2.05" y2="9.95" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            </div>

            {/* ── Chat tab ─────────────────────────────────────────────────── */}
            {leftTab === 'chat' && (
              <>
                {/* Conversation area */}
                <div
                  ref={scrollRef}
                  className="ea-scroll"
                  style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}
                >
                  {messages.map((msg) => (
                    <div key={msg.id} style={{ animation: 'fadeIn .15s ease' }}>
                      {msg.role === 'user' ? (
                        <div style={{
                          alignSelf: 'flex-end',
                          background: t.userBubbleBg,
                          color: t.userBubbleText,
                          padding: '8px 12px',
                          borderRadius: '10px 10px 2px 10px',
                          font: '12px/1.6 DM Mono, Courier New, monospace',
                          maxWidth: '88%',
                          wordBreak: 'break-word',
                          marginLeft: 'auto',
                          transition: 'background .15s',
                        }}>
                          {msg.text}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          {/* Sovereign avatar */}
                          <div style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: t.avatarBg,
                            border: `1px solid ${t.avatarBorder}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 2,
                            transition: 'border-color .15s',
                          }}>
                            <span style={{ font: '9px/1 DM Mono, Courier New, monospace', color: t.avatarText, userSelect: 'none' }}>S</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              background: t.sovereignBubbleBg,
                              color: t.sovereignBubbleText,
                              padding: '8px 12px',
                              borderRadius: '2px 10px 10px 10px',
                              font: '12px/1.6 DM Mono, Courier New, monospace',
                              maxWidth: '100%',
                              wordBreak: 'break-word',
                              transition: 'background .15s, color .15s',
                            }}>
                              {msg.isDeploying ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8f060', flexShrink: 0, animation: 'pulse 1.4s infinite', display: 'inline-block' }} />
                                  Deploying · ~60s
                                </span>
                              ) : msg.text}
                            </div>
                            {/* Change pills */}
                            {msg.pills && msg.pills.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                {msg.pills.map((pill, i) => (
                                  <span key={i} style={{ background: '#0f1a06', color: '#9ab870', font: '10px/1 DM Mono, Courier New, monospace', padding: '3px 8px', borderRadius: 3, border: '1px solid #1a3006' }}>
                                    {pill}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Typing indicator when busy */}
                  {busy && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
                      {[0, 1, 2].map((i) => (
                        <span key={i} style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: t.typingDot,
                          display: 'inline-block',
                          animation: `dot1 1.2s ease-in-out ${i * 0.2}s infinite`,
                          transition: 'background .15s',
                        }} />
                      ))}
                    </div>
                  )}

                  {/* Brain hint — ONE per interaction */}
                  {hint && (
                    <HintCard
                      hint={hint}
                      onAction={(action) => {
                        setHint(null)
                        if (action) void submitEdit(action)
                      }}
                      onDismiss={() => setHint(null)}
                    />
                  )}
                </div>

                {/* ── Prompt queue ─────────────────────────────────────────── */}
                {queue.length > 0 && (
                  <div style={{ borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
                    <button
                      onClick={() => setQueueOpen((o) => !o)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        font: '10px/1 DM Mono, Courier New, monospace',
                        color: t.textSecondary,
                      }}
                    >
                      <span>Queue · {queue.length} item{queue.length !== 1 ? 's' : ''}</span>
                      <span style={{ transform: queueOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                    </button>
                    {queueOpen && (
                      <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 4, animation: 'fadeIn .15s ease', maxHeight: 140, overflowY: 'auto' }}>
                        {queue.map((item, i) => (
                          <div key={i} className="queue-pill">
                            <span style={{ color: '#5a5850', flexShrink: 0 }}>{i + 1}.</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}</span>
                            <button onClick={() => removeFromQueue(i)} aria-label={`Remove queue item ${i + 1}`}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Input area ───────────────────────────────────────────── */}
                <div style={{ borderTop: `1px solid ${t.border}`, padding: '8px 12px 12px', flexShrink: 0, background: t.panelBg, transition: 'background .15s, border-color .15s' }}>
                  <textarea
                    ref={inputRef}
                    className="ea-textarea"
                    placeholder="What do you want to change..."
                    value={input}
                    disabled={busy || deploying}
                    onChange={(e) => {
                      setInput(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void submitEdit(input)
                      }
                    }}
                  />
                  {/* Row 1: queue + send */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 6 }}>
                    <button
                      className="ea-btn-ghost"
                      onClick={() => addToQueue(input)}
                      disabled={!input.trim() || busy || deploying}
                      style={{ opacity: !input.trim() ? 0.4 : 1 }}
                    >
                      Add to queue +
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {queue.length > 0 && (
                        <button
                          className="ea-btn-green"
                          onClick={() => void runQueue()}
                          disabled={queueRunning || deploying}
                        >
                          {queueRunning ? 'Running…' : 'Run queue →'}
                        </button>
                      )}
                      <button
                        className="ea-btn-green"
                        onClick={() => void submitEdit(input)}
                        disabled={!input.trim() || busy || deploying}
                      >
                        {busy ? '…' : 'Update →'}
                      </button>
                    </div>
                  </div>
                  {/* Row 2: timing hint */}
                  <p style={{ font: '10px/1 DM Mono, Courier New, monospace', color: t.textDim, margin: '6px 0 0', textAlign: 'right', transition: 'color .15s' }}>
                    deploys in ~60s
                  </p>
                </div>
              </>
            )}

            {/* ── Brand tab ────────────────────────────────────────────────── */}
            {leftTab === 'brand' && (
              <div className="ea-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px', minHeight: 0 }}>
                <p style={{ font: '10px/1.6 DM Mono, Courier New, monospace', color: t.textSecondary, margin: '0 0 16px' }}>
                  Set your global brand. One click applies it everywhere.
                </p>

                {/* Primary color */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', font: '10px/1 DM Mono, Courier New, monospace', color: t.textSecondary, marginBottom: 6 }}>Primary color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    />
                    <input
                      type="text"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.textPrimary, font: '11px/1 DM Mono, Courier New, monospace', padding: '6px 10px', borderRadius: 3, width: 80 }}
                    />
                  </div>
                </div>

                {/* Heading font */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', font: '10px/1 DM Mono, Courier New, monospace', color: t.textSecondary, marginBottom: 6 }}>Heading font</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['serif', 'sans', 'mono'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setHeadingFont(f)}
                        style={{
                          background: headingFont === f ? t.accent : t.surface,
                          color: headingFont === f ? '#0e0d0b' : t.textSecondary,
                          border: `1px solid ${t.border}`,
                          font: '10px/1 DM Mono, Courier New, monospace',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          borderRadius: 3,
                          textTransform: 'capitalize',
                          transition: 'background .15s, color .15s',
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tone */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', font: '10px/1 DM Mono, Courier New, monospace', color: t.textSecondary, marginBottom: 6 }}>Tone</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {(['professional', 'friendly', 'bold', 'minimal'] as const).map((tone_opt) => (
                      <button
                        key={tone_opt}
                        onClick={() => setTone(tone_opt)}
                        style={{
                          background: tone === tone_opt ? t.accent : t.surface,
                          color: tone === tone_opt ? '#0e0d0b' : t.textSecondary,
                          border: `1px solid ${t.border}`,
                          font: '10px/1 DM Mono, Courier New, monospace',
                          padding: '7px 0',
                          cursor: 'pointer',
                          borderRadius: 3,
                          textTransform: 'capitalize',
                          transition: 'background .15s, color .15s',
                        }}
                      >
                        {tone_opt}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="ea-btn-green"
                  onClick={() => void applyBrand()}
                  disabled={brandApplying || busy || deploying}
                  style={{ width: '100%', padding: '10px', fontSize: 11 }}
                >
                  {brandApplying ? 'Applying…' : 'Apply to entire app →'}
                </button>
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* RIGHT COLUMN — Live Preview */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div style={{
            flex: 1,
            display: isMobile && mobileTab !== 'preview' ? 'none' : 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#0a0908',
            minWidth: 0,
            position: 'relative',
          }}>

            {/* Preview bar */}
            <div style={{
              height: 36,
              background: '#141210',
              borderBottom: '1px solid #1a1917',
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              gap: 10,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {['#3a3830', '#3a3830', '#3a3830'].map((c, i) => (
                  <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
                ))}
              </div>
              <span style={{ flex: 1, font: '10px/1 DM Mono, Courier New, monospace', color: '#3a3830', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                {previewUrl.replace('https://', '') || 'No preview available'}
              </span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                {/* Click mode toggle */}
                <button
                  onClick={() => { setClickMode((c) => !c); setClickPopover(null) }}
                  style={{
                    background: clickMode ? '#c8f060' : 'none',
                    border: `1px solid ${clickMode ? '#c8f060' : '#2a2925'}`,
                    color: clickMode ? '#0e0d0b' : '#3a3830',
                    font: '10px/1 DM Mono, Courier New, monospace',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    borderRadius: 3,
                    transition: 'all .15s',
                  }}
                  title="Click anywhere in the preview to describe a change"
                >
                  click mode: {clickMode ? 'on' : 'off'}
                </button>
                <button
                  onClick={() => setPreviewKey((k) => k + 1)}
                  style={{ background: 'none', border: 'none', color: '#3a3830', cursor: 'pointer', font: '14px/1', padding: '2px 4px' }}
                  title="Refresh preview"
                  aria-label="Refresh preview"
                >
                  ↻
                </button>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ font: '10px/1 DM Mono, Courier New, monospace', color: '#5a5850', textDecoration: 'none' }}
                  >
                    Open →
                  </a>
                )}
              </div>
            </div>

            {/* Iframe container */}
            <div
              ref={iframeContainerRef}
              style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: previewFlash ? 'inset 0 0 0 2px #c8f060' : 'none',
                transition: 'box-shadow .2s',
              }}
            >
              {previewUrl ? (
                <>
                  {!iframeLoaded && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#0a0908',
                      gap: 12,
                      zIndex: 2,
                    }}>
                      <span style={{ font: '18px/1', color: '#3a3830', animation: 'pulse 1.4s infinite' }}>✦</span>
                      <span style={{ font: '10px/1 DM Mono, Courier New, monospace', color: '#2a2925' }}>
                        {deploying ? 'Deploying · up to 60s after a change' : 'Loading preview…'}
                      </span>
                    </div>
                  )}
                  <iframe
                    key={previewKey}
                    src={previewUrl}
                    title={`${build!.app_name} preview`}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    onLoad={() => setIframeLoaded(true)}
                    onError={() => setIframeLoaded(true)}
                  />
                  {/* Click-to-describe overlay */}
                  {clickMode && (
                    <div
                      style={{ position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 3 }}
                      onClick={handleOverlayClick}
                    >
                      {/* Visible "click mode active" indicator */}
                      <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(200,240,96,0.15)', border: '1px solid rgba(200,240,96,0.4)', borderRadius: 4, padding: '4px 10px', font: '10px/1 DM Mono, Courier New, monospace', color: '#c8f060', pointerEvents: 'none', zIndex: 4 }}>
                        Click anywhere to describe a change
                      </div>

                      {/* Click popover */}
                      {clickPopover && (
                        <div
                          style={{
                            position: 'absolute',
                            left: Math.min(clickPopover.x, (iframeContainerRef.current?.offsetWidth ?? 400) - 260),
                            top: Math.min(clickPopover.y, (iframeContainerRef.current?.offsetHeight ?? 400) - 120),
                            background: '#1a1917',
                            border: '1px solid #2a2925',
                            borderRadius: 6,
                            padding: 12,
                            width: 240,
                            zIndex: 5,
                            boxShadow: '0 4px 20px rgba(0,0,0,.6)',
                            animation: 'fadeIn .15s ease',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p style={{ font: '10px/1 DM Mono, Courier New, monospace', color: '#5a5850', margin: '0 0 8px' }}>
                            {clickPopover.area}
                          </p>
                          <textarea
                            autoFocus
                            className="ea-textarea"
                            placeholder="What do you want to change about this?"
                            value={clickInput}
                            onChange={(e) => setClickInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitClickDescription() } }}
                            style={{ minHeight: 56, marginBottom: 8, borderRadius: 4, border: '1px solid #2a2925' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                            <button onClick={() => setClickPopover(null)} className="ea-btn-ghost" style={{ fontSize: 10, padding: '5px 8px' }}>✕</button>
                            <button onClick={submitClickDescription} className="ea-btn-green" disabled={!clickInput.trim()} style={{ flex: 1 }}>
                              Update this →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
                  <span style={{ font: '14px/1', color: '#2a2925' }}>✦</span>
                  <span style={{ font: '11px/1.5 DM Mono, Courier New, monospace', color: '#2a2925', textAlign: 'center', maxWidth: 200 }}>
                    Preview loading… up to 60 seconds after a change
                  </span>
                </div>
              )}
            </div>

            {/* Live/deploying status pill — persistent floating indicator */}
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#0a0908',
              border: '0.5px solid #1e1d1a',
              borderRadius: 20,
              padding: '5px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              zIndex: 10,
              pointerEvents: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,.5)',
            }}>
              {deploying ? (
                <>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e8a020', flexShrink: 0, animation: 'pulse 1.4s infinite', display: 'inline-block' }} />
                  <span style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#c8c4bc', whiteSpace: 'nowrap' }}>
                    Deploying · ~{Math.max(5, 60 - deploySeconds)}s
                  </span>
                </>
              ) : (
                <>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6ab870', flexShrink: 0, animation: 'pulse 1.4s infinite', display: 'inline-block' }} />
                  <span style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#c8c4bc', whiteSpace: 'nowrap' }}>
                    {lastDeployedAt ? `Live · last deployed ${minsAgo(lastDeployedAt)}` : 'Live'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Security scan modal ────────────────────────────────────────────────── */}
      {scanOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setScanOpen(false) }}
        >
          <div style={{ background: '#0e0d0b', border: '1px solid #2a2925', borderRadius: 10, width: '100%', maxWidth: 480, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
              <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: '#f2efe8', margin: '0 0 4px' }}>Claim your app</p>
              <p style={{ font: '11px/1.6 DM Mono, Courier New, monospace', color: '#5a5850', margin: '0 0 16px' }}>
                Running a security scan before transfer…
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
              {scanning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8f060', animation: 'pulse 1.4s infinite', display: 'inline-block' }} />
                  <span style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#5a5850' }}>Scanning…</span>
                </div>
              )}

              {scanResult && (
                <div style={{ animation: 'fadeIn .2s ease' }}>
                  {scanResult.passed ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#0e1a0e', border: '1px solid #1e3a1e', borderRadius: 6, marginBottom: 16 }}>
                      <span style={{ color: '#6ab870', fontSize: 14 }}>✓</span>
                      <span style={{ font: '12px/1 DM Mono, Courier New, monospace', color: '#6ab870' }}>Security scan passed · Safe to claim · Score {scanResult.score}/100</span>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ font: '11px/1.6 DM Mono, Courier New, monospace', color: '#e8a020', margin: '0 0 12px' }}>
                        ⚠ {scanResult.issues.filter((i) => i.severity === 'high').length} high severity issue{scanResult.issues.filter((i) => i.severity === 'high').length !== 1 ? 's' : ''} found
                      </p>
                      {scanResult.issues.map((issue, i) => (
                        <div key={i} style={{ background: '#1a1917', borderLeft: `2px solid ${issue.severity === 'high' ? '#e8a020' : issue.severity === 'medium' ? '#f97316' : '#5a5850'}`, padding: '8px 12px', marginBottom: 6, borderRadius: '0 4px 4px 0' }}>
                          <p style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#f2efe8', margin: '0 0 4px' }}>{issue.title}</p>
                          <p style={{ font: '10px/1.5 DM Mono, Courier New, monospace', color: '#5a5850', margin: 0 }}>{issue.description}</p>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const fixes = scanResult.issues.filter((i) => i.severity === 'high').map((i) => `Fix: ${i.title}`)
                          setQueue((q) => [...q, ...fixes])
                          setScanOpen(false)
                          setLeftTab('chat')
                          setQueueOpen(true)
                        }}
                        className="ea-btn-green"
                        style={{ marginTop: 8, padding: '8px 14px', fontSize: 11 }}
                      >
                        Fix before claiming →
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {scanResult.passed && (
                      <a
                        href={`/api/claim-build?build_id=${buildId}`}
                        style={{ flex: 1, textAlign: 'center', background: '#c8f060', color: '#0e0d0b', font: '11px/1 DM Mono, Courier New, monospace', padding: '10px 0', borderRadius: 4, textDecoration: 'none', display: 'block' }}
                      >
                        Claim and transfer →
                      </a>
                    )}
                    <button
                      onClick={() => setScanOpen(false)}
                      className="ea-btn-ghost"
                      style={{ padding: '10px 16px' }}
                    >
                      {scanResult.passed ? 'Not now' : 'Claim anyway →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Brain Hint Card ────────────────────────────────────────────────────────────

function HintCard({ hint, onAction, onDismiss }: {
  hint: BrainHint
  onAction: (action: string | null) => void
  onDismiss: () => void
}) {
  const colors = {
    blue:  { bg: '#0c1a2e', border: '#1a3d5c', icon: '↗', iconColor: '#4a9edd', labelColor: '#4a9edd', label: 'NEXT STEP WORTH CONSIDERING', bodyColor: '#b8d4ec', actionBg: '#1a3d5c', actionColor: '#b8d4ec' },
    amber: { bg: '#1f1200', border: '#4a2a00', icon: '⚠', iconColor: '#e8a020', labelColor: '#e8a020', label: 'POTENTIAL ISSUE',             bodyColor: '#e8c87a', actionBg: '#4a2a00', actionColor: '#e8c87a' },
    green: { bg: '#0e1a0e', border: '#1e3a1e', icon: '✦', iconColor: '#6ab870', labelColor: '#6ab870', label: '',                            bodyColor: '#9ab870', actionBg: '#1e3a1e', actionColor: '#9ab870' },
  }
  const c = colors[hint.type]

  return (
    <div className="hint-fade" style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 6,
      padding: '10px 12px',
      maxWidth: '92%',
    }}>
      {c.label && (
        <p style={{ font: '9px/1 DM Mono, Courier New, monospace', color: c.labelColor, margin: '0 0 6px', letterSpacing: '0.08em' }}>
          {c.icon} {c.label}
        </p>
      )}
      <p style={{ font: '11px/1.6 DM Mono, Courier New, monospace', color: c.bodyColor, margin: hint.action ? '0 0 10px' : 0 }}>
        {hint.body}
      </p>
      {hint.action && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onAction(hint.action)}
            style={{ background: c.actionBg, border: `1px solid ${c.border}`, color: c.actionColor, font: '10px/1 DM Mono, Courier New, monospace', padding: '5px 10px', cursor: 'pointer', borderRadius: 3 }}
          >
            {hint.actionLabel ?? 'Do it →'}
          </button>
          <button onClick={onDismiss} style={{ background: 'none', border: `1px solid ${c.border}`, color: c.bodyColor, font: '10px/1 DM Mono, Courier New, monospace', padding: '5px 10px', cursor: 'pointer', borderRadius: 3, opacity: 0.6 }}>
            Not now
          </button>
        </div>
      )}
      {!hint.action && (
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: c.bodyColor, font: '10px/1 DM Mono, Courier New, monospace', cursor: 'pointer', padding: '4px 0 0', opacity: 0.5, display: 'block' }}>
          Dismiss
        </button>
      )}
    </div>
  )
}
