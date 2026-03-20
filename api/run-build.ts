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
// Self-contained: no imports from src/ or server/.

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

interface BuildRecord {
  id: string
  email: string
  app_name: string
  idea: string
  template: string
  github_token: string
  vercel_token: string
  status: string
  step: string | null
  repo_url: string | null
  deploy_url: string | null
  error: string | null
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

// Remove localhost and relative-path script/link tags that won't resolve in
// the deployed repo. Google Fonts and other CDN links are left intact.
function sanitizeTemplate(html: string): string {
  html = html.replace(
    /<script\b[^>]*\bsrc=["'](?:https?:\/\/localhost[^"']*|\/[^"']*)[^>]*>\s*<\/script>/gi,
    '',
  )
  html = html.replace(
    /<link\b[^>]*\bhref=["'](?:https?:\/\/localhost[^"']*|\/[^"']*)[^>]*\/?>/gi,
    '',
  )
  return html
}

function buildStaticFiles(
  template: string,
  appName: string,
  appSlug: string,
): Record<string, string> {
  const sanitized = sanitizeTemplate(template)
  return {
    'package.json': JSON.stringify({
      name: appSlug,
      version: '0.1.0',
      private: true,
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      devDependencies: { vite: '^5.0.0' },
      engines: { node: '20.x' },
    }, null, 2),
    'index.html': sanitized,
    'vite.config.js': [
      "import { defineConfig } from 'vite'",
      '',
      'export default defineConfig({',
      '  build: {',
      "    outDir: 'dist'",
      '  }',
      '})',
      '',
    ].join('\n'),
    '.gitignore': 'node_modules/\ndist/\n.env\n.env.local\n.vercel/\n',
    'README.md': [
      `# ${appName}`,
      '',
      'Built with [Sovereign](https://sovereignapp.dev).',
      '',
      '## Run locally',
      '```bash',
      'npm install',
      'npm run dev',
      '```',
      '',
      '## Deploy',
      '',
      'This app auto-deploys to Vercel on every push to main.',
      '',
      '## You own everything',
      '',
      'Your code is in this repo. Your deployment is on your Vercel account.',
      'Sovereign provisioned it — you own it.',
      '',
    ].join('\n'),
    'vercel.json': JSON.stringify(
      { rewrites: [{ source: '/(.*)', destination: '/index.html' }] },
      null, 2,
    ),
  }
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
  template: string,
  appName: string,
  appSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // The Contents API creates a file + commit in one call and works correctly
  // on empty repos. Must be sequential: each commit moves HEAD, so concurrent
  // calls would race and conflict.
  const files = buildStaticFiles(template, appName, appSlug)
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
  token: string,
  repoName: string,
  githubRepoUrl: string,
): Promise<{ ok: true; projectId: string; teamId: string | undefined } | { ok: false; error: string }> {
  const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) return { ok: false, error: `Invalid GitHub repo URL: ${githubRepoUrl}` }
  const [, githubOrg, githubRepo] = match

  // ── Resolve teamId ────────────────────────────────────────────────────────
  // Integration OAuth tokens for team accounts require ?teamId=<id> on every
  // API call, otherwise /v9/projects returns 403.
  console.log('[run-build] Vercel: fetching user info to resolve teamId')
  const { ok: userOk, data: vcUser } = await vercelFetch('/v2/user', token)
  if (!userOk) {
    console.warn('[run-build] Vercel: /v2/user failed, proceeding without teamId:', JSON.stringify(vcUser))
  }
  const teamId = (vcUser?.user as Record<string, unknown> | undefined)?.defaultTeamId as string | undefined
  const teamQ  = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  console.log('[run-build] Vercel: defaultTeamId:', teamId ?? 'none (personal account)')

  // ── Create project ────────────────────────────────────────────────────────
  console.log('[run-build] Vercel: creating project', repoName, 'endpoint: /v9/projects' + teamQ)
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
  if (!projOk) {
    const msg = (project.error as Record<string, unknown>)?.message ?? JSON.stringify(project)
    return { ok: false, error: `Failed to create Vercel project (${projStatus}): ${String(msg)}` }
  }

  const projectId = project.id as string
  console.log('[run-build] Vercel: project created', projectId)
  return { ok: true, projectId, teamId }
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
  token: string,
  deploymentId: string,
  teamId: string | undefined,
): Promise<string> {
  try {
    const teamParam = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
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
  token: string,
  projectId: string,
  teamId: string | undefined,
  fallbackUrl: string,
  maxMs: number,
): Promise<{ ok: true; deployUrl: string } | { ok: false; error: string }> {
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
        const logs = await fetchDeploymentError(token, d.uid, teamId)
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

// ── Handler ───────────────────────────────────────────────────────────────────

const PROVISION_TIMEOUT_MS = 50_000 // 50s — leaves 10s margin within the 60s maxDuration

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
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

    const { id: buildId } = body ?? {}
    if (!buildId) {
      res.status(400).json({ error: '`id` (buildId) is required' })
      return
    }

    console.log('[run-build] fetching build', buildId)
    const build = await getBuild(supabaseUrl, serviceKey, buildId)
    if (!build) {
      res.status(404).json({ error: 'Build not found' })
      return
    }
    console.log('[run-build] build status:', build.status,
      'github_token:', build.github_token ? 'SET' : 'NULL',
      'vercel_token:', build.vercel_token ? 'SET' : 'NULL')

    // Idempotency guard — prevents double-trigger from React StrictMode
    if (build.status !== 'queued') {
      console.log('[run-build] skipping — status is', build.status)
      res.status(200).json({ ok: true, skipped: true, status: build.status })
      return
    }

    if (!build.github_token || !build.vercel_token) {
      console.log('[run-build] missing tokens — github_token:', build.github_token ? 'SET' : 'NULL', 'vercel_token:', build.vercel_token ? 'SET' : 'NULL')
      res.status(400).json({ error: 'Build is missing OAuth tokens — complete both OAuth steps first' })
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

    try {
      await Promise.race([
        // ── Provisioning work ──────────────────────────────────────────────
        (async () => {
          await step('Reading your idea…')

          // ── Step 1: Create GitHub repo (no file push yet) ─────────────
          // Files are pushed in step 3, AFTER the Vercel project is created,
          // so the GitHub push triggers Vercel's auto-deploy.
          await step('Creating your GitHub repo…')
          const ghResult = await createGitHubRepo(build.github_token, repoName)
          if (!ghResult.ok) {
            await updateBuild(supabaseUrl, serviceKey, buildId, {
              status: 'failed', step: 'GitHub failed', error: ghResult.error,
            })
            return
          }
          await updateBuild(supabaseUrl, serviceKey, buildId, {
            status: 'building',
            step: `Repo created at ${ghResult.repoUrl}`,
            repo_url: ghResult.repoUrl,
          })

          // ── Step 2: Create Vercel project (linked to GitHub repo) ─────
          // Integration OAuth tokens cannot trigger /v13/deployments (403).
          // Creating the project establishes the GitHub link so that the
          // push in step 3 triggers an automatic deployment.
          await step('Connecting Vercel to your repo…')
          const vcResult = await createVercelProject(build.vercel_token, repoName, ghResult.repoUrl)
          if (!vcResult.ok) {
            await deleteGitHubRepo(build.github_token, ghResult.owner, repoName)
            await updateBuild(supabaseUrl, serviceKey, buildId, {
              status: 'failed', step: 'Vercel setup failed', error: vcResult.error,
            })
            return
          }

          // ── Step 3: Push files to GitHub → triggers Vercel auto-deploy ─
          await step('Pushing your app files…')
          console.log('[run-build] template length:', build.template?.length ?? 0)
          const pushResult = await pushFilesToGitHub(
            build.github_token, ghResult.owner, repoName, build.template,
            build.app_name, nameSlug,
          )
          if (!pushResult.ok) {
            await deleteGitHubRepo(build.github_token, ghResult.owner, repoName)
            await updateBuild(supabaseUrl, serviceKey, buildId, {
              status: 'failed', step: 'File push failed', error: pushResult.error,
            })
            return
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
            build.vercel_token, vcResult.projectId, vcResult.teamId,
            fallbackUrl, pollBudgetMs,
          )

          if (!deployResult.ok) {
            // Deployment errored on Vercel's side
            await updateBuild(supabaseUrl, serviceKey, buildId, {
              status: 'failed', step: 'Vercel deploy failed', error: deployResult.error,
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
              deployResult.deployUrl, ghResult.repoUrl,
            )
          }

          await updateBuild(supabaseUrl, serviceKey, buildId, { status: 'done', step: 'done' })
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
      await updateBuild(supabaseUrl, serviceKey, buildId, {
        status: 'failed',
        step: 'Build failed',
        error: provisionErr instanceof Error ? provisionErr.message : String(provisionErr),
      }).catch(() => {/* ignore secondary write error */})
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
