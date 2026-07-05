# ElectrifyCost.com

Source-backed home electrification cost calculators for U.S. homeowners.

## What this is

A calculator-first site that estimates planning-level installed cost ranges for switching from gas, oil, propane, or older electric systems to electric alternatives — heat pumps, EV chargers, electrical panel upgrades, heat pump water heaters, and induction ranges.

A **Monte Carlo cost simulation** layers on top: a probabilistic P10 / most-likely / P90 distribution inline on every calculator, plus a combined **[Project Simulator](https://electrifycost.com/project-simulator/)** that rolls 10,000 scenarios across multiple projects with ZIP-based regional pricing. Design notes: [`.claude/lessons/11-monte-carlo-simulation.md`](.claude/lessons/11-monte-carlo-simulation.md).

The site is deliberately not a lead-gen funnel: no contact forms, no email gate, no contractor marketplace. The goal is trust, SEO, and usefulness first; monetization later.

## Stack

- [Astro](https://astro.build) for static-first rendering with React Islands
- React + TypeScript for the interactive calculator components
- Tailwind CSS for styling
- CSV/JSON data files for cost ranges, rebates, energy prices, and labor multipliers — all 51 numeric tables live under `data/csv/` (see [`data/csv/README.md`](data/csv/README.md))

Astro ships near-zero JavaScript by default; only the calculator islands hydrate, which keeps Core Web Vitals strong.

## Where the numbers live

Every "database of numbers" — pricing tables, state multipliers, IRA / HEEHRA tables, EV-charger / heat-pump / HPWH cost ranges, plus the model multipliers and operating-cost constants — is a CSV under `data/csv/`. Open any of them in Google Sheets, edit, then download as CSV back to the same path. The build will fail fast if a table loads zero rows (see `requireRows()` in `src/lib/data.ts`). Per-column docs and editing checklist live in [`data/csv/README.md`](data/csv/README.md).

There are no duplicate copies of these numbers in TS/JS. The runtime reads CSVs at build time via Vite's `?raw` query (which uses Node `fs` under the hood); the smoke-test reads them directly with `fs.readFileSync`.

### CSVs in `data/csv/` (51 files)

The 51 CSVs are the single source of truth for every number. A representative slice:

- `project-cost-ranges.csv` — 25 cost scenarios across 5 flagship modules (equipment / labor hours / permit bands).
- `state-labor-multipliers.csv` — 51 rows; electrician / HVAC / plumber multipliers vs. U.S. average; permit-fee average.
- `state-energy-prices.csv` — 51 rows; retail electricity, natural gas, propane, heating oil prices.
- `rebate-programs.csv` — federal / state / utility programs (25C, 30C, HEEHRA, NYSERDA, Mass Save, TECH CA, ...).
- `climate-zones.csv` — 51 rows; IECC zone, HDD/CDD, heat-pump class.
- `federal-credits.csv` — 25C, 25D, 30C, 30D, 25E with current OBBBA expiration status (all expired as of 2026-07-04).
- `panel-upgrade-risk-rules.csv` — probability-of-upgrade rules indexed by `module × current_panel`.
- `cost-multipliers.csv` — difficulty / home_type / timing factor bands.
- `module-labor-rates.csv` — hourly labor rate by module.
- `panel-risk-factors.csv` — probability-weighted upgrade factors per `risk_level` (with low/high spread).
- `addons-bands.csv` — ductwork repair, HPWH tight-space + removal, induction 240V circuit / gas-cap / cookware.
- `operating-cost-constants.csv` — physics constants for the operating-cost model: heat-pump UA factor, COPs, oversize factors, BTU conversions, HPWH baselines, EV kWh + gasoline anchor, induction baseline savings, uncertainty spreads.
- …plus ~39 more module-specific cost/range CSVs consumed by the bespoke calculators.

## Project structure

```
electrifycost/
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
├── vercel.json                # Clean URLs, security headers, cache rules
├── DEPLOY.md                  # Step-by-step Vercel deploy guide
├── .env.example
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── scripts/
│   ├── smoke-test.cjs         # Plain-Node sanity check for the flagship engine
│   ├── new-calc-tests.cjs     # Formula assertions for the bespoke calculators
│   ├── test-montecarlo.cjs    # Monte Carlo calibration gate
│   ├── test-sim-state.cjs     # Share-URL codec round-trip test
│   ├── build-scenario-bands.cjs # Regenerates src/data/scenario-projects.json (--check drift gate)
│   ├── band-entry.ts          # esbuild entry the band generator bundles + runs headlessly
│   ├── build-sitemap.cjs      # POSTBUILD: walks dist/ → emits sitemap.xml
│   ├── validate-*.cjs         # CSV / page / content / risk-event validators
│   └── smoke-cases.json       # calculator scenarios for the smoke-test
└── src/
    ├── components/
    │   ├── Layout.astro       # Page shell, SEO meta, JSON-LD, GA4
    │   ├── Header.astro
    │   ├── Footer.astro
    │   ├── ResultPanel.tsx    # Shared low/mid/high results UI (5 flagships)
    │   ├── MonteCarloSim.tsx  # Per-calculator Monte Carlo sim island
    │   ├── ProjectSimulator.tsx # Combined /project-simulator/ tool (v2 instance model)
    │   ├── PanelCalculator.tsx
    │   ├── HeatPumpCalculator.tsx
    │   ├── EvChargerCalculator.tsx
    │   ├── HpwhCalculator.tsx
    │   ├── InductionCalculator.tsx
    │   └── …32 bespoke calculators (27 compute via src/lib/calcs/, 5 analysis calcs inline)
    ├── data/                  # Text/copy + generated JSON — numeric tables live in /data/csv/
    │   ├── contractor-checklists.json
    │   ├── glossary.json
    │   ├── risk-events.json           # Monte Carlo "surprise" events by slug
    │   ├── scenario-projects.json     # GENERATED by build-scenario-bands.cjs — do not hand-edit
    │   └── source-notes.json
    ├── lib/
    │   ├── calc.ts            # Shared engine for the 5 flagships (runCalculator)
    │   ├── calcs/             # 27 bespoke calculator compute modules + types.ts + flagship-tiers.ts
    │   ├── data.ts            # CSV/JSON loaders + lookups
    │   ├── format.ts          # Currency / time formatters
    │   ├── use-url-state.ts   # Hash-state hooks for shareable calculator URLs
    │   ├── montecarlo.js      # Probabilistic cost engine (verbatim math; ESM wrapper)
    │   ├── mc-chart.ts        # Shared sim chart + money/smooth/domainFor helpers
    │   ├── estimate-snapshot.ts # v2 calculator→simulator snapshot (ec:est:<slug>)
    │   ├── sim-codec.ts       # Project Simulator share-URL codec
    │   └── guide-relationships.ts # 37 guide-slug → siblings + calculator map
    ├── pages/                 # 135 .astro sources → 701 built HTML pages
    │   ├── index.astro
    │   ├── project-simulator.astro
    │   ├── electrical-panel-upgrade-cost-calculator.astro
    │   ├── heat-pump-cost-calculator.astro
    │   ├── heat-pump-cost-[state].astro             # 51 programmatic state pages
    │   ├── ev-charger-installation-cost-calculator.astro
    │   ├── heat-pump-water-heater-cost-calculator.astro
    │   ├── induction-stove-cost-calculator.astro
    │   ├── methodology.astro
    │   ├── sources.astro
    │   ├── rebates.astro
    │   └── 404.astro
    └── styles/global.css
```

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:4321>. Build with `npm run build`; preview with `npm run preview`.

### Static-server walk (zero deps)

For walking a built site or quickly serving the repo + CSVs over HTTP without `npm install`, use the bundled local server:

```bash
node local-server.js          # serves repo root on http://127.0.0.1:4173/
node local-server.js dist     # serve a built dist/ instead
PORT=8080 node local-server.js
```

It uses only Node built-ins (`http`/`fs`/`path`/`url`), serves correct MIME types for `.html`/`.js`/`.css`/`.csv`/`.json`/`.svg`/`.md`, sets permissive CORS headers, guards against `..` traversal, and renders directory listings when there's no `index.html`. It is intentionally separate from `astro dev` (which gives you HMR); this one is for static walks and CSV exposure.

## Calculator math

`src/lib/calc.ts` is the single source of truth. The public function `runCalculator()` takes a `CalcArgs` object and returns a `CalculatorResult` containing low/mid/high cost bands, an itemized breakdown, eligible incentives, optional payback, and a panel-risk verdict.

All three (low/mid/high) cost paths are computed independently — there's no flat-percentage trick around a midpoint.

```
gross_cost =
    base_project_cost
  × state_labor_multiplier
  × install_difficulty_multiplier
  × home_complexity_multiplier
  + permit_cost
  + panel_or_circuit_adder
  + removal_or_disposal_adder

net_cost = gross_cost − eligible_incentives
```

To smoke-test the flagship math without installing dependencies:

```bash
node scripts/smoke-test.cjs
```

The full gate is `npm test`, which runs nine stages in order: `validate-csvs`, `validate-risk-events`, `validate-pages`, `validate-content`, `smoke-test`, `new-calc-tests`, `test-montecarlo`, `test-sim-state`, and `build-scenario-bands --check` (the generated-bands drift gate). CI runs the same chain plus `npx tsc --noEmit` and `npm run build` on every push and PR.

## What's done in this build

- Project scaffold, design system, and routing across 701 built pages
- Full data model: 51 CSV files; 50 states + DC; cost scenarios across every module; federal + state + utility rebate programs
- Shared calculator engine (5 flagships) with state labor multipliers, panel-risk weighting, incentive stacking (federal + state + utility), operating-cost change vs. current fuel, and simple payback
- 27 bespoke calculators computing through pure modules in `src/lib/calcs/`; 5 analysis calculators (whole-home, EV TCO, solar payback, EV charging cost, HVAC repair-vs-replace) compute inline
- **All 5 flagship calculators wired end-to-end:** heat pump, EV charger, electrical panel upgrade, heat pump water heater, induction stove
- Homepage hub, methodology page, sources page, dynamic rebates page, 404 page
- **Programmatic state pages**: 51-per-module across heat pump, solar, EV, panel, HPWH, induction, and water heater, each with state-specific energy prices, climate zone, labor multiplier, and rebates table
- **Monte Carlo cost simulation**: inline P10 / most-likely / P90 sim on every calculator + a combined `/project-simulator/` tool (v2 instance model, median headline, ZIP-based regional pricing, CSV export, branded print report, share-URL codec)
- SEO metadata, canonical URLs, FAQPage + WebApplication JSON-LD per calculator, sitemap generated by the custom `scripts/build-sitemap.cjs` post-build step (NOT `@astrojs/sitemap`, which crashes against Astro 4.16)
- Empty `.ad-slot` containers reserved in layout so Mediavine/AdSense can be added later without breaking Core Web Vitals
- **Google Analytics 4** (`G-5CMBX2RBY4`) live with Consent Mode v2 + cookie banner; a `calculator_used` event fires when a valid result renders
- **Shareable calculator URLs** via hash-state hooks (`src/lib/use-url-state.ts`)
- Vercel deploy config at `vercel.json` (clean URLs, security headers, asset cache rules)
- Print-friendly result UI with `Header`/`Footer` hidden on print
- A11y: `aria-live="polite"` on result region, labeled form inputs throughout
- Nine-stage `npm test` gate (see above) run in CI on every push and PR

## Roadmap (suggested)

1. **Programmatic state pages for the remaining modules** that don't have them yet (AC, mini-split, geothermal, etc.) — clone `heat-pump-cost-[state].astro`. Near-zero marginal cost per page.
2. **Embeddable widget** — single-script `<iframe>` distribution so utility/HVAC sites can embed a calculator. Each embed is a backlink and a brand impression.
3. **Real OG image variants** — per-module 1200×630 PNGs for social previews.
4. **Live rebate refresh** — replace manual quarterly review with a script that flags rebate rows whose `last_reviewed` date is > 90 days old against the DSIRE / AFDC feeds where available.
5. **Comparison mode** — heat pump vs. furnace replacement over 15 years, sticky and shareable.
6. **Affiliate sidebar** — vetted equipment picks (charger hardware, induction ranges, smart panels) clearly labeled as affiliate.
7. **Migrate the bespoke calculators' remaining hardcoded cost tables to CSV** — the 27 extracted modules in `src/lib/calcs/` still hold some cost tables as TS objects; land them in CSV with `source_id` + `last_reviewed` behind output-snapshot regression tests. See `ROADMAP.md` Phase 4.

## Monetization notes

The site is built so monetization can be layered in without redesign:

- `.ad-slot` placeholders are in the page layout; drop in Mediavine/Raptive at the right traffic threshold.
- Result component has a clean place to add a "Recommended equipment" panel (affiliate disclosure required).
- `/rebates/` and per-state pages are the highest-volume search entry points; reserve 1–2 slots above the fold for partner cards if/when lead-gen is added.
- All data (incl. rebate amounts) is in CSV/JSON, so building an affiliate-product database that joins to state + module is a few hours of work.

Realistic v1 economics, for reference: home improvement display ads run $20–$50 RPM at scale, EV charger leads are worth $30–$80 each, panel upgrade leads $50–$150, heat pump installs $50–$300. The "no funnel in v1" stance protects ranking and trust until you have enough volume to charge premium rates.

## Disclaimers

These are planning ranges, not contractor quotes. Actual prices depend on your home, local labor rates, equipment selection, code requirements, utility rules, and contractor availability. Rebate eligibility varies; always verify with the program administrator.

Last reviewed: 2026-07-04.
