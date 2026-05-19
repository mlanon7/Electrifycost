# /preflight — Pre-deploy verification gate

Run before any user-visible content change goes live. Catches regressions BEFORE the commit.

## Execute these in order

### 1. Tests

```bash
npm test
```

All 4 stages must pass:
- ✅ `OK: validated 49 CSV files`
- ✅ `OK: validated 109 .astro pages` (or current count)
- ✅ `OK: 13 scenarios + 9 targeted assertion groups passed.`
- ✅ `29/29 new-calculator assertions passed`

### 2. TypeScript

```bash
npx tsc --noEmit
```

Zero output = pass.

### 3. Build

```bash
npm run build
```

Watch for:
- Page count ≥ 400 (verify against expectation — additions shouldn't reduce the count)
- "[sitemap] wrote N URLs to dist/sitemap.xml" — N should be page count − 1 (no 404)
- No `Unexpected "export"` errors (esbuild template-literal bug — see lessons/02)
- No "missing module" / "cannot resolve" errors

### 4. Sitemap sanity

```bash
head -2 dist/sitemap.xml
grep -c "<url>" dist/sitemap.xml
```

Verify:
- Line 2 contains `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"` (slash, not hyphen)
- URL count matches build report

### 5. Random sample of new/changed pages

If you changed N pages, randomly sample 3 of them and verify the built HTML:

```bash
# Spot check
ls dist/<changed-page>/index.html
grep -c "<h1>" dist/<changed-page>/index.html  # should be exactly 1
```

### 6. Dev server visual check (optional but recommended)

If a dev server is running (port 4321), navigate to the changed page and verify visually:
- The change is visible
- No console errors (`preview_console_logs` filter: error)
- Layout doesn't break on mobile (resize)

## Report

```
✅ Tests: passing (4/4)
✅ TypeScript: clean
✅ Build: 409 pages, 408 sitemap URLs
✅ Sitemap namespace: correct
✅ Sample pages: rendered correctly
```

If any item fails, STOP and surface the failure. Don't proceed to `/ship` until preflight is green.

## When to skip

Only skip preflight when:
- The change is doc-only (CLAUDE.md, README.md, etc.) — those don't affect the build
- The change is in `.claude/` itself (not deployed to production)

For anything that touches `src/`, `data/`, `public/`, `scripts/`, or `package.json` — never skip.
