// api/run-build.ts — Vercel Serverless Function
//
// POST /api/run-build
// Body: { id: buildId }
//
// Runs the full provisioning sequence for a build that has both
// github_token and vercel_token stored (status === 'queued').
// Writes step updates to the builds table throughout so the /building
// page can display real-time progress via polling.
//
// Steps:
//   1. GitHub repo creation + template push
//   2. Vercel project + deployment
//   3. Welcome email via Resend
//
// Supabase provisioning is intentionally skipped for the web flow
// (requires a management key the user doesn't have at sign-up time).
//
// Self-contained: no imports from src/ or server/.

// Increase the Vercel function timeout. Pro/Enterprise supports up to 300s.
// Hobby plan is limited to 60s — GitHub + Vercel deploy typically fits within that.
export const maxDuration = 300

// ── Supabase helper ────────────────────────────────────────────────────────

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

async function getBuild(supabaseUrl: string, serviceKey: string, id: string): Promise<BuildRecord | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
    },
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
  await fetch(
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
  )
}

// ── GitHub provisioning (self-contained) ──────────────────────────────────

function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

async function ghFetch(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json() as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

function buildStarterFiles(projectName: string): Record<string, string> {
  return {
    '.gitignore': 'node_modules\ndist\n.env\n.env.local\n*.local\n',

    'package.json': JSON.stringify({
      name: projectName,
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc -b && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
      devDependencies: {
        '@types/react': '^19.0.0',
        '@types/react-dom': '^19.0.0',
        '@vitejs/plugin-react': '^4.3.4',
        typescript: '~5.6.2',
        vite: '^6.0.0',
      },
    }, null, 2),

    'index.html': [
      '<!doctype html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      `    <meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
      `    <title>${projectName}</title>`,
      '  </head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <script type="module" src="/src/main.tsx"></script>',
      '  </body>',
      '</html>',
    ].join('\n'),

    'vite.config.ts': [
      "import { defineConfig } from 'vite'",
      "import react from '@vitejs/plugin-react'",
      '',
      'export default defineConfig({',
      '  plugins: [react()],',
      '})',
    ].join('\n'),

    'tsconfig.json': JSON.stringify(
      { files: [], references: [{ path: './tsconfig.app.json' }] },
      null, 2,
    ),

    'tsconfig.app.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        moduleDetection: 'force',
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ['src'],
    }, null, 2),

    'src/main.tsx': [
      "import { StrictMode } from 'react'",
      "import { createRoot } from 'react-dom/client'",
      "import App from './App.tsx'",
      '',
      "createRoot(document.getElementById('root')!).render(",
      '  <StrictMode><App /></StrictMode>,',
      ')',
    ].join('\n'),

    'src/App.tsx': [
      'function App() {',
      '  return (',
      "    <main style={{ fontFamily: 'monospace', padding: '2rem' }}>",
      `      <h1>${projectName}</h1>`,
      '      <p>Your app. Your code. Your infrastructure.</p>',
      '      <p style={{ color: \'#6b6862\', fontSize: \'0.875rem\' }}>',
      "        Built with{' '}",
      "        <a href=\"https://sovereignapp.dev\" style={{ color: 'inherit' }}>",
      '          Sovereign',
      '        </a>',
      "        {' '}— you own everything.",
      '      </p>',
      '    </main>',
      '  )',
      '}',
      '',
      'export default App',
    ].join('\n'),
  }
}

async function provisionGitHub(
  token: string,
  projectName: string,
): Promise<{ ok: true; repoUrl: string; cloneUrl: string } | { ok: false; error: string }> {
  // Verify token + get user login
  const { ok: userOk, data: user } = await ghFetch('/user', token)
  if (!userOk) {
    return { ok: false, error: `GitHub auth failed: ${String(user.message ?? 'unknown')}` }
  }
  const owner = user.login as string

  // Create repo
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

  // Push starter files
  const files = buildStarterFiles(projectName)
  for (const [path, content] of Object.entries(files)) {
    const { ok, data } = await ghFetch(
      `/repos/${owner}/${projectName}/contents/${path}`,
      token, 'PUT',
      {
        message: path === '.gitignore' ? 'Initial commit' : `Add ${path}`,
        content: toBase64(content),
      },
    )
    if (!ok) {
      return { ok: false, error: `Failed to push ${path}: ${String(data.message ?? JSON.stringify(data))}` }
    }
  }

  return { ok: true, repoUrl: repo.html_url as string, cloneUrl: repo.clone_url as string }
}

// ── Vercel provisioning (self-contained) ──────────────────────────────────

