# ElectrifyCost Full Site Audit

Date: 2026-06-25  
Auditor: Codex  
Live site: https://electrifycost.com  
Repo: `D:\claude projects\Websites\Electrifycost`  
Intended reviewer: Claude

## Executive Summary

The site is much healthier than a cold static-site launch normally is. The live crawl returned 200 for every sitemap URL, each crawled page had exactly one H1, canonical tags were present, JSON-LD parsed cleanly, and the local calculator test suite, TypeScript check, and Astro build all passed. The calculator engine itself looks disciplined.

The biggest problems are not generic polish problems. They are accuracy and release-control problems:

1. **Production and the local source checkout are out of sync.** The live sitemap has 697 URLs. The local build generated 641 URLs. The local source does not contain the live Project Simulator, privacy/terms pages, heat-pump replacement page, or the water-heater state-page set. A deploy from this checkout could remove valuable live pages.
2. **California TECH rebates are still marked active in CSV data even though TECH Clean California says the single-family funds are fully reserved and the program is not accepting new heat-pump HVAC or HPWH reservations.** This makes California net estimates too optimistic by roughly $1,000 to $3,000 in default cases, and potentially more in high scenarios.
3. **The EV TCO guide contains an incorrect federal-credit sunset date.** It says 30D ends 2026-09-30 and treats used EV credit as part of 30D. IRS guidance says 30D and 25E ended for vehicles acquired after 2025-09-30.
4. **The live Monte Carlo Project Simulator is promising and transparent, but its source is missing from this checkout and its cost bands/priors appear hard-coded in the shipped JS bundle instead of living in source-cited CSV data.**
5. **Several older guide/comparison pages still carry stale incentive copy**, especially Mass Save "up to $10,000", TECH Clean California examples, and one solar page that calls the residential clean energy credit "30D" instead of "25D".

If Claude only has time for one pass, fix deployment parity first, then correct incentive data/copy, then bring the Project Simulator into the repo with source-tracked assumptions.

## Verification Performed

Local commands run:

```text
npm test
npx tsc --noEmit
npm run build
```

Results:

- `npm test`: passed. It validated 51 CSVs, 126 Astro pages, 13 shared-engine smoke scenarios plus targeted assertions.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed. Astro rendered 642 pages and the custom sitemap writer produced 641 local sitemap URLs.
- `git status --short` before and after the build showed only pre-existing modified files: `CLAUDE.md` and `DEPLOY.md`.

Live crawl:

- Fetched `https://electrifycost.com/sitemap.xml`: HTTP 200.
- Live sitemap URL count: 697.
- Crawled all 697 sitemap URLs: all returned HTTP 200.
- Missing title tags: 0.
- Missing meta descriptions: 0.
- Missing canonical tags: 0.
- JSON-LD parse errors: 0.
- Internal links outside the sitemap: 0 found in the crawl.
- H1 count: exactly 1 on every crawled page.
- Slowest simple HTTP response sampled in the crawl was under roughly 450 ms. This is not a Core Web Vitals measurement.

Limitations:

- PageSpeed Insights returned Google quota error 429, so no PSI/Lighthouse score was captured.
- No local Playwright/Lighthouse/browser visual pass was completed in this audit. UI notes below are based on markup, CSS, static source review, and live HTML/JS inspection.
- Ahrefs/GSC live connectors were not available. The SEO section uses the local GSC export, the live sitemap, and manual SERP/source checks.
- The local GSC export filename is future-dated relative to this audit. I treated the contents as useful directional evidence, not as a perfectly dated source of truth.

## P0 Findings

### P0-1: Live Production Has Pages Missing From Local Source

Evidence:

- Live sitemap: 697 URLs.
- Local build sitemap: 641 URLs.
- Local source pattern matching found 56 live URLs that this checkout cannot currently produce.

Missing live categories from this checkout:

