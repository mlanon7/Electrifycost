# CLAUDE.md — ElectrifyCost

This file is the working context for any AI assistant editing the repo. Read it before touching anything.

---

## What this is

**ElectrifyCost** is a calculator-first content site for U.S. home electrification cost estimation. 38 interactive calculators (heat pumps, solar, EV chargers, panel upgrades, water heaters, induction stoves, insulation, windows, generators, batteries, etc.) return **low / mid / high** installed-cost ranges with applicable rebates pre-applied.

A **Monte Carlo cost simulation** layers on top: an inline P10 / most-likely / P90 distribution on every calculator, plus a combined **Project Simulator** (`/project-simulator/`) that rolls 10,000 scenarios across multiple projects with ZIP-based regional pricing and a "Custom" calculator read-back. Full design: `.claude/lessons/11-monte-carlo-simulation.md`.

- **Live:** https://electrifycost.com
- **Repo:** https://github.com/mlanon7/Electrifycost
- **Owner:** Martin Lashgari, Ph.D., P.E., PMP (structural engineer; site is biographical disclosure on `/about/`)
- **Launched:** May 2026 (days-old domain — cold-start SEO posture)

### The deliberate market position

- **No funnel.** No email gate, no contact form, no contractor referral marketplace. Trust + SEO first; monetization layered in later.
- **Source-cited.** Every numeric input in the calculators is traceable to a primary source (IRS, DOE, EIA, BLS, NREL, LBNL, NEEP, ACCA, ENERGY STAR). 200+ sources listed at `/sources/`.
- **Planning ranges, not bids.** Estimates are calibrated to public benchmarks. The site repeatedly disclaims "verify with a licensed contractor."

### Why the differentiation matters

Competitors fall into three buckets: (1) lead-gen funnels (Modernize, Networx, Angi) that gate everything behind a form; (2) editorial content sites (Bob Vila, This Old House, Forbes Home) with shallower calculators; (3) brand-specific aggregators (EnergySage for solar). ElectrifyCost's edge is **interactive depth + transparent sourcing + no funnel**.

---

## Tech stack

- **Astro 4.15** — static-first rendering with React island hydration (`client:load` on calculators)
- **React 18.3 + TypeScript 5.5** — calculator islands
- **Tailwind 3.4** — utility-first styling. Brand palette: `brand-*` (emerald), `ink-*` (slate), `amber-*`/`rose-*` for warnings/errors. Defined in `tailwind.config.mjs`.
- **CSV-first data** — every numeric input lives in `data/csv/*.csv` (51 files). Loaded via Vite `?raw` imports at build time. NO duplicate numbers in TS/JS.
- **Vercel** — static deploy, clean URLs, trailing slashes, immutable cache headers, security headers. Config in `vercel.json`.
- **Self-hosted fonts** — Inter + Source Serif 4 via `@fontsource/*`. NO Google Fonts third-party fetch.
- **Custom sitemap script** — `scripts/build-sitemap.cjs` runs after `astro build` and walks `dist/` for `index.html` files. Outputs `dist/sitemap.xml` with ~696 URLs. Required because `@astrojs/sitemap` 3.1.6 crashed against Astro 4.16. **The xmlns must be `http://www.sitemaps.org/schemas/sitemap/0.9` (slash, not hyphen)** — see lessons/01.
- **Analytics:** GA4 (`G-5CMBX2RBY4`) with Consent Mode v2 + cookie banner. Wired in `Layout.astro` + `CookieBanner.astro`. `calculator_used` custom event fires from `ResultPanel.tsx` when a valid result renders.
- **Ahrefs MCP** — connected (the `mcp__...keywords-explorer-*`, `gsc-*`, `site-explorer-*`, `rank-tracker-*` tools). Use for keyword volume/difficulty, GSC query history, backlink + rank-tracking data. See `.claude/prompts/data-verification.md` and the keyword-research workflow.

---

## Page inventory (698 built pages as of 2026-06-24)

The site grew from 5 flagship calculators to 698 built HTML pages via **four programmatic-SEO dimensions** (plus the standalone `/project-simulator/` tool). Understand these before adding pages:

