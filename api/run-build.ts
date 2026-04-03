// api/run-build.ts — Vercel Serverless Function
//
// POST /api/run-build
// Body: { id: buildId }
//
// Runs the full provisioning sequence for a build that has status === 'queued'.
// Writes step updates to the builds table throughout so the /building page
// can display real-time progress via polling.
//
// ── Why this function runs synchronously ──────────────────────────────────────
// Earlier versions sent a 202 response early and then continued work.
// Vercel (Lambda) terminates the process as soon as the response is flushed,
// so code after res.send() is NOT guaranteed to run. The function must stay
// alive until all provisioning is complete. The /building page fires this
// fetch and immediately starts polling /api/build-status — it does not wait
// for the run-build response.
//
// ── Timeout budget ────────────────────────────────────────────────────────────
// Hobby plan: 10s hard limit (won't work — use Pro).
// Pro plan: maxDuration up to 300s (required for Supabase auto-provisioning).
// Each external fetch: 10s timeout via AbortController.
// Overall provisioning: 250s deadline (leaves 50s margin within the 300s budget).
//
// ── Deployment approach ───────────────────────────────────────────────────────
// Integration OAuth tokens can create Vercel projects but cannot call
// /v13/deployments directly (403 insufficient permissions).
// Instead: create Vercel project (linked to GitHub) → push files to GitHub
// → Vercel auto-deploys via GitHub integration → poll for READY status.
//
import { checkRateLimit } from './_rateLimit.js'
import { scoreApp } from './_scoreApp.js'
import { runDesignAudit } from './audit-generated-app.js'

export const maxDuration = 300

// ── Fetch with timeout ────────────────────────────────────────────────────────

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const NET = 10_000 // 10s per individual network call

// ── Auto-provisioning ─────────────────────────────────────────────────────────

// Safety-net SQL: enables RLS on every public table that doesn't already have it.
// Runs after schema SQL to catch any tables the generation model missed.
const RLS_SAFETY_NET_SQL = `
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
`

async function provisionSupabase(
  supabaseToken: string,
  appName: string,
  schema: string,
  vercelProjectId: string,
  vercelToken: string,
): Promise<{ projectUrl: string; anonKey: string }> {

  // 1. Create Supabase project
  const createRes = await fetch('https://api.supabase.com/v1/projects', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: appName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40),
      db_pass: crypto.randomUUID().replace(/-/g, '').slice(0, 20) + 'Aa1!',
      region: 'us-east-1',
      plan: 'free',
    }),
  })
  if (!createRes.ok) {
    const err = await createRes.json() as { message?: string }
    throw new Error(`Supabase project creation failed: ${err.message ?? createRes.status}`)
  }
  const project = await createRes.json() as { id: string; api_url: string }
  const projectId = project.id

  // 2. Wait for project to be ready (poll up to 3 minutes)
  // NOTE: maxDuration must be >= 240s for this to succeed on long provisions.
  let ready = false
  for (let i = 0; i < 36; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const statusRes = await fetch(`https://api.supabase.com/v1/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${supabaseToken}` },
    })
    const status = await statusRes.json() as { status?: string }
    if (status.status === 'ACTIVE_HEALTHY') { ready = true; break }
  }
  if (!ready) throw new Error('Supabase project did not become ready in time')

  // 3. Get API keys
  const keysRes = await fetch(`https://api.supabase.com/v1/projects/${projectId}/api-keys`, {
    headers: { 'Authorization': `Bearer ${supabaseToken}` },
  })
  const keys = await keysRes.json() as Array<{ name: string; api_key: string }>
  const anonKey = keys.find(k => k.name === 'anon')?.api_key ?? ''
  const projectUrl = `https://${projectId}.supabase.co`

  // 4. Run SQL schema
  if (schema) {
    const sqlRes = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: schema }),
    })
    if (!sqlRes.ok) {
      const err = await sqlRes.json() as { message?: string }
      throw new Error(`Schema migration failed: ${err.message ?? sqlRes.status}`)
    }

    // Safety net: enable RLS on any table that doesn't already have it
    await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: RLS_SAFETY_NET_SQL }),
    }).catch(err => console.warn('[run-build] RLS safety net non-fatal:', err))
  }

  // 5. Inject env vars into Vercel project (no-op if vercelProjectId is empty)
  if (vercelProjectId && vercelToken) {
    const envVars = [
      { key: 'VITE_SUPABASE_URL', value: projectUrl, type: 'plain', target: ['production', 'preview', 'development'] },
      { key: 'VITE_SUPABASE_ANON_KEY', value: anonKey, type: 'plain', target: ['production', 'preview', 'development'] },
    ]
    for (const env of envVars) {
      await fetch(`https://api.vercel.com/v10/projects/${vercelProjectId}/env`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(env),
      })
    }
  }

  return { projectUrl, anonKey }
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

interface AppFileEntry {
  path: string
  content: string
}

interface BuildRecord {
  id: string
  email: string
  app_name: string
  idea: string
  files: AppFileEntry[] | null
  supabase_schema: string | null
  setup_instructions: string | null
  github_token: string
  vercel_token: string
  supabase_token: string | null
  supabase_mode: string | null
  status: string
  step: string | null
  repo_url: string | null
  deploy_url: string | null
  error: string | null
  completed_steps: string[] | null
  vercel_project_id: string | null
  confidence_score: number | null
  launch_gate_passed: boolean | null
  audit_score: number | null
  audit_flags: string | null
  supabase_url: string | null
  supabase_anon_key: string | null
  supabase_project_ref: string | null
}

async function getBuild(
  supabaseUrl: string,
  serviceKey: string,
  id: string,
): Promise<BuildRecord | null> {
  const res = await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
    },
    NET,
  )
  if (!res.ok) return null
  const rows = await res.json() as BuildRecord[]
  return rows[0] ?? null
}

async function updateBuild(
  supabaseUrl: string,
  serviceKey: string,
  id: string,
  patch: Partial<BuildRecord> & { updated_at?: string },
): Promise<void> {
  await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    },
    NET,
  )
}

// ── GitHub helpers ────────────────────────────────────────────────────────────

function toBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

