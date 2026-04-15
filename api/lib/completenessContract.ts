// Generation Completeness Contract
//
// Tells Claude what a complete app looks like BEFORE it writes a single line
// of code. Injected into the generation prompt at position 3, after category
// intelligence and before the design / UX / accessibility layers.
//
// The same CONTRACTS map is consumed by api/lib/generateManifest.ts so the
// generation contract and the post-generation manifest verification share a
// single source of truth — no drift between what Claude is told to build and
// what the manifest checks for.
//
// Pure data — no LLM, no network, <5ms.

export interface ContractState {
  state: 'loading' | 'empty' | 'error' | 'success'
  description: string
}

export interface ContractPage {
  name: string
  route: string
  purpose: string
  requiredSections: string[]
  requiredStates: ContractState[]
}

export interface ContractFeature {
  id: string
  description: string
  files: string[]
}

export interface CompletenessContract {
  category: string
  pages: ContractPage[]
  features: ContractFeature[]
  navigationRules: string[]
}

// Universal states and rules that apply to EVERY app, EVERY page
const UNIVERSAL_PAGE_STATES: ContractState[] = [
  {
    state: 'loading',
    description:
      'Skeleton UI or spinner while data fetches from Supabase. ' +
      'Never show an empty page while loading.',
  },
  {
    state: 'empty',
    description:
      'Friendly empty state with illustration or icon, explanation, ' +
      'and a clear call-to-action when a list or dataset has no items.',
  },
  {
    state: 'error',
    description:
      'User-readable error message (not a stack trace) with a retry ' +
      'action when a Supabase query or API call fails.',
  },
]

export const UNIVERSAL_RULES: string[] = [
  'Every page must be reachable via at least one navigation link from another page. No orphan pages.',
  'Every list or data table must handle: loading state, empty state, error state, and populated state.',
  'Every form must handle: idle, submitting (disabled button + spinner), success, and error states.',
  'Every authenticated route must redirect unauthenticated users to the login page.',
  'Mobile navigation must exist — a hamburger menu or bottom tab bar on screens under 768px.',
  'The primary CTA on every page must be immediately visible without scrolling.',
]