| Dimension | URL shape | Count | Template |
|---|---|---|---|
| **Calculators** | `/<module>-cost-calculator/` | 37 | one `.astro` per module |
| **Guides** | `/guides/<topic>/` | 37 | one per topic + RelatedGuides |
| **State** (heat pump, solar, EV, panel, HPWH, induction, water heater) | `/<module>-cost-<state>/` (prefix form) | 7 × 51 = 357 | `<module>-cost-[state].astro` |
| **City** (heat pump, HPWH) | `/heat-pump-cost/<city>/` (SUBPATH) | 2 × 100 = 200 | `heat-pump-cost/[city].astro` |
| **Size — sqft** (heat pump) | `/heat-pump-cost-<n>-sqft/` (static) | 5 | individual static files |
| **Size — tonnage** (heat pump) | `/heat-pump-cost-<n>-ton/` (prefix, static) | 5 | individual static files |
| **Brand** (HP, HPWH, EV, battery) | `/<brand>-<module>-cost/` (SUFFIX form) | 22 | `[brand]-<module>-cost.astro` |
| **Per-amp panel** | `/100a-to-200a-panel-upgrade-cost/` etc. | 4 | individual static files |
| **By-state / by-city hubs** | `/<module>-cost-by-state/`, `/-by-city/` | 7 + 2 = 9 | individual static files |
| **Comparison** | `/<a>-vs-<b>/` | ~8 | individual static files |
| **Intent** (replacement) | `/heat-pump-replacement-cost/` | 1 | individual static file |
| **Legal** | `/privacy/`, `/terms/` | 2 | individual static files |

**Routing rule (critical — see lessons/08):** to avoid collisions with the greedy `<module>-cost-[state]` dynamic route (which matches any `/<module>-cost-<x>/`):
- **State / sqft / tonnage** use **prefix form** (`heat-pump-cost-X`) as STATIC files — Astro static-priority lets them coexist with `[state]`.
- **City** uses a **SUBPATH** (`heat-pump-cost/[city]`) — distinct from the hyphenated prefix routes.
- **Brand** uses **SUFFIX form** (`X-heat-pump-cost`) as a dynamic `[brand]-...` route — a different URL shape that never overlaps the prefix routes.

---

## Project structure

