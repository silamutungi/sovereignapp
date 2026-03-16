// api/send-welcome.ts — Vercel Serverless Function (Node.js runtime)
//
// POST /api/send-welcome
// Body: { email, projectName, liveUrl, repoUrl, subject?, body? }
//   - subject + body override the defaults (used for waitlist signups)
//   - omit subject/body to send the app-launch email
// Returns: { ok: true } | { error: string }
//
// Self-contained: no imports from src/ or server/.

// ── Email templates ────────────────────────────────────────────────────────

function waitlistHtml(email: string): string {
  void email
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're on the Sovereign waitlist</title>
</head>
<body style="margin:0;padding:0;background:#0e0d0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Wordmark -->
          <tr>
            <td style="padding:0 0 36px 0;text-align:center;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c8f060;">SOVEREIGN</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:0 0 12px 0;text-align:center;">
              <h1 style="margin:0;font-size:48px;font-weight:800;line-height:1;color:#f2efe8;letter-spacing:-0.02em;">You're in.</h1>
            </td>
          </tr>

          <!-- Subheadline -->
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <p style="margin:0;font-size:16px;line-height:1.6;color:#6b6862;">We'll build your first app the moment we launch.</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 32px 0;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td style="padding:0 0 36px 0;text-align:center;">
              <p style="margin:0;font-size:15px;line-height:1.75;color:#f2efe8;">No credits. No overages. No surprises.<br/>Just your app, your code, your infrastructure —<br/>owned by you from day one.</p>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td style="padding:0 0 40px 0;text-align:center;">
              <a href="https://sovereignapp.dev" style="display:inline-block;background:#c8f060;color:#0e0d0b;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:6px;letter-spacing:0.01em;">Visit Sovereign →</a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 28px 0;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>

          <!-- Social proof -->
          <tr>
            <td style="padding:0 0 40px 0;text-align:center;">
              <p style="margin:0;font-size:13px;line-height:1.7;color:#6b6862;">Tell one person frustrated with Lovable or Cursor.<br/>That's how we grow.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center;">
              <p style="margin:0;font-size:11px;line-height:1.8;color:#6b6862;">© 2026 Sovereign &nbsp;·&nbsp; <a href="https://sovereignapp.dev" style="color:#6b6862;text-decoration:none;">sovereignapp.dev</a> &nbsp;·&nbsp; Built without permission</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function appLaunchHtml(projectName: string, liveUrl: string, repoUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your app is live.</title>
</head>
<body style="margin:0;padding:0;background:#0e0d0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Wordmark -->
          <tr>
            <td style="padding:0 0 36px 0;text-align:center;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c8f060;">SOVEREIGN</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:0 0 12px 0;text-align:center;">
              <h1 style="margin:0;font-size:48px;font-weight:800;line-height:1;color:#f2efe8;letter-spacing:-0.02em;">Your app is live.</h1>
            </td>
          </tr>

          <!-- App name subheadline -->
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;">
              <p style="margin:0;font-size:18px;font-weight:600;color:#c8f060;letter-spacing:0.01em;">${projectName}</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 32px 0;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td style="padding:0 0 36px 0;text-align:center;">
              <p style="margin:0;font-size:15px;line-height:1.75;color:#f2efe8;">Sovereign has stepped back. This is yours now.<br/>Your code. Your infrastructure. Your future.</p>
            </td>
          </tr>

          <!-- CTA buttons -->
          <tr>
            <td style="padding:0 0 40px 0;text-align:center;">
              <!--[if mso]><table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr><td style="padding:0 8px 0 0;"><![endif]-->
              <a href="${liveUrl}" style="display:inline-block;background:#c8f060;color:#0e0d0b;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:6px;margin:0 6px 12px;letter-spacing:0.01em;">View Live App →</a>
              <!--[if mso]></td><td style="padding:0 0 0 8px;"><![endif]-->
              <a href="${repoUrl}" style="display:inline-block;background:transparent;color:#c8f060;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:6px;border:1px solid rgba(200,240,96,0.4);margin:0 6px 12px;letter-spacing:0.01em;">View on GitHub →</a>
              <!--[if mso]></td></tr></table><![endif]-->
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 28px 0;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center;">
              <p style="margin:0;font-size:11px;line-height:1.8;color:#6b6862;">© 2026 Sovereign &nbsp;·&nbsp; <a href="https://sovereignapp.dev" style="color:#6b6862;text-decoration:none;">sovereignapp.dev</a> &nbsp;·&nbsp; Built without permission</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Handler ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  const keyHint = process.env.RESEND_API_KEY
    ? `set (${process.env.RESEND_API_KEY.slice(0, 4)}…)`
    : 'NOT SET'
  console.log('[send-welcome] RESEND_API_KEY:', keyHint)

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      res.status(500).json({ error: 'RESEND_API_KEY is not set' })
      return
    }

    let body: Record<string, string>
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch (parseErr) {
      console.error('[send-welcome] body parse error:', parseErr)
      res.status(400).json({ error: 'Invalid JSON body' })
      return
    }

    const { email, projectName, liveUrl, repoUrl, subject: subjectOverride } = body ?? {}

    if (!email || !projectName) {
      res.status(400).json({ error: '`email` and `projectName` are required' })
      return
    }

    // subject override present → waitlist confirmation; otherwise → app launch
    const isWaitlist = !!subjectOverride
    const subject = subjectOverride ?? 'Your app is live — you own everything'
    const html = isWaitlist
      ? waitlistHtml(email)
      : appLaunchHtml(projectName, liveUrl ?? 'https://sovereignapp.dev', repoUrl ?? '')

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sovereign <noreply@sovereignapp.dev>',
        to: [email],
        subject,
        html,
      }),
    })

    if (!resendRes.ok) {
      const err = await resendRes.json() as Record<string, unknown>
      const msg = String(err.message ?? `Resend error ${resendRes.status}`)
      console.error('[send-welcome] Resend error:', resendRes.status, msg, JSON.stringify(err))
      res.status(500).json({ error: msg })
      return
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[send-welcome] unhandled exception:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