// Per-category contracts — keyed by canonical UPPER_SNAKE_CASE labels
export const CONTRACTS: Record<string, CompletenessContract> = {
  SAAS_TOOL: {
    category: 'SAAS_TOOL',
    pages: [
      {
        name: 'Landing',
        route: '/',
        purpose: 'Converts visitors into signups — hero, features, pricing, CTA.',
        requiredSections: ['hero', 'features', 'pricing', 'footer'],
        requiredStates: [],
      },
      {
        name: 'Login',
        route: '/login',
        purpose: 'Email/password auth with Supabase.',
        requiredSections: ['login-form'],
        requiredStates: [
          { state: 'loading', description: 'Button shows spinner while authenticating.' },
          { state: 'error', description: 'Inline error for wrong credentials.' },
        ],
      },
      {
        name: 'Dashboard',
        route: '/dashboard',
        purpose: 'Primary logged-in view — key metrics and recent activity.',
        requiredSections: ['metrics-row', 'activity-feed', 'quick-actions'],
        requiredStates: UNIVERSAL_PAGE_STATES,
      },
      {
        name: 'Settings',
        route: '/settings',
        purpose: 'Account and app configuration.',
        requiredSections: ['profile-form', 'danger-zone'],
        requiredStates: [
          { state: 'loading', description: 'Skeleton while profile loads.' },
          { state: 'error', description: 'Error if save fails.' },
        ],
      },
      {
        name: 'Pricing',
        route: '/pricing',
        purpose: 'Plan comparison and upgrade flow.',
        requiredSections: ['plan-cards', 'faq'],
        requiredStates: [],
      },
    ],
    features: [
      {
        id: 'auth',
        description:
          'Supabase email/password auth. Protected routes redirect to /login. ' +
          'Session persisted. Logout clears session.',
        files: ['src/lib/auth.ts', 'src/pages/Login.tsx'],
      },
      {
        id: 'crud',
        description:
          'At least one full create/read/update/delete flow using Supabase. ' +
          'All four operations must be wired — not just read.',
        files: ['src/lib/db.ts'],
      },
    ],
    navigationRules: [
      'Landing page header links to Login and Pricing.',
      'After login, redirect to /dashboard.',
      'Dashboard nav includes links to all primary pages and a logout action.',
      'Settings reachable from Dashboard nav.',
    ],
  },

  MARKETPLACE: {
    category: 'MARKETPLACE',
    pages: [
      {
        name: 'Home',
        route: '/',
        purpose: 'Discovery surface — featured listings, search, categories.',
        requiredSections: ['search-bar', 'featured-listings', 'category-grid'],
        requiredStates: [
          { state: 'loading', description: 'Skeleton cards while listings load.' },
          { state: 'error', description: 'Error state with retry.' },
        ],
      },
      {
        name: 'Listings',
        route: '/listings',
        purpose: 'Full browsable listing grid with filters.',
        requiredSections: ['filter-bar', 'listing-grid', 'pagination'],
        requiredStates: UNIVERSAL_PAGE_STATES,
      },
      {
        name: 'ListingDetail',
        route: '/listings/:id',
        purpose: 'Individual listing — full details, photos, contact/purchase CTA.',
        requiredSections: ['gallery', 'details', 'seller-info', 'cta'],
        requiredStates: [
          { state: 'loading', description: 'Skeleton while listing loads.' },
          { state: 'error', description: 'Not found state if listing missing.' },
        ],
      },
      {
        name: 'Profile',
        route: '/profile',
        purpose: 'User profile — their listings, reviews, contact.',
        requiredSections: ['profile-header', 'listings-grid'],
        requiredStates: UNIVERSAL_PAGE_STATES,
      },
      {
        name: 'CreateListing',
        route: '/listings/new',
        purpose: 'Multi-step or single form to create a listing.',
        requiredSections: ['listing-form'],
        requiredStates: [
          { state: 'loading', description: 'Spinner on submit.' },
          { state: 'error', description: 'Field validation errors.' },
          { state: 'success', description: 'Redirect to new listing on success.' },
        ],
      },
      {
        name: 'Login',
        route: '/login',
        purpose: 'Auth gate for creating listings and messaging.',
        requiredSections: ['login-form'],
        requiredStates: [
          { state: 'loading', description: 'Button spinner.' },
          { state: 'error', description: 'Inline credential error.' },
        ],
      },
    ],
    features: [
      {
        id: 'auth',
        description: 'Supabase auth. Creating listings and messaging requires login.',
        files: ['src/lib/auth.ts', 'src/pages/Login.tsx'],
      },
      {
        id: 'crud',
        description: 'Full CRUD on listings. Create, read list, read detail, update, delete.',
        files: ['src/lib/listings.ts'],
      },
      {
        id: 'search',
        description:
          'Text search across listing titles and descriptions using Supabase ilike or textSearch.',
        files: ['src/lib/search.ts'],
      },
    ],
    navigationRules: [
      'Home search bar navigates to /listings?q={query}.',
      'Every listing card links to /listings/:id.',
      'ListingDetail has a back link to /listings.',
      'Nav includes Home, Listings, Create Listing (auth-gated), Profile.',
    ],
  },

  BOOKING_SCHEDULING: {
    category: 'BOOKING_SCHEDULING',
    pages: [
      {
        name: 'Home',
        route: '/',
        purpose: 'Service intro, trust signals, book CTA.',
        requiredSections: ['hero', 'services', 'how-it-works', 'cta'],
        requiredStates: [],
      },
      {
        name: 'Book',
        route: '/book',
        purpose: 'Date/time picker and booking form.',
        requiredSections: ['calendar', 'time-slots', 'booking-form'],
        requiredStates: [
          { state: 'loading', description: 'Skeleton while available slots load.' },
          { state: 'empty', description: 'No slots available message with alternative dates.' },
          { state: 'error', description: 'Booking failed — retry option.' },
          { state: 'success', description: 'Confirmation with booking reference.' },
        ],
      },
      {
        name: 'Confirmation',
        route: '/confirmation',
        purpose: 'Booking confirmed — reference number, calendar add, next steps.',
        requiredSections: ['confirmation-details', 'add-to-calendar', 'next-steps'],
        requiredStates: [],
      },
      {
        name: 'Dashboard',
        route: '/dashboard',
        purpose: 'Manage bookings — upcoming, past, cancel.',
        requiredSections: ['upcoming-bookings', 'past-bookings'],
        requiredStates: UNIVERSAL_PAGE_STATES,
      },
      {
        name: 'Login',
        route: '/login',
        purpose: 'Auth for managing bookings.',
        requiredSections: ['login-form'],
        requiredStates: [
          { state: 'loading', description: 'Button spinner.' },
          { state: 'error', description: 'Credential error.' },
        ],
      },
    ],
    features: [
      {
        id: 'auth',
        description: 'Supabase auth. Dashboard requires login.',
        files: ['src/lib/auth.ts'],
      },
      {
        id: 'crud',
        description: 'Create booking, read bookings, cancel (soft delete) booking.',
        files: ['src/lib/bookings.ts'],
      },
      {
        id: 'calendar',
        description:
          'Date picker showing available slots. Booked slots marked unavailable. ' +
          'No double-booking allowed at the DB level.',
        files: ['src/components/Calendar.tsx'],
      },
    ],
    navigationRules: [
      'Home hero CTA links to /book.',
      'Confirmation page links back to Home and to /dashboard.',
      'Dashboard reachable from nav when logged in.',
    ],
  },

  ECOMMERCE_RETAIL: {
    category: 'ECOMMERCE_RETAIL',
    pages: [
      {
        name: 'Home',
        route: '/',
        purpose: 'Hero, featured products, categories.',
        requiredSections: ['hero', 'featured-products', 'category-grid'],
        requiredStates: [
          { state: 'loading', description: 'Skeleton product cards.' },
        ],
      },
      {
        name: 'Products',
        route: '/products',
        purpose: 'Full product grid with filters and sort.',
        requiredSections: ['filter-sidebar', 'product-grid', 'sort-bar'],
        requiredStates: UNIVERSAL_PAGE_STATES,
      },
      {
        name: 'ProductDetail',
        route: '/products/:id',
        purpose: 'Product page — images, description, add to cart.',
        requiredSections: ['product-gallery', 'product-info', 'add-to-cart'],
        requiredStates: [
          { state: 'loading', description: 'Skeleton while product loads.' },
          { state: 'error', description: 'Product not found.' },
        ],
      },
      {
        name: 'Cart',
        route: '/cart',
        purpose: 'Cart review with quantity controls and checkout CTA.',
        requiredSections: ['cart-items', 'order-summary', 'checkout-cta'],
        requiredStates: [
          { state: 'empty', description: 'Empty cart with link back to products.' },
        ],
      },
      {
        name: 'Checkout',
        route: '/checkout',
        purpose: 'Payment and shipping form.',
        requiredSections: ['shipping-form', 'payment-form', 'order-review'],
        requiredStates: [
          { state: 'loading', description: 'Spinner while payment processes.' },
          { state: 'error', description: 'Payment failed — retry.' },
          { state: 'success', description: 'Order confirmed with reference.' },
        ],
      },
    ],
    features: [
      {
        id: 'auth',
        description: 'Optional auth — guest checkout allowed but account saves order history.',
        files: ['src/lib/auth.ts'],
      },
      {
        id: 'crud',
        description: 'Products from Supabase. Cart state in React context or localStorage.',
        files: ['src/lib/products.ts', 'src/context/CartContext.tsx'],
      },
      {
        id: 'payments',
        description:
          'Stripe checkout session or payment element. ' +
          'Order record created in Supabase on payment success webhook.',
        files: ['src/lib/stripe.ts'],
      },
    ],
    navigationRules: [
      'Header has cart icon with item count badge.',
      'Every product card links to /products/:id.',
      'Cart page checkout CTA links to /checkout.',
      'Checkout success redirects to confirmation or home.',
    ],
  },

  RESTAURANT_HOSPITALITY: {
    category: 'RESTAURANT_HOSPITALITY',
    pages: [
      {
        name: 'Home',
        route: '/',
        purpose: 'Brand hero, cuisine highlights, reservation CTA.',
        requiredSections: ['hero', 'about', 'highlights', 'reservation-cta'],
        requiredStates: [],
      },
      {
        name: 'Menu',
        route: '/menu',
        purpose: 'Full menu organized by category with prices.',
        requiredSections: ['menu-categories', 'menu-items'],
        requiredStates: [
          { state: 'loading', description: 'Skeleton menu items.' },
          { state: 'error', description: 'Error loading menu — show static fallback.' },
        ],
      },
      {
        name: 'Reservations',
        route: '/reservations',
        purpose: 'Table booking form — date, time, party size, contact.',
        requiredSections: ['reservation-form'],
        requiredStates: [
          { state: 'loading', description: 'Spinner on submit.' },
          { state: 'error', description: 'No availability or form error.' },
          { state: 'success', description: 'Confirmation with reservation details.' },
        ],
      },
      {
        name: 'Contact',
        route: '/contact',
        purpose: 'Location, hours, map, contact form.',
        requiredSections: ['location-map', 'hours', 'contact-form'],
        requiredStates: [],
      },
    ],
    features: [
      {
        id: 'crud',
        description: 'Reservations saved to Supabase. Menu items from Supabase or static data.',
        files: ['src/lib/reservations.ts'],
      },
    ],
    navigationRules: [
      'Home hero CTA links to /reservations.',
      'Nav includes Home, Menu, Reservations, Contact.',
      'Footer repeats nav links.',
    ],
  },

  DIRECTORY_LISTING: {
    category: 'DIRECTORY_LISTING',
    pages: [
      {
        name: 'Home',
        route: '/',
        purpose: 'Directory hero, search bar, featured listings.',
        requiredSections: ['hero', 'search-bar', 'featured-listings', 'categories'],
        requiredStates: [
          { state: 'loading', description: 'Skeleton featured listings.' },
        ],
      },
      {
        name: 'Listings',
        route: '/listings',
        purpose: 'Full directory with search, filters, sort.',
        requiredSections: ['search-filter-bar', 'listing-cards', 'pagination'],
        requiredStates: UNIVERSAL_PAGE_STATES,
      },
      {
        name: 'ListingDetail',
        route: '/listings/:id',
        purpose: 'Full profile for a directory entry.',
        requiredSections: ['listing-header', 'details', 'contact', 'map'],
        requiredStates: [
          { state: 'loading', description: 'Skeleton layout.' },
          { state: 'error', description: 'Not found state.' },
        ],
      },
      {
        name: 'Submit',
        route: '/submit',
        purpose: 'Form to submit a new listing to the directory.',
        requiredSections: ['submission-form'],
        requiredStates: [
          { state: 'loading', description: 'Spinner on submit.' },
          { state: 'success', description: 'Submitted — pending review message.' },
          { state: 'error', description: 'Validation or submission error.' },
        ],
      },
      {
        name: 'Login',
        route: '/login',
        purpose: 'Auth for submitting and managing listings.',
        requiredSections: ['login-form'],
        requiredStates: [
          { state: 'loading', description: 'Button spinner.' },
          { state: 'error', description: 'Credential error.' },
        ],
      },
    ],
    features: [
      {
        id: 'auth',
        description: 'Supabase auth. Submit and manage require login.',
        files: ['src/lib/auth.ts'],
      },
      {
        id: 'crud',
        description: 'Full CRUD on listings. Admin can approve submissions.',
        files: ['src/lib/listings.ts'],
      },
      {
        id: 'search',
        description: 'Text search and category filter across listings.',
        files: ['src/lib/search.ts'],
      },
    ],
    navigationRules: [
      'Home search navigates to /listings?q={query}.',
      'Every listing card links to /listings/:id.',
      'Submit link in nav (auth-gated).',
    ],
  },

  COMMUNITY_SOCIAL: {
    category: 'COMMUNITY_SOCIAL',
    pages: [
      {
        name: 'Home',
        route: '/',
        purpose: 'Public landing — community value prop and signup CTA.',
        requiredSections: ['hero', 'features', 'cta'],
        requiredStates: [],
      },
      {
        name: 'Feed',
        route: '/feed',
        purpose: 'Chronological or ranked post feed.',
        requiredSections: ['post-composer', 'post-list'],
        requiredStates: UNIVERSAL_PAGE_STATES,
      },
      {
        name: 'Profile',
        route: '/profile/:id',
        purpose: 'User profile — bio, posts, followers.',
        requiredSections: ['profile-header', 'posts-grid'],
        requiredStates: UNIVERSAL_PAGE_STATES,
      },
      {
        name: 'Login',
        route: '/login',
        purpose: 'Auth gate — feed and profile require login.',
        requiredSections: ['login-form'],
        requiredStates: [
          { state: 'loading', description: 'Button spinner.' },
          { state: 'error', description: 'Credential error.' },
        ],
      },
    ],
    features: [
      {
        id: 'auth',
        description: 'Supabase auth. All community features require login.',
        files: ['src/lib/auth.ts'],
      },
      {
        id: 'crud',
        description: 'Create, read, delete posts. Follow/unfollow users.',
        files: ['src/lib/posts.ts'],
      },
      {
        id: 'realtime',
        description:
          'Supabase realtime subscription on posts table so feed updates ' +
          'without page refresh.',
        files: ['src/lib/realtime.ts'],
      },
    ],
    navigationRules: [
      'Home CTA links to /login or /feed if already logged in.',
      'Nav shows Feed and Profile when logged in.',
      'Every post links to the author profile.',
    ],
  },

  PORTFOLIO_SHOWCASE: {
    category: 'PORTFOLIO_SHOWCASE',
    pages: [
      {
        name: 'Home',
        route: '/',
        purpose: 'Hero introduction — name, role, headline CTA.',
        requiredSections: ['hero', 'skills', 'featured-work', 'cta'],
        requiredStates: [],
      },
      {
        name: 'Work',
        route: '/work',
        purpose: 'Full project grid — case studies or thumbnails.',
        requiredSections: ['project-grid'],
        requiredStates: [
          { state: 'loading', description: 'Skeleton project cards.' },
          { state: 'empty', description: 'Placeholder if no projects yet.' },
        ],
      },
      {
        name: 'About',
        route: '/about',
        purpose: 'Biography, skills, experience, downloadable CV.',
        requiredSections: ['bio', 'skills-list', 'experience-timeline'],
        requiredStates: [],
      },
      {
        name: 'Contact',
        route: '/contact',
        purpose: 'Contact form and social links.',
        requiredSections: ['contact-form', 'social-links'],
        requiredStates: [
          { state: 'loading', description: 'Spinner on form submit.' },
          { state: 'success', description: 'Message sent confirmation.' },
          { state: 'error', description: 'Send failed — retry.' },
        ],
      },
    ],
    features: [
      {
        id: 'crud',
        description:
          'Projects stored in Supabase or as static data. Contact form saves to Supabase.',
        files: ['src/lib/projects.ts'],
      },
    ],
    navigationRules: [
      'Nav includes Home, Work, About, Contact.',
      'Home featured-work links to /work.',
      'Footer repeats nav and social links.',
    ],
  },

  INTERNAL_TOOL: {
    category: 'INTERNAL_TOOL',
    pages: [
      {
        name: 'Login',
        route: '/login',
        purpose: 'Auth gate — all pages require login.',
        requiredSections: ['login-form'],
        requiredStates: [
          { state: 'loading', description: 'Button spinner.' },
          { state: 'error', description: 'Credential error.' },
        ],
      },
      {
        name: 'Dashboard',
        route: '/dashboard',
        purpose: 'Summary metrics and quick navigation.',
        requiredSections: ['metrics-row', 'recent-activity', 'quick-links'],
        requiredStates: UNIVERSAL_PAGE_STATES,
      },
      {
        name: 'DataTable',
        route: '/data',
        purpose: 'Primary data management — sortable, filterable table with CRUD actions.',
        requiredSections: ['toolbar', 'data-table', 'pagination'],
        requiredStates: UNIVERSAL_PAGE_STATES,
      },
      {
        name: 'Settings',
        route: '/settings',
        purpose: 'User and system configuration.',
        requiredSections: ['profile-form', 'preferences'],
        requiredStates: [
          { state: 'loading', description: 'Skeleton while settings load.' },
          { state: 'error', description: 'Save failed.' },
        ],
      },
    ],
    features: [
      {
        id: 'auth',
        description: 'Supabase auth. Every route redirects to /login if unauthenticated.',
        files: ['src/lib/auth.ts'],
      },
      {
        id: 'crud',
        description:
          'Full create, read, update, delete on the primary data entity. ' +
          'Inline editing or modal forms.',
        files: ['src/lib/data.ts'],
      },
    ],
    navigationRules: [
      'Sidebar nav with Dashboard, Data, Settings, Logout.',
      'Dashboard quick-links navigate to /data.',
      'Every table row has edit and delete actions.',
    ],
  },
}

