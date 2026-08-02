# Post-Revision Deep Audit - ElectrifyCost

Audit date: 2026-06-25  
Auditor: Codex  
Scope: live site at `https://electrifycost.com`, local project folder, calculator behavior, source/data governance, UI, SEO, traffic potential, monetization readiness.

## Executive Summary

The live site is in much better technical SEO shape than the local repo. Production now has 697 sitemap URLs, all crawled URLs returned 200, and the sampled metadata stack is clean: titles, descriptions, canonicals, H1s, JSON-LD, GA4, and Ahrefs tracking all passed.

The serious issue is source parity. The local checkout still builds only 642 pages and emits a 641 URL sitemap. Production has 56 URLs that do not exist in the local source, including `/project-simulator/`, `/privacy/`, `/terms/`, `/heat-pump-replacement-cost/`, `/water-heater-installation-cost-by-state/`, and all 51 `/water-heater-installation-cost-{state}/` pages. A deploy from this checkout would remove production pages and likely reintroduce stale incentive handling.

The most important next move is not another surface-level SEO tweak. It is to bring the production code/data back into the repo, then lock parity with automated checks. After that, the highest-ROI traffic work is a focused content/source refresh around the pages already getting impressions: HPWH install cost, sump pump battery backup cost, Oregon heat pump cost, and heat pump replacement.

## What I Rechecked

- Local git state, recent commits, and dirty files.
- Local validation: `npm test`, `npx tsc --noEmit`, `npm run build`.
- Local vs live sitemap parity.
- Live crawl of all sitemap URLs for status, metadata, canonical, H1, JSON-LD, analytics, and internal inbounds.
- Live browser spot checks on homepage, Project Simulator, HPWH calculator, rebates page, and sump pump calculator.
- Mobile browser overflow checks at 390 x 844.
- Calculator/source data governance checks.
- External source link health.
- Dependency security audit.
- Local GSC export for traffic opportunities.
- Current official-source spot checks for OBBBA/IRS 30C/30D/25E, TECH Clean California, and Mass Save 2026 heat pump rebates.

## Verification Results

| Check | Result | Notes |
|---|---:|---|
| `npm test` | Pass | Validated 51 CSVs, 126 `.astro` pages, 13 smoke scenarios, 9 targeted assertion groups, 29 new-calculator assertions. |
| `npx tsc --noEmit` | Pass | No TypeScript errors. |
| `npm run build` | Pass | Built 642 pages; custom sitemap wrote 641 URLs to `dist/sitemap.xml`. |
| Local sitemap count | 641 | Below production by 56 URLs. |
| Live sitemap count | 697 | All crawled URLs returned 200. |
| Live metadata crawl | Pass | No missing/long titles, missing/long descriptions, canonical mismatches, H1 count issues, invalid JSON-LD, missing JSON-LD, noindex pages, or missing analytics tags. |
| Live internal orphan check | Pass | Zero sitemap pages with zero internal inbounds. |
| Live low-inbound pages | 17 | Good opportunity for internal-link boosts. |
| Live browser console sampled pages | Pass | No console errors/warnings observed in the sampled pages. |
| Mobile overflow sampled pages | Minor issue | 8px overflow on Project Simulator and HPWH pages, likely nav/off-canvas menu geometry. |
| External link check | Needs work | 231 unique outbound links; 77 bad/blocked, including 68 high-confidence bad or failed links. |
| `npm audit --omit=dev` | Needs work | 11 prod advisories: 3 high, 7 moderate, 1 low. |

## P0 Findings

### P0. Production and Local Source Are Still Out of Sync

Evidence:

- Live sitemap: 697 URLs.
- Local build sitemap: 641 URLs.
- Live-only URL count: 56.
- Local-only URL count: 0.
- Important live-only URLs:
  - `/project-simulator/`
  - `/privacy/`
  - `/terms/`
  - `/heat-pump-replacement-cost/`
  - `/water-heater-installation-cost-by-state/`
  - `/water-heater-installation-cost-ak/` through `/water-heater-installation-cost-wy/`

