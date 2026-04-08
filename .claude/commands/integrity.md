# Integrity Audit — Run at session start

Before doing anything else in this session, run this audit.
Report findings. Do not proceed until audit is complete.

## What to check

### 1. Wiring audit — grep for every critical function
Run each grep. Report WIRED or NOT WIRED for each.

autofixBuild:
  grep -n "autofixBuild" api/run-build.ts

validateGenerated:
  grep -n "validateGenerated" api/generate.ts

brainHint (server-side):
  grep -n "brain-hint" api/edit.ts

verifyDeployment (server-side):
  grep -n "verify-deployment" api/edit.ts

visualStandards injection:
  grep -n "VISUAL STANDARDS\|visualStandards" api/generate.ts

intentType injection:
  grep -n "intentType\|INTENT:" api/generate.ts

brand_tokens injection:
  grep -n "brand_tokens\|BRAND TOKENS" api/generate.ts

extractBrandFromUrl:
  grep -n "extractBrandFromUrl\|extract-brand" api/extract-brand.ts

### 2. TypeScript integrity
npx tsc -b --noEmit
Report: PASS or list of errors

### 3. ESM extension check
grep -rn "from '\." api/ --include="*.ts" | grep -v "\.js'"
Report: CLEAN or list of violations

### 4. CLAUDE.md freshness check
Check the last 5 entries in Hard-Won Lessons.
Verify each lesson has a corresponding implementation.
Flag any lesson that says "learned" but has no grep evidence
of being implemented.

## Output format

Report as a table:

| Check | Status | Action needed |
|-------|--------|---------------|
| autofixBuild wired | WIRED | — |
| validateGenerated wired | NOT WIRED | Wire into generate.ts |
| tsc | PASS | — |
| ESM extensions | CLEAN | — |

If any check fails, fix it before starting new work.
This is non-negotiable. New features on a broken foundation
make the foundation worse.
