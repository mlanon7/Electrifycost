# Architecture

System design for human developers. Complements `CLAUDE.md` (AI-focused working context) and `README.md` (project overview).

---

## High-level shape

```
                     ┌─────────────────────────┐
                     │   Browser (visitor)     │
                     └────────────┬────────────┘
                                  │ HTTPS
                                  ▼
                     ┌─────────────────────────┐
                     │   Vercel Edge Network   │  (static + immutable cache)
                     └────────────┬────────────┘
                                  │ cached HTML / JS / AVIF / WebP
                                  ▼
              ┌──────────────────────────────────────┐
              │     Astro 4 static build output      │
              │  (dist/ — 642 HTML pages, ~5 MB JS)  │
              └─────────────────┬────────────────────┘
                                │ at build time
                                ▼
       ┌─────────────────────────────────────────────────┐
       │     Vite bundles + Astro renders                │
       │       - .astro pages → static HTML              │
       │       - .tsx React components → island JS       │
       │       - data/csv/*.csv → inlined via ?raw       │
       │       - @fontsource/* → self-hosted woff2       │
       └─────────────────┬───────────────────────────────┘
                         │ reads
                         ▼
       ┌─────────────────────────────────────────────────┐
       │            data/csv/ (51 files)                 │
       │  Single source of truth for every numeric input │
       └─────────────────────────────────────────────────┘
```

The site ships as **fully static HTML + a small amount of hydrated React** (only the calculator components hydrate via `client:load`). No server runtime. No database. No backend API.

---

## Three architectural decisions worth understanding

### 1. CSV-first data layer

Every numeric input — equipment cost, labor hours, state multipliers, climate data, rebate amounts, expiration dates, energy prices, federal-credit caps — lives in `data/csv/*.csv` (51 files). **Not in TypeScript, not in JSON, not in a database.**

**Why CSVs:**
- A non-engineer (the founder, a contractor, a research intern) can open any file in Google Sheets, edit, and download back as CSV.
- Single source of truth — the runtime calculator and the test smoke-runner both read the same files.
- Easy to audit — every row carries a `source_id` and `last_reviewed` date, so the data lineage is built into the format.
- Build fails fast — `requireRows()` in `src/lib/data.ts` throws if any expected CSV loads zero rows.

**How CSVs reach the runtime:**
- Astro pages → `import { ... } from '@/lib/data'`
- `data.ts` → `import csvText from '../../data/csv/X.csv?raw'` (Vite inlines the file content at build)
- `parseCsv(csvText)` → array of records → typed via `coerce()` → cached at module load
- Component calls `findStateLabor('CA')` → returns the cached row

**The tradeoff:** Vite inlines ALL the CSV files into a single client bundle (~104 KB pre-gzip). Every calculator page hydrates the full data bundle, even when it only needs one CSV. **Phase 3 candidate:** split `src/lib/data.ts` into per-domain modules so calculators import only what they need.

### 2. Shared engine for flagships + bespoke math elsewhere

**5 flagship calculators** (heat pump, EV charger, panel, HPWH, induction) share a single engine in `src/lib/calc.ts`:

```typescript
runCalculator(args: CalcArgs): CalculatorResult
```

The engine handles:
- Base cost band (material + labor × state mult × hours + permit)
- Difficulty / home-type / timing multipliers
- Panel adder logic (probabilistic upgrade risk)
- Incentive stacking (federal + state + utility, with date-based applicability)
- Operating-cost change (HDD × UA × COP for heat pumps; AFDC-anchored for EV; NEEA for HPWH)
- Simple payback computation

**33 non-flagship calculators** (mini-split, geothermal, AC, ductwork, windows, solar, battery, etc.) do their own `useMemo` math inline in the component. Each reads from its module-specific CSV.

**Why two patterns:** the flagship engine is heavily tested (49 assertion total across the smoke-test suite). Forcing every calculator through the engine would require generalizing it to cooling-only / solar-with-NEM / per-watt costing / per-window costing scenarios — a much bigger surface than the unified energy-conversion math the flagships share. The bespoke calculators are simpler and easier to maintain in isolation.

**Result-panel consistency:** the flagships use `ResultPanel.tsx`. The non-flagships each render their own result UI. **Future work:** promote `ResultPanel` to all 38 calculators.

### 3. Static-first with React islands

Astro renders each page to static HTML at build time. The five flagship calculator pages contain a hydrated React component (`<HeatPumpCalculator client:load />`); everything else on the page is static HTML.

**Why:**
- Core Web Vitals stay strong — no JS frameworks loading on hub/state/guide pages
- Each page is independently cacheable at Vercel's edge with `Cache-Control: max-age=31536000, immutable`
- New pages don't bloat the bundle — adding 200 state pages added 0 KB to the client JS

**The catch:** when a calculator hydrates, it has to re-fetch the full CSV bundle to compute. That's the 104 KB cost mentioned in §1.

