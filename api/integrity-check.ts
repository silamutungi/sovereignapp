// api/integrity-check.ts
// POST /api/integrity-check
// Called fire-and-forget after every successful Vercel deployment.
// Runs 5 integrity checks and updates the build record with results.
// Non-fatal — never blocks the build pipeline.
//
// SECURITY AUDIT
// - Called server-to-server from run-build.ts (fire-and-forget, non-fatal)
// - No user-supplied authentication required
// - Reads build record via service role key — never exposes tokens
// - Outbound fetches use AbortSignal.timeout to prevent hung connections

export const maxDuration = 30
export const config = { runtime: 'nodejs' }

interface IntegrityResult {
  passed: boolean
  checks: Record<string, { pass: boolean; detail: string }>
  score: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { build_id, deploy_url, repo_url, expected_file_count } =
    (req.body ?? {}) as {
      build_id?: string
      deploy_url?: string
      repo_url?: string
      expected_file_count?: number
    }

  if (!build_id || !deploy_url) {
    res.status(400).json({ error: 'Missing build_id or deploy_url' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const checks: Record<string, { pass: boolean; detail: string }> = {}

  // CHECK 1 — Deployment reachable
  try {
    const r = await fetch(deploy_url, {
      headers: { 'User-Agent': 'Visila-Integrity/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await r.text()
    const reachable = r.ok && html.length > 500
    checks.reachable = {
      pass: reachable,
      detail: reachable
        ? `HTTP ${r.status}, ${html.length} chars`
        : `HTTP ${r.status} or response too short (${html.length} chars)`,
    }

    // CHECK 2 — No runtime errors in page source
    const ERROR_PATTERNS = [
      'Could not find the table',
      'relation does not exist',
      'supabaseUrl is required',
      'Invalid API key',
      'NetworkError',
      'Failed to fetch',
      'Unexpected token',
      'SyntaxError',
    ]
    const errorFound = ERROR_PATTERNS.find((p) =>
      html.toLowerCase().includes(p.toLowerCase())
    )
    checks.no_runtime_errors = {
      pass: !errorFound,
      detail: errorFound
        ? `Runtime error detected: "${errorFound}"`
        : 'No known error patterns found',
    }
  } catch (err) {
    checks.reachable = {
      pass: false,
      detail: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    }
    checks.no_runtime_errors = { pass: false, detail: 'Could not reach deployment' }
  }

  // CHECK 3 — visila.json exists and has completeness score
  try {
    if (repo_url) {
      const rawBase = repo_url
        .replace('github.com', 'raw.githubusercontent.com')
        .replace(/\/$/, '')
      const manifestRes = await fetch(`${rawBase}/main/visila.json`, {
        signal: AbortSignal.timeout(8000),
      })
      if (manifestRes.ok) {
        const manifest = (await manifestRes.json()) as { completenessScore?: number }
        const score = manifest.completenessScore ?? 0
        checks.manifest = {
          pass: score > 0,
          detail: `completenessScore: ${score}%`,
        }
      } else {
        checks.manifest = {
          pass: false,
          detail: `visila.json not found (HTTP ${manifestRes.status})`,
        }
      }
    } else {
      checks.manifest = { pass: false, detail: 'No repo_url provided' }
    }
  } catch (err) {
    checks.manifest = {
      pass: false,
      detail: `Manifest fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // CHECK 4 — Schema isolation (supabase_schema_name populated)
  try {
    if (supabaseUrl && serviceKey) {
      const buildRes = await fetch(
        `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(build_id)}&select=supabase_schema_name,supabase_mode`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      )
      if (buildRes.ok) {
        const rows = (await buildRes.json()) as Array<{
          supabase_schema_name: string | null
          supabase_mode: string | null
        }>
        const row = rows[0]
        if (row?.supabase_mode === 'sovereign_temporary') {
          const isolated = !!row.supabase_schema_name
          checks.schema_isolation = {
            pass: isolated,
            detail: isolated
              ? `Schema: ${row.supabase_schema_name}`
              : 'supabase_schema_name is null — public schema used',
          }
        } else {
          checks.schema_isolation = {
            pass: true,
            detail: `supabase_mode: ${row?.supabase_mode ?? 'unknown'} — isolation not required`,
          }
        }
      } else {
        checks.schema_isolation = { pass: false, detail: 'Could not fetch build record' }
      }
    } else {
      checks.schema_isolation = { pass: false, detail: 'Supabase not configured' }
    }
  } catch (err) {
    checks.schema_isolation = {
      pass: false,
      detail: `Check failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // CHECK 5 — File count matches expected
  try {
    if (repo_url && expected_file_count && expected_file_count > 0) {
      const apiUrl = repo_url
        .replace('github.com/', 'api.github.com/repos/')
        .replace(/\/$/, '')
      const treeRes = await fetch(`${apiUrl}/git/trees/main?recursive=1`, {
        headers: {
          'User-Agent': 'Visila-Integrity/1.0',
          Authorization: `Bearer ${process.env.SOVEREIGN_GITHUB_TOKEN ?? ''}`,
        },
        signal: AbortSignal.timeout(8000),
      })
      if (treeRes.ok) {
        const tree = (await treeRes.json()) as { tree: Array<{ type: string }> }
        const fileCount = tree.tree.filter((n) => n.type === 'blob').length
        const ratio = fileCount / expected_file_count
        const pass = ratio >= 0.8
        checks.file_count = {
          pass,
          detail: `${fileCount} files found, ${expected_file_count} expected (${Math.round(ratio * 100)}%)`,
        }
      } else {
        checks.file_count = { pass: false, detail: `GitHub tree fetch failed (${treeRes.status})` }
      }
    } else {
      checks.file_count = { pass: true, detail: 'No expected count provided — skipped' }
    }
  } catch (err) {
    checks.file_count = {
      pass: false,
      detail: `Check failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const total = Object.keys(checks).length
  const passed = Object.values(checks).filter((c) => c.pass).length
  const score = Math.round((passed / total) * 100)
  const allPassed = passed === total

  try {
    if (supabaseUrl && serviceKey) {
      await fetch(`${supabaseUrl}/rest/v1/audit_log`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          check_name: 'integrity_check',
          passed: allPassed,
          severity: allPassed ? 'info' : 'critical',
          details: { build_id, deploy_url, score, checks },
        }),
      })

      if (!allPassed) {
        const failedChecks = Object.entries(checks)
          .filter(([, v]) => !v.pass)
          .map(([k, v]) => `${k}: ${v.detail}`)
          .join(' | ')

        await fetch(
          `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(build_id)}`,
          {
            method: 'PATCH',
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              integrity_score: score,
              integrity_warnings: failedChecks,
            }),
          }
        )
      } else {
        await fetch(
          `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(build_id)}`,
          {
            method: 'PATCH',
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ integrity_score: score }),
          }
        )
      }
    }
  } catch (err) {
    console.error('[integrity-check] audit log failed:', err)
  }

  const result: IntegrityResult = { passed: allPassed, checks, score }
  console.log('[integrity-check] done:', JSON.stringify({ build_id, score, checks }))
  res.status(200).json(result)
}
