// api/lib/images.ts — Hero image resolver
//
// Priority: Gemini → OpenAI → Unsplash → Pexels → null
// All functions return a permanent URL or null on failure.
// Gemini/OpenAI images are uploaded to Supabase Storage (hero-images bucket).
// Unsplash/Pexels return CDN URLs directly.

import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

interface UnsplashSearchResult {
  results?: Array<{ urls?: { raw?: string } }>
}

interface PexelsSearchResult {
  photos?: Array<{ src?: { original?: string } }>
}

// ── Supabase upload helper ───────────────────────────────────────────────────

async function uploadToSupabaseStorage(
  imageBuffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<string | null> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  const supabase = createClient(url, key)
  await supabase.storage.from('hero-images').upload(
    fileName, imageBuffer, { contentType, upsert: true },
  )
  const { data } = supabase.storage.from('hero-images').getPublicUrl(fileName)
  return data.publicUrl
}

// ── Path A — Gemini (AI-generated) ───────────────────────────────────────────

export async function fetchGeminiHeroImage(prompt: string): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey || !prompt) return null

  console.log('[images] trying Gemini')
  const genAI = new GoogleGenAI({ apiKey: geminiKey })
  const imgResponse = await genAI.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: '16:9', imageSize: '1K' },
    },
  })

  let b64: string | undefined
  let mimeType = 'image/png'
  for (const part of imgResponse.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      b64 = part.inlineData.data
      mimeType = part.inlineData.mimeType ?? 'image/png'
      break
    }
  }

  const finishReason = imgResponse.candidates?.[0]?.finishReason
  if (finishReason && finishReason !== 'STOP') {
    console.log('[images] Gemini safety filter:', finishReason)
  }
  if (imgResponse.promptFeedback?.blockReason) {
    console.log('[images] Gemini prompt blocked:', imgResponse.promptFeedback.blockReason)
  }

  if (!b64) {
    console.log('[images] Gemini returned no image')
    return null
  }

  const imageBuffer = Buffer.from(b64, 'base64')
  const fileName = `${randomUUID()}-hero.png`
  const publicUrl = await uploadToSupabaseStorage(imageBuffer, fileName, mimeType)
  if (publicUrl) console.log('[images] Gemini hero uploaded')
  return publicUrl
}

// ── Path B — OpenAI (AI-generated) ───────────────────────────────────────────

export async function fetchOpenAIHeroImage(prompt: string): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey || !prompt) return null

  console.log('[images] trying OpenAI')
  const oaiRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size: '1792x1024' }),
  })
  const oaiData = await oaiRes.json() as { data?: Array<{ b64_json: string }> }
  const b64 = oaiData.data?.[0]?.b64_json
  if (!b64) return null

  const imageBuffer = Buffer.from(b64, 'base64')
  const fileName = `${randomUUID()}-hero.png`
  const publicUrl = await uploadToSupabaseStorage(imageBuffer, fileName, 'image/png')
  if (publicUrl) console.log('[images] OpenAI hero uploaded')
  return publicUrl
}

// ── Path C — Unsplash Search API ───────────────────────────────────���─────────

export async function fetchUnsplashHeroImage(prompt: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null

  console.log('[images] trying Unsplash')
  const query = encodeURIComponent(prompt.slice(0, 60))
  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${query}&orientation=landscape&per_page=1&order_by=relevant`,
    { headers: { Authorization: `Client-ID ${accessKey}` } },
  )
  if (!response.ok) return null

  const data = (await response.json()) as UnsplashSearchResult
  const raw = data?.results?.[0]?.urls?.raw
  if (!raw) return null

  // raw URL + params → permanent, responsive, high-quality
  const url = `${raw}&w=1920&h=1080&fit=crop&crop=center&q=80&auto=format`
  console.log('[images] Unsplash hero resolved')
  return url
}

// ── Path D — Pexels Search API ───────────────────────────────────────────────

export async function fetchPexelsHeroImage(prompt: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  console.log('[images] trying Pexels')
  const query = encodeURIComponent(prompt.slice(0, 60))
  const response = await fetch(
    `https://api.pexels.com/v1/search?query=${query}&orientation=landscape&per_page=1`,
    { headers: { Authorization: apiKey } },
  )
  if (!response.ok) return null

  const data = (await response.json()) as PexelsSearchResult
  const original = data?.photos?.[0]?.src?.original
  if (!original) return null

  console.log('[images] Pexels hero resolved')
  return original
}

// ── Master resolver — tries each path in priority order ──────���───────────────

export async function resolveHeroImage(prompt: string): Promise<string | null> {
  try {
    return (
      (await fetchGeminiHeroImage(prompt)) ??
      (await fetchOpenAIHeroImage(prompt)) ??
      (await fetchUnsplashHeroImage(prompt)) ??
      (await fetchPexelsHeroImage(prompt)) ??
      null
    )
  } catch (e) {
    console.log('[images] resolve error:', e instanceof Error ? e.message : String(e))
    return null
  }
}
