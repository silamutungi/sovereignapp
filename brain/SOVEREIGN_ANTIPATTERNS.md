# Sovereign Antipatterns — Never Do These

Each antipattern here caused a real production failure. The fix is documented in CLAUDE.md.
Every agent checks for these before shipping.

---

## url.parse() — Deprecated and Dangerous

**Never do this:**
```javascript
const parsed = url.parse(req.url)
const param = parsed.query.id
```

**Why it fails:** url.parse() is deprecated in Node.js. It has known security issues with URL parsing edge cases and will be removed in a future Node version.

**Do this instead:**
```javascript
const { searchParams } = new URL(req.url, 'https://base.invalid')
const param = searchParams.get('id')
```

---

## React.* Namespace Type References

**Never do this:**
```typescript
function handleSubmit(e: React.FormEvent) {}
function render(): React.ReactNode {}
type Props = { children: React.ReactNode }
```

**Why it fails:** With `"jsx":"react-jsx"`, React is not imported into scope. tsc exits non-zero with "Cannot find namespace 'React'" — every file with this pattern breaks the entire build.

**Do this instead:**
```typescript
import { type FormEvent, type ReactNode } from 'react'
function handleSubmit(e: FormEvent) {}
function render(): ReactNode {}
type Props = { children: ReactNode }
```

---

## Missing .js Extensions on Relative Imports in api/

**Never do this:**
```typescript
// api/run-build.ts
import { checkRateLimit } from './_rateLimit'
import { sendMagicLink } from '../_sendMagicLink'
```

**Why it fails:** Node ESM requires explicit .js extensions on every relative import. `moduleResolution: bundler` in tsconfig masks this locally — it only fails in production on Vercel. Every serverless function throws ERR_MODULE_NOT_FOUND at cold-start. The entire API is down.

**Do this instead:**
```typescript
import { checkRateLimit } from './_rateLimit.js'
import { sendMagicLink } from '../_sendMagicLink.js'
```

Verify with: `grep -rn "from '\." api/ --include="*.ts" | grep -v "\.js'"` — must return zero results.

---

## engines Field in package.json

**Never do this:**
```json
{
  "engines": { "node": ">=20.0.0" }
}
```

**Why it fails:** The engines field causes Vercel build failures. Node version is controlled via Vercel project settings only.

**Do this instead:** Remove the engines field entirely. Strip it programmatically before pushing to GitHub.

---

## nodeVersion in Vercel API Payload

**Never do this:**
```javascript
await fetch('https://api.vercel.com/v9/projects', {
  body: JSON.stringify({ name: projectName, nodeVersion: '20.x', framework: 'vite' })
})
```

**Why it fails:** Vercel rejects nodeVersion in project creation with HTTP 400. The project is not created and the entire build pipeline fails.

**Do this instead:** Remove nodeVersion from the payload entirely.

---

## Localhost Script Tags in Generated HTML

**Never do this:**
```html
<!-- In generated index.html pushed to GitHub -->
<script type="module" src="http://localhost:5173/@vite/client"></script>
```

**Why it fails:** Vite dev server injects these during development. They must be stripped before pushing to GitHub or Vercel fails to find them and the app breaks.

**Do this instead:** Sanitize HTML before pushing — strip all `<script src="http://localhost...">` and `<link href="http://localhost...">` tags.

---

## Curly Quotes in String Literals

**Never do this:**
```typescript
setError('Those credentials didn't work.')
//                            ^ curly apostrophe terminates the string
```

**Why it fails:** Claude uses Unicode curly apostrophes (') and smart quotes (" ") in prose. Inside a JS/TS string literal delimited with the same quote character, they terminate the string early. This causes 9+ tsc errors on the same line and cascading parse failures.

**Do this instead:**
```typescript
setError("Those credentials didn't work.")  // double quotes
setError(`Those credentials didn't work.`)  // template literal
```

---

## SPA Rewrite Rule That Intercepts API Routes

**Never do this (vercel.json):**
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Why it fails:** `/(.*)`  matches ALL paths including `/api/health`, `/api/generate`, etc. Serverless functions are never reached — the SPA catches everything.

**Do this instead:**
```json
{
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

---

## Polling Without Timeout

**Never do this:**
```typescript
// Build status polling — no timeout
const poll = setInterval(async () => {
  const status = await checkBuildStatus(buildId)
  if (status === 'complete') clearInterval(poll)
}, 5000)
```

**Why it fails:** If the build errors or the API returns 5xx, the polling never stops. After 120 requests (10 minutes) the rate limit is hit and the user sees a generic error with no recovery path.

**Do this instead:**
```typescript
let attempts = 0
const MAX_ATTEMPTS = 60 // 5 minutes at 5s interval
const poll = setInterval(async () => {
  attempts++
  if (attempts >= MAX_ATTEMPTS) {
    clearInterval(poll)
    setError('Build timed out. Please try again.')
    return
  }
  const status = await checkBuildStatus(buildId)
  if (status === 'complete' || status === 'error') clearInterval(poll)
}, 5000)
```

---

## Logging Env Var Values

**Never do this:**
```bash
echo $SUPABASE_SERVICE_ROLE_KEY
console.log('Key:', process.env.SUPABASE_SERVICE_ROLE_KEY)
```

**Why it fails:** The SUPABASE_SERVICE_ROLE_KEY bypasses all RLS on your Supabase database. Exposing it — even in logs — is a critical security incident requiring immediate key rotation.

**Do this instead:**
```bash
echo "Set: ${#SUPABASE_SERVICE_ROLE_KEY} chars"  # prints length only
```

---

## localStorage for Auth State

**Never do this:**
```javascript
localStorage.setItem('auth_user', JSON.stringify(user))
```

**Why it fails:** localStorage persists across tabs and browser restarts. If the user shares a device, auth state leaks to other users.

**Do this instead:**
```javascript
sessionStorage.setItem('sovereign_user', JSON.stringify(user))
```

---

## Supabase Migration Files That Are Never Run

**Never do this:** Write a migration file in `supabase/migrations/` and assume it has been applied.

**Why it fails:** Supabase does NOT auto-execute migration files. They must be manually run in the Supabase SQL Editor. The silent failure: queries against non-existent columns return error code 42703 (column does not exist), which surfaces as a 500 or 502 in the API.

**Do this instead:** After writing any migration file, immediately run it in the SQL Editor and verify with:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'your_table' AND column_name = 'your_column';
```
Must return 1 row. Zero rows = column missing = every query using it will fail.

---

*Every antipattern here maps to a real production incident. Date of original failure documented in CLAUDE.md.*
