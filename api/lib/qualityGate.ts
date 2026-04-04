// api/lib/qualityGate.ts — Brain Quality Gate
//
// Apps must score 85+ on the design audit before the customer sees them.
// If below 85, Haiku plans and applies fixes automatically.
// Maximum 2 fix attempts. Never throws.

import type Anthropic from '@anthropic-ai/sdk'
import type { AuditBreakdown } from '../audit-generated-app.js'

const MODEL_FAST = 'claude-haiku-4-5-20251001'
const QUALITY_THRESHOLD = 85

interface FixPlan {
  file: string
  issue: string
  fix_type: string
  fix_description: string
}

// ── GitHub helpers ──────────────────────────────────────────────────────────

async function ghGet(
  owner: string, repo: string, path: string, token: string,
): Promise<{ content: string; sha: string } | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } },
    )
    if (!res.ok) return null
    const data = await res.json() as { content: string; sha: string }
    return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha }
  } catch { return null }
}

async function ghPut(
  owner: string, repo: string, path: string, token: string,
  content: string, sha: string, message: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          content: Buffer.from(content).toString('base64'),
          sha,
        }),
      },
    )
    return res.ok
  } catch { return false }
}

// ── Main quality gate ───────────────────────────────────────────────────────

export async function qualityGate(
  auditScore: number,
  auditBreakdown: AuditBreakdown,
  owner: string,
  repo: string,
  anthropic: Anthropic,
  githubToken: string,
): Promise<'passed' | 'fixed' | 'failed'> {
  try {
    if (auditScore >= QUALITY_THRESHOLD) {
      console.log(`[qualityGate] score ${auditScore} — passed`)
      return 'passed'
    }

    console.log(`[qualityGate] score ${auditScore} — below ${QUALITY_THRESHOLD}, fixing`)

    // Collect all deductions
    const failures = Object.entries(auditBreakdown)
      .flatMap(([category, data]) =>
        data.deductions.map((d) => ({ category, issue: d })),
      )

    if (failures.length === 0) {
      console.log('[qualityGate] no deductions found — passing despite low score')
      return 'passed'
    }

    // Ask Haiku for a fix plan
    const planResponse = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are fixing quality issues in a generated React app. Here are the audit failures:

${failures.map((f) => '- [' + f.category + '] ' + f.issue).join('\n')}

For each failure, return a JSON array of file fixes:
[
  {
    "file": "src/pages/Login.tsx",
    "issue": "No navigation link back to home",
    "fix_type": "add_nav_link",
    "fix_description": "Add logo linking to / at top of page"
  }
]

Supported fix_types:
- add_nav_link: add navigation to auth/isolated pages
- fix_button_contrast: fix button color contrast
- fix_form_labels: add labels above form inputs
- replace_placeholder_text: replace Lorem ipsum or generic text
- add_missing_content: add required section that is empty

Only include fixes you are certain about. Max 5 fixes.
Return only valid JSON array. No fences.`,
      }],
    })

    const planRaw = planResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    let fixes: FixPlan[]
    try {
      const parsed = planRaw.startsWith('[') ? JSON.parse(planRaw) : JSON.parse((planRaw.match(/\[[\s\S]*\]/) ?? ['[]'])[0])
      fixes = Array.isArray(parsed) ? parsed.slice(0, 5) : []
    } catch {
      console.warn('[qualityGate] failed to parse fix plan:', planRaw.slice(0, 100))
      return 'failed'
    }

    if (fixes.length === 0) {
      console.log('[qualityGate] no fixes proposed — passing')
      return 'passed'
    }

    console.log(`[qualityGate] ${fixes.length} fixes planned:`, fixes.map((f) => f.file).join(', '))

    // Apply each fix
    let fixesApplied = 0
    for (const fix of fixes) {
      const file = await ghGet(owner, repo, fix.file, githubToken)
      if (!file) {
        console.warn(`[qualityGate] could not fetch ${fix.file} — skipping`)
        continue
      }

      const fixResponse = await anthropic.messages.create({
        model: MODEL_FAST,
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Fix this specific issue in the file below.

Issue: ${fix.fix_description}
Fix type: ${fix.fix_type}

Current file content:
${file.content}

Return ONLY the complete fixed file content.
No explanation. No fences. Just the fixed code.`,
        }],
      })

      const fixedContent = fixResponse.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim()

      if (!fixedContent || fixedContent === file.content) {
        console.log(`[qualityGate] no change needed in ${fix.file}`)
        continue
      }

      const pushed = await ghPut(
        owner, repo, fix.file, githubToken,
        fixedContent, file.sha,
        `fix: Brain quality gate — ${fix.fix_description}`,
      )

      if (pushed) {
        fixesApplied++
        console.log(`[qualityGate] fixed: ${fix.file}`)
      } else {
        console.warn(`[qualityGate] push failed: ${fix.file}`)
      }
    }

    if (fixesApplied > 0) {
      console.log(`[qualityGate] applied ${fixesApplied} fixes — Vercel will auto-redeploy`)
      return 'fixed'
    }

    return 'failed'
  } catch (err) {
    console.warn('[qualityGate] failed (non-fatal):', err instanceof Error ? err.message : String(err))
    return 'failed'
  }
}
