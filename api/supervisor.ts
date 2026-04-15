// api/supervisor.ts — Vercel Cron Function
//
// GET /api/supervisor
// Called daily at 09:00 UTC by Vercel cron (see vercel.json).
// Protected by x-cron-secret header — must match CRON_SECRET env var.
//
// Checks:
//   1. Recent build failure rate (24h)
//   2. Auto-repair success rate
//   3. Stale unclaimed expired builds
//   4. Edit engine health (no-change edits)
//
// Alerts: inserted into audit_log table + email via Resend to sila@visila.com
//
// SECURITY AUDIT
// - Protected by CRON_SECRET header — not public
// - No user-supplied data in queries
// - Reads from Supabase using service role key (server only)
// - Emails sent via Resend — no secrets in responses

export const maxDuration = 30
export const config = { runtime: 'nodejs' }

interface CheckResult {
  name: string
  status: 'pass' | 'alert'
  value: number
  threshold: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // ── CRON_SECRET auth ────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[supervisor] CRON_SECRET not set — rejecting')
    res.status(500).json({ error: 'CRON_SECRET not configured' })
    return
  }
  const incomingSecret = req.headers['x-cron-secret'] as string | undefined
  if (incomingSecret !== cronSecret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey   = process.env.RESEND_API_KEY

  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Supabase not configured' })
    return
  }

  const checks: CheckResult[] = []
  let alertsFired = 0

  // ── Helper: Supabase REST query ─────────────────────────────────────────
  async function supaQuery(path: string): Promise<unknown[]> {
    const url = `${supabaseUrl}/rest/v1/${path}`
    const r = await fetch(url, {
      headers: {
        apikey:        serviceKey!,
        Authorization: `Bearer ${serviceKey!}`,
        Prefer:        'count=exact',
      },
    })
    if (!r.ok) {
      console.error(`[supervisor] query failed: ${path}`, r.status, (await r.text()).slice(0, 200))
      return []
    }
    return await r.json() as unknown[]
  }

  // ── Helper: Insert audit_log entry ──────────────────────────────────────
  async function logAlert(checkName: string, severity: string, _message: string, metadata: Record<string, unknown>): Promise<void> {
    try {
      await fetch(`${supabaseUrl}/rest/v1/audit_log`, {
        method: 'POST',
        headers: {
          apikey:         serviceKey!,
          Authorization:  `Bearer ${serviceKey!}`,
          'Content-Type': 'application/json',
          Prefer:         'return=minimal',
        },
        body: JSON.stringify({
          check_name: checkName,
          passed:     false,
          severity,
          details:    metadata,
        }),
      })
    } catch (err) {
      console.error('[supervisor] audit_log insert failed:', err)
    }
  }

  // ── Helper: Send alert email ────────────────────────────────────────────
  async function sendAlert(subject: string, body: string): Promise<void> {
    if (!resendKey) {
      console.warn('[supervisor] RESEND_API_KEY not set — skipping email')
      return
    }
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'Visila Supervisor <noreply@visila.com>',
          to:      ['sila@visila.com'],
          subject,
          text:    body,
        }),
      })
      if (!emailRes.ok) {
        console.error('[supervisor] email failed:', emailRes.status, (await emailRes.text()).slice(0, 200))
      }
    } catch (err) {
      console.error('[supervisor] email exception:', err)
    }
  }

  try {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    // ══════════════════════════════════════════════════════════════════════
    // CHECK 1 — Recent build failure rate
    // ══════════════════════════════════════════════════════════════════════
    const failures = await supaQuery(
      `builds?status=eq.error&created_at=gte.${encodeURIComponent(twentyFourHoursAgo)}&select=id`
    )
    const failureCount = failures.length
    const failureThreshold = 3

    const check1: CheckResult = {
      name:      'build_failure_count',
      status:    failureCount > failureThreshold ? 'alert' : 'pass',
      value:     failureCount,
      threshold: failureThreshold,
    }
    checks.push(check1)

    if (check1.status === 'alert') {
      alertsFired++
      const msg = `${failureCount} build failures in last 24h (threshold: ${failureThreshold})`
      await logAlert('supervisor_build_failures', 'critical', msg, { check: 'build_failure_count', value: failureCount, threshold: failureThreshold })
      await sendAlert('Visila Supervisor Alert — Build Failures', msg)
    }

    // ══════════════════════════════════════════════════════════════════════
    // CHECK 2 — Build failure rate percentage
    // ══════════════════════════════════════════════════════════════════════
    const successes = await supaQuery(
      `builds?status=eq.complete&created_at=gte.${encodeURIComponent(twentyFourHoursAgo)}&select=id`
    )
    const successCount = successes.length
    const total = failureCount + successCount
    const failureRate = total > 0 ? Math.round((failureCount / total) * 100) : 0
    const rateThreshold = 20

    const check2: CheckResult = {
      name:      'build_failure_rate',
      status:    failureRate > rateThreshold ? 'alert' : 'pass',
      value:     failureRate,
      threshold: rateThreshold,
    }
    checks.push(check2)

    if (check2.status === 'alert') {
      alertsFired++
      const msg = `Build failure rate: ${failureRate}% (${failureCount}/${total}) in last 24h (threshold: ${rateThreshold}%)`
      await logAlert('supervisor_failure_rate', 'warning', msg, { check: 'build_failure_rate', value: failureRate, threshold: rateThreshold, failures: failureCount, total })
      await sendAlert('Visila Supervisor Alert — High Failure Rate', msg)
    }

    // ══════════════════════════════════════════════════════════════════════
    // CHECK 3 — Stale unclaimed expired builds
    // ══════════════════════════════════════════════════════════════════════
    const stale = await supaQuery(
      `builds?expires_at=lt.${encodeURIComponent(now.toISOString())}&claimed_at=is.null&deleted_at=is.null&select=id`
    )
    const staleCount = stale.length
    const staleThreshold = 10

    const check3: CheckResult = {
      name:      'stale_expired_builds',
      status:    staleCount > staleThreshold ? 'alert' : 'pass',
      value:     staleCount,
      threshold: staleThreshold,
    }
    checks.push(check3)

    if (check3.status === 'alert') {
      alertsFired++
      const msg = `${staleCount} unclaimed expired builds pending cleanup (threshold: ${staleThreshold})`
      await logAlert('supervisor_stale_builds', 'info', msg, { check: 'stale_expired_builds', value: staleCount, threshold: staleThreshold })
      await sendAlert('Visila Supervisor Alert — Stale Builds', msg)
    }

    // ══════════════════════════════════════════════════════════════════════
    // CHECK 4 — Edit engine health (no-change edits)
    // Edits where the assistant responded but no files changed indicate
    // the edit engine is returning false positives.
    // ══════════════════════════════════════════════════════════════════════
    const noChangeEdits = await supaQuery(
      `edit_messages?role=eq.assistant&created_at=gte.${encodeURIComponent(twentyFourHoursAgo)}&content=like.*couldn%27t+find+what+needed+changing*&select=id`
    )
    const noChangeCount = noChangeEdits.length
    const noChangeThreshold = 5

    const check4: CheckResult = {
      name:      'edit_engine_no_change',
      status:    noChangeCount > noChangeThreshold ? 'alert' : 'pass',
      value:     noChangeCount,
      threshold: noChangeThreshold,
    }
    checks.push(check4)

    if (check4.status === 'alert') {
      alertsFired++
      const msg = `${noChangeCount} no-change edits in last 24h (threshold: ${noChangeThreshold}). Edit engine may be returning false successes.`
      await logAlert('supervisor_edit_health', 'warning', msg, { check: 'edit_engine_no_change', value: noChangeCount, threshold: noChangeThreshold })
      await sendAlert('Visila Supervisor Alert — Edit Engine Health', msg)
    }

    // ══════════════════════════════════════════════════════════════════════
    // CHECK 5 — Schema integrity
    // Completed builds whose step log contains a schema failure — these
    // are apps that deployed with a broken database. Zero tolerance.
    // ══════════════════════════════════════════════════════════════════════
    const schemaFailures = await supaQuery(
      `builds?status=eq.complete&created_at=gte.${encodeURIComponent(twentyFourHoursAgo)}&step=like.*schema*failed*&select=id,app_name,created_at`
    )
    const schemaFailureCount = schemaFailures.length

    const check5: CheckResult = {
      name:      'schema_integrity',
      status:    schemaFailureCount > 0 ? 'alert' : 'pass',
      value:     schemaFailureCount,
      threshold: 0,
    }
    checks.push(check5)

    if (check5.status === 'alert') {
      alertsFired++
      const msg = `${schemaFailureCount} completed build(s) had schema failures in last 24h — customers have broken dashboards`
      await logAlert('supervisor_schema_integrity', 'critical', msg, {
        check: 'schema_integrity',
        value: schemaFailureCount,
        builds: schemaFailures,
      })
      await sendAlert('Visila Supervisor Alert — Schema Integrity', msg)
    }

    // ══════════════════════════════════════════════════════════════════════
    // CHECK 6 — Brain hint delivery
    // If brain-hint returns show_hint: false on >80% of calls in 24h,
    // the hint system is likely suppressed. Detect via audit_log entries
    // written when hints fire — if zero hints fired and edits happened,
    // something is wrong.
    // ══════════════════════════════════════════════════════════════════════
    const recentEdits = await supaQuery(
      `edit_messages?role=eq.assistant&created_at=gte.${encodeURIComponent(twentyFourHoursAgo)}&select=id`
    )
    const recentHints = await supaQuery(
      `audit_log?check_name=eq.brain_hint_fired&created_at=gte.${encodeURIComponent(twentyFourHoursAgo)}&select=id`
    )
    const editCountLast24h = recentEdits.length
    const hintCountLast24h = recentHints.length
    const hintSuppressed = editCountLast24h >= 5 && hintCountLast24h === 0

    const check6: CheckResult = {
      name:      'brain_hint_delivery',
      status:    hintSuppressed ? 'alert' : 'pass',
      value:     hintCountLast24h,
      threshold: editCountLast24h,
    }
    checks.push(check6)

    if (check6.status === 'alert') {
      alertsFired++
      const msg = `Brain hints fired 0 times in last 24h despite ${editCountLast24h} edits — hint system may be suppressed`
      await logAlert('supervisor_brain_hints', 'warning', msg, {
        check: 'brain_hint_delivery',
        edits: editCountLast24h,
        hints: hintCountLast24h,
      })
      await sendAlert('Visila Supervisor Alert — Brain Hints Suppressed', msg)
    }

    // ══════════════════════════════════════════════════════════════════════
    // CHECK 7 — Schema isolation integrity
    // Completed try-mode builds should have supabase_schema_name populated.
    // If it's null, the build used the public schema and may have collisions.
    // ══════════════════════════════════════════════════════════════════════
    const unisolatedBuilds = await supaQuery(
      `builds?status=eq.complete&supabase_mode=eq.sovereign_temporary&created_at=gte.${encodeURIComponent(twentyFourHoursAgo)}&supabase_schema_name=is.null&select=id,app_name,created_at`
    )
    const unisolatedCount = unisolatedBuilds.length

    const check7: CheckResult = {
      name:      'schema_isolation',
      status:    unisolatedCount > 0 ? 'alert' : 'pass',
      value:     unisolatedCount,
      threshold: 0,
    }
    checks.push(check7)

    if (check7.status === 'alert') {
      alertsFired++
      const msg = `${unisolatedCount} completed try-mode build(s) missing schema isolation in last 24h — public schema collisions may have occurred`
      await logAlert('supervisor_schema_isolation', 'critical', msg, {
        check: 'schema_isolation',
        value: unisolatedCount,
        builds: unisolatedBuilds,
      })
      await sendAlert('Visila Supervisor Alert — Schema Isolation Missing', msg)
    }

    // ══════════════════════════════════════════════════════════════════════
    // RESULTS
    // ══════════════════════════════════════════════════════════════════════
    console.log('[supervisor] done.', JSON.stringify({ checks, alerts_fired: alertsFired }))

    res.status(200).json({
      ran_at:        now.toISOString(),
      checks,
      alerts_fired:  alertsFired,
    })
  } catch (err) {
    console.error('[supervisor] unhandled exception:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
