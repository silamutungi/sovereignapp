-- api/migrations/seed-lessons.sql
--
-- Seed the lessons table with every hard-won lesson documented in CLAUDE.md.
-- Run AFTER create-lessons-table.sql.
-- Source = 'founder_note' for all entries here.
-- applied_automatically = true where the fix is already enforced in code.

-- ── Accessibility & Contrast ───────────────────────────────────────────────────

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  'Generated app color contrast fails on buttons. Mid-tone colors (medium purple, blue, green) fail 4.5:1 contrast on white backgrounds when used as text or outline borders.',
  'Darken primaryColor by 30% for any text/outline use on light backgrounds. Full primaryColor is only used for filled button backgrounds with white or black text. Enforced in generation system prompt.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  'Descriptive contrast rules in system prompt are not followed reliably — Claude picks colors that look plausible but fail WCAG AA.',
  'Use an explicit brightness formula instead of guidelines: brightness = (R*299 + G*587 + B*114) / 1000. >128 = LIGHT → use #1a1a1a text. ≤128 = DARK → use #ffffff text. Outline buttons: darken primaryColor by ×0.65 on each RGB channel. Four worked examples added to prompt.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  '--text-dim (#6b6862) used on dark backgrounds fails WCAG AA completely. Wrong assumption that muted text tokens can be used anywhere.',
  'Dark bg secondary text = #c8c4bc (11:1 contrast on ink). Paper bg secondary text = #6b6862 (4.5:1 on paper). Never use #6b6862 on any dark section.',
  true
);

