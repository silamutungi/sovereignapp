# Sovereign Patterns — Proven Solutions Library

Patterns confirmed working in production. Every agent should prefer these over inventing new approaches.

---

## Rate Limiting Pattern

**When to use:** First check in every Vercel API handler.

```typescript
// api/example.ts
import { checkRateLimit } from './_rateLimit.js'

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ip = req.headers['x-forwarded-for'] || 'unknown'
  const rl = checkRateLimit(ip, 20, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
    return res.status(429).json({ error: 'Too many requests' })
  }

  // ... handler logic
}
```

**Why this works:** In-memory rate limiting per Vercel instance. Effective against burst abuse. retryAfter from checkRateLimit ensures correct HTTP compliance.

---

## SSE Streaming Pattern

**When to use:** Any API route that calls Claude API with max_tokens > 4096. Prevents Vercel 504 on long-running AI calls.

```typescript
// api/generate.ts
export const maxDuration = 300

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    // Stream progress events as Claude generates
    sendEvent({ type: 'progress', message: 'Generating your app...' })

    const result = await anthropic.messages.create({
      // ...config
      stream: false, // tool_use doesn't support streaming
    })

    sendEvent({ type: 'done', spec: result })
    res.end()
  } catch (err) {
    sendEvent({ type: 'error', message: err.message })
    res.end()
  }
}
```

**Client-side:**
```typescript
const response = await fetch('/api/generate', { method: 'POST', body: ... })
if (response.headers.get('content-type')?.includes('text/event-stream')) {
  const reader = response.body!.getReader()
  // read SSE events
} else {
  // fallback for pre-flight errors (429, 400)
  const data = await response.json()
}
```

**Why this works:** Keeps HTTP connection alive for up to maxDuration seconds. Client detects SSE vs JSON by content-type.

---

## Magic Link Auth Pattern

**When to use:** Passwordless authentication for dashboard access.

```typescript
// Token generation (server-side)
import { randomBytes } from 'crypto'
const token = randomBytes(32).toString('hex') // 64-char hex, 256-bit entropy

// Storage
await supabase.from('magic_links').insert({
  email,
  token,
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  used: false,
})

// Verification
const { data } = await supabase.from('magic_links')
  .select('*')
  .eq('token', token)
  .eq('used', false)
  .gte('expires_at', new Date().toISOString())
  .single()

// Consume
await supabase.from('magic_links').update({ used: true }).eq('id', data.id)

// Session (sessionStorage only — never localStorage)
sessionStorage.setItem('sovereign_user', JSON.stringify({ email: data.email }))
```

**Why this works:** One-time use enforced server-side. 24h expiry. 256-bit entropy token. sessionStorage prevents cross-tab session sharing.

---

## Supabase RLS Policy Pattern

**When to use:** Every Supabase table that stores user data.

```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own"
ON your_table FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own"
ON your_table FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own"
ON your_table FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own"
ON your_table FOR DELETE
USING (auth.uid() = user_id);
```

**Why this works:** Explicit policies for every operation. Never use USING(true) for user data. Service role key bypasses RLS — all server-side API routes use service role.

---

## React Component Fade-In Pattern

**When to use:** Key elements on page load and scroll-into-view.

```typescript
// useInView hook
import { useRef, useState, useEffect, type RefObject } from 'react'

export function useInView(threshold = 0.1): { ref: RefObject<HTMLDivElement>, visible: boolean } {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect() // fire once
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, visible }
}

// Usage
function HeroSection() {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      Content
    </div>
  )
}
```

**Why this works:** IntersectionObserver is performant, fires once, disconnects immediately. Avoids re-animating on every scroll.

---

## Error Boundary Pattern

**When to use:** Wrap every major page section.

```typescript
import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error.message)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Something went wrong. <button onClick={() => this.setState({ hasError: false })}>Try again</button></p>
        </div>
      )
    }
    return this.props.children
  }
}
```

**Why this works:** Catches render errors, prevents blank screens, provides recovery action.

---

## Confidence Scoring Pattern

**When to use:** Any agent that evaluates code quality.

```javascript
function scoreFile(filePath, checks) {
  const content = readFileSync(filePath, 'utf-8')
  let passed = 0
  const issues = []

  for (const check of checks) {
    if (check.pattern.test(content)) {
      passed++
    } else {
      issues.push({ severity: check.severity, message: check.message, file: filePath })
    }
  }

  return {
    score: Math.round((passed / checks.length) * 100),
    issues,
    passed: issues.filter(i => i.severity === 'critical').length === 0,
  }
}
```

---

## Prompt Caching Pattern (Anthropic SDK 0.78+)

**When to use:** Any API call with a large, stable system prompt.

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 16000,
  system: [
    {
      type: 'text',
      text: SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' }, // SDK 0.78 — no @ts-expect-error needed
    }
  ],
  messages: [{ role: 'user', content: userMessage }],
})
```

**Why this works:** SDK 0.78 types system as `string | Array<TextBlockParam>` and TextBlockParam includes cache_control. No cast or workaround needed.

---

*Patterns are added from CLAUDE.md lessons and production experience. Usage count tracked by Brain API.*
