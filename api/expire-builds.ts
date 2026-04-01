// api/expire-builds.ts — Vercel Cron Function
//
// GET /api/expire-builds
// Called daily at 09:00 UTC by Vercel cron (see vercel.json).
// Protected by x-cron-secret header — must match CRON_SECRET env var.
//
// Two jobs in one pass:
//   Day 5 warning: builds where created_at is between 5 and 6 days ago,
//                  status = 'complete', deleted_at IS NULL, warning_sent IS NULL
//   Day 7 expiry:  builds where created_at is more than 7 days ago,
//                  status = 'complete', deleted_at IS NULL
//
// SECURITY AUDIT
// - Protected by CRON_SECRET header — not public
// - No user-supplied data in queries
// - Reads from Supabase using service role key (server only)
// - Emails sent via Resend — no secrets in responses

export const maxDuration = 30
export const config = { runtime: 'nodejs' }

function expiryWarningHtml(appName: string, deployUrl: string, ideaEncoded: string): string {
  const rebuildUrl = `https://visila.com/?idea=${ideaEncoded}`
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your app expires in 2 days</title>
</head>
<body style="margin:0;padding:0;background-color:#0e0d0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f2efe8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0e0d0b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
          <tr>
            <td style="padding:0 0 36px 0;text-align:center;">
              <span style="font-size:13px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c8f060;">VISILA</span>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 12px 0;text-align:center;">
              <h1 style="margin:0;font-size:36px;font-weight:800;line-height:1.1;color:#f2efe8;letter-spacing:-0.02em;">${appName} expires in 2 days.</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <p style="margin:0;font-size:15px;line-height:1.75;color:#c8c4bc;">Your free app will be taken offline on day 7.<br/>Claim it now to keep it live forever — it stays yours.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px 0;background-color:#0e0d0b;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 40px 0;text-align:center;">
              <a href="${deployUrl}" style="display:inline-block;background:#c8f060;color:#0e0d0b;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:6px;margin:0 6px 12px;">View your app →</a>
              <a href="https://visila.com/#pricing" style="display:inline-block;background:#0e0d0b;color:#c8f060;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:6px;border:1px solid rgba(200,240,96,0.4);margin:0 6px 12px;">Claim it — keep it live →</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px 0;background-color:#0e0d0b;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 28px 0;text-align:center;">
              <p style="margin:0;font-size:13px;line-height:1.7;color:#6b6862;">Free apps live for 7 days. Upgrade to Pro to keep yours live indefinitely.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 20px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b6862;">
                Don't want this app? <a href="${rebuildUrl}" style="color:#8ab800;text-decoration:none;">Build a new one →</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;">
              <p style="margin:0;font-size:11px;line-height:1.8;color:#6b6862;">© 2026 Visila &nbsp;·&nbsp; <a href="https://visila.com" style="color:#6b6862;text-decoration:none;">visila.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function expiredHtml(appName: string, ideaEncoded: string): string {
  const rebuildUrl = `https://visila.com/?idea=${ideaEncoded}`
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your app has expired</title>
</head>
<body style="margin:0;padding:0;background-color:#0e0d0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f2efe8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0e0d0b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
          <tr>
            <td style="padding:0 0 36px 0;text-align:center;">
              <span style="font-size:13px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c8f060;">VISILA</span>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 12px 0;text-align:center;">
              <h1 style="margin:0;font-size:36px;font-weight:800;line-height:1.1;color:#f2efe8;letter-spacing:-0.02em;">${appName} has expired.</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <p style="margin:0;font-size:15px;line-height:1.75;color:#c8c4bc;">Your 7-day free app has been taken offline.<br/>Rebuild it in 60 seconds — your idea is saved.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px 0;background-color:#0e0d0b;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 40px 0;text-align:center;">
              <a href="${rebuildUrl}" style="display:inline-block;background:#c8f060;color:#0e0d0b;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:6px;">Rebuild it now →</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px 0;background-color:#0e0d0b;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 28px 0;text-align:center;">
              <p style="margin:0;font-size:13px;line-height:1.7;color:#6b6862;">Upgrade to Pro to keep future apps live indefinitely.</p>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;">
              <p style="margin:0;font-size:11px;line-height:1.8;color:#6b6862;">© 2026 Visila &nbsp;·&nbsp; <a href="https://visila.com" style="color:#6b6862;text-decoration:none;">visila.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  // Vercel cron calls GET — only allow GET
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Protect with CRON_SECRET — Vercel cron sets this header automatically
  // when configured via vercel.json cron with authorization
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[expire-builds] CRON_SECRET not set — rejecting')
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

  const results = {
    warnings_sent: 0,
    expired: 0,
    errors: [] as string[],
  }

  try {
    const now = new Date()

    // ── 1. Find day-5 warning builds ─────────────────────────────────────
    // created_at between 5 and 6 days ago (the 24-hour window where we warn)
    const day5Start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
    const day5End   = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()

    const warningUrl =
      `${supabaseUrl}/rest/v1/builds` +
      `?status=eq.complete` +
      `&deleted_at=is.null` +
      `&created_at=gte.${encodeURIComponent(day5Start)}` +
      `&created_at=lte.${encodeURIComponent(day5End)}` +
      `&select=id,email,app_name,idea,deploy_url`

    const warningRes = await fetch(warningUrl, {
      headers: {
        apikey:        serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    })

    if (warningRes.ok) {
      const warningBuilds = await warningRes.json() as Array<{
        id: string
        email: string
        app_name: string
        idea: string
        deploy_url: string | null
      }>

      for (const build of warningBuilds) {
        if (!build.email || !resendKey) continue
        const ideaEncoded = encodeURIComponent((build.idea ?? '').slice(0, 500))
        const deployUrl   = build.deploy_url ?? 'https://visila.com'
        try {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization:  `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from:    'Visila <noreply@visila.com>',
              to:      [build.email],
              subject: `${build.app_name} expires in 2 days — claim it to keep it live`,
              html:    expiryWarningHtml(build.app_name, deployUrl, ideaEncoded),
            }),
          })
          if (emailRes.ok) {
            results.warnings_sent++
            console.log('[expire-builds] warning sent to:', build.email, 'buildId:', build.id)
          } else {
            const errBody = await emailRes.text()
            console.error('[expire-builds] warning email failed:', build.id, errBody.slice(0, 200))
            results.errors.push(`warning:${build.id}:${emailRes.status}`)
          }
        } catch (emailErr) {
          console.error('[expire-builds] warning email exception:', build.id, emailErr)
          results.errors.push(`warning:${build.id}:exception`)
        }
      }
    } else {
      const body = await warningRes.text()
      console.error('[expire-builds] warning query failed:', warningRes.status, body.slice(0, 200))
      results.errors.push(`warning_query:${warningRes.status}`)
    }

    // ── 2. Find expired builds (>7 days old) ────────────────────────────
    const day7Cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const expiryUrl =
      `${supabaseUrl}/rest/v1/builds` +
      `?status=eq.complete` +
      `&deleted_at=is.null` +
      `&created_at=lte.${encodeURIComponent(day7Cutoff)}` +
      `&select=id,email,app_name,idea`

    const expiryRes = await fetch(expiryUrl, {
      headers: {
        apikey:        serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    })

    if (expiryRes.ok) {
      const expiredBuilds = await expiryRes.json() as Array<{
        id: string
        email: string
        app_name: string
        idea: string
      }>

      for (const build of expiredBuilds) {
        // Soft delete — set deleted_at
        const patchRes = await fetch(
          `${supabaseUrl}/rest/v1/builds?id=eq.${encodeURIComponent(build.id)}`,
          {
            method: 'PATCH',
            headers: {
              apikey:          serviceKey,
              Authorization:   `Bearer ${serviceKey}`,
              'Content-Type':  'application/json',
            },
            body: JSON.stringify({
              deleted_at: now.toISOString(),
              updated_at: now.toISOString(),
            }),
          },
        )

        if (!patchRes.ok) {
          const errBody = await patchRes.text()
          console.error('[expire-builds] patch failed:', build.id, patchRes.status, errBody.slice(0, 200))
          results.errors.push(`patch:${build.id}:${patchRes.status}`)
          continue
        }

        results.expired++
        console.log('[expire-builds] expired build:', build.id, 'email:', build.email)

        // Send expiry email
        if (build.email && resendKey) {
          const ideaEncoded = encodeURIComponent((build.idea ?? '').slice(0, 500))
          try {
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization:  `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from:    'Visila <noreply@visila.com>',
                to:      [build.email],
                subject: `${build.app_name} has expired — rebuild it here`,
                html:    expiredHtml(build.app_name, ideaEncoded),
              }),
            })
            if (!emailRes.ok) {
              const errBody = await emailRes.text()
              console.error('[expire-builds] expiry email failed:', build.id, errBody.slice(0, 200))
              results.errors.push(`expiry_email:${build.id}:${emailRes.status}`)
            } else {
              console.log('[expire-builds] expiry email sent to:', build.email)
            }
          } catch (emailErr) {
            console.error('[expire-builds] expiry email exception:', build.id, emailErr)
            results.errors.push(`expiry_email:${build.id}:exception`)
          }
        }
      }
    } else {
      const body = await expiryRes.text()
      console.error('[expire-builds] expiry query failed:', expiryRes.status, body.slice(0, 200))
      results.errors.push(`expiry_query:${expiryRes.status}`)
    }

    console.log('[expire-builds] done. warnings_sent:', results.warnings_sent, 'expired:', results.expired, 'errors:', results.errors.length)
    res.status(200).json({ ok: true, ...results })
  } catch (err) {
    console.error('[expire-builds] unhandled exception:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
