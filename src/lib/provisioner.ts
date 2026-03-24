// src/lib/provisioner.ts
//
// The Sovereign provisioning engine.
// All four functions are independently callable and fully typed.
// All tokens are passed as parameters — never pulled from global state.
// Used by both the web flow and the CLI.

// ─── Return Types ─────────────────────────────────────────────────────────────

export interface GitHubResult {
  repoUrl: string
  cloneUrl: string
  success: boolean
  error?: string
}

export interface VercelResult {
  deployUrl: string
  projectUrl: string
  success: boolean
  error?: string
}

export interface SupabaseResult {
  supabaseUrl: string
  anonKey: string
  success: boolean
  error?: string
}

export interface EmailResult {
  success: boolean
  error?: string
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function toBase64(str: string): string {
  // btoa is global in Node.js v16+ and all modern browsers.
  // Percent-encode first so multibyte UTF-8 characters survive the ASCII-only btoa.
  return btoa(unescape(encodeURIComponent(str)))
}

async function ghFetch(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
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
  } catch (err) {
    return { ok: false, status: 0, data: { message: err instanceof Error ? err.message : 'Network error' } }
  }
}

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

async function supaFetch(
  path: string,
  managementKey: string,
  method = 'GET',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${managementKey}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = res.status === 204 ? null : await res.json()
  return { ok: res.ok, status: res.status, data }
}

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Starter Template ─────────────────────────────────────────────────────────

function buildTemplate(projectName: string, template: string): Record<string, string> {
  const reactViteTs: Record<string, string> = {
    '.gitignore': [
      'node_modules',
      'dist',
      '.env',
      '.env.local',
      '*.local',
    ].join('\n'),

    'package.json': JSON.stringify(
      {
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
      },
      null,
      2,
    ),

    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,

    'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,

    'tsconfig.json': JSON.stringify(
      { files: [], references: [{ path: './tsconfig.app.json' }] },
      null,
      2,
    ),

    'tsconfig.app.json': JSON.stringify(
      {
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
      },
      null,
      2,
    ),

    'src/main.tsx': `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,

    'src/App.tsx': `function App() {
  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>${projectName}</h1>
      <p>Your app. Your code. Your infrastructure.</p>
      <p style={{ color: '#6b6862', fontSize: '0.875rem' }}>
        Built with{' '}
        <a href="https://sovereignapp.dev" style={{ color: 'inherit' }}>
          Sovereign
        </a>{' '}
        — you own everything.
      </p>
    </main>
  )
}

export default App
`,
  }

  // Additional templates can be added here. All fall back to react-vite-ts.
  const templateMap: Record<string, Record<string, string>> = {
    'react-vite-ts': reactViteTs,
  }

  return templateMap[template] ?? reactViteTs
}

// ─── 1. provisionGitHub ───────────────────────────────────────────────────────
//
// Creates a real GitHub repo under the user's own account and pushes a clean
// starter template. Uses the GitHub Contents API — no git CLI required.

export async function provisionGitHub(
  token: string,
  projectName: string,
  template: string,
): Promise<GitHubResult> {
  const fail = (error: string): GitHubResult => ({
    repoUrl: '',
    cloneUrl: '',
    success: false,
    error,
  })

  // 1. Verify the token and get the authenticated user's login
  const { ok: userOk, data: user } = await ghFetch('/user', token)
  if (!userOk) {
    return fail(`GitHub auth failed: ${String(user.message ?? 'Unknown error')}`)
  }
  const owner = user.login as string

  // 2. Create the repository (empty — we'll push files next)
  const { ok: repoOk, status: repoStatus, data: repo } = await ghFetch(
    '/user/repos',
    token,
    'POST',
    {
      name: projectName,
      description: 'Built with Sovereign — sovereignapp.dev',
      private: false,
      auto_init: false,
    },
  )
  if (!repoOk) {
    if (repoStatus === 422) {
      return fail(`Repo "${projectName}" already exists on your GitHub account.`)
    }
    const msg = repo.message ?? JSON.stringify(repo.errors)
    return fail(`Failed to create repo: ${String(msg)}`)
  }

  // 3. Push every template file via the Contents API (each is its own commit)
  const files = buildTemplate(projectName, template)
  for (const [path, content] of Object.entries(files)) {
    const { ok, data } = await ghFetch(
      `/repos/${owner}/${projectName}/contents/${path}`,
      token,
      'PUT',
      {
        message: path === '.gitignore' ? 'Initial commit' : `Add ${path}`,
        content: toBase64(content),
      },
    )
    if (!ok) {
      return fail(`Failed to push ${path}: ${String(data.message ?? JSON.stringify(data))}`)
    }
  }

  return {
    repoUrl: repo.html_url as string,
    cloneUrl: repo.clone_url as string,
    success: true,
  }
}

// ─── 2. provisionVercel ───────────────────────────────────────────────────────
//
// Connects the GitHub repo to the user's own Vercel account and triggers a
// production deployment. Requires the GitHub integration to be installed on
// Vercel (one-time setup at vercel.com/account/integrations).

export async function provisionVercel(
  token: string,
  repoName: string,
  githubRepoUrl: string,
): Promise<VercelResult> {
  const fail = (error: string): VercelResult => ({
    deployUrl: '',
    projectUrl: '',
    success: false,
    error,
  })

  // Parse owner/repo from the GitHub URL (e.g. https://github.com/alice/my-app)
  const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) return fail(`Invalid GitHub repo URL: ${githubRepoUrl}`)
  const [, githubOrg, githubRepo] = match

  // 1. Create Vercel project linked to the GitHub repo
  const { ok: projOk, data: project } = await vercelFetch(
    '/v9/projects',
    token,
    'POST',
    {
      name: repoName,
      framework: 'vite',
      gitRepository: {
        type: 'github',
        repo: `${githubOrg}/${githubRepo}`,
      },
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
      installCommand: 'npm install',
    },
  )
  if (!projOk) {
    const msg = (project.error as Record<string, unknown>)?.message ?? JSON.stringify(project)
    return fail(`Failed to create Vercel project: ${String(msg)}`)
  }

  const projectId = project.id as string
  const accountSlug = (project.link as Record<string, unknown>)?.org as string | undefined
  const projectUrl = accountSlug
    ? `https://vercel.com/${accountSlug}/${repoName}`
    : `https://vercel.com/dashboard`

  // 2. Trigger a production deployment from the main branch
  const { ok: deployOk, data: deployment } = await vercelFetch(
    '/v13/deployments',
    token,
    'POST',
    {
      name: repoName,
      project: projectId,
      gitSource: {
        type: 'github',
        org: githubOrg,
        repo: githubRepo,
        ref: 'main',
      },
      target: 'production',
    },
  )
  if (!deployOk) {
    const msg = (deployment.error as Record<string, unknown>)?.message ?? JSON.stringify(deployment)
    return fail(`Vercel project created but deployment failed: ${String(msg)}`)
  }

  const deployUrl = `https://${String(deployment.url)}`

  return { deployUrl, projectUrl, success: true }
}

