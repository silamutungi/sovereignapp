import { createClient } from '@supabase/supabase-js'
import { getLimits } from './planLimits.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface QuotaResult {
  allowed: boolean
  reason?: string
  current?: number
  limit?: number
}

/** Check if user (by email) can create a new build */
export async function checkBuildQuota(email: string): Promise<QuotaResult> {
  try {
    // Look up plan from user_plans table — default to 'free' if not found
    const { data: userPlan } = await supabase
      .from('user_plans')
      .select('plan')
      .eq('email', email.toLowerCase())
      .single()

    const plan = userPlan?.plan ?? 'free'
    const limits = getLimits(plan)

    const { count, error: countError } = await supabase
      .from('builds')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.toLowerCase())
      .is('deleted_at', null)

    if (countError) {
      console.error('[quotaCheck] build count error:', countError)
      return { allowed: true } // fail open
    }

    const current = count ?? 0

    if (current >= limits.maxBuilds) {
      return {
        allowed: false,
        reason: `Your ${plan} plan includes ${limits.maxBuilds} build${limits.maxBuilds === 1 ? '' : 's'}. Upgrade to create more.`,
        current,
        limit: limits.maxBuilds,
      }
    }

    return { allowed: true, current, limit: limits.maxBuilds }
  } catch (err) {
    console.error('[quotaCheck] unexpected error:', err)
    return { allowed: true } // fail open
  }
}

/** Check if user can make another edit to a specific build */
export async function checkEditRate(buildId: string): Promise<QuotaResult> {
  try {
    // Get the email from the build, then look up the plan
    const { data: build } = await supabase
      .from('builds')
      .select('email')
      .eq('id', buildId)
      .single()

    if (!build?.email) {
      return { allowed: true } // fail open if build not found
    }

    const { data: userPlan } = await supabase
      .from('user_plans')
      .select('plan')
      .eq('email', build.email.toLowerCase())
      .single()

    const plan = userPlan?.plan ?? 'free'
    const limits = getLimits(plan)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { count, error: countError } = await supabase
      .from('edit_messages')
      .select('id', { count: 'exact', head: true })
      .eq('build_id', buildId)
      .eq('role', 'user')
      .gte('created_at', oneHourAgo)

    if (countError) {
      console.error('[quotaCheck] edit count error:', countError)
      return { allowed: true } // fail open
    }

    const current = count ?? 0

    if (current >= limits.editsPerHour) {
      return {
        allowed: false,
        reason: `You've made ${current} edits in the last hour. Your ${plan} plan allows ${limits.editsPerHour}/hour. Try again shortly or upgrade.`,
        current,
        limit: limits.editsPerHour,
      }
    }

    return { allowed: true, current, limit: limits.editsPerHour }
  } catch (err) {
    console.error('[quotaCheck] unexpected error:', err)
    return { allowed: true } // fail open
  }
}
