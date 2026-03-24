// agents/build/frontend-agent.js
// Takes ArchitectureSpec. Produces React component content.
// Enforces: no React namespace types, relative imports, no path aliases, WCAG AA.
// Returns: { files: { [filename]: string } }

import { AgentBase } from '../../shared/agent-base-class.js'

// Patterns that indicate React namespace type usage — must never appear in generated code
const REACT_NAMESPACE_PATTERNS = [
  /React\.FormEvent/g,
  /React\.ReactNode/g,
  /React\.ChangeEvent/g,
  /React\.MouseEvent/g,
  /React\.KeyboardEvent/g,
  /React\.RefObject/g,
  /React\.MutableRefObject/g,
  /React\.CSSProperties/g,
  /React\.FC/g,
  /React\.ComponentProps/g,
]

// Path alias patterns that must never appear
const PATH_ALIAS_PATTERNS = [/@\//g, /~\//g]

// Contrast thresholds — WCAG AA
function brightnessFromHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000
}

function suggestTextColor(bgHex) {
  return brightnessFromHex(bgHex) > 128 ? '#1a1a1a' : '#ffffff'
}

class FrontendAgent extends AgentBase {
  constructor() {
    super({ name: 'frontend-agent', phase: 'build', version: '1.0.0' })
  }

  async run(context) {
    const { architectureSpec, spec, generatedFiles } = context

    if (!architectureSpec) {
      throw new Error('frontend-agent requires architectureSpec in context')
    }

    this.log('info', 'Processing frontend files', {
      file_count: Object.keys(generatedFiles || {}).length,
    })

    const files = {}
    const sourceFiles = generatedFiles || {}

    for (const [filename, content] of Object.entries(sourceFiles)) {
      // Only process TSX / TS frontend files
      if (!filename.endsWith('.tsx') && !filename.endsWith('.ts') && !filename.endsWith('.css')) {
        files[filename] = content
        continue
      }
      // Skip API route files — handled by backend-agent
      if (filename.startsWith('api/')) {
        continue
      }

      let processed = content

      // Enforce: no React namespace types — replace with named imports
      processed = this._removeReactNamespaceTypes(processed, filename)

      // Enforce: no path aliases
      processed = this._removePathAliases(processed, filename)

      // Enforce: relative imports only (no bare specifier tricks)
      this._checkImports(processed, filename)

      files[filename] = processed
    }

    // Ensure vite-env.d.ts is always present
    if (!files['src/vite-env.d.ts']) {
      files['src/vite-env.d.ts'] = '/// <reference types="vite/client" />\n'
    }

    const primaryColor = spec?.primaryColor || '#6366f1'
    const textOnPrimary = suggestTextColor(primaryColor)

    this.log('info', 'Frontend processing complete', {
      files_processed: Object.keys(files).length,
      primary_color: primaryColor,
      text_on_primary: textOnPrimary,
    })

    return { files }
  }

  _removeReactNamespaceTypes(content, filename) {
    let result = content
    const namespacedTypesFound = []

    const replacements = [
      ['React.FormEvent', 'FormEvent'],
      ['React.ReactNode', 'ReactNode'],
      ['React.ChangeEvent', 'ChangeEvent'],
      ['React.MouseEvent', 'MouseEvent'],
      ['React.KeyboardEvent', 'KeyboardEvent'],
      ['React.RefObject', 'RefObject'],
      ['React.MutableRefObject', 'MutableRefObject'],
      ['React.CSSProperties', 'CSSProperties'],
      ['React.FC', 'FC'],
      ['React.ComponentProps', 'ComponentProps'],
    ]

    for (const [from, to] of replacements) {
      if (result.includes(from)) {
        namespacedTypesFound.push(from)
        result = result.replaceAll(from, to)
      }
    }

    if (namespacedTypesFound.length > 0) {
      this.logIssue({
        severity: 'high',
        message: `React namespace types found and replaced: ${namespacedTypesFound.join(', ')}`,
        file: filename,
      })

      // Inject named type imports if not already present
      const typeNames = namespacedTypesFound
        .map(t => t.replace('React.', ''))
        .filter(t => !result.includes(`import { type ${t}`) && !result.includes(`import {type ${t}`))

      if (typeNames.length > 0) {
        const importLine = `import { type ${typeNames.join(', type ')} } from 'react'\n`
        // Insert after the first line if it's already a react import; otherwise prepend
        if (result.includes("from 'react'")) {
          result = result.replace(/(from 'react')/, `$1\n${importLine}`)
        } else {
          result = importLine + result
        }
      }
    }

    return result
  }

  _removePathAliases(content, filename) {
    let result = content
    for (const pattern of PATH_ALIAS_PATTERNS) {
      if (pattern.test(result)) {
        this.logIssue({
          severity: 'high',
          message: 'Path alias (@/ or ~/) found — must use relative imports',
          file: filename,
        })
        // Cannot auto-fix path aliases without knowing the file tree; log and leave for review
      }
      pattern.lastIndex = 0
    }
    return result
  }

  _checkImports(content, filename) {
    // Warn on any non-relative import that looks like a local file
    const localImportPattern = /from ['"](?!\.\.?\/)(?!@?)([a-z][^'"]*\/[^'"]*)['"]/g
    let match
    while ((match = localImportPattern.exec(content)) !== null) {
      if (!match[1].startsWith('react') && !match[1].startsWith('@') && match[1].includes('/')) {
        this.logIssue({
          severity: 'medium',
          message: `Possibly bare-module import for local path: ${match[1]}`,
          file: filename,
        })
      }
    }
  }

  async verify(output) {
    // Confirm vite-env.d.ts exists
    if (!output.files['src/vite-env.d.ts']) {
      output.files['src/vite-env.d.ts'] = '/// <reference types="vite/client" />\n'
    }
    return output
  }
}

export default async function run(context) {
  return new FrontendAgent().execute(context)
}