// ─── 3. provisionSupabase ─────────────────────────────────────────────────────
//
// Creates a new Supabase project under the user's account and sets up a base
// schema. `managementKey` is a Supabase personal access token (not a project
// service key) — obtained at app.supabase.com/account/tokens.
//
// Note: Supabase project provisioning takes ~2 minutes. This function polls
// until the project is ACTIVE_HEALTHY before returning.

export async function provisionSupabase(
  managementKey: string,
  projectName: string,
): Promise<SupabaseResult> {
  const fail = (error: string): SupabaseResult => ({
    supabaseUrl: '',
    anonKey: '',
    success: false,
    error,
  })

  // 1. List organizations — pick the first one
  const { ok: orgsOk, data: orgs } = await supaFetch('/organizations', managementKey)
  if (!orgsOk || !Array.isArray(orgs) || orgs.length === 0) {
    return fail(`Could not list Supabase organizations: ${JSON.stringify(orgs)}`)
  }
  const orgId = (orgs[0] as Record<string, unknown>).id as string

  // 2. Create the project
  const dbPassword = randomHex(16)
  const { ok: projOk, data: proj } = await supaFetch(
    '/projects',
    managementKey,
    'POST',
    {
      name: projectName,
      organization_id: orgId,
      db_pass: dbPassword,
      region: 'us-east-1',
      plan: 'free',
    },
  )
  if (!projOk) {
    return fail(`Failed to create Supabase project: ${JSON.stringify(proj)}`)
  }

  const projectRef = (proj as Record<string, unknown>).id as string
  const supabaseUrl = `https://${projectRef}.supabase.co`

  // 3. Poll until ACTIVE_HEALTHY (max 5 minutes)
  const ready = await pollSupabaseProject(managementKey, projectRef, 300_000)
  if (!ready) {
    return fail('Supabase project did not become ready within 5 minutes.')
  }

  // 4. Fetch the project's anon key
  const { ok: keysOk, data: keys } = await supaFetch(
    `/projects/${projectRef}/api-keys`,
    managementKey,
  )
  if (!keysOk || !Array.isArray(keys)) {
    return fail(`Failed to fetch Supabase API keys: ${JSON.stringify(keys)}`)
  }
  const anonKey =
    (keys as Array<{ name: string; api_key: string }>).find((k) => k.name === 'anon')?.api_key ?? ''

  // 5. Set up base schema
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      email      text        UNIQUE NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS waitlist (
      id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      email      text        UNIQUE NOT NULL,
      source     text        DEFAULT 'landing',
      created_at timestamptz DEFAULT now()
    );
  `
  const { ok: sqlOk, data: sqlResult } = await supaFetch(
    `/projects/${projectRef}/database/query`,
    managementKey,
    'POST',
    { query: schema },
  )
  if (!sqlOk) {
    return fail(`Schema setup failed: ${JSON.stringify(sqlResult)}`)
  }

  return { supabaseUrl, anonKey, success: true }
}

async function pollSupabaseProject(
  managementKey: string,
  projectRef: string,
  maxWaitMs: number,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const { ok, data } = await supaFetch(`/projects/${projectRef}`, managementKey)
    if (ok && (data as Record<string, unknown>)?.status === 'ACTIVE_HEALTHY') return true
    await new Promise<void>((r) => setTimeout(r, 5_000))
  }
  return false
}

// ─── 4. sendWelcomeEmail ──────────────────────────────────────────────────────
//
// Sends a plain-text welcome email via Resend.
// `resendKey` is the platform's Resend API key (RESEND_API_KEY env var).

export async function sendWelcomeEmail(
  resendKey: string,
  email: string,
  projectName: string,
  liveUrl: string,
  repoUrl: string,
): Promise<EmailResult> {
  const body = [
    `Your project "${projectName}" is live.`,
    ``,
    `Live URL:  ${liveUrl}`,
    `GitHub:    ${repoUrl}`,
    ``,
    `Sovereign has stepped back. This is yours now.`,
    ``,
    `— The Sovereign team`,
    `sovereignapp.dev`,
  ].join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Sovereign <noreply@sovereignapp.dev>',
      to: [email],
      subject: 'Your app is live — you own everything',
      text: body,
    }),
  })

  if (!res.ok) {
    const err = await res.json() as Record<string, unknown>
    return { success: false, error: String(err.message ?? `Resend error ${res.status}`) }
  }

  return { success: true }
}
