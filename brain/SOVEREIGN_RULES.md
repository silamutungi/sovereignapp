# Sovereign Rules — Read Before Writing Any Code

Every agent reads this file before executing. These rules are non-negotiable.
They exist because each one maps to a real production failure documented in CLAUDE.md.

---

## The Quality Bar — The Jony Ive Standard

Every generated app must pass this test before shipping:
**"Would this feel at home in an Apple keynote?"**

Not a wireframe. Not a starter kit. A working, beautiful app that a founder can share proudly on launch day.

---

## TypeScript Rules

**1. Never use React.* namespace for types.**
Wrong: `React.FormEvent`, `React.ReactNode`, `React.ChangeEvent`
Right: `import { type FormEvent, type ReactNode } from 'react'`
Why: with `"jsx":"react-jsx"`, React is not in scope. Namespace types fail tsc with "Cannot find namespace 'React'".

**2. All relative imports in api/ must end in .js.**
Wrong: `import { x } from './_rateLimit'`
Right: `import { x } from './_rateLimit.js'`
Why: Node ESM requires explicit extensions. Missing extensions cause ERR_MODULE_NOT_FOUND at cold-start. The entire API goes down.

**3. No path aliases.**
Wrong: `import Foo from '@/components/Foo'`
Right: `import Foo from '../components/Foo'`
Why: vite.config.ts does not define aliases. tsc fails with "Cannot find module '@/components/Foo'".

**4. No curly/smart quotes inside string literals.**
Wrong: `setError('Those credentials didn't work.')`  — the ' terminates the string
Right: `setError("Those credentials didn't work.")`  — double quotes work
Why: Claude uses Unicode curly quotes in prose. Inside JS/TS string literals they terminate the string and cause cascading tsc failures.

**5. Every component must have a default export.**
Every React component file must end with `export default ComponentName`.

**6. No unused imports or variables.**
tsc is run before Vite in production builds. noUnusedLocals and noUnusedParameters cause build failures.

**7. React Router v6 syntax only.**
Right: `useNavigate()`, `<Routes>`, `<Route>`
Wrong: `useHistory()`, `<Switch>`, old Route patterns

---

## Security Rules — The CVE-2025-48757 Standard

Background: A competing platform had 170+ apps breached because of missing Supabase RLS.
18,000+ users had names, emails, home addresses, payment records stolen. Sovereign must never generate this class of vulnerability.

**1. RLS on every Supabase table with explicit policies.**
Every table: `ALTER TABLE t ENABLE ROW LEVEL SECURITY` + explicit SELECT/INSERT/UPDATE/DELETE policies.
Never use `USING(true)` unless the table is intentionally public.
Enabling RLS without policies locks the table completely — both are required.

**2. Never log env var values.**
Use `echo "Set: ${#VAR} chars"` to verify length. Never print the value.
The SUPABASE_SERVICE_ROLE_KEY bypasses all RLS — exposing it is a critical incident.

**3. Rate limiting on every public API route.**
Use `checkRateLimit` from `./_rateLimit.js` as the FIRST check in every handler.
Include `Retry-After` header on every 429 response.

**4. Server-side input validation on every endpoint.**
Never trust req.body without validation. Validate type, length, and format.

**5. No secrets in client-side code.**
VITE_SUPABASE_ANON_KEY is public (by design). SUPABASE_SERVICE_ROLE_KEY must never appear in any client bundle.

**6. CSP must include connect-src.**
Default-src fallback blocks all XHR/fetch. Add: `connect-src 'self' https://*.supabase.co wss://*.supabase.co`

---

## API Route Rules

**1. .js extension on all relative imports (see TypeScript Rules #2)**

**2. Rate limiting is the first check.**
```js
const rl = checkRateLimit(req.headers['x-forwarded-for'] || 'unknown', 20, 60 * 60 * 1000)
if (!rl.allowed) {
  res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
  return res.status(429).json({ error: 'Too many requests' })
}
```

**3. export const config for body parser.**
For routes accepting large bodies: `export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }`

**4. Catch and log with constructor.name.**
```js
} catch (err) {
  console.error('[route] failed:', err.constructor.name, err.message)
  res.status(500).json({ error: 'Internal error' })
}
```

**5. export const config must come after all imports.**
Some Vercel runtimes fail to pick up config when placed between imports.

---

## Generated App Rules — The 19-File Standard

Every generated app must include exactly these files:
1. package.json (vite ^5, react, react-dom, react-router-dom, typescript — NO engines field)
2. index.html (no localhost script/link tags)
3. vite.config.ts (minimal, outDir: dist)
4. tsconfig.json
5. tsconfig.node.json
6. tailwind.config.js
7. postcss.config.js
8. src/vite-env.d.ts (`/// <reference types="vite/client" />`)
9. src/index.css
10. src/main.tsx
11. src/App.tsx
12. src/lib/supabase.ts
13. src/types/index.ts
14. src/pages/Home.tsx
15. src/pages/Login.tsx
16. src/pages/Signup.tsx
17. src/pages/Dashboard.tsx
18. src/components/Navbar.tsx
19. src/components/ProtectedRoute.tsx

**No engines field in package.json.**
The engines field causes Vercel build failures. Strip it programmatically.

**vercel.json SPA rewrite must exclude /api/ paths.**
Wrong: `"source": "/(.*)"` — intercepts API routes
Right: `"source": "/((?!api/).*)"` — excludes API

**CSP must include connect-src (see Security Rules #6)**

---

## Quality Gate

Before any agent marks output complete:

### Build
- [ ] npm run build exits 0 (or simulated equivalent)
- [ ] No TypeScript errors
- [ ] No console errors on page load

### Design
- [ ] Every page works at 375px (mobile-first)
- [ ] WCAG AA contrast: brightness formula applied
  `brightness = (R*299 + G*587 + B*114) / 1000`
  `> 128 → use #1a1a1a text; ≤ 128 → use #ffffff text`

### Engineering
- [ ] Loading states on every async operation
- [ ] Error states with recovery actions
- [ ] Empty states with helpful copy and primary action

### Content
- [ ] No lorem ipsum
- [ ] All CTAs tell user exactly what happens next
- [ ] Error messages are human, not technical

---

## Brain Integration Rules

Every agent MUST:
1. Call `recordLesson()` on completion for any unexpected behavior
2. Call `recordPattern()` for any successful reusable approach
3. Load relevant lessons from Brain before starting work
4. Never repeat a lesson that already exists in Brain with build_count >= 3

---

*Last updated: 2026-03-24. Every rule here maps to a real production failure.*