Local source scan found no matching Project Simulator, embedded mode, privacy/terms pages, or water-heater state-page sources.

Impact:

- A deploy from the current local checkout can remove 56 live pages.
- The live Project Simulator is a major new product/SEO asset but is not maintainable from this repo.
- Claude or another agent reviewing the repo would not see the true production site.
- Any fix made only in production is at risk of being overwritten later.

Recommendation:

1. Pull or recover the exact production source that generated the 697 URL live site.
2. Commit the missing route files/components/data.
3. Add a parity check that compares `dist/sitemap.xml` to production before deploy, with an explicit allowlist if intentional removals happen.
4. Do not make more content or SEO changes until parity is restored.

### P0. Local Checkout Still Has a CA TECH Regression Risk

Production appears fixed:

- Browser spot check on `https://electrifycost.com/heat-pump-water-heater-cost-calculator/` with default CA state shows:
  - TECH Clean California HPWH is displayed under possible/additional incentives.
  - It is marked as potential/context.
  - It says funding is fully reserved and not subtracted from net cost.
  - No console errors.

Local evidence still shows risk:

- `npm test` smoke output still applies `TECH Clean California - HPWH (-$1,000)` for a CA HPWH case.
- Local `data/csv/rebate-programs.csv` still has:
  - `CA_TECH_HP` status `active`
  - `CA_TECH_HPWH` status `active`
- Local `data/csv/home-energy-rebate-status.csv` says CA HEEHRA is `reserved`, but the TECH rows themselves are still treated as ordinary active rebates by local tests.

Current source evidence:

- TECH Clean California says single-family heat pump HVAC and HPWH incentives are no longer accepting reservations: https://techcleanca.com/incentives/single-family-incentives/
- TECH incentive reporting says single-family heat pump water and HVAC incentives are fully reserved and not accepting new reservations: https://techcleanca.com/incentives/

Impact:

- If deployed, local code may subtract a California incentive that production no longer subtracts.
- This is a trust issue on a page where users make real planning decisions.

Recommendation:

1. Bring the production TECH gating logic into `src/lib/calc.ts` and/or `rebate-programs.csv`.
2. Set CA TECH HP and HPWH rows to a status that renders as potential/context, not eligible subtraction.
3. Add an explicit smoke assertion:
   - CA HPWH result contains TECH as potential.
   - CA HPWH net result does not subtract TECH.
4. Add this to regression tests before any deploy.

### P0. Local Source Still Contains Stale Federal-Credit Copy

Local file:

- `src/pages/guides/ev-tco.astro:58`

Problem:

- The guide says 30D ends `2026-09-30` for new and used vehicles.
- That is not current.

Current source evidence:

- IRS OBBBA FAQ says 30D is not allowed for vehicles acquired after September 30, 2025, and 30C is not allowed for property placed in service after June 30, 2026: https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb
- IRS clean vehicle tax credit page says 30D applies only to vehicles acquired on or before September 30, 2025: https://www.irs.gov/clean-vehicle-tax-credits
- IRS 30C page says home refueling/charging property placed in service from January 1, 2023, through June 30, 2026 can qualify: https://www.irs.gov/credits-deductions/alternative-fuel-vehicle-refueling-property-credit

Impact:

- This is exactly the kind of stale tax-credit statement that can hurt trust and rankings.
- The rest of the site has mostly absorbed the OBBBA dates, so this one stands out.

Recommendation:

Fix the local guide copy to match the project rule:

- 30D new clean vehicle credit: expired for vehicles acquired after 2025-09-30.
- 25E used clean vehicle credit: expired for vehicles acquired after 2025-09-30.
- 30C EV charger/refueling property credit: still available through 2026-06-30, subject to eligible-tract rules.

### P0. Live Project Simulator Is Not Source-Governed in the Repo

Production has a strong new asset:

- `/project-simulator/`
- H1: `Project Simulator`
- Meta description length: 155
- JSON-LD types: `WebApplication`, `FAQPage`, `BreadcrumbList`
- It describes 10,000 Monte Carlo scenarios.
- Browser spot check found no console errors.

But the local source has no Project Simulator files. The deployed bundle is:

- `https://electrifycost.com/_astro/ProjectSimulator.DrFddz3J.js`

The live bundle includes hard-coded tier ranges directly in JavaScript, for example heat pump tier data appears in the minified bundle as low/high numeric values. That means the calculator assumptions are not reviewable in the local repo and not governed by CSV `source_id` / `last_reviewed` rules.

Impact:

- The simulator can be a major linkable asset, but it currently has the weakest source governance of the major tools.
- Monte Carlo outputs sound authoritative. They need stronger visible methodology and source traceability than a simpler calculator, not weaker traceability.

Recommendation:

1. Add the Project Simulator source to the repo.
2. Move simulator cost bands into a CSV such as `data/csv/project-simulator-ranges.csv`.
3. Include columns:
   - `project_id`
   - `category`
   - `tier`
   - `low`
   - `mid` if used
   - `high`
   - `source_id`
   - `last_reviewed`
   - `notes`
4. Add `src/pages/project-simulator.astro` and a typed simulator component under `src/components/`.
5. Add tests for:
   - no selected projects
   - one project
   - multiple correlated projects
   - reduced-motion mode
   - deterministic seeded output or bounded percentile output
6. Add a visible methodology section explaining the distributions, correlation assumptions, and why the output is a planning range.

## P1 Findings

### P1. Thirty Calculator Components Still Hard-Code Numeric Cost Bands

I scanned `src/components/*Calculator.tsx` for low/mid/high hard-coded ranges. Thirty calculator components still have hard-coded cost bands or cost constants.

Examples:

- `src/components/AcCalculator.tsx`
- `src/components/AirSealingCalculator.tsx`
- `src/components/BatteryCalculator.tsx`
- `src/components/BoilerCalculator.tsx`
- `src/components/DoorReplacementCalculator.tsx`
- `src/components/DuctworkCalculator.tsx`
- `src/components/GasFurnaceCalculator.tsx`
- `src/components/GeneratorCalculator.tsx`
- `src/components/HeatPumpDryerCalculator.tsx`
- `src/components/HotWaterRecirculationCalculator.tsx`
- `src/components/MiniSplitCalculator.tsx`
- `src/components/OffGridSolarCalculator.tsx`
- `src/components/SumpPumpCalculator.tsx`
- `src/components/TankWaterHeaterCalculator.tsx`
- `src/components/WindowCalculator.tsx`
- `src/components/WoodStoveCalculator.tsx`

Impact:

- This violates the portfolio's CSV-first rule.
- Data refreshes can update CSVs while the UI continues using stale embedded component numbers.
- It weakens the "source-backed" claim for non-flagship calculators.

Recommendation:

Do not try to migrate all 30 at once. Prioritize by traffic/monetization potential:

1. `SumpPumpCalculator.tsx` because GSC shows `sump pump battery backup cost` at average position 15.
2. `TankWaterHeaterCalculator.tsx` because water-heater install queries are already surfacing.
3. `AcCalculator.tsx`, `GasFurnaceCalculator.tsx`, and `MiniSplitCalculator.tsx` because they are close to the heat-pump cluster.
4. Solar/battery/generator calculators after the above.

For each migration:

- Move bands to CSV.
- Add `source_id` and `last_reviewed`.
- Add a test comparing rendered calculator output to CSV-derived numbers.
- Keep UI defaults in TS; move cost facts out.

### P1. CSV Source/Review Columns Are Still Not Universal

Numeric CSVs missing source and/or review columns:

- `data/csv/addons-bands.csv` - no source, no reviewed date
- `data/csv/cost-multipliers.csv` - no source, no reviewed date
- `data/csv/module-labor-rates.csv` - has source-like notes, no reviewed date
- `data/csv/operating-cost-constants.csv` - no source, no reviewed date
- `data/csv/panel-risk-factors.csv` - no source, no reviewed date
- `data/csv/panel-upgrade-risk-rules.csv` - no source, no reviewed date
- `data/csv/state-labor-multipliers.csv` - no source, no reviewed date
- `data/csv/zip-to-state.csv` - no source, no reviewed date