// Normalise the loose lowercase categories produced by the Haiku classifier
// (and any historic short labels) to the canonical UPPER_SNAKE_CASE keys above.
// Used by both the prompt builder and api/lib/generateManifest.ts so manifest
// scoring and generation requirements are anchored to the same keys.
export function normaliseCategory(category: string): string {
  if (!category) return 'SAAS_TOOL'
  const lower = category.trim().toLowerCase().replace(/[\s-]+/g, '_')
  const map: Record<string, string> = {
    saas: 'SAAS_TOOL',
    saas_tool: 'SAAS_TOOL',
    productivity: 'SAAS_TOOL',
    finance: 'SAAS_TOOL',
    health: 'SAAS_TOOL',
    tool: 'SAAS_TOOL',
    marketplace: 'MARKETPLACE',
    booking: 'BOOKING_SCHEDULING',
    booking_scheduling: 'BOOKING_SCHEDULING',
    ecommerce: 'ECOMMERCE_RETAIL',
    ecommerce_retail: 'ECOMMERCE_RETAIL',
    restaurant: 'RESTAURANT_HOSPITALITY',
    restaurant_hospitality: 'RESTAURANT_HOSPITALITY',
    directory: 'DIRECTORY_LISTING',
    directory_listing: 'DIRECTORY_LISTING',
    community: 'COMMUNITY_SOCIAL',
    community_social: 'COMMUNITY_SOCIAL',
    social: 'COMMUNITY_SOCIAL',
    portfolio: 'PORTFOLIO_SHOWCASE',
    portfolio_showcase: 'PORTFOLIO_SHOWCASE',
    content: 'PORTFOLIO_SHOWCASE',
    internal: 'INTERNAL_TOOL',
    internal_tool: 'INTERNAL_TOOL',
  }
  return map[lower] ?? lower.toUpperCase()
}

