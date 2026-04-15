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

    // CHECK 4 — Lucide icons used in JSX but not imported
    // Find all <IconName> or <IconName /> patterns in JSX
    // Check each against the lucide-react import line
    // Add any missing icons to the import statement
    const jsxIconRe = /<([A-Z][a-zA-Z0-9]+)[\s/>]/g
    const usedIcons = new Set<string>()
    let iconMatch
    while ((iconMatch = jsxIconRe.exec(updated)) !== null) {
      usedIcons.add(iconMatch[1])
    }

    // Get currently imported lucide icons
    const lucideImportMatch = updated.match(
      /^import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?\s*$/m
    )
    const importedIcons = new Set<string>(
      lucideImportMatch
        ? lucideImportMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
        : []
    )

    // Find icons that look like lucide icons (PascalCase, not React components
    // we know about) and are used but not imported
    // We identify lucide icons by checking against a known subset of common ones
    const KNOWN_LUCIDE_ICONS = new Set([
      'AlertTriangle', 'AlertCircle', 'ArrowLeft', 'ArrowRight', 'ArrowUp',
      'ArrowDown', 'BarChart', 'BarChart2', 'BarChart3', 'Bell', 'BookOpen',
      'Calendar', 'Camera', 'Check', 'CheckCircle', 'ChevronDown', 'ChevronLeft',
      'ChevronRight', 'ChevronUp', 'Circle', 'Clock', 'Code', 'Copy', 'CreditCard',
      'Database', 'DollarSign', 'Download', 'Edit', 'Edit2', 'Edit3', 'ExternalLink',
      'Eye', 'EyeOff', 'File', 'FileText', 'Filter', 'Flag', 'Folder', 'Globe',
      'Grid', 'Heart', 'Home', 'Image', 'Info', 'Key', 'Layout', 'Link', 'List',
      'Loader', 'Lock', 'LogIn', 'LogOut', 'Mail', 'Map', 'MapPin', 'Menu',
      'MessageCircle', 'MessageSquare', 'Minus', 'Moon', 'MoreHorizontal',
      'MoreVertical', 'Music', 'Package', 'Phone', 'Play', 'Plus', 'PlusCircle',
      'RefreshCw', 'Search', 'Send', 'Settings', 'Share', 'Share2', 'Shield',
      'ShieldCheck', 'ShoppingCart', 'Sliders', 'Star', 'Sun', 'Tag', 'Target',
      'Trash', 'Trash2', 'TrendingDown', 'TrendingUp', 'Upload', 'User', 'UserCheck',
      'UserMinus', 'UserPlus', 'Users', 'Video', 'Wallet', 'X', 'XCircle', 'Zap',
      'ZapOff', 'Activity', 'Award', 'Briefcase', 'Building', 'Car', 'Coffee',
      'Cpu', 'Feather', 'Fingerprint', 'Hash', 'Headphones', 'Layers', 'Lightbulb',
      'Monitor', 'PieChart', 'Power', 'Printer', 'Radio', 'Save', 'Scissors',
      'Smartphone', 'Speaker', 'Square', 'Terminal', 'Toggle', 'ToggleLeft',
      'ToggleRight', 'Tool', 'Truck', 'Tv', 'Umbrella', 'Watch', 'Wifi', 'Wind',
    ])

    // Collect all identifiers already imported from ANY module
    const allImportedIdentifiers = new Set<string>()
    const allImportRe = /^import\s+(?:(?:\{([^}]+)\})|(\w+)|\*\s+as\s+(\w+))\s+from/gm
    let importMatch
    while ((importMatch = allImportRe.exec(updated)) !== null) {
      // Named imports: { A, B, C }
      if (importMatch[1]) {
        importMatch[1].split(',').map(s => s.trim()).filter(Boolean)
          .forEach(s => allImportedIdentifiers.add(s.split(' as ')[0].trim()))
      }
      // Default import: import Foo from
      if (importMatch[2]) allImportedIdentifiers.add(importMatch[2])
      // Namespace import: import * as Foo from
      if (importMatch[3]) allImportedIdentifiers.add(importMatch[3])
    }

    const missingIcons = [...usedIcons].filter(
      (icon) => KNOWN_LUCIDE_ICONS.has(icon)
        && !importedIcons.has(icon)
        && !allImportedIdentifiers.has(icon)
    )

    if (missingIcons.length > 0) {
      const allIcons = [...new Set([...importedIcons, ...missingIcons])].sort()
      const newImportLine = `import { ${allIcons.join(', ')} } from 'lucide-react'\n`
      if (lucideImportMatch) {
        // Replace existing import line
        updated = updated.replace(
          /^import\s*\{[^}]+\}\s*from\s*['"]lucide-react['"];?\s*$/m,
          newImportLine
        )
      } else {
        // Add import after the last existing import line
        // Find the last import line by splitting and rebuilding
        const lines = updated.split('\n')
        let lastImportIdx = -1
        for (let i = 0; i < lines.length; i++) {
          if (/^import\s/.test(lines[i])) lastImportIdx = i
        }
        if (lastImportIdx >= 0) {
          lines.splice(lastImportIdx + 1, 0, newImportLine.trim())
          updated = lines.join('\n')
        } else {
          // No imports at all — prepend
          updated = newImportLine + updated
        }
      }
      for (const icon of missingIcons) {
        fixes.push(`Added missing lucide-react import ${icon} in ${path}`)
      }
    }

    corrected[path] = updated
  }

  return { files: corrected, fixes }
}
