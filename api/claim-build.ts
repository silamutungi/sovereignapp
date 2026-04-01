// api/claim-build.ts — Vercel Serverless Function
//
// POST /api/claim-build
// Body: { build_id: string }
//
// Transfers a staged build to the user's own GitHub + Vercel accounts.
//
// Steps:
//   1. Rate limit (5/hr per IP)
//   2. Fetch build — must be staging=true, claimed_at IS NULL
//   3. GitHub transfer — if repo is on SOVEREIGN_GITHUB_ORG, transfer it
//   4. Create Vercel project on user's account (using stored vercel_token)
//   5. Delete staging Vercel project (using SOVEREIGN_VERCEL_TOKEN)
//   6. Update builds: claimed_at, staging=false, claim_status, claimed_url
//   7. Send "Your app is on its way" email via Resend
//
// SECURITY AUDIT
// - Rate limited: 5/hr per IP
// - build_id validated as UUID
// - Tokens read from server-side DB only (never from request body)
// - SOVEREIGN_VERCEL_TOKEN/SOVEREIGN_GITHUB_TOKEN never exposed in responses

import { checkRateLimit, getClientIp } from './_rateLimit.js'

export const maxDuration = 120

const NET = 15_000 // 15s per network call

function fetchWithTimeout(url: string, options: RequestInit, ms = NET): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

// ── Supabase helpers ───────────────────────────────────────────────────────────

interface ClaimBuildRecord {
  id: string
  email: string
  app_name: string
  repo_url: string | null
  deploy_url: string | null
  github_token: string | null
  vercel_token: string | null
  vercel_project_id: string | null
  claim_status: string | null
  claimed_at: string | null
  staging: boolean | null
}

async function fetchBuild(
  supabaseUrl: string,
  serviceKey: string,
  id: string,
): Promise<ClaimBuildRecord | null> {
  const res = await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(id)}&select=id,email,app_name,repo_url,deploy_url,github_token,vercel_token,vercel_project_id,claim_status,claimed_at,staging`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
    },
  )
  if (!res.ok) return null
  const rows = await res.json() as ClaimBuildRecord[]
  return rows[0] ?? null
}

async function patchBuild(
  supabaseUrl: string,
  serviceKey: string,
  id: string,
  patch: Record<string, unknown>,
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
  )
}

async function recordLesson(
  supabaseUrl: string,
  serviceKey: string,
  buildId: string,
  problem: string,
): Promise<void> {
  try {
    await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/lessons`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          category: 'deployment',
          source: `build:${buildId}`,
          problem,
          solution: '',
          applied_automatically: false,
          build_count: 1,
        }),
      },
    )
  } catch (err) {
    console.error('[claim-build] lesson record failed (non-fatal):', err)
  }
}

// ── GitHub helpers ─────────────────────────────────────────────────────────────

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
  )
  const data = await res.json() as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

// ── Vercel helpers ─────────────────────────────────────────────────────────────

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
  )
  const data = await res.json() as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

// ── Email ──────────────────────────────────────────────────────────────────────

