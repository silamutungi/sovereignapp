// api/lib/lessons.ts — Brain Memory (LESSONS.md) for generated apps
//
// Three entry points:
//   createLessonsFile()  — scaffold initial LESSONS.md at build time
//   appendLesson()       — append to a section after edits/autofixes/observations
//   readLessons()        — fetch full content before every edit
//
// Never throws — errors are caught and logged.

const SECTION_MARKERS: Record<string, string> = {
  edit_history: '## Edit History',
  brain_observations: '## Brain Observations',
  lessons_learned: '## Lessons Learned',
  founder_patterns: '## Founder Patterns',
}

// ── GitHub helpers ──────────────────────────────────────────────────────────

async function ghGetFile(
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
  } catch {
    return null
  }
}

async function ghPutFile(
  owner: string, repo: string, path: string, token: string,
  content: string, message: string, sha?: string,
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = {
      message,
      content: Buffer.from(content).toString('base64'),
    }
    if (sha) body.sha = sha

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )
    return res.ok
  } catch {
    return false
  }
}

// ── createLessonsFile — called once at generation time ──────────────────────

interface BuildContext {
  id: string
  idea: string
  app_name: string
  app_type: string
  deploy_url: string
}

export async function createLessonsFile(
  build: BuildContext,
  files: string[],
  owner: string,
  repo: string,
  githubToken: string,
): Promise<boolean> {
  try {
    const pages = files.filter((f) => f.includes('src/pages/')).join(', ') || 'none'
    const components = files.filter((f) => f.includes('src/components/')).join(', ') || 'none'

    const content = `# ${build.app_name} — Brain Memory

## App Context
- **Idea:** ${build.idea}
- **Category:** ${build.app_type}
- **Generated:** ${new Date().toISOString().split('T')[0]}
- **Stack:** React + Vite + TypeScript + Supabase + Vercel
- **Live URL:** ${build.deploy_url}
- **Files generated:** ${files.length}

## Generation Notes
- Pages: ${pages}
- Components: ${components}

## Founder Patterns
<!-- Brain learns the founder's preferences here -->
<!-- Updated automatically after every interaction -->
- Edits to date: 0
- Most edited section: unknown
- Primary focus: unknown
- Launch status: not launched

## Edit History
<!-- Brain appends after every edit -->
<!-- Format: [date] instruction \u2192 files changed \u2192 outcome -->

## Brain Observations
<!-- Proactive hints Brain has surfaced -->
<!-- Format: [date] category: observation -->

## Lessons Learned
<!-- Mistakes made and fixed \u2014 never repeat these -->
<!-- Format: [date] what broke \u2192 what fixed it -->
`

    const ok = await ghPutFile(owner, repo, 'LESSONS.md', githubToken, content, 'init: Brain memory file')
    if (ok) {
      console.log(`[lessons] created LESSONS.md for ${build.app_name}`)
    } else {
      console.warn(`[lessons] failed to create LESSONS.md for ${build.app_name}`)
    }
    return ok
  } catch (err) {
    console.warn('[lessons] createLessonsFile failed (non-fatal):', err instanceof Error ? err.message : String(err))
    return false
  }
}

// ── appendLesson — append entry to a specific section ───────────────────────

export async function appendLesson(
  owner: string,
  repo: string,
  section: 'edit_history' | 'brain_observations' | 'lessons_learned' | 'founder_patterns',
  entry: string,
  githubToken: string,
): Promise<boolean> {
  try {
    const file = await ghGetFile(owner, repo, 'LESSONS.md', githubToken)
    if (!file) {
      console.warn(`[lessons] LESSONS.md not found in ${repo} — cannot append`)
      return false
    }

    const marker = SECTION_MARKERS[section]
    if (!marker) {
      console.warn(`[lessons] unknown section: ${section}`)
      return false
    }

    const timestamp = new Date().toISOString().split('T')[0]
    const newEntry = `- [${timestamp}] ${entry}`

    const lines = file.content.split('\n')
    const markerIdx = lines.findIndex((l) => l.trim() === marker)
    if (markerIdx === -1) {
      console.warn(`[lessons] section "${marker}" not found in LESSONS.md`)
      return false
    }

    // Find the next ## heading after the marker (or end of file)
    let insertIdx = lines.length
    for (let i = markerIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        insertIdx = i
        break
      }
    }

    // Insert before the next heading (or at end), after a blank line
    lines.splice(insertIdx, 0, newEntry, '')

    const updated = lines.join('\n')
    const ok = await ghPutFile(owner, repo, 'LESSONS.md', githubToken, updated, `brain: update ${section}`, file.sha)

    if (ok) {
      console.log(`[lessons] appended to ${section} for ${repo}`)
    } else {
      console.warn(`[lessons] failed to append to ${section} for ${repo}`)
    }
    return ok
  } catch (err) {
    console.warn('[lessons] appendLesson failed (non-fatal):', err instanceof Error ? err.message : String(err))
    return false
  }
}

// ── readLessons — fetch full LESSONS.md content ─────────────────────────────

export async function readLessons(
  owner: string,
  repo: string,
  githubToken: string,
): Promise<string | null> {
  try {
    const file = await ghGetFile(owner, repo, 'LESSONS.md', githubToken)
    if (!file) return null
    console.log(`[lessons] read ${file.content.length} chars from ${repo}`)
    return file.content
  } catch (err) {
    console.warn('[lessons] readLessons failed (non-fatal):', err instanceof Error ? err.message : String(err))
    return null
  }
}
