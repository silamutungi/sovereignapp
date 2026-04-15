// Static manifest extractor for generated apps.
// Pure analysis — no AI, no API calls. Runs in <50ms on a typical 19-file scaffold.
// Called from api/generate.ts to embed visila.json in every commit, and from
// api/run-build.ts to persist the same manifest to the builds table.

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

interface CategoryRequirement {
  requiredPages: string[]
  requiredFeatures: string[]
}

// Keyed by both the lowercase short categories that the codebase emits today
// (saas, marketplace, ecommerce, …) and the longer canonical labels from the
// product spec (SAAS_TOOL, BOOKING_SCHEDULING, …). Whichever category the
// caller passes, lookup is via a normalised key so both forms hit the same row.
const CATEGORY_REQUIREMENTS: Record<string, CategoryRequirement> = {
  saas: {
    requiredPages: ['dashboard', 'settings', 'login'],
    requiredFeatures: ['auth', 'crud'],
  },
  saas_tool: {
    requiredPages: ['dashboard', 'settings', 'pricing', 'login'],
    requiredFeatures: ['auth', 'crud'],
  },
  marketplace: {
    requiredPages: ['home', 'listings', 'profile', 'login'],
    requiredFeatures: ['auth', 'crud', 'search'],
  },
  booking_scheduling: {
    requiredPages: ['home', 'booking', 'confirmation', 'dashboard', 'login'],
    requiredFeatures: ['auth', 'crud', 'calendar'],
  },
  ecommerce: {
    requiredPages: ['home', 'products', 'cart', 'checkout'],
    requiredFeatures: ['auth', 'payments', 'crud'],
  },
  ecommerce_retail: {
    requiredPages: ['home', 'products', 'cart', 'checkout'],
    requiredFeatures: ['auth', 'payments', 'crud'],
  },
  restaurant_hospitality: {
    requiredPages: ['home', 'menu', 'reservations', 'contact'],
    requiredFeatures: ['crud'],
  },
  directory_listing: {
    requiredPages: ['home', 'listings', 'submit', 'login'],
    requiredFeatures: ['auth', 'crud', 'search'],
  },
  social: {
    requiredPages: ['home', 'feed', 'profile', 'login'],
    requiredFeatures: ['auth', 'crud'],
  },
  community_social: {
    requiredPages: ['home', 'feed', 'profile', 'messages', 'login'],
    requiredFeatures: ['auth', 'crud'],
  },
  content: {
    requiredPages: ['home', 'about', 'contact'],
    requiredFeatures: [],
  },
  portfolio_showcase: {
    requiredPages: ['home', 'work', 'about', 'contact'],
    requiredFeatures: [],
  },
  tool: {
    requiredPages: ['home', 'login'],
    requiredFeatures: ['auth'],
  },
  internal_tool: {
    requiredPages: ['dashboard', 'settings', 'login'],
    requiredFeatures: ['auth', 'crud'],
  },
  productivity: {
    requiredPages: ['dashboard', 'settings', 'login'],
    requiredFeatures: ['auth', 'crud'],
  },
  finance: {
    requiredPages: ['dashboard', 'settings', 'login'],
    requiredFeatures: ['auth', 'crud'],
  },
  health: {
    requiredPages: ['dashboard', 'login'],
    requiredFeatures: ['auth', 'crud'],
  },
  game: {
    requiredPages: ['home', 'play'],
    requiredFeatures: [],
  },
}

const DEFAULT_REQUIREMENTS: CategoryRequirement = {
  requiredPages: ['home', 'login'],
  requiredFeatures: ['auth'],
}

function normaliseCategoryKey(category: string): string {
  return category.trim().toLowerCase().replace(/[\s-]+/g, '_')
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

function computeCompleteness(
  pages: ManifestPage[],
  features: string[],
  files: Record<string, string>,
  category: string,
): { score: number; gaps: string[] } {
  const requirements =
    CATEGORY_REQUIREMENTS[normaliseCategoryKey(category)] ?? DEFAULT_REQUIREMENTS

  const pageIds = pages.map((p) => p.id)
  const gaps: string[] = []
  let hits = 0
  let total = 0

  for (const requiredPage of requirements.requiredPages) {
    total++
    const found = pageIds.some(
      (id) => id.includes(requiredPage) || requiredPage.includes(id),
    )
    if (found) {
      hits++
    } else {
      gaps.push(`Missing page: ${requiredPage}`)
    }
  }

  for (const requiredFeature of requirements.requiredFeatures) {
    total++
    if (features.includes(requiredFeature)) {
      hits++
    } else {
      gaps.push(`Missing feature: ${requiredFeature}`)
    }
  }

  // Soft checks: scan for empty-state and error-state patterns across all files.
  // Credit when present, gap when absent — both contribute to the score.
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