```
electrifycost/
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json                        — scripts: dev / build / preview / test
├── vercel.json                         — clean URLs, cache headers
├── DEPLOY.md
├── README.md
├── CLAUDE.md                           — you are here
├── .env.example
├── .github/workflows/ci.yml            — runs validators + tests + build on every PR/push
├── public/
│   ├── favicon.svg
│   ├── og-default.png
│   ├── robots.txt                      — Sitemap: /sitemap.xml + GPTBot/ClaudeBot Allow
│   ├── brand/                          — logo1.png (556×102, ≤19KB)
│   └── assets/topic-images/            — 38 hero photos × (AVIF + WebP + JPG) = 114 files, each ≤85KB
├── data/csv/                           — 51 CSVs; SINGLE source of truth for numbers
│                                          (incl. top-cities.csv, brand-profiles.csv)
│   ├── README.md                       — per-column docs + edit checklist
│   ├── project-cost-ranges.csv         — 25 cost scenarios across 5 modules
│   ├── state-labor-multipliers.csv     — 51 rows (50 states + DC)
│   ├── state-energy-prices.csv         — 51 rows
│   ├── rebate-programs.csv             — federal + state + utility programs
│   ├── climate-zones.csv               — IECC zones + HDD + heat-pump class per state
│   ├── operating-cost-constants.csv    — physics constants (COP, UA, BTU conversions)
│   ├── federal-credits.csv             — 25C, 25D, 30C, 30D, 25E with current OBBBA status
│   ├── home-energy-rebate-status.csv   — HEEHRA per-state rollout status
│   └── ...39 more module-specific files
├── scripts/
│   ├── build-sitemap.cjs               — POSTBUILD: walks dist/ → emits sitemap.xml (~696 URLs)
│   ├── validate-csvs.cjs               — pre-test: all 51 CSVs schema-checked (source_id resolves, ISO dates)
│   ├── validate-pages.cjs              — pre-test: Layout open/close balance + JSX-trap detection
│   ├── validate-content.cjs            — pre-test: banned-string guard (stale incentives, wrong credit codes, AI-slop)
│   ├── smoke-test.cjs                  — 13 scenarios + 9 targeted assertion groups
│   ├── new-calc-tests.cjs              — 29 formula assertions for non-flagship calculators
│   ├── validate-risk-events.cjs        — pre-test: sanity + sourcing guard on risk-events.json
│   ├── test-montecarlo.cjs             — 39 assertions: Monte Carlo calibration gate (in npm test)
│   ├── smoke-cases.json                — input matrix for smoke-test
│   ├── audit-scan.cjs                  — POSTBUILD manual: meta/title length, orphans, trailing-slash links
│   ├── contrast-check.cjs              — WCAG AA contrast check on the ink/brand palette
│   ├── recompress-images.cjs           — manual one-off: re-encode hero photos to ≤85KB (sharp; AVIF/WebP/JPG)
│   └── indexnow-submit.cjs             — manual: POST new/changed URLs to IndexNow (Bing). Key file in public/
└── src/
    ├── components/
    │   ├── Layout.astro                — site shell, meta, JSON-LD schemas, GA4
    │   ├── Header.astro                — sticky nav, 5 dropdown categories + Guides + Rebates
    │   ├── Footer.astro                — 5-col footer (Calculators / Trust / Legal), "Data last refreshed" stamp
    │   ├── CookieBanner.astro          — Consent Mode v2 accept/decline UI
    │   ├── ResultPanel.tsx             — shared low/mid/high result UI for the 5 flagships
    │   ├── RelatedGuides.astro         — uniform "Related guides" footer on every /guides/X page
    │   ├── AdSlot.astro                — gated by PUBLIC_ADS_ENABLED env; reserves min-height
    │   ├── AffiliateDisclosure.astro   — gated by PUBLIC_AFFILIATES_ENABLED
    │   ├── AffiliateModule.astro       — gated by PUBLIC_AFFILIATES_ENABLED; per-module slot
    │   ├── HeatPumpCalculator.tsx      — 5 flagships use shared engine + ResultPanel
    │   ├── EvChargerCalculator.tsx
    │   ├── PanelCalculator.tsx
    │   ├── HpwhCalculator.tsx
    │   ├── InductionCalculator.tsx
    │   ├── 33 non-flagship calculators — bespoke math, own result UI
    │   ├── MonteCarloSim.tsx           — per-calculator Monte Carlo sim island (inline on every calc)
    │   └── ProjectSimulator.tsx        — combined /project-simulator/ tool (picker + result + iframe popup)
    ├── lib/
    │   ├── calc.ts                     — SHARED ENGINE: runCalculator(args): CalculatorResult
    │   ├── montecarlo.js               — probabilistic cost engine (verbatim math; ESM wrapper)
    │   ├── mc-chart.ts                 — shared sim chart + money/smooth/domainFor helpers
    │   ├── data.ts                     — CSV loaders + lookup helpers. Key exports:
    │   │                                 ALL_STATES, findStateLabor/Energy/Climate,
    │   │                                 ALL_CITIES + findCity + stateName (city pages),
    │   │                                 BRAND_PROFILES + brandsByCategory (brand pages)
    │   ├── format.ts                   — fmtUSD / fmtUSDRange / fmtMonths
    │   ├── use-url-state.ts            — hash-state hooks for shareable calculator URLs
    │   └── guide-relationships.ts      — 37 guide-slug → siblings + calculator map
    ├── data/
    │   ├── contractor-checklists.json  — 5 modules × ~10 questions each
    │   ├── glossary.json               — 30 terms in 7 categories
    │   ├── risk-events.json            — Monte Carlo "surprise" events keyed by calculator slug
    │   ├── scenario-projects.json      — Project Simulator per-project tiers + cost mix
    │   └── source-notes.json           — 200+ source entries with last_reviewed dates
    ├── pages/                          — 132 .astro pages; 698 built HTML pages
    │   ├── index.astro                 — homepage + 38 calculator cards
    │   ├── project-simulator.astro     — the combined Project Simulator tool page
    │   ├── about.astro                 — founder bio (E-E-A-T critical)
    │   ├── methodology.astro
    │   ├── sources.astro
    │   ├── rebates.astro
    │   ├── glossary.astro
    │   ├── privacy.astro                            — privacy policy (legal; ad-network requirement)
    │   ├── terms.astro                              — terms of use (legal; ad-network requirement)
    │   ├── 404.astro
    │   ├── <module>-cost-calculator.astro  × 37     — flagship calculator pages
    │   ├── water-heater-installation-cost-[state].astro  — 51 programmatic state pages + by-state hub
    │   ├── heat-pump-replacement-cost.astro         — replacement-intent page
    │   ├── heat-pump-cost-[state].astro             — 51 programmatic state pages
    │   ├── solar-panel-cost-[state].astro           — 51 programmatic state pages
    │   ├── ev-charger-installation-cost-[state].astro     — 51 pages
    │   ├── electrical-panel-upgrade-cost-[state].astro    — 51 pages
    │   ├── heat-pump-water-heater-cost-[state].astro      — 51 pages
    │   ├── induction-stove-cost-[state].astro             — 51 pages
    │   ├── heat-pump-cost-{1000|1500|2000|2500|3000}-sqft.astro — 5 sqft pages
    │   ├── 100a-to-200a-panel-upgrade-cost.astro    — per-amp pages
    │   ├── 200a-to-400a-panel-upgrade-cost.astro
    │   ├── subpanel-cost.astro
    │   ├── load-management-vs-panel-upgrade.astro
    │   ├── <module>-vs-<module>.astro × ~8           — comparison pages
    │   ├── *-cost-by-state.astro × 6                 — by-state hub pages
    │   └── guides/                                   — 37 long-form guide pages
    └── styles/
        └── global.css                  — Tailwind base + components + .eyebrow, .guide-prose, .guide-toc utilities
```

