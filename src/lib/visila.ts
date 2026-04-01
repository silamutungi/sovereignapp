// src/lib/visila.ts
//
// The full provisioning sequence.
// Calls all four engine functions in order and returns a combined result.
// Both the web flow and the CLI call this.

import {
  provisionGitHub,
  provisionVercel,
  provisionSupabase,
  sendWelcomeEmail,
  type GitHubResult,
  type VercelResult,
  type SupabaseResult,
  type EmailResult,
} from './provisioner.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SovereignParams {
  // Project
  projectName: string
  template: string         // e.g. 'react-vite-ts'
  email: string            // owner's email for the welcome message

  // User tokens — all passed in, never from env
  githubToken: string
  vercelToken: string
  supabaseManagementKey: string

  // Platform key — set as env var RESEND_API_KEY on the Visila server
  resendKey: string
}

export interface SovereignResult {
  success: boolean
  github: GitHubResult
  vercel: VercelResult
  supabase: SupabaseResult
  email: EmailResult
  error?: string           // set to the first step that failed
}

// ─── runSovereign ─────────────────────────────────────────────────────────────

export async function runSovereign(params: SovereignParams): Promise<SovereignResult> {
  try {
  const {
    projectName,
    template,
    email,
    githubToken,
    vercelToken,
    supabaseManagementKey,
    resendKey,
  } = params

  const blank = (): SovereignResult => ({
    success: false,
    github:   { repoUrl: '', cloneUrl: '', success: false },
    vercel:   { deployUrl: '', projectUrl: '', success: false },
    supabase: { supabaseUrl: '', anonKey: '', success: false },
    email:    { success: false },
  })

  // Step 1 — GitHub
  const github = await provisionGitHub(githubToken, projectName, template)
  if (!github.success) {
    return { ...blank(), github, error: `GitHub: ${github.error}` }
  }

  // Step 2 — Vercel (depends on github.repoUrl)
  const vercel = await provisionVercel(vercelToken, projectName, github.repoUrl)
  if (!vercel.success) {
    return { ...blank(), github, vercel, error: `Vercel: ${vercel.error}` }
  }

  // Step 3 — Supabase (independent of Vercel, but sequential for clarity)
  const supabase = await provisionSupabase(supabaseManagementKey, projectName)
  if (!supabase.success) {
    return { ...blank(), github, vercel, supabase, error: `Supabase: ${supabase.error}` }
  }

  // Step 4 — Welcome email
  const emailResult = await sendWelcomeEmail(
    resendKey,
    email,
    projectName,
    vercel.deployUrl,
    github.repoUrl,
  )
  // Email failure is non-fatal — everything else succeeded
  if (!emailResult.success) {
    console.warn(`[visila] Welcome email failed: ${emailResult.error}`)
  }

  return {
    success: true,
    github,
    vercel,
    supabase,
    email: emailResult,
  }
  } catch (err) {
    const blank = (): SovereignResult => ({
      success: false,
      github:   { repoUrl: '', cloneUrl: '', success: false },
      vercel:   { deployUrl: '', projectUrl: '', success: false },
      supabase: { supabaseUrl: '', anonKey: '', success: false },
      email:    { success: false },
    })
    return { ...blank(), error: err instanceof Error ? err.message : 'Provisioning failed' }
  }
}
