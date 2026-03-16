// api/send-welcome.ts — Vercel Serverless Function (Node.js runtime)
//
// POST /api/send-welcome
// Body: { email, projectName, liveUrl, repoUrl }
// Returns: { ok: true } | { error: string }
//
// Self-contained: no imports from src/ or server/.

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

    const { email, projectName, liveUrl, repoUrl } = body ?? {}

    if (!email || !projectName) {
      res.status(400).json({ error: '`email` and `projectName` are required' })
      return
    }

    const emailBody = [
      `Your project "${projectName}" is live.`,
      ``,
      `Live URL:  ${liveUrl ?? ''}`,
      `GitHub:    ${repoUrl ?? ''}`,
      ``,
      `Sovereign has stepped back. This is yours now.`,
      ``,
      `— The Sovereign team`,
      `sovereignapp.dev`,
    ].join('\n')

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sovereign <noreply@sovereignapp.dev>',
        to: [email],
        subject: 'Your app is live — you own everything',
        text: emailBody,
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
