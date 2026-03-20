// api/_rateLimit.ts — shared in-memory rate limiter for Vercel serverless routes
//
// NOTE: In-memory Maps are per-instance. Serverless cold starts reset state.
// Effective against burst abuse within a single warm instance.
// For Redis-backed rate limiting across instances, use Upstash or similar.

const requests = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const record = requests.get(key)

  if (!record || now > record.resetAt) {
    requests.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (record.count >= limit) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  record.count++
  return { allowed: true }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  if (Array.isArray(forwarded)) return String(forwarded[0])
  return req.socket?.remoteAddress ?? 'unknown'
}