---

## How the engine works (`src/lib/calc.ts`)

The shared calculator engine for the 5 flagship modules (heat pump, EV charger, panel, HPWH, induction):

```
gross = base × difficultyMultiplier × homeTypeMultiplier × timingMultiplier
      + circuitAdder + removalAdder + ductworkPenalty + tightSpacePenalty + panelAdder

  where base = materialCost + (laborHours × hourlyRate × stateLaborMultiplier) + permitCost

net = gross − sum(eligibleIncentives)
```

All three bands (low / mid / high) compute independently — no flat-percentage trick around a midpoint.

Operating-cost change (heating/cooling/water/EV) layered separately via HDD × UA × COP and AFDC anchors.

Returns a `CalculatorResult` with: `gross`, `netAfterIncentives`, `itemized[]`, `incentives[]`, `potentialIncentives[]`, `panelRisk?`, `annualOperatingChange?`, `monthlyEnergyImpact?`, `simplePaybackMonths?`, `sourceIds[]`, `reviewedAt`, `caveats[]`.

### Where the 33 non-flagship calculators differ

They each do their own `useMemo` math directly in the component (no shared engine). This is fine but means result-panel styling and conversion-event firing varies. Future work: promote `ResultPanel` to all 38 calculators.

---

## Monte Carlo cost simulation (`src/lib/montecarlo.js`)

A probabilistic layer on top of the deterministic engine. **Ported math-identical from ProjectCostPro** (the sister site) — only the module wrapper differs (ESM here vs UMD there). Each installed-cost line item is sampled from a **triangular** distribution (mode skewed 40% up), the items are tied by a **one-factor Gaussian copula** (ρ=0.5), and surprise events add a beta-PERT right tail. **Calibration constants are load-bearing** (`modeSkew 0.40`, `rho 0.5`, `TRIALS 10000`); `scripts/test-montecarlo.cjs` (39 assertions, in `npm test`) is the gate — do not retune without keeping it green.

