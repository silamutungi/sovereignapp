export const MANDATORY_PAGES: Record<string, string> = {
  MARKETPLACE: `MANDATORY PAGES (generate all, fully populated):
1. Home — hero, 6 featured listings with seed data, categories, how it works, trust signals
2. Browse — filterable listing grid, sort, search, results count
3. ListingDetail — photos, description, price, provider info, 3 seed reviews, CTA
4. HowItWorks — 3-step explainer for buyers and sellers
5. ForSellers — value prop, commission/pricing, sign up CTA
6. Dashboard — user listings or bookings`,

  SAAS_TOOL: `MANDATORY PAGES (generate all, fully populated):
1. Home — hero with product screenshot, 3 core features, social proof, pricing CTA
2. Features — detailed breakdown, use cases, before/after
3. Pricing — 3 tiers (Free/Pro/Team), feature comparison table, monthly/annual toggle
4. Dashboard — fully functional with seed data showing real utility
5. Settings — account, billing placeholder, team/members`,

  BOOKING_SCHEDULING: `MANDATORY PAGES (generate all, fully populated):
1. Home — hero with CTA, 3 trust signals, how it works, 3 seed testimonials
2. Services — min 4 services with name, description, duration, real price
3. Booking — date/time picker, service selector, confirmation step
4. About — team story, credentials, why us
5. Contact — address, phone, hours, contact form`,

  DIRECTORY_LISTING: `MANDATORY PAGES (generate all, fully populated):
1. Home — search bar hero, 6 featured listings, popular categories, recently added
2. Browse — full directory, filters, list/grid toggle
3. ListingProfile — full detail: contact, hours, photos, location, reviews
4. SubmitListing — provider submission form
5. CategoryPage — filtered view for a single category`,

  COMMUNITY_SOCIAL: `MANDATORY PAGES (generate all, fully populated):
1. Home/Feed — activity feed with 5 seed posts, trending topics, who to follow
2. Profile — bio, posts, followers/following counts, activity
3. Explore — trending content, categories, search members
4. Groups — group list, group detail with posts and members
5. Notifications — activity feed with seed data`,

  PORTFOLIO_SHOWCASE: `MANDATORY PAGES (generate all, fully populated):
1. Home — hero, 3 featured projects, brief about, contact CTA
2. Work — full project grid, filterable by type, thumbnail + category
3. ProjectDetail — challenge, approach, outcome, visuals
4. About — bio, skills, experience, downloadable CV link
5. Contact — form, social links, availability status`,

  INTERNAL_TOOL: `MANDATORY PAGES (generate all, fully populated):
1. Dashboard — KPIs, recent activity, quick actions, seed data
2. MainFeature — core workflow fully built with seed data
3. Reports — data tables, charts, date range filters, export
4. Team — user list, roles, invite flow
5. Settings — configuration, integrations placeholder`,

  ECOMMERCE_RETAIL: `MANDATORY PAGES (generate all, fully populated):
1. Home — hero product/campaign, 6 featured products with prices, categories, trust signals
2. Shop — full product grid, filters, sort, price range
3. ProductDetail — photos, description, price, variants, add to cart, 3 seed reviews
4. Cart — line items, quantities, subtotal, promo field, checkout CTA
5. Checkout — shipping, payment placeholder, order summary, confirmation`,

  RESTAURANT_HOSPITALITY: `MANDATORY PAGES (generate all, fully populated):
1. Home — atmosphere hero, reserve + order CTAs, hours, location, 3 featured dishes
2. Menu — Starters/Mains/Desserts/Drinks, min 16 items with real prices
3. Reserve — date/time/party size picker, special requests, confirmation
4. About — story, team, awards, philosophy
5. FindUs — address, hours, map placeholder, phone, private dining inquiry`,
}

export const MANDATORY_PAGES_ENFORCEMENT = `MANDATORY PAGES: Generate ALL pages listed for the detected category. Every page must be a real populated React component — no placeholders, no TODOs, no empty shells. Seed every page with content specific to the app idea. A missing mandatory page is a generation failure.`
