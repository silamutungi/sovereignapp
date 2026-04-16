import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function fixLucideImports(
  files: Record<string, string>,
  fixes: string[]
): Promise<{ files: Record<string, string>; fixCount: number }> {
  const flagged = fixes
    .filter(f => f.startsWith('CHECK4_FLAG:'))
    .map(f => {
      const parts = f.split(':')
      return { path: parts[1], icons: parts[2].split(',') }
    })

  if (flagged.length === 0) return { files, fixCount: 0 }

  const corrected = { ...files }
  let fixCount = 0

  for (const { path, icons } of flagged) {
    const content = corrected[path]
    if (!content) continue

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Fix this TypeScript React file by adding missing lucide-react imports.

The following names are used as JSX components but may not be imported: ${icons.join(', ')}

Rules:
1. Check if each name is actually used as a JSX element (<Name> or <Name />)
2. Check if it's already imported from anywhere
3. Only add to lucide-react import if it's genuinely missing AND is a real lucide icon
4. If a lucide-react import line already exists, add to it. If not, add after the last import line.
5. Do not change anything else in the file
6. Return ONLY the complete fixed file content, no explanation

FILE PATH: ${path}

FILE CONTENT:
${content}`
        }]
      })

      const fixed = response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : null

      if (fixed && fixed.length > content.length * 0.8) {
        corrected[path] = fixed
        fixCount++
        console.log('[fixLucideImports] fixed:', path, 'icons:', icons.join(', '))
      }
    } catch (err) {
      console.warn('[fixLucideImports] failed for', path, err instanceof Error ? err.message : err)
    }
  }

  return { files: corrected, fixCount }
}