Two surfaces, both client-side:

- **Per-calculator inline sim** — `src/components/MonteCarloSim.tsx` (chart helpers in `src/lib/mc-chart.ts`). Renders P10 / most-likely / P90 + a streaming SVG density curve + a sourced "real-world surprises" toggle. Models **gross installed cost**, markup 1:1. Embedded once in `ResultPanel.tsx` (covers all 5 flagships + their programmatic pages) and on 27 bespoke calculators. The published band is shown only as a faint reference — **nothing is relabeled.**
- **The Project Simulator** — `/project-simulator/` (`src/components/ProjectSimulator.tsx` + `src/data/scenario-projects.json`). Combine multiple projects → one combined distribution (portfolio effect). ZIP bar → state → labor-index regional pricing. A row's ↗ opens the calculator in an `?embed=1` iframe popup; **Done** reads its estimate back as a "Custom" tier via `localStorage['ec:est:<slug>']` (the simulator ZIP auto-fills the popup — flagships via the URL hash, bespoke via a `Layout.astro` prefill script). Featured "Simulator · New" nav pill.

**Load-bearing invariant:** the Project Simulator project `slug`, the `MonteCarloSim` `slug`, and the `risk-events.json` key must all match (e.g. `electrical-panel`, not `panel`). Risk-event odds are reasoned planning priors, not measured rates (softened in the UI). Full design + the no-double-counting / ZIP-prefill rules: `.claude/lessons/11-monte-carlo-simulation.md`.

---

## Critical federal-credit dates (OBBBA, signed 2025-07-04)

These rules are baked into the calculator engine via `federal-credits.csv` and the runtime date filter:

| Credit | Expiration | Cap |
|---|---|---|
| **25C** — Energy Efficient Home Improvement | **Expired 2025-12-31** | $2,000 HP, $2,000 HPWH, $600 panel, $1,200 insulation, $600 windows, $250/door × 2 |
| **25D** — Residential Clean Energy (solar/battery/geothermal) | **Expired 2025-12-31** | 30% no cap |
| **30C** — Alternative Fuel Refueling (EV chargers) | **Expires 2026-06-30** | 30% up to $1,000, eligible census tracts only |
| **30D** — New Clean Vehicle | **Expired 2025-09-30** | $7,500 |
| **25E** — Used Clean Vehicle | **Expired 2025-09-30** | 30% up to $4,000 |

Any FAQ or copy that asserts a federal credit is **currently active** for an installation in 2026 needs to specifically reference 30C only. Everything else is past-tense / expired.

State + utility programs are dynamic and tracked in `rebate-programs.csv` with `last_reviewed` dates.

---

## Commands

```bash
# Local development with HMR (port 4321)
npm run dev

# Production build (Astro + custom sitemap script)
npm run build

# Preview built dist/ (port 4321)
npm run preview

# Full test suite (7 stages — all must pass before commit)
npm test
  # 1. validate-csvs.cjs — schema check on all CSVs
  # 2. validate-risk-events.cjs — sanity + sourcing guard on risk-events.json
  # 3. validate-pages.cjs — Layout open/close balance, JSX-trap detection
  # 4. validate-content.cjs — banned-string guard (stale incentives, wrong credit codes, AI-slop)
  # 5. smoke-test.cjs — 13 calculator scenarios + 9 targeted assertion groups
  # 6. new-calc-tests.cjs — 29 formula assertions for non-flagship calculators
  # 7. test-montecarlo.cjs — 39 assertions on the Monte Carlo engine (calibration gate)

# Type check (independent of tests; run before commits with new code)
npx tsc --noEmit

# Zero-dep static server (port 4173) — useful for walking dist/ + exposing CSVs
node local-server.js
```

CI is wired in `.github/workflows/ci.yml`. Every push and PR runs the full chain: validators + tests + `npx tsc --noEmit` + `npm run build` + sitemap-present check.

---

## Editing conventions

### Numbers go in CSVs, not in code

