// agents/verify/performance-agent.js
// Checks bundle dependencies for heavy packages, no N+1, caching headers.
// Returns: { score: number, heavy_dependencies: string[], issues: Issue[] }

import { AgentBase } from '../../shared/agent-base-class.js'

// Packages with significant bundle size impact (KB gzipped approximate)
const HEAVY_PACKAGES = [
  { name: 'moment', size: 72, alternative: 'date-fns or dayjs (2-4KB)' },
  { name: 'lodash', size: 70, alternative: 'lodash-es with tree-shaking, or native JS methods' },
  { name: 'jquery', size: 30, alternative: 'native DOM APIs' },
  { name: 'axios', size: 13, alternative: 'native fetch (0KB)' },
  { name: '@mui/material', size: 300, alternative: 'Tailwind utility classes' },
  { name: 'antd', size: 350, alternative: 'Tailwind utility classes' },
  { name: 'styled-components', size: 15, alternative: 'Tailwind CSS (already in scaffold)' },
  { name: 'emotion', size: 12, alternative: 'Tailwind CSS (already in scaffold)' },
  { name: 'chart.js', size: 60, alternative: 'recharts with tree-shaking, or @observablehq/plot' },
  { name: 'three', size: 600, alternative: 'necessary only for 3D — confirm requirement' },
  { name: 'video.js', size: 200, alternative: 'native HTML5 video element' },
  { name: 'pdf.js', size: 300, alternative: 'server-side PDF generation' },
]

// N+1 anti-patterns in generated code
const N_PLUS_ONE_PATTERNS = [
  {
    pattern: /\.map\s*\(\s*async.*await.*\.from\s*\(/ms,
    message: 'N+1 query: async map with individual Supabase queries — batch with .in() instead',
    severity: 'high',
  },
  {
    pattern: /for\s*(?:const|let).*of.*\n.*await.*supabase/m,
    message: 'N+1 query: awaiting Supabase inside a for-of loop — batch the query',
    severity: 'high',
  },
  {
    pattern: /forEach\s*\(\s*async/,
    message: 'forEach with async callback — forEach does not await promises, use for-of or Promise.all()',
    severity: 'medium',
  },
]

// Required caching headers for specific route types
const CACHING_CHECKS = [
  {
    route: 'api/health',
    expected: 'Cache-Control',
    value: 'no-store',
    message: 'Health endpoint should set Cache-Control: no-store',
  },
]

class PerformanceAgent extends AgentBase {
  constructor() {
    super({ name: 'performance-agent', phase: 'verify', version: '1.0.0' })
  }

  async run(context) {
    const { generatedFiles } = context

    if (!generatedFiles || typeof generatedFiles !== 'object') {
      throw new Error('performance-agent requires generatedFiles in context')
    }

    this.log('info', 'Running performance audit', {
      files: Object.keys(generatedFiles).length,
    })

    const issues = []
    const heavy_dependencies = []
    let score = 100

    // Check package.json for heavy dependencies
    const packageJson = generatedFiles['package.json']
    if (packageJson && typeof packageJson === 'string') {
      let pkg
      try {
        pkg = JSON.parse(packageJson)
      } catch {
        pkg = null
      }

      if (pkg) {
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        }

        for (const heavy of HEAVY_PACKAGES) {
          if (allDeps[heavy.name]) {
            heavy_dependencies.push(heavy.name)
            const issue = {
              severity: heavy.size > 100 ? 'high' : 'medium',
              message: `Heavy dependency "${heavy.name}" (~${heavy.size}KB gzipped) — consider: ${heavy.alternative}`,
              file: 'package.json',
            }
            issues.push(issue)
            this.logIssue(issue)
            score -= heavy.size > 100 ? 10 : 5
          }
        }

        // Check: engines field must be absent (breaks Vercel builds)
        if (pkg.engines) {
          issues.push({
            severity: 'critical',
            message: 'package.json has "engines" field — this breaks Vercel builds and must be removed',
            file: 'package.json',
          })
          score -= 20
        }

        // Check: vite version should be v5+
        const viteVersion = allDeps['vite']
        if (viteVersion && viteVersion.startsWith('^4')) {
          issues.push({
            severity: 'medium',
            message: 'Vite v4 detected — upgrade to vite ^5 for better build performance',
            file: 'package.json',
          })
          score -= 5
        }
      }
    }

    // N+1 query pattern checks
    for (const [filename, content] of Object.entries(generatedFiles)) {
      if (typeof content !== 'string') continue
      if (!filename.endsWith('.ts') && !filename.endsWith('.tsx')) continue

      for (const check of N_PLUS_ONE_PATTERNS) {
        if (check.pattern.test(content)) {
          const issue = {
            severity: check.severity,
            message: check.message,
            file: filename,
          }
          issues.push(issue)
          this.logIssue(issue)
          score -= check.severity === 'high' ? 10 : 5
        }
      }

      // Check: no synchronous file reads in API routes (blocks event loop)
      if (filename.startsWith('api/') && /readFileSync|writeFileSync/.test(content)) {
        const issue = {
          severity: 'medium',
          message: 'Synchronous file I/O in API route — use async fs.readFile/writeFile instead',
          file: filename,
        }
        issues.push(issue)
        this.logIssue(issue)
        score -= 5
      }
    }

    // Check vercel.json for caching headers
    const vercelJson = generatedFiles['vercel.json']
    if (vercelJson && typeof vercelJson === 'string') {
      // Static assets should have long cache TTL
      if (!vercelJson.includes('Cache-Control') && !vercelJson.includes('cache-control')) {
        issues.push({
          severity: 'low',
          message: 'vercel.json has no caching headers — add Cache-Control for static assets',
          file: 'vercel.json',
        })
        score -= 3
      }
    }

    // Check vite.config for code splitting
    const viteConfig = generatedFiles['vite.config.ts'] || generatedFiles['vite.config.js'] || ''
    if (viteConfig && !viteConfig.includes('rollupOptions') && !viteConfig.includes('manualChunks')) {
      issues.push({
        severity: 'low',
        message: 'vite.config.ts has no rollupOptions.output.manualChunks — large apps may benefit from code splitting',
        file: 'vite.config.ts',
      })
    }

    score = Math.max(0, score)

    this.log('info', 'Performance audit complete', {
      score,
      heavy_dependencies: heavy_dependencies.length,
      issues: issues.length,
    })

    return { score, heavy_dependencies, issues }
  }

  async scoreOutput(output) {
    return {
      dimension: 'performance',
      overall_score: output.score,
      heavy_dependencies: output.heavy_dependencies.length,
      issues: output.issues.length,
    }
  }
}

export default async function run(context) {
  return new PerformanceAgent().execute(context)
}
