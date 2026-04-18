// src/components/VisilaChat.tsx
//
// Floating Visila Chat — available on every page.
// Co-founder experience: proactive outreach, action buttons with navigation,
// expiry awareness, broken build detection, and smart opener.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  useChatStore,
  type ActiveApp,
  type ChatMessage,
} from '../store/chatStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FullBuild extends ActiveApp {
  // ActiveApp already has: id, app_name, deploy_url, repo_url, idea,
  //   created_at, updated_at, expires_at, status, staging, claimed_at
}

interface ProactiveMsg {
  id: number
  text: string
  ctaLabel?: string
  ctaAction?: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSession(): { email: string } | null {
  try {
    const raw = sessionStorage.getItem('sovereign_user')
    return raw ? (JSON.parse(raw) as { email: string }) : null
  } catch {
    return null
  }
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(iso))
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function deriveOpener(builds: FullBuild[] | null, loggedIn: boolean): string {
  if (!loggedIn) {
    return "What will you build? I can help you figure out where to start."
  }
  if (!builds || builds.length === 0) {
    return "You haven't built anything yet. What's your idea?"
  }
  // Condition 1: expiring build
  const expiring = builds.find(
    (b) => b.expires_at && daysUntil(b.expires_at) <= 3 && b.staging && !b.claimed_at
  )
  if (expiring) {
    const d = daysUntil(expiring.expires_at!)
    return `${expiring.app_name} expires in ${d} day${d === 1 ? '' : 's'} and hasn't been claimed. Claim it now to keep it.`
  }
  // Condition 2: broken build
  const broken = builds.find((b) => b.status === 'error')
  if (broken) {
    return `${broken.app_name} has a build error. Let's look at what went wrong.`
  }
  // Condition 3+: normal — show count and latest
  const latest = builds[0]
  const timeAgo = latest.created_at ? ` deployed ${relativeDate(latest.created_at)}` : ''
  const count = builds.length
  if (count === 1) {
    return `${latest.app_name} is live${timeAgo}. What are we improving today?`
  }
  return `You have ${count} apps. ${latest.app_name}${timeAgo}. What are we working on?`
}

function checkProactive(builds: FullBuild[], navigate: ReturnType<typeof useNavigate>): ProactiveMsg[] {
  const msgs: ProactiveMsg[] = []
  let id = -1000

  // Condition A: expiring within 3 days, staging, unclaimed
  const expiring = builds.find(
    (b) => b.expires_at && daysUntil(b.expires_at) <= 3 && b.staging && !b.claimed_at
  )
  if (expiring) {
    const d = daysUntil(expiring.expires_at!)
    msgs.push({
      id: id--,
      text: `${expiring.app_name} expires in ${d} day${d === 1 ? '' : 's'}. Once it's gone, the deployment and URL are gone too. Claim it to move it to your own account permanently.`,
      ctaLabel: 'Claim now →',
      ctaAction: () => navigate(`/app/${expiring.id}/edit`),
    })
  }

  // Condition B: no update in 7+ days
  const stale = builds.find(
    (b) => b.updated_at && daysSince(b.updated_at) >= 7 && b.status !== 'error'
  )
  if (stale && !expiring) {
    const d = daysSince(stale.updated_at!)
    msgs.push({
      id: id--,
      text: `It's been ${d} days since ${stale.app_name} had an update. Momentum matters — even a small improvement ships faster than a big rewrite.`,
      ctaLabel: 'Open editor →',
      ctaAction: () => navigate(`/app/${stale.id}/edit`),
    })
  }

  // Condition C: visited edit page for any build (first time opening chat after that)
  const visitedBuild = builds.find(
    (b) => {
      try { return !!localStorage.getItem(`sovereign_edit_opened_${b.id}`) } catch { return false }
    }
  )
  if (visitedBuild && msgs.length === 0) {
    msgs.push({
      id: id--,
      text: `I noticed you were in the editor for ${visitedBuild.app_name} earlier. Did everything go smoothly?`,
    })
  }

  return msgs
}

const CHIPS = ['What can I build next?', "Something's broken", 'How does Visila work?']

// ── Panel ─────────────────────────────────────────────────────────────────────

function ChatPanel() {
  const { messages, isBusy, closeChat, sendMessage, setBuilds } = useChatStore()
  const navigate = useNavigate()

  const [input, setInput] = useState('')
  const [builds, setLocalBuilds] = useState<FullBuild[] | null>(null)
  const [executingId] = useState<number | null>(null)
  // Proactive messages live in local state — not in the store
  const [proactiveMsgs, setProactiveMsgs] = useState<ProactiveMsg[]>([])
  // Build pills shown after a select_app action
  const [selectingForMsg, setSelectingForMsg] = useState<ChatMessage | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loggedIn = !!getSession()

  // Fetch builds once on mount (if logged in)
  useEffect(() => {
    const session = getSession()
    if (!session) { setLocalBuilds([]); return }
    fetch(`/api/dashboard/builds?email=${encodeURIComponent(session.email)}`)
      .then((r) => (r.ok ? r.json() : { builds: [] }))
      .then((data: { builds?: FullBuild[] }) => {
        const b = data.builds ?? []
        setLocalBuilds(b)
        setBuilds(b)     // push into store for sendMessage context

        // Fire proactive messages once per session
        const alreadyShown = sessionStorage.getItem('sovereign_chat_proactive_shown')
        if (!alreadyShown && b.length > 0) {
          const proactive = checkProactive(b, navigate)
          if (proactive.length > 0) {
            // Set flag BEFORE adding messages — prevents double-fire in StrictMode
            // where two concurrent fetches can both read null before either sets the flag
            sessionStorage.setItem('sovereign_chat_proactive_shown', '1')
            setProactiveMsgs(proactive)
          }
        }
      })
      .catch(() => setLocalBuilds([]))
  }, [setBuilds, navigate])

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isBusy, proactiveMsgs])

  // Focus input on open
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const opener = deriveOpener(builds, loggedIn)

  const submit = useCallback(async () => {
    const text = input.trim()
    if (!text || isBusy) return
    setSelectingForMsg(null)
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    await sendMessage(text)
  }, [input, isBusy, sendMessage])

  // Handle "Do it →" — navigate to edit page with prefill
  const handleDoIt = useCallback((msg: ChatMessage) => {
    if (!msg.action || msg.actionDone) return
    const { type, editRequest, buildId } = msg.action

    if (type === 'edit' && buildId) {
      // Write prefill and navigate
      try {
        sessionStorage.setItem('sc_prefill', JSON.stringify({ buildId, text: editRequest }))
      } catch { /* storage unavailable */ }
      closeChat()
      navigate(`/app/${buildId}/edit`)
    } else if (type === 'select_app') {
      // Show build pills for user to pick
      setSelectingForMsg(msg)
    }
  }, [closeChat, navigate])

  // Handle build pill selection for select_app flow
  const handleSelectBuild = useCallback((build: FullBuild, msg: ChatMessage) => {
    if (!msg.action) return
    try {
      sessionStorage.setItem('sc_prefill', JSON.stringify({ buildId: build.id, text: msg.action.editRequest }))
    } catch { /* storage unavailable */ }
    setSelectingForMsg(null)
    closeChat()
    navigate(`/app/${build.id}/edit`)
  }, [closeChat, navigate])

  return (
    <div className="sc-panel" role="dialog" aria-label="Visila Chat">
      {/* Header */}
      <div className="sc-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="sc-avatar-lg">S</div>
          <div>
            <div style={{ font: '500 14px/1 DM Mono, Courier New, monospace', color: '#f2efe8' }}>
              Visila
            </div>
            <div style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#FF1F6E', marginTop: '3px' }}>
              online
            </div>
          </div>
        </div>
        <button
          className="sc-close-btn"
          onClick={closeChat}
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="sc-messages">
        {/* Opener */}
        <div className="sc-msg-sov">
          <div className="sc-avatar-sm">S</div>
          <div className="sc-bubble-sov">{opener}</div>
        </div>

        {/* Proactive messages — shown after opener, before user conversation */}
        {proactiveMsgs.map((pm) => (
          <div key={pm.id} className="sc-msg-sov">
            <div className="sc-avatar-sm">S</div>
            <div className="sc-bubble-sov">
              {pm.text}
              {pm.ctaLabel && pm.ctaAction && (
                <button
                  className="sc-do-it-btn"
                  onClick={() => { pm.ctaAction!(); closeChat() }}
                >
                  {pm.ctaLabel}
                </button>
              )}
            </div>
          </div>
        ))}

        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="sc-msg-user">{msg.text}</div>
          ) : (
            <div key={msg.id} className="sc-msg-sov">
              <div className="sc-avatar-sm">S</div>
              <div className="sc-bubble-sov">
                {msg.text}

                {/* Action button */}
                {(console.log('message action:', msg.action), null)}
                {msg.action && !msg.actionDone && msg.action.type === 'edit' && (
                  <button
                    className="sc-do-it-btn"
                    onClick={() => handleDoIt(msg)}
                    disabled={executingId === msg.id}
                  >
                    {executingId === msg.id
                      ? 'Applying…'
                      : (msg.action.label ?? `Do it → ${msg.action.appName ?? 'app'}`)}
                  </button>
                )}

                {/* select_app: show build pills */}
                {msg.action && !msg.actionDone && msg.action.type === 'select_app' && (
                  <div style={{ marginTop: 8 }}>
                    {selectingForMsg?.id === msg.id && builds && builds.length > 0
                      ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#8a8880', marginBottom: 2 }}>
                            {msg.action.label ?? 'Which app?'}
                          </div>
                          {builds.map((b) => (
                            <button
                              key={b.id}
                              className="sc-do-it-btn"
                              style={{ textAlign: 'left' }}
                              onClick={() => handleSelectBuild(b, msg)}
                            >
                              {b.app_name}
                            </button>
                          ))}
                        </div>
                      )
                      : (
                        <button
                          className="sc-do-it-btn"
                          onClick={() => handleDoIt(msg)}
                        >
                          {msg.action.label ?? 'Pick an app →'}
                        </button>
                      )
                    }
                  </div>
                )}

                {msg.action && msg.actionDone && (
                  <span className="sc-done-label">✓ Navigating to editor</span>
                )}
              </div>
            </div>
          )
        )}

        {isBusy && (
          <div className="sc-msg-sov">
            <div className="sc-avatar-sm">S</div>
            <div className="sc-bubble-sov">
              <div className="sc-typing">
                <div className="sc-dot" />
                <div className="sc-dot" />
                <div className="sc-dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="sc-input-area">
        {messages.length === 0 && proactiveMsgs.length === 0 && (
          <div className="sc-chips">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                className="sc-chip"
                onClick={() => { setInput(chip); inputRef.current?.focus() }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}
        <div className="sc-send-row">
          <textarea
            ref={inputRef}
            className="sc-textarea"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              const el = e.target
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 140) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() }
              if (e.key === 'Escape') closeChat()
            }}
            placeholder="Ask anything…"
            rows={1}
          />
          <button
            className="sc-send-btn"
            onClick={() => void submit()}
            disabled={isBusy || !input.trim()}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export function VisilaChat() {
  const { isOpen, openChat, closeChat } = useChatStore()
  const location = useLocation()
  // On the edit page, the Update button sits at the bottom of the chat panel on
  // mobile — raise the FAB above it so they never overlap.
  const onEditPage = /^\/app\/[^/]+\/edit/.test(location.pathname)

  return (
    <>
      <style>{`
        /* ── Floating button ───────────────────────────────────────────────── */
        .sc-fab {
          position: fixed; bottom: 24px; right: 24px; z-index: 800;
          width: 44px; height: 44px; border-radius: 50%;
          background: #0e0d0b; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .sc-fab:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(0,0,0,0.5); }
        .sc-fab-letter {
          font: 700 18px/1 DM Mono, Courier New, monospace;
          color: #FF1F6E;
        }

        /* ── Panel wrapper — desktop: bottom-right anchored ────────────────── */
        .sc-wrapper {
          position: fixed; bottom: 80px; right: 24px; z-index: 900;
          animation: scSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sc-panel {
          background: #0e0d0b;
          border: 0.5px solid #2a2925;
          border-radius: 16px; overflow: hidden;
          width: 380px; height: min(560px, calc(100vh - 120px));
          display: flex; flex-direction: column;
          box-shadow: 0 16px 48px rgba(0,0,0,0.6);
        }

        /* ── Header ────────────────────────────────────────────────────────── */
        .sc-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 16px 0; flex-shrink: 0;
        }
        .sc-avatar-lg {
          width: 28px; height: 28px; border-radius: 50%;
          background: #FF1F6E; color: #0e0d0b;
          font: 700 14px/28px DM Mono, Courier New, monospace;
          text-align: center; flex-shrink: 0;
        }
        .sc-close-btn {
          background: none; border: none; color: #6b6862;
          font-size: 18px; cursor: pointer; line-height: 1; padding: 4px;
          transition: color 0.12s;
        }
        .sc-close-btn:hover { color: #f2efe8; }

        /* ── Messages ──────────────────────────────────────────────────────── */
        .sc-messages {
          flex: 1; overflow-y: auto; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .sc-messages::-webkit-scrollbar { width: 3px; }
        .sc-messages::-webkit-scrollbar-track { background: transparent; }
        .sc-messages::-webkit-scrollbar-thumb { background: #3a3830; border-radius: 2px; }

        .sc-msg-user {
          align-self: flex-end; max-width: 82%;
          background: #FF1F6E; color: #0e0d0b;
          padding: 9px 13px;
          border-radius: 12px 12px 2px 12px;
          font: 13px/1.5 DM Mono, Courier New, monospace;
          word-break: break-word;
        }
        .sc-msg-sov {
          align-self: flex-start; max-width: 85%;
          display: flex; gap: 8px; align-items: flex-start;
        }
        .sc-avatar-sm {
          width: 20px; height: 20px; border-radius: 50%;
          background: #FF1F6E; color: #0e0d0b;
          font: 700 9px/20px DM Mono, Courier New, monospace;
          text-align: center; flex-shrink: 0;
        }
        .sc-bubble-sov {
          background: #1a1917; color: #c8c4bc;
          padding: 9px 13px;
          border-radius: 2px 12px 12px 12px;
          font: 13px/1.5 DM Mono, Courier New, monospace;
          word-break: break-word;
        }

        /* ── Do it button + done label ─────────────────────────────────────── */
        .sc-do-it-btn {
          display: block; margin-top: 8px;
          background: #FF1F6E; color: #0e0d0b; border: none; border-radius: 6px;
          font: 500 12px/1 DM Mono, Courier New, monospace;
          padding: 6px 12px; cursor: pointer;
          transition: opacity 0.12s;
        }
        .sc-do-it-btn:disabled { opacity: 0.6; cursor: default; }
        .sc-done-label {
          display: inline-block; margin-top: 8px;
          font: 11px/1 DM Mono, Courier New, monospace; color: #FF1F6E;
        }

        /* ── Typing indicator ──────────────────────────────────────────────── */
        .sc-typing { display: flex; gap: 4px; align-items: center; padding: 2px 0; }
        .sc-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #6b6862;
          animation: scDotBounce 1.2s ease-in-out infinite;
        }
        .sc-dot:nth-child(2) { animation-delay: 0.2s; }
        .sc-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes scDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }

        /* ── Input area ────────────────────────────────────────────────────── */
        .sc-input-area {
          flex-shrink: 0; padding: 8px 16px 14px;
          border-top: 0.5px solid #2a2925;
        }
        .sc-chips { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 8px; }
        .sc-chip {
          font: 11px/1 DM Mono, Courier New, monospace; color: #f2efe8;
          background: #1a1917; border: 0.5px solid #3a3830;
          border-radius: 100px; padding: 4px 9px; cursor: pointer;
          transition: background 0.12s;
        }
        .sc-chip:hover { background: #2a2925; }
        .sc-send-row { display: flex; gap: 8px; align-items: flex-end; }
        .sc-textarea {
          flex: 1; background: #1a1917; color: #f2efe8;
          border: 0.5px solid #3a3830; border-radius: 8px;
          padding: 9px 11px;
          font: 16px/1.5 DM Mono, Courier New, monospace;
          resize: none; min-height: 38px; max-height: 140px;
          overflow-y: auto; outline: none;
        }
        .sc-textarea::placeholder { color: #6b6862; }
        .sc-textarea:focus { border-color: #FF1F6E; }
        .sc-send-btn {
          width: 36px; height: 36px; border-radius: 8px;
          background: #FF1F6E; color: #0e0d0b;
          border: none; cursor: pointer; font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: opacity 0.12s;
        }
        .sc-send-btn:disabled { opacity: 0.4; cursor: default; }

        /* ── Animations ────────────────────────────────────────────────────── */
        @keyframes scSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Mobile — full screen, slides up ──────────────────────────────── */
        @media (max-width: 640px) {
          .sc-wrapper {
            position: fixed; inset: 0; bottom: 0; right: 0;
            animation: scMobileSlideUp 0.32s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .sc-panel {
            width: 100%; height: 100%; border-radius: 0; border: none;
          }
          .sc-fab { bottom: 20px; right: 20px; }
          .sc-fab.sc-fab-edit { bottom: 100px; right: 16px; z-index: 850; }
        }
        @keyframes scMobileSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      {/* Floating action button — always rendered */}
      <button
        className={onEditPage ? 'sc-fab sc-fab-edit' : 'sc-fab'}
        onClick={() => (isOpen ? closeChat() : openChat())}
        aria-label={isOpen ? 'Close Visila Chat' : 'Open Visila Chat'}
      >
        <span className="sc-fab-letter">S</span>
      </button>

      {/* Chat panel — portal-style: fixed positioning handles layering */}
      {isOpen && (
        <div className="sc-wrapper">
          <ChatPanel />
        </div>
      )}
    </>
  )
}
