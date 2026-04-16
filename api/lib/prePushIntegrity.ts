interface IntegrityIssue {
  file: string
  issue: string
  severity: 'error' | 'warning'
}

export function prePushIntegrity(
  files: Record<string, string>
): { passed: boolean; issues: IntegrityIssue[] } {
  const issues: IntegrityIssue[] = []

  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith('.tsx') && !path.endsWith('.ts')) continue

    // Check 1: imports reference files that exist in the file map
    const importRe = /from\s+['"](\.\.?\/[^'"]+)['"]/g
    let m
    while ((m = importRe.exec(content)) !== null) {
      const importPath = m[1]
      // Normalize — try with .tsx, .ts extensions
      const candidates = [
        importPath,
        importPath + '.tsx',
        importPath + '.ts',
        importPath + '/index.tsx',
        importPath + '/index.ts',
      ].map(p => {
        // Resolve relative to the importing file's directory
        const dir = path.split('/').slice(0, -1).join('/')
        return (dir ? dir + '/' : '') + p.replace(/^\.\//, '').replace(/^\.\.\//, '')
      })

      const srcCandidates = candidates.map(c =>
        c.startsWith('src/') ? c : 'src/' + c
      )

      const exists = [...candidates, ...srcCandidates].some(c => files[c])

      // Only flag relative imports that resolve to nothing
      if (!exists && importPath.startsWith('.')) {
        issues.push({
          file: path,
          issue: `Imports '${importPath}' which does not exist in generated files`,
          severity: 'error',
        })
      }
    }

    // Check 2: App.tsx routes reference pages that exist
    if (path === 'src/App.tsx' || path.endsWith('/App.tsx')) {
      const pageImportRe = /import\s+\w+\s+from\s+['"]\.\/pages\/(\w+)['"]/g
      while ((m = pageImportRe.exec(content)) !== null) {
        const pageName = m[1]
        const pageFile = `src/pages/${pageName}.tsx`
        if (!files[pageFile]) {
          issues.push({
            file: path,
            issue: `Imports page '${pageName}' but src/pages/${pageName}.tsx not generated`,
            severity: 'error',
          })
        }
      }
    }

    // Check 3: No supabase.from() calls without 'as any'
    const supabaseRe = /supabase\.from\(['"][^'"]+['"]\)(?!\s*as\s+any)/g
    if (supabaseRe.test(content)) {
      issues.push({
        file: path,
        issue: 'Supabase query missing "as any" cast — will cause TS2345 never-type error',
        severity: 'error',
      })
    }
  }

  const errors = issues.filter(i => i.severity === 'error')
  return { passed: errors.length === 0, issues }
}