- `/project-simulator/`
- `/privacy/`
- `/terms/`
- `/heat-pump-replacement-cost/`
- `/water-heater-installation-cost-by-state/`
- 51 state pages under `/water-heater-installation-cost-{state}/`

Why it matters:

- The Project Simulator is a live navigation item and a differentiating product surface.
- Privacy and terms pages are basic trust/legal pages.
- The water-heater state pages are likely important long-tail SEO assets.
- A deployment from this checkout could remove or orphan these pages.

Recommended fix:

- Recover the deployed source branch or commit that contains these pages.
- Merge the live-only routes into this checkout before any production deploy.
- Add a release check that compares local generated sitemap count and known route families against production before deploy.
- Update `CLAUDE.md` only after the recovered source is merged, because it currently still describes the older inventory.

### P0-2: California TECH Rebates Are Applied As Active But New Reservations Are Closed/Fully Reserved

Local data:

- `data/csv/rebate-programs.csv:10`
  - `CA_TECH_HP`, status `active`, mid amount `$3,000`, high amount `$4,000`, expiration `unspecified`.
- `data/csv/rebate-programs.csv:13`
  - `CA_TECH_HPWH`, status `active`, mid amount `$1,000`, high amount `$3,800`, expiration `unspecified`.

External source check:

- TECH Clean California single-family incentives page says HEEHRA single-family rebates are fully reserved statewide and no new heat-pump HVAC or heat-pump water-heater incentive reservations are being accepted.
- Sources:
  - https://techcleanca.com/incentives/single-family-incentives/
  - https://techcleanca.com/incentives/

Observed calculator impact:

- California heat-pump calculations still subtract TECH Clean California from net cost.
- The HPWH smoke scenario applied `TECH Clean California - HPWH (-$1,000)`.

Why it matters:

- California is a high-value traffic state.
- Net costs are materially understated when the calculator subtracts a rebate a new user probably cannot reserve.
- This undercuts the site's core promise: source-cited planning ranges, not funnel optimism.

Recommended fix:

- Change the CA TECH rows to an unavailable/reserved status that does not reduce 2026-forward net estimates.
- Keep the historical amount visible only as "closed/fully reserved" context if useful.
- Update `source_url` to the direct TECH incentives pages, not just the TECH home page.
- Update `last_reviewed` to 2026-06-25.
- Add a test asserting CA TECH rows with closed/reserved status are not subtracted from net estimates.

### P0-3: EV TCO Guide Has The Wrong Federal Credit Date And Credit Code

Local source:

- `src/pages/guides/ev-tco.astro:31`
- `src/pages/guides/ev-tco.astro:49`
- `src/pages/guides/ev-tco.astro:58`
- `src/pages/guides/ev-tco.astro:141`
- `src/pages/guides/ev-tco.astro:181`
- `src/pages/guides/index.astro:34`

Problems:

- The guide says the federal 30D credit "works in 2026".
- It says the credit ends 2026-09-30.
- It describes the used-EV credit as part of 30D. Used clean vehicles are 25E.
- The metadata correctly says 30D expired 2025-09-30, so the page contradicts itself.

External source check:

- IRS OBBBA FAQ says 30D and 25E terminate for vehicles acquired after 2025-09-30.
- Source: https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb

Recommended fix:

- Rewrite the guide section as historical/pre-cutoff only.
- Replace "Credit ends 2026-09-30" with "vehicles acquired after 2025-09-30 do not qualify."
- Split 30D new vehicle and 25E used vehicle language.
- Change guide index copy from "How 30D + state credits stack" to "How expired federal credits, state credits, charging, and depreciation affect the math."
- Add a content smoke test for banned date `2026-09-30` near `30D`/`25E`.

## P1 Findings

### P1-1: The Live Project Simulator Is Missing From Source And Its Assumptions Are Not CSV-First

Live page:

- `https://electrifycost.com/project-simulator/`

Live behavior and metadata:

