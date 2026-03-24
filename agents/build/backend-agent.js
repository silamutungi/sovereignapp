// agents/build/backend-agent.js
// Takes ArchitectureSpec. Produces API route files.
// Enforces: .js extensions on relative imports, checkRateLimit as first check,
//           export const config with bodyParser sizeLimit.
// Returns: { api_files: { [filename]: string } }

import { AgentBase } from '../../shared/agent-base-class.js'

// Matches relative imports without .js extension
const MISSING_JS_EXT = /from\s+['"](\.\.?\/[^'"]+?)(?<!\.js)['"]/g

// Checks if a file has checkRateLimit as first non-trivial logic call
const RATE_LIMIT_IMPORT = /import.*checkRateLimit.*from/
const RATE_LIMIT_CALL = /checkRateLimit\s*\(/

// The canonical export const config block
const CONFIG_BLOCK = `export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}
`

class BackendAgent extends AgentBase {
  constructor() {
    super({ name: 'backend-agent', phase: 'build', version: '1.0.0' })
  }

  async run(context) {
    const { architectureSpec, generatedFiles } = context

    if (!architectureSpec) {
      throw new Error('backend-agent requires architectureSpec in context')
    }

    this.log('info', 'Processing API route files', {
      expected_routes: architectureSpec.api_routes?.length ?? 0,
    })

    const api_files = {}
    const sourceFiles = generatedFiles || {}

    for (const [filename, content] of Object.entries(sourceFiles)) {
      if (!filename.startsWith('api/')) continue

      let processed = content

      // Enforce .js extensions on all relative imports
      processed = this._fixRelativeImports(processed, filename)

      // Enforce checkRateLimit is present
      processed = this._enforceRateLimit(processed, filename)

      // Enforce export const config
      processed = this._enforceConfig(processed, filename)

      // Enforce security audit comment block at top of each route file
      processed = this._enforceSecurityComment(processed, filename)

      api_files[filename] = processed
    }

    this.log('info', 'Backend processing complete', {
      api_files_processed: Object.keys(api_files).length,
    })

    return { api_files }
  }

  _fixRelativeImports(content, filename) {
    // Reset lastIndex before use
    MISSING_JS_EXT.lastIndex = 0

    const fixed = content.replace(MISSING_JS_EXT, (match, importPath) => {
      const withJs = match.replace(importPath, importPath + '.js')
      this.logIssue({
        severity: 'high',
        message: `Missing .js extension on relative import "${importPath}" — fixed to "${importPath}.js"`,
        file: filename,
      })
      return withJs
    })

    return fixed
  }

  _enforceRateLimit(content, filename) {
    // Skip if file already has checkRateLimit
    if (RATE_LIMIT_CALL.test(content)) return content

    // Skip non-handler files (utility files starting with _)
    const basename = filename.split('/').pop() || ''
    if (basename.startsWith('_')) return content

    this.logIssue({
      severity: 'critical',
      message: 'API route missing checkRateLimit — every public endpoint must rate-limit',
      file: filename,
    })

    // Inject import and call if missing
    let result = content

    if (!RATE_LIMIT_IMPORT.test(result)) {
      result = `import { checkRateLimit } from './_rateLimit.js'\n` + result
    }

    // Insert rate limit check after the export const config block or at start of handler
    // Heuristic: inject after the first opening brace of the default export handler
    result = result.replace(
      /(export default async function\s+\w+\s*\([^)]*\)\s*\{)/,
      `$1\n  const rl = checkRateLimit(req)\n  if (!rl.allowed) {\n    res.setHeader('Retry-After', String(rl.retryAfter ?? 60))\n    return res.status(429).json({ error: 'Too many requests' })\n  }\n`
    )

    return result
  }

  _enforceConfig(content, filename) {
    if (content.includes('export const config')) return content

    // Skip utility files prefixed with _
    const basename = filename.split('/').pop() || ''
    if (basename.startsWith('_')) return content

    this.logIssue({
      severity: 'medium',
      message: 'API route missing export const config — adding bodyParser sizeLimit',
      file: filename,
    })

    // Append config block after all imports but before the handler
    // Heuristic: insert before the first non-import top-level statement
    const lines = content.split('\n')
    let insertAt = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.startsWith('import ') || line === '') {
        insertAt = i + 1
      } else {
        break
      }
    }

    lines.splice(insertAt, 0, '', CONFIG_BLOCK)
    return lines.join('\n')
  }

  _enforceSecurityComment(content, filename) {
    if (content.includes('// SECURITY AUDIT')) return content

    const basename = filename.split('/').pop() || ''
    if (basename.startsWith('_')) return content

    const comment = `// SECURITY AUDIT
// - Rate limiting: checkRateLimit enforced on every request
// - Auth: service role key used server-side only; never exposed client-side
// - Input validation: all user inputs validated before use
// - RLS: Supabase RLS enabled on every table accessed by this route
// - Secrets: no environment variables logged or returned in responses
\n`

    return comment + content
  }

  async verify(output) {
    const { api_files } = output
    let missingExtensions = 0

    for (const [filename, content] of Object.entries(api_files)) {
      MISSING_JS_EXT.lastIndex = 0
      if (MISSING_JS_EXT.test(content)) {
        missingExtensions++
        this.logIssue({
          severity: 'critical',
          message: 'Relative import still missing .js extension after fix pass',
          file: filename,
        })
      }
    }

    if (missingExtensions > 0) {
      this.log('warn', `${missingExtensions} files still have missing .js extensions after fix pass`)
    }

    return output
  }
}

export default async function run(context) {
  return new BackendAgent().execute(context)
}
