# Sovereign — Engineering Rules

Rules that apply to every session, every commit, every generated scaffold.

---

## Scaffold Templates

**Always run `npm run build` locally before considering a scaffold template production-ready.**
Never ship a template that hasn't passed a clean build. Vercel's build environment is stricter than `vite dev` — tsc runs before Vite and will catch errors that the dev server silently ignores.

Checklist before pushing any scaffold change:
- [ ] `npm run build` exits 0 locally
- [ ] No TypeScript errors (`tsc` clean)
- [ ] No relative imports missing `.js` extensions in `api/` files
- [ ] No curly/smart quotes inside string literals

---

## Generated App Code

**No curly/smart quotes inside string literals.**
Claude uses Unicode curly apostrophes (') and smart quotes (" ") in prose. Inside a JS/TS string literal they terminate the string early and cause cascading tsc failures. Use double quotes or template literals when a string contains an apostrophe.

**No React namespace type references.**
With `"jsx":"react-jsx"`, use named type imports: `import { type FormEvent } from 'react'`. Never `React.FormEvent`, `React.ReactNode`, etc.

**No path aliases.**
Never `@/components/Foo`. Always `../components/Foo`. vite.config.ts does not define aliases.

**Every import must resolve.**
Every import statement must reference a file that exists in the generated files array. Dead imports fail tsc immediately.

---

## API Routes (`api/`)

**All relative imports must end in `.js`.**
Node ESM requires explicit `.js` extensions on relative imports. Missing extensions cause `ERR_MODULE_NOT_FOUND` on every cold start in production.

**Every route must be rate limited.**
Use `checkRateLimit` from `./_rateLimit.js` as the first check in every handler.

**Never log env var values.**
Use `echo "Set: ${#VAR} chars"` to verify length. Never print the value.
