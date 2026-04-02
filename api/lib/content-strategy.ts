export interface ContentProfile {
  voice: string
  tone: string[]
  heroPatterns: string[]
  ctaVocabulary: string[]
  emptyStates: string[]
  onboarding: string[]
  trustSignals: string[]
  antiPatterns: string[]
}

export const CONTENT_PROFILES: Record<string, ContentProfile> = {

  SAAS_TOOL: {
    voice: 'Confident, direct, outcome-first. Speak to the result, not the feature.',
    tone: [
      'Specific over vague — name the outcome, name the number',
      'No fluff, no filler. Every word earns its place.',
      'Professional but not corporate. Human but not casual.',
    ],
    heroPatterns: [
      '[Specific outcome] in [specific timeframe]. No [specific pain].',
      'The [category] tool that actually [does the hard thing].',
      'Stop [painful thing]. Start [desirable outcome].',
      '[Number]-minute setup. [Outcome] from day one.',
    ],
    ctaVocabulary: [
      'Start free', 'See it in action', 'Get your dashboard',
      'Try it free', 'Start building', 'Get started free',
    ],
    emptyStates: [
      'No [items] yet — [specific first action to take].',
      'Your [resource] will appear here once you [trigger action].',
      'Nothing here yet. [CTA button] to add your first [item].',
    ],
    onboarding: [
      'Start with your most important [entity] — you can add more later.',
      'Connect your [integration] to unlock [specific feature].',
      'Invite your team — [tool] works best when everyone is in.',
    ],
    trustSignals: [
      'No credit card required',
      'Cancel anytime',
      'SOC 2 compliant',
      'Used by [N]+ teams',
      '99.9% uptime',
    ],
    antiPatterns: [
      'Never say "Welcome to [App]" as a hero headline',
      'Never use "Get Started" as the only CTA',
      'Never use "Our platform" — say what it actually does',
      'Never lead with features — lead with outcomes',
    ],
  },

  RESTAURANT_HOSPITALITY: {
    voice: 'Sensory, warm, evocative. Make people hungry and welcome before they arrive.',
    tone: [
      'Invoke taste, smell, and atmosphere — not just food categories',
      'Warm and personal — guests, not customers',
      'Confident about quality without being pretentious',
    ],
    heroPatterns: [
      '[Evocative ingredient or technique]. [Atmosphere cue]. [Availability or invitation].',
      'Where [local identity] meets [culinary identity].',
      '[Signature dish or ingredient], [preparation], [occasion].',
      'Handmade. Seasonal. Ready for your table tonight.',
    ],
    ctaVocabulary: [
      'Reserve a table', 'See the menu', 'Book now',
      'Plan your visit', 'Order online', 'Get directions',
    ],
    emptyStates: [
      'No reservations yet — share your booking link to fill your tables.',
      'Your menu is empty — add your first dish to get started.',
      'No orders yet today. Your online menu is live and ready.',
    ],
    onboarding: [
      'Add your signature dish first — it sets the tone for your whole menu.',
      'Upload a photo of your space — guests book with their eyes first.',
      'Set your hours so guests know when to visit.',
    ],
    trustSignals: [
      'Reservations confirmed instantly',
      'Free cancellation up to [N] hours',
      'Rated [N]★ by [N]+ guests',
      'Est. [year]',
      'Family owned',
    ],
    antiPatterns: [
      'Never use "food items" — say dishes, plates, or by name',
      'Never say "our establishment" — say restaurant, kitchen, or by name',
      'Never lead with operational details — lead with experience',
      'Never use generic stock photo language in alt text',
    ],
  },

  MARKETPLACE: {
    voice: 'Bilateral — speaks to both buyers and sellers with equal weight. Solves the cold start problem head-on.',
    tone: [
      'Energetic and opportunity-focused for sellers',
      'Trust and discovery-focused for buyers',
      'Community-forward — this is a place, not a transaction',
    ],
    heroPatterns: [
      'Find [specific thing] from [specific type of seller] near you.',
      'The marketplace for [niche]. Buy, sell, connect.',
      '[N]+ [sellers] ready to [deliver value] for you.',
      'Sell your [product/service] to [audience] who are already looking.',
    ],
    ctaVocabulary: [
      'Start browsing', 'List for free', 'Find a [seller type]',
      'Join the marketplace', 'Post your listing', 'Explore now',
    ],
    emptyStates: [
      'No listings yet — be the first seller in your area.',
      'No results for "[search]" — try a broader search or browse all categories.',
      'Your saved items will appear here.',
    ],
    onboarding: [
      'Sellers: Add your first listing in under 2 minutes.',
      'Buyers: Tell us what you\'re looking for and we\'ll notify you when it\'s listed.',
      'Complete your profile — buyers trust sellers with photos and reviews.',
    ],
    trustSignals: [
      'Verified sellers',
      'Secure payments',
      'Buyer protection on every order',
      '[N]+ transactions completed',
      'Local and nationwide',
    ],
    antiPatterns: [
      'Never write copy that only addresses one side of the marketplace',
      'Never ignore the empty marketplace problem — address it in onboarding',
      'Never use "items" generically — name the category specifically',
      'Never hide the seller onboarding — surface it equally with buyer flow',
    ],
  },

  BOOKING_SCHEDULING: {
    voice: 'Efficient and reassuring. Reduce friction and anxiety around time and commitment.',
    tone: [
      'Clear and direct — time is the product, respect it',
      'Reassuring about cancellation, confirmation, and changes',
      'Professional but approachable',
    ],
    heroPatterns: [
      'Book your [service] in under 60 seconds.',
      '[Service] on your schedule. No back-and-forth.',
      'See availability. Pick a time. Done.',
      'Your next [appointment/session/class] is one tap away.',
    ],
    ctaVocabulary: [
      'Check availability', 'Book now', 'Schedule a time',
      'Pick a slot', 'Reserve your spot', 'Book free consultation',
    ],
    emptyStates: [
      'No upcoming bookings — share your booking link to get your first.',
      'No availability set — add your working hours to start accepting bookings.',
      'No past appointments yet.',
    ],
    onboarding: [
      'Set your availability first — this is what clients see when they book.',
      'Add your services with duration and price so clients know what to expect.',
      'Share your booking link — it works immediately, no setup needed.',
    ],
    trustSignals: [
      'Instant confirmation',
      'Free cancellation up to [N] hours before',
      'Automatic reminders sent to you and your client',
      'Calendar sync included',
      '[N]+ bookings made',
    ],
    antiPatterns: [
      'Never make confirmation feel uncertain — always confirm immediately',
      'Never hide cancellation policy — surface it before booking',
      'Never use "submit" for a booking action — use "confirm" or "book"',
      'Never show a calendar without indicating which slots are actually available',
    ],
  },

  DIRECTORY_LISTING: {
    voice: 'Helpful and authoritative. The go-to reference for this category in this location or niche.',
    tone: [
      'Comprehensive but scannable — people are looking, not reading',
      'Local and specific — generic directories have no value',
      'Neutral and trustworthy — let listings speak for themselves',
    ],
    heroPatterns: [
      'Find the best [category] in [location or niche].',
      'Every [listing type] in [location]. Reviewed and verified.',
      'The [city/niche] guide to [category].',
      '[N]+ [listing types] listed. Find yours in seconds.',
    ],
    ctaVocabulary: [
      'Search listings', 'Browse all', 'Add your listing',
      'Claim your profile', 'Find near me', 'Filter by [attribute]',
    ],
    emptyStates: [
      'No listings in [category] yet — add the first one.',
      'No results for "[search]" in [location] — try expanding your search.',
      'Be the first [business type] listed here.',
    ],
    onboarding: [
      'Add your business in 2 minutes — name, category, location, contact.',
      'Claim your listing if your business is already here.',
      'Add photos and a description to stand out from other listings.',
    ],
    trustSignals: [
      'Verified listings',
      'Community reviewed',
      'Updated [frequency]',
      'Free to list',
      '[N]+ businesses listed',
    ],
    antiPatterns: [
      'Never show an empty directory without a clear CTA to add a listing',
      'Never use vague location language — be specific to city, neighborhood, or niche',
      'Never make "add a listing" harder to find than "search listings"',
      'Never show listings without at least name, category, and contact',
    ],
  },

  COMMUNITY_SOCIAL: {
    voice: 'Belonging and identity. This is a place for people like you, doing things that matter to you.',
    tone: [
      'Warm and inclusive — everyone belongs here',
      'Active and present — things are happening now',
      'Identity-affirming — members see themselves in the copy',
    ],
    heroPatterns: [
      'The community for [specific identity or interest].',
      'Find your people. Share your [passion/work/experience].',
      '[N]+ [members] already here. Join the conversation.',
      'Where [specific group] connect, share, and grow together.',
    ],
    ctaVocabulary: [
      'Join the community', 'Create your profile', 'Start a discussion',
      'See what\'s happening', 'Meet the members', 'Join free',
    ],
    emptyStates: [
      'No posts yet — start the first conversation.',
      'No members yet — invite people you know to join.',
      'Nothing here yet. Be the first to [action].',
    ],
    onboarding: [
      'Tell the community who you are — a short intro goes a long way.',
      'Follow the topics you care about to see relevant posts.',
      'Say hello in the introductions thread — members are friendly here.',
    ],
    trustSignals: [
      'Moderated community',
      'Private by default',
      '[N]+ active members',
      'Free to join',
      'No ads',
    ],
    antiPatterns: [
      'Never launch with an empty feed — seed with starter content',
      'Never use "users" — say members, people, or community',
      'Never make sign up the only way to see what\'s inside — show a preview',
      'Never ignore the lurker — not everyone posts, make reading valuable too',
    ],
  },

  PORTFOLIO_SHOWCASE: {
    voice: 'Confident and craft-forward. The work speaks. The copy frames it without overshadowing it.',
    tone: [
      'Let the work lead — copy supports, never competes',
      'Specific about process and outcomes, not just aesthetics',
      'Direct and self-assured — no hedging or apologizing',
    ],
    heroPatterns: [
      '[Name]. [Discipline]. [What makes the work distinctive].',
      '[Discipline] focused on [specific type of work or client].',
      'Selected work. [Year range]. [Location or remote].',
      '[Outcome-focused statement about what the work achieves].',
    ],
    ctaVocabulary: [
      'View my work', 'See case studies', 'Get in touch',
      'Start a project', 'Download CV', 'Book a call',
    ],
    emptyStates: [
      'No projects yet — add your best work to get started.',
      'Your portfolio is empty — add a project to make it live.',
      'No case studies yet — document your process to stand out.',
    ],
    onboarding: [
      'Add your strongest project first — it sets the tone for everything else.',
      'Write a short about section — clients hire people, not just work.',
      'Add a contact method — make it easy for clients to reach you.',
    ],
    trustSignals: [
      'Available for [project type]',
      'Based in [location] — remote friendly',
      'Previously worked with [client types]',
      '[N]+ projects completed',
      'Response within [timeframe]',
    ],
    antiPatterns: [
      'Never use "I am a passionate [discipline]" — show passion through the work',
      'Never list skills without context — show them in action in case studies',
      'Never hide contact information — make it available on every page',
      'Never use Lorem Ipsum — every portfolio needs real work or placeholder projects',
    ],
  },

  INTERNAL_TOOL: {
    voice: 'Functional and efficient. This tool exists to get work done. Copy stays out of the way.',
    tone: [
      'Terse and precise — no marketing language inside a tool people use all day',
      'Action-oriented — every label is a verb or a clear noun',
      'Consistent — same word for the same thing everywhere',
    ],
    heroPatterns: [
      '[Team name] [Tool name]. [One-line description of what it does].',
      'Internal [function] tool for [team or company name].',
      '[Action] your [resource]. Built for [team].',
    ],
    ctaVocabulary: [
      'Create new', 'Add [item]', 'Save', 'Submit',
      'Approve', 'Reject', 'Export', 'Archive',
    ],
    emptyStates: [
      'No [items] yet. [Button: Create first [item]].',
      'Nothing assigned to you. Check back later or [action].',
      'No results match your filters.',
    ],
    onboarding: [
      'You\'ve been added to [Team/Project]. Here\'s what you can do.',
      'Your first task is waiting — [link to task].',
      'Set your notification preferences so you don\'t miss updates.',
    ],
    trustSignals: [
      'Access controlled by role',
      'All actions logged',
      'Data stays in your organization',
      'SSO enabled',
    ],
    antiPatterns: [
      'Never use marketing language inside an internal tool',
      'Never make destructive actions easy to trigger — always confirm',
      'Never use ambiguous labels — "Process" means nothing, "Approve request" does',
      'Never hide audit trails or action history',
    ],
  },

  ECOMMERCE_RETAIL: {
    voice: 'Product-first, conversion-aware. Make the product irresistible and the path to purchase frictionless.',
    tone: [
      'Benefit-led — what does owning this do for the buyer',
      'Urgent but not pushy — scarcity and social proof, not manipulation',
      'Brand-consistent — voice matches the product category and price point',
    ],
    heroPatterns: [
      '[Product category] made for [specific customer or occasion].',
      'New arrivals. [Season/occasion]. Shop the collection.',
      '[Brand promise]. Free shipping over [amount].',
      '[Specific product] that [specific benefit]. Ships in [timeframe].',
    ],
    ctaVocabulary: [
      'Shop now', 'Add to cart', 'Buy now',
      'View collection', 'Shop the sale', 'Get free shipping',
    ],
    emptyStates: [
      'No products yet — add your first product to open your store.',
      'Nothing in your cart yet — [link: browse the collection].',
      'No orders yet — share your store to make your first sale.',
    ],
    onboarding: [
      'Add your first product — photo, price, and description is all you need.',
      'Set up payments to start accepting orders immediately.',
      'Add a shipping policy so customers know what to expect.',
    ],
    trustSignals: [
      'Free returns within [N] days',
      'Secure checkout',
      'Ships within [N] business days',
      '[N]+ happy customers',
      'Verified reviews',
    ],
    antiPatterns: [
      'Never show a product without a price',
      'Never hide shipping cost until checkout — kills conversion',
      'Never use "out of stock" without a back-in-stock notification option',
      'Never make the return policy hard to find',
    ],
  },

}

