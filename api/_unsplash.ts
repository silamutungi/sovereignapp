// api/_unsplash.ts — Permanent Unsplash hero image search
// Shared by api/generate.ts and api/edit.ts

interface UnsplashPhoto {
  urls?: { raw?: string }
}

interface UnsplashSearchResult {
  results?: UnsplashPhoto[]
}

/**
 * Search Unsplash for a hero image matching the given prompt.
 * Returns a permanent, responsive URL with size/crop/quality params,
 * or null if no key is set or the search fails.
 */
export async function fetchUnsplashHeroImage(prompt: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null

  // Use the prompt directly — it's already been optimised by Haiku
  const query = encodeURIComponent(prompt.slice(0, 60))

  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${query}&orientation=landscape&per_page=1&order_by=relevant`,
    {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    },
  )

  if (!response.ok) return null

  const data = (await response.json()) as UnsplashSearchResult
  const photo = data?.results?.[0]

  if (!photo?.urls?.raw) return null

  // raw URL + params gives a permanent, high-quality, responsive URL
  return `${photo.urls.raw}&w=1920&h=1080&fit=crop&crop=center&q=80&auto=format`
}