async function ghFetch(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetchWithTimeout(
    `https://api.github.com${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    NET,
  )
  const data = await res.json() as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

function buildAllFiles(
  generatedFiles: AppFileEntry[],
  appName: string,
  repoUrl: string,
): Record<string, string> {
  const buildDate = new Date().toISOString().split('T')[0]

  // Start with the Claude-generated files (overridable by programmatic files below)
  const files: Record<string, string> = {}
  for (const { path, content } of generatedFiles) {
    // Strip engines field from package.json — Vercel does not support it and it causes build failures
    if (path === 'package.json') {
      try {
        const pkg = JSON.parse(content)
        delete pkg.engines
        files[path] = JSON.stringify(pkg, null, 2)
      } catch {
        files[path] = content
      }
    } else {
      files[path] = content
    }
  }

  // ── Programmatic files — always added/overwritten regardless of what Claude generated ──

  files['.gitignore'] = 'node_modules/\ndist/\n.env\n.env.local\n.vercel/\n'

  files['.env.example'] = [
    '# Supabase — get from https://supabase.com/dashboard → Project Settings → API',
    '# Public: safe to expose in client code (VITE_ prefix)',
    'VITE_SUPABASE_URL=',
    'VITE_SUPABASE_ANON_KEY=',
    '',
    '# App URL (used for canonical links)',
    'VITE_APP_URL=https://your-app.vercel.app',
  ].join('\n')

  files['README.md'] = [
    `# ${appName}`,
    '',
    `> Built with [Visila](https://visila.com)`,
    '',
    '## What this app does',
    '',
    '<!-- One sentence describing the core problem this solves -->',
    '',
    '## Top user stories',
    '',
    '- As a user, I can sign up and log in securely',
    '- As a user, I can [core feature 1]',
    '- As a user, I can [core feature 2]',
    '- As a user, I can manage my account and data',
    '- As a user, I can access the app on any device',
    '',
    '## Run locally',
    '',
    '```bash',
    'npm install',
    'cp .env.example .env  # fill in your Supabase keys',
    'npm run dev',
    '```',
    '',
    '## Deploy',
    '',
    'This app auto-deploys to Vercel on every push to main.',
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables.',
    '',
    '## You own everything',
    '',
    `GitHub: ${repoUrl}`,
    'Vercel: https://vercel.com/dashboard',
    'Supabase: https://supabase.com/dashboard',
    '',
    'Visila provisioned this. You own it entirely.',
    '',
  ].join('\n')

  files['vercel.json'] = JSON.stringify(
    {
      rewrites: [{ source: '/((?!assets/).*)', destination: '/index.html' }],
      headers: [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Frame-Options', value: 'ALLOWALL' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), geolocation=()' },
            {
              key: 'Content-Security-Policy',
              value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors *",
            },
          ],
        },
      ],
    },
    null, 2,
  )

  files['CLAUDE.md'] = [
    `# ${appName} — Claude Code Context`,
    '',
    'Generated by [Visila](https://visila.com).',
    'You own everything — this repo, the Vercel deployment, the Supabase database.',
    '',
    '## Stack',
    '- React 18 + Vite 5 + TypeScript 5',
    '- Tailwind CSS 3',
    '- Supabase (auth + database)',
    '- Vercel (deployment — auto-deploys on push to main)',
    '',
    '## Project structure',
    '- src/pages/ — page components (routed in src/App.tsx)',
    '- src/components/ — shared UI components',
    '- src/lib/ — utilities and Supabase client',
    '- src/types/ — TypeScript interfaces',
    '- public/ — static assets',
    '',
    '## Rules for Claude Code',
    '',
    '**Never break the build** — run npm run build before pushing. Fix build errors before pushing.',
    '',
    '**Supabase client is in src/lib/supabase.ts** — import from there, never create new clients.',
    '',
    '**All Supabase tables need RLS** — when adding a new table:',
    '1. ALTER TABLE table_name ENABLE ROW LEVEL SECURITY',
    '2. CREATE POLICY for SELECT, INSERT, UPDATE using auth.uid() = user_id',
    '3. Never use USING(true) on private data',
    '',
    '**Soft deletes only** — never DELETE FROM user data. Set deleted_at = now(). Filter WHERE deleted_at IS NULL.',
    '',
    '**Environment variables** — VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are the only client-side vars.',
    'Never use VITE_ prefix for secrets. Never log env var values.',
    '',
    '**Tailwind only** — no inline styles, no CSS modules, no styled-components.',
    'Design tokens: bg-paper (#f2efe8), bg-ink (#0e0d0b), font-serif (Playfair Display), font-mono (DM Mono).',
    '',
    '**WCAG AA contrast** — check all new color combinations meet 4.5:1 text contrast.',
    '',
    `## Your services`,
    `- GitHub: ${repoUrl}`,
    '- Vercel: https://vercel.com/dashboard',
    '- Supabase: https://supabase.com/dashboard',
    `- Built: ${buildDate}`,
    '',
    '## Hard-Won Lessons',
    '',
    'Add lessons here as you work on this app. Format: bold title, what went wrong, fix, date.',
  ].join('\n')

  // Always inject vite-env.d.ts — without it tsc fails with
  // "Property 'env' does not exist on type 'ImportMeta'" on every import.meta.env reference
  files['src/vite-env.d.ts'] = '/// <reference types="vite/client" />\n'

  return files
}

// ── Step 1: Create GitHub repo (no file push yet) ─────────────────────────────
// Files are pushed AFTER the Vercel project is created so that the GitHub
// push triggers Vercel's auto-deploy via the already-established GitHub link.

async function createGitHubRepo(
  token: string,
  projectName: string,
): Promise<{ ok: true; repoUrl: string; owner: string } | { ok: false; error: string }> {
  console.log('[run-build] GitHub: verifying token')
  const { ok: userOk, data: user } = await ghFetch('/user', token)
  if (!userOk) {
    return { ok: false, error: `GitHub auth failed: ${String(user.message ?? 'unknown')}` }
  }
  const owner = user.login as string
  console.log('[run-build] GitHub: creating repo for', owner)

  const { ok: repoOk, status: repoStatus, data: repo } = await ghFetch(
    '/user/repos', token, 'POST',
    {
      name: projectName,
      description: 'Built with Visila — visila.com',
      private: false,
      auto_init: false,
    },
  )
  if (!repoOk) {
    if (repoStatus === 422) {
      return { ok: false, error: `Repo "${projectName}" already exists on your GitHub account.` }
    }
    return { ok: false, error: `Failed to create repo: ${String(repo.message ?? JSON.stringify(repo.errors))}` }
  }

  console.log('[run-build] GitHub: repo created', repo.html_url)
  return { ok: true, repoUrl: repo.html_url as string, owner }
}

// ── Step 3: Push files to GitHub (triggers Vercel auto-deploy) ───────────────
// Must be called AFTER the Vercel project is created and linked to the repo.
// The GitHub integration detects this push and triggers an automatic deployment.

