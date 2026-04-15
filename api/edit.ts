// api/edit.ts — Vercel Serverless Function
//
// POST /api/edit
// Body: { buildId, appName, repoUrl, editRequest }
// Returns: { ok: true, changed, changedFiles[], commitSha } after triggering redeploy.
//
// Unified 3-step flow (all instruction types):
//   1. Haiku classifier — identifies existing files to edit + new files to create
//   2. Sonnet execution — edits/creates all files in one call, returns JSON { files }
//   3. Atomic commit — Git Trees API, single commit, zero-change detection
//
// Status resolution happens in build-status.ts.
//
// Rate limit: 10 edits per hour per IP

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from './_rateLimit.js'
import { resolveHeroImage } from './lib/images.js'
import { reindexFiles } from './lib/componentIndex.js'
import type { AppTopology } from './lib/buildTopology.js'
import type { AppManifest } from './lib/generateManifest.js'
import { generateRecommendations } from './lib/structuralRecommendations.js'
import { visionMap } from './lib/visionMap.js'
import type { VisionMapResult } from './lib/visionMap.js'
import { captureScreenshot } from './lib/screenshot.js'
import { readLessons, appendLesson } from './lib/lessons.js'
import { scorePropensity, getTopPropensities, recordPattern } from './lib/propensity.js'
import { checkEditRate } from './lib/quotaCheck.js'

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

