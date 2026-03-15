// api/generate.ts — Vercel Serverless Function (Node.js runtime)
//
// POST /api/generate
// Body: { idea: string }
// Returns: AppSpec JSON

import { generateAppSpec } from '../server/generate.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const idea = (body?.idea as string | undefined)?.trim()

  if (!idea) {
    res.status(400).json({ error: '`idea` is required' })
    return
  }

  const result = await generateAppSpec(idea)

  if (!result.success) {
    res.status(500).json({ error: result.error })
    return
  }

  res.status(200).json({
    appName: result.appName,
    tagline: result.tagline,
    primaryColor: result.primaryColor,
    appType: result.appType,
    template: result.template,
  })
}