/**
 * Maps Haiku classification categories to content profile keys.
 * Haiku returns: saas, marketplace, social, ecommerce, tool, content, game, productivity, finance, health, other
 * Content profiles: SAAS_TOOL, MARKETPLACE, COMMUNITY_SOCIAL, ECOMMERCE_RETAIL, INTERNAL_TOOL,
 *                   RESTAURANT_HOSPITALITY, BOOKING_SCHEDULING, DIRECTORY_LISTING, PORTFOLIO_SHOWCASE
 */
const CATEGORY_MAP: Record<string, string> = {
  saas: 'SAAS_TOOL',
  marketplace: 'MARKETPLACE',
  social: 'COMMUNITY_SOCIAL',
  ecommerce: 'ECOMMERCE_RETAIL',
  tool: 'INTERNAL_TOOL',
  productivity: 'SAAS_TOOL',
  finance: 'SAAS_TOOL',
  content: 'PORTFOLIO_SHOWCASE',
  health: 'BOOKING_SCHEDULING',
  game: 'COMMUNITY_SOCIAL',
}

export function getContentProfile(category: string): ContentProfile | null {
  const key = CATEGORY_MAP[category] ?? category
  return CONTENT_PROFILES[key] ?? null
}

export function buildContentLayer(category: string, appIdea: string): string {
  const profile = getContentProfile(category)
  if (!profile) return ''

  const profileKey = CATEGORY_MAP[category] ?? category

  return `
---
## Content Strategy
Category: ${profileKey}
App idea: ${appIdea}

You are an expert content strategist for ${profileKey} apps.
Apply this content profile to every piece of copy you write.

Voice: ${profile.voice}

Tone principles:
${profile.tone.map(t => `- ${t}`).join('\n')}

Hero copy patterns (pick the most relevant, adapt to this specific app):
${profile.heroPatterns.map(p => `- ${p}`).join('\n')}

CTA vocabulary (use these words, not generic alternatives):
${profile.ctaVocabulary.map(c => `- ${c}`).join('\n')}

Empty state copy patterns:
${profile.emptyStates.map(e => `- ${e}`).join('\n')}

Onboarding copy patterns:
${profile.onboarding.map(o => `- ${o}`).join('\n')}

Trust signals to include where appropriate:
${profile.trustSignals.map(t => `- ${t}`).join('\n')}

Anti-patterns — never write these:
${profile.antiPatterns.map(a => `- ${a}`).join('\n')}

Rules:
- Every piece of copy must reflect the voice and tone above.
- Never use placeholder text like "Lorem ipsum" or "Coming soon".
- Never use generic CTAs like "Click here" or "Learn more".
- Never write copy that could belong to any app in any category.
- Adapt hero patterns to the specific app idea above — make it specific.
---
`
}