// ── Classifier result type ──────────────────────────────────────────────────
interface ClassifierResult {
  instruction_type: string
  relevant_files: string[]
  create_files: string[]
  atomic_requirements: string[]
  risk: string
  risk_reason: string
  validation_checks: string[]
  plan_summary: string
}

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

  // ── Plan-based edit rate limit ──────────────────────────────────────────
  const editRateCheck = await checkEditRate(String(buildId))
  if (!editRateCheck.allowed) {
    res.status(429).json({
      error: 'rate_limited',
      message: editRateCheck.reason,
      current: editRateCheck.current,
      limit: editRateCheck.limit,
    })
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
      .select('id, github_token, email, vercel_project_id, deploy_url, screenshot_url, supabase_project_ref, repo_url, idea, app_type, app_name, app_category, app_manifest, app_topology')
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
    console.log('[edit] using token:', process.env.SOVEREIGN_GITHUB_TOKEN ? 'visila' : 'user', new Date().toISOString())
    if (!githubToken) {
      console.error('[edit] no GitHub token available')
      res.status(500).json({ error: "We couldn't make that change. Please try again in a moment." })
      return
    }

    const repoPath = String(repoUrl).replace('https://github.com/', '')
    const [repoOwner, repoName] = repoPath.split('/')
    console.log('[edit] repo target:', repoPath, 'buildId:', buildId)

    const ghHeaders = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
    }

    // ── Fetch file tree (shared by classifier, plan mode, and edit) ──────────
    let fileTree: string[] = []
    try {
      const treeRes = await fetch(
        `https://api.github.com/repos/${repoPath}/git/trees/main?recursive=1`,
        { headers: ghHeaders },
      )
      if (treeRes.ok) {
        const treeData = await treeRes.json() as { tree: Array<{ path: string; type: string }> }
        fileTree = treeData.tree
          .filter((f) => f.type === 'blob' && f.path.startsWith('src/') && (f.path.endsWith('.tsx') || f.path.endsWith('.ts') || f.path.endsWith('.css')))
          .map((f) => f.path)
        console.log(`[edit] file-tree: ${fileTree.length} files`)
      }
    } catch (e) {
      console.warn('[edit] file tree fetch failed (non-fatal):', e)
    }

    // ── Fetch component index for Brain-guided file identification ──────────
    let indexContext = ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let componentIndex: any[] | null = null
    try {
      const { data: ciData } = await supabase
        .from('component_index')
        .select('name, file, line_start, line_end, type, description, visible_text')
        .eq('build_id', build.id)

      componentIndex = ciData

      if (componentIndex && componentIndex.length > 0) {
        indexContext = 'COMPONENT INDEX:\n' + componentIndex.map((c: { name: string; file: string; line_start: number | null; line_end: number | null; type: string | null; description: string | null; visible_text: unknown }) =>
          `${c.name} (${c.type ?? 'unknown'}) \u2192 ${c.file}:${c.line_start ?? '?'}-${c.line_end ?? '?'}\n` +
          `  What it does: ${c.description ?? 'no description'}\n` +
          `  Visible text: ${Array.isArray(c.visible_text) ? (c.visible_text as string[]).join(' | ') : 'none'}`
        ).join('\n\n') + '\n\n'
        console.log(`[edit] component index: ${componentIndex.length} entries loaded`)
      }
    } catch (idxErr) {
      console.warn('[edit] component index fetch failed (non-fatal):', idxErr)
    }

    // ── Phase 3: Vision mapping — Brain sees the page ───────────────────────
    let visionResult: VisionMapResult | null = null
    let visionContext = ''

    const screenshotUrl = build.screenshot_url ?? null

    if (screenshotUrl && componentIndex && componentIndex.length > 0) {
      console.log('[edit] running vision map...')
      visionResult = await visionMap(
        String(editRequest),
        screenshotUrl,
        componentIndex.map((c: { name: string; file: string; line_start: number | null; line_end: number | null; type: string | null; description: string | null; visible_text: unknown }) => ({
          name: c.name,
          file: c.file,
          line_start: c.line_start,
          line_end: c.line_end,
          type: c.type,
          description: c.description,
          visible_text: Array.isArray(c.visible_text) ? c.visible_text as string[] : [],
        })),
        anthropic,
      )

      if (visionResult) {
        visionContext = 'VISION ANALYSIS:\n' +
          'Visual zone identified: ' + visionResult.visual_zone + '\n' +
          'Matched components: ' + visionResult.matched_components.join(', ') + '\n' +
          'Suggested files: ' + visionResult.target_files.join(', ') + '\n' +
          'Vision confidence: ' + visionResult.confidence + '\n' +
          'Reasoning: ' + visionResult.reasoning + '\n\n' +
          'Use the vision analysis to guide file selection. ' +
          'If confidence is high, prioritize the suggested files. ' +
          'If confidence is low, use the component index and file tree.\n\n'
      }
    } else {
      console.log('[edit] vision map skipped —',
        !screenshotUrl ? 'no screenshot' : 'no component index')
    }

    // ── Read Brain memory for this app ────────────────────────────────────
    let lessonsContext = ''
    try {
      const lessonsContent = await readLessons(
        repoOwner, repoName,
        process.env.SOVEREIGN_GITHUB_TOKEN ?? githubToken,
      )
      if (lessonsContent) {
        lessonsContext = 'BRAIN MEMORY FOR THIS APP:\n' +
          lessonsContent.slice(0, 3000) + '\n\n'
      }
    } catch (e) {
      console.warn('[edit] lessons read failed (non-fatal):', e)
    }

    // ── Fetch founder propensity predictions ──────────────────────────────
    let propensityContext = ''
    try {
      const propensities = await getTopPropensities(build.id, supabase, 3)
      if (propensities.length > 0) {
        propensityContext = 'FOUNDER PROPENSITY (what this founder likely needs next):\n' +
          propensities.map((p) =>
            '- ' + p.prediction.replace(/_/g, ' ') +
            ' (confidence: ' + Math.round(p.score * 100) + '%) \u2192 ' +
            (p.suggested_action ?? ''),
          ).join('\n') + '\n\n'
      }
    } catch (e) {
      console.warn('[edit] propensity fetch failed (non-fatal):', e)
    }

    // ── Build topology context — page graph for structurally-informed edits ─
    let topologyContext = ''
    try {
      const topology = build.app_topology as AppTopology | null
      if (topology && topology.nodes.length > 0) {
        const pageList = topology.nodes
          .map((n) => `  ${n.name} \u2192 ${n.filePath} (route: ${n.route})`)
          .join('\n')
        const edgeList = topology.edges.length > 0
          ? topology.edges.map((e) => `  ${e.from} \u2192 ${e.to} [${e.type}]`).join('\n')
          : '  (none detected)'
        const warningsBlock = topology.warnings.length > 0
          ? `\nSTRUCTURAL WARNINGS:\n${topology.warnings.map((w) => `  \u26A0 ${w}`).join('\n')}`
          : ''
        topologyContext =
          `APP STRUCTURE (${topology.nodes.length} pages, ${topology.edges.length} navigation edges):\n` +
          `PAGES:\n${pageList}\n\n` +
          `NAVIGATION:\n${edgeList}\n${warningsBlock}\n\n`
        console.log(`[edit] topology injected: ${topology.nodes.length} pages, ${topology.edges.length} edges, ${topology.orphanPages.length} orphans`)
      }
    } catch (topoErr) {
      console.warn('[edit] topology context build failed (non-fatal):', topoErr)
    }

    // ── STEP 1: Instruction Classifier (Haiku — Prompt A) ───────────────────
    let classifierResult: ClassifierResult = {
      instruction_type: 'style_change',
      relevant_files: [],
      create_files: [],
      atomic_requirements: [editRequest],
      risk: 'medium',
      risk_reason: 'Classifier did not run.',
      validation_checks: [],
      plan_summary: 'Apply the requested change.',
    }

    try {
      const classifierPrompt = `You are Visila's pre-edit intelligence layer. You analyze a user's instruction before any code is written. You do four things at once.

${lessonsContext}${propensityContext}${visionContext}${indexContext}${topologyContext}APP CONTEXT:
- App type: ${build.app_type ?? 'web app'}
- App idea: ${build.idea ?? 'unknown'}
- File tree (src/ only):
${fileTree.join('\n')}

USER INSTRUCTION: "${editRequest}"

TASK — return a single JSON object with these exact keys:

{
  "instruction_type": one of ["style_change", "content_change", "feature_add", "new_page", "schema_change", "bug_fix", "layout_change", "multi_system"],
  "relevant_files": [],
  "create_files": [],
  "atomic_requirements": [],
  "risk": "low" | "medium" | "high",
  "risk_reason": "one sentence",
  "validation_checks": [],
  "plan_summary": "One plain-English sentence describing what will change and why."
}

relevant_files: Array of EXISTING file paths from the tree that need to be READ or EDITED. Max 6. Include the router file if instruction_type is "new_page". Include the nav component if navigation changes are needed. Be precise — wrong file selection is the #1 cause of silent failures. Use the COMPONENT INDEX above (if present) to match the user's description against component names and visible_text — this gives you exact file paths and line numbers. Every path here MUST exist in the file tree above.

create_files: Array of NEW file paths that need to be CREATED. These do NOT exist in the tree yet. Use this for new pages, new components, new utilities. Example for "add a pricing page": ["src/pages/Pricing.tsx"]. Leave empty if no new files are needed.

CRITICAL — new page detection:
If the instruction asks to add a new page or route (e.g. "add a pricing page", "create an about page"), you MUST:
- Add the new page file to create_files (e.g. "src/pages/Pricing.tsx")
- Add the router file to relevant_files (e.g. src/App.tsx or whichever exists in the tree)
- Add the nav/header component to relevant_files (e.g. src/components/Nav.tsx or src/components/Navbar.tsx — whichever exists)

atomic_requirements: Array of ALL changes required for this instruction to work end-to-end. Example for "new_page": ["create src/pages/Pricing.tsx", "add route in src/App.tsx", "add nav link in src/components/Nav.tsx"]. Every item must be actionable. Nothing vague.

validation_checks: Array of checks the execution agent should run after making changes. Specific, verifiable assertions — not generic advice. Max 4.

RULES:
- Return only valid JSON. No markdown fences. No explanation outside the object.
- If the instruction is ambiguous, set risk to "high" and explain in risk_reason.
- Never hallucinate file paths. Every path in relevant_files must exist in the tree above.
- If instruction_type is "new_page" or "multi_system", relevant_files MUST include the router file and any nav component.
- If instruction_type is "schema_change", set risk to "high" always.`

      const classifierMsg = await anthropic.messages.create({
        model: MODEL_FAST,
        max_tokens: 512,
        messages: [{ role: 'user', content: classifierPrompt }],
      })

      const classifierRaw = classifierMsg.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim()

      const parsed = JSON.parse(classifierRaw) as ClassifierResult

      const validTypes = ['style_change', 'content_change', 'feature_add', 'new_page', 'schema_change', 'bug_fix', 'layout_change', 'multi_system']
      classifierResult = {
        instruction_type: validTypes.includes(parsed.instruction_type) ? parsed.instruction_type : 'style_change',
        relevant_files: Array.isArray(parsed.relevant_files)
          ? (parsed.relevant_files as unknown[]).filter((f): f is string => typeof f === 'string' && fileTree.includes(f)).slice(0, 6)
          : [],
        create_files: Array.isArray(parsed.create_files)
          ? (parsed.create_files as unknown[]).filter((f): f is string => typeof f === 'string' && !fileTree.includes(f)).slice(0, 4)
          : [],
        atomic_requirements: Array.isArray(parsed.atomic_requirements)
          ? (parsed.atomic_requirements as unknown[]).filter((r): r is string => typeof r === 'string').slice(0, 8)
          : [editRequest],
        risk: ['low', 'medium', 'high'].includes(parsed.risk) ? parsed.risk : 'medium',
        risk_reason: typeof parsed.risk_reason === 'string' ? parsed.risk_reason : '',
        validation_checks: Array.isArray(parsed.validation_checks)
          ? (parsed.validation_checks as unknown[]).filter((c): c is string => typeof c === 'string').slice(0, 4)
          : [],
        plan_summary: typeof parsed.plan_summary === 'string' ? parsed.plan_summary : 'Apply the requested change.',
      }

      console.log(`[edit] classifier — type:${classifierResult.instruction_type} risk:${classifierResult.risk} existing:${classifierResult.relevant_files.length} create:${classifierResult.create_files.length} reqs:${classifierResult.atomic_requirements.length}`)
    } catch (classErr) {
      console.warn('[edit] classifier failed (using defaults):', classErr)
    }

    // ── Plan mode — return classifier result without executing edit ──────────
    if (req.query?.plan === 'true') {
      console.log(`[edit] plan mode — risk:${classifierResult.risk} — ${classifierResult.plan_summary}`)
      res.status(200).json({
        plan: {
          summary: classifierResult.plan_summary,
          files: [...classifierResult.relevant_files, ...classifierResult.create_files.map((f) => `[NEW] ${f}`)],
          changes: classifierResult.atomic_requirements.map((r) => {
            const fileMatch = r.match(/(?:in |update |create |add .* in )(src\/\S+)/)
            return { file: fileMatch?.[1] ?? '', what: r }
          }),
          risk: classifierResult.risk,
          risk_reason: classifierResult.risk_reason,
          instruction_type: classifierResult.instruction_type,
          validation_checks: classifierResult.validation_checks,
        },
      })
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
        // Find the default branch (Visila always creates `main`)
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

    let brainFollowup: string | null = null
    let commitSha: string | null = null
    let editConfidence: string | null = null
    let editValidationResults: Array<{ check: string; passed: boolean; note?: string }> | null = null
    let committedPaths: string[] = []

    // ════════════════════════════════════════════════════════════════════════
    // UNIFIED MULTI-FILE EDIT — single path for all instruction types
    // Step 1: Classifier already identified relevant_files + create_files
    // Step 2: Fetch content of all identified files
    // Step 3: Sonnet edits all files in one call
    // Step 4: Compare originals vs new → filter to actual changes
    // Step 5: Atomic commit via Git Trees API
    // ════════════════════════════════════════════════════════════════════════
    {
      console.log('[edit] unified path — type:', classifierResult.instruction_type, new Date().toISOString())

      // ── Image pre-fetch ────────────────────────────────────────────────────
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
            .join(' ')
          if (keywords) {
            resolvedImageUrl = await resolveHeroImage(keywords)
            if (resolvedImageUrl) console.log('[edit] resolved hero image')
          }
        } catch (e) {
          console.warn('[edit] image prefetch failed (non-fatal):', e)
        }
      }

      const imageGuidance = resolvedImageUrl
        ? `\nIMAGES: Use this exact pre-fetched image URL (permanent, responsive): ${resolvedImageUrl}\nDo NOT use any other image URL — this one is already verified to load correctly. Implement as backgroundImage on the section element, never as an img tag.`
        : `\nIMAGES: Do not add any image URLs. If a hero image is needed, use a solid background color: background-color: var(--color-ink). Never use source.unsplash.com, placeholder.com, picsum.photos, or loremflickr.com.`

      // ── Merge existing + create file lists ─────────────────────────────────
      let allTargetPaths = [
        ...classifierResult.relevant_files,
        ...classifierResult.create_files,
      ]

      // Fallback: if classifier returned no files at all, use common candidates
      if (allTargetPaths.length === 0 && fileTree.length > 0) {
        const fallbackCandidates = ['src/pages/Home.tsx', 'src/App.tsx', 'src/index.css']
        allTargetPaths = fallbackCandidates.filter((c) => fileTree.includes(c)).slice(0, 3)
        console.log('[edit] classifier returned no files, using fallbacks:', allTargetPaths.join(', '))
      }

      if (allTargetPaths.length === 0) {
        console.error('[edit] no target files identified — cannot proceed')
        await setBuildStatus('error', null, 'Could not identify which files to edit')
        res.status(500).json({ error: 'Could not determine which files to edit. Please be more specific.' })
        return
      }

      // ── Fetch content of all identified files ──────────────────────────────
      const createFileSet = new Set(classifierResult.create_files)
      const filesToEdit = await Promise.all(
        allTargetPaths.map(async (filePath) => {
          const isNew = createFileSet.has(filePath)
          if (isNew) {
            return { path: filePath, content: '', sha: null as string | null, isNew: true }
          }
          const fetched = await fetchGitHubFile(filePath)
          if (!fetched) {
            // File listed as existing but not found — treat as new
            return { path: filePath, content: '', sha: null as string | null, isNew: true }
          }
          return { path: fetched.path, content: fetched.content, sha: fetched.sha, isNew: false }
        })
      )

      console.log('[edit] files to edit:', filesToEdit.map((f) => `${f.isNew ? '[NEW] ' : ''}${f.path}`).join(', '))

      // ── Build file context for Sonnet ──────────────────────────────────────
      const fileContextBlocks = filesToEdit
        .map((f) => f.isNew
          ? `### [NEW FILE] ${f.path}\n(This file does not exist yet — create it from scratch)`
          : `### ${f.path}\n\`\`\`tsx\n${f.content}\n\`\`\``)
        .join('\n\n')

      await setBuildStatus('building', 'Generating your edit…')

      // ── Sonnet execution prompt ────────────────────────────────────────────
      const executionPrompt = `You are Visila's execution agent. You edit React + Vite + TypeScript applications with the precision of a senior engineer and the design judgment of Jony Ive: calm, precise, trustworthy, quietly powerful.

You do NOT just respond to instructions. You:
1. Execute the change completely and atomically
2. Verify your own output against a validation checklist
3. Report exactly what changed and whether it is correct

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APP CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
App idea: ${build.idea ?? 'unknown'}
App type: ${build.app_type ?? 'web app'}
Instruction type: ${classifierResult.instruction_type}
Risk level: ${classifierResult.risk}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER INSTRUCTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${editRequest}
${imageGuidance}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED ATOMIC CHANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST complete ALL of the following. Missing any one makes the edit broken:
${classifierResult.atomic_requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILES (edit existing, create new as needed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${fileContextBlocks}
${editLessonContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDATION CHECKLIST (verify before returning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After writing your edits, check each of these against your output:
${classifierResult.validation_checks.length > 0
          ? classifierResult.validation_checks.map((c, i) => `${i + 1}. ${c}`).join('\n')
          : '1. Confirm all files that need to change are included in the output.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENGINEERING RULES (non-negotiable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- COLORS: Never hardcode hex values. Always use CSS custom properties: var(--color-primary), var(--color-background), var(--color-text), etc. If a color does not have a var(), use the closest existing var().
- IMPORTS: All imports from local files require explicit .js extensions. Correct: import { Button } from './components/Button.js'. Wrong: import { Button } from './components/Button'.
- EXPORTS: Every component file must retain its default export.
- COMPLETENESS: Return the FULL file content for every file you change or create. Never return diffs, snippets, or partial files.
- ATOMICITY: If instruction_type is "new_page", you MUST return: the new page file, the updated router file (with the new import and Route), the updated nav component (with the new link). All three or none. A page without a route is unreachable.
- NEW FILES: For files marked [NEW FILE], create a complete, production-ready component. Include all necessary imports, proper TypeScript types, default export, and full Tailwind styling.
- SCOPE: Only change what is required. Do not refactor unrelated code. Do not rename variables, reorder imports, or clean up code you did not touch.
- REACT: Never use React.* namespace — use named imports: import { useState, type FormEvent } from 'react'. No @/ path aliases. React Router v6 only (useNavigate not useHistory, Routes not Switch).
- TAILWIND: Tailwind classes only — no inline styles except backgroundImage on hero sections.
- HERO IMAGES: backgroundImage inline style on section element, never an img tag.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return a single JSON object. The "files" object MUST contain an entry for EVERY file that was changed or created — including new files. The key is the file path, the value is the complete file content.

{
  "files": {
    "src/pages/Example.tsx": "// full file content here",
    "src/App.tsx": "// full file content here"
  },
  "validation_results": [
    { "check": "check description", "passed": true, "note": "optional detail" },
    { "check": "check description", "passed": false, "note": "what was wrong and how you fixed it" }
  ],
  "changes_summary": "One sentence: what changed, in which files, and why.",
  "confidence": "high" | "medium" | "low",
  "confidence_reason": "Why are you confident or uncertain? Be specific."
}

If confidence is "low", explain what you were uncertain about in confidence_reason.
The edit will still be committed — but the low confidence will be surfaced to the user.

Return only valid JSON. No markdown fences. No preamble. First character must be { and last must be }.`

      const editMsg = await anthropic.messages.create({
        model: MODEL_GENERATION,
        max_tokens: 12000,
        messages: [{ role: 'user', content: executionPrompt }],
      })

      const rawEdit = editMsg.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim()

      let editResult: {
        files?: Record<string, string>
        validation_results?: Array<{ check: string; passed: boolean; note?: string }>
        changes_summary?: string
        confidence?: string
        confidence_reason?: string
      }

      try {
        editResult = JSON.parse(rawEdit)
      } catch {
        // Try to extract JSON object from response
        const match = rawEdit.match(/\{[\s\S]*\}/)
        if (match) {
          try {
            editResult = JSON.parse(match[0])
          } catch {
            console.error('[edit] JSON parse failed, raw (first 300):', rawEdit.slice(0, 300))
            await setBuildStatus('error', null, 'Could not parse edit result')
            res.status(500).json({ error: 'Could not generate the edit. Please try again.' })
            return
          }
        } else {
          console.error('[edit] no JSON found in response, raw (first 300):', rawEdit.slice(0, 300))
          await setBuildStatus('error', null, 'Could not parse edit result')
          res.status(500).json({ error: 'Could not generate the edit. Please try again.' })
          return
        }
      }

      // Extract confidence and validation metadata
      editConfidence = editResult.confidence ?? null
      editValidationResults = Array.isArray(editResult.validation_results) ? editResult.validation_results : null
      brainFollowup = editResult.changes_summary ?? null

      if (editConfidence) {
        console.log(`[edit] confidence: ${editConfidence}${editResult.confidence_reason ? ' — ' + editResult.confidence_reason : ''}`)
      }
      if (editValidationResults) {
        const passed = editValidationResults.filter((v) => v.passed).length
        console.log(`[edit] validation: ${passed}/${editValidationResults.length} checks passed`)
      }

      // ── Zero-change detection — compare each file to original ──────────────
      const returnedFiles = editResult.files ?? {}
      const changedFiles = Object.entries(returnedFiles).filter(([path, newContent]) => {
        if (typeof newContent !== 'string' || newContent.length === 0) return false
        const original = filesToEdit.find((f) => f.path === path)
        // New file (not in originals) or content differs → changed
        return !original || original.isNew || original.content !== newContent
      })

      if (changedFiles.length === 0) {
        console.warn('[edit] zero files actually changed — Sonnet returned identical content', new Date().toISOString())
        // commitSha stays null → empty edit guard below handles the response
      } else {
        const filesToCommit = changedFiles.map(([path, content]) => ({ path, content }))
        console.log('[edit] atomic commit — files:', filesToCommit.map((f) => f.path).join(', '))
        await setBuildStatus('building', 'Pushing your change…')

        const atomicSha = await atomicCommit(filesToCommit, `edit: ${editRequest.slice(0, 60)}`)
        if (atomicSha) {
          commitSha = atomicSha
          committedPaths = filesToCommit.map((f) => f.path)
          console.log('[edit] atomic commit succeeded', commitSha.slice(0, 7), new Date().toISOString())
        } else {
          console.error('[edit] atomic commit failed')
          await setBuildStatus('error', null, 'Could not push changes to GitHub')
          res.status(500).json({ error: 'Could not save the changes. Please try again.' })
          return
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // EMPTY EDIT GUARD — never say "Done." when nothing changed
    // ════════════════════════════════════════════════════════════════════════
    if (!commitSha) {
      console.warn('[edit] no commit produced — Sonnet made no changes', new Date().toISOString())
      await setBuildStatus('complete', null)
      res.status(200).json({
        ok: false,
        message: "I couldn't find what needed changing. Could you be more specific? For example: 'change the Browse listings button to blue'",
      })
      return
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
      changed: committedPaths.length > 0,
      message: committedPaths.length > 0
        ? `Updated ${committedPaths.length} file(s): ${committedPaths.join(', ')}`
        : 'Edit deployed',
      commitSha: commitSha ?? null,
      changedFiles: committedPaths,
      deployUrl: build.deploy_url ?? null,
      ...(brainFollowup ? { brain_followup: brainFollowup } : {}),
      ...(editConfidence ? { confidence: editConfidence } : {}),
      ...(editValidationResults ? { validation_results: editValidationResults } : {}),
      instruction_type: classifierResult.instruction_type,
    })

    // ── Fire Brain Audit + Monitor async after successful edit (files changed > 0) ──
    if (commitSha) {
      const editRepoPath = String(repoUrl).replace('https://github.com/', '')
      const [editRepoOwner, editRepoName] = editRepoPath.split('/')
      const editAppUrl = process.env.VITE_APP_URL ?? 'https://visila.com'

      // Brain Audit — fire-and-forget
      fetch(`${editAppUrl}/api/brain-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildId,
          deployUrl: build.deploy_url ?? '',
          supabaseRef: build.supabase_project_ref ?? '',
          repoOwner: editRepoOwner,
          repoName: editRepoName,
        }),
      }).catch((err: unknown) => console.error('[edit] Brain audit fire-and-forget failed:', err))

      // Post-Deploy Monitor (Prompt C) — fire-and-forget
      fetch(`${editAppUrl}/api/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildId,
          editRequest,
          confidence: editConfidence,
          validationResults: editValidationResults,
          changedFiles: committedPaths,
        }),
      }).catch((err: unknown) => console.error('[edit] Monitor fire-and-forget failed:', err))

      // Brain hint — fire and forget, non-fatal
      fetch(`${editAppUrl}/api/brain-hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          build_id: buildId,
          trigger: 'post_edit',
          edit_instruction: editRequest,
          changed_files: committedPaths,
          commit_sha: commitSha,
        }),
      }).catch((err: unknown) => console.error('[brain-hint fire-and-forget]', err))

      // Brain 2.5 — Structural recommendations fire-and-forget. Reads the
      // manifest + topology persisted by run-build.ts, asks Haiku for ranked
      // gaps, persists the full report, and surfaces p0 items to the
      // BrainAlertCard via audit_log so the user sees them next poll.
      ;(async () => {
        try {
          const report = await generateRecommendations(
            build.id,
            build.app_name ?? 'this app',
            build.idea ?? '',
            build.app_category ?? 'other',
            build.app_manifest as AppManifest | null,
            build.app_topology as AppTopology | null,
          )

          if (report.recommendations.length === 0) return

          await supabase
            .from('builds')
            .update({ structural_recommendations: report })
            .eq('id', build.id)

          const p0Gaps = report.recommendations.filter((r) => r.priority === 'p0')
          if (p0Gaps.length > 0) {
            const auditEntries = p0Gaps.map((r) => ({
              build_id: build.id,
              check_name: `structural:${r.id}`,
              passed: false,
              severity: 'critical' as const,
              auto_fixed: false,
              details: {
                source: 'structural_recommendations',
                title: r.title,
                description: r.description,
                editInstruction: r.editInstruction,
                category: r.category,
                effort: r.effort,
              },
            }))
            const { error: insertErr } = await supabase.from('audit_log').insert(auditEntries)
            if (insertErr) {
              console.warn('[structural-recs] audit_log insert failed:', insertErr.message)
            }
          }
          console.log(
            '[structural-recs] persisted',
            report.recommendations.length,
            'recs,',
            p0Gaps.length,
            'p0 surfaced',
          )
        } catch (err) {
          console.error('[structural-recs fire-and-forget]', err)
        }
      })().catch((err: unknown) => console.error('[structural-recs outer]', err))

      // Deployment verification — fire and forget, non-fatal
      if (build.deploy_url) {
        fetch(`${editAppUrl}/api/verify-deployment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            build_id: buildId,
            commit_sha: commitSha,
            deploy_url: build.deploy_url,
          }),
        }).catch((err: unknown) => console.error('[verify-deployment fire-and-forget]', err))
      }

      // Re-index only the changed files — keep component index fresh
      const reindexPaths = committedPaths.filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
      if (reindexPaths.length > 0) {
        reindexFiles(build.id, reindexPaths, editRepoOwner, editRepoName, anthropic, supabase, githubToken)
          .catch((e: unknown) => console.warn('[edit] reindex failed (non-fatal):', e))
      }

      // Refresh screenshot after successful edit — fire-and-forget
      const editDeployUrl = build.deploy_url
      if (editDeployUrl) {
        captureScreenshot(
          build.id,
          editDeployUrl,
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )
          .then((url: string | null) => {
            if (url) {
              supabase.from('builds')
                .update({ screenshot_url: url })
                .eq('id', build.id)
                .then(() => console.log('[edit] screenshot refreshed'))
            }
          })
          .catch((e: unknown) => console.warn('[edit] screenshot refresh failed:', e))
      }

      // Append to Brain memory — fire-and-forget
      const editEntry = String(editRequest).slice(0, 100) +
        ' \u2192 ' + committedPaths.join(', ')
      appendLesson(editRepoOwner, editRepoName, 'edit_history', editEntry,
        process.env.SOVEREIGN_GITHUB_TOKEN ?? githubToken)
        .catch((e: unknown) => console.warn('[lessons] append failed:', e))

      // Propensity scoring — fire-and-forget
      scorePropensity({ id: build.id, app_type: build.app_type }, supabase)
        .catch((e: unknown) => console.warn('[propensity] score failed:', e))

      // Record real edit pattern — fire-and-forget
      if (build.app_type) {
        const { count: patternEditCount } = await supabase
          .from('edit_messages')
          .select('id', { count: 'exact', head: true })
          .eq('build_id', build.id)
          .eq('role', 'user')
        const editSlug = String(editRequest).slice(0, 50).toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
        recordPattern(
          build.app_type,
          'edit_' + (patternEditCount ?? 0),
          editSlug,
          supabase,
        ).catch(() => {})
      }

      // Founder pattern tracking — every 3rd edit, Haiku analyzes patterns
      try {
        const { count: editCount } = await supabase
          .from('edit_messages')
          .select('id', { count: 'exact', head: true })
          .eq('build_id', build.id)
          .eq('role', 'user')

        if (editCount && editCount > 0 && editCount % 3 === 0) {
          const { data: recentEdits } = await supabase
            .from('edit_messages')
            .select('content')
            .eq('build_id', build.id)
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(9)

          if (recentEdits && recentEdits.length > 0) {
            const patternMsg = await anthropic.messages.create({
              model: MODEL_FAST,
              max_tokens: 200,
              messages: [{
                role: 'user',
                content: 'Analyze these edit instructions from a founder ' +
                  'and describe their pattern in one sentence. ' +
                  'What do they care about most? What are they building toward?\n\n' +
                  'Edits:\n' +
                  recentEdits.map((e: { content: string }) => '- ' + e.content).join('\n') +
                  '\n\nReturn only the one-sentence pattern. No preamble.',
              }],
            })

            const pattern = patternMsg.content
              .filter((b): b is Anthropic.TextBlock => b.type === 'text')
              .map((b) => b.text)
              .join('').trim()

            if (pattern) {
              appendLesson(editRepoOwner, editRepoName, 'founder_patterns',
                'Pattern after ' + editCount + ' edits: ' + pattern,
                process.env.SOVEREIGN_GITHUB_TOKEN ?? githubToken)
                .catch(() => {})
            }
          }
        }
      } catch (e) {
        console.warn('[edit] founder pattern tracking failed (non-fatal):', e)
      }
    }

  } catch (err) {
    console.error('[edit] Error:', err, new Date().toISOString())
    try { await setBuildStatus('error', null, 'Something went wrong during the edit') } catch { /* ignore */ }
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