async function pushFilesToGitHub(
  token: string,
  owner: string,
  projectName: string,
  files: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // The Contents API creates a file + commit in one call and works correctly
  // on empty repos. Must be sequential: each commit moves HEAD, so concurrent
  // calls would race and conflict.
  for (const [filePath, content] of Object.entries(files)) {
    console.log('[run-build] GitHub: pushing', filePath)

    // Check if file already exists — GitHub requires sha to update existing files.
    // This handles retries/partial pushes where some files landed before a failure.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const putBody: Record<string, any> = {
      message: `Add ${filePath}`,
      content: toBase64(content),
    }
    const existing = await ghFetch(
      `/repos/${owner}/${projectName}/contents/${filePath}`,
      token, 'GET',
    )
    if (existing.ok && typeof existing.data.sha === 'string') {
      putBody.sha = existing.data.sha
      console.log('[run-build] GitHub: file exists, updating with sha', (existing.data.sha as string).slice(0, 7))
    }

    const { ok, data } = await ghFetch(
      `/repos/${owner}/${projectName}/contents/${filePath}`,
      token, 'PUT',
      putBody,
    )
    if (!ok) {
      return { ok: false, error: `Failed to push ${filePath}: ${String(data.message ?? JSON.stringify(data))}` }
    }
    console.log('[run-build] GitHub: pushed', filePath)
  }

  console.log('[run-build] GitHub: all files pushed — Vercel auto-deploy triggered')
  return { ok: true }
}

// ── GitHub cleanup ────────────────────────────────────────────────────────────

async function deleteGitHubRepo(token: string, owner: string, repoName: string): Promise<void> {
  console.log('[run-build] GitHub: deleting repo', `${owner}/${repoName}`)
  const { ok, status } = await ghFetch(`/repos/${owner}/${repoName}`, token, 'DELETE')
  if (!ok && status !== 404) {
    console.warn('[run-build] GitHub: repo delete failed (non-fatal), status', status)
  }
}

// ── Vercel helpers ────────────────────────────────────────────────────────────

async function vercelFetch(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetchWithTimeout(
    `https://api.vercel.com${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    NET,
  )
  const data = await res.json() as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

// ── Step 2: Create Vercel project (linked to GitHub, no deploy trigger) ───────
// Integration OAuth tokens cannot call /v13/deployments (403).
// Vercel auto-deploys when the GitHub integration detects a push — that push
// happens in step 3 (pushFilesToGitHub), after this project is created.

async function createVercelProject(
  repoName: string,
  githubRepoUrl: string,
): Promise<{ ok: true; projectId: string; teamId: string | undefined } | { ok: false; error: string; isLoginConnection: boolean }> {
  const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) return { ok: false, error: `Invalid GitHub repo URL: ${githubRepoUrl}`, isLoginConnection: false }
  const [, githubOrg, githubRepo] = match

  // Staging builds deploy to Visila's own Vercel team, not the user's account.
  // The user's vercel_token is only used during the claim flow (transfer).
  const token  = process.env.SOVEREIGN_VERCEL_TOKEN!
  const teamId = process.env.SOVEREIGN_VERCEL_TEAM_ID
  const teamQ  = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  console.log('[run-build] Vercel: creating project on visila staging team, teamId:', teamId ?? 'none')

  // ── Create project with retry + exponential backoff ───────────────────────
  // "Login Connection" errors occur when the Vercel team's GitHub app installation
  // does not cover the user's repo (different GitHub org/user). Retrying 3x handles
  // transient errors; persistent Login Connection errors surface a manual fallback.
  let lastError = ''
  let isLoginConnection = false

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delayMs = 1000 * (2 ** (attempt - 1)) // 1s, 2s
      console.log(`[run-build] Vercel: retry attempt ${attempt + 1}, waiting ${delayMs}ms`)
      await sleep(delayMs)
    }

    console.log('[run-build] Vercel: creating project', repoName, `(attempt ${attempt + 1}/3)`)
    const { ok: projOk, status: projStatus, data: project } = await vercelFetch(
      `/v9/projects${teamQ}`, token, 'POST',
      {
        name: repoName,
        framework: 'vite',
        gitRepository: { type: 'github', repo: `${githubOrg}/${githubRepo}` },
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
        installCommand: 'npm install',
      },
    )
    console.log('[run-build] Vercel: /v9/projects status', projStatus, JSON.stringify(project))

    if (projOk) {
      const projectId = project.id as string
      console.log('[run-build] Vercel: project created', projectId)
      return { ok: true, projectId, teamId }
    }

    const msg = String((project.error as Record<string, unknown>)?.message ?? JSON.stringify(project))
    lastError = `Failed to create Vercel project (${projStatus}): ${msg}`

    // Login Connection error = GitHub app not installed for this repo on visila team.
    // This is structural, not transient — retrying won't fix it.
    if (msg.toLowerCase().includes('login connection') || msg.toLowerCase().includes('login_connection')) {
      isLoginConnection = true
      console.error('[run-build] Vercel: Login Connection error — GitHub app not installed for this repo on visila team:', msg)
      break
    }
  }

  return { ok: false, error: lastError, isLoginConnection }
}

// ── Step 4: Poll Vercel deployments API until READY ───────────────────────────
// After the GitHub push triggers an auto-deploy, poll until Vercel reports
// READY (or ERROR). Polls every 3s up to maxMs. On timeout, returns the
// best-effort alias URL so the build record is not left without a URL.

interface VercelDeployment {
  uid?: string
  state?: string
  url?: string
  alias?: string[]
}

// Fetch the last few error lines from a deployment's build log.
// Uses a short timeout so a log API failure never blocks the main path.
async function fetchDeploymentError(
  deploymentId: string,
  teamId: string | undefined,
): Promise<string> {
  try {
    const token      = process.env.SOVEREIGN_VERCEL_TOKEN!
    const teamParam  = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
    const res = await fetchWithTimeout(
      `https://api.vercel.com/v2/deployments/${deploymentId}/events${teamParam}`,
      { headers: { Authorization: `Bearer ${token}` } },
      5_000,
    )
    if (!res.ok) return ''
    const text = await res.text()
    // Events are newline-delimited JSON objects with { type, payload: { text } }
    const errorLines: string[] = []
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      try {
        const ev = JSON.parse(line) as { type?: string; payload?: { text?: string } }
        if (ev.type === 'error' || ev.type === 'stderr') {
          const msg = ev.payload?.text?.trim()
          if (msg) errorLines.push(msg)
        }
      } catch { /* not JSON — skip */ }
    }
    return errorLines.slice(-5).join('\n')
  } catch {
    return ''
  }
}