Impact:

- The site says every numeric input is source-cited, but validators currently allow important numeric tables without source/review metadata.
- This is especially important for `state-labor-multipliers.csv` and `module-labor-rates.csv` because they affect almost every calculator result.

Recommendation:

1. Add `source_id` and `last_reviewed` to every numeric CSV where a value affects output.
2. Add validator enforcement in `scripts/validate-csvs.cjs`.
3. Allow exceptions only for pure lookup files such as ZIP ranges, and document the exception.
4. Add dangling-source validation against `src/data/source-notes.json`.

### P1. External Source Links Need a Refresh Pass

Live external link check:

- 231 unique outbound links.
- 77 bad/blocked results.
- 68 high-confidence bad or failed results.
- 37 redirects.

High-confidence examples:

- `https://afdc.energy.gov/laws/30C` -> 404
- `https://afdc.energy.gov/laws/30c-tract-lookup` -> 404
- `https://ahrefs.com/privacy` -> 404
- `https://neep.org/heating-electrification/buying-cold-climate-air-source-heat-pumps` -> 404
- multiple ENERGY STAR product category URLs -> 404
- several DOE/Energy Saver pages -> 404 or moved
- Consumer Reports EV/solar/heat-pump guide URLs -> 404
- EPA certified wood heater URL -> 404

Some government sites returned 503 or fetch failures and should be manually checked before removal. But the volume of true 404s is high enough to justify a source refresh sprint.

Impact:

- Broken citations damage trust and reduce the value of the `/sources/` page.
- They are especially risky on YMYL-adjacent pages where the whole positioning is "source-backed."

Recommendation:

1. Add a weekly or pre-release link checker with a whitelist for expected 403/429 sources.
2. Update hard 404s first, especially IRS/DOE/AFDC/ENERGY STAR/EPA links.
3. Store canonical final URLs after redirects to reduce crawl waste.
4. Add `last_verified` to source registry entries if not already present.

### P1. Dependency Advisories Are Still Present

`npm audit --omit=dev --json` found:

- 11 total prod advisories.
- 3 high.
- 7 moderate.
- 1 low.

Major path:

- Astro 4.16.x / Vite chain.
- Audit suggests major upgrade path to Astro 7.0.3.

Impact:

- This is a static site, so production exploit surface is lower than a server app, but dev-server and build-chain advisories still matter.
- The site has public credibility surfaces; security debt undercuts that.

Recommendation:

1. Create a separate upgrade branch.
2. Upgrade Astro and integrations together.
3. Run:
   - `npm test`
   - `npx tsc --noEmit`
   - `npm run build`
   - live/preview route spot checks
4. Watch for known Astro parser/build differences and route-collision behavior.
5. Do not mix the Astro upgrade with content/source edits.

### P1. Internal Linking Is Good Overall, but 17 Pages Are Thinly Linked

The live crawl found zero sitemap orphans. That is a major improvement.

Low-inbound pages:

- `/guides/wood-pellet-stoves/` - 1 inbound
- `/200a-to-400a-panel-upgrade-cost/` - 2
- `/ducted-heat-pump-cost/` - 2
- `/electric-furnace-cost-calculator/` - 2
- `/guides/heat-pump-dryers/` - 2
- `/guides/hot-tub-heat-pumps/` - 2
- `/guides/roof-replacement/` - 2
- `/guides/smart-panels/` - 2
- `/guides/smart-thermostats/` - 2
- `/guides/solar-payback/` - 2
- `/guides/water-treatment/` - 2
- `/heat-pump-operating-cost-calculator/` - 2
- `/heat-pump-replacement-cost/` - 2
- `/heat-pump-vs-ac/` - 2
- `/solar-financing-comparison/` - 2
- `/tankless-vs-hpwh/` - 2
- `/water-heater-installation-cost-calculator/` - 2

Recommendation:

- Add contextual links from the strongest relevant calculator and guide pages.
- Prioritize pages aligned with real impressions:
  - `/water-heater-installation-cost-calculator/`
  - `/heat-pump-replacement-cost/`
  - `/ducted-heat-pump-cost/`
  - `/heat-pump-operating-cost-calculator/`
  - `/guides/solar-payback/`

