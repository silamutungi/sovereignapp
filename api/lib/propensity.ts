// api/lib/propensity.ts — Brain Propensity Engine
//
// Cross-app intelligence: learns from every founder interaction
// and predicts what each new founder needs before they ask.
//
// Three entry points:
//   scorePropensity()      — score patterns after each edit
//   getTopPropensities()   — fetch unsurfaced predictions for a build
//   recordPattern()        — record real founder behaviour to strengthen patterns
//
// Never throws — errors are caught and logged.

import type { SupabaseClient } from '@supabase/supabase-js'

interface BuildContext {
  id: string
  app_type: string | null
}

interface BrainPattern {
  id: string
  app_type: string
  pattern_type: string
  signal: string
  outcome: string
  frequency: number
  confidence: number
}

interface PropensityRow {
  id: string
  build_id: string
  app_type: string
  propensity_type: string
  score: number
  prediction: string
  suggested_action: string | null
  surfaced: boolean
  created_at: string
}

// ── Action mapping — maps pattern outcomes to ready-to-use edit prompts ──────

const ACTION_MAP: Record<string, string> = {
  seller_onboarding_flow: 'Add a "Become a seller" page with 3-step onboarding',
  cancellation_policy_page: 'Add a cancellation policy section to the booking page',
  free_trial_cta: 'Add a "Start free trial" CTA to the pricing page',
  testimonials_section: 'Add 3 testimonials to the home page',
  abandoned_cart_recovery: 'Add an abandoned cart reminder banner for returning visitors',
  private_dining_inquiry_form: 'Add a private dining inquiry form to the contact page',
  email_notification_preferences: 'Add an email notification preferences section to settings',
  export_to_csv_functionality: 'Add an "Export to CSV" button to the dashboard data table',
  listing_card_visual_improvement: 'Improve the listing cards with better images and hover effects',
  services_page_pricing_update: 'Update the services page with clear pricing tiers',
  pricing_page_tier_adjustment: 'Refine the pricing page with a comparison table and highlighted recommended tier',
  product_photo_and_description: 'Improve product cards with larger photos and detailed descriptions',
  menu_items_and_prices: 'Update the menu with photos, descriptions, and clear pricing',
  onboarding_flow_simplification: 'Simplify the onboarding to 2 steps max with progress indicator',
  bio_and_headline_copy: 'Sharpen the bio headline and add a one-sentence value proposition',
  dashboard_metrics_and_data: 'Add key metrics cards to the dashboard with real data visualisation',
}

function generateAction(pattern: BrainPattern): string {
  return ACTION_MAP[pattern.outcome] ??
    pattern.outcome.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

// ── scorePropensity — called after every edit ───────────────────────────────

export async function scorePropensity(
  build: BuildContext,
  supabase: SupabaseClient,
): Promise<void> {
  try {
    if (!build.app_type) {
      console.log('[propensity] no app_type — skipping')
      return
    }

    // 1. Fetch relevant patterns for this app_type
    const { data: patterns } = await supabase
      .from('brain_patterns')
      .select('*')
      .eq('app_type', build.app_type)
      .order('confidence', { ascending: false })
      .limit(10)

    if (!patterns || patterns.length === 0) {
      console.log('[propensity] no patterns for', build.app_type)
      return
    }

    // 2. Fetch this founder's edit history
    const { data: edits } = await supabase
      .from('edit_messages')
      .select('content, created_at')
      .eq('build_id', build.id)
      .eq('role', 'user')
      .order('created_at', { ascending: true })

    const editCount = edits?.length ?? 0
    const editTexts = (edits ?? []).map((e: { content: string }) =>
      e.content.toLowerCase()).join(' ')
    const lastEditTime = edits && edits.length > 0
      ? new Date(edits[edits.length - 1].created_at).getTime()
      : 0
    const hoursSinceLastEdit = lastEditTime > 0
      ? (Date.now() - lastEditTime) / (1000 * 60 * 60)
      : 999

    // 3. Score each pattern
    let scored = 0
    for (const pattern of patterns as BrainPattern[]) {
      let score = 0

      if (pattern.pattern_type === 'missing_feature') {
        // Check if any edit mentions the feature keyword
        const keywords = pattern.outcome.replace(/_/g, ' ').split(' ')
        const mentioned = keywords.some((kw) => editTexts.includes(kw))
        if (!mentioned) {
          score = pattern.confidence
        }
      } else if (pattern.pattern_type === 'edit_sequence') {
        if (editCount <= 3) {
          score = pattern.confidence
        }
      } else if (pattern.pattern_type === 'churn_signal') {
        if (hoursSinceLastEdit > 48) {
          score = pattern.confidence
        }
      } else if (pattern.pattern_type === 'success_signal') {
        // Success signals score when conditions are met
        if (editCount >= 2) {
          score = pattern.confidence * 0.5
        }
      }

      // 4. Upsert scores above threshold
      if (score >= 0.65) {
        const { error } = await supabase
          .from('founder_propensity')
          .upsert({
            build_id: build.id,
            app_type: build.app_type,
            propensity_type: pattern.pattern_type + ':' + pattern.outcome,
            score,
            prediction: pattern.outcome,
            suggested_action: generateAction(pattern),
            surfaced: false,
          }, { onConflict: 'build_id,propensity_type' })

        if (!error) scored++
      }
    }

    console.log(`[propensity] scored ${scored} patterns for ${build.id}`)
  } catch (err) {
    console.warn('[propensity] scorePropensity failed (non-fatal):',
      err instanceof Error ? err.message : String(err))
  }
}

// ── getTopPropensities — fetch unsurfaced predictions ───────────────────────

export async function getTopPropensities(
  buildId: string,
  supabase: SupabaseClient,
  limit = 3,
): Promise<PropensityRow[]> {
  try {
    const { data } = await supabase
      .from('founder_propensity')
      .select('*')
      .eq('build_id', buildId)
      .eq('surfaced', false)
      .order('score', { ascending: false })
      .limit(limit)

    return (data ?? []) as PropensityRow[]
  } catch (err) {
    console.warn('[propensity] getTopPropensities failed (non-fatal):',
      err instanceof Error ? err.message : String(err))
    return []
  }
}

// ── recordPattern — record real founder behaviour ───────────────────────────

export async function recordPattern(
  appType: string,
  signal: string,
  outcome: string,
  supabase: SupabaseClient,
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('brain_patterns')
      .select('*')
      .eq('app_type', appType)
      .eq('signal', signal)
      .eq('outcome', outcome)
      .single()

    if (existing) {
      const ex = existing as BrainPattern
      const newFrequency = ex.frequency + 1
      const newConfidence = Math.min(0.95,
        ex.confidence + (1 - ex.confidence) * 0.05)

      await supabase
        .from('brain_patterns')
        .update({
          frequency: newFrequency,
          confidence: newConfidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ex.id)
    } else {
      await supabase
        .from('brain_patterns')
        .insert({
          app_type: appType,
          pattern_type: 'observed',
          signal,
          outcome,
          frequency: 1,
          confidence: 0.5,
        })
    }
  } catch (err) {
    console.warn('[propensity] recordPattern failed (non-fatal):',
      err instanceof Error ? err.message : String(err))
  }
}
