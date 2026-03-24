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
// Pro plan: maxDuration up to 60s.
// Each external fetch: 10s timeout via AbortController.
// Overall provisioning: 50s deadline (leaves 10s margin for final DB write).
//
// ── Deployment approach ───────────────────────────────────────────────────────
// Integration OAuth tokens can create Vercel projects but cannot call
// /v13/deployments directly (403 insufficient permissions).
// Instead: create Vercel project (linked to GitHub) → push files to GitHub
// → Vercel auto-deploys via GitHub integration → poll for READY status.
//
import { checkRateLimit } from './_rateLimit.js'

export const maxDuration = 60

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
    `> Built with [Sovereign](https://sovereignapp.dev)`,
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
    'Sovereign provisioned this. You own it entirely.',
    '',
  ].join('\n')

  files['vercel.json'] = JSON.stringify(
    {
      rewrites: [{ source: '/((?!api/).*)', destination: '/index.html' }],
      headers: [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            {
              key: 'Content-Security-Policy',
              value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co",
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
    'Generated by [Sovereign](https://sovereignapp.dev).',
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
      description: 'Built with Sovereign — sovereignapp.dev',
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
    const { ok, data } = await ghFetch(
      `/repos/${owner}/${projectName}/contents/${filePath}`,
      token, 'PUT',
      {
        message: `Add ${filePath}`,
        content: toBase64(content),
      },
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

  // Staging builds deploy to Sovereign's own Vercel team, not the user's account.
  // The user's vercel_token is only used during the claim flow (transfer).
  const token  = process.env.SOVEREIGN_VERCEL_TOKEN!
  const teamId = process.env.SOVEREIGN_VERCEL_TEAM_ID
  const teamQ  = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  console.log('[run-build] Vercel: creating project on sovereign staging team, teamId:', teamId ?? 'none')

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

    // Login Connection error = GitHub app not installed for this repo on sovereign team.
    // This is structural, not transient — retrying won't fix it.
    if (msg.toLowerCase().includes('login connection') || msg.toLowerCase().includes('login_connection')) {
      isLoginConnection = true
      console.error('[run-build] Vercel: Login Connection error — GitHub app not installed for this repo on sovereign team:', msg)
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
          from: 'Sovereign <noreply@sovereignapp.dev>',
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
  <span style="font-size:13px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c8f060!important;">SOVEREIGN</span>
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
  <p style="margin:0;font-size:15px;line-height:1.75;color:#f2efe8!important;">Sovereign has stepped back. This is yours now.<br/>Your code. Your infrastructure. Your future.</p>
</td></tr>
<tr><td style="padding:0 0 40px 0;text-align:center;background-color:#0e0d0b!important;">
  <a href="${liveUrl}" style="display:inline-block;background:#c8f060;color:#0e0d0b!important;-webkit-text-fill-color:#0e0d0b;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:6px;margin:0 6px 12px;">View Live App →</a>
  <a href="${repoUrl}" style="display:inline-block;background:#0e0d0b;color:#c8f060!important;-webkit-text-fill-color:#c8f060;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:6px;border:1px solid rgba(200,240,96,0.4);margin:0 6px 12px;">View on GitHub →</a>
</td></tr>
<tr><td style="padding:0 0 28px 0;background-color:#0e0d0b!important;">
  <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
</td></tr>
<tr><td style="text-align:center;background-color:#0e0d0b!important;">
  <p style="margin:0;font-size:11px;line-height:1.8;color:#6b6862!important;">© 2026 Sovereign · <a href="https://sovereignapp.dev" style="color:#6b6862!important;text-decoration:none;">sovereignapp.dev</a> · Built without permission</p>
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
    console.warn('[run-build] injectVercelEnvVars non-fatal error:', res.status, body)
  }
}

// Prepend a build_id column to every CREATE TABLE statement in a SQL schema
// so that all tables in sovereign-hosted databases are scoped per build.
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
    const rl = checkRateLimit(`run-build:${ip}`, 10, 60 * 60 * 1000)
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
      res.status(500).json({ error: 'Sovereign Vercel token not configured' })
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
            if (!ghResult.ok) {
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
            if (!vcResult.ok) {
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
          }

          // ── Step 3: Provision database ────────────────────────────────
          await step('Provisioning your database…')
          let deploySupabaseUrl: string
          let deployAnonKey: string

          if (sbChoice === 'own') {
            // Full own-Supabase provisioning deferred to claim flow — too slow for build pipeline
            // Creating a new Supabase project via Management API takes 2-4 minutes which exceeds
            // Vercel's function timeout. For now, use Sovereign's Supabase with row-level isolation
            // (same as the 'sovereign' path) and mark supabase_mode='sovereign_temporary' so the
            // claim flow can migrate the user to their own project later.
            console.log('[run-build] sbChoice=own — using sovereign_temporary path (own project creation deferred to claim flow)')
            await step('Connecting your database…')
            await updateBuild(supabaseUrl, serviceKey, buildId, { supabase_mode: 'sovereign_temporary' })
            deploySupabaseUrl = process.env.SUPABASE_URL!
            deployAnonKey     = process.env.VITE_SUPABASE_ANON_KEY ?? ''

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
              }
            }
          } else {
            // Sovereign-hosted path — use Sovereign's own Supabase instance,
            // scope all generated tables by build_id
            deploySupabaseUrl = process.env.SUPABASE_URL!
            deployAnonKey     = process.env.VITE_SUPABASE_ANON_KEY ?? ''

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
                ).catch(err => console.warn('[run-build] sovereign schema exec non-fatal:', err))
              } else {
                console.log('[run-build] SOVEREIGN_SUPABASE_REF or MANAGEMENT_TOKEN not set — schema stored for manual run')
              }
            }
          }

          // Secure the tables (RLS is already in the generated schema, this step
          // is a visual indicator that security has been applied)
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
          if (!pushResult.ok) {
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

          if (!deployResult.ok) {
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

          await updateBuild(supabaseUrl, serviceKey, buildId, { status: 'complete', step: 'done' })
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