### P1. Local Mass Save Copy Still Needs a Targeted Sweep

Current official Mass Save source:

- 2026 whole-home air-source heat pump rebate: `$2,650 per ton up to $8,500`.
- 2026 partial-home: `$1,125 per ton up to $8,500`.
- Source: https://www.masssave.com/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps

Local copy is mixed:

- `src/pages/heat-pump-cost-calculator.astro` appears updated with `$8,500`.
- `src/pages/guides/ac-replacement.astro:123` still says `Mass Save $10,000`.
- `src/pages/heat-pump-vs-gas-furnace.astro:44` still says `Mass Save up to $10,000`.
- Some generic `state rebates can subtract $1,000-$10,000` lines may be acceptable as multi-state ranges, but MA-specific statements should say `$8,500` for 2026.

Recommendation:

Run a Mass Save-specific content sweep and distinguish:

- Massachusetts Mass Save 2026 cap: `$8,500`.
- Other municipal/state programs may still reach `$10,000+`; name them separately if used.

## P2 Findings

### P2. Minor Mobile Horizontal Overflow

Browser viewport: 390 x 844.

Observed:

- Homepage: no horizontal overflow in sample.
- `/project-simulator/`: `scrollWidth` 383 vs `clientWidth` 375.
- `/heat-pump-water-heater-cost-calculator/`: `scrollWidth` 383 vs `clientWidth` 375.

The overflowing elements appear to be navigation/menu items positioned from x=327 to x=463 while the client width is 375. This looks like hidden/off-canvas mobile nav geometry, not main content text overflow.

Impact:

- Minor, but it can create a subtle sideways scroll on mobile.

Recommendation:

- Add or adjust `overflow-x: hidden` at the correct wrapper level, or ensure closed mobile nav content is truly out of layout flow.
- Re-test at 360, 390, and 430 px widths.

### P2. `.env.example` Is Stale

Current `.env.example` still references:

- Plausible / Pirsch.
- Generic `AD_NETWORK_ID`.

Actual site behavior:

- GA4 with Consent Mode v2.
- Ahrefs analytics.
- Env-gated monetization components:
  - `PUBLIC_ADS_ENABLED`
  - `PUBLIC_AFFILIATES_ENABLED`

Recommendation:

Update `.env.example` so a future deployer sees the real current env surface. Do not put actual IDs or secrets in the file.

### P2. Legal Pages Are Live but Not in Local Source

Production has:

- `/privacy/`
- `/terms/`

Both are live and included in production sitemap, but absent locally.

Impact:

- Legal pages are now part of the production surface and should be version-controlled.
- Privacy page currently links to Ahrefs privacy at a URL that returned 404 in the link check.

Recommendation:

1. Add privacy/terms pages to the repo.
2. Update Ahrefs privacy link to the current canonical privacy notice.
3. Include legal pages in future route parity tests.

## Calculator Accuracy and UX Notes

### What Improved on Production

- HPWH CA TECH handling is much clearer live: funding reserved, shown as potential/context, not subtracted.
- Result panel language is better than the stale local behavior.
- Live technical SEO is clean across the production sitemap.
- Internal orphan pages appear fixed.
- Project Simulator is visible in nav as `Simulator NEW` and is discoverable from homepage/header.

### What Still Needs Work

- Production fixes are not reflected in the local repo.
- Project Simulator assumptions are not source-governed locally.
- Non-flagship calculators still vary in result UI, source traceability, and likely analytics behavior.
- `calculator_used` is known to fire from shared `ResultPanel.tsx`; confirm that all 38 calculators produce equivalent analytics events or add a shared event hook.
- Add a few live browser regression tests for critical calculator cases:
  - CA HPWH with TECH reserved.
  - MA heat pump with 2026 Mass Save cap.
  - EV charger with 30C through 2026-06-30 and eligible-tract caveat.
  - EV TCO with 30D/25E expired after 2025-09-30.
  - Project Simulator with no projects, one project, and multi-project stack.

