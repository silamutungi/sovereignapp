// agents/build/architect-agent.js
// Takes full spec context. Produces ArchitectureSpec with 19 required file list
// and component dependencies.
// Returns: { files: string[], components: string[], api_routes: string[], database_tables: string[] }

import { AgentBase } from '../../shared/agent-base-class.js'

const REQUIRED_FILES = [
  'package.json',
  'index.html',
  'vite.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'tsconfig.json',
  'src/vite-env.d.ts',
  'src/index.css',
  'src/main.tsx',
  'src/App.tsx',
  'src/lib/supabase.ts',
  'src/types/index.ts',
  'src/pages/Home.tsx',
  'src/pages/Login.tsx',
  'src/pages/Signup.tsx',
  'src/pages/Dashboard.tsx',
  'src/components/Navbar.tsx',
  'src/components/ProtectedRoute.tsx',
  'src/components/Footer.tsx',
]

class ArchitectAgent extends AgentBase {
  constructor() {
    super({ name: 'architect-agent', phase: 'build', version: '1.0.0' })
  }

  async run(context) {
    const { spec } = context

    if (!spec) {
      throw new Error('architect-agent requires spec in context')
    }

    this.log('info', 'Analysing spec to produce ArchitectureSpec', {
      tier: spec.tier,
      app_name: spec.name,
    })

    const files = [...REQUIRED_FILES]
    const components = []
    const api_routes = []
    const database_tables = []

    // Feature-specific pages based on spec features
    const features = spec.features || []
    for (const feature of features) {
      const slug = feature.toLowerCase().replace(/\s+/g, '-')
      const pageName = feature
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join('')
      const pagePath = `src/pages/${pageName}.tsx`
      if (!files.includes(pagePath)) {
        files.push(pagePath)
        components.push(pageName)
      }
    }

    // Derive entities → database tables
    const entities = spec.entities || []
    for (const entity of entities) {
      const table = entity.toLowerCase().replace(/\s+/g, '_')
      if (!database_tables.includes(table)) {
        database_tables.push(table)
      }
    }
    // Every app gets a profiles table for auth
    if (!database_tables.includes('profiles')) {
      database_tables.unshift('profiles')
    }

    // Derive API routes from tier and entities
    if (spec.tier === 'STANDARD' || spec.tier === 'COMPLEX') {
      api_routes.push('api/health.ts')
      api_routes.push('api/auth/magic-link.ts')
      api_routes.push('api/auth/verify-token.ts')

      for (const table of database_tables) {
        if (table !== 'profiles') {
          api_routes.push(`api/${table}/list.ts`)
          api_routes.push(`api/${table}/create.ts`)
        }
      }
    }

    if (spec.tier === 'COMPLEX') {
      api_routes.push('api/webhooks/stripe.ts')
      api_routes.push('api/admin/stats.ts')
    }

    // Standard components every app includes
    const standardComponents = [
      'Navbar',
      'Footer',
      'ProtectedRoute',
    ]
    for (const c of standardComponents) {
      if (!components.includes(c)) components.push(c)
    }

    // Add .env.example and CLAUDE.md to scaffold
    if (!files.includes('.env.example')) files.push('.env.example')
    if (!files.includes('CLAUDE.md')) files.push('CLAUDE.md')
    if (!files.includes('vercel.json')) files.push('vercel.json')
    if (!files.includes('.gitignore')) files.push('.gitignore')

    const output = { files, components, api_routes, database_tables }

    this.log('info', 'ArchitectureSpec produced', {
      total_files: files.length,
      total_components: components.length,
      api_routes: api_routes.length,
      database_tables: database_tables.length,
    })

    return output
  }

  async verify(output) {
    const missing = REQUIRED_FILES.filter(f => !output.files.includes(f))
    if (missing.length > 0) {
      this.logIssue({
        severity: 'critical',
        message: `ArchitectureSpec missing required files: ${missing.join(', ')}`,
        file: 'architect-agent',
      })
      // Inject missing required files
      output.files = [...new Set([...REQUIRED_FILES, ...output.files])]
    }
    return output
  }
}

export default async function run(context) {
  return new ArchitectAgent().execute(context)
}
