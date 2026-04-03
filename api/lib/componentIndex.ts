// api/lib/componentIndex.ts — Component Index for Brain
//
// Maps every visible UI component in a generated app to exact file coordinates.
// Two entry points:
//   indexComponents()  — full index after initial build
//   reindexFiles()     — partial re-index after edits
//
// Non-fatal by design — errors are caught and logged, never thrown.

import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'

const MODEL_FAST = 'claude-haiku-4-5-20251001'

interface ComponentEntry {
  name: string
  file: string
  line_start: number | null
  line_end: number | null
  type: string | null
  description: string | null
  props: string[]
  visible_text: string[]
}

// ── Full index — called once after build completes ──────────────────────────

export async function indexComponents(
  buildId: string,
  owner: string,
  repo: string,
  anthropic: Anthropic,
  supabase: SupabaseClient,
  githubToken?: string,
): Promise<number> {
  try {
    const token = githubToken ?? process.env.SOVEREIGN_GITHUB_TOKEN ?? ''
    const ghHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    }

    // Fetch file tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
      { headers: ghHeaders },
    )
    if (!treeRes.ok) {
      console.warn(`[index] tree fetch failed: ${treeRes.status}`)
      return 0
    }

    const treeData = await treeRes.json() as { tree: Array<{ path: string; type: string }> }
    const srcFiles = treeData.tree.filter(
      (f) => f.type === 'blob' && f.path.startsWith('src/') && (f.path.endsWith('.tsx') || f.path.endsWith('.ts')),
    )

    if (srcFiles.length === 0) {
      console.log('[index] no src/ files found — skipping')
      return 0
    }

    // Fetch content of each file
    const fileContents = await fetchFileContents(srcFiles.map((f) => f.path), owner, repo, ghHeaders)

    if (fileContents.length === 0) {
      console.log('[index] no file contents fetched — skipping')
      return 0
    }

    // Call Haiku to index components
    const entries = await callHaikuIndex(fileContents, anthropic)

    if (entries.length === 0) {
      console.log('[index] Haiku returned 0 components')
      return 0
    }

    // Bulk insert
    const { error } = await supabase
      .from('component_index')
      .insert(entries.map((e) => ({ ...e, build_id: buildId })))

    if (error) {
      console.warn(`[index] insert failed: ${error.message}`)
      return 0
    }

    console.log(`[index] ${entries.length} components indexed for build ${buildId}`)
    return entries.length
  } catch (e) {
    console.warn('[index] indexing failed (non-fatal):', e)
    return 0
  }
}

// ── Partial re-index — called after edits ───────────────────────────────────

export async function reindexFiles(
  buildId: string,
  filePaths: string[],
  owner: string,
  repo: string,
  anthropic: Anthropic,
  supabase: SupabaseClient,
  githubToken?: string,
): Promise<number> {
  try {
    // Delete existing entries for the changed files
    const { error: delError } = await supabase
      .from('component_index')
      .delete()
      .eq('build_id', buildId)
      .in('file', filePaths)

    if (delError) {
      console.warn(`[index] delete failed: ${delError.message}`)
    }

    const token = githubToken ?? process.env.SOVEREIGN_GITHUB_TOKEN ?? ''
    const ghHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    }

    // Fetch content of only the changed files
    const fileContents = await fetchFileContents(filePaths, owner, repo, ghHeaders)

    if (fileContents.length === 0) {
      console.log('[index] no changed file contents fetched')
      return 0
    }

    // Call Haiku to index components
    const entries = await callHaikuIndex(fileContents, anthropic)

    if (entries.length === 0) {
      console.log('[index] reindex returned 0 components')
      return 0
    }

    // Insert new entries
    const { error } = await supabase
      .from('component_index')
      .insert(entries.map((e) => ({ ...e, build_id: buildId })))

    if (error) {
      console.warn(`[index] reindex insert failed: ${error.message}`)
      return 0
    }

    console.log(`[index] reindexed ${entries.length} components in ${filePaths.length} files`)
    return entries.length
  } catch (e) {
    console.warn('[index] reindex failed (non-fatal):', e)
    return 0
  }
}

// ── Shared helpers ──────────────────────────────────────────────────────────

async function fetchFileContents(
  paths: string[],
  owner: string,
  repo: string,
  ghHeaders: Record<string, string>,
): Promise<Array<{ path: string; content: string }>> {
  const results: Array<{ path: string; content: string }> = []

  // Fetch in parallel, max 10 concurrent
  const batches: string[][] = []
  for (let i = 0; i < paths.length; i += 10) {
    batches.push(paths.slice(i, i + 10))
  }

  for (const batch of batches) {
    const fetched = await Promise.all(
      batch.map(async (p) => {
        try {
          const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${p}`,
            { headers: ghHeaders },
          )
          if (!r.ok) return null
          const d = await r.json() as { content: string }
          return { path: p, content: Buffer.from(d.content, 'base64').toString('utf-8') }
        } catch {
          return null
        }
      }),
    )
    for (const f of fetched) {
      if (f) results.push(f)
    }
  }

  return results
}

async function callHaikuIndex(
  files: Array<{ path: string; content: string }>,
  anthropic: Anthropic,
): Promise<ComponentEntry[]> {
  const filesBlock = files.map((f) => `### ${f.path}\n${f.content}`).join('\n\n')

  const msg = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 4096,
    system: 'You are indexing a React + Vite app for a component registry. Return only valid JSON arrays. No markdown fences. No explanation.',
    messages: [{
      role: 'user',
      content: `Read every file below and return a JSON array of every distinct UI component, section, or interactive element rendered on screen.

For each component return:
{
  "name": "ComponentName as written in the file",
  "file": "src/path/to/file.tsx",
  "line_start": first line of the component function or const,
  "line_end": last closing brace of the component,
  "type": "section" | "button" | "form" | "nav" | "card" | "modal" | "page" | "other",
  "description": "one sentence — what this renders and where it appears on screen",
  "props": ["array", "of", "prop", "names"],
  "visible_text": ["every string literal the user would read on screen"]
}

Rules:
- Only include components that render visible UI (return JSX)
- Skip hooks, utilities, type definitions, constants
- Skip components not imported/used anywhere
- visible_text must include button labels, headings, placeholder text, nav links — anything a user would read or click
- line_start and line_end must be accurate integers

FILES:
${filesBlock}`,
    }],
  })

  const raw = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  // Defensive JSON extraction
  let parsed: unknown
  if (raw.startsWith('[')) {
    parsed = JSON.parse(raw)
  } else {
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) {
      console.warn('[index] Haiku did not return a JSON array:', raw.slice(0, 100))
      return []
    }
    parsed = JSON.parse(match[0])
  }

  if (!Array.isArray(parsed)) {
    console.warn('[index] Haiku response is not an array')
    return []
  }

  // Validate and clean each entry
  return (parsed as Array<Record<string, unknown>>)
    .filter((e) => typeof e.name === 'string' && typeof e.file === 'string')
    .map((e) => ({
      name: String(e.name),
      file: String(e.file),
      line_start: typeof e.line_start === 'number' ? e.line_start : null,
      line_end: typeof e.line_end === 'number' ? e.line_end : null,
      type: typeof e.type === 'string' ? e.type : null,
      description: typeof e.description === 'string' ? e.description : null,
      props: Array.isArray(e.props) ? (e.props as unknown[]).filter((p): p is string => typeof p === 'string') : [],
      visible_text: Array.isArray(e.visible_text) ? (e.visible_text as unknown[]).filter((t): t is string => typeof t === 'string') : [],
    }))
}