## SEO and Traffic Potential

### Technical SEO

Production technical SEO is strong:

- 697 sitemap URLs.
- 697 returned 200.
- No missing titles/descriptions in crawl.
- No long title/description issues by standard thresholds.
- No canonical mismatches.
- No H1 count issues.
- No invalid JSON-LD.
- No missing JSON-LD.
- No missing GA4/Ahrefs tags.
- No sitemap pages with zero internal inbounds.

The site does not need a broad metadata rewrite right now.

### Search Console Evidence

Local GSC export:

- File: `google - search -performance/google search performance 09-20-2026.csv`
- Rows parsed: 280
- Total clicks: 0
- Total impressions: 438

Top impression clusters:

- Heat pump queries: 306 impressions.
- Solar queries: 76 impressions.
- Water heater queries: 47 impressions.
- Sump pump queries: 8 impressions.

Top queries by impressions:

- `heat pump cost` - 38 impressions, avg position 81.5
- `heat pump cost calculator` - 27 impressions, avg position 65.2
- `75 gallon water heater installation cost calculator` - 20 impressions, avg position 76.6
- `heat pump system cost` - 20 impressions, avg position 87.2
- `how much does a heat pump cost` - 16 impressions, avg position 83.8
- `solar panel cost calculator` - 15 impressions, avg position 92.1

Striking-distance queries:

- `department of energy heat pump water heater cost installed` - 3 impressions, avg position 9.3
- `average cost to install heat pump water heater us 2025` - 2 impressions, avg position 12
- `sump pump battery backup cost` - 4 impressions, avg position 15
- `heat pump cost oregon` - 7 impressions, avg position 24.9

### Highest-Impact Traffic Recommendations

1. Restore source parity first. This is the highest-ROI SEO action because a bad deploy can remove indexed pages and undo production fixes.

2. Build a focused HPWH installation cluster:
   - Strengthen `/water-heater-installation-cost-calculator/`.
   - Link it from HPWH calculator, tank water heater, tankless vs HPWH, and water-heater comparison pages.
   - Add a section for `75 gallon water heater installation cost` because GSC already shows impressions.
   - Add FAQ copy that answers "department of energy heat pump water heater cost installed" without keyword stuffing.

3. Upgrade `/sump-pump-cost-calculator/` around `sump pump battery backup cost`:
   - Move hard-coded data to CSV first.
   - Add a quick-answer callout for battery backup cost.
   - Add comparison rows for primary pump, battery-only, combo, and water-powered backup.
   - Add internal links from generator, battery backup, basement/water-related pages if present.

4. Improve `/heat-pump-cost-or/`:
   - Add Oregon-specific utility/program details.
   - Link from heat pump by-state hub and heat pump guides.
   - Add local-rate and climate explanation using existing CSV data.

5. Strengthen `/heat-pump-replacement-cost/`:
   - It is live but not local.
   - Search Console shows `heat pump replacement` at avg position 30.9.
   - Bring the page into source, then internally link it from heat pump cost, HVAC repair vs replace, AC replacement, and gas furnace replacement pages.

6. Add a "Data freshness" changelog or source-update page only after parity:
   - The site's brand is source-backed and regulatory-aware.
   - A public `/changes/` or `/data-updates/` page can show "reviewed Mass Save 2026", "updated TECH status", "updated IRS 30C deadline."
   - This can improve trust without adding funnel behavior.

## Monetization Readiness

Recommendation: do not turn on broad ads yet if traffic is still at 0 clicks / 438 impressions in the export. Ads will add friction before meaningful revenue.

Better sequence:

1. Fix parity and source freshness.
2. Grow clicks on the four striking-distance clusters.
3. Turn on affiliate modules only on high-intent product pages:
   - EV charger pages.
   - HPWH/tank water heater pages.
   - Sump pump battery backup page.
   - Smart thermostat page.
   - Induction range/cooktop page.
4. Keep the no-funnel position. Do not add quote forms, email gates, referral widgets, or "get matched with contractors" CTAs unless the brand strategy intentionally changes.
5. Add affiliate disclosures on any page with affiliate links.

