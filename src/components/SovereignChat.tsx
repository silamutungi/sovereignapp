// src/components/SovereignChat.tsx
//
// Floating Sovereign Chat — available on every page.
// Renders a fixed ↗ button (bottom-right) and a chat panel that opens above it.
//
// Context-aware opener:
//   logged-in + builds   → "You have X apps. [latest] deployed [time]. What are we working on?"
//   logged-in no builds  → "You haven't built anything yet. What's your idea?"
//   not logged in        → "What will you build? I can help you figure out where to start."

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useChatStore,
  type ActiveApp,
  type ChatMessage,
} from '../store/chatStore'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function deriveOpener(builds: ActiveApp[] | null, loggedIn: boolean): string {
  if (!loggedIn) {
    return "What will you build? I can help you figure out where to start."
  }
  if (!builds || builds.length === 0) {
    return "You haven't built anything yet. What's your idea?"
  }
  const latest = builds[0]
  const timeAgo = latest.created_at ? ` deployed ${relativeDate(latest.created_at)}` : ''
  const count = builds.length
  return `You have ${count} app${count > 1 ? 's' : ''}. ${latest.app_name}${timeAgo}. What are we working on?`
}

const CHIPS = ['What can I build next?', "Something's broken", 'How does Sovereign work?']

// ── Panel ─────────────────────────────────────────────────────────────────────

function ChatPanel() {
  const { messages, isBusy, closeChat, sendMessage, executeEditAction, setBuilds } = useChatStore()

  const [input, setInput] = useState('')
  const [builds, setLocalBuilds] = useState<ActiveApp[] | null>(null)
  const [executingId, setExecutingId] = useState<number | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loggedIn = !!getSession()

  // Fetch builds once on mount (if logged in)
  useEffect(() => {
    const session = getSession()
    if (!session) { setLocalBuilds([]); return }
    fetch(`/api/dashboard/builds?email=${encodeURIComponent(session.email)}`)
      .then((r) => (r.ok ? r.json() : { builds: [] }))
      .then((data: { builds?: ActiveApp[] }) => {
        const b = data.builds ?? []
        setLocalBuilds(b)
        setBuilds(b)     // also push into store for sendMessage context
      })
      .catch(() => setLocalBuilds([]))
  }, [setBuilds])

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isBusy])

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
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    await sendMessage(text)
  }, [input, isBusy, sendMessage])

  const handleEditAction = useCallback(async (msg: ChatMessage) => {
    if (!msg.action || msg.actionDone || executingId === msg.id) return
    setExecutingId(msg.id)
    await executeEditAction(msg)
    setExecutingId(null)
  }, [executeEditAction, executingId])

  return (
    <div className="sc-panel" role="dialog" aria-label="Sovereign Chat">
      {/* Header */}
      <div className="sc-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="sc-avatar-lg">S</div>
          <div>
            <div style={{ font: '500 14px/1 DM Mono, Courier New, monospace', color: '#f2efe8' }}>
              Sovereign
            </div>
            <div style={{ font: '11px/1 DM Mono, Courier New, monospace', color: '#8ab800', marginTop: '3px' }}>
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
        {/* Opener — shown only before any user messages */}
        <div className="sc-msg-sov">
          <div className="sc-avatar-sm">S</div>
          <div className="sc-bubble-sov">{opener}</div>
        </div>

        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="sc-msg-user">{msg.text}</div>
          ) : (
            <div key={msg.id} className="sc-msg-sov">
              <div className="sc-avatar-sm">S</div>
              <div className="sc-bubble-sov">
                {msg.text}
                {msg.action && !msg.actionDone && (
                  <button
                    className="sc-do-it-btn"
                    onClick={() => void handleEditAction(msg)}
                    disabled={executingId === msg.id}
                  >
                    {executingId === msg.id ? 'Applying…' : `Do it → ${msg.action.appName}`}
                  </button>
                )}
                {msg.action && msg.actionDone && (
                  <span className="sc-done-label">✓ Applied</span>
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

export function SovereignChat() {
  const { isOpen, openChat, closeChat } = useChatStore()

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
          color: #8ab800;
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
          width: 380px; height: 560px;
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
          background: #8ab800; color: #0e0d0b;
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
          background: #8ab800; color: #0e0d0b;
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
          background: #8ab800; color: #0e0d0b;
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
          background: #8ab800; color: #0e0d0b; border: none; border-radius: 6px;
          font: 500 12px/1 DM Mono, Courier New, monospace;
          padding: 6px 12px; cursor: pointer;
          transition: opacity 0.12s;
        }
        .sc-do-it-btn:disabled { opacity: 0.6; cursor: default; }
        .sc-done-label {
          display: inline-block; margin-top: 8px;
          font: 11px/1 DM Mono, Courier New, monospace; color: #8ab800;
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
        .sc-textarea:focus { border-color: #8ab800; }
        .sc-send-btn {
          width: 36px; height: 36px; border-radius: 8px;
          background: #8ab800; color: #0e0d0b;
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
        }
        @keyframes scMobileSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      {/* Floating action button — always rendered */}
      <button
        className="sc-fab"
        onClick={() => (isOpen ? closeChat() : openChat())}
        aria-label={isOpen ? 'Close Sovereign Chat' : 'Open Sovereign Chat'}
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
