export type Plan = 'free' | 'starter' | 'pro' | 'agency'

export interface PlanLimits {
  maxBuilds: number
  editsPerHour: number
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free:    { maxBuilds: 1,   editsPerHour: 10 },
  starter: { maxBuilds: 3,   editsPerHour: 20 },
  pro:     { maxBuilds: 10,  editsPerHour: 30 },
  agency:  { maxBuilds: 999, editsPerHour: 60 },
}

export function getLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free
}