### 4. Programmatic SEO dimensions + the routing rule

The site scales URL count by multiplying a calculator across **dimensions**. As of 2026-05 there are four live dimensions (642 built pages):

| Dimension | Data source | URL shape | Example |
|---|---|---|---|
| **State** | `state-*.csv` (51 rows) | prefix, dynamic | `/heat-pump-cost-tx/` |
| **City** | `top-cities.csv` (100 rows) | subpath, dynamic | `/heat-pump-cost/houston-tx/` |
| **Size** (sqft, tonnage) | static files | prefix, static | `/heat-pump-cost-3-ton/` |
| **Brand** | `brand-profiles.csv` (22 rows) | suffix, dynamic | `/mitsubishi-heat-pump-cost/` |

**The routing rule that makes this work without collisions:** the dynamic `<module>-cost-[state].astro` route is GREEDY — it matches any `/<module>-cost-<single-segment>/`. To add more dimensions without colliding with it:

- **Prefix-form statics** (`heat-pump-cost-3-ton.astro`, `heat-pump-cost-by-state.astro`) coexist because Astro resolves static routes before dynamic ones, and the `[state]` `getStaticPaths` only emits real state codes (never "3-ton").
- **Subpath** (`heat-pump-cost/[city].astro` → `/heat-pump-cost/<city>/`) is a different path level entirely — no overlap with the hyphenated `heat-pump-cost-X` routes.
- **Suffix-form dynamic** (`[brand]-heat-pump-cost.astro` → `/<brand>-heat-pump-cost/`) is a different URL SHAPE — the `[state]` route matches `heat-pump-cost-<x>` (prefix), this matches `<x>-heat-pump-cost` (suffix), so they never overlap.

See `.claude/lessons/08-astro-route-collision-patterns.md` for the full decision tree. Adding a new dimension? Pick one of these three shapes; never add a second greedy single-segment dynamic at the same prefix.

The dimensions compose: state × module = 306 pages, city × module = 200, brand × module = 22, size × module = 10. Each dimension is one template (or a few static files) + one CSV. This is the core growth lever — most of the 642 pages came from ~10 template files.

---

## Directory layout (key files only)

```
.
├── astro.config.mjs            — Astro config: React + Tailwind + Vite cache dir
├── tailwind.config.mjs         — brand/ink palette, custom font stacks, custom utilities
├── vercel.json                 — clean URLs, trailing slashes, security + cache headers
├── package.json                — dev / build / preview / test scripts
├── .github/workflows/ci.yml    — runs npm test + npm run build on every push/PR
├── public/                     — static assets served as-is from /
│   ├── robots.txt              — Sitemap: /sitemap.xml + GPTBot/ClaudeBot allow
│   ├── og-default.png          — 1200×630 social card
│   ├── favicon.svg
│   └── assets/topic-images/    — 27 hero photos × (AVIF + WebP + PNG)
├── data/csv/                   — 51 CSVs (THE source of truth)
├── scripts/
│   ├── build-sitemap.cjs       — postbuild: walks dist/ → emits sitemap.xml
│   ├── validate-csvs.cjs       — pre-test
│   ├── validate-pages.cjs      — pre-test: Layout open/close + JSX traps
│   ├── smoke-test.cjs          — 13 + 9 assertion runs against the engine
│   └── new-calc-tests.cjs      — 29 assertion runs for non-flagship math
└── src/
    ├── components/
    │   ├── Layout.astro        — site shell: <head>, GA4, schemas, header, footer, slot
    │   ├── Header.astro        — sticky nav with 5 dropdown categories
    │   ├── Footer.astro        — 4-col footer + "Data last refreshed" stamp
    │   ├── CookieBanner.astro  — Consent Mode v2 UI
    │   ├── ResultPanel.tsx     — shared low/mid/high result UI
    │   ├── RelatedGuides.astro — uniform footer on every /guides/X page
    │   ├── AdSlot.astro        — gated; reserves min-height for CLS
    │   ├── AffiliateDisclosure.astro + AffiliateModule.astro — gated
    │   └── 38 *Calculator.tsx  — 5 flagship + 33 bespoke
    ├── lib/
    │   ├── calc.ts             — shared engine (runCalculator)
    │   ├── data.ts             — CSV loaders + lookup helpers
    │   ├── format.ts           — fmtUSD / fmtUSDRange / fmtMonths
    │   ├── use-url-state.ts    — hash-state hooks for shareable inputs
    │   └── guide-relationships.ts — 37 guide siblings + calculator hrefs
    ├── data/
    │   ├── contractor-checklists.json
    │   ├── glossary.json
    │   └── source-notes.json   — 200+ primary-source entries
    ├── pages/                  — 109 .astro files → 409 built HTML pages
    │   ├── index.astro
    │   ├── about.astro
    │   ├── methodology.astro
    │   ├── sources.astro
    │   ├── rebates.astro
    │   ├── glossary.astro
    │   ├── 404.astro
    │   ├── <module>-cost-calculator.astro × 38
    │   ├── <module>-cost-[state].astro × 6 templates → 51 pages each
    │   ├── <module>-cost-by-state.astro × 6 hub pages
    │   ├── heat-pump-cost-{N}-sqft.astro × 5
    │   ├── per-amp panel pages × 4
    │   ├── <module>-vs-<module>.astro × ~8 comparison pages
    │   └── guides/<topic>.astro × 37
    └── styles/global.css       — Tailwind base + components
```

