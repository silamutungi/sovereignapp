// src/lib/provisioner.test.ts
//
// Integration tests — each test hits a real API.
// Set credentials in .env.test before running:
//
//   GITHUB_TOKEN=ghp_...
//   VERCEL_TOKEN=...
//   SUPABASE_MANAGEMENT_KEY=sbp_...
//   RESEND_API_KEY=re_...
//   TEST_EMAIL=you@example.com
//
// Run a single test group:
//   npx vitest run --reporter=verbose provisioner

import { describe, it, expect, afterAll } from 'vitest'
import {
  provisionGitHub,
  provisionVercel,
  provisionSupabase,
  sendWelcomeEmail,
  type GitHubResult,
} from './provisioner.js'

// ─── Credentials ─────────────────────────────────────────────────────────────

const env = process.env
const GITHUB_TOKEN = env.GITHUB_TOKEN ?? ''
const VERCEL_TOKEN = env.VERCEL_TOKEN ?? ''
const SUPABASE_KEY = env.SUPABASE_MANAGEMENT_KEY ?? ''
const RESEND_KEY = env.RESEND_API_KEY ?? ''
const TEST_EMAIL = env.TEST_EMAIL ?? ''

// Unique name per run so tests don't collide
const TEST_PROJECT = `sovereign-test-${Date.now()}`

// Shared state passed between test suites
let githubResult: GitHubResult = { repoUrl: '', cloneUrl: '', success: false }

// ─── 1. provisionGitHub ───────────────────────────────────────────────────────

describe('provisionGitHub', () => {
  const skip = !GITHUB_TOKEN

  it('creates a real GitHub repo with starter template files', async () => {
    if (skip) {
      console.log('⏭  Skipped — set GITHUB_TOKEN to run')
      return
    }

    githubResult = await provisionGitHub(GITHUB_TOKEN, TEST_PROJECT, 'react-vite-ts')
    console.log('GitHub result:', githubResult)

    expect(githubResult.success).toBe(true)
    expect(githubResult.repoUrl).toMatch(/github\.com/)
    expect(githubResult.cloneUrl).toMatch(/\.git$/)
    expect(githubResult.error).toBeUndefined()
  })

  it('returns a clear error for an invalid token', async () => {
    const result = await provisionGitHub('bad-token', TEST_PROJECT + '-x', 'react-vite-ts')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
    expect(result.repoUrl).toBe('')
  })

  it('returns a clear error if the repo already exists', async () => {
    if (skip || !githubResult.success) {
      console.log('⏭  Skipped — depends on previous test')
      return
    }
    // Try to create the same repo again
    const result = await provisionGitHub(GITHUB_TOKEN, TEST_PROJECT, 'react-vite-ts')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/already exists/)
  })
})

// ─── 2. provisionVercel ───────────────────────────────────────────────────────

describe('provisionVercel', () => {
  const skip = !VERCEL_TOKEN || !githubResult.repoUrl

  it('creates a Vercel project and triggers a deployment', async () => {
    if (skip) {
      console.log('⏭  Skipped — set VERCEL_TOKEN and run provisionGitHub first')
      return
    }

    const result = await provisionVercel(VERCEL_TOKEN, TEST_PROJECT, githubResult.repoUrl)
    console.log('Vercel result:', result)

    expect(result.success).toBe(true)
    expect(result.deployUrl).toMatch(/https:\/\//)
    expect(result.projectUrl).toMatch(/https:\/\//)
    expect(result.error).toBeUndefined()
  })

  it('returns a clear error for an invalid token', async () => {
    const result = await provisionVercel('bad-token', 'test', 'https://github.com/a/b')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns a clear error for a malformed GitHub URL', async () => {
    const result = await provisionVercel(VERCEL_TOKEN, 'test', 'not-a-url')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Invalid GitHub repo URL/)
  })
})

// ─── 3. provisionSupabase ─────────────────────────────────────────────────────

describe('provisionSupabase', () => {
  const skip = !SUPABASE_KEY

  it('creates a Supabase project with users + waitlist tables', async () => {
    if (skip) {
      console.log('⏭  Skipped — set SUPABASE_MANAGEMENT_KEY to run')
      return
    }

    // This takes ~2 minutes — vitest timeout is set to 120s in vitest.config.ts
    const result = await provisionSupabase(SUPABASE_KEY, TEST_PROJECT)
    console.log('Supabase result:', result)

    expect(result.success).toBe(true)
    expect(result.supabaseUrl).toMatch(/supabase\.co/)
    expect(result.anonKey).toBeTruthy()
    expect(result.error).toBeUndefined()
  })

  it('returns a clear error for an invalid management key', async () => {
    const result = await provisionSupabase('bad-key', TEST_PROJECT + '-x')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
    expect(result.supabaseUrl).toBe('')
  })
})

// ─── 4. sendWelcomeEmail ──────────────────────────────────────────────────────

describe('sendWelcomeEmail', () => {
  const skip = !RESEND_KEY || !TEST_EMAIL

  it('sends the welcome email via Resend', async () => {
    if (skip) {
      console.log('⏭  Skipped — set RESEND_API_KEY and TEST_EMAIL to run')
      return
    }

    const result = await sendWelcomeEmail(
      RESEND_KEY,
      TEST_EMAIL,
      TEST_PROJECT,
      `https://${TEST_PROJECT}.vercel.app`,
      githubResult.repoUrl || `https://github.com/test/${TEST_PROJECT}`,
    )
    console.log('Email result:', result)

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('returns a clear error for an invalid Resend key', async () => {
    const result = await sendWelcomeEmail(
      'bad-key',
      'test@example.com',
      TEST_PROJECT,
      'https://example.vercel.app',
      'https://github.com/test/test',
    )
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

// ─── Cleanup ──────────────────────────────────────────────────────────────────
// Deletes the test GitHub repo after all tests complete.

afterAll(async () => {
  if (!GITHUB_TOKEN || !githubResult.success) return

  // Get the authenticated user's login
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  })
  const user = await userRes.json() as { login: string }

  const deleteRes = await fetch(
    `https://api.github.com/repos/${user.login}/${TEST_PROJECT}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    },
  )

  if (deleteRes.status === 204) {
    console.log(`\n🗑  Cleaned up test repo: ${user.login}/${TEST_PROJECT}`)
  } else {
    console.warn(`\n⚠  Could not delete test repo ${TEST_PROJECT} (status ${deleteRes.status})`)
    console.warn(`   Delete it manually at: ${githubResult.repoUrl}`)
  }
})
