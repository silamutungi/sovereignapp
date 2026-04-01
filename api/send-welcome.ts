// api/send-welcome.ts — Vercel Serverless Function (Node.js runtime)
//
// POST /api/send-welcome
// Body: { email, projectName, liveUrl, repoUrl, subject?, body? }
//   - subject + body override the defaults (used for waitlist signups)
//   - omit subject/body to send the app-launch email
// Returns: { ok: true } | { error: string }

import { sendMagicLink } from './_sendMagicLink.js'

import { checkRateLimit } from './_rateLimit.js'

// ── Email templates ────────────────────────────────────────────────────────

function waitlistHtml(email: string): string {
  void email
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>You're on the Visila waitlist</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      background-color: #0e0d0b !important;
      color: #f2efe8 !important;
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0e0d0b !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f2efe8 !important;">
  <div style="background-color:#0e0d0b !important;color:#f2efe8 !important;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0e0d0b !important;padding:40px 16px;">
    <tr>
      <td align="center" style="background-color:#0e0d0b !important;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#0e0d0b !important;">

          <!-- Wordmark -->
          <tr>
            <td style="padding:0 0 36px 0;text-align:center;background-color:#0e0d0b !important;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c8f060 !important;">VISILA</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:0 0 12px 0;text-align:center;background-color:#0e0d0b !important;">
              <h1 style="margin:0;font-size:48px;font-weight:800;line-height:1;color:#f2efe8 !important;letter-spacing:-0.02em;">You're in.</h1>
            </td>
          </tr>

          <!-- Subheadline -->
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;background-color:#0e0d0b !important;">
              <p style="margin:0;font-size:16px;line-height:1.6;color:#6b6862 !important;">We'll build your first app the moment we launch.</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 32px 0;background-color:#0e0d0b !important;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td style="padding:0 0 36px 0;text-align:center;background-color:#0e0d0b !important;">
              <p style="margin:0;font-size:15px;line-height:1.75;color:#f2efe8 !important;">No credits. No overages. No surprises.<br/>Just your app, your code, your infrastructure —<br/>owned by you from day one.</p>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td style="padding:0 0 40px 0;text-align:center;background-color:#0e0d0b !important;">
              <a href="https://visila.com" style="display:inline-block;background:#c8f060;color:#0e0d0b !important;-webkit-text-fill-color:#0e0d0b;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:6px;letter-spacing:0.01em;">Visit Visila →</a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 28px 0;background-color:#0e0d0b !important;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>

          <!-- Social proof -->
          <tr>
            <td style="padding:0 0 40px 0;text-align:center;background-color:#0e0d0b !important;">
              <p style="margin:0;font-size:13px;line-height:1.7;color:#6b6862 !important;">Tell one person frustrated with Lovable or Cursor.<br/>That's how we grow.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center;background-color:#0e0d0b !important;">
              <p style="margin:0;font-size:11px;line-height:1.8;color:#6b6862 !important;">© 2026 Visila &nbsp;·&nbsp; <a href="https://visila.com" style="color:#6b6862 !important;text-decoration:none;">visila.com</a> &nbsp;·&nbsp; Built without permission</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  </div>
</body>
</html>`
}

function appLaunchHtml(projectName: string, liveUrl: string, repoUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Your app is live.</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      background-color: #0e0d0b !important;
      color: #f2efe8 !important;
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0e0d0b !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f2efe8 !important;">
  <div style="background-color:#0e0d0b !important;color:#f2efe8 !important;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0e0d0b !important;padding:40px 16px;">
    <tr>
      <td align="center" style="background-color:#0e0d0b !important;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#0e0d0b !important;">

          <!-- Wordmark -->
          <tr>
            <td style="padding:0 0 36px 0;text-align:center;background-color:#0e0d0b !important;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c8f060 !important;">VISILA</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:0 0 12px 0;text-align:center;background-color:#0e0d0b !important;">
              <h1 style="margin:0;font-size:48px;font-weight:800;line-height:1;color:#f2efe8 !important;letter-spacing:-0.02em;">Your app is live.</h1>
            </td>
          </tr>

          <!-- App name subheadline -->
          <tr>
            <td style="padding:0 0 32px 0;text-align:center;background-color:#0e0d0b !important;">
              <p style="margin:0;font-size:18px;font-weight:600;color:#c8f060 !important;letter-spacing:0.01em;">${projectName}</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 32px 0;background-color:#0e0d0b !important;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td style="padding:0 0 36px 0;text-align:center;background-color:#0e0d0b !important;">
              <p style="margin:0;font-size:15px;line-height:1.75;color:#f2efe8 !important;">Visila has stepped back. This is yours now.<br/>Your code. Your infrastructure. Your future.</p>
            </td>
          </tr>

          <!-- CTA buttons -->
          <tr>
            <td style="padding:0 0 40px 0;text-align:center;background-color:#0e0d0b !important;">
              <!--[if mso]><table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr><td style="padding:0 8px 0 0;"><![endif]-->
              <a href="${liveUrl}" style="display:inline-block;background:#c8f060;color:#0e0d0b !important;-webkit-text-fill-color:#0e0d0b;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:6px;margin:0 6px 12px;letter-spacing:0.01em;">View Live App →</a>
              <!--[if mso]></td><td style="padding:0 0 0 8px;"><![endif]-->
              <a href="${repoUrl}" style="display:inline-block;background:#0e0d0b;color:#c8f060 !important;-webkit-text-fill-color:#c8f060;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:6px;border:1px solid rgba(200,240,96,0.4);margin:0 6px 12px;letter-spacing:0.01em;">View on GitHub →</a>
              <!--[if mso]></td></tr></table><![endif]-->
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 28px 0;background-color:#0e0d0b !important;">
              <div style="height:1px;background:rgba(200,240,96,0.2);"></div>
            </td>
          </tr>

          <!-- One more step — Supabase setup -->
          <tr>
            <td style="padding:0 0 32px 0;background-color:#0e0d0b !important;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1917;border-radius:8px;border:1px solid rgba(200,240,96,0.15);">
                <tr>
                  <td style="padding:24px 24px 8px 24px;background:#1a1917 !important;border-radius:8px 8px 0 0;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#c8f060 !important;">One more step</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 24px 16px 24px;background:#1a1917 !important;">
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#f2efe8 !important;">Connect your Supabase database to enable auth, storage, and data for your app.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 24px 24px;background:#1a1917 !important;border-radius:0 0 8px 8px;">
                    <a href="https://supabase.com/dashboard" style="display:inline-block;background:#c8f060;color:#0e0d0b !important;-webkit-text-fill-color:#0e0d0b;font-size:13px;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:5px;letter-spacing:0.01em;">Open Supabase Dashboard →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Dashboard link -->
          <tr>
            <td style="padding:0 0 20px 0;text-align:center;background-color:#0e0d0b !important;">
              <p style="margin:0;font-size:12px;color:#6b6862 !important;">
                <a href="https://visila.com/dashboard" style="color:#8ab800 !important;text-decoration:none;">Manage all your apps →</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center;background-color:#0e0d0b !important;">
              <p style="margin:0;font-size:11px;line-height:1.8;color:#6b6862 !important;">© 2026 Visila &nbsp;·&nbsp; <a href="https://visila.com" style="color:#6b6862 !important;text-decoration:none;">visila.com</a> &nbsp;·&nbsp; Built without permission</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
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

    // Rate limit: 5 per hour per email (safety net — should only fire once per build)
    const rl = checkRateLimit(`send-welcome:${email}`, 5, 60 * 60 * 1000)
    if (!rl.allowed) {
      const mins = Math.ceil((rl.retryAfter ?? 60) / 60)
      res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
      res.status(429).json({ error: `Too many requests. Try again in ${mins}m.` })
      return
    }

    // subject override present → waitlist confirmation; otherwise → app launch
    const isWaitlist = !!subjectOverride
    const subject = subjectOverride ?? 'Your app is live — you own everything'
    const html = isWaitlist
      ? waitlistHtml(email)
      : appLaunchHtml(projectName, liveUrl ?? 'https://visila.com', repoUrl ?? '')

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Visila <noreply@visila.com>',
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

    // Send magic link so the user can access their dashboard
    // Non-fatal — welcome email already sent, magic link failure should not fail the build
    if (!isWaitlist) {
      try {
        await sendMagicLink(email)
        console.log('[send-welcome] Magic link sent to:', email)
      } catch (mlErr) {
        console.error('[send-welcome] Magic link error:', mlErr)
      }
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[send-welcome] unhandled exception:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
