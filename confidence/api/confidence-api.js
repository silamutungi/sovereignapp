// confidence/api/confidence-api.js
// HTTP API handler for the Confidence Engine — Vercel serverless function.
//
// Routes handled:
//   GET  /api/confidence?path=PROJECT_PATH          → full evaluation → ConfidenceReport
//   GET  /api/confidence/history?path=PROJECT_PATH  → score history array
//   POST /api/confidence/dimension                  → evaluate single dimension
//
// Rate limit: 30 requests / hour per IP.

import { process as runFullEvaluation } from '../engine/aggregator.js'
import { getHistory } from '../engine/score-history.js'
import { checkRateLimit } from '../../api/_rateLimit.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export default async function handler(req, res) {
  // ─── RATE LIMIT ──────────────────────────────────────────────────────────
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  const rl = checkRateLimit(`confidence:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 3600))
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter })
  }

  // ─── ROUTE DISPATCH ──────────────────────────────────────────────────────
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname

  try {
    // GET /api/confidence/history
    if (req.method === 'GET' && pathname.endsWith('/history')) {
      return await handleHistory(req, res, url)
    }

    // POST /api/confidence/dimension
    if (req.method === 'POST' && pathname.endsWith('/dimension')) {
      return await handleDimension(req, res)
    }

    // GET /api/confidence
    if (req.method === 'GET') {
      return await handleFullEvaluation(req, res, url)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[confidence-api] error:', err.constructor?.name, err.message)
    return res.status(500).json({
      error: 'Evaluation failed',
      message: err.message,
    })
  }
}

// ─── HANDLERS ────────────────────────────────────────────────────────────────

async function handleFullEvaluation(req, res, url) {
  const projectPath = url.searchParams.get('path')
  if (!projectPath) {
    return res.status(400).json({ error: 'Missing required query param: path' })
  }

  const report = await runFullEvaluation(projectPath)

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(report)
}

async function handleHistory(req, res, url) {
  const projectPath = url.searchParams.get('path')
  if (!projectPath) {
    return res.status(400).json({ error: 'Missing required query param: path' })
  }

  const history = getHistory(projectPath)

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ path: projectPath, history })
}

async function handleDimension(req, res) {
  // Parse body manually (bodyParser: false)
  const body = await readBody(req)
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const { path: projectPath, dimension } = parsed

  if (!projectPath) {
    return res.status(400).json({ error: 'Missing required field: path' })
  }
  if (!dimension) {
    return res.status(400).json({ error: 'Missing required field: dimension' })
  }

  const validDimensions = [
    'security', 'code-quality', 'performance', 'accessibility',
    'ux', 'architecture', 'test-coverage', 'seo', 'documentation', 'i18n',
  ]

  if (!validDimensions.includes(dimension)) {
    return res.status(400).json({
      error: `Invalid dimension. Must be one of: ${validDimensions.join(', ')}`,
    })
  }

  // Dynamically load and run just the requested evaluator
  let result
  try {
    const mod = await import(`../engine/evaluators/${dimension}-evaluator.js`)
    result = mod.evaluate(projectPath)
  } catch (err) {
    return res.status(500).json({
      error: `Evaluator for dimension "${dimension}" not available`,
      message: err.message,
    })
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(result)
}

// ─── UTILITY ─────────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}