function claimEmailHtml(appName: string, claimedUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appName} is on its way to you</title>
</head>
<body style="margin:0;padding:0;background-color:#0e0d0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f2efe8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0e0d0b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#0e0d0b;">

          <!-- Wordmark -->
          <tr>
            <td style="padding:0 0 36px 0;text-align:center;">
              <span style="font-size:13px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c8f060;">VISILA</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:0 0 12px 0;text-align:center;">
              <h1 style="margin:0;font-size:40px;font-weight:800;line-height:1;color:#f2efe8;letter-spacing:-0.02em;">${appName} is on its way.</h1>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 0 32px 0;"><div style="height:1px;background:rgba(200,240,96,0.2);"></div></td></tr>

          <!-- What happens next -->
          <tr>
            <td style="padding:0 0 28px 0;background:#1a1917;border-radius:8px;border:1px solid rgba(200,240,96,0.15);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:24px 24px 8px;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c8f060;">What happens next</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 24px 8px;">
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#f2efe8;">
                      <strong style="color:#c8f060;">1. Check your GitHub email</strong><br/>
                      GitHub will send you a transfer confirmation. One click, and the repository is yours.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 24px 8px;">
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#f2efe8;">
                      <strong style="color:#c8f060;">2. Accept the transfer</strong><br/>
                      Once you accept, the GitHub repo will appear in your account and Vercel will start a fresh deployment.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 24px 24px;">
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#f2efe8;">
                      <strong style="color:#c8f060;">3. Your app goes live on your domain</strong><br/>
                      Your new Vercel URL: <a href="${claimedUrl}" style="color:#8ab800;">${claimedUrl.replace('https://', '')}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 0 0 0;text-align:center;">
              <a href="${claimedUrl}" style="display:inline-block;background:#c8f060;color:#0e0d0b;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:6px;letter-spacing:0.01em;">View your app →</a>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:32px 0 24px 0;"><div style="height:1px;background:rgba(200,240,96,0.2);"></div></td></tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center;">
              <p style="margin:0;font-size:11px;line-height:1.8;color:#6b6862;">© 2026 Visila &nbsp;·&nbsp; <a href="https://visila.com" style="color:#6b6862;text-decoration:none;">visila.com</a> &nbsp;·&nbsp; Built without permission</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function sendClaimEmail(
  resendKey: string,
  email: string,
  appName: string,
  claimedUrl: string,
): Promise<void> {
  const res = await fetchWithTimeout(
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
        subject: `${appName} is on its way to you`,
        html: claimEmailHtml(appName, claimedUrl),
      }),
    },
  )
  if (!res.ok) {
    const err = await res.json() as Record<string, unknown>
    throw new Error(`Resend error ${res.status}: ${String(err.message ?? JSON.stringify(err))}`)
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // ── Rate limit ───────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const rl = checkRateLimit(`claim-build:${ip}`, 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: 'Too many requests. Try again later.' })
    return
  }

  // ── Env vars ─────────────────────────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey   = process.env.RESEND_API_KEY
  const sovVercelToken = process.env.SOVEREIGN_VERCEL_TOKEN
  const sovVercelTeamId = process.env.SOVEREIGN_VERCEL_TEAM_ID
  const sovGithubOrg   = process.env.SOVEREIGN_GITHUB_ORG   // optional — only set if repos are on a sovereign org
  const sovGithubToken = process.env.SOVEREIGN_GITHUB_TOKEN // optional — service account token for sovereign org

  if (!supabaseUrl || !serviceKey) {
    console.error('[claim-build] Missing Supabase env vars')
    res.status(500).json({ error: 'Server configuration error' })
    return
  }
  if (!sovVercelToken) {
    console.error('[claim-build] Missing SOVEREIGN_VERCEL_TOKEN')
    res.status(500).json({ error: 'Server configuration error' })
    return
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: Record<string, string>
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  const { build_id } = body ?? {}
  if (!build_id || typeof build_id !== 'string') {
    res.status(400).json({ error: 'build_id is required' })
    return
  }
  // Validate UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(build_id)) {
    res.status(400).json({ error: 'Invalid build_id' })
    return
  }

  // ── Fetch build ──────────────────────────────────────────────────────────────
  const build = await fetchBuild(supabaseUrl, serviceKey, build_id)
  if (!build) {
    res.status(404).json({ error: 'Build not found' })
    return
  }
  if (!build.staging) {
    res.status(400).json({ error: 'Build is not a staged build' })
    return
  }
  if (build.claimed_at) {
    res.status(400).json({ error: 'Build has already been claimed' })
    return
  }
  if (build.claim_status === 'claiming') {
    res.status(400).json({ error: 'Claim already in progress' })
    return
  }

  const githubToken  = build.github_token
  const vercelToken  = build.vercel_token
  const repoUrl      = build.repo_url

  if (!githubToken || !vercelToken) {
    res.status(400).json({ error: 'Build is missing OAuth tokens — please reconnect GitHub and Vercel' })
    return
  }
  if (!repoUrl) {
    res.status(400).json({ error: 'Build has no repository URL' })
    return
  }

  // Extract owner/repo from repo_url
  const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?$/)
  if (!repoMatch) {
    res.status(400).json({ error: 'Could not parse repository URL' })
    return
  }
  const [, repoOwner, repoName] = repoMatch

  // Mark as claiming to prevent duplicate claims
  await patchBuild(supabaseUrl, serviceKey, build_id, { claim_status: 'claiming' })

  // ── Step 1: Get user's GitHub username ────────────────────────────────────
  console.log('[claim-build] Getting GitHub user info')
  const { ok: userOk, data: ghUser } = await ghFetch('/user', githubToken)
  if (!userOk) {
    await patchBuild(supabaseUrl, serviceKey, build_id, { claim_status: 'unclaimed' })
    res.status(400).json({ error: 'GitHub token is invalid or expired. Please reconnect GitHub.' })
    return
  }
  const userGithubLogin = String(ghUser.login)
  console.log('[claim-build] GitHub user:', userGithubLogin)

  // ── Step 2: GitHub transfer (only if repo is on a Visila org) ──────────
  // If SOVEREIGN_GITHUB_ORG is set AND the repo is on that org, transfer it.
  // If the repo is already on the user's account, skip (nothing to transfer).
  let githubTransferStatus = 'skipped_already_owned'

  if (sovGithubOrg && sovGithubToken && repoOwner.toLowerCase() === sovGithubOrg.toLowerCase()) {
    console.log('[claim-build] GitHub: initiating transfer from', sovGithubOrg, 'to', userGithubLogin)
    const { ok: transferOk, status: transferStatus, data: transferData } = await ghFetch(
      `/repos/${encodeURIComponent(sovGithubOrg)}/${encodeURIComponent(repoName)}/transfer`,
      sovGithubToken,
      'POST',
      { new_owner: userGithubLogin },
    )

    if (!transferOk) {
      const errMsg = String((transferData as Record<string, unknown>).message ?? `GitHub transfer failed (${transferStatus})`)
      console.error('[claim-build] GitHub transfer failed:', errMsg)
      await patchBuild(supabaseUrl, serviceKey, build_id, { claim_status: 'unclaimed' })
      await recordLesson(supabaseUrl, serviceKey, build_id, `GitHub transfer failed: ${errMsg}`)
      res.status(500).json({ error: `GitHub transfer failed: ${errMsg}` })
      return
    }
    githubTransferStatus = 'pending_github_acceptance'
    console.log('[claim-build] GitHub transfer initiated — user will receive email to accept')
  } else {
    console.log('[claim-build] GitHub: repo already on user account, no transfer needed')
  }

  // Update claim_status after GitHub step
  await patchBuild(supabaseUrl, serviceKey, build_id, { claim_status: 'pending_github_acceptance' })

  // ── Step 3: Create Vercel project on user's account ───────────────────────
  // After a GitHub transfer, the new repo URL uses userGithubLogin as the owner.
  const newRepoOwner = (githubTransferStatus === 'pending_github_acceptance')
    ? userGithubLogin
    : repoOwner

  console.log('[claim-build] Vercel: creating project on user account for', `${newRepoOwner}/${repoName}`)
  const { ok: projOk, status: projStatus, data: projData } = await vercelFetch(
    '/v9/projects',
    vercelToken,
    'POST',
    {
      name: repoName,
      framework: 'vite',
      gitRepository: { type: 'github', repo: `${newRepoOwner}/${repoName}` },
      buildCommand: 'npm run build',
      outputDirectory: 'dist',
      installCommand: 'npm install',
    },
  )

  let claimedUrl = `https://${repoName}.vercel.app`
  let newVercelProjectId: string | null = null

  if (!projOk) {
    const errMsg = String(
      (projData.error as Record<string, unknown> | undefined)?.message
        ?? `Vercel project creation failed (${projStatus}): ${JSON.stringify(projData)}`,
    )
    console.error('[claim-build] Vercel project creation failed:', errMsg)
    await recordLesson(supabaseUrl, serviceKey, build_id, `Claim Vercel project creation failed: ${errMsg}`)

    // Partial transfer — GitHub step succeeded but Vercel failed
    await patchBuild(supabaseUrl, serviceKey, build_id, { claim_status: 'transfer_partial' })
    res.status(500).json({
      error: `Vercel project creation failed: ${errMsg}`,
      partial: true,
      github_transfer_status: githubTransferStatus,
    })
    return
  }

  newVercelProjectId = String(projData.id)
  // Use first alias if available, else construct from project name
  const aliases = projData.alias as Array<{ domain: string }> | undefined
  if (aliases && aliases.length > 0) {
    claimedUrl = `https://${aliases[0].domain}`
  } else {
    claimedUrl = `https://${String(projData.name)}.vercel.app`
  }
  console.log('[claim-build] Vercel: new project created', newVercelProjectId, claimedUrl)

  // ── Step 4: Delete staging Vercel project ─────────────────────────────────
  if (build.vercel_project_id) {
    const teamQ = sovVercelTeamId ? `?teamId=${encodeURIComponent(sovVercelTeamId)}` : ''
    console.log('[claim-build] Vercel: deleting staging project', build.vercel_project_id)
    const { ok: deleteOk, status: deleteStatus } = await vercelFetch(
      `/v9/projects/${encodeURIComponent(build.vercel_project_id)}${teamQ}`,
      sovVercelToken,
      'DELETE',
    )
    if (!deleteOk && deleteStatus !== 404) {
      // Non-fatal: log and continue — user's new project is already set up
      console.warn('[claim-build] Vercel: staging project delete failed (non-fatal), status', deleteStatus)
    } else {
      console.log('[claim-build] Vercel: staging project deleted')
    }
  }

  // ── Step 5: Update build record ───────────────────────────────────────────
  await patchBuild(supabaseUrl, serviceKey, build_id, {
    claimed_at:   new Date().toISOString(),
    staging:      false,
    claim_status: 'claimed',
    claimed_url:  claimedUrl,
    // Keep deploy_url as the staging URL for reference — claimed_url is the new canonical URL
  })
  console.log('[claim-build] Build record updated: claimed')

  // ── Step 6: Send email ────────────────────────────────────────────────────
  if (resendKey) {
    try {
      await sendClaimEmail(resendKey, build.email, build.app_name, claimedUrl)
      console.log('[claim-build] Claim email sent to', build.email)
    } catch (emailErr) {
      console.error('[claim-build] Claim email failed (non-fatal):', emailErr)
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  res.status(200).json({
    ok: true,
    claim_status: 'claimed',
    claimed_url: claimedUrl,
    github_transfer_status: githubTransferStatus,
  })
}
