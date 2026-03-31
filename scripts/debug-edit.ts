#!/usr/bin/env npx tsx
//
// scripts/debug-edit.ts
//
// Inspect what the edit engine actually did for any build.
//
// Usage:
//   npx tsx scripts/debug-edit.ts <buildId> [--last N]
//
// Fetches commits + diffs from GitHub and prints a readable report.

import * as fs from 'fs'
import * as path from 'path'

// ── Load .env / .env.local ──────────────────────────────────────────────────
for (const file of ['.env', '.env.local']) {
  try {
    const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (key && !(key in process.env)) process.env[key] = val
    }
  } catch { /* file not present */ }
}

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const buildId = args.find(a => !a.startsWith('--'))
const lastIdx = args.indexOf('--last')
const lastN = lastIdx !== -1 && args[lastIdx + 1] ? parseInt(args[lastIdx + 1], 10) : 5

if (!buildId) {
  console.error('Usage: npx tsx scripts/debug-edit.ts <buildId> [--last N]')
  console.error('Example: npx tsx scripts/debug-edit.ts 4df29bf7-7ae0-4f15-81f1-a02a5643770e --last 3')
  process.exit(1)
}

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const GITHUB_TOKEN = process.env.SOVEREIGN_GITHUB_TOKEN ?? ''

const missing: string[] = []
if (!SUPABASE_URL)  missing.push('SUPABASE_URL')
if (!SERVICE_KEY)   missing.push('SUPABASE_SERVICE_ROLE_KEY')
if (!GITHUB_TOKEN)  missing.push('SOVEREIGN_GITHUB_TOKEN')
if (missing.length > 0) {
  console.error('Missing required env vars:', missing.join(', '))
  console.error('Ensure .env or .env.local contains these values.')
  process.exit(1)
}

const SEP = '─'.repeat(50)

// ── Types ───────────────────────────────────────────────────────────────────
interface Build {
  id: string
  app_name: string
  repo_url: string | null
  deploy_url: string | null
}

interface CommitFile {
  filename: string
  additions: number
  deletions: number
  patch?: string
}

interface CommitDetail {
  sha: string
  commit: { message: string; author: { date: string } }
  files?: CommitFile[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────
async function fetchBuild(): Promise<Build> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/builds?id=eq.${buildId}&select=id,app_name,repo_url,deploy_url`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Accept: 'application/json',
      },
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`Supabase error (${res.status}):`, body)
    process.exit(1)
  }
  const rows = await res.json() as Build[]
  if (rows.length === 0) {
    console.error(`No build found with id: ${buildId}`)
    process.exit(1)
  }
  return rows[0]
}

function parseRepo(repoUrl: string): { owner: string; repo: string } {
  const match = repoUrl.replace(/\.git$/, '').match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) {
    console.error('Cannot parse repo from URL:', repoUrl)
    process.exit(1)
  }
  return { owner: match[1], repo: match[2] }
}

async function fetchCommits(owner: string, repo: string, count: number): Promise<CommitDetail[]> {
  // First get the commit list
  const listRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${count}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } },
  )
  if (!listRes.ok) {
    const body = await listRes.text().catch(() => '')
    console.error(`GitHub commits list failed (${listRes.status}):`, body.slice(0, 200))
    process.exit(1)
  }
  const commits = await listRes.json() as Array<{ sha: string; commit: { message: string; author: { date: string } } }>

  // Fetch full diff for each commit
  const detailed: CommitDetail[] = []
  for (const c of commits) {
    const detailRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${c.sha}`,
      { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } },
    )
    if (detailRes.ok) {
      detailed.push(await detailRes.json() as CommitDetail)
    } else {
      detailed.push({ ...c, files: [] })
    }
  }
  return detailed
}

function formatPatch(patch: string): string {
  return patch
    .split('\n')
    .filter(line => line.startsWith('+') || line.startsWith('-'))
    .filter(line => !line.startsWith('+++') && !line.startsWith('---'))
    .map(line => `    ${line}`)
    .join('\n')
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const build = await fetchBuild()

  if (!build.repo_url) {
    console.error('Build has no repo_url — nothing to inspect.')
    process.exit(1)
  }

  const { owner, repo } = parseRepo(build.repo_url)
  const commits = await fetchCommits(owner, repo, lastN)

  console.log('')
  console.log(SEP)
  console.log(`EDIT ENGINE DEBUG — ${build.app_name} (${build.id.slice(0, 8)})`)
  console.log(SEP)
  console.log('')

  // Print in reverse chronological order (newest first), numbered from oldest
  const reversed = [...commits].reverse()
  for (let i = 0; i < reversed.length; i++) {
    const c = reversed[i]
    const shortSha = c.sha.slice(0, 7)
    const msg = c.commit.message.split('\n')[0]
    const fileCount = c.files?.length ?? 0
    const date = new Date(c.commit.author.date).toISOString().slice(0, 16).replace('T', ' ')

    console.log(`EDIT #${i + 1} — "${msg}"`)
    console.log(`Commit: ${shortSha} — ${date} — ${fileCount} file${fileCount !== 1 ? 's' : ''} changed`)

    if (!c.files || c.files.length === 0) {
      console.log('  (no files in diff)')
    } else {
      for (const f of c.files) {
        console.log(`  ${f.filename}  (+${f.additions} -${f.deletions})`)
        if (f.patch && (f.additions > 0 || f.deletions > 0)) {
          console.log(formatPatch(f.patch))
        } else {
          console.log('    (no patch — file listed but unchanged)')
        }
      }
    }
    console.log('')
  }

  console.log(SEP)
  console.log(`DEPLOY URL: ${build.deploy_url ?? '(none)'}`)
  console.log(`REPO:       https://github.com/${owner}/${repo}`)
  console.log(SEP)
  console.log('')
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
