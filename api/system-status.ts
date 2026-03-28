// api/system-status.ts — Vercel Serverless Function
//
// GET /api/system-status
// Returns overall Sovereign health + per-system status.
// Checks external status pages and internal Supabase state in parallel.
// Rate limit: 60/hr per IP.
// Cache: 60 seconds in-memory (per warm instance).

import { checkRateLimit, getClientIp } from './_rateLimit.js'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

// ── Types ──────────────────────────────────────────────────────────────────────

type SystemStatus = 'operational' | 'degraded' | 'down' | 'maintenance'

interface SystemResult {
  name: string
  status: SystemStatus
  message: string | null
  checked_at: string
}

interface StatusResponse {
  overall: 'operational' | 'degraded' | 'down'
  systems: SystemResult[]
  checked_at: string
}

// ── In-memory cache (per warm instance) ───────────────────────────────────────

let cache: { data: StatusResponse; expiresAt: number } | null = null
const CACHE_TTL_MS = 60_000

// ── External status page checker ──────────────────────────────────────────────

async function checkStatusPage(url: string, name: string): Promise<SystemResult> {
  const checked_at = new Date().toISOString()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) {
      return { name, status: 'degraded', message: 'Status page returned an error', checked_at }
    }
    const json = await res.json() as { status?: { indicator?: string; description?: string } }
    const indicator = json?.status?.indicator ?? 'none'
    const description = json?.status?.description ?? null

    let status: SystemStatus
    if (indicator === 'none') status = 'operational'
    else if (indicator === 'minor') status = 'degraded'
    else status = 'down'

    return { name, status, message: status === 'operational' ? null : description, checked_at }
  } catch {
    return { name, status: 'degraded', message: 'Could not reach status page', checked_at }
  }
}

// ── Build pipeline check (Supabase) ───────────────────────────────────────────

async function checkBuildPipeline(): Promise<SystemResult> {
  const checked_at = new Date().toISOString()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return { name: 'Build Pipeline', status: 'degraded', message: 'Internal configuration error', checked_at }
  }
  try {
    const supabase = createClient(url, key)
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('builds')
      .select('id')
      .eq('status', 'building')
      .lt('created_at', cutoff)
      .limit(1)

    if (error) {
      return { name: 'Build Pipeline', status: 'degraded', message: 'Database check failed', checked_at }
    }
    if (data && data.length > 0) {
      return { name: 'Build Pipeline', status: 'degraded', message: 'One or more builds appear stuck', checked_at }
    }
    return { name: 'Build Pipeline', status: 'operational', message: null, checked_at }
  } catch {
    return { name: 'Build Pipeline', status: 'degraded', message: 'Internal error during pipeline check', checked_at }
  }
}

// ── Email (Resend) check ───────────────────────────────────────────────────────

async function checkResend(): Promise<SystemResult> {
  const checked_at = new Date().toISOString()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch('https://api.resend.com', { method: 'HEAD', signal: controller.signal })
    clearTimeout(timeout)
    const status: SystemStatus = res.status < 500 ? 'operational' : 'degraded'
    return { name: 'Email (Resend)', status, message: status === 'operational' ? null : 'Resend API unreachable', checked_at }
  } catch {
    return { name: 'Email (Resend)', status: 'degraded', message: 'Could not reach Resend API', checked_at }
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = getClientIp(req)
  const rl = checkRateLimit(`system-status:${ip}`, 60, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 60))
    res.status(429).json({ error: `Too many requests. Retry after ${rl.retryAfter ?? 60}s.` })
    return
  }

  // Serve from cache if fresh
  if (cache && Date.now() < cache.expiresAt) {
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.status(200).json(cache.data)
    return
  }

  // Run all checks in parallel
  const [buildPipeline, github, vercel, supabase, email] = await Promise.all([
    checkBuildPipeline(),
    checkStatusPage('https://www.githubstatus.com/api/v2/status.json', 'GitHub Integration'),
    checkStatusPage('https://www.vercelstatus.com/api/v2/status.json', 'Vercel Deployment'),
    checkStatusPage('https://status.supabase.com/api/v2/status.json', 'Supabase'),
    checkResend(),
  ])

  const dashboard: SystemResult = {
    name: 'Sovereign Dashboard',
    status: 'operational',
    message: null,
    checked_at: new Date().toISOString(),
  }

  const systems: SystemResult[] = [buildPipeline, github, vercel, supabase, email, dashboard]

  const hasDown = systems.some((s) => s.status === 'down')
  const hasDegraded = systems.some((s) => s.status === 'degraded')
  const overall: StatusResponse['overall'] = hasDown ? 'down' : hasDegraded ? 'degraded' : 'operational'

  const data: StatusResponse = {
    overall,
    systems,
    checked_at: new Date().toISOString(),
  }

  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS }

  res.setHeader('Cache-Control', 'public, max-age=60')
  res.status(200).json(data)
}