If you need to change a cost, a rebate, a multiplier, an energy price, a constant — **edit the CSV**, don't hard-code in TS/JS. The runtime reads CSVs via Vite `?raw`; the tests read CSVs via plain `fs.readFileSync`. Both must see the same data.

Exception: per-calculator UI defaults (e.g. `useState('CA')` for state, `useState('1800')` for sqft) are TS code. Those are UI ergonomics, not data.

### Every CSV row carries a `source_id` + `last_reviewed`

When you change a numeric value, bump the `last_reviewed` date on that row. The footer's "Data last refreshed YYYY-MM-DD" stamp surfaces the most recent date across all sources via `siteLastReviewed` in `src/lib/data.ts`.

### Calculator components accept `initialState` prop

All 5 flagships (HeatPump, EvCharger, Panel, Hpwh, Induction) accept an optional `initialState` string prop that overrides the `useState('CA')` default. Every state programmatic page passes `<HeatPumpCalculator client:load initialState={stateCode} />` so the calculator hydrates with the page's state, not CA. **If you build new state-programmatic pages or new calculators, follow this pattern.**

### Guide pages

37 long-form guides under `src/pages/guides/`. As of Phase 2 normalization:
- Every guide has uniform eyebrow (`.eyebrow` class), H1 styling, H2 numbering (1. 2. 3.), section anchor IDs, jump-link TOC bar (`.guide-toc`), body prose styling (`.guide-prose` or `.prose-guide` — both aliased via `:is()` in CSS), and a uniform Related Guides footer (`<RelatedGuides slug="X" />`).
- 5 canonical "Template A" guides also have inline SVG diagrams + custom callout cards. The other 32 don't. Adding those is a future task (Phase 3).
- New guides MUST follow the structural pattern: import RelatedGuides, set the slug, number H2s, include a TOC pill bar near the top.

### Astro frontmatter — known parser pitfall