- HTTP 200.
- Title: `Project Simulator: Combined Electrification Cost 2026`.
- H1: `Project Simulator`.
- Schema: `WebApplication`, `FAQPage`, `BreadcrumbList`.
- Page text says it rolls 10,000 Monte Carlo scenarios and shows a most-likely total plus a safer-budget figure.
- Reviewed date shown on live page: 2026-06-24.

Shipped JS observed on production:

- `/_astro/ProjectSimulator.DRTGEXCK.js`
- `/_astro/mc-chart.aMAqTaA9.js`

Method observed from the shipped bundle:

- 10,000 trials by default.
- Triangular project distributions.
- Deterministic seeded pseudo-random generator after an initial seed.
- Shared market factor/correlation parameter around 0.5.
- p10, p50, p90, and histogram outputs.
- Surprise-event probabilities in JS with an explanatory note that they are planning priors, not measured rates.

What is good:

- The page is unusually transparent for a consumer cost simulator.
- The p10/p90 framing is better than pretending there is one exact answer.
- The "planning simulation, not a quote" caveat matches the site's editorial stance.

Problems:

- `rg` found no `project-simulator`, `Monte Carlo`, `Project Simulator`, or equivalent source route in `src`.
- Cost bands and surprise probabilities are visible in minified production JS but not in local source.
- The assumptions are not visibly tied to `source_id`, `source_url`, or `last_reviewed`.
- This conflicts with the site's CSV-first and source-cited data promise.

Recommended fix:

- Recover the simulator source before the next deploy.
- Move cost bands to a CSV such as `project-simulator-bands.csv` with columns like:
  - `project_key`
  - `project_label`
  - `size_bucket`
  - `low_usd`
  - `mode_usd`
  - `high_usd`
  - `surprise_key`
  - `surprise_probability`
  - `surprise_low_usd`
  - `surprise_high_usd`
  - `source_id`
  - `source_url`
  - `last_reviewed`
  - `notes`
- Add tests for:
  - p10 <= p50 <= p90.
  - Same seed and inputs produce same outputs.
  - Adding a selected project increases total cost distribution.
  - Closed rebates are not subtracted.
  - All simulator rows have sources and review dates.
- Consider renaming "Most likely" to "Most common simulated total" or showing median/p50 next to it. Users may interpret "most likely" as expected cost.

### P1-2: Stale Mass Save And NYSERDA Copy Remains Outside The Main Heat-Pump Calculator

Examples:

- `src/pages/ac-replacement-cost-calculator.astro:17` says Mass Save `$10,000`.
- `src/pages/heat-pump-vs-ac.astro:7` says Mass Save up to `$10,000` and NYSERDA `$1,000-$4,000`.
- `src/pages/heat-pump-vs-gas-furnace.astro:44` says Mass Save up to `$10,000` and NYSERDA `$1,000-$4,000`.
- `src/pages/guides/ac-replacement.astro:123` says Mass Save `$10,000`.
- `src/pages/mini-split-heat-pump-cost-calculator.astro:16` says Mass Save up to `$10,000` and NYSERDA `$1,000-$4,000`.

Why it matters:

- Previous audit work corrected the main heat-pump calculator to Mass Save `$8,500`, but older guide/comparison copy still repeats stale figures.
- These pages are exactly where users compare upgrade paths and decide whether electrification pencils out.

Recommended fix:

- Replace Mass Save `$10,000` with current `$8,500` whole-home cap language.
- Replace outdated NYSERDA generic `$1,000-$4,000` language with current source-backed range or avoid exact amounts in broad comparison copy.
- Add a text regression check for `Mass Save $10,000`, `up to $10,000`, and `NYSERDA $1,000-$4,000`.

### P1-3: Solar Payback Calculator Uses The Wrong Credit Code

Local source:

- `src/pages/solar-payback-calculator.astro:10`

Problem:

- The copy says "The 30D residential clean energy credit died with OBBBA."
- Residential solar/battery/geothermal is 25D, not 30D. 30D is the new clean vehicle credit.

Recommended fix:

- Change to "The 25D Residential Clean Energy Credit expired for systems installed after 2025-12-31."
- Add a content smoke test that flags "30D residential clean energy credit."

### P1-4: Data Governance Does Not Fully Match The Public Source-Cited Promise

Observed CSV structure:

- `data/csv/state-labor-multipliers.csv` has no per-row `source_id` or `last_reviewed`.
- `data/csv/module-labor-rates.csv` has no per-row `source_id` or `last_reviewed`.
- `data/csv/brand-profiles.csv` has `last_reviewed` but no `source_id`, even though some notes contain price-tier claims.

Why it matters:

- The About page and project context emphasize that numeric assumptions carry source IDs and review dates.
- Labor multipliers and module labor rates are core calculator inputs, not incidental prose.

Recommended fix:

- Add `source_id`, `source_url` or `source_id`, and `last_reviewed` columns to core numeric assumption CSVs.
- Expand CSV tests to require these columns for every numeric cost/rate/multiplier row.
- If a row is a judgmental estimate, label it as such with `method = editorial_estimate` and document the benchmark sources.

### P1-5: Hot Tub Heat Pump Guide Still Points To Closed TECH California Incentives

Local source:

- `src/pages/guides/hot-tub-heat-pumps.astro:57`

Problem:

- The guide says hot tub heaters qualify for utility rebates in CA and names TECH Clean California `$150-$500`.
- Current TECH pages say the relevant single-family funds are fully reserved and new reservations are closed.

Recommended fix:

- Remove TECH as an active example or mark it as closed/fully reserved.
- Keep the general advice to check local utility programs.

### P1-6: Local Inventory/Docs Are Stale Relative To Production

Evidence:

- Project context still references a 642-page inventory.
- Local build generated 642 pages/641 sitemap URLs.
- Production sitemap has 697 URLs.

Recommended fix:

- After recovering live-only routes, update `CLAUDE.md`, `ARCHITECTURE.md`, and any inventory tables.
- Keep `AGENTS.md` as a pointer only, per the existing rule.

## P2 Findings

### P2-1: Project Simulator Meta Description Is Too Long

Live page:

- `/project-simulator/`

Observed meta description length:

- 179 characters.

Current text:

```text
Planning several electrification upgrades at once? Run 10,000 Monte Carlo scenarios for an honest combined budget - most-likely total plus a safer-budget figure. Free, no sign-up.
```

Recommended shorter version:

```text
Run 10,000 Monte Carlo scenarios for a combined electrification budget: most-likely cost, safer budget, and uncertainty range. Free, no sign-up.
```

### P2-2: Sources Page Says "Credits We Apply" For Expired Credits

Local source:

- `src/pages/sources.astro:6`

Problem:

- The page says "Federal tax credits ... we apply (25C, 30C, 25D where relevant)."
- In 2026-forward estimates, 25C and 25D are expired and should not be described as currently applied.

Recommended fix:

- Change wording to "we track, cite, or apply where still active."
- Make 30C the only active federal credit described as applied for 2026-forward estimates.

### P2-3: A Few AI-Slop Blacklist Words Remain

Live crawl found only two meaningful uses of `leverage`:

- `/guides/electrical-panels/`
- `/guides/insulation/`

This is minor. The site's prose is much cleaner than most AI-assisted content. But the project style guide explicitly blacklists these words, so remove them opportunistically.

### P2-4: UI Accessibility Looks Mostly Sound, But Needs A Real Browser Pass

Positive static findings:

- Skip link exists.
- Focus-visible styles exist.
- `ResultPanel` uses `aria-live="polite"`.
- Page H1 discipline is excellent.
- Live JSON-LD parses cleanly.
- Color tokens checked from the Tailwind config are generally acceptable for normal text:
  - `ink-500` on white is around 4.76:1.
  - `ink-600` on white is around 7.58:1.
  - `brand-700` on white is around 5.48:1.

Risks:

- `brand-600` on white is around 3.77:1 and should be reserved for large text or non-text accents.
- `ink-400` on white is too low for normal body text and should stay decorative/placeholder only.
- Smooth scrolling should respect `prefers-reduced-motion`.
- The ad system should reserve space before ads are enabled to avoid layout shift.

Recommended fix:

- Add a small Playwright/Lighthouse smoke pass for homepage, a calculator, a state page, a guide, and Project Simulator.
- Include mobile viewport screenshots in future audits.

### P2-5: Affiliate/Ad Enablement Is Under-Documented

Observed:

- `AdSlot` components are imported across pages and appear gated by environment variables.
- Affiliate modules exist for high-intent pages such as EV charger, HPWH, and induction.
- Live pages did not render ads in this crawl.

Problem:

- `.env.example` does not fully document the public flags and IDs needed to enable these surfaces.

Recommended fix:

- Add clear env documentation for:
  - `PUBLIC_ADS_ENABLED`
  - `PUBLIC_AFFILIATES_ENABLED`
  - network-specific IDs
  - affiliate disclosure behavior
- Keep the no-funnel editorial stance clear. Hardware/retailer affiliate links fit the brand better than contractor-lead forms.

## Calculator Accuracy Notes

### Federal Credits

Federal credit status matches the current official sources in the CSV data:

- 25C Energy Efficient Home Improvement Credit: expired for property placed in service after 2025-12-31.
- 25D Residential Clean Energy Credit: expired for systems installed after 2025-12-31.
- 30C Alternative Fuel Vehicle Refueling Property Credit: active only for qualifying property placed in service through 2026-06-30.
- 30D/25E Clean Vehicle Credits: expired for vehicles acquired after 2025-09-30.

Sources:

- 25C: https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit
- 25D: https://www.irs.gov/credits-deductions/residential-clean-energy-credit
- 30C: https://www.irs.gov/credits-deductions/alternative-fuel-vehicle-refueling-property-credit
- OBBBA FAQ: https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb

The calculator data is correct here; the main issue is stale guide copy in a few places.

### Heat Pump Cost Ranges

The main heat-pump ranges are broadly plausible against current public benchmarks:

- The site default California 3-ton gross estimate is around `$14,275`, with a broad range around `$8,825-$24,650`.
- EnergySage currently frames most heat-pump installations as roughly the high single-thousands to low/mid-twenties after incentives, and its sizing pages show a 3-ton average in the mid-teens.
- The gross range is defensible. The California net number is not, because TECH is still being subtracted.

Sources:

- https://www.energysage.com/heat-pumps/

### Solar Ranges

The solar quick-answer range of roughly `$2.50-$4.50/W` is plausible:

- EnergySage marketplace data has recently reported median residential pricing around the mid-$2/W range.
- DOE/NREL benchmark material and SEIA market data support higher turnkey residential averages depending on scope and market.

Sources:

- https://www.energysage.com/data/
- https://www.energy.gov/cmei/systems/solar-photovoltaic-system-cost-benchmarks

### EV Charger Ranges

The EV charger calculator appears conservative but plausible:

- The site says a typical Level 2 install is around `$1,000-$2,800`, with trenching/complex work much higher.
- HomeAdvisor and Qmerit public ranges generally support a low-thousands default for standard installs and larger numbers for panel/trenching work.

Sources:

- https://www.homeadvisor.com/cost/garages/install-an-electric-vehicle-charging-station/
- https://qmerit.com/blog/understanding-your-ev-home-charging-station-costs-installation/

### Panel Upgrade Ranges

The panel calculator's default 100A-to-200A California gross range of roughly `$1,850/$3,100/$5,650` is plausible:

- Public consumer benchmarks often put a basic panel upgrade in the low-thousands, with service/meter/utility complications pushing higher.
- The high case is acceptable as a planning range, not a quote.

Source:

- https://www.thisoldhouse.com/electrical/cost-to-upgrade-electrical-panel

## SEO Audit

### Technical SEO

Strengths:

- 697 live sitemap URLs.
- All crawled sitemap URLs returned 200.
- Canonical tags present.
- Titles and descriptions present.
- JSON-LD parsed cleanly.
- One H1 per page.
- No obvious internal links outside the sitemap in the live crawl.
- Sitemap namespace is valid.

Issues:

- Production/local route drift is the main technical SEO risk.
- `/project-simulator/` meta description is long.
- If the next deploy removes 56 live URLs, the site could lose long-tail coverage and invite crawl churn.

### Content SEO

Strengths:

- The topic cluster is coherent: calculators, guides, sources, rebates, methodology.
- The state/city/size/brand programmatic strategy is directionally right.
- The editorial stance is differentiated: no lead funnel, planning ranges, sources, and caveats.

Weaknesses:

- Some older comparison/guide pages did not get updated when core data changed.
- The live Project Simulator is not represented in source, so it cannot accumulate internal links, tests, and content iteration safely.
- The local GSC export shows head terms like "heat pump cost" and "heat pump cost calculator" sitting far back in results, with zero clicks. This is expected for a young site but confirms that long-tail topical depth matters more than head-term chasing right now.

Directional query opportunities from the local GSC export:

- `department of energy heat pump water heater cost installed` appeared near page-one territory with very low impressions.
- `sump pump battery backup cost` appeared around the mid-teens.
- Heat-pump head terms had impressions but poor average positions.
- Solar and general calculator terms were mostly too far back to matter yet.

Recommended SEO actions:

1. Recover and preserve live-only pages before publishing.
2. Build state-page families from stable route templates for HPWH, EV charger, panel, battery, induction, and whole-home pages.
3. Add a public `/changes/` or `/data-updates/` page that logs rebate/source changes. This could attract links from contractors, Reddit, journalists, and homeowners tracking incentives.
4. Add comparison pages with calculator embeds:
   - heat pump vs gas furnace by state
   - heat pump water heater vs gas water heater
   - panel upgrade vs smart panel
   - solar plus battery payback
   - Level 2 charger vs NEMA outlet install
5. Strengthen internal links from guides into calculators and from calculators into relevant state pages.

## Traffic And Monetization Potential

Current evidence:

- Local GSC export showed zero clicks in the sampled rows and small impression counts.
- Head terms are mostly positions 60-100.
- A few specific long-tail terms are closer to striking distance.

Traffic potential:

- The site can become useful long-tail infrastructure if route parity and freshness discipline are fixed.
- The likely path is not "rank for heat pump cost" immediately. It is hundreds of state/scope/upgrade-specific searches where a source-cited calculator is more useful than a thin contractor lead-gen article.

Planning ranges, not forecasts:

| Horizon after fixes | Organic sessions/month p10 | p50 | p90 | Notes |
|---|---:|---:|---:|---|
| 6 months | 300 | 1,200 | 4,500 | Assumes route parity, indexing, and fresh rebates. |
| 12 months | 1,200 | 6,000 | 20,000 | Long-tail pages begin to work if internal links and content quality hold. |
| 18 months | 3,500 | 16,000 | 55,000 | Requires continued publishing and no major accuracy trust break. |

These are planning ranges only. Without Ahrefs/GSC live access, I would not treat them as a forecast.

Monetization:

- Display ads are premature as a primary business model while clicks are near zero.
- When traffic reaches meaningful volume, early display RPM may be modest. Premium networks can improve this later, but only after stable traffic.
- Affiliate monetization fits better than lead-gen:
  - EV chargers and installation accessories.
  - Induction cookware and ranges.
  - HPWH accessories.
  - Smart thermostats.
  - Energy monitors/smart panels where programs allow honest disclosure.
- Contractor-lead forms would undermine the no-funnel positioning unless handled as a clearly separate, opt-in directory/referral product.

Best monetization sequence:

1. Fix accuracy and route parity.
2. Add compliant affiliate disclosure and env documentation.
3. Place affiliate modules only where the user intent is hardware/product research.
4. Apply to display networks once sessions justify it.
5. Keep calculators free and ungated.

