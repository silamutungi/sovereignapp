import { createClient } from '@supabase/supabase-js'
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

  const supabase = createClient(supabaseUrl, serviceKey)

  const testQuery = await supabase.from('user_plans').select('*')
  console.log('[quota] ALL rows:', JSON.stringify(testQuery.data), 'error:', JSON.stringify(testQuery.error))

  const { data: userPlan } = await supabase
    .from('user_plans')
    .select('plan')
    .eq('email', email)
    .single()

  console.log('[quota] email:', email, 'userPlan:', JSON.stringify(userPlan))

  const plan = userPlan?.plan ?? 'free'
  const limits = getLimits(plan)

  const { count: buildCount } = await supabase
    .from('builds')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .is('deleted_at', null)

  res.setHeader("Cache-Control", "no-store")
  res.status(200).json({
    plan,
    builds: {
      used: buildCount ?? 0,
      limit: limits.maxBuilds,
    },
    editsPerHour: limits.editsPerHour,
  })
}
