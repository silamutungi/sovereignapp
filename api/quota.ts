import { getLimits } from './lib/planLimits.js'
import { checkRateLimit } from './_rateLimit.js'

const getClientIp = (req: any): string =>  // eslint-disable-line @typescript-eslint/no-explicit-any
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = getClientIp(req)
  const rl = checkRateLimit(`quota:${ip}`, 60, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  const email = (req.headers['x-user-email'] as string)?.trim()?.toLowerCase()
  if (!email) {
    res.status(401).json({ error: 'Missing x-user-email header' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Server misconfigured' })
    return
  }

  // Direct REST fetch — bypasses Supabase JS client which was returning null
  const upRes = await fetch(
    `${supabaseUrl}/rest/v1/user_plans?email=eq.${encodeURIComponent(email)}&select=plan&limit=1`,
    {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    }
  )
  const upRows = await upRes.json()
  console.log('[quota] upRows:', JSON.stringify(upRows))
  const userPlan = Array.isArray(upRows) && upRows.length > 0 ? upRows[0] : null

  const plan = userPlan?.plan ?? 'free'
  const limits = getLimits(plan)

  const bcRes = await fetch(
    `${supabaseUrl}/rest/v1/builds?email=eq.${encodeURIComponent(email)}&deleted_at=is.null&select=id`,
    {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'count=exact',
        'Range-Unit': 'items',
        'Range': '0-0',
      },
    }
  )
  const contentRange = bcRes.headers.get('content-range') ?? '0/0'
  const countMatch = contentRange.match(/\/(\d+)$/)
  const buildCount = countMatch ? parseInt(countMatch[1], 10) : 0

  res.setHeader("Cache-Control", "no-store")
  res.status(200).json({
    plan,
    builds: {
      used: buildCount,
      limit: limits.maxBuilds,
    },
    editsPerHour: limits.editsPerHour,
  })
}