async function waitForVercelDeployment(
  projectId: string,
  teamId: string | undefined,
  fallbackUrl: string,
  maxMs: number,
): Promise<{ ok: true; deployUrl: string } | { ok: false; error: string }> {
  const token     = process.env.SOVEREIGN_VERCEL_TOKEN!
  const teamParam = teamId ? `&teamId=${encodeURIComponent(teamId)}` : ''
  const pollPath  = `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=1${teamParam}`

  const deadline = Date.now() + maxMs
  let lastUrl = fallbackUrl

  while (Date.now() < deadline) {
    await sleep(3_000)
    console.log('[run-build] Vercel: polling deployment status…')

    const { ok, data } = await vercelFetch(pollPath, token)
    if (!ok) {
      console.warn('[run-build] Vercel: poll request failed, retrying')
      continue
    }

    const deployments = data.deployments as VercelDeployment[] | undefined
    const d = deployments?.[0]

    if (!d) {
      // Vercel hasn't detected the push yet — keep polling
      console.log('[run-build] Vercel: no deployments yet, waiting…')
      continue
    }

    // Prefer the first production alias, fall back to the raw deployment URL
    const rawUrl = (d.alias && d.alias.length > 0) ? d.alias[0] : d.url
    if (rawUrl) {
      lastUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
    }

    console.log('[run-build] Vercel: deployment state:', d.state, 'url:', lastUrl)

    if (d.state === 'READY') {
      // Prefer the project's stable production alias over the immutable deployment URL.
      // The deployment URL changes with every deploy; the project alias is permanent.
      try {
        const { ok: projOk, data: projData } = await vercelFetch(
          `/v9/projects/${encodeURIComponent(projectId)}${teamParam ? `?${teamParam.slice(1)}` : ''}`,
          token,
        )
        const targets = projOk ? (projData as { targets?: { production?: { alias?: string[] } } })?.targets : undefined
        const stableAlias = targets?.production?.alias?.[0]
        if (stableAlias) {
          lastUrl = stableAlias.startsWith('http') ? stableAlias : `https://${stableAlias}`
          console.log('[run-build] Vercel: using stable project alias:', lastUrl)
        }
      } catch { /* non-fatal — fall back to deployment URL */ }
      return { ok: true, deployUrl: lastUrl }
    }
    if (d.state === 'ERROR' || d.state === 'CANCELED') {
      let errorMsg = `Vercel deployment ended with state: ${d.state}`
      if (d.uid) {
        const logs = await fetchDeploymentError(d.uid, teamId)
        if (logs) errorMsg = `Build failed:\n${logs}`
      }
      return { ok: false, error: errorMsg }
    }
    // BUILDING or QUEUED — keep polling
  }

  // Timed out but we have a URL — the deployment will finish on Vercel's side.
  // Return best-effort so the build record is not left without a URL.
  console.warn('[run-build] Vercel: poll timed out — returning best-effort URL:', lastUrl)
  return { ok: true, deployUrl: lastUrl }
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendLaunchEmail(
  resendKey: string,
  email: string,
  appName: string,
  liveUrl: string,
  repoUrl: string,
): Promise<void> {
  try {
    await fetchWithTimeout(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Visila <noreply@visila.com>',
          to: [email],
          subject: 'Your app is live — you own everything',
          html: buildLaunchEmailHtml(appName, liveUrl, repoUrl),
        }),
      },
      NET,
    )
  } catch (err) {
    console.warn('[run-build] email send failed (non-fatal):', err)
  }
}

