import { createClient } from '@supabase/supabase-js'

/**
 * Capture a screenshot of a deployed app via ScreenshotOne API
 * and upload it to Supabase storage.
 *
 * Never throws — returns null on any failure.
 */
export async function captureScreenshot(
  buildId: string,
  deployUrl: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string | null> {
  try {
    const apiKey = process.env.SCREENSHOT_API_KEY
    if (!apiKey) {
      console.log('[screenshot] SCREENSHOT_API_KEY not set — skipping')
      return null
    }

    const params = new URLSearchParams({
      access_key: apiKey,
      url: deployUrl,
      viewport_width: '1440',
      viewport_height: '900',
      device_scale_factor: '1',
      format: 'webp',
      image_quality: '80',
      block_ads: 'true',
      block_cookie_banners: 'true',
      block_trackers: 'true',
      delay: '2',
      timeout: '30',
      full_page: 'false',
    })

    const screenshotApiUrl = 'https://api.screenshotone.com/take?' + params.toString()

    const res = await fetch(screenshotApiUrl, {
      signal: AbortSignal.timeout(35_000),
    })

    if (!res.ok) {
      console.warn('[screenshot] API error:', res.status)
      return null
    }

    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    const supabase = createClient(supabaseUrl, serviceKey)
    const fileName = `builds/${buildId}/hero.webp`

    const { error } = await supabase.storage
      .from('screenshots')
      .upload(fileName, bytes, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (error) {
      console.warn('[screenshot] storage upload failed:', error.message)
      return null
    }

    const { data } = supabase.storage
      .from('screenshots')
      .getPublicUrl(fileName)

    console.log('[screenshot] captured:', data.publicUrl)
    return data.publicUrl
  } catch (err) {
    console.warn('[screenshot] failed (non-fatal):', err instanceof Error ? err.message : String(err))
    return null
  }
}
