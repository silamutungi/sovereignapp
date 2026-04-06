// api/lib/designVocabulary.ts
// Design intelligence layer for Visila Brain 2.0
// Taxonomy inspired by ui-ux-pro-max-skill (MIT licensed, github.com/nextlevelbuilder/ui-ux-pro-max-skill)

export interface DesignProfile {
  style: string;
  colorMood: string;
  primaryHex: string;
  fontPairing: string;
  layoutPattern: string;
  antiPatterns: string[];
  keyEffects: string;
}

export const DESIGN_VOCABULARY: Record<string, DesignProfile> = {
  saas: {
    style: "Glassmorphism",
    colorMood: "Cool blues, dark backgrounds, subtle gradients",
    primaryHex: "#6366F1",
    fontPairing: "Inter / Inter",
    layoutPattern: "Feature-Rich Showcase",
    antiPatterns: ["Comic Sans", "Neon gradients", "Overcrowded hero"],
    keyEffects: "Smooth transitions 200ms, card hover lift, focus rings",
  },
  fintech: {
    style: "Minimalism & Swiss Style",
    colorMood: "Deep navy, forest green, white space",
    primaryHex: "#0F4C81",
    fontPairing: "Inter / Inter",
    layoutPattern: "Trust & Authority",
    antiPatterns: ["Bright neon", "Playful illustrations", "AI purple/pink gradients"],
    keyEffects: "Subtle shadows, no animations on data tables, clear focus states",
  },
  healthcare: {
    style: "Accessible & Ethical",
    colorMood: "Clinical whites, calming blues, soft greens",
    primaryHex: "#0EA5E9",
    fontPairing: "Nunito / Nunito",
    layoutPattern: "Trust & Authority",
    antiPatterns: ["Dark mode", "Aggressive CTAs", "Decorative fonts"],
    keyEffects: "No motion by default, high contrast, large touch targets",
  },
  ecommerce: {
    style: "Vibrant & Block-based",
    colorMood: "Brand-forward, high contrast, warm accents",
    primaryHex: "#F97316",
    fontPairing: "Poppins / Inter",
    layoutPattern: "Social Proof-Focused",
    antiPatterns: ["Too many fonts", "Low contrast product images", "No mobile optimization"],
    keyEffects: "Quick add animations, image zoom, cart bounce",
  },
  marketplace: {
    style: "Flat Design",
    colorMood: "Clean whites, neutral grays, accent brand color",
    primaryHex: "#3B82F6",
    fontPairing: "Inter / Inter",
    layoutPattern: "Conversion-Optimized",
    antiPatterns: ["Visual clutter", "Inconsistent card sizes", "Hidden filters"],
    keyEffects: "Skeleton loading, hover state on cards, filter transitions",
  },
  beauty_spa: {
    style: "Soft UI Evolution",
    colorMood: "Soft pinks, sage green, gold accents, warm whites",
    primaryHex: "#E8B4B8",
    fontPairing: "Cormorant Garamond / Montserrat",
    layoutPattern: "Hero-Centric + Social Proof",
    antiPatterns: ["Bright neon", "Harsh animations", "Dark mode", "AI purple/pink gradients"],
    keyEffects: "Soft shadows, smooth transitions 200-300ms, gentle hover states",
  },
  restaurant: {
    style: "Skeuomorphism",
    colorMood: "Warm earth tones, deep reds, cream backgrounds",
    primaryHex: "#B45309",
    fontPairing: "Playfair Display / Lato",
    layoutPattern: "Hero-Centric Design",
    antiPatterns: ["Cold color palettes", "Tiny food images", "No mobile menu"],
    keyEffects: "Parallax hero, image fade-in, smooth scroll",
  },
  portfolio: {
    style: "Minimalism & Swiss Style",
    colorMood: "Monochrome base with single accent",
    primaryHex: "#111111",
    fontPairing: "Space Grotesk / Space Mono",
    layoutPattern: "Minimal & Direct",
    antiPatterns: ["Auto-play video", "Too many sections", "Inconsistent spacing"],
    keyEffects: "Cursor interactions, smooth page transitions, hover reveals",
  },
  developer_tool: {
    style: "Dark Mode (OLED)",
    colorMood: "Dark backgrounds, syntax highlight accents, monospace",
    primaryHex: "#10B981",
    fontPairing: "JetBrains Mono / Inter",
    layoutPattern: "Interactive Product Demo",
    antiPatterns: ["Light mode forced", "No code snippets", "Generic stock photos"],
    keyEffects: "Typing animations, terminal-style reveals, smooth code highlights",
  },
  ai_platform: {
    style: "AI-Native UI",
    colorMood: "Deep indigo, electric blue, subtle glows",
    primaryHex: "#6366F1",
    fontPairing: "Inter / JetBrains Mono",
    layoutPattern: "Feature-Rich Showcase",
    antiPatterns: ["Overused AI purple cliché", "Robot illustrations", "Buzzword overload"],
    keyEffects: "Streaming text animation, pulse on AI thinking, smooth fade-ins",
  },
  crypto_web3: {
    style: "Cyberpunk UI",
    colorMood: "Dark backgrounds, neon accents, electric greens/blues",
    primaryHex: "#8B5CF6",
    fontPairing: "Space Grotesk / JetBrains Mono",
    layoutPattern: "Hero-Centric Design",
    antiPatterns: ["Traditional banking look", "No dark mode", "Serif fonts"],
    keyEffects: "Glow effects, particle backgrounds, number countups",
  },
  education: {
    style: "Claymorphism",
    colorMood: "Friendly blues, warm yellows, playful greens",
    primaryHex: "#3B82F6",
    fontPairing: "Nunito / Nunito",
    layoutPattern: "Social Proof-Focused",
    antiPatterns: ["Overly corporate", "Dense text walls", "No progress indicators"],
    keyEffects: "Progress bars, celebration animations, smooth accordion",
  },
  gaming: {
    style: "3D & Hyperrealism",
    colorMood: "Dark canvas, vivid neon accents, dynamic lighting",
    primaryHex: "#EF4444",
    fontPairing: "Rajdhani / Inter",
    layoutPattern: "Storytelling-Driven",
    antiPatterns: ["Pastel colors", "Corporate minimalism", "No animation"],
    keyEffects: "Particle effects, parallax, hover glow, loading screens",
  },
  wellness_meditation: {
    style: "Organic Biophilic",
    colorMood: "Sage, warm cream, terracotta, soft sky blue",
    primaryHex: "#84CC16",
    fontPairing: "Lora / Nunito",
    layoutPattern: "Minimal & Direct",
    antiPatterns: ["Bright saturated colors", "Fast animations", "Cluttered layout"],
    keyEffects: "Slow fade transitions, breathing animations, gentle parallax",
  },
  real_estate: {
    style: "Dimensional Layering",
    colorMood: "Sophisticated grays, gold accents, deep navy",
    primaryHex: "#1E3A5F",
    fontPairing: "Merriweather / Inter",
    layoutPattern: "Social Proof-Focused",
    antiPatterns: ["Cheap stock photos", "No map integration", "Missing floor plans"],
    keyEffects: "Image gallery transitions, map hover states, smooth filter",
  },
  legal: {
    style: "Swiss Modernism 2.0",
    colorMood: "Deep navy, slate gray, white, gold",
    primaryHex: "#1E293B",
    fontPairing: "Merriweather / Inter",
    layoutPattern: "Trust & Authority",
    antiPatterns: ["Playful fonts", "Bright colors", "Informal copy tone"],
    keyEffects: "Minimal animation, clean hover underlines, focus states",
  },
  nonprofit: {
    style: "Storytelling-Driven",
    colorMood: "Warm oranges, earth tones, hopeful greens",
    primaryHex: "#F97316",
    fontPairing: "Merriweather / Inter",
    layoutPattern: "Storytelling-Driven",
    antiPatterns: ["Cold corporate look", "No impact numbers", "Donation CTA buried"],
    keyEffects: "Scroll-triggered counters, image reveal, emotional parallax",
  },
  dashboard_analytics: {
    style: "Bento Box Grid",
    colorMood: "Dark base, muted chart colors, clear data hierarchy",
    primaryHex: "#6366F1",
    fontPairing: "Inter / JetBrains Mono",
    layoutPattern: "Data-Dense Dashboard",
    antiPatterns: ["Too many colors in charts", "No empty state", "Missing loading states"],
    keyEffects: "Chart entry animations, tooltip polish, skeleton loaders",
  },
  social_app: {
    style: "Micro-interactions",
    colorMood: "Vibrant brand color, whites, soft grays",
    primaryHex: "#EC4899",
    fontPairing: "Inter / Inter",
    layoutPattern: "Conversion-Optimized",
    antiPatterns: ["No dark mode", "Inaccessible contrast", "Overloaded feed"],
    keyEffects: "Like bounce, notification pulse, swipe gestures",
  },
  travel: {
    style: "Parallax Storytelling",
    colorMood: "Ocean blues, sunset oranges, earthy greens",
    primaryHex: "#0EA5E9",
    fontPairing: "Playfair Display / Inter",
    layoutPattern: "Hero-Centric Design",
    antiPatterns: ["Generic map pins", "No mood photography", "Cluttered pricing"],
    keyEffects: "Full-bleed parallax hero, destination card hover, smooth booking flow",
  },
};

