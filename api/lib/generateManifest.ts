// Static manifest extractor for generated apps.
// Pure analysis — no AI, no API calls. Runs in <50ms on a typical 19-file scaffold.
// Called from api/generate.ts to embed visila.json in every commit, and from
// api/run-build.ts to persist the same manifest to the builds table.
//
// The required-pages and required-features list is sourced from the same
// CONTRACTS map that drives the generation prompt (api/lib/completenessContract.ts)
// so generation requirements and post-generation verification can never drift.

import { CONTRACTS, normaliseCategory } from './completenessContract.js'

export interface ManifestPage {
  id: string         // kebab-case derived from file name
  name: string       // human-readable, from component name
  route: string      // extracted from router or inferred
  filePath: string   // e.g. src/pages/Dashboard.tsx
  sections: string[] // identifiable role attrs from JSX
}

export interface AppManifest {
  version: '1.0'
  generatedAt: string
  appName: string
  category: string
  pages: ManifestPage[]
  features: string[]
  completenessScore: number
  completenessGaps: string[]
}

function extractPages(files: Record<string, string>): ManifestPage[] {
  const pages: ManifestPage[] = []

  for (const [filePath, content] of Object.entries(files)) {
    if (!/^src\/pages\/[A-Z][^/]*\.tsx$/.test(filePath)) continue

    const fileName = filePath.split('/').pop()?.replace('.tsx', '') ?? ''
    const id = fileName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')

    // Route extraction: look for a path="/foo" attribute pointing at this file
    // first, then fall back to the kebab id. Generated apps put routes in
    // src/App.tsx — we don't have cross-file resolution here, so fall back to id.
    const routeMatch = content.match(/path=["']([^"'{}]+)["']/)
    const route = routeMatch?.[1] ?? `/${id}`

    const sectionMatches = content.matchAll(
      /(?:aria-label|data-section)=["']([^"'{}]{3,40})["']/g,
    )
    const sections = [...sectionMatches]
      .map((m) => m[1])
      .filter((s) => !s.includes('{'))
      .slice(0, 8)

    pages.push({ id, name: fileName, route, filePath, sections })
  }

  return pages
}

function extractFeatures(files: Record<string, string>): string[] {
  const allContent = Object.values(files).join('\n')
  const features: string[] = []

  const featureSignals: Record<string, RegExp> = {
    auth: /supabase\.auth\.|useAuth|AuthProvider|signIn|signOut/,
    crud: /supabase\.from\(|\.insert\(|\.update\(|\.delete\(/,
    payments: /stripe|loadStripe|PaymentElement|checkout\.session/i,
    email: /resend|sendEmail|nodemailer|EmailTemplate/i,
    search: /\.ilike\(|\.textSearch\(|searchQuery|SearchBar/,
    calendar: /DatePicker|CalendarView|fullcalendar|react-calendar/i,
    storage: /supabase\.storage\.|uploadFile|StorageBucket/,
    realtime: /supabase\.channel\(|\.on\('postgres_changes/,
  }

  for (const [feature, pattern] of Object.entries(featureSignals)) {
    if (pattern.test(allContent)) features.push(feature)
  }

  return features
}

function pageNameToId(name: string): string {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
}

function computeCompleteness(
  pages: ManifestPage[],
  features: string[],
  files: Record<string, string>,
  category: string,
): { score: number; gaps: string[] } {
  const key = normaliseCategory(category)
  const contract = CONTRACTS[key]

  // No contract for this category — pure universal checks only.
  if (!contract) {
    const allContent = Object.values(files).join('\n')
    const gaps: string[] = []
    let hits = 0
    let total = 0

    total++
    if (/empty[- ]?state|no\s+\w+\s+yet|nothing\s+here\s+yet/i.test(allContent)) hits++
    else gaps.push('Add empty state UI for lists with no data')

    total++
    if (/ErrorBoundary|catch\s*\(|onError|error[- ]?state/.test(allContent)) hits++
    else gaps.push('Add error boundary or error state handling')

    return { score: total === 0 ? 100 : Math.round((hits / total) * 100), gaps }
  }

  const pageIds = pages.map((p) => p.id)
  const gaps: string[] = []
  let hits = 0
  let total = 0

  for (const requiredPage of contract.pages) {
    total++
    const requiredId = pageNameToId(requiredPage.name)
    const found = pageIds.some(
      (pid) => pid.includes(requiredId) || requiredId.includes(pid),
    )
    if (found) {
      hits++
    } else {
      gaps.push(`Missing page: ${requiredPage.name} (${requiredPage.route})`)
    }
  }

  for (const requiredFeature of contract.features) {
    total++
    if (features.includes(requiredFeature.id)) {
      hits++
    } else {
      gaps.push(`Missing feature: ${requiredFeature.id}`)
    }
  }

  // Universal soft checks — empty and error states across the whole codebase
  const allContent = Object.values(files).join('\n')
  total++
  if (/empty[- ]?state|no\s+\w+\s+yet|nothing\s+here\s+yet/i.test(allContent)) {
    hits++
  } else {
    gaps.push('Add empty state UI for lists with no data')
  }

  total++
  if (/ErrorBoundary|catch\s*\(|onError|error[- ]?state/.test(allContent)) {
    hits++
  } else {
    gaps.push('Add error boundary or error state handling')
  }

  const score = total === 0 ? 100 : Math.round((hits / total) * 100)
  return { score, gaps }
}

export function generateManifest(
  appName: string,
  category: string,
  files: Record<string, string>,
): AppManifest {
  const pages = extractPages(files)
  const features = extractFeatures(files)
  const { score, gaps } = computeCompleteness(pages, features, files, category)

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    appName,
    category,
    pages,
    features,
    completenessScore: score,
    completenessGaps: gaps,
  }
}
