// src/store/chatStore.tsx
//
// Global chat state for Sovereign Chat.
//
// Architecture note: this store is designed so the EditPanel can eventually
// be merged into the global chat with a config change:
//   openEditDrawer(build)  →  openChat({ activeApp: build })
//
// When activeApp is set, sendMessage routes to scoped mode (app context +
// edit actions). When null, routes to global mode (general assistant).
// All API calls funnel through sendMessage / executeEditAction so routing
// logic lives in one place.

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'

// ── Shared types (re-exported so consumers don't import from api/) ────────────

export interface ActiveApp {
  id: string
  app_name: string
  deploy_url: string | null
  repo_url: string | null
  idea: string
  created_at?: string
}

export interface ChatEditAction {
  type: 'edit'
  editRequest: string
  appName: string
  buildId: string
}

export interface ChatMessage {
  id: number
  role: 'user' | 'sovereign'
  text: string
  action?: ChatEditAction   // present when Claude suggests an edit
  actionDone?: boolean      // true after user confirms the edit
}

// ── State & actions ───────────────────────────────────────────────────────────

interface State {
  messages: ChatMessage[]
  isOpen: boolean
  activeApp: ActiveApp | null
  builds: ActiveApp[]       // known apps — used as context in global mode
  isBusy: boolean
}

type Action =
  | { type: 'OPEN'; activeApp?: ActiveApp }
  | { type: 'CLOSE' }
  | { type: 'SET_BUILDS'; builds: ActiveApp[] }
  | { type: 'ADD_MSG'; msg: ChatMessage }
  | { type: 'MARK_ACTION_DONE'; id: number }
  | { type: 'SET_BUSY'; busy: boolean }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'OPEN':
      return { ...state, isOpen: true, activeApp: action.activeApp ?? null }
    case 'CLOSE':
      return { ...state, isOpen: false }
    case 'SET_BUILDS':
      return { ...state, builds: action.builds }
    case 'ADD_MSG':
      return { ...state, messages: [...state.messages, action.msg] }
    case 'MARK_ACTION_DONE':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, actionDone: true } : m
        ),
      }
    case 'SET_BUSY':
      return { ...state, isBusy: action.busy }
    default:
      return state
  }
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface ChatStore extends State {
  openChat: (opts?: { activeApp?: ActiveApp }) => void
  closeChat: () => void
  setBuilds: (builds: ActiveApp[]) => void
  sendMessage: (content: string) => Promise<void>
  executeEditAction: (msg: ChatMessage) => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────

const ChatContext = createContext<ChatStore | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    messages: [],
    isOpen: false,
    activeApp: null,
    builds: [],
    isBusy: false,
  })

  // Always-current ref — avoids stale closures in async callbacks
  const ref = useRef(state)
  ref.current = state

  const counter = useRef(0)

  function push(msg: Omit<ChatMessage, 'id'>) {
    dispatch({ type: 'ADD_MSG', msg: { ...msg, id: ++counter.current } })
  }

  const openChat = useCallback((opts?: { activeApp?: ActiveApp }) => {
    dispatch({ type: 'OPEN', activeApp: opts?.activeApp })
  }, [])

  const closeChat = useCallback(() => {
    dispatch({ type: 'CLOSE' })
  }, [])

  const setBuilds = useCallback((builds: ActiveApp[]) => {
    dispatch({ type: 'SET_BUILDS', builds })
  }, [])

  // Single entry point for all chat API calls.
  // Reads current state from ref to avoid stale closures.
  const sendMessage = useCallback(async (content: string) => {
    const { isBusy, activeApp, builds } = ref.current
    if (isBusy) return

    push({ role: 'user', text: content })
    dispatch({ type: 'SET_BUSY', busy: true })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          context: {
            activeApp: activeApp ?? undefined,
            builds: builds.length > 0 ? builds : undefined,
          },
        }),
      })

      const data = (await res.json()) as {
        reply?: string
        action?: ChatEditAction | null
        error?: string
      }

      if (!res.ok || !data.reply) {
        push({ role: 'sovereign', text: data.error ?? 'Something went wrong.' })
      } else {
        push({
          role: 'sovereign',
          text: data.reply,
          action: data.action ?? undefined,
        })
      }
    } catch {
      push({ role: 'sovereign', text: 'Network error. Please try again.' })
    } finally {
      dispatch({ type: 'SET_BUSY', busy: false })
    }
  }, []) // intentionally empty — reads from ref

  // Execute a confirmed edit action (user clicked "Do it →")
  const executeEditAction = useCallback(async (msg: ChatMessage) => {
    if (!msg.action || msg.actionDone) return
    dispatch({ type: 'MARK_ACTION_DONE', id: msg.id })
    dispatch({ type: 'SET_BUSY', busy: true })

    // Find build to get repo_url
    const build = ref.current.builds.find((b) => b.id === msg.action!.buildId)
      ?? ref.current.activeApp

    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildId: msg.action.buildId,
          appName: msg.action.appName,
          repoUrl: build?.repo_url ?? '',
          editRequest: msg.action.editRequest,
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        push({ role: 'sovereign', text: data.error ?? 'Could not apply the change.' })
      } else {
        push({ role: 'sovereign', text: 'Done — your change is deploying now.' })
      }
    } catch {
      push({ role: 'sovereign', text: 'Network error. Could not apply the change.' })
    } finally {
      dispatch({ type: 'SET_BUSY', busy: false })
    }
  }, []) // intentionally empty — reads from ref

  return (
    <ChatContext.Provider
      value={{ ...state, openChat, closeChat, setBuilds, sendMessage, executeEditAction }}
    >
      {children}
    </ChatContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChatStore(): ChatStore {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatStore must be used within <ChatProvider>')
  return ctx
}
