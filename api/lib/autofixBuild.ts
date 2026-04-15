import Anthropic from '@anthropic-ai/sdk'
import { appendLesson } from './lessons.js'

const MODEL_FAST = 'claude-haiku-4-5-20251001'

interface TsError {
  file: string
  line: number
  code: string
  message: string
  raw: string
}

interface Fix {
  file: string
  action: 'remove_import' | 'remove_unused_var'
  target: string
  reason: string
}

// ── Parse TypeScript errors from Vercel build log ────────────────────────────

function parseTsErrors(logText: string): TsError[] {
  const errors: TsError[] = []
  // Match patterns like: src/pages/HowItWorks.tsx(5,44): error TS6133: 'Star' is declared but its value is never read.
  const re = /([^\s(]+)\((\d+),\d+\):\s*error\s+(TS\d+):\s*(.+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(logText)) !== null) {
    errors.push({
      file: m[1],
      line: parseInt(m[2], 10),
      code: m[3],
      message: m[4],
      raw: m[0],
    })
  }
  return errors
}

// ── Apply a remove_import fix to file content ────────────────────────────────

function applyRemoveImport(content: string, target: string): string {
  const lines = content.split('\n')
  const result: string[] = []
  for (const line of lines) {
    // Match import lines containing the target
    if (/^\s*import\s+\{/.test(line) && line.includes(target)) {
      // Check if it's the only import in the statement
      const match = line.match(/import\s*\{([^}]+)\}\s*from/)
      if (match) {
        const names = match[1].split(',').map(n => n.trim()).filter(Boolean)
        const filtered = names.filter(n => {
          // Handle "type X" imports and "X as Y" aliases
          const base = n.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
          return base !== target
        })
        if (filtered.length === 0) {
          // All imports removed — skip this line entirely
          continue
        }
        // Rebuild the import line with remaining imports
        const from = line.match(/from\s+['"].*['"]/)
        if (from) {
          result.push(`import { ${filtered.join(', ')} } ${from[0]}`)
          continue
        }
      }
    }
    result.push(line)
  }
  return result.join('\n')
}

// ── Apply a remove_unused_var fix to file content ────────────────────────────

function applyRemoveVar(content: string, target: string): string {
  const lines = content.split('\n')
  return lines.filter(line => {
    // Match: const target = ..., let target = ..., var target = ...
    const re = new RegExp(`^\\s*(const|let|var)\\s+${target}\\b`)
    return !re.test(line)
  }).join('\n')
}

// ── Fetch a file from GitHub ─────────────────────────────────────────────────

async function ghGet(
  owner: string, repo: string, path: string, token: string,
): Promise<{ content: string; sha: string } | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } },
    )
    if (!res.ok) return null
    const data = await res.json() as { content: string; sha: string }
    const decoded = Buffer.from(data.content, 'base64').toString('utf-8')
    return { content: decoded, sha: data.sha }
  } catch {
    return null
  }
}

// ── Push a file to GitHub ────────────────────────────────────────────────────

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
          Authorization: `token ${token}`,
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
  } catch {
    return false
  }
}

// ── Main autofix function ────────────────────────────────────────────────────

export async function autofixBuild(
  buildError: string,
  owner: string,
  repo: string,
  githubToken: string,
): Promise<{ result: 'fixed' | 'failed' | 'skipped'; fixCount: number }> {
  try {
    // 1. Parse TS errors from the build log
    const tsErrors = parseTsErrors(buildError)
    if (tsErrors.length === 0) {
      console.log('[autofix] no TS errors found in build log — skipping')
      return { result: 'skipped', fixCount: 0 }
    }

    console.log(`[autofix] found ${tsErrors.length} TS error(s):`, tsErrors.map(e => e.raw))

    // 2. Ask Haiku for fix plan
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const msg = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are fixing TypeScript build errors in a React app.

Build errors:
${tsErrors.map(e => e.raw).join('\n')}

For each error, return a JSON array of fixes:
[
  {
    "file": "src/pages/HowItWorks.tsx",
    "action": "remove_import",
    "target": "Star",
    "reason": "TS6133: declared but never read"
  }
]

Supported actions:
- remove_import: remove a named import from an import statement
- remove_unused_var: remove an unused variable declaration

Only return fixes you are certain about. Only fix TS6133 (unused) and TS6196 (unused) errors.

For TS2345 and TS2339 errors involving Supabase queries (errors mentioning 'never' type), the fix is always to add 'as any' casting to the Supabase query. For example:
- supabase.from('x').select() → (supabase.from('x') as any).select()
- .insert({...}) → .insert({...} as any)
- .update({...}) → .update({...} as any)
These are always safe fixes for generated apps without type definitions.

Return only valid JSON array. No markdown fences. No explanation.`,
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    let fixes: Fix[]
    try {
      // Strip markdown fences if present
      const cleaned = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
      fixes = JSON.parse(cleaned) as Fix[]
    } catch {
      console.warn('[autofix] failed to parse Haiku response:', text.slice(0, 200))
      return { result: 'failed', fixCount: 0 }
    }

    if (!Array.isArray(fixes) || fixes.length === 0) {
      console.log('[autofix] Haiku returned no fixes')
      return { result: 'skipped', fixCount: 0 }
    }

    console.log(`[autofix] Haiku proposed ${fixes.length} fix(es):`, fixes.map(f => `${f.action}:${f.target} in ${f.file}`))

    // 3. Group fixes by file and apply
    const fixesByFile = new Map<string, Fix[]>()
    for (const fix of fixes) {
      const arr = fixesByFile.get(fix.file) ?? []
      arr.push(fix)
      fixesByFile.set(fix.file, arr)
    }

    let totalFixed = 0

    for (const [filePath, fileFixes] of fixesByFile) {
      const file = await ghGet(owner, repo, filePath, githubToken)
      if (!file) {
        console.warn(`[autofix] could not fetch ${filePath} — skipping`)
        continue
      }

      let content = file.content
      for (const fix of fileFixes) {
        if (fix.action === 'remove_import') {
          content = applyRemoveImport(content, fix.target)
        } else if (fix.action === 'remove_unused_var') {
          content = applyRemoveVar(content, fix.target)
        }
      }

      if (content === file.content) {
        console.log(`[autofix] no changes needed in ${filePath}`)
        continue
      }

      const pushed = await ghPut(
        owner, repo, filePath, githubToken,
        content, file.sha,
        `fix: auto-fix build errors (Brain)\n\nFixed: ${fileFixes.map(f => `${f.action}:${f.target}`).join(', ')}`,
      )

      if (pushed) {
        totalFixed += fileFixes.length
        console.log(`[autofix] fixed ${fileFixes.length} error(s) in ${filePath}`)
      } else {
        console.warn(`[autofix] failed to push fix for ${filePath}`)
      }
    }

    if (totalFixed > 0) {
      console.log(`[autofix] fixed ${totalFixed} error(s) in ${fixesByFile.size} file(s) — Vercel will auto-redeploy`)

      // Append autofix lesson to Brain memory — fire-and-forget
      const lesson = 'Build error auto-fixed: ' +
        tsErrors.map((e) => e.code + ' in ' + e.file).join(', ') +
        ' \u2192 removed unused imports'
      appendLesson(owner, repo, 'lessons_learned', lesson, githubToken)
        .catch(() => {})

      return { result: 'fixed', fixCount: totalFixed }
    }

    return { result: 'failed', fixCount: 0 }
  } catch (err) {
    console.warn('[autofix] failed (non-fatal):', err instanceof Error ? err.message : String(err))
    return { result: 'failed', fixCount: 0 }
  }
}