`esbuild` (Astro's bundler) has trouble with **certain combinations of template literals + Unicode characters + nested ternary template literals** in some `.astro` files. Symptom: build fails with "Unexpected 'export'" at a `const faq = [` line. The fix is to **simplify the template literal expression** — use string concatenation with `+` instead of nested backticks. The `heat-pump-water-heater-cost-[state].astro` file has plain-string FAQ as a workaround for this exact bug.

### Don't add npm dependencies casually

Astro + React + Tailwind + a couple of `@astrojs/*` plugins is the entire stack. Adding deps means more lockfile churn, slower builds, and surface area for the build-on-Windows-vs-Linux rollup native-binary issue (which has bitten this repo multiple times). If you do add a dep, make sure the lockfile commits cleanly on the Windows host.

### Don't write CLAUDE.md, README.md, or other docs unless asked

The site is the product. Docs in the repo are working memory for contributors, not user-facing. Default to NOT writing new markdown files unless the user requests them.

---

## SEO + monetization posture

### SEO

- ~696 URLs in `sitemap.xml` (correctly namespaced — `sitemap/0.9`, slash not hyphen — historic bug, do not regress)
- Submitted to Google Search Console
- 200+ source citations on `/sources/`
- `WebSite`, `Organization`, `WebApplication`, `FAQPage`, `BreadcrumbList`, `TechArticle`, `CollectionPage`, `AboutPage`, `Person` JSON-LD schemas
- Programmatic state pages: 51 × 6 modules = ~300 URLs (heat-pump, solar, EV, panel, HPWH, induction). Each pulls state-specific labor multipliers, electricity rates, climate zone, and rebate filter from CSV data.
- Robots.txt explicitly allows GPTBot, ClaudeBot, Google-Extended

### Monetization (as of 2026-05)

- **Wired but inactive:** `AdSlot.astro` + `AffiliateDisclosure.astro` + `AffiliateModule.astro` are all gated behind env vars (`PUBLIC_ADS_ENABLED`, `PUBLIC_AFFILIATES_ENABLED`). They render NOTHING in production until flipped to `'true'`.
- **Active:** Google Analytics 4 with Consent Mode v2 + cookie banner. Custom `calculator_used` event fires when ResultPanel renders a valid result.
- **Plan:** Mediavine Journey tier (1,000 monthly sessions) once traffic ramps. AdSense as a fallback. Amazon Associates + Lectron + EVBASE affiliate programs for EV charger / induction / HPWH hardware. Lead-gen for HVAC + electrician + EV installer ONLY if "no funnel" stance is revisited later.

### What NOT to add without explicit user approval

- Lead-capture forms anywhere on the site
- Email gates
- Newsletter pop-ups
- Contractor-referral widgets (Networx, Modernize, Angi)

These violate the brand position and would be flagged. If the user asks to add one, treat it as a deliberate pivot, not a routine task.

---

## Audit history (in repo, at `/audit/`)

- `AUDIT.md` — initial deep audit identifying truncated source files (Pass 1)
- `AUDIT_v2.md` — Pass 2 with CSV refactor and federal-credit date update
- `DEEP_AUDIT_2026-05-13.md` — Pass 3 with calculation-accuracy industry cross-check (solar $/W rebase, geothermal restructure, Mass Save cap update)
- `UX_REFINEMENT_2026-05-13.md` — UX-focused refinement pass (palette, breadcrumbs, result panel redesign)
- `AUDIT_CLAUDE_2026-05-14.md` — Pass 4 with federal-credit IRS cross-check + 24-mo revenue projection
- `CHANGES_*.md` — per-pass change logs

When working on a task, read the most-recent audit for context. When closing a task, append findings to the next-up CHANGES log (or create one).

---

## Recent commits worth knowing about

Most recent first. The 2026-05-27 → 2026-06-14 cycle (top block) was a data-driven audit + build sprint; see `audit/AUDIT_2026-05-27.md` for the audit doc, `INFRASTRUCTURE.md` for the email/DNS work, and `CHANGELOG.md` for the full per-release log.

| SHA | Summary |
|---|---|
| _(this branch)_ | **Monte Carlo cost simulation:** ported engine (`montecarlo.js`) + inline sim on all calculators + new `/project-simulator/` tool (combined distribution, ZIP pricing, "Custom" iframe read-back) + featured nav pill + 2 new test stages. See `.claude/lessons/11-monte-carlo-simulation.md`. (697 → 698 pages) |
| `5e81200` | Strategic cross-link with sister site projectcostpro.com (8 PCP→EC + 3 EC→PCP contextual links) — see `.claude/lessons/10-portfolio-cross-linking.md` |
| `6e1652d` | Wire IndexNow (key file + `scripts/indexnow-submit.cjs`); Bing's #1 recommendation; 696 URLs submitted |
| `79dcd06` | Standardize all site contact to `martin@electrifycost.com` (remove stray `hello@` / `mkml.inc@`) |
| `c58e530` | Docs: capture 05-27→06-14 sprint + email auth (`INFRASTRUCTURE.md`, lesson 09); prune junk (MANUS prompt, stale image script) |
| `6e38723` | Close audit P2/P3 backlog: CWV (Lighthouse), logo PNG resize, source_id+last_reviewed on last 7 CSVs, named studies (LBNL Aeroseal / Nest), internal links (geothermal, battery-vs-generator), ResultPanel keyboard a11y, dingbat codification in STYLEGUIDE, sitemap priority, AffiliateModule type trim |
| `e2f59e2` | 51 water-heater-installation state pages + by-state hub (GSC demand cluster #2); TankWaterHeaterCalculator gains `initialState` |
| `13ea0ab` | GSC-driven: deepen 22 brand pages (4→8 FAQs + inline source URLs) + new `/heat-pump-replacement-cost/` page |
| `20fda58` | Audit 2026-05-27: P0 (30D date) + 12 P1 + 13 P2 + 3 Ahrefs fixes — privacy.astro + terms.astro + footer Legal col, vercel.json HTML cache, BreadcrumbList on state pages, WebApplication schema, hero disclaimers, ink-500→600 contrast, focus ring, csv?raw env.d.ts |
| `21fbf74` | Add Ahrefs Web Analytics tracking script |
| `fa72559` | Tier 2 keyword pages: 22 brand cost pages (HP/HPWH/EV/battery) via brand-profiles.csv + 4 dynamic `[brand]-...` templates |
| `54ee47e` | Tier 1 keyword pages: heat pump by tonnage (5) + operating-cost + ducted + electric-furnace |
| `7c3d9ca` | HPWH-by-city hub; fix HPWH city-cluster orphan path |
| `790b9cd` | Named gov-source citations on flagship FAQs + internal linking to striking-distance pages |
| `a2c0074` | Water-heater-installation page + 200 city programmatic pages (HP+HPWH) + HN launch kit |
| `59d2e09` | `.claude/` toolkit: 9 commands, 7 lessons, 4 prompts |
| `3cd9f06` | Good-practice docs: CONTRIBUTING, CHANGELOG, ARCHITECTURE, STYLEGUIDE, TEMPLATE, SECURITY, ROADMAP, LICENSE |
| `c7082eb` | Add CLAUDE.md |
| `9490474` | Phase 2: numbered H2s + TOC bars on 32 non-canonical guides |
| `cebbfc2` | Phase 1: unify guide formatting (eyebrow, prose, Related-guides footer) |
| `3bf55c7` | Fix sitemap.xml namespace typo (sitemap-0.9 → sitemap/0.9) |
| `57bc69b` | Wire Google Analytics 4 with Consent Mode v2 + cookie banner |
| `973a426` | Pass 5: About page + 215 new programmatic pages + state-default bug fix |
| `9b9c318` | Pass 4 audit fixes (EV regression, panel CA, per-amp pages, self-host fonts) |

Keyword strategy + opportunity backlog: `audit/KEYWORD_OPPORTUNITIES_2026-05.md` (Tier 1+2 shipped; Tier 3 pending).

Operational (non-code) facts — domain, DNS, hosting, **email (ImprovMX + SPF/DKIM/DMARC)**, analytics: `INFRASTRUCTURE.md`. Email-auth setup gotchas: `.claude/lessons/09-email-auth-dmarc-dkim.md`.

---

## When debugging fails to build

1. Run `npx tsc --noEmit` first — most issues surface there before the build
2. Run `node scripts/validate-pages.cjs` — catches Layout open/close imbalance
3. If `npm run build` fails with `Unexpected "export"` at a `.astro` line, the file has the template-literal Unicode bug (§ "Astro frontmatter — known parser pitfall" above). Simplify nested template literals to string concatenation.
4. If the build fails because of a missing rollup native binary on Linux, that's the Windows-vs-Linux `@rollup/rollup-linux-x64-gnu` mismatch — usually only happens in sandboxes; CI on Vercel handles it cleanly.

---

## When indexing fails

GSC indexing is operational. If a sitemap submission fails:
1. Verify https://electrifycost.com/sitemap.xml has `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` — slash, not hyphen (this was a real historic bug)
2. Verify ~696 URLs present
3. Re-submit in GSC → Sitemaps → Add sitemap → `sitemap.xml`

For manual URL inspection (≤10/day per property), prioritize: `/`, `/about/`, `/methodology/`, `/heat-pump-cost-calculator/`, `/solar-panel-cost-calculator/`, `/ev-charger-installation-cost-calculator/`, `/rebates/`, `/heat-pump-cost-ca/`, `/heat-pump-cost-by-state/`, `/guides/heat-pumps/`.

---

## Disclaimers in code

The site's positioning depends on these disclaimers being visible:
- Every calculator page: "Planning ranges, not contractor quotes"
- Every state page: "Verify with the linked program administrator before claiming"
- About page: "Structural engineer (not HVAC/electrical) — defer to licensed professionals for actual installation"
- Methodology page: explicit caveats about Manual J / rebate eligibility / regional code variation / financing

If you edit one of these surfaces, keep the disclaimers in place. They're load-bearing for the site's E-E-A-T position.

---

Last reviewed: 2026-05-19.
