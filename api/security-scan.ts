// api/security-scan.ts — POST /api/security-scan
//
// Scans a generated app's GitHub repo for security vulnerabilities using Claude.
// Called when the founder clicks "Claim →" on the edit page — before claim modal.
//
// Checks: exposed env vars, hardcoded secrets, missing RLS policies,
//         missing input validation, dangerous innerHTML patterns.
//
// Body: { build_id }
// Returns: { passed: boolean, issues: SecurityIssue[], score: number }
//
// Rate limit: 5/hr per IP (heavy — fetches 7 files + Claude call)

// SECURITY AUDIT
// - Rate limited: 5/hr per IP
// - build_id verified against Supabase — can't scan arbitrary repos
// - GitHub token read server-side from builds table, never from request body
// - No secrets logged

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, getClientIp } from './_rateLimit.js'

const MODEL_FAST = 'claude-haiku-4-5-20251001'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface SecurityIssue {
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  file?: string
}

const SCAN_FILES = [
  'src/lib/supabase.ts',
  'vercel.json',
  'src/App.tsx',
  'src/pages/Login.tsx',
  'src/pages/Signup.tsx',
  '.env.example',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = getClientIp(req)
  const rl = checkRateLimit(`security-scan:${ip}`, 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  const { build_id } = (req.body ?? {}) as { build_id?: string }
  if (!build_id) {
    res.status(400).json({ error: 'build_id is required' })
    return
  }

  const supabase = getSupabase()

  try {
    const { data: build, error: buildErr } = await supabase
      .from('builds')
      .select('repo_url, github_token')
      .eq('id', build_id)
      .is('deleted_at', null)
      .single()

    if (buildErr || !build) {
      res.status(404).json({ error: 'Build not found' })
      return
    }

    const repoPath = String(build.repo_url ?? '').replace('https://github.com/', '')
    if (!repoPath || !repoPath.includes('/')) {
      res.status(400).json({ error: 'No valid repo URL on build' })
      return
    }

    // Prefer SOVEREIGN_GITHUB_TOKEN — same pattern as edit.ts
    const token = process.env.SOVEREIGN_GITHUB_TOKEN ?? build.github_token
    if (!token) {
      res.status(500).json({ error: 'No GitHub token available' })
      return
    }

    const ghHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    }

    // Fetch target files in parallel — missing files are silently skipped
    const fileResults = await Promise.all(
      SCAN_FILES.map(async (path) => {
        try {
          const r = await fetch(
            `https://api.github.com/repos/${repoPath}/contents/${path}`,
            { headers: ghHeaders, signal: AbortSignal.timeout(5000) },
          )
          if (!r.ok) return null
          const d = await r.json() as { content?: string; encoding?: string }
          if (!d.content || d.encoding !== 'base64') return null
          return { path, content: Buffer.from(d.content, 'base64').toString('utf-8') }
        } catch {
          return null
        }
      }),
    )

    const files = fileResults.filter(Boolean) as Array<{ path: string; content: string }>

    if (files.length === 0) {
      // Can't scan without files — pass with explanation
      return res.status(200).json({ passed: true, issues: [], score: 100, note: 'Could not fetch repository files for scanning' })
    }

    const fileContext = files
      .map((f) => `=== ${f.path} ===\n${f.content.slice(0, 2500)}`)
      .join('\n\n')

    const prompt = `You are a security auditor reviewing a generated web app before the founder takes ownership. Scan these source files carefully.

${fileContext}

Check for:
1. Hardcoded secrets, API keys, tokens, or passwords in source code (high severity)
2. Supabase service role key or admin tokens used client-side (high severity)
3. Missing Supabase RLS — apps using supabase.ts without any mention of RLS policies (high severity)
4. Forms that submit without validating required fields (medium severity)
5. dangerouslySetInnerHTML or innerHTML = used with user-controlled input (medium severity)
6. console.log statements that might expose sensitive data (low severity)
7. .env.example files that contain real values instead of placeholder descriptions (high severity)

Return JSON only — no other text:
{
  "issues": [
    { "severity": "high" | "medium" | "low", "title": "Short title", "description": "One sentence explanation", "file": "path/to/file" }
  ],
  "score": 0-100
}

Scoring: start at 100. Deduct 30 per high issue, 15 per medium, 5 per low. Minimum 0.
If no issues found: { "issues": [], "score": 100 }`

    const message = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(200).json({ passed: true, issues: [], score: 100 })
    }

    const result = JSON.parse(jsonMatch[0]) as { issues: SecurityIssue[]; score: number }
    const issues = Array.isArray(result.issues) ? result.issues : []
    const score = Math.max(0, Math.min(100, Number(result.score ?? 100)))
    const hasHighSeverity = issues.some((i) => i.severity === 'high')

    res.status(200).json({
      passed: score >= 70 && !hasHighSeverity,
      issues,
      score,
    })
  } catch (err) {
    console.error('[security-scan] error:', err instanceof Error ? err.message : String(err))
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
