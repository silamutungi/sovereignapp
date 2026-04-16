// Pre-commit static validator for generated files.
// Pure static analysis — no AI, no API calls, runs in <100ms.
// Called in generate.ts BEFORE the first GitHub commit.

interface ValidateResult {
  files: Record<string, string>
  fixes: string[]
}

export function validateGenerated(files: Record<string, string>): ValidateResult {
  const fixes: string[] = []
  const corrected: Record<string, string> = { ...files }

  for (const [path, content] of Object.entries(corrected)) {
    if (!path.endsWith('.tsx')) continue
    let updated = content

    // CHECK 1 — Unused lucide-react imports
    const lucideImportRe = /^(import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?\s*)$/m
    const match = updated.match(lucideImportRe)
    if (match) {
      const fullLine = match[1]
      const symbols = match[2].split(',').map((s) => s.trim()).filter(Boolean)
      const used = symbols.filter((sym) => {
        // Check for <SymbolName in JSX (covers <Icon />, <Icon>, <Icon\n)
        const jsxPattern = new RegExp(`<${sym}[\\s/>]`)
        return jsxPattern.test(updated)
      })
      const removed = symbols.filter((sym) => !used.includes(sym))
      if (removed.length > 0) {
        if (used.length === 0) {
          updated = updated.replace(fullLine, '')
        } else {
          updated = updated.replace(fullLine, `import { ${used.join(', ')} } from 'lucide-react'\n`)
        }
        for (const sym of removed) {
          fixes.push(`Removed unused import ${sym} from ${path}`)
        }
      }
    }

    // CHECK 2 — White text on white/no background buttons
    // Find elements with text-white that also have bg-white or no bg-* class
    const textWhiteRe = /className="([^"]*\btext-white\b[^"]*)"/g
    let classMatch
    while ((classMatch = textWhiteRe.exec(updated)) !== null) {
      const classes = classMatch[1]
      if (/\bbg-white\b/.test(classes)) {
        const fixed = classes.replace(/\bbg-white\b/, 'bg-gray-900')
        updated = updated.replace(classMatch[0], `className="${fixed}"`)
        fixes.push(`Fixed white-on-white button contrast in ${path}`)
      }
    }

    // CHECK 3 — Empty className strings
    const emptyClassCount = (updated.match(/\bclassName=""\s?/g) || []).length +
      (updated.match(/\bclassName=\{""\}\s?/g) || []).length
    if (emptyClassCount > 0) {
      updated = updated.replace(/\s*\bclassName=""\s?/g, ' ')
      updated = updated.replace(/\s*\bclassName=\{""\}\s?/g, ' ')
      fixes.push(`Removed empty className in ${path}`)
    }

    // CHECK 4 — Flag files with potential missing lucide imports
    // (actual fixing done by fixLucideImports in generate.ts)
    const jsxIconRe2 = /<([A-Z][a-zA-Z0-9]+)[\s/>]/g
    const allImportRe2 = /^import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/gm

    const importedFromElsewhere = new Set<string>()
    let imp
    while ((imp = allImportRe2.exec(updated)) !== null) {
      const source = imp[3]
      if (!source.includes('lucide')) {
        if (imp[1]) imp[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean).forEach(s => importedFromElsewhere.add(s))
        if (imp[2]) importedFromElsewhere.add(imp[2])
      }
    }

    const usedJsx = new Set<string>()
    let jx
    while ((jx = jsxIconRe2.exec(updated)) !== null) {
      if (!importedFromElsewhere.has(jx[1])) usedJsx.add(jx[1])
    }

    // Check if any used PascalCase names have no import at all
    const lucideLineMatch = updated.match(/^import\s*\{[^}]+\}\s*from\s*['"]lucide-react['"]/m)
    const lucideImported = new Set<string>(
      lucideLineMatch
        ? lucideLineMatch[0].match(/\{([^}]+)\}/)?.[1]
            .split(',').map(s => s.trim()).filter(Boolean) ?? []
        : []
    )

    const potentiallyMissing = [...usedJsx].filter(n =>
      /^[A-Z]/.test(n) && !lucideImported.has(n) && !importedFromElsewhere.has(n)
    )

    if (potentiallyMissing.length > 0) {
      fixes.push(`CHECK4_FLAG:${path}:${potentiallyMissing.join(',')}`)
    }

    corrected[path] = updated
  }

  return { files: corrected, fixes }
}
