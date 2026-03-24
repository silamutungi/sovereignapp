// company-os/knowledge/knowledge-updater.js
// Updates and retrieves the knowledge base for industries and standards.
//
// Industries live in: company-os/knowledge/industries/<industry>.json
// Standards live in:  company-os/knowledge/standards/<standard>-standards.json

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const INDUSTRIES_DIR = join(__dirname, 'industries')
const STANDARDS_DIR = join(__dirname, 'standards')

// ─── ENSURE DIRS EXIST ───────────────────────────────────────────────────────

function ensureDirs() {
  if (!existsSync(INDUSTRIES_DIR)) mkdirSync(INDUSTRIES_DIR, { recursive: true })
  if (!existsSync(STANDARDS_DIR)) mkdirSync(STANDARDS_DIR, { recursive: true })
}

// ─── INDUSTRY OPERATIONS ─────────────────────────────────────────────────────

/**
 * Update or create an industry knowledge file.
 *
 * @param {string} industry — e.g. 'saas', 'marketplace', 'fintech'
 * @param {object} content — full industry knowledge object or partial update
 * @returns {object} the saved industry object
 */
export function updateIndustry(industry, content) {
  ensureDirs()
  const file = join(INDUSTRIES_DIR, `${industry}.json`)
  let existing = {}
  if (existsSync(file)) {
    try {
      existing = JSON.parse(readFileSync(file, 'utf-8'))
    } catch {
      existing = {}
    }
  }

  const updated = {
    ...existing,
    ...content,
    industry,
    updated_at: new Date().toISOString(),
  }

  writeFileSync(file, JSON.stringify(updated, null, 2))
  return updated
}

/**
 * Get knowledge for a specific industry.
 *
 * @param {string} industry — e.g. 'saas', 'marketplace'
 * @returns {object | null}
 */
export function getIndustryKnowledge(industry) {
  ensureDirs()
  const file = join(INDUSTRIES_DIR, `${industry}.json`)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * List all available industries.
 *
 * @returns {string[]} list of industry names (without .json)
 */
export function listIndustries() {
  ensureDirs()
  return readdirSync(INDUSTRIES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
}

// ─── STANDARDS OPERATIONS ────────────────────────────────────────────────────

/**
 * Update or create a standard.
 *
 * @param {string} standard — e.g. 'security', 'accessibility'
 * @param {object} content — full standard object or partial update
 * @returns {object} the saved standard object
 */
export function updateStandard(standard, content) {
  ensureDirs()
  const file = join(STANDARDS_DIR, `${standard}-standards.json`)
  let existing = {}
  if (existsSync(file)) {
    try {
      existing = JSON.parse(readFileSync(file, 'utf-8'))
    } catch {
      existing = {}
    }
  }

  const updated = {
    ...existing,
    ...content,
    standard,
    updated_at: new Date().toISOString(),
  }

  writeFileSync(file, JSON.stringify(updated, null, 2))
  return updated
}

/**
 * Get a specific standard by name.
 *
 * @param {string} standard — e.g. 'security', 'accessibility'
 * @returns {object | null}
 */
export function getStandard(standard) {
  ensureDirs()
  const file = join(STANDARDS_DIR, `${standard}-standards.json`)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * List all available standards.
 *
 * @returns {string[]} list of standard names (without -standards.json)
 */
export function listStandards() {
  ensureDirs()
  return readdirSync(STANDARDS_DIR)
    .filter(f => f.endsWith('-standards.json'))
    .map(f => f.replace('-standards.json', ''))
}

// ─── SYNC ────────────────────────────────────────────────────────────────────

/**
 * Sync all knowledge base entries — reads every file and returns a summary.
 * Useful for verifying the knowledge base is intact.
 *
 * @returns {{ industries: object[], standards: object[], total: number }}
 */
export function syncAll() {
  ensureDirs()

  const industries = listIndustries().map(name => {
    const data = getIndustryKnowledge(name)
    return { name, loaded: data !== null, keys: data ? Object.keys(data).length : 0 }
  })

  const standards = listStandards().map(name => {
    const data = getStandard(name)
    return { name, loaded: data !== null, keys: data ? Object.keys(data).length : 0 }
  })

  return {
    industries,
    standards,
    total: industries.length + standards.length,
    synced_at: new Date().toISOString(),
  }
}