Display ad timing:

- Consider display ads only after sustained sessions justify it.
- When enabled, keep calculator result panels free of intrusive ads.
- Reserve ad slots to avoid layout shift.

## Recommended Work Order

### Phase 1 - Protect Production

1. Recover/sync production source into the repo.
2. Confirm local build emits 697 URLs.
3. Add route parity test.
4. Add live-only route list as a failing fixture until resolved.
5. Add privacy/terms and Project Simulator source to version control.

### Phase 2 - Fix Accuracy Regressions

1. Fix CA TECH local rebate rows/gating.
2. Fix `src/pages/guides/ev-tco.astro:58`.
3. Sweep Mass Save 2026 copy.
4. Add tests for TECH, 30D/25E, 30C, and Mass Save.

### Phase 3 - Make the Simulator Trustworthy

1. Move simulator ranges to CSV.
2. Add source IDs/review dates.
3. Add methodology copy and tests.
4. Keep it in nav, but make it auditable.

### Phase 4 - Source Governance

1. Add `source_id` / `last_reviewed` to missing numeric CSVs.
2. Enforce source metadata in validators.
3. Start migrating hard-coded non-flagship calculator bands.
4. Begin with Sump Pump and Tank Water Heater.

### Phase 5 - SEO Growth

1. HPWH installation cluster.
2. Sump pump battery backup cluster.
3. Oregon heat pump page.
4. Heat pump replacement page.
5. Low-inbound internal linking pass.
6. External link refresh.

### Phase 6 - Infrastructure

1. Astro/Vite upgrade branch.
2. Update `.env.example`.
3. Add link checker.
4. Add browser smoke checks for live/hydrated calculators.

## Files and Routes Claude Should Inspect First

Local:

- `src/lib/calc.ts`
- `data/csv/rebate-programs.csv`
- `data/csv/home-energy-rebate-status.csv`
- `src/pages/guides/ev-tco.astro`
- `src/pages/guides/ac-replacement.astro`
- `src/pages/heat-pump-vs-gas-furnace.astro`
- `src/components/HpwhCalculator.tsx`
- `src/components/ResultPanel.tsx`
- `scripts/smoke-test.cjs`
- `scripts/smoke-cases.json`
- `scripts/build-sitemap.cjs`
- `.env.example`

Missing locally but live:

- `/project-simulator/`
- `/privacy/`
- `/terms/`
- `/heat-pump-replacement-cost/`
- `/water-heater-installation-cost-by-state/`
- `/water-heater-installation-cost-{state}/`

Priority calculator migrations:

- `src/components/SumpPumpCalculator.tsx`
- `src/components/TankWaterHeaterCalculator.tsx`
- `src/components/AcCalculator.tsx`
- `src/components/GasFurnaceCalculator.tsx`
- `src/components/MiniSplitCalculator.tsx`

## Source Links Used in This Audit

- IRS OBBBA FAQ for 25C, 25D, 25E, 30C, 30D, 45L, 45W, 179D: https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb
- IRS clean vehicle tax credits: https://www.irs.gov/clean-vehicle-tax-credits
- IRS alternative fuel vehicle refueling property credit: https://www.irs.gov/credits-deductions/alternative-fuel-vehicle-refueling-property-credit
- TECH Clean California single-family incentives: https://techcleanca.com/incentives/single-family-incentives/
- TECH Clean California incentive reporting: https://techcleanca.com/incentives/
- Mass Save 2026 air source heat pump rebates: https://www.masssave.com/residential/rebates-offers-services/heating-and-cooling/heat-pumps/air-source-heat-pumps

## Bottom Line

Be honest: the production site is not broken from a technical SEO standpoint. It looks much healthier than the local repo. The real risk is that the repo is behind production and would regress the site if deployed.

The most impactful traffic move is therefore defensive first: restore parity, preserve the live fixes, and turn the production-only simulator/pages into source-governed code. After that, focus content work on the exact queries where Google is already testing the site: HPWH installation cost, sump pump battery backup cost, Oregon heat pump cost, and heat pump replacement.
