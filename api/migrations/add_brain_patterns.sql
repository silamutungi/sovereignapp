-- Brain Patterns + Founder Propensity tables
-- Run in Supabase SQL Editor before deploying propensity engine

-- Aggregated patterns across all builds
CREATE TABLE IF NOT EXISTS brain_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_type text NOT NULL,
  pattern_type text NOT NULL,
  signal text NOT NULL,
  outcome text NOT NULL,
  frequency integer DEFAULT 1,
  confidence numeric DEFAULT 0.5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_patterns_app_type
  ON brain_patterns(app_type);
CREATE INDEX IF NOT EXISTS idx_brain_patterns_type
  ON brain_patterns(pattern_type);

-- Founder propensity scores per build
CREATE TABLE IF NOT EXISTS founder_propensity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id uuid REFERENCES builds(id) ON DELETE CASCADE,
  app_type text NOT NULL,
  propensity_type text NOT NULL,
  score numeric NOT NULL,
  prediction text NOT NULL,
  suggested_action text,
  surfaced boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_founder_propensity_build
  ON founder_propensity(build_id);

-- Seed initial patterns from domain knowledge
INSERT INTO brain_patterns
  (app_type, pattern_type, signal, outcome, frequency, confidence)
VALUES
  -- MARKETPLACE patterns
  ('marketplace', 'edit_sequence',
   'first_3_edits',
   'listing_card_visual_improvement', 78, 0.78),
  ('marketplace', 'missing_feature',
   'never_built_unprompted',
   'seller_onboarding_flow', 82, 0.82),
  ('marketplace', 'success_signal',
   'shared_app_within_7_days',
   '4x_more_likely_first_customer', 65, 0.71),
  ('marketplace', 'churn_signal',
   'no_edits_after_day_3',
   'founder_disengaged', 71, 0.69),

  -- BOOKING_SCHEDULING patterns
  ('booking_scheduling', 'edit_sequence',
   'first_3_edits',
   'services_page_pricing_update', 81, 0.81),
  ('booking_scheduling', 'missing_feature',
   'never_built_unprompted',
   'cancellation_policy_page', 74, 0.74),
  ('booking_scheduling', 'success_signal',
   'booking_flow_edited_twice',
   'founder_testing_with_real_customers', 68, 0.68),

  -- SAAS_TOOL patterns
  ('saas_tool', 'edit_sequence',
   'first_3_edits',
   'pricing_page_tier_adjustment', 76, 0.76),
  ('saas_tool', 'missing_feature',
   'never_built_unprompted',
   'free_trial_cta', 79, 0.79),
  ('saas_tool', 'churn_signal',
   'only_edited_landing_page',
   'never_built_actual_product', 83, 0.83),

  -- ECOMMERCE_RETAIL patterns
  ('ecommerce_retail', 'edit_sequence',
   'first_3_edits',
   'product_photo_and_description', 85, 0.85),
  ('ecommerce_retail', 'missing_feature',
   'never_built_unprompted',
   'abandoned_cart_recovery', 77, 0.77),

  -- RESTAURANT_HOSPITALITY patterns
  ('restaurant_hospitality', 'edit_sequence',
   'first_3_edits',
   'menu_items_and_prices', 89, 0.89),
  ('restaurant_hospitality', 'missing_feature',
   'never_built_unprompted',
   'private_dining_inquiry_form', 71, 0.71),

  -- COMMUNITY_SOCIAL patterns
  ('community_social', 'edit_sequence',
   'first_3_edits',
   'onboarding_flow_simplification', 73, 0.73),
  ('community_social', 'missing_feature',
   'never_built_unprompted',
   'email_notification_preferences', 69, 0.69),

  -- PORTFOLIO_SHOWCASE patterns
  ('portfolio_showcase', 'edit_sequence',
   'first_3_edits',
   'bio_and_headline_copy', 91, 0.91),
  ('portfolio_showcase', 'missing_feature',
   'never_built_unprompted',
   'testimonials_section', 76, 0.76),

  -- INTERNAL_TOOL patterns
  ('internal_tool', 'edit_sequence',
   'first_3_edits',
   'dashboard_metrics_and_data', 84, 0.84),
  ('internal_tool', 'missing_feature',
   'never_built_unprompted',
   'export_to_csv_functionality', 72, 0.72)

ON CONFLICT DO NOTHING;