## UI And Product Notes

Strengths:

- Calculator UI architecture is consistent.
- The result panel caveat is clear about expired federal credits.
- The site avoids the usual lead-gen dark patterns.
- The Project Simulator is a genuinely useful product idea because many households plan multiple upgrades at once and need a portfolio budget, not isolated calculators.

Issues and opportunities:

- Project Simulator should expose its assumptions and sources in a visible drawer/table.
- Project Simulator should let users copy/share the selected project mix, assumptions, and seed if exact reproducibility matters.
- Consider showing "median" or "expected" next to the current "most likely" label.
- Add a "What changed since last review" link near rebate-heavy results.
- Ensure ad slots reserve height before ads are enabled.
- Run mobile browser QA before any major release.

## Error/Build Audit

No local build or type errors were found.

No live HTTP errors were found across the sitemap crawl.

The real release error is source drift:

- Live has important routes not present in the current checkout.
- The checkout can build cleanly while still being incomplete relative to production.

Recommended guardrail:

- Add a script such as `npm run audit:routes` that:
  - builds locally,
  - reads local `dist/sitemap.xml`,
  - fetches production `sitemap.xml`,
  - compares route families,
  - fails if production has route families missing locally unless explicitly acknowledged.

## Recommended Fix Order

1. **Recover production source parity.**
   - Bring `/project-simulator/`, legal pages, water-heater state pages, and heat-pump replacement page into this checkout.
2. **Patch incentive accuracy.**
   - Mark CA TECH as closed/reserved for new reservations.
   - Fix EV TCO guide date and 30D/25E terminology.
   - Replace stale Mass Save/NYSERDA examples.
   - Fix solar 25D/30D typo.
3. **Add regression tests for content accuracy.**
   - Banned stale strings:
     - `Credit ends 2026-09-30`
     - `Mass Save $10,000`
     - `30D residential clean energy credit`
   - Required data fields:
     - `source_id`
     - `last_reviewed`
     - active/closed incentive status behavior.
4. **Make Project Simulator source-cited.**
   - Move assumptions into CSV.
   - Add simulator tests.
   - Add visible assumptions/sources UI.
5. **Run browser/Lighthouse QA.**
   - Homepage.
   - One major calculator.
   - One state page.
   - One guide.
   - Project Simulator.
6. **Then expand SEO.**
   - Build missing state-page families only after freshness tests are in place.

## Source Links Used

Official/current sources:

- IRS 25C Energy Efficient Home Improvement Credit: https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit
- IRS 25D Residential Clean Energy Credit: https://www.irs.gov/credits-deductions/residential-clean-energy-credit
- IRS 30C Alternative Fuel Vehicle Refueling Property Credit: https://www.irs.gov/credits-deductions/alternative-fuel-vehicle-refueling-property-credit
- IRS OBBBA FAQ for 25C/25D/25E/30C/30D: https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb
- TECH Clean California single-family incentives: https://techcleanca.com/incentives/single-family-incentives/
- TECH Clean California incentives hub: https://techcleanca.com/incentives/
- DOE Home Energy Rebates: https://www.energy.gov/cmei/scep/home-energy-rebates-program

Benchmark sources:

- EnergySage heat pumps: https://www.energysage.com/heat-pumps/
- EnergySage marketplace data: https://www.energysage.com/data/
- DOE solar PV cost benchmarks: https://www.energy.gov/cmei/systems/solar-photovoltaic-system-cost-benchmarks
- HomeAdvisor EV charger installation cost: https://www.homeadvisor.com/cost/garages/install-an-electric-vehicle-charging-station/
- Qmerit EV home charging cost guide: https://qmerit.com/blog/understanding-your-ev-home-charging-station-costs-installation/
- This Old House electrical panel upgrade cost: https://www.thisoldhouse.com/electrical/cost-to-upgrade-electrical-panel