-- ── Deployment & Build ────────────────────────────────────────────────────────

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'deployment',
  'founder_note',
  '502 on api/ serverless functions caused by missing .js extension on relative imports. moduleResolution:bundler masks this locally but Node ESM requires explicit extensions.',
  'Every relative import in api/ must end with .js (e.g. import x from ''./_rateLimit.js''). npm package imports do NOT get .js. Verify with: grep -rn "from ''\\." api/ --include="*.ts" | grep -v "\\.js''" — must return zero results before every push.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'deployment',
  'founder_note',
  'nodeVersion in POST /v9/projects payload causes 400 from Vercel API. engines field in package.json causes Vercel build failures.',
  'Remove both. Node version is controlled via Vercel project settings only. run-build.ts programmatically strips engines from generated package.json via JSON.parse/delete/stringify.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  'Generated repos only had 2 files (index.html + vercel.json). Vercel framework:vite + npm run build requires package.json or exits with error code 1 immediately.',
  'Every generated repo must push exactly these 8 files in one commit: package.json, index.html, vite.config.js, .gitignore, README.md, vercel.json, CLAUDE.md, .env.example.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'deployment',
  'founder_note',
  'When Vercel deployment reaches ERROR state, only generic "Vercel deployment ended with state: ERROR" was surfaced. Real error was discarded.',
  'Call GET /v2/deployments/{uid}/events and extract the last 5 error/stderr lines. Save the actual build failure reason to builds.error in Supabase.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'stack',
  'founder_note',
  'url.parse() is deprecated and removed in Node 22+. It was used in api/ routes for query string parsing.',
  'Use WHATWG URL API exclusively: new URL(string, base) + searchParams.get(''param''). All instances of url.parse() confirmed absent.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'stack',
  'founder_note',
  'Server utility (sendMagicLink) placed in src/lib/. src/ is compiled by Vite with tsconfig.app.json — no Node types, no process.',
  'All server-only utilities must live in api/ with underscore prefix (e.g. api/_sendMagicLink.ts). Never put server code in src/lib/.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'stack',
  'founder_note',
  '@vercel/node is not in devDependencies. Importing VercelRequest/VercelResponse causes build failures.',
  'Use eslint-disable-next-line @typescript-eslint/no-explicit-any and declare req: any, res: any in all api/ route handlers. Follow the existing pattern.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'stack',
  'founder_note',
  'New routes added to App.tsx instead of main.tsx. BrowserRouter + Routes live in src/main.tsx.',
  'New routes go in src/main.tsx alongside /building and /dashboard. Never modify App.tsx for routing.',
  false
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'stack',
  'founder_note',
  'Auth state stored in localStorage. localStorage persists across tabs and browser restarts — unsafe for auth tokens.',
  'Always use sessionStorage for auth state on Sovereign (sessionStorage.setItem(''sovereign_user'', ...)). Never use localStorage for auth.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'stack',
  'founder_note',
  'run-build.ts had no rate limiting despite triggering heavy provisioning (GitHub repo, Vercel project, Claude generation).',
  'Added IP-based rate limit (10/hr) as the first check in the handler, after the method check. Import checkRateLimit from ./_rateLimit.js.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'stack',
  'founder_note',
  'api/generate.ts only had per-email rate limiting. Anonymous callers without an email could abuse the endpoint.',
  'IP rate limit (20/hr) added as the very first check in the handler, before the email rate limit check.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'deployment',
  'founder_note',
  'SPA catch-all rewrite rule /(.*) in vercel.json intercepts /api/ routes, breaking all serverless functions.',
  'Use /((?!api/).*) to exclude the api/ prefix. Updated in vercel.json template in buildStaticFiles() in run-build.ts.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'stack',
  'founder_note',
  'Generation system prompt was duplicated across api/generate.ts and server/generate.ts. Two copies always diverge.',
  'Extracted SYSTEM_PROMPT to api/_systemPrompt.ts (exported const). Both generate files import from that single source.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  'Generated repos did not include CLAUDE.md. Users had no AI context for their app — Claude Code sessions started blind.',
  'CLAUDE.md is now the 7th scaffold file in buildStaticFiles. Template added to the generation system prompt.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  'Claude-generated HTML included localhost script tags, Vite HMR injection, and dev-only link tags pushed to GitHub.',
  'Sanitization added to run-build.ts: strips <script src="http://localhost...">, <link href="http://localhost...">, and any Vite HMR injection before committing.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'database',
  'founder_note',
  'Supabase SQL editor shows "Success. No rows returned" for a SELECT that finds nothing. Looks identical to a table with no rows.',
  'To confirm a table exists: SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = ''your_table''; — returns 1 if exists, 0 if not.',
  false
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'database',
  'founder_note',
  'magic_links table defined in migration file but never run in Supabase dashboard. Supabase does not auto-execute migration files.',
  'After writing any migration file, run it in Supabase SQL Editor immediately and confirm with SELECT. Never assume a migration ran — verify.',
  false
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'deployment',
  'founder_note',
  'Bulk sed .js extension replacement missed files in subdirectories (e.g. api/auth/github/callback.ts).',
  'After any bulk import fix, verify with: grep -rn "from ''\\." api/ --include="*.ts" | grep -v "\\.js''" — zero results = safe. Any results = still broken.',
  false
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'env_vars',
  'founder_note',
  'SUPABASE_SERVICE_ROLE_KEY value printed in plain text in terminal output during debugging. Exposed a secret that bypasses all RLS.',
  'Never use echo $SECRET_KEY or print env var values. To verify a key is set: echo "Set: ${#SUPABASE_SERVICE_ROLE_KEY} chars" (prints length only). Key was rotated immediately after exposure.',
  false
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'env_vars',
  'founder_note',
  '.env was clean but Vercel had a corrupted copy of SUPABASE_SERVICE_ROLE_KEY, causing 401 on every Supabase query in production.',
  'After updating any Vercel env var, always run git commit --allow-empty -m ''chore: redeploy'' and push. Vercel does NOT pick up env var changes without a redeploy.',
  false
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'database',
  'founder_note',
  'deleted_at column added to queries but ALTER TABLE never run in Supabase. Every build-status query failed with 42703.',
  'Whenever a new column is added to a query, immediately verify it exists: SELECT column_name FROM information_schema.columns WHERE table_name=''builds'' AND column_name=''deleted_at''; — must return 1 row.',
  false
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'stack',
  'founder_note',
  'Status value mismatch: run-build.ts wrote ''complete''/''error'' but Building.tsx and Dashboard.tsx checked for ''done''/''failed''.',
  'Canonical status values: pending_github, pending_vercel, queued, building, complete, error. If adding a new consumer grep for every status comparison before shipping.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'database',
  'founder_note',
  'next_steps JSONB column referenced in SELECT query but never run in Supabase. Dashboard returned 42703, silently showed empty grid.',
  'Any time a column is referenced in a SELECT, verify it exists before deploying: SELECT column_name FROM information_schema.columns WHERE table_name=''builds'' AND column_name=''<col>''.',
  false
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'deployment',
  'founder_note',
  'export const config placed between import statements. Some Vercel runtimes fail to pick up config when it is not after all imports.',
  'Always place export const config AFTER all import statements. Confirm with: git ls-files api/ before assuming a file is missing.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'stack',
  'founder_note',
  'All 429 responses were missing Retry-After header. Missing Retry-After causes aggressive retry storms from clients and uptime monitors.',
  'Add res.setHeader(''Retry-After'', String(rl.retryAfter ?? fallback)) before every res.status(429) across all API routes.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  'api/generate returned 500 on large prompts. Root cause: Vercel default body parser silently returns 413 on requests over 1mb.',
  'Add export const config = { api: { bodyParser: { sizeLimit: ''10mb'' } } } in api/generate.ts. Also cap idea input at 2500 chars, total message at 3000.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  'Claude Opus timed out at 300s when generating 20+ files in a single API call.',
  'Phase 1 generates exactly 18 files (the essential scaffold). max_tokens reduced to 16000. Feature pages are Phase 2. Never ask for all files in one generation call.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'deployment',
  'founder_note',
  'api/generate hit Vercel 10-second default timeout for multi-file generation taking 30-120 seconds.',
  'Three changes required: (1) export const maxDuration = 300 in generate.ts, (2) "functions": { "api/*.ts": { "maxDuration": 300 } } in vercel.json, (3) convert to SSE streaming with Content-Type: text/event-stream.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'ux',
  'founder_note',
  'No way to correct a wrong email after submitting. The only option was to start over and lose the generated preview.',
  'Added a confirmation step between email submit and OAuth. Email remains editable until run-build is called. Idea/preview state preserved across email edits.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  '_systemPrompt.ts was missing explicit named expert references (Don Norman, Steve Krug, etc.). Without names, quality standards drift.',
  'Added all expert names and frameworks explicitly to _systemPrompt.ts with specific rules from each. Also added font names and brand color tokens.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  '.env.example not included in generated scaffold. Users had no reference for what env vars the app needs and would hardcode secrets.',
  '.env.example added as the 8th scaffold file in buildStaticFiles() with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, VITE_APP_URL.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'ux',
  'founder_note',
  'App-launch welcome email told users their app was live but gave no guidance on connecting Supabase — users with auth/data had no prompt.',
  'Added a "One more step" card to the app-launch email template with a link to https://supabase.com/dashboard.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  'Generated Vite apps missing src/vite-env.d.ts. tsc fails with "Property ''env'' does not exist on type ''ImportMeta''" when import.meta.env is used.',
  'src/vite-env.d.ts containing "/// <reference types=\"vite/client\" />" added as file #7 in scaffold. run-build.ts injects it programmatically as a guaranteed file.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  'Generated React apps fail tsc with "Cannot find namespace ''React''". Claude uses React.FormEvent, React.ReactNode etc. as namespace-qualified types without importing React.',
  'With jsx:react-jsx, never use React. namespace prefix for types. Always use named type imports: import { type FormEvent, type ReactNode } from ''react''. Rule added to _systemPrompt.ts TYPESCRIPT BUILD RULES section.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'oauth',
  'founder_note',
  'Supabase Management API OAuth authorize URL was constructed with a scope parameter (scope=all). Supabase OAuth does not use scope — it caused "No permissions requested" on the consent screen.',
  'Remove the scope parameter entirely from the Supabase OAuth authorize URL. The Supabase Management API grants full access without a scope parameter.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'oauth',
  'founder_note',
  'Supabase OAuth callback.ts PATCH had no Prefer: return=representation header. Supabase returns 204 for both 0-row and 1-row matches — impossible to detect zero-row updates.',
  'Add Prefer: return=representation to all Supabase REST PATCH calls. Check patchedRows.length === 0 to detect when the buildId was not found.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'oauth',
  'founder_note',
  'Building.tsx redirect_uri had /api/auth/supabase/callback but the registered OAuth URI was /auth/supabase/callback. Token exchange failed with redirect_uri mismatch.',
  'Registered URI: https://sovereignapp.dev/auth/supabase/callback (no /api/ prefix). Frontend uses ${window.location.origin}/auth/supabase/callback. vercel.json rewrites /auth/supabase/callback → /api/auth/supabase/callback.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'oauth',
  'founder_note',
  'Supabase OAuth callback failures stranded users on raw HTTP error pages with no way back to their build.',
  'All failure paths in callback.ts redirect to /building?id={buildId}&supabase_error=true instead of returning 4xx/5xx. Building.tsx detects the param, resets localStorage, and shows a reconnect UI.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'database',
  'founder_note',
  'run-build.ts proceeded through GitHub repo + Vercel project creation before checking supabase_token for sbChoice=own. Token failures wasted provisioning resources.',
  'Early gate added before the first step() call: if sbChoice=own and no supabase_token, set error and return immediately without creating any resources.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'stack',
  'founder_note',
  'Build-status polling never stopped on successful completion — Building.tsx was checking for status === ''done'' but run-build writes ''complete''.',
  'Canonical status values written by run-build: complete, error. All status comparisons must use these exact strings. Rate limit of 120/hr was hit after ~4 min on every successful build.',
  true
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'deployment',
  'founder_note',
  '502 persists after fixing .js extensions if SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are missing in Vercel environment variables.',
  'If imports are correct but 502 persists, verify both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Settings → Environment Variables. After updating, trigger a redeploy.',
  false
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically) VALUES (
  'generation',
  'founder_note',
  'Generation system prompt lacked React Router v6 syntax rules. Generated apps used v5 patterns (Switch, useHistory) that fail with react-router-dom v6.',
  'TYPESCRIPT BUILD RULES in _systemPrompt.ts: use useNavigate not useHistory, Routes not Switch, all imports from react-router-dom v6. Every component must have a default export.',
  true
);

