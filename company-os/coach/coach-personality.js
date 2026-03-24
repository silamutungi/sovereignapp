// company-os/coach/coach-personality.js
// Defines the Coach's tone and enforces personality rules.

// FORBIDDEN: these phrases make recommendations feel weak and optional
const FORBIDDEN_PHRASES = [
  "i think you should",
  "maybe you could",
  " just ",
  " simply ",
  "obviously",
  "of course",
  "you might want to",
  "perhaps",
  "it might be worth",
  "you could consider",
  "feel free to",
]

export function formatRecommendation(raw) {
  return {
    title: formatTitle(raw.title || ''),
    body: formatBody(raw.body || ''),
    action: formatAction(raw.action),
  }
}

export function validateTone(text) {
  const lowerText = text.toLowerCase()
  const violations = FORBIDDEN_PHRASES.filter(phrase => lowerText.includes(phrase))
  return {
    passes: violations.length === 0,
    violations,
    fixed_text: violations.length > 0 ? applyToneFixes(text) : text,
  }
}

export function getPersonalityPrompt() {
  return `
COACH PERSONALITY RULES:
- Lead with the insight, not the caveat
- End with a specific action that takes less than 30 minutes
- Use numbers when available ("Your churn is 8%. The SaaS benchmark is 5%.")
- Pattern: "Your [metric] is X. The benchmark is Y. Here is what moves it."
- Never hedge, qualify, or soften recommendations
- Every recommendation has exactly one clear next step
- Warm but direct — not casual, not corporate
`
}

function formatTitle(title) {
  // Remove forbidden soft openers
  let t = title
  for (const phrase of FORBIDDEN_PHRASES) {
    const regex = new RegExp(phrase, 'gi')
    t = t.replace(regex, '')
  }
  // Capitalize first letter
  return t.trim().charAt(0).toUpperCase() + t.trim().slice(1)
}

function formatBody(body) {
  let b = body
  for (const phrase of FORBIDDEN_PHRASES) {
    const regex = new RegExp(phrase, 'gi')
    b = b.replace(regex, ' ')
  }
  return b.trim().replace(/\s+/g, ' ')
}

function formatAction(action) {
  if (!action) return { label: 'Take action' }
  return {
    label: action.label || 'Take action',
    url: action.url,
    command: action.command,
  }
}

function applyToneFixes(text) {
  const fixes = {
    'i think you should': 'Your next step:',
    'maybe you could': '',
    ' just ': ' ',
    ' simply ': ' ',
    'obviously': '',
    'of course': '',
    'you might want to': '',
    'perhaps': '',
    'it might be worth': '',
    'you could consider': '',
    'feel free to': '',
  }
  let result = text
  for (const [phrase, replacement] of Object.entries(fixes)) {
    const regex = new RegExp(phrase, 'gi')
    result = result.replace(regex, replacement)
  }
  return result.replace(/\s+/g, ' ').trim()
}
