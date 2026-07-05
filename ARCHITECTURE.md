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
              │  (dist/ — 701 HTML pages, ~5 MB JS)  │
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

### 2. Shared engine for flagships + pure compute modules for the rest

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

**27 bespoke calculators** (mini-split, geothermal, AC, ductwork, windows, solar, battery, etc.) now compute through **pure modules in `src/lib/calcs/<slug>.ts`** (with shared `types.ts` and `flagship-tiers.ts`) rather than inline component math. The component calls the module's exported compute function; the same functions are exercised headlessly by `scripts/build-scenario-bands.cjs` (see §5) and mirror-tested. Only **5 analysis calculators** (WholeHome, EvTco, SolarPayback, EvChargingCost, HvacRepairReplace) still do their math inline in the component.

**Why the split:** the flagship engine shares a unified energy-conversion math surface; forcing every calculator through it would mean generalizing to cooling-only / solar-with-NEM / per-watt costing / per-window costing scenarios. Extracting the bespoke calculators into standalone pure modules (rather than leaving them inline) is what lets `build-scenario-bands.cjs` run their real compute functions at build time, so the Project Simulator's published bands can never drift from the live calculator.

**Result-panel consistency:** the flagships use `ResultPanel.tsx`. The bespoke and analysis calculators each render their own result UI. **Future work:** promote `ResultPanel` more broadly.

### 3. Static-first with React islands

Astro renders each page to static HTML at build time. The five flagship calculator pages contain a hydrated React component (`<HeatPumpCalculator client:load />`); everything else on the page is static HTML.

**Why:**
- Core Web Vitals stay strong — no JS frameworks loading on hub/state/guide pages
- Each page is independently cacheable at Vercel's edge with `Cache-Control: max-age=31536000, immutable`
- New pages don't bloat the bundle — adding 200 state pages added 0 KB to the client JS

**The catch:** when a calculator hydrates, it has to re-fetch the full CSV bundle to compute. That's the 104 KB cost mentioned in §1.

### 4. Programmatic SEO dimensions + the routing rule

The site scales URL count by multiplying a calculator across **dimensions**. As of 2026-07 there are four live dimensions (701 built pages):

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

The dimensions compose: state × module = 357 pages, city × module = 200, brand × module = 22, size × module = 10. Each dimension is one template (or a few static files) + one CSV. This is the core growth lever — most of the 701 pages came from ~10 template files.

### 5. The Monte Carlo simulation layer

A probabilistic cost layer sits on top of the deterministic engine. `src/lib/montecarlo.js` (ported math-identical from ProjectCostPro) turns a calculator's installed-cost line items into a *distribution* via triangular per-item draws tied by a one-factor Gaussian copula (ρ=0.5). It powers two surfaces:

- **Per-calculator inline sim** (`MonteCarloSim.tsx`) — embedded in `ResultPanel` (flagships) + 27 bespoke calculators. Models gross installed cost; shows P10 / most-likely / P90 + a streaming density curve + sourced "surprise" events. The published band is a faint reference only — nothing is relabeled.
- **The Project Simulator** (`/project-simulator/`, `ProjectSimulator.tsx`) — a **v2 instance model**: an ordered plan of project instances (Duplicate, not an ×N stepper), a plan workspace above the results, a **median (P50)** combined-cost headline, CSV export, and a branded print report. It combines the instances' bands into one distribution (the portfolio effect: tighter than the naive low+low / high+high sum), with ZIP → state regional pricing and a "Custom" read-back that opens a calculator in an `?embed=1` iframe popup and reads its estimate back via the v2 snapshot contract in `src/lib/estimate-snapshot.ts` (`ec:est:<slug>`). Share URLs use the codec in `src/lib/sim-codec.ts` and **fail closed** with visible notices on a bad decode.

**The per-project bands are GENERATED, not curated.** `src/data/scenario-projects.json` is produced by `scripts/build-scenario-bands.cjs`, which esbuild-bundles `scripts/band-entry.ts` (resolving the same `?raw` CSV imports Vite resolves) and runs the **real** calculator compute functions headlessly at national labor. So a published band can never drift from what the live calculator computes. **Hand-editing the JSON is forbidden**; the drift gate `build-scenario-bands.cjs --check` is stage 9 of `npm test`.

