# Sovereign Security Standards

Every app built on Sovereign is generated with security as the foundation, not an afterthought.

## What we guarantee by default

**Row Level Security** — Every Supabase table in every generated app has RLS enabled with explicit, tested policies. We never generate USING(true). We never leave a table with RLS enabled but no policies defined.

**No direct database access from the browser** — All data flows through server-side API routes. The Supabase service role key never appears in client code.

**No secrets in client code** — API keys, tokens, and credentials live in environment variables on the server. Your Anthropic key, Stripe key, and Resend key are never exposed to the browser.

**Server-side auth validation** — Every protected request validates the user session server-side. We never trust auth state from the client.

**Input validation** — Every form field is validated both client-side (for UX) and server-side (for security). Server-side is the boundary that matters.

**Secure HTTP headers** — Every generated app ships with X-Frame-Options, X-Content-Type-Options, Content-Security-Policy, and Referrer-Policy configured correctly via vercel.json.

**Rate limiting** — Every API endpoint has rate limiting. Auth endpoints are limited to 5 requests per minute per IP. Data endpoints to 60 per minute per user.

**Soft deletes** — User data is never hard-deleted. All delete operations set deleted_at and filter accordingly. Users can always export their data.

## Why this matters

In 2025, CVE-2025-48757 exposed 170+ apps built on a competing AI platform. The root cause was AI-generated code with missing Supabase Row Level Security. Attackers accessed full user databases — names, addresses, payment records, API keys — without any credentials.

Sovereign exists to give everyone the benefits of AI-powered app building without the security debt. Every app we generate is audited against these standards before a line of code is committed.

## Reporting a vulnerability

If you find a security issue in Sovereign or in a Sovereign-generated app template, please email security@visila.com. We will respond within 24 hours. We take every report seriously.
