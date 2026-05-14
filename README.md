# ElectrifyCost.com

Source-backed home electrification cost calculators for U.S. homeowners.

## What this is

A calculator-first site that estimates planning-level installed cost ranges for switching from gas, oil, propane, or older electric systems to electric alternatives — heat pumps, EV chargers, electrical panel upgrades, heat pump water heaters, and induction ranges.

The site is deliberately not a lead-gen funnel: no contact forms, no email gate, no contractor marketplace. The goal is trust, SEO, and usefulness first; monetization later.

## Stack

- [Astro](https://astro.build) for static-first rendering with React Islands
- React + TypeScript for the interactive calculator components
- Tailwind CSS for styling
- CSV/JSON data files for cost ranges, rebates, energy prices, and labor multipliers — every numeric table lives under `data/csv/` (see [`data/csv/README.md`](data/csv/README.md))

Astro ships near-zero JavaScript by default; only the calculator islands hydrate, which keeps Core Web Vitals strong.

## Where the numbers live

Every "database of numbers" — pricing tables, state multipliers, IRA / HEEHRA tables, EV-charger / heat-pump / HPWH cost ranges, plus the model multipliers and operating-cost constants — is a CSV under `data/csv/`. Open any of them in Google Sheets, edit, then download as CSV back to the same path. The build will fail fast if a table loads zero rows (see `requireRows()` in `src/lib/data.ts`). Per-column docs and editing checklist live in [`data/csv/README.md`](data/csv/README.md).

There are no duplicate copies of these numbers in TS/JS. The runtime reads CSVs at build time via Vite's `?raw` query (which uses Node `fs` under the hood); the smoke-test reads them directly with `fs.readFileSync`.

### CSVs in `data/csv/`

- `project-cost-ranges.csv` — 25 cost scenarios across 5 modules (equipment / labor hours / permit bands).
- `state-labor-multipliers.csv` — 51 rows; electrician / HVAC / plumber multipliers vs. U.S. average; permit-fee average.
- `state-energy-prices.csv` — 51 rows; retail electricity, natural gas, propane, heating oil prices.
- `rebate-programs.csv` — 22 federal / state / utility programs (25C, 30C, HEEHRA, NYSERDA, Mass Save, TECH CA, ...).
- `climate-zones.csv` — 51 rows; IECC zone, HDD/CDD, heat-pump class.
- `panel-upgrade-risk-rules.csv` — 18 probability-of-upgrade rules indexed by `module × current_panel`.
- `cost-multipliers.csv` *(new)* — difficulty / home_type / timing factor bands.
- `module-labor-rates.csv` *(new)* — hourly labor rate by module.
- `panel-risk-factors.csv` *(new)* — probability-weighted upgrade factors per `risk_level` (with low/high spread).
- `addons-bands.csv` *(new)* — ductwork repair, HPWH tight-space + removal, induction 240V circuit / gas-cap / cookware.
- `operating-cost-constants.csv` *(new)* — physics constants for the operating-cost model: heat-pump UA factor, COPs, oversize factors, BTU conversions, HPWH baselines, EV kWh + gasoline anchor, induction baseline savings, uncertainty spreads.

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
│   ├── smoke-test.cjs         # Plain-Node sanity check for calculator math
│   └── smoke-cases.json       # 13 test scenarios across all 5 calculators
└── src/
    ├── components/
    │   ├── Layout.astro       # Page shell, SEO meta, JSON-LD
    │   ├── Header.astro
    │   ├── Footer.astro
    │   ├── ResultPanel.tsx    # Shared low/mid/high results UI
    │   ├── PanelCalculator.tsx
    │   ├── HeatPumpCalculator.tsx
    │   ├── EvChargerCalculator.tsx
    │   ├── HpwhCalculator.tsx
    │   └── InductionCalculator.tsx
    ├── data/                  # Text/copy JSON only — numeric tables live in /data/csv/
    │   ├── contractor-checklists.json
    │   ├── glossary.json
    │   └── source-notes.json
    ├── lib/
    │   ├── calc.ts            # Shared calculator engine
    │   ├── data.ts            # CSV/JSON loaders + lookups
    │   ├── format.ts          # Currency / time formatters
    │   └── analytics.ts       # Event-emitter stub for Plausible/GA4
    ├── pages/
    │   ├── index.astro
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

To smoke-test the math without installing dependencies:

```bash
node scripts/smoke-test.cjs
```

## What's done in this build

- Project scaffold, design system, and routing for all v1 pages
- Full data model: 8 files; 50 states + DC; 25 cost scenarios; 22 rebate programs
- Shared calculator engine with state labor multipliers, panel-risk weighting, incentive stacking (federal + state + utility), operating-cost change vs. current fuel, and simple payback
- **All 5 v1 calculators wired end-to-end:** heat pump, EV charger, electrical panel upgrade, heat pump water heater, induction stove
- Homepage hub, methodology page, sources page, dynamic rebates page, 404 page
- **Programmatic state pages**: `/heat-pump-cost-{state}/` for all 50 states + DC, each with state-specific energy prices, climate zone, labor multiplier, and rebates table
- SEO metadata, canonical URLs, FAQPage + WebApplication JSON-LD per calculator, auto-generated sitemap via `@astrojs/sitemap`
- Empty `.ad-slot` containers reserved in layout so Mediavine/AdSense can be added later without breaking Core Web Vitals
- Privacy-first analytics stub at `src/lib/analytics.ts` (events list matches the build prompt; no-op until a provider is wired in)
- Vercel deploy config at `vercel.json` (clean URLs, security headers, asset cache rules)
- Print-friendly result UI with `Header`/`Footer` hidden on print
- A11y: `aria-live="polite"` on result region, labeled form inputs throughout
- Smoke-test harness at `scripts/smoke-test.cjs` (run via `npm test`); 13 representative scenarios across all 5 calculators

## Roadmap (suggested)

1. **Programmatic state pages for the other modules** — clone `heat-pump-cost-[state].astro` for EV charger, panel, HPWH, and induction. That's another ~200 long-tail SEO pages with near-zero marginal cost.
2. **Embeddable widget** — single-script `<iframe>` distribution so utility/HVAC sites can embed a calculator. Each embed is a backlink and a brand impression.
3. **Save-your-estimate via URL** — encode inputs in a query string so users can bookmark/share without an account.
4. **Real OG image** — design a 1200×630 PNG for social previews and pass it via `Layout.ogImage`.
5. **Live rebate refresh** — replace the seed rebate CSV with a quarterly review process, or back it with the DSIRE / AFDC feeds where available.
6. **Comparison mode** — heat pump vs. furnace replacement over 15 years, sticky and shareable.
7. **Affiliate sidebar** — vetted equipment picks (charger hardware, induction ranges, smart panels) clearly labeled as affiliate.
8. **Wire analytics** — pick Plausible (privacy-first, ~$9/mo) or self-host Plausible/Pirsch. The `track()` calls in `src/lib/analytics.ts` are already wired to detect both.

## Monetization notes

The site is built so monetization can be layered in without redesign:

- `.ad-slot` placeholders are in the page layout; drop in Mediavine/Raptive at the right traffic threshold.
- Result component has a clean place to add a "Recommended equipment" panel (affiliate disclosure required).
- `/rebates/` and per-state pages are the highest-volume search entry points; reserve 1–2 slots above the fold for partner cards if/when lead-gen is added.
- All data (incl. rebate amounts) is in CSV/JSON, so building an affiliate-product database that joins to state + module is a few hours of work.

Realistic v1 economics, for reference: home improvement display ads run $20–$50 RPM at scale, EV charger leads are worth $30–$80 each, panel upgrade leads $50–$150, heat pump installs $50–$300. The "no funnel in v1" stance protects ranking and trust until you have enough volume to charge premium rates.

## Disclaimers

These are planning ranges, not contractor quotes. Actual prices depend on your home, local labor rates, equipment selection, code requirements, utility rules, and contractor availability. Rebate eligibility varies; always verify with the program administrator.

Last reviewed: May 2026.
