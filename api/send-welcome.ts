// api/send-welcome.ts — Vercel Serverless Function (Node.js runtime)
//
// POST /api/send-welcome
// Body: { email, projectName, liveUrl, repoUrl }
// Returns: { ok: true } | { error: string }

import { sendWelcome } from '../server/send-welcome.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  // DEBUG: confirm env var is present at runtime (first 4 chars only)
  const keyHint = process.env.RESEND_API_KEY
    ? `set (${process.env.RESEND_API_KEY.slice(0, 4)}…)`
    : 'NOT SET'
  console.log('[send-welcome] RESEND_API_KEY:', keyHint)

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
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

    const result = await sendWelcome({
      email,
      projectName,
      liveUrl: liveUrl ?? '',
      repoUrl: repoUrl ?? '',
    })

    if (!result.success) {
      console.error('[send-welcome] sendWelcome failed:', result.error)
      res.status(500).json({ error: result.error })
      return
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[send-welcome] unhandled exception:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