async function vercelFetch(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json() as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

async function provisionVercel(
  token: string,
  repoName: string,
  githubRepoUrl: string,
): Promise<{ ok: true; deployUrl: string } | { ok: false; error: string }> {
  const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) return { ok: false, error: `Invalid GitHub repo URL: ${githubRepoUrl}` }
  const [, githubOrg, githubRepo] = match

  // Create Vercel project linked to the GitHub repo
  const { ok: projOk, data: project } = await vercelFetch(
    '/v9/projects', token, 'POST',
    {
      name: repoName,
      framework: 'vite',
      gitRepository: { type: 'github', repo: `${githubOrg}/${githubRepo}` },
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
      installCommand: 'npm install',
    },
  )
  if (!projOk) {
    const msg = (project.error as Record<string, unknown>)?.message ?? JSON.stringify(project)
    return { ok: false, error: `Failed to create Vercel project: ${String(msg)}` }
  }

  const projectId = project.id as string

  // Trigger production deployment
  const { ok: deployOk, data: deployment } = await vercelFetch(
    '/v13/deployments', token, 'POST',
    {
      name: repoName,
      project: projectId,
      gitSource: { type: 'github', org: githubOrg, repo: githubRepo, ref: 'main' },
      target: 'production',
    },
  )
  if (!deployOk) {
    const msg = (deployment.error as Record<string, unknown>)?.message ?? JSON.stringify(deployment)
    return { ok: false, error: `Vercel project created but deployment failed: ${String(msg)}` }
  }

  return { ok: true, deployUrl: `https://${String(deployment.url)}` }
}

// ── Email (self-contained) ─────────────────────────────────────────────────

async function sendLaunchEmail(
  resendKey: string,
  email: string,
  appName: string,
  liveUrl: string,
  repoUrl: string,
): Promise<void> {
  try {
    await fetch('https://api.resend.com/emails', {
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
    })
  } catch (err) {
    // Email failure is non-fatal — log and continue
    console.warn('[run-build] email send failed:', err)
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

// ── Handler ────────────────────────────────────────────────────────────────

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

    // ── Fetch build record ─────────────────────────────────────────────────
    const build = await getBuild(supabaseUrl, serviceKey, buildId)
    if (!build) {
      res.status(404).json({ error: 'Build not found' })
      return
    }

    // Idempotency guard: only run if queued (prevents double-trigger from StrictMode)
    if (build.status !== 'queued') {
      res.status(200).json({ ok: true, skipped: true, status: build.status })
      return
    }

    if (!build.github_token || !build.vercel_token) {
      res.status(400).json({ error: 'Build is missing OAuth tokens — complete both OAuth steps first' })
      return
    }

    // Respond immediately so the browser doesn't wait on the long-running work.
    // The build continues after the response is sent.
    res.status(202).json({ ok: true, buildId })

    // ── Run provisioning (after response flushed) ──────────────────────────
    try {
      const step = (s: string) =>
        updateBuild(supabaseUrl, serviceKey, buildId, { status: 'building', step: s })

      await step('Reading your idea…')

      // Step 1 — GitHub
      await step('Creating your GitHub repo…')
      const ghResult = await provisionGitHub(build.github_token, build.app_name)
      if (!ghResult.ok) {
        const ghError = ghResult.error
        await updateBuild(supabaseUrl, serviceKey, buildId, {
          status: 'failed', step: 'GitHub failed', error: ghError,
        })
        return
      }
      await updateBuild(supabaseUrl, serviceKey, buildId, {
        status: 'building',
        step: `Repo created at ${ghResult.repoUrl}`,
        repo_url: ghResult.repoUrl,
      })

      // Step 2 — Vercel
      await step('Deploying to Vercel…')
      const vcResult = await provisionVercel(build.vercel_token, build.app_name, ghResult.repoUrl)
      if (!vcResult.ok) {
        const vcError = vcResult.error
        await updateBuild(supabaseUrl, serviceKey, buildId, {
          status: 'failed', step: 'Vercel deploy failed', error: vcError,
        })
        return
      }
      await updateBuild(supabaseUrl, serviceKey, buildId, {
        status: 'building',
        step: `Live at ${vcResult.deployUrl}`,
        deploy_url: vcResult.deployUrl,
      })

      // Step 3 — Email
      await step('Sending your live URL…')
      if (resendKey) {
        await sendLaunchEmail(resendKey, build.email, build.app_name, vcResult.deployUrl, ghResult.repoUrl)
      }

      // Done
      await updateBuild(supabaseUrl, serviceKey, buildId, {
        status: 'done',
        step: 'done',
      })
    } catch (buildErr) {
      console.error('[run-build] provisioning error:', buildErr)
      await updateBuild(supabaseUrl, serviceKey, buildId, {
        status: 'failed',
        step: 'Unexpected error',
        error: buildErr instanceof Error ? buildErr.message : String(buildErr),
      }).catch(() => {/* ignore secondary error */})
    }
  } catch (err) {
    console.error('[run-build] unhandled exception:', err)
    // res may already be sent; only write if headers not sent
    try {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    } catch {/* already responded */}
  }
}
