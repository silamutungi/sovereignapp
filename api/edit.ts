// api/edit.ts — Vercel Serverless Function
//
// POST /api/edit
// Body: { buildId, appName, repoUrl, editRequest }
// Returns: { ok: true, brain_followup? } immediately after triggering redeploy.
//
// Two edit modes:
//   NEW_PAGE  — instruction matches "add/create/build/make X page|section|screen"
//               → reads router + nav + pages list from GitHub, generates all
//                 changed files atomically via one Claude call, commits via
//                 GitHub Trees API (one atomic commit, no conflicts).
//   FILE_EDIT — all other instructions
//               → detects and edits a single file (Home.tsx → App.tsx → index.html)
//
// Status resolution happens in build-status.ts.
//
// Rate limit: 10 edits per hour per IP

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'

export const MODEL_GENERATION = 'claude-sonnet-4-6'
export const MODEL_FAST = 'claude-haiku-4-5-20251001'

// SECURITY AUDIT
// - Rate limited: 10/hr per IP
// - editRequest length capped at 1000 chars
// - HTML output validated before push (must contain doctype/html tag)
// - SOVEREIGN_GITHUB_TOKEN used for GitHub ops, falls back to build.github_token
// - SOVEREIGN_VERCEL_TOKEN + SOVEREIGN_VERCEL_TEAM_ID used for Vercel redeploy
// - build must not be soft-deleted
// - always UPDATE existing build row — never INSERT

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Matches: "add a pricing page", "create a contact section", "build an about screen"
const NEW_PAGE_PATTERN = /\b(add|create|build|make)\s+(?:a\s+|an\s+)?(\w+)\s+(?:page|section|screen)\b/i

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  console.log('[edit] START', new Date().toISOString())

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    'unknown'

  const rateLimitResult = checkRateLimit(`edit:${ip}`, 10, 60 * 60 * 1000)
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', String(rateLimitResult.retryAfter ?? 3600))
    res.status(429).json({ error: `Too many edits. Retry after ${rateLimitResult.retryAfter ?? 3600}s.` })
    return
  }

  const { buildId, appName, repoUrl, editRequest } =
    (req.body ?? {}) as Record<string, unknown>

  if (!buildId || !repoUrl || !editRequest) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  if (typeof editRequest !== 'string' || editRequest.trim().length === 0) {
    res.status(400).json({ error: 'Edit request cannot be empty' })
    return
  }

  if (editRequest.length > 1000) {
    res.status(400).json({ error: 'Edit request too long (max 1000 chars)' })
    return
  }

  const supabase = getSupabase()

  // Helper — always UPDATE the existing build row, never INSERT
  const setBuildStatus = async (status: string, step: string | null, error: string | null = null) => {
    await supabase
      .from('builds')
      .update({ status, step, ...(error !== null ? { error } : {}) })
      .eq('id', buildId)
  }

  try {
    // ── Fetch build ─────────────────────────────────────────────────────────
    console.log('[edit] fetching build...', new Date().toISOString())
    const { data: build, error: buildError } = await supabase
      .from('builds')
      .select('github_token, email, vercel_project_id, deploy_url')
      .eq('id', buildId)
      .is('deleted_at', null)
      .single()

    console.log('[edit] got build', new Date().toISOString(), 'error:', buildError?.message ?? 'none')

    if (buildError || !build) {
      console.error('[edit] build not found, buildId:', buildId)
      res.status(404).json({ error: 'Build not found' })
      return
    }

    // Prefer SOVEREIGN_GITHUB_TOKEN; fall back to stored user token
    const githubToken = process.env.SOVEREIGN_GITHUB_TOKEN ?? build.github_token
    console.log('[edit] using token:', process.env.SOVEREIGN_GITHUB_TOKEN ? 'sovereign' : 'user', new Date().toISOString())
    if (!githubToken) {
      console.error('[edit] no GitHub token available')
      res.status(500).json({ error: "We couldn't make that change. Please try again in a moment." })
      return
    }

    const repoPath = String(repoUrl).replace('https://github.com/', '')
    console.log('[edit] repo target:', repoPath, 'buildId:', buildId)

    const ghHeaders = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
    }

    // ── Plan mode — return summary without executing edit ────────────────────
    if (req.query?.plan === 'true') {
      // Step 1: Fetch file tree
      let planFileTree: string[] = []
      try {
        const treeRes = await fetch(
          `https://api.github.com/repos/${repoPath}/git/trees/main?recursive=1`,
          { headers: ghHeaders },
        )
        if (treeRes.ok) {
          const treeData = await treeRes.json() as { tree: Array<{ path: string; type: string }> }
          planFileTree = treeData.tree
            .filter((f) => f.type === 'blob' && f.path.startsWith('src/') && (f.path.endsWith('.tsx') || f.path.endsWith('.ts')))
            .map((f) => f.path)
        }
      } catch { /* non-fatal — planFileTree stays empty */ }

      // Step 2: Identify relevant files via Haiku
      let planRelevantPaths: string[] = []
      if (planFileTree.length > 0) {
        try {
          const haikuMsg = await anthropic.messages.create({
            model: MODEL_FAST,
            max_tokens: 256,
            messages: [{
              role: 'user',
              content: `Here is the file tree of a React + Vite app:\n${planFileTree.join('\n')}\n\nThe user wants to make this change: ${editRequest}\n\nReturn a JSON array of the file paths most likely to need reading or editing to fulfill this instruction. Include the file that owns the relevant component. Max 5 files. Return only JSON, no fences, no explanation.`,
            }],
          })
          const haikuRaw = haikuMsg.content
            .filter((b) => b.type === 'text')
            .map((b) => (b as { type: 'text'; text: string }).text)
            .join('')
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/, '')
            .trim()
          const parsed = JSON.parse(haikuRaw) as unknown
          if (Array.isArray(parsed)) {
            planRelevantPaths = (parsed as unknown[])
              .filter((p): p is string => typeof p === 'string' && planFileTree.includes(p))
              .slice(0, 5)
          }
        } catch { /* non-fatal — fileCount will be 0 */ }
      }

      // Generate plain English summary via Haiku
      const summaryMsg = await anthropic.messages.create({
        model: MODEL_FAST,
        max_tokens: 128,
        messages: [{
          role: 'user',
          content: `A user is editing their web app. Their instruction is: "${editRequest}"\n\nThe files that will change are: ${planRelevantPaths.length > 0 ? planRelevantPaths.join(', ') : 'the main page'}\n\nSummarize in one sentence what files will change and what the user will see. Never mention file names. Example: "I'll remove the image gallery from your homepage and clean up the footer." Return only the sentence.`,
        }],
      })
      const summary = summaryMsg.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('')
        .trim()

      console.log(`[edit] plan mode — ${summary}`)
      res.status(200).json({ plan: true, summary, fileCount: planRelevantPaths.length })
      return
    }

    // Mark build as building so the dashboard reflects the edit immediately
    await setBuildStatus('building', 'Applying your edit…')

    // ── GitHub file helper ───────────────────────────────────────────────────
    async function fetchGitHubFile(filePath: string): Promise<{ content: string; sha: string; path: string } | null> {
      const r = await fetch(`https://api.github.com/repos/${repoPath}/contents/${filePath}`, { headers: ghHeaders })
      if (!r.ok) return null
      const d = await r.json() as { content: string; sha: string }
      return { content: Buffer.from(d.content, 'base64').toString('utf-8'), sha: d.sha, path: filePath }
    }

    // ── Atomic multi-file commit via GitHub Trees API ────────────────────────
    // Uses the Git Data API to commit multiple files in one operation — avoids
    // the SHA conflicts that would occur with sequential single-file PUTs.
    async function atomicCommit(
      files: Array<{ path: string; content: string }>,
      commitMessage: string,
    ): Promise<string | null> {
      try {
        // Find the default branch (Sovereign always creates `main`)
        let headSha = ''
        let foundBranch = ''
        for (const branch of ['main', 'master']) {
          const refRes = await fetch(
            `https://api.github.com/repos/${repoPath}/git/refs/heads/${branch}`,
            { headers: ghHeaders },
          )
          if (refRes.ok) {
            const refData = await refRes.json() as { object: { sha: string } }
            headSha = refData.object.sha
            foundBranch = branch
            break
          }
        }
        if (!headSha) { console.error('[edit] atomicCommit: could not resolve HEAD'); return null }

        // Get the tree SHA from the current commit
        const commitRes = await fetch(
          `https://api.github.com/repos/${repoPath}/git/commits/${headSha}`,
          { headers: ghHeaders },
        )
        if (!commitRes.ok) return null
        const commitData = await commitRes.json() as { tree: { sha: string } }

        // Create a new tree with all changed files
        const treeRes = await fetch(
          `https://api.github.com/repos/${repoPath}/git/trees`,
          {
            method: 'POST',
            headers: { ...ghHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base_tree: commitData.tree.sha,
              tree: files.map((f) => ({
                path: f.path,
                mode: '100644' as const,
                type: 'blob' as const,
                content: f.content,
              })),
            }),
          },
        )
        if (!treeRes.ok) { console.error('[edit] atomicCommit: tree create failed', treeRes.status); return null }
        const treeData = await treeRes.json() as { sha: string }

        // Create the commit
        const newCommitRes = await fetch(
          `https://api.github.com/repos/${repoPath}/git/commits`,
          {
            method: 'POST',
            headers: { ...ghHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: commitMessage,
              tree: treeData.sha,
              parents: [headSha],
            }),
          },
        )
        if (!newCommitRes.ok) { console.error('[edit] atomicCommit: commit create failed', newCommitRes.status); return null }
        const newCommitData = await newCommitRes.json() as { sha: string }

        // Advance the branch ref
        const updateRefRes = await fetch(
          `https://api.github.com/repos/${repoPath}/git/refs/heads/${foundBranch}`,
          {
            method: 'PATCH',
            headers: { ...ghHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sha: newCommitData.sha }),
          },
        )
        return updateRefRes.ok ? newCommitData.sha : null
      } catch (e) {
        console.error('[edit] atomicCommit threw:', e)
        return null
      }
    }

    // ── Fetch brain lessons (shared by both paths) ───────────────────────────
    let editLessonContext = ''
    try {
      const supabaseUrl = process.env.SUPABASE_URL
      const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseUrl && serviceKey) {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 2000)
        const lr = await fetch(
          `${supabaseUrl}/rest/v1/lessons?solution=neq.&build_count=gte.3&order=build_count.desc&select=solution,category&limit=6`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: ctrl.signal },
        )
        clearTimeout(t)
        if (lr.ok) {
          const rows = await lr.json() as Array<{ solution: string; category: string }>
          if (rows.length > 0) {
            editLessonContext = '\n\nRECURRING LESSONS FROM PRODUCTION (apply these proactively):\n' +
              rows.map((r) => `- [${r.category}] ${r.solution}`).join('\n')
            console.log('[edit] injected', rows.length, 'brain lessons into edit context')
          }
        }
      }
    } catch {
      // Non-fatal — proceed without lesson context
    }

    // ── Detect edit mode ─────────────────────────────────────────────────────
    const isNewPage = NEW_PAGE_PATTERN.test(editRequest)
    let brainFollowup: string | null = null
    let commitSha: string | null = null

    // ════════════════════════════════════════════════════════════════════════
    // NEW_PAGE PATH
    // ════════════════════════════════════════════════════════════════════════
    if (isNewPage) {
      console.log('[edit] NEW_PAGE detected:', editRequest)

      const pageMatch = editRequest.match(NEW_PAGE_PATTERN)
      const pageName = pageMatch
        ? pageMatch[2].charAt(0).toUpperCase() + pageMatch[2].slice(1).toLowerCase()
        : 'New'

      // Fetch router file (try candidates in order)
      const ROUTER_CANDIDATES = ['src/App.tsx', 'src/router.tsx', 'src/routes.tsx']
      let routerFile: { content: string; sha: string; path: string } | null = null
      for (const c of ROUTER_CANDIDATES) {
        routerFile = await fetchGitHubFile(c)
        if (routerFile) break
      }

      // Fetch nav file (try candidates in order)
      const NAV_CANDIDATES = ['src/components/Nav.tsx', 'src/components/Navbar.tsx', 'src/components/Header.tsx']
      let navFile: { content: string; sha: string; path: string } | null = null
      for (const c of NAV_CANDIDATES) {
        navFile = await fetchGitHubFile(c)
        if (navFile) break
      }

      // List existing pages
      let existingPages: string[] = []
      try {
        const pagesRes = await fetch(
          `https://api.github.com/repos/${repoPath}/contents/src/pages`,
          { headers: ghHeaders },
        )
        if (pagesRes.ok) {
          const pagesData = await pagesRes.json() as Array<{ name: string }>
          existingPages = pagesData.map((f) => f.name)
        }
      } catch { /* non-fatal */ }

      await setBuildStatus('building', 'Generating new page…')

      const newPagePrompt = `You are Sovereign's world-class engineering agent. Add a new "${pageName}" page to this React app.

User instruction: "${editRequest}"

Router file (${routerFile?.path ?? 'src/App.tsx'}):
${routerFile?.content ?? '(not found — generate a minimal router that includes the new route)'}

Nav file (${navFile?.path ?? 'not found'}):
${navFile?.content ?? '(not found — set nav_update to null in your response)'}

Existing pages in src/pages/: ${existingPages.length > 0 ? existingPages.join(', ') : '(none)'}
${editLessonContext}

Return ONLY a raw JSON object — no markdown fences, no preamble, no trailing text. First character must be { and last must be }:
{
  "new_page": {
    "path": "src/pages/${pageName}.tsx",
    "content": "<complete TypeScript/JSX file>"
  },
  "router_update": {
    "path": "${routerFile?.path ?? 'src/App.tsx'}",
    "content": "<complete updated router file with new import and Route>"
  },
  "nav_update": ${navFile ? `{"path":"${navFile.path}","content":"<complete updated nav with new link>"}` : 'null'},
  "brain_followup": "<one sentence: the single most valuable next thing to build on this page>"
}

Rules for the new page:
- Complete, fully styled TypeScript React component using Tailwind
- React Router v6: useNavigate not useHistory, Routes not Switch, <Link> not <a> for internal links
- Named imports from 'react' — never React.* namespace (e.g. import { useState, type FormEvent } from 'react')
- No @/ path aliases — use relative paths
- All states designed: loading, error, empty, success
- WCAG AA contrast on every element
- Generous spacing: py-20 sections, max-w-5xl mx-auto px-6 content`

      const newPageMsg = await anthropic.messages.create({
        model: MODEL_GENERATION,
        max_tokens: 8000,
        messages: [{ role: 'user', content: newPagePrompt }],
      })

      const rawNewPage = newPageMsg.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('')
        .trim()

      const cleanedNewPage = rawNewPage.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

      let newPageSpec: {
        new_page: { path: string; content: string }
        router_update: { path: string; content: string }
        nav_update: { path: string; content: string } | null
        brain_followup: string
      }

      try {
        newPageSpec = JSON.parse(cleanedNewPage)
      } catch (parseErr) {
        console.error('[edit] NEW_PAGE JSON parse failed:', parseErr, '\nraw (first 300):', cleanedNewPage.slice(0, 300))
        await setBuildStatus('error', null, 'Could not generate new page')
        res.status(500).json({ error: 'Could not generate the new page' })
        return
      }

      brainFollowup = newPageSpec.brain_followup ?? null

      // Build atomic commit file list
      const filesToCommit: Array<{ path: string; content: string }> = [
        { path: newPageSpec.new_page.path, content: newPageSpec.new_page.content },
        { path: newPageSpec.router_update.path, content: newPageSpec.router_update.content },
      ]
      if (newPageSpec.nav_update) {
        filesToCommit.push({ path: newPageSpec.nav_update.path, content: newPageSpec.nav_update.content })
      }

      console.log('[edit] atomic commit — files:', filesToCommit.map((f) => f.path).join(', '))
      await setBuildStatus('building', 'Pushing new page…')

      const atomicSha = await atomicCommit(filesToCommit, `feat: add ${pageName} page with route and nav`)

      if (!atomicSha) {
        console.error('[edit] atomic commit failed')
        await setBuildStatus('error', null, 'Could not push new page to GitHub')
        res.status(500).json({ error: 'Could not push the new page' })
        return
      }

      commitSha = atomicSha
      console.log('[edit] atomic commit succeeded', commitSha.slice(0, 7), new Date().toISOString())

    // ════════════════════════════════════════════════════════════════════════
    // FILE_EDIT PATH — multi-file context-aware edit with single-file fallback
    // ════════════════════════════════════════════════════════════════════════
    } else {
      console.log('[edit] FILE_EDIT path — fetching file tree...', new Date().toISOString())

      // ── Image pre-fetch (shared by both multi-file and fallback paths) ─────
      let resolvedImageUrl: string | null = null
      const imageKeywords = editRequest.toLowerCase().match(
        /\b(image|photo|picture|hero|banner|background|portrait|scene|shot)\b/i
      )
      if (imageKeywords) {
        try {
          const stopWords = new Set(['add','a','an','the','of','in','at','on','to','with','and','or','is','are','was','were','be','it','this','that','for','hero','image','photo','picture'])
          const keywords = editRequest.toLowerCase()
            .replace(/[^a-z0-9 ]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 2 && !stopWords.has(w))
            .slice(0, 5)
            .join(',')
          if (keywords) {
            const imgRes = await fetch(`https://loremflickr.com/1600/900/${encodeURIComponent(keywords)}`, { redirect: 'follow' })
            if (imgRes.ok) {
              resolvedImageUrl = imgRes.url
              console.log('[edit] resolved image URL:', resolvedImageUrl)
            }
          }
        } catch (e) {
          console.warn('[edit] image prefetch failed (non-fatal):', e)
        }
      }

      const imageGuidance = resolvedImageUrl
        ? `\nIMAGES: Use this exact pre-fetched image URL (guaranteed to work): ${resolvedImageUrl}\nDo NOT use any other image URL — this one is already verified to load correctly.`
        : `\nIMAGES: Use https://loremflickr.com/1600/900/{keyword1},{keyword2},{keyword3} with keywords from the description. Never use source.unsplash.com, placeholder.com, or images.unsplash.com/photo-{id}.`

      // ── STEP 1: Fetch full file tree from GitHub ───────────────────────────
      let fileTree: string[] = []
      try {
        const treeRes = await fetch(
          `https://api.github.com/repos/${repoPath}/git/trees/main?recursive=1`,
          { headers: ghHeaders },
        )
        if (treeRes.ok) {
          const treeData = await treeRes.json() as { tree: Array<{ path: string; type: string }> }
          fileTree = treeData.tree
            .filter((f) => f.type === 'blob' && f.path.startsWith('src/') && (f.path.endsWith('.tsx') || f.path.endsWith('.ts')))
            .map((f) => f.path)
          console.log(`[edit] file-tree: ${fileTree.length} files`)
        }
      } catch (e) {
        console.warn('[edit] file tree fetch failed (non-fatal):', e)
      }

      let multiFileSucceeded = false

      if (fileTree.length > 0) {
        // ── STEP 2: Identify relevant files via Haiku ────────────────────────
        let relevantPaths: string[] = []
        try {
          const haikuMsg = await anthropic.messages.create({
            model: MODEL_FAST,
            max_tokens: 256,
            messages: [{
              role: 'user',
              content: `Here is the file tree of a React + Vite app:\n${fileTree.join('\n')}\n\nThe user wants to make this change: ${editRequest}\n\nReturn a JSON array of the file paths most likely to need reading or editing to fulfill this instruction. Include the file that owns the relevant component. Max 5 files. Return only JSON, no fences, no explanation.`,
            }],
          })
          const haikuRaw = haikuMsg.content
            .filter((b) => b.type === 'text')
            .map((b) => (b as { type: 'text'; text: string }).text)
            .join('')
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/, '')
            .trim()
          const parsed = JSON.parse(haikuRaw) as unknown
          if (Array.isArray(parsed)) {
            relevantPaths = (parsed as unknown[])
              .filter((p): p is string => typeof p === 'string' && fileTree.includes(p))
              .slice(0, 5)
          }
          console.log('[edit] relevant files:', relevantPaths.join(', '))
        } catch (e) {
          console.warn('[edit] Haiku file identification failed (falling back):', e)
        }

        if (relevantPaths.length > 0) {
          // ── STEP 3: Fetch content of each relevant file ──────────────────
          const fetchedFiles = await Promise.all(relevantPaths.map((p) => fetchGitHubFile(p)))
          const validFiles = fetchedFiles.filter((f): f is NonNullable<typeof f> => f !== null)

          if (validFiles.length > 0) {
            await setBuildStatus('building', 'Generating your edit…')

            const fileContextBlocks = validFiles
              .map((f) => `### ${f.path}\n${f.content}`)
              .join('\n\n---\n\n')

            // ── STEP 4: Generate multi-file edit with Sonnet ───────────────
            const multiFilePrompt = `You are Sovereign's world-class engineering agent editing a React + Vite + TypeScript web application. You apply design judgment at every level — the Jony Ive standard: calm, precise, trustworthy, quietly powerful.

User instruction: ${editRequest}
${imageGuidance}

Current file contents:
${fileContextBlocks}
${editLessonContext}

CODE RULES:
- Never use React.* namespace (use named imports: import { useState, type FormEvent } from 'react')
- Never use @/ path aliases — relative paths only
- React Router v6: useNavigate not useHistory, Routes not Switch
- Tailwind classes only — no inline styles except backgroundImage on hero sections
- Hero images: backgroundImage inline style on section element, never an img tag

Return a JSON object where:
- keys are file paths (e.g. "src/pages/Home.tsx")
- values are the complete updated file content

Only include files that actually need to change.
Return only valid JSON, no markdown fences. First character must be { and last must be }.`

            try {
              const multiFileMsg = await anthropic.messages.create({
                model: MODEL_GENERATION,
                max_tokens: 8000,
                messages: [{ role: 'user', content: multiFilePrompt }],
              })

              const rawMulti = multiFileMsg.content
                .filter((b) => b.type === 'text')
                .map((b) => (b as { type: 'text'; text: string }).text)
                .join('')
                .trim()
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```\s*$/, '')
                .trim()

              const changedFiles = JSON.parse(rawMulti) as Record<string, string>
              const entries = Object.entries(changedFiles).filter(([, v]) => typeof v === 'string' && v.length > 0)

              if (entries.length > 0) {
                const filesToCommit = entries.map(([path, content]) => ({ path, content }))
                console.log('[edit] atomic commit — files changed:', filesToCommit.map((f) => f.path).join(', '))
                await setBuildStatus('building', 'Pushing your change…')

                const atomicSha = await atomicCommit(filesToCommit, `edit: ${editRequest.slice(0, 60)}`)
                if (atomicSha) {
                  commitSha = atomicSha
                  multiFileSucceeded = true
                  console.log('[edit] atomic commit succeeded', commitSha.slice(0, 7), new Date().toISOString())
                } else {
                  console.warn('[edit] atomic commit failed — falling back to single-file mode')
                }
              } else {
                console.warn('[edit] multi-file response had no valid entries — falling back')
              }
            } catch (e) {
              console.warn('[edit] multi-file generation/parse failed (falling back):', e)
            }
          }
        }
      }

      // ── STEP 5: Fallback — single-file edit if multi-file path failed ──────
      if (!multiFileSucceeded) {
        console.log('[edit] file-map failed, falling back to single-file mode')

        const CANDIDATE_FILES = ['src/pages/Home.tsx', 'src/App.tsx', 'index.html']
        let targetFile: { content: string; sha: string; path: string } | null = null
        for (const candidate of CANDIDATE_FILES) {
          targetFile = await fetchGitHubFile(candidate)
          if (targetFile) { console.log('[edit] editing file:', candidate); break }
        }

        if (!targetFile) {
          console.error('[edit] no editable file found in repo')
          await setBuildStatus('error', null, 'Could not read app code from GitHub')
          res.status(500).json({ error: 'Could not read your app code' })
          return
        }

        const isReact = targetFile.path.endsWith('.tsx') || targetFile.path.endsWith('.ts')
        console.log('[edit] file:', targetFile.path, 'isReact:', isReact, 'length:', targetFile.content.length, new Date().toISOString())

        console.log('[edit] generating edit...', new Date().toISOString())
        await setBuildStatus('building', 'Generating your edit…')

        const prompt = isReact
          ? `You are Sovereign's world-class design + engineering agent. You embody the Jony Ive standard: calm, precise, trustworthy, quietly powerful, inevitable to use. A founder is asking you to improve their app. You don't apply changes mechanically — you apply design judgment at every level.

Return ONLY the complete updated file. No explanation, no markdown, no code fences. Just the raw TypeScript/JSX.

## DESIGN PHILOSOPHY — THE JONY IVE STANDARD

**7 Operating Rules (apply to every edit):**
1. Start with user intent, not feature inventory — ask what the user is trying to accomplish
2. Reduce until the remaining elements become stronger — every addition must earn its place
3. Treat polish as trust, not ornament — alignment, spacing, and timing signal care
4. Use motion only when it improves comprehension — entrance animations orient, not entertain
5. Make complexity the system's burden, not the user's — never expose machinery prematurely
6. Design full journeys, not isolated screens — every state (loading, error, empty, success) must feel designed
7. Judge every decision by clarity, coherence, and respect — does this save the user effort?

**6 Quality Heuristics (check before returning):**
- CLARITY: Is the primary action obvious within 2 seconds? Is information hierarchy unmistakable?
- REDUCTION: What can be removed without harming outcomes? Are we showing complexity users don't need?
- COHERENCE: Do layout, copy, motion, and interaction feel like one system? Does this feel native, not bolted on?
- CRAFT: Are spacing, typography, timing, and all states (loading/error/empty/success) consistently intentional?
- RESPECT: Does this save the user time, effort, or uncertainty? Are we asking users to do work the system should do?
- INTEGRITY: Is this truly better, or just more impressive-looking? Would it still be good without animations?

**Anti-patterns (never do these):**
- Mistaking minimal visuals for true simplicity
- Adding delight as decoration instead of product quality
- Overusing animation to create a "premium" feel
- Hiding too much and hurting discoverability
- Designing disconnected moments instead of end-to-end coherence
- Using personality, AI, or motion to compensate for weak product logic

**UX Writing Rules:**
- Short, clear, direct, calm, confident without hype
- Avoid: jargon, over-explaining, feature boasting, decorative copy
- No lorem ipsum — not even in development

## THE IMAGE RULE (non-negotiable)
There is exactly ONE image per app — the hero background. ZERO images in feature cards, ZERO img tags in content sections. If a section needs visual interest, use a large emoji (text-4xl), bold typography, or color contrast. Random stock photos in cards = template design. This is not a template.

Hero image: ALWAYS use backgroundImage inline style on the section — NEVER an img tag. img with h-full breaks on iOS Safari when parent has min-height only. Required pattern:
    <section style={{ backgroundImage: 'url(IMAGE_URL)', backgroundSize: 'cover', backgroundPosition: 'center' }} className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
      <div className="relative z-10 ...">content</div>
    </section>

If the user asks to "add image" without a specific location → hero only.
If the user asks to "add images to the features section" → use emoji icons instead (explain this is intentional design).

## LAYOUT & SPACING
- Generous spacing: py-20 md:py-32. Sections breathe. Content max-w-5xl mx-auto px-6.
- One primary action per screen. Supporting elements recede visually.

## MOTION
- Entrance animations only: opacity-0 translate-y-4 → opacity-100 translate-y-0, transition-all duration-500
- Hover: scale-[0.97] on buttons. No decorative spinning or bouncing.
- Elements below fold animate only when scrolled into view (IntersectionObserver).

${imageGuidance}

CODE RULES:
- Never use React.* namespace (use named imports: import { useState } from 'react')
- Never use @/ path aliases
- Keep all existing imports unless replacing them
- Tailwind classes only — no inline styles (except backgroundImage on hero sections)

Here is the current ${targetFile.path}:

${targetFile.content}

The user wants this change: ${editRequest}
${editLessonContext}
Apply the change with full design judgment. Return the complete updated file.`
          : `You are editing a web app. Return ONLY the complete updated index.html file. No explanation, no markdown, no code fences. Just the raw HTML.
${imageGuidance}

Here is the current index.html:

${targetFile.content}

The user wants this change: ${editRequest}
${editLessonContext}
Apply the change. Keep everything else identical. Return the complete updated index.html.`

        const message = await anthropic.messages.create({
          model: MODEL_GENERATION,
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        })

        const updatedContent = message.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('')
          .trim()

        const isValidOutput = isReact
          ? updatedContent.length > 50
          : updatedContent.includes('<!DOCTYPE') || updatedContent.includes('<html')

        if (!isValidOutput) {
          console.error('[edit] Claude returned unexpected output, length:', updatedContent.length)
          await setBuildStatus('error', null, 'Could not generate the edit')
          res.status(500).json({ error: 'Could not generate the edit' })
          return
        }
        console.log('[edit] edit generated, length:', updatedContent.length, new Date().toISOString())

        console.log('[edit] pushing to github...', new Date().toISOString())
        await setBuildStatus('building', 'Pushing your change…')

        const pushRes = await fetch(
          `https://api.github.com/repos/${repoPath}/contents/${targetFile.path}`,
          {
            method: 'PUT',
            headers: {
              ...ghHeaders,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `Edit: ${editRequest.slice(0, 50)}`,
              content: Buffer.from(updatedContent).toString('base64'),
              sha: targetFile.sha,
            }),
          },
        )

        if (!pushRes.ok) {
          const pushBody = await pushRes.text().catch(() => '')
          console.error('[edit] GitHub push FAILED:', pushRes.status, pushBody)
          await setBuildStatus('error', null, 'Could not push change to GitHub')
          res.status(500).json({ error: 'Could not save the change' })
          return
        }

        const pushData = await pushRes.json() as { commit?: { sha: string } }
        commitSha = pushData.commit?.sha ?? null
        console.log('[edit] pushed to github, commit sha:', commitSha ?? 'unknown', new Date().toISOString())
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // VERCEL REDEPLOY (shared by both paths)
    // ════════════════════════════════════════════════════════════════════════
    console.log('[edit] triggering redeploy...', new Date().toISOString())
    await setBuildStatus('building', 'Deploying your edit…')

    const vcProjectId = build.vercel_project_id
    const vcTeamId    = process.env.SOVEREIGN_VERCEL_TEAM_ID
    const vcToken     = process.env.SOVEREIGN_VERCEL_TOKEN

    console.log('[edit] vercel ids — projectId:', vcProjectId ?? 'MISSING', 'teamId:', vcTeamId ?? 'MISSING', 'token:', !!vcToken, new Date().toISOString())

    if (vcProjectId && vcTeamId && vcToken) {
      const deployListRes = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(vcProjectId)}&teamId=${encodeURIComponent(vcTeamId)}&limit=1`,
        { headers: { Authorization: `Bearer ${vcToken}` } },
      )
      console.log('[edit] deploy list status:', deployListRes.status, new Date().toISOString())

      if (deployListRes.ok) {
        const deployList = await deployListRes.json() as { deployments?: Array<{ uid: string; name?: string; state?: string }> }
        const latest = deployList.deployments?.[0]
        console.log('[edit] latestDeployment shape:', JSON.stringify(latest ?? {}).slice(0, 500), new Date().toISOString())

        if (latest?.uid) {
          const redeployRes = await fetch(
            `https://api.vercel.com/v13/deployments?forceNew=1&teamId=${encodeURIComponent(vcTeamId)}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${vcToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name:         latest.name,
                deploymentId: latest.uid,
                target:       'production',
              }),
            },
          )

          const redeployBody = await redeployRes.text().catch(() => '')
          console.log('[edit] redeploy response status:', redeployRes.status, new Date().toISOString())
          console.log('[edit] redeploy body:', JSON.stringify(redeployBody).slice(0, 300), new Date().toISOString())

          if (!redeployRes.ok) {
            console.warn('[edit] Vercel redeploy non-fatal:', redeployRes.status, redeployBody)
          }
        } else {
          console.warn('[edit] no existing deployment found for project:', vcProjectId, new Date().toISOString())
        }
      } else {
        const listBody = await deployListRes.text().catch(() => '')
        console.warn('[edit] deploy list failed:', deployListRes.status, listBody, new Date().toISOString())
      }
    } else {
      console.warn('[edit] missing Vercel env vars — relying on GitHub auto-deploy', new Date().toISOString())
    }

    // Return immediately — build-status.ts will detect READY state and resolve
    console.log('[edit] returning 200', new Date().toISOString())
    void appName
    res.status(200).json({
      ok: true,
      message: 'Edit deployed',
      commitSha: commitSha ?? null,
      deployUrl: build.deploy_url ?? null,
      ...(brainFollowup ? { brain_followup: brainFollowup } : {}),
    })

  } catch (err) {
    console.error('[edit] Error:', err, new Date().toISOString())
    try { await setBuildStatus('error', null, 'Something went wrong during the edit') } catch { /* ignore */ }
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