export function buildCompletenessContract(category: string): string {
  const key = normaliseCategory(category)
  const contract = CONTRACTS[key]

  if (!contract) {
    // Graceful fallback — universal rules only
    return [
      '## COMPLETENESS CONTRACT',
      '',
      'Every page you generate MUST satisfy these rules:',
      ...UNIVERSAL_RULES.map((r) => `- ${r}`),
      '',
      'Every list must handle: loading skeleton, empty state with CTA, error state with retry.',
      'Every form must handle: idle, submitting, success, error.',
      'Every authenticated route must redirect to /login if the user is not logged in.',
    ].join('\n')
  }

  const pagesBlock = contract.pages
    .map((page) => {
      const sectionsBlock = page.requiredSections.length > 0
        ? `\n  Sections: ${page.requiredSections.join(', ')}`
        : ''
      const statesBlock = page.requiredStates.length > 0
        ? '\n  States:\n' +
          page.requiredStates
            .map((s) => `    - ${s.state}: ${s.description}`)
            .join('\n')
        : ''
      return `- ${page.name} (${page.route}): ${page.purpose}${sectionsBlock}${statesBlock}`
    })
    .join('\n')

  const featuresBlock = contract.features
    .map((f) => `- ${f.id}: ${f.description}`)
    .join('\n')

  const navBlock = contract.navigationRules.map((r) => `- ${r}`).join('\n')
  const universalBlock = UNIVERSAL_RULES.map((r) => `- ${r}`).join('\n')

  return [
    `## COMPLETENESS CONTRACT — ${key}`,
    '',
    'You MUST generate every page listed below. Do not skip any.',
    'You MUST implement every feature listed below.',
    'You MUST follow every navigation rule to prevent unreachable pages.',
    'These are non-negotiable requirements, not suggestions.',
    '',
    `### REQUIRED PAGES (${contract.pages.length})`,
    pagesBlock,
    '',
    '### REQUIRED FEATURES',
    featuresBlock,
    '',
    '### NAVIGATION RULES (prevents orphan pages)',
    navBlock,
    '',
    '### UNIVERSAL RULES (apply to every page)',
    universalBlock,
  ].join('\n')
}