---

## Build pipeline

```
npm run build
   │
   ├──▶ astro build
   │     │
   │     ├──▶ astro:types          → generates .astro/types.d.ts
   │     ├──▶ vite build            → bundles JS, processes CSS
   │     │     │
   │     │     ├──▶ React islands  → dist/_astro/<calculator>.<hash>.js
   │     │     └──▶ CSV ?raw        → inlined into shared chunk
   │     │
   │     └──▶ render pages          → dist/<route>/index.html (409 files)
   │
   └──▶ node scripts/build-sitemap.cjs
         │
         └──▶ walks dist/ → emits dist/sitemap.xml (408 URLs)
```

Vercel uploads the `dist/` directory verbatim. No edge functions, no SSR runtime, no node server. Pure static hosting with aggressive caching.

---

## Data flow at runtime (a calculator interaction)

1. Visitor lands on `/heat-pump-cost-tx/`
2. Vercel serves the pre-rendered HTML (~30 KB gzipped)
3. Browser parses HTML, fires `gtag('config', 'G-5CMBX2RBY4')` for GA4
4. Cookie banner script checks `localStorage.ec_consent_v1` — if absent, shows banner
5. `<HeatPumpCalculator client:load initialState="TX" />` triggers React hydration
6. React loads `dist/_astro/HeatPumpCalculator.<hash>.js` + the shared chunk with CSV data
7. Component initializes state with `useState('TX')` (because `initialState='TX'` passed in)
8. User changes scenario / panel / sqft / fuel inputs
9. `useMemo` re-runs `runCalculator({ state: 'TX', scenario: '...', ... })`
10. Engine reads CSVs (already in memory) → computes gross/net/itemized/incentives/payback
11. `ResultPanel` renders the result; `useEffect` fires `gtag('event', 'calculator_used', {...})`
12. User clicks "Share estimate" → `useHashStateSync()` writes inputs to URL hash
13. Recipient pastes the URL → same calculator hydrates with the encoded inputs

---

## Performance characteristics

| Metric | Target | Status |
|---|---|---|
| LCP (homepage) | < 2.5s | ✅ Hero image is AVIF, preloaded |
| LCP (calculator pages) | < 2.5s | ⚠ Calc page hero ~250 KB; OK on broadband, marginal on slow 4G |
| INP | < 200ms | ✅ React hydration is the bottleneck; well under |
| CLS | < 0.1 | ✅ `<picture>` elements have explicit width/height; ad slot reserved with min-height |
| JS bundle (per calc page) | < 200 KB transferred | ⚠ ~250 KB transferred currently (104 KB CSVs + 130 KB React + calc component) — Phase 3 candidate |
| Sitemap URLs | 400+ | ✅ 408 |
| Indexable pages | ≥ 400 | ✅ 409 built; ~408 indexable (excluding 404) |

---

## Federal credit & rebate evolution model

Federal credits and rebates change frequently. The engine handles this without code edits:

- `data/csv/federal-credits.csv` and `data/csv/rebate-programs.csv` have `expiration_date` columns
- `calc.ts` checks `today >= expiration_date` per program and either applies the incentive (`applied[]`) or surfaces it as potential (`potential[]`) or excludes it entirely
- `asOf` arg on `runCalculator()` lets tests pin a historical date for deterministic assertions

When a federal law changes (e.g., OBBBA's 2025-07-04 acceleration of multiple credit expirations), the fix is to update the `expiration_date` column in the CSV — no engine changes required.

---

## When NOT to add complexity

This site deliberately avoids:

- **A server runtime.** Adding SSR or edge functions would mean a runtime to maintain. Static + cache is enough for 100% of current use cases.
- **A database.** CSVs are the database. They version in git, diff in PRs, edit in Google Sheets, and audit by reading a file. SQL would be heavier with worse audit ergonomics.
- **A CMS.** Astro pages and CSVs together cover everything a CMS would. A WordPress / Sanity / Contentful integration would add cost and complexity for marginal editor convenience.
- **A backend API.** Calculator math runs in the browser. There's no server "/api/" endpoint, no rate limiting needed, no auth, no DB queries.
- **An auth layer.** No accounts. No saved estimates per user (the URL hash IS the saved estimate).

If a future feature seems to require any of the above, first ask whether it can be a static page + CSV + client-side React. The answer is usually yes.