Pure client-side (no server), shares the static-island model, and is gated by its own calibration test (`scripts/test-montecarlo.cjs`, 39 assertions), the share-URL codec round-trip test (`scripts/test-sim-state.cjs`), the generated-bands drift gate, and a data validator (`scripts/validate-risk-events.cjs`). Full v1 design record + the slug/no-double-counting/ZIP-prefill rules: `.claude/lessons/11-monte-carlo-simulation.md` (superseded 2026-07-04 by the v2 instance model + generated bands).

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
│   └── assets/topic-images/    — 38 hero photos × (AVIF + WebP + JPG)
├── data/csv/                   — 51 CSVs (THE source of truth)
├── scripts/
│   ├── build-sitemap.cjs       — postbuild: walks dist/ → emits sitemap.xml
│   ├── validate-csvs.cjs       — pre-test: CSV schema + status-enum check
│   ├── validate-risk-events.cjs — pre-test: sanity + sourcing guard on risk-events.json
│   ├── validate-pages.cjs      — pre-test: Layout open/close + JSX traps
│   ├── validate-content.cjs    — pre-test: banned-string guard (stale incentives, AI-slop)
│   ├── smoke-test.cjs          — 13 + 9 assertion runs against the flagship engine
│   ├── new-calc-tests.cjs      — 29 assertion runs for bespoke-calculator math
│   ├── test-montecarlo.cjs     — 39 assertions: Monte Carlo calibration gate
│   ├── test-sim-state.cjs      — share-URL codec round-trip (sim-codec.ts)
│   ├── build-scenario-bands.cjs — regenerates scenario-projects.json; --check is the drift gate
│   ├── band-entry.ts           — esbuild entry the band generator bundles + runs headlessly
│   └── check-links.cjs         — external citation link checker
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
    │   ├── MonteCarloSim.tsx   — per-calculator Monte Carlo sim island
    │   ├── ProjectSimulator.tsx — combined /project-simulator/ tool (v2 instance model)
    │   └── 37 *Calculator.tsx  — 5 flagship + 32 bespoke (27 compute via src/lib/calcs/, 5 analysis inline)
    ├── lib/
    │   ├── calc.ts             — shared engine for the 5 flagships (runCalculator)
    │   ├── calcs/              — 27 bespoke compute modules + types.ts + flagship-tiers.ts (29 files)
    │   ├── data.ts             — CSV loaders + lookup helpers
    │   ├── format.ts           — fmtUSD / fmtUSDRange / fmtMonths
    │   ├── use-url-state.ts    — hash-state hooks for shareable inputs
    │   ├── montecarlo.js       — probabilistic cost engine (verbatim math)
    │   ├── mc-chart.ts         — shared sim chart + money/smooth/domainFor
    │   ├── estimate-snapshot.ts — v2 calculator→simulator snapshot (ec:est:<slug>)
    │   ├── sim-codec.ts        — Project Simulator share-URL codec
    │   └── guide-relationships.ts — 37 guide siblings + calculator hrefs
    ├── data/
    │   ├── contractor-checklists.json
    │   ├── glossary.json
    │   ├── risk-events.json    — Monte Carlo "surprise" events by slug
    │   ├── scenario-projects.json — GENERATED by build-scenario-bands.cjs (do not hand-edit)
    │   └── source-notes.json   — 200+ primary-source entries
    ├── pages/                  — 135 .astro files → 701 built HTML pages
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
   │     └──▶ render pages          → dist/<route>/index.html (701 files)
   │
   └──▶ node scripts/build-sitemap.cjs
         │
         └──▶ walks dist/ → emits dist/sitemap.xml (~700 URLs)
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
| Sitemap URLs | 400+ | ✅ ~700 |
| Indexable pages | ≥ 400 | ✅ 701 built; ~700 indexable (excluding 404) |

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
