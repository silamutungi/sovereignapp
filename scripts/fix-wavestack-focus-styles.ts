#!/usr/bin/env npx tsx
//
// scripts/fix-wavestack-focus-styles.ts
//
// One-time patch: removes invalid focusRingColor / focusRingWidth inline style
// properties from wavestack-f12f17 and pushes a fix commit via GitHub API.
//
// Run with: npx tsx scripts/fix-wavestack-focus-styles.ts

import * as fs from 'fs'
import * as path from 'path'

// ── Load .env ────────────────────────────────────────────────────────────────
for (const file of ['.env', '.env.local']) {
  try {
    const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    // file not present — skip
  }
}

const GITHUB_TOKEN = process.env.SOVEREIGN_GITHUB_TOKEN
if (!GITHUB_TOKEN) {
  console.error('SOVEREIGN_GITHUB_TOKEN is not set')
  process.exit(1)
}

const REPO = 'silamutungi/wavestack-f12f17'
const BASE = 'https://api.github.com'

const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
  'User-Agent': 'sovereign-fix-script',
}

// ── Fetch a file from GitHub, return { content, sha } ────────────────────────
async function fetchFile(filePath: string): Promise<{ content: string; sha: string }> {
  const url = `${BASE}/repos/${REPO}/contents/${filePath}`
  console.log(`Fetching ${filePath}…`)
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GET ${filePath} → ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json() as { content: string; sha: string; encoding: string }
  if (data.encoding !== 'base64') throw new Error(`Unexpected encoding: ${data.encoding}`)
  const content = Buffer.from(data.content, 'base64').toString('utf-8')
  return { content, sha: data.sha }
}

// ── Push a file back to GitHub ────────────────────────────────────────────────
async function pushFile(filePath: string, content: string, sha: string, message: string): Promise<string> {
  const url = `${BASE}/repos/${REPO}/contents/${filePath}`
  const body = JSON.stringify({
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    sha,
  })
  const res = await fetch(url, { method: 'PUT', headers, body })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`PUT ${filePath} → ${res.status}: ${errBody.slice(0, 200)}`)
  }
  const data = await res.json() as { commit: { sha: string } }
  return data.commit.sha
}

// ── Fix logic ─────────────────────────────────────────────────────────────────
// Removes focusRingColor and focusRingWidth from inline style objects.
// These are Tailwind class names, not valid CSS properties — tsc rejects them.
//
// Handles patterns like:
//   focusRingColor: 'blue-500',
//   focusRingWidth: '2',
//   focusRingOffsetColor: '#fff',
//   focusRingOffsetWidth: '2',
function fixInlineStyles(source: string, filePath: string): { fixed: string; changed: boolean } {
  const INVALID_PROPS = [
    'focusRingColor',
    'focusRingWidth',
    'focusRingOffsetColor',
    'focusRingOffsetWidth',
  ]

  let fixed = source
  let changed = false

  for (const prop of INVALID_PROPS) {
    // Match the property key + value + optional trailing comma, with surrounding whitespace
    // Covers: `focusRingColor: 'some-value',` and `focusRingColor: "some-value"`
    const re = new RegExp(
      `\\s*${prop}\\s*:\\s*(?:'[^']*'|"[^"]*"|\\d+)\\s*,?`,
      'g',
    )
    const before = fixed
    fixed = fixed.replace(re, (match) => {
      console.log(`  [${filePath}] removing: ${match.trim()}`)
      changed = true
      return ''
    })
    if (fixed !== before) changed = true
  }

  return { fixed, changed }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const FILES = [
    'src/pages/Home.tsx',
    'src/pages/Login.tsx',
  ]

  type FileRecord = { path: string; original: string; fixed: string; sha: string; changed: boolean }
  const results: FileRecord[] = []

  for (const filePath of FILES) {
    const { content, sha } = await fetchFile(filePath)
    const { fixed, changed } = fixInlineStyles(content, filePath)
    results.push({ path: filePath, original: content, fixed, sha, changed })
    if (!changed) {
      console.log(`  ${filePath}: no invalid props found`)
    }
  }

  const dirty = results.filter(r => r.changed)
  if (dirty.length === 0) {
    console.log('\nNo changes needed — all files are already clean.')
    return
  }

  // Push each changed file; use the same commit message for all
  const commitMessage = 'fix: remove invalid focusRingColor from inline styles'
  let lastSha = ''
  for (const file of dirty) {
    console.log(`\nPushing ${file.path}…`)
    lastSha = await pushFile(file.path, file.fixed, file.sha, commitMessage)
    console.log(`  Committed: ${lastSha}`)
  }

  console.log(`\nDone. Commit sha: ${lastSha}`)
}

main().catch((err) => {
  console.error('Script failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