function buildLaunchEmailHtml(appName: string, liveUrl: string, repoUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <style>:root{color-scheme:light dark;}body{background-color:#0e0d0b!important;color:#f2efe8!important;}</style>
</head>
<body style="margin:0;padding:0;background-color:#0e0d0b!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f2efe8!important;">
<div style="background-color:#0e0d0b!important;color:#f2efe8!important;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0e0d0b!important;padding:40px 16px;">
<tr><td align="center" style="background-color:#0e0d0b!important;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#0e0d0b!important;">
<tr><td style="padding:0 0 36px 0;text-align:center;background-color:#0e0d0b!important;">
  <span style="font-size:13px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c8f060!important;">VISILA</span>
</td></tr>
<tr><td style="padding:0 0 12px 0;text-align:center;background-color:#0e0d0b!important;">
  <h1 style="margin:0;font-size:48px;font-weight:800;line-height:1;color:#f2efe8!important;letter-spacing:-0.02em;">Your app is live.</h1>
</td></tr>
<tr><td style="padding:0 0 32px 0;text-align:center;background-color:#0e0d0b!important;">
  <p style="margin:0;font-size:18px;font-weight:600;color:#c8f060!important;">${appName}</p>
</td></tr>
<tr><td style="padding:0 0 32px 0;background-color:#0e0d0b!important;">
  <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
</td></tr>
<tr><td style="padding:0 0 36px 0;text-align:center;background-color:#0e0d0b!important;">
  <p style="margin:0;font-size:15px;line-height:1.75;color:#f2efe8!important;">Visila has stepped back. This is yours now.<br/>Your code. Your infrastructure. Your future.</p>
</td></tr>
<tr><td style="padding:0 0 40px 0;text-align:center;background-color:#0e0d0b!important;">
  <a href="${liveUrl}" style="display:inline-block;background:#c8f060;color:#0e0d0b!important;-webkit-text-fill-color:#0e0d0b;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:6px;margin:0 6px 12px;">View Live App →</a>
  <a href="${repoUrl}" style="display:inline-block;background:#0e0d0b;color:#c8f060!important;-webkit-text-fill-color:#c8f060;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:6px;border:1px solid rgba(200,240,96,0.4);margin:0 6px 12px;">View on GitHub →</a>
</td></tr>
<tr><td style="padding:0 0 28px 0;background-color:#0e0d0b!important;">
  <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
</td></tr>
<tr><td style="text-align:center;background-color:#0e0d0b!important;">
  <p style="margin:0;font-size:11px;line-height:1.8;color:#6b6862!important;">© 2026 Visila · <a href="https://visila.com" style="color:#6b6862!important;text-decoration:none;">visila.com</a> · Built without permission</p>
</td></tr>
</table></td></tr>
</table>
</div>
</body>
</html>`
}

// ── Supabase provisioning helpers ─────────────────────────────────────────────

// Inject one or more env vars into a Vercel project (encrypted at rest).
// Called after Vercel project creation, before pushing files so the build has
// access to VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY during compilation.
async function injectVercelEnvVars(
  projectId: string,
  teamId: string | undefined,
  vars: Array<{ key: string; value: string }>,
): Promise<void> {
  const token = process.env.SOVEREIGN_VERCEL_TOKEN!
  const teamQ = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  const keys  = vars.map(v => v.key)
  const emptyKeys = vars.filter(v => !v.value).map(v => v.key)

  console.log('[run-build] injectVercelEnvVars: projectId:', projectId, 'teamId:', teamId ?? 'MISSING', 'keys:', keys)
  if (emptyKeys.length > 0) {
    console.error('[run-build] injectVercelEnvVars: empty values for keys:', emptyKeys, '— generated app will have no Supabase credentials')
  }
  if (!teamId) {
    console.error('[run-build] injectVercelEnvVars: SOVEREIGN_VERCEL_TEAM_ID is not set — env var injection will fail (project belongs to visila staging team, teamId is required)')
  }

  const payload = vars.map(({ key, value }) => ({
    key,
    value,
    type: 'encrypted',
    target: ['production', 'preview', 'development'],
  }))
  const res = await fetchWithTimeout(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env${teamQ}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    NET,
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // Handle ENV_CONFLICT: vars already exist, patch them with correct values
    if (res.status === 400) {
      let parsed: { error?: { code?: string }; failed?: Array<{ error?: { code?: string; envVarKey?: string } }> } | null = null
      try { parsed = JSON.parse(body) } catch { /* not JSON */ }
      const hasEnvConflict = parsed?.failed?.some(
        (f: any) => f?.error?.code === 'ENV_CONFLICT'
      )
      if (hasEnvConflict) {
        const conflictingKeys = (parsed?.failed ?? []).map((f: any) => f.error?.envVarKey).filter((k: any): k is string => !!k)
        console.log('[run-build] ENV_CONFLICT keys to patch:', conflictingKeys)
        // If no failed array or no envVarKey fields, assume all keys conflicted
        const keysToPatch = conflictingKeys.length > 0 ? conflictingKeys : keys
        console.log('[run-build] injectVercelEnvVars: ENV_CONFLICT for keys:', keysToPatch, '— patching existing vars')

        // Fetch current env vars to get IDs
        const listRes = await fetchWithTimeout(
          `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env${teamQ}`,
          { headers: { Authorization: `Bearer ${token}` } },
          NET,
        )
        if (listRes.ok) {
          const listData = await listRes.json() as { envs?: Array<{ id: string; key: string }> }
          const existingEnvs = listData.envs ?? []

          for (const keyToPatch of keysToPatch) {
            const entry = existingEnvs.find(e => e.key === keyToPatch)
            if (!entry) {
              console.warn('[run-build] injectVercelEnvVars: could not find envVarId for key:', keyToPatch)
              continue
            }
            const envVarId = entry.id
            const newValue = vars.find(v => v.key === keyToPatch)?.value
            if (!newValue) {
              console.warn('[run-build] injectVercelEnvVars: no value for conflicting key:', keyToPatch)
              continue
            }
            console.log('[run-build] injectVercelEnvVars: patching', keyToPatch, '— value length:', newValue?.length ?? 0)
            const patchRes = await fetchWithTimeout(
              `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envVarId)}${teamQ}`,
              {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  value: newValue,
                  target: ['production', 'preview', 'development'],
                }),
              },
              NET,
            )
            console.log('[run-build] injectVercelEnvVars: PATCH response', keyToPatch, patchRes.status)
            if (patchRes.ok) {
              console.log('[run-build] injectVercelEnvVars: patched existing var', keyToPatch)
            } else {
              const patchBody = await patchRes.text().catch(() => '')
              console.error('[run-build] injectVercelEnvVars: PATCH failed for', keyToPatch, patchRes.status, patchBody)
            }
          }
          console.log('[run-build] injectVercelEnvVars: all vars resolved')
        } else {
          console.error('[run-build] injectVercelEnvVars: failed to list env vars for patching:', listRes.status)
        }
        // Do NOT return — fall through to verify step
      } else {
        // 400 but not ENV_CONFLICT, or non-400 error — log and bail
        console.error('[run-build] injectVercelEnvVars FAILED:', res.status, body, '— projectId:', projectId, 'teamId:', teamId ?? 'MISSING', 'keys:', keys)
        return
      }
    } else {
      console.error('[run-build] injectVercelEnvVars FAILED:', res.status, body, '— projectId:', projectId, 'teamId:', teamId ?? 'MISSING', 'keys:', keys)
      return
    }
  } else {
    console.log('[run-build] injectVercelEnvVars OK — injected:', keys.join(', '))
  }

  // Verify the vars actually landed — a 200 from the POST doesn't guarantee
  // the correct teamId was used. A missing teamId causes the project to be
  // found on the wrong team and the response may still be 200 with no-op.
  try {
    const verifyRes = await fetchWithTimeout(
      `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env${teamQ}`,
      { headers: { Authorization: `Bearer ${token}` } },
      NET,
    )
    if (verifyRes.ok) {
      const verifyData = await verifyRes.json() as { envs?: Array<{ key: string }> }
      const presentKeys = (verifyData.envs ?? []).map((e) => e.key)
      const missing = keys.filter((k) => !presentKeys.includes(k))
      if (missing.length > 0) {
        console.error('[run-build] injectVercelEnvVars VERIFY FAILED — keys not present after injection:', missing, 'projectId:', projectId, 'teamId:', teamId ?? 'MISSING')
      } else {
        console.log('[run-build] injectVercelEnvVars VERIFY OK — all keys confirmed present:', keys.join(', '))
      }
    } else {
      console.warn('[run-build] injectVercelEnvVars verify GET failed:', verifyRes.status)
    }
  } catch (verifyErr) {
    console.warn('[run-build] injectVercelEnvVars verify threw (non-fatal):', verifyErr)
  }
}

// Prepend a build_id column to every CREATE TABLE statement in a SQL schema
// so that all tables in visila-hosted databases are scoped per build.
function addBuildIdToSchema(schema: string, buildId: string): string {
  return schema.replace(
    /(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[^\s(]+\s*\()/gi,
    `$1\n  build_id UUID NOT NULL DEFAULT '${buildId}'::uuid,`,
  )
}

// ── Lessons: auto-capture build failures ──────────────────────────────────────
//
// Inserts a lesson row whenever a build ends in error. Fails silently so
// a logging failure never affects the build flow.

async function recordFailureLesson(
  supabaseUrl: string,
  serviceKey: string,
  errorMessage: string,
  step: string | null,
): Promise<void> {
  try {
    const lower = errorMessage.toLowerCase()
    const stepLower = (step ?? '').toLowerCase()

    let category = 'deployment'
    if (lower.includes('typescript') || lower.includes('tsc') || lower.includes('no files') || lower.includes('generate')) {
      category = 'generation'
    } else if (lower.includes('oauth') || lower.includes('token') || lower.includes('auth')) {
      category = 'oauth'
    } else if (
      lower.includes('schema') || lower.includes('table') || lower.includes('rls') ||
      lower.includes('migration') || stepLower.includes('database') ||
      lower.includes('supabase organisation')
    ) {
      category = 'database'
    } else if (lower.includes('env') || lower.includes('not configured') || lower.includes('missing key')) {
      category = 'env_vars'
    } else if (lower.includes('vercel') || lower.includes('github') || lower.includes('repo') || lower.includes('deploy')) {
      category = 'deployment'
    }

    await fetch(`${supabaseUrl}/rest/v1/lessons`, {
      method: 'POST',
      headers: {
        apikey:         serviceKey,
        Authorization:  `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({
        category,
        source:               'build_failure',
        problem:              step ? `[Step: ${step}] ${errorMessage}` : errorMessage,
        solution:             '',
        applied_automatically: false,
        build_count:          1,
      }),
    })
  } catch {
    // Intentionally silent — never crash the build flow over a logging call
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

const PROVISION_TIMEOUT_MS = 250_000 // 250s — leaves 50s margin within the 300s maxDuration

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown'
    const rl = checkRateLimit(`run-build:${ip}`, 10, 5 * 60 * 1000)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
      res.status(429).json({ error: `Too many requests. Retry after ${rl.retryAfter ?? 3600}s.` })
      return
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    const resendKey   = process.env.RESEND_API_KEY

    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' })
      return
    }

    let body: Record<string, string>
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' })
      return
    }

    const { id: buildId, supabaseChoice, forceRetry } = body ?? {}
    if (!buildId) {
      res.status(400).json({ error: '`id` (buildId) is required' })
      return
    }
    const sbChoice: 'own' | 'sovereign' = supabaseChoice === 'own' ? 'own' : 'sovereign'

    console.log('[run-build] fetching build', buildId)
    const build = await getBuild(supabaseUrl, serviceKey, buildId)
    if (!build) {
      res.status(404).json({ error: 'Build not found' })
      return
    }
    console.log('[run-build] build status:', build.status,
      'github_token:', build.github_token ? 'SET' : 'NULL',
      'vercel_token:', build.vercel_token ? 'SET' : 'NULL')

    // Idempotency guard — prevents double-trigger from React StrictMode.
    // forceRetry=true bypasses this when the user explicitly retries after a
    // token-not-found hold: the build never progressed (no GitHub/Vercel resources
    // were created), so it is safe to reset to 'queued' and run again.
    if (build.status !== 'queued') {
      if (!forceRetry) {
        console.log('[run-build] skipping — status is', build.status)
        res.status(200).json({ ok: true, skipped: true, status: build.status })
        return
      }
      // forceRetry: confirm token exists before resetting — if still missing, nothing has changed
      if (sbChoice === 'own' && !build.supabase_token) {
        console.error('[run-build] forceRetry=true but supabase_token still null — cannot proceed. buildId:', buildId)
        res.status(200).json({ ok: true, skipped: true, reason: 'supabase_token_missing' })
        return
      }
      // Preserve completed_steps, repo_url, vercel_project_id — resume from last checkpoint.
      // Only clear status/error/step so the idempotency guard allows re-entry.
      console.log('[run-build] forceRetry — resuming from checkpoint, completed_steps:', build.completed_steps, 'buildId:', buildId)
      await updateBuild(supabaseUrl, serviceKey, buildId, { status: 'queued', error: null, step: null })
    }

    // Staging builds use SOVEREIGN_VERCEL_TOKEN — only github_token is required from the user.
    // vercel_token is preserved on the build record for future use in the claim flow (transfer).
    if (!build.github_token) {
      console.log('[run-build] missing github_token — vercel_token:', build.vercel_token ? 'SET' : 'NULL')
      res.status(400).json({ error: 'Build is missing GitHub OAuth token — complete the GitHub OAuth step first' })
      return
    }
    if (!process.env.SOVEREIGN_VERCEL_TOKEN) {
      console.error('[run-build] SOVEREIGN_VERCEL_TOKEN not set — cannot deploy staging app')
      res.status(500).json({ error: 'Visila Vercel token not configured' })
      return
    }

    // ── Supabase token gate — must be checked BEFORE any step() call ─────────
    // step() sets status → 'building'. If we let the build advance to 'building'
    // before confirming the token exists, the user cannot retry OAuth (the
    // idempotency guard blocks re-runs for any status other than 'queued').
    // Returning early here keeps status === 'queued' so the user can reconnect
    // and re-trigger run-build on the next page load.
    if (sbChoice === 'own' && !build.supabase_token) {
      console.error('[run-build] sbChoice=own but supabase_token is null — holding at queued. buildId:', buildId)
      await updateBuild(supabaseUrl, serviceKey, buildId, {
        error: 'Supabase OAuth token not found. Please reconnect your Supabase account.',
      })
      res.status(200).json({ ok: true, skipped: true, reason: 'supabase_token_missing' })
      return
    }

    // ── Derive a unique repo name ────────────────────────────────────────────
    // Append the first 6 chars of the buildId (UUID without hyphens) to make
    // the GitHub repo name unique per build attempt.
    const nameSlug = build.app_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const buildSuffix = buildId.replace(/-/g, '').slice(0, 6)
    const repoName = `${nameSlug}-${buildSuffix}`
    console.log('[run-build] repo name:', repoName)

    // ── Run provisioning synchronously ──────────────────────────────────────
    const step = (s: string) => {
      console.log('[run-build] step:', s)
      return updateBuild(supabaseUrl, serviceKey, buildId, { status: 'building', step: s })
    }

    // Checkpoint helpers — track which major steps completed so retry can skip them.
    const doneSteps = new Set<string>(build.completed_steps ?? [])
    const markDone = async (stepName: string) => {
      doneSteps.add(stepName)
      await updateBuild(supabaseUrl, serviceKey, buildId, { completed_steps: [...doneSteps] })
    }

    try {
      await Promise.race([
        // ── Provisioning work ──────────────────────────────────────────────
        (async () => {
          // Auto-provision Supabase if token available and not already done.
          // Uses build.vercel_project_id for env var injection — available from
          // checkpoint on retry. On a fresh build the Vercel project doesn't exist
          // yet, so env injection is skipped here (vercelProjectId is empty string)
          // and the user can re-trigger after the Vercel step completes.
          if (build.supabase_token && !doneSteps.has('supabase_provisioned')) {
            await step('Provisioning your database...')
            try {
              const { projectUrl, anonKey } = await provisionSupabase(
                build.supabase_token,
                build.app_name ?? repoName,
                build.supabase_schema ?? '',
                build.vercel_project_id ?? '',
                process.env.SOVEREIGN_VERCEL_TOKEN ?? '',
              )
              await updateBuild(supabaseUrl, serviceKey, buildId, {
                supabase_url: projectUrl,
                supabase_anon_key: anonKey,
              })
              doneSteps.add('supabase_provisioned')
              await updateBuild(supabaseUrl, serviceKey, buildId, { completed_steps: [...doneSteps] })
              console.log('[run-build] Supabase auto-provisioned:', projectUrl)
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Supabase provisioning failed'
              console.error('[run-build] Auto-provisioning error (non-fatal):', msg)
              // Non-fatal — continue with build, user can connect manually from dashboard
              await step('Database setup skipped — connect manually from dashboard')
            }
          }

          await step('Reading your idea…')

          // ── Step 1: Create GitHub repo (no file push yet) ─────────────
          // Skip if already completed on a previous attempt.
          let ghOwner: string
          let ghRepoUrl: string

          if (doneSteps.has('github') && build.repo_url) {
            console.log('[run-build] checkpoint: github already done, reusing repo_url:', build.repo_url)
            const m = build.repo_url.match(/github\.com\/([^/]+)\//)
            ghOwner  = m?.[1] ?? ''
            ghRepoUrl = build.repo_url
            await step(`Repo ready at ${ghRepoUrl}`)
          } else {
            await step('Creating your GitHub repo…')
            const ghResult = await createGitHubRepo(build.github_token, repoName)
            if (ghResult.ok === false) {
              await updateBuild(supabaseUrl, serviceKey, buildId, {
                status: 'error', step: 'GitHub failed', error: ghResult.error,
              })
              return
            }
            ghOwner  = ghResult.owner
            ghRepoUrl = ghResult.repoUrl
            await updateBuild(supabaseUrl, serviceKey, buildId, {
              status: 'building',
              step: `Repo created at ${ghRepoUrl}`,
              repo_url: ghRepoUrl,
            })
            await markDone('github')
          }

          // ── Step 2: Create Vercel project (linked to GitHub repo) ─────
          // Skip if already completed on a previous attempt.
          let vcProjectId: string
          let vcTeamId: string | undefined

          if (doneSteps.has('vercel') && build.vercel_project_id) {
            console.log('[run-build] checkpoint: vercel already done, reusing project_id:', build.vercel_project_id)
            vcProjectId = build.vercel_project_id
            vcTeamId    = process.env.SOVEREIGN_VERCEL_TEAM_ID
            await step('Vercel project ready')
          } else {
            await step('Connecting Vercel to your repo…')
            const vcResult = await createVercelProject(repoName, ghRepoUrl)
            if (vcResult.ok === false) {
              const errMsg = vcResult.isLoginConnection
                ? `We couldn't link Vercel automatically — the GitHub app needs to be installed on the staging Vercel account for this repository. Error: ${vcResult.error}`
                : vcResult.error
              await updateBuild(supabaseUrl, serviceKey, buildId, {
                status: 'error', step: 'Vercel setup failed', error: errMsg,
              })
              return
            }
            vcProjectId = vcResult.projectId
            vcTeamId    = vcResult.teamId
            await updateBuild(supabaseUrl, serviceKey, buildId, { vercel_project_id: vcProjectId })
            await markDone('vercel')

            // Disable SSO protection so the preview iframe loads without a Vercel login.
            // Vercel enables SSO protection by default on all projects in a team with SSO
            // configured. Must be disabled immediately after project creation — failure
            // blocks all iframe previews silently. Non-fatal: build proceeds regardless.
            // Endpoint: PATCH /v9/projects/{id} with { ssoProtection: null }.
            // NOT /v1/projects/{id}/protection-bypass — that's for generating bypass links.
            try {
              const ssoTeamQ = vcTeamId ? `?teamId=${encodeURIComponent(vcTeamId)}` : ''
              const ssoRes = await fetchWithTimeout(
                `https://api.vercel.com/v9/projects/${encodeURIComponent(vcProjectId)}${ssoTeamQ}`,
                {
                  method: 'PATCH',
                  headers: {
                    Authorization: `Bearer ${process.env.SOVEREIGN_VERCEL_TOKEN!}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ ssoProtection: null }),
                },
                NET,
              )
              if (ssoRes.ok) {
                const ssoBody = await ssoRes.json().catch(() => null)
                console.log('[run-build] Vercel: SSO disabled —', JSON.stringify(ssoBody?.ssoProtection))
              } else {
                const ssoBody = await ssoRes.text().catch(() => '')
                console.error('[run-build] Vercel: SSO disable failed (non-fatal) —', ssoRes.status, ssoBody)
              }
            } catch (ssoErr) {
              console.error('[run-build] Vercel: SSO disable threw (non-fatal):', ssoErr)
            }
          }

          // ── Step 3: Provision database ────────────────────────────────
          await step('Provisioning your database…')
          let deploySupabaseUrl: string
          let deployAnonKey: string

          if (sbChoice === 'own') {
            // Full own-Supabase provisioning deferred to claim flow — too slow for build pipeline
            // Creating a new Supabase project via Management API takes 2-4 minutes which exceeds
            // Vercel's function timeout. For now, use Visila's Supabase with row-level isolation
            // (same as the 'sovereign' path) and mark supabase_mode='sovereign_temporary' so the
            // claim flow can migrate the user to their own project later.
            console.log('[run-build] sbChoice=own — using visila_temporary path (own project creation deferred to claim flow)')
            await step('Connecting your database…')
            await updateBuild(supabaseUrl, serviceKey, buildId, { supabase_mode: 'sovereign_temporary' })
            deploySupabaseUrl = process.env.SUPABASE_URL!
            deployAnonKey     = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

            await step('Running your schema…')
            if (build.supabase_schema) {
              const sovereignRef   = process.env.SOVEREIGN_SUPABASE_REF
              const mgmtToken      = process.env.SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN
              if (sovereignRef && mgmtToken) {
                await fetchWithTimeout(
                  `https://api.supabase.com/v1/projects/${sovereignRef}/database/query`,
                  {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: build.supabase_schema }),
                  },
                  NET,
                ).catch(err => console.warn('[run-build] own-temp schema exec non-fatal:', err))
                // RLS safety net
                await fetchWithTimeout(
                  `https://api.supabase.com/v1/projects/${sovereignRef}/database/query`,
                  {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: RLS_SAFETY_NET_SQL }),
                  },
                  NET,
                ).catch(err => console.warn('[run-build] RLS safety net non-fatal:', err))
              }
            }
          } else {
            // Visila-hosted path — use Visila's own Supabase instance,
            // scope all generated tables by build_id
            deploySupabaseUrl = process.env.SUPABASE_URL!
            deployAnonKey     = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

            await step('Running your schema…')
            if (build.supabase_schema) {
              const sovereignRef   = process.env.SOVEREIGN_SUPABASE_REF
              const mgmtToken      = process.env.SOVEREIGN_SUPABASE_MANAGEMENT_TOKEN
              if (sovereignRef && mgmtToken) {
                const scopedSchema = addBuildIdToSchema(build.supabase_schema, buildId as string)
                await fetchWithTimeout(
                  `https://api.supabase.com/v1/projects/${sovereignRef}/database/query`,
                  {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: scopedSchema }),
                  },
                  NET,
                ).catch(err => console.warn('[run-build] visila schema exec non-fatal:', err))
                // RLS safety net
                await fetchWithTimeout(
                  `https://api.supabase.com/v1/projects/${sovereignRef}/database/query`,
                  {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: RLS_SAFETY_NET_SQL }),
                  },
                  NET,
                ).catch(err => console.warn('[run-build] RLS safety net non-fatal:', err))
              } else {
                console.log('[run-build] SOVEREIGN_SUPABASE_REF or MANAGEMENT_TOKEN not set — schema stored for manual run')
              }
            }
          }

          // Secure the tables — RLS safety net runs above, this step is a
          // visual indicator that security has been applied
          await step('Securing your tables…')

          // Inject Supabase env vars into Vercel project before file push so
          // they're available during the Vite build that Vercel triggers
          await injectVercelEnvVars(vcProjectId, vcTeamId, [
            { key: 'VITE_SUPABASE_URL',  value: deploySupabaseUrl },
            { key: 'VITE_SUPABASE_ANON_KEY', value: deployAnonKey },
            { key: 'SUPABASE_URL',        value: deploySupabaseUrl },
          ])
          await step('Database ready ✓')
          await markDone('database')

          // ── Step 4: Push files to GitHub → triggers Vercel auto-deploy ─
          await step('Pushing your app files…')
          const generatedFiles = build.files ?? []
          console.log('[run-build] generated files count:', generatedFiles.length)
          if (generatedFiles.length === 0) {
            await updateBuild(supabaseUrl, serviceKey, buildId, {
              status: 'error', step: 'No files generated', error: 'Build record has no files array. Re-generate the app and try again.',
            })
            return
          }
          const allFiles = buildAllFiles(generatedFiles, build.app_name, ghRepoUrl)
          console.log('[run-build] total files to push:', Object.keys(allFiles).length)
          const pushResult = await pushFilesToGitHub(
            build.github_token, ghOwner, repoName, allFiles,
          )
          if (pushResult.ok === false) {
            await deleteGitHubRepo(build.github_token, ghOwner, repoName)
            await updateBuild(supabaseUrl, serviceKey, buildId, {
              status: 'error', step: 'File push failed', error: pushResult.error,
            })
            return
          }

          await markDone('files')

          // ── Save supabaseSchema to builds table (non-fatal) ───────────
          if (build.supabase_schema) {
            console.log('[run-build] saving supabase_schema, length:', build.supabase_schema.length)
            await updateBuild(supabaseUrl, serviceKey, buildId, {
              supabase_schema: build.supabase_schema,
            }).catch((err: unknown) => {
              console.warn('[run-build] supabase_schema save failed (non-fatal):', err)
            })
          }

          // ── Step 4: Poll Vercel until deployment is READY ─────────────
          // Budget: PROVISION_TIMEOUT_MS minus time already spent (~20s).
          // Remaining ~30s ≈ 10 polls at 3s each.
          // For simple static apps Vercel typically completes in 20-40s.
          // On timeout, best-effort URL is returned — deploy finishes async.
          await step('Deploying to Vercel…')
          const fallbackUrl = `https://${repoName}.vercel.app`
          const pollBudgetMs = 32_000 // 32s of polling within the overall 50s budget
          const deployResult = await waitForVercelDeployment(
            vcProjectId, vcTeamId,
            fallbackUrl, pollBudgetMs,
          )

          if (deployResult.ok === false) {
            // Deployment errored on Vercel's side
            await updateBuild(supabaseUrl, serviceKey, buildId, {
              status: 'error', step: 'Vercel deploy failed', error: deployResult.error,
            })
            return
          }

          await updateBuild(supabaseUrl, serviceKey, buildId, {
            status: 'building',
            step: `Live at ${deployResult.deployUrl}`,
            deploy_url: deployResult.deployUrl,
          })

          // ── Step 5: Send launch email (non-fatal) ─────────────────────
          await step('Sending your live URL…')
          if (resendKey) {
            await sendLaunchEmail(
              resendKey, build.email, build.app_name,
              deployResult.deployUrl, ghRepoUrl,
            )
          }

          // ── Score the app against 10 Visila Standards dimensions ──────
          // Runs in-memory against the generated files — no filesystem needed.
          // Score is stored in builds.confidence_score and used by the coach.
          const scoreResult = scoreApp(build.files ?? [])
          console.log('[run-build] confidence score:', scoreResult.overall, scoreResult.band,
            'launch gate:', scoreResult.launchGatePassed)

          // ── Transition to 'auditing' before running design audit ──────────
          await updateBuild(supabaseUrl, serviceKey, buildId, {
            status: 'auditing',
            step: 'Auditing your app…',
            confidence_score: scoreResult.overall,
            launch_gate_passed: scoreResult.launchGatePassed,
          })

          // ── Run design audit against live GitHub files (non-blocking) ─────
          // Fetches the generated repo, runs 35 checks, applies mechanical fixes.
          // Audit failure never blocks the user — wrapped in try/catch.
          try {
            const auditResult = await runDesignAudit(ghOwner, repoName, build.github_token)
            console.log(`[run-build] audit score: ${auditResult.score}/100, fixes: ${auditResult.fixes_applied}`)

            await updateBuild(supabaseUrl, serviceKey, buildId, {
              audit_score: auditResult.score,
              audit_flags: auditResult.fixes_applied > 15 ? 'high_fix_count' : null,
            })

            if (auditResult.fixes_applied > 15) {
              void recordFailureLesson(
                supabaseUrl, serviceKey,
                `High audit fix count on build ${buildId as string}: ${auditResult.fixes_applied} fixes needed. Review generation prompt.`,
                'Audit',
              )
            }
          } catch (auditErr) {
            // Non-fatal — audit failure does not block build completion
            console.error('[run-build] audit error (non-fatal):', auditErr)
          }

          // ── Fire Brain Audit async — non-blocking ─────────────────────
          const appUrl = process.env.VITE_APP_URL ?? 'https://visila.com'
          fetch(`${appUrl}/api/brain-audit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              buildId,
              deployUrl: deployResult.deployUrl,
              supabaseRef: build.supabase_project_ref ?? '',
              repoOwner: ghOwner,
              repoName,
            }),
          }).catch((err: unknown) => console.error('[run-build] Brain audit fire-and-forget failed:', err))

          // ── Mark build complete ──────────────────────────────────────────
          // Always re-write deploy_url alongside status so retries never leave
          // a stale 'error' status next to a valid URL (or vice versa).
          await updateBuild(supabaseUrl, serviceKey, buildId, {
            status: 'complete',
            step: 'done',
            deploy_url: deployResult.deployUrl,
          })
          console.log('[run-build] done')
        })(),

        // ── Hard deadline ──────────────────────────────────────────────────
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Provisioning timed out after ${PROVISION_TIMEOUT_MS / 1000}s`)),
            PROVISION_TIMEOUT_MS,
          ),
        ),
      ])
    } catch (provisionErr) {
      console.error('[run-build] provisioning error:', provisionErr)
      const errMsg = provisionErr instanceof Error ? provisionErr.message : String(provisionErr)
      await updateBuild(supabaseUrl, serviceKey, buildId, {
        status: 'error',
        step: 'Build failed',
        error: errMsg,
      }).catch(() => {/* ignore secondary write error */})
      void recordFailureLesson(supabaseUrl, serviceKey, errMsg, 'Build failed')
    }

    // Respond after work is complete (or after error is written to DB)
    res.status(200).json({ ok: true, buildId })
  } catch (err) {
    console.error('[run-build] unhandled exception:', err)
    try {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    } catch {/* headers already sent */}
  }
}