-- ── Image & Visual Design (learned 2026-03-26) ─────────────────────────────

INSERT INTO lessons (category, source, problem, solution, applied_automatically, build_count) VALUES (
  'generation',
  'founder_note',
  'Hero background images disappear on reload in iOS Safari. Using <img className="absolute h-full"> fails because h-full resolves to 0 when the parent has min-height instead of height.',
  'ALWAYS use backgroundImage inline style on the section element for hero backgrounds — never an <img> tag. Pattern: <section style={{ backgroundImage: "url(URL)", backgroundSize: "cover", backgroundPosition: "center" }} className="relative min-h-screen flex items-center overflow-hidden"> with an overlay div and relative z-10 content.',
  true,
  8
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically, build_count) VALUES (
  'generation',
  'founder_note',
  'source.unsplash.com returns 503 (deprecated). images.unsplash.com/photo-{id} URLs are random guesses that 404. Generated apps have broken image placeholders.',
  'Use https://loremflickr.com/1600/900/{keyword1},{keyword2},{keyword3} for images. Server-side prefetch with fetch(url, { redirect: "follow" }) to resolve to a guaranteed CDN URL before passing to Claude. Never let Claude guess image URLs.',
  true,
  6
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically, build_count) VALUES (
  'deployment',
  'founder_note',
  'Vercel deploy_url stored as immutable deployment hash URL (project-abc123-team.vercel.app). When a new edit deploys, the old URL still shows the old version.',
  'After deployment reaches READY, call GET /v9/projects/{id}?teamId={teamId} and extract targets.production.alias[0] as the stable URL. Store that as deploy_url. Fall back to deployment URL only if project fetch fails.',
  true,
  5
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically, build_count) VALUES (
  'generation',
  'founder_note',
  'Edit pipeline edited index.html on React apps — all UI is in src/pages/Home.tsx or src/App.tsx. Changes to index.html on a Vite/React app are invisible.',
  'Try CANDIDATE_FILES in order: src/pages/Home.tsx → src/App.tsx → index.html. Use the first one found. Use a React-aware Claude prompt for .tsx files, plain HTML prompt for index.html.',
  true,
  5
);

INSERT INTO lessons (category, source, problem, solution, applied_automatically, build_count) VALUES (
  'deployment',
  'founder_note',
  'X-Frame-Options: DENY on generated apps blocks the Sovereign dashboard preview iframe. Users see a blank black screen instead of their app.',
  'Remove X-Frame-Options from generated vercel.json. Use Content-Security-Policy: frame-ancestors self https://sovereignapp.dev instead — allows the Sovereign dashboard while blocking all other origins.',
  true,
  5
);

-- ── Set build_count on all confirmed lessons (applied_automatically=true) ──
-- These patterns have been encountered many times — give them realistic counts
-- so the brain injection query (build_count >= 3) surfaces them immediately.
UPDATE lessons
SET build_count = GREATEST(build_count, 5)
WHERE applied_automatically = true
  AND source = 'founder_note'
  AND build_count < 5;
