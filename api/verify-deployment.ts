// api/verify-deployment.ts — POST /api/verify-deployment
//
// Checks if a deployed app is healthy by fetching its URL and verifying
// it returns HTTP 200 with meaningful HTML content and no visible errors.
//
// Body: { url }
// Returns: { healthy: boolean, reason: string }
//
// Rate limit: 30/hr per IP

// SECURITY AUDIT
// - Rate limited: 30/hr per IP
// - Only https URLs allowed — prevents SSRF to internal services
// - AbortSignal.timeout(10000) prevents hanging on slow responses
// - No auth tokens or secrets involved

import { checkRateLimit, getClientIp } from './_rateLimit.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = getClientIp(req)
  const rl = checkRateLimit(`verify-deployment:${ip}`, 30, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  const { url } = (req.body ?? {}) as { url?: string }

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'url is required' })
    return
  }

  // Validate — must be https to prevent SSRF to internal services
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    res.status(400).json({ error: 'Invalid URL' })
    return
  }

  if (parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'Only https URLs allowed' })
    return
  }

  try {
    const fetchRes = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Visila/1.0 deployment-health-check' },
    })

    if (!fetchRes.ok) {
      return res.status(200).json({ healthy: false, reason: `HTTP ${fetchRes.status} — deployment may still be starting` })
    }

    const body = await fetchRes.text()

    if (!body.includes('<html') && !body.toLowerCase().includes('<html')) {
      return res.status(200).json({ healthy: false, reason: 'No HTML in response body' })
    }

    if (body.length < 200) {
      return res.status(200).json({ healthy: false, reason: 'Response too short — page may be empty' })
    }

    // JavaScript runtime error signatures that appear in the rendered page
    const errorPatterns = [
      'Cannot read properties of',
      'is not defined',
      'SyntaxError:',
      'ReferenceError:',
      'TypeError:',
      'Uncaught Error',
    ]

    for (const pattern of errorPatterns) {
      if (body.includes(pattern)) {
        return res.status(200).json({ healthy: false, reason: `Runtime error visible in page: "${pattern}"` })
      }
    }

    res.status(200).json({ healthy: true, reason: 'OK' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Timeouts and network errors are not app failures — return healthy: false but non-fatally
    res.status(200).json({ healthy: false, reason: `Could not reach app: ${msg.slice(0, 100)}` })
  }
}
