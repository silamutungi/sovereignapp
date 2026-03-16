// api/send-welcome.ts — Vercel Serverless Function (Node.js runtime)
//
// POST /api/send-welcome
// Body: { email, projectName, liveUrl, repoUrl }
// Returns: { ok: true } | { error: string }

import { sendWelcome } from '../server/send-welcome.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const { email, projectName, liveUrl, repoUrl } = body as Record<string, string>

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
    res.status(500).json({ error: result.error })
    return
  }

  res.status(200).json({ ok: true })
}