const KEYWORD_MAP: Record<string, string> = {
  finance: "fintech", bank: "fintech", payment: "fintech", invoice: "fintech", billing: "fintech",
  health: "healthcare", medical: "healthcare", clinic: "healthcare", dental: "healthcare", pharmacy: "healthcare",
  shop: "ecommerce", store: "ecommerce", retail: "ecommerce", product: "ecommerce",
  learn: "education", course: "education", school: "education", tutor: "education", lms: "education",
  game: "gaming", play: "gaming", esport: "gaming",
  crypto: "crypto_web3", nft: "crypto_web3", defi: "crypto_web3", web3: "crypto_web3", blockchain: "crypto_web3",
  spa: "beauty_spa", salon: "beauty_spa", beauty: "beauty_spa", cosmetic: "beauty_spa",
  food: "restaurant", cafe: "restaurant", dining: "restaurant", menu: "restaurant",
  ai: "ai_platform", ml: "ai_platform", chatbot: "ai_platform", llm: "ai_platform", copilot: "ai_platform",
  analytics: "dashboard_analytics", reporting: "dashboard_analytics", dashboard: "dashboard_analytics", metrics: "dashboard_analytics",
  social: "social_app", community: "social_app", forum: "social_app", network: "social_app",
  hotel: "travel", booking: "travel", trip: "travel", flight: "travel", vacation: "travel",
  meditation: "wellness_meditation", yoga: "wellness_meditation", wellness: "wellness_meditation", mindful: "wellness_meditation",
  property: "real_estate", realty: "real_estate", housing: "real_estate", apartment: "real_estate",
  law: "legal", attorney: "legal", compliance: "legal", contract: "legal",
  charity: "nonprofit", donate: "nonprofit", ngo: "nonprofit", foundation: "nonprofit",
  dev: "developer_tool", cli: "developer_tool", sdk: "developer_tool", devops: "developer_tool",
  portfolio: "portfolio", agency: "portfolio", freelance: "portfolio",
  market: "marketplace", gig: "marketplace", peer: "marketplace",
  saas: "saas", software: "saas", platform: "saas", subscription: "saas", b2b: "saas",
};

export function matchDesignProfile(category: string): DesignProfile {
  const normalized = category.toLowerCase().replace(/[^a-z0-9]/g, "_");

  if (DESIGN_VOCABULARY[normalized]) return DESIGN_VOCABULARY[normalized];

  const directMatch = Object.keys(DESIGN_VOCABULARY).find(
    (k) => normalized.includes(k) || k.includes(normalized)
  );
  if (directMatch) return DESIGN_VOCABULARY[directMatch];

  for (const [keyword, profileKey] of Object.entries(KEYWORD_MAP)) {
    if (normalized.includes(keyword)) return DESIGN_VOCABULARY[profileKey];
  }

  return DESIGN_VOCABULARY["saas"];
}
