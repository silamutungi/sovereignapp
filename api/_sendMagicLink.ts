// api/_sendMagicLink.ts — shared server-side utility
//
// Creates a magic link record in Supabase and sends the dashboard login email.
// Imported by: api/auth/magic-link.ts, api/send-welcome.ts
//
// Uses process.env (Node.js) — server-side only.

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[sendMagicLink] Missing Supabase env vars — SUPABASE_URL:', !!url, 'SERVICE_ROLE_KEY:', !!key)
    throw new Error('Supabase not configured')
  }
  return createClient(url, key)
}

function getDashboardUrl(token: string): string {
  if (process.env.VERCEL_ENV === 'production') {
    return `https://sovereignapp.dev/dashboard?token=${token}`
  }
  const base =
    process.env.VERCEL_ENV === 'preview'
      ? `https://${process.env.VERCEL_URL ?? 'sovereignapp.vercel.app'}`
      : `http://localhost:${process.env.PORT ?? 5173}`
  return `${base}/dashboard?token=${token}`
}

export async function sendMagicLink(email: string): Promise<void> {
  const token =
    crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '')

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  console.log('[sendMagicLink] env check:', {
    supabaseUrl: !!process.env.SUPABASE_URL,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    resendKey: !!process.env.RESEND_API_KEY,
  })

  const supabase = getSupabase()

  console.log('[sendMagicLink] Attempting DB insert')
  const { error: dbError } = await supabase
    .from('magic_links')
    .insert({ email, token, expires_at: expiresAt })

  if (dbError) {
    console.error('[sendMagicLink] DB insert error — code:', dbError.code, '| message:', dbError.message, '| details:', dbError.details, '| hint:', dbError.hint)
    throw new Error(`Failed to create magic link: ${dbError.message}`)
  }

  console.log('[sendMagicLink] DB insert succeeded, sending email to:', email)

  const dashboardUrl = getDashboardUrl(token)

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) throw new Error('RESEND_API_KEY is not set')

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Sovereign <noreply@sovereignapp.dev>',
      to: [email],
      subject: 'Your Sovereign dashboard link',
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="margin:0;padding:0;background:#0e0d0b;font-family:'Courier New',Courier,monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0d0b;padding:48px 24px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:32px;">
          <span style="font-family:Georgia,serif;font-size:22px;color:#f2efe8;font-weight:400;">
            Sovereign<span style="color:#8ab800">.</span>
          </span>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <h1 style="margin:0;font-family:Georgia,serif;font-size:32px;font-weight:400;color:#f2efe8;line-height:1.2;">
            Here's your<br>dashboard link.
          </h1>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <p style="margin:0;font-size:15px;color:#c8c4bc;line-height:1.6;">
            Click below to access your Sovereign dashboard and manage all your apps.
          </p>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <a href="${dashboardUrl}"
            style="display:inline-block;background:#8ab800;color:#0e0d0b;padding:16px 32px;font-size:14px;font-weight:500;text-decoration:none;font-family:'Courier New',monospace;">
            Open my dashboard →
          </a>
        </td></tr>
        <tr><td>
          <p style="margin:0;font-size:12px;color:#6b6862;line-height:1.6;">
            This link expires in 24 hours and can only be used once.
            If you didn't request this, you can safely ignore it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }),
  })

  if (!emailRes.ok) {
    const err = (await emailRes.json()) as Record<string, unknown>
    console.error('[sendMagicLink] Email error:', emailRes.status, err)
    throw new Error('Failed to send magic link email')
  }
}
