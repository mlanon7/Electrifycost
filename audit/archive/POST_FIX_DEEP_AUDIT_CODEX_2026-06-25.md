# ElectrifyCost Post-Fix Deep Audit

Date: 2026-06-25  
Auditor: Codex  
Live site: https://electrifycost.com  
Local repo: `D:\claude projects\Websites\Electrifycost`  
Purpose: post-fix audit of live site, local project folder, source files, calculators, UI, SEO, traffic, monetization, and remaining high-impact work.

## Bottom Line

The live site is in better shape than the local checkout. That is good for users today, but dangerous for the next deploy.

Production looks technically clean: 697 sitemap URLs, every crawled sitemap URL returned 200, no missing metadata, no JSON-LD parse failures, no zero-inbound sitemap pages, and GA plus Ahrefs are present on every crawled page.

The local repo still builds only 641 sitemap URLs and still contains stale code/data that production appears to have fixed. A deploy from this checkout would likely remove 56 live URLs and reintroduce some fixed incentive and content issues.

The most impactful traffic move is not adding another broad batch of pages yet. It is:

1. Recover and merge the production source that generated the current live site.
2. Add guardrails so the repo cannot redeploy fewer routes or stale rebate logic.
3. Strengthen the few pages already getting impressions near positions 5 to 25.
4. Clean broken/stale outbound source links.
5. Finish the CSV-first migration for non-flagship calculators.

## What I Verified

Local checks:

```text
npm test
npx tsc --noEmit
npm run build
npm audit --omit=dev --json
```

Results:

- `npm test`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Local build output: 642 pages built, 641 URLs written to `dist/sitemap.xml`.
- `npm audit --omit=dev`: failed with 11 production dependency advisories, including Astro/Vite-chain high severity advisories. Practical production risk is lower for a static Vercel build, but the dependency age is now a real maintenance item.

Live crawl:

- Live sitemap URL count: 697.
- Local sitemap URL count: 641.
- Live-only URLs missing from local source/build: 56.
- Local-only URLs missing from live: 0.
- All 697 live sitemap URLs returned HTTP 200.
- Missing titles: 0.
- Missing meta descriptions: 0.
- Missing canonicals: 0.
- JSON-LD parse errors: 0.
- H1 count problems: 0.
- Internal links to URLs outside the sitemap: 0.
- Zero-inbound sitemap URLs: 0.
- Ahrefs Web Analytics present on 697/697 crawled pages.
- GA4 present on 697/697 crawled pages.
- Only metadata nit found: `/about/` title is 19 characters. This is not important.

Limitations:

- PageSpeed Insights returned quota error 429 again. No Lighthouse score is included.
- No in-app browser/Playwright tool was exposed in this session, so UI notes are based on HTML/CSS/source inspection and live crawl behavior, not screenshots.
- Ahrefs/GSC MCP tools mentioned in `CLAUDE.md` were not exposed. SEO findings use the local GSC export plus live crawl data.

## P0 Findings

### P0-1: Production And Local Source Are Still Out Of Sync

Evidence:

- Production sitemap has 697 URLs.
- Local build has 641 sitemap URLs.
- Production has 56 live URLs the local source cannot produce.
- Production HTML contains an `embed=1` ZIP-injection script and `ec-embed` behavior absent from local source.
- Production homepage links to `/project-simulator/` as "Simulator New"; local `src/components/Header.astro` has no Project Simulator nav item.
- Production `/rebates/` has updated CA TECH copy with `2026-06-24` review dates; local `data/csv/rebate-programs.csv` still has CA TECH rows active with `2026-05-01`.

Live URLs missing from this checkout:

- `/project-simulator/`
- `/privacy/`
- `/terms/`
- `/heat-pump-replacement-cost/`
- `/water-heater-installation-cost-by-state/`
- 51 state pages under `/water-heater-installation-cost-{state}/`

Why this matters:

- A deploy from this checkout could remove live pages and regress already-fixed content.
- Production appears to have fixes that are not in Git/local source.
- The site cannot be maintained safely until source parity is restored.

Recommendation:

- Do not deploy from this checkout until production source is recovered and merged.
- Find the Vercel deployment commit/build artifact that produced the current production site.
- Merge the missing routes, embedded-mode code, updated rebate data, and Project Simulator source.
- Add a route-parity test that fetches production `sitemap.xml`, builds local `dist/sitemap.xml`, and fails if production route families are missing locally.

### P0-2: Local Checkout Would Regress California TECH Rebate Handling

Production appears improved:

- Live calculator result panels now show TECH Clean California as a potential/context incentive and explicitly say funding is fully reserved and not subtracted.
- Live `/rebates/` says TECH single-family HVAC and HPWH funds are fully reserved and not subtracted from 2026-forward net costs.

Local source is still stale:

- `data/csv/rebate-programs.csv` still marks `CA_TECH_HP` as `active`.
- `data/csv/rebate-programs.csv` still marks `CA_TECH_HPWH` as `active`.
- Local smoke output still applies `TECH Clean California - HPWH (-$1,000)`.

Current official source:

- TECH Clean California says single-family HEEHRA rebates are fully reserved statewide, and TECH is no longer accepting heat pump HVAC or heat pump water heater reservations.
- TECH incentives hub says single-family heat pump water and heat pump HVAC incentives are fully reserved and not accepting new reservations.
- Sources:
  - https://techcleanca.com/incentives/single-family-incentives/
  - https://techcleanca.com/incentives/

Recommendation:

- Preserve the production fix in source.
- Add an explicit status such as `closed_reserved` or `historical_context` to the CSV.
- Update calculator logic and tests so closed/reserved programs can appear in "potential/context" but never reduce net cost.
- Add a regression test that CA HPWH in 2026 does not subtract TECH.

### P0-3: Local Source Still Contains Stale Federal/State Incentive Copy That Production May Have Fixed

Examples in local source:

- `src/pages/guides/ev-tco.astro` still says 30D ends `2026-09-30`.
- `src/pages/heat-pump-vs-gas-furnace.astro` still says Mass Save up to `$10,000` and NYSERDA `$1,000-$4,000`.
- `src/pages/guides/ac-replacement.astro` still says Mass Save `$10,000`.
- `src/pages/mini-split-heat-pump-cost-calculator.astro` still says Mass Save up to `$10,000`.
- `src/pages/solar-payback-calculator.astro` still says "30D residential clean energy credit" where it means 25D.

Production crawl did not find the bad `Credit ends 2026-09-30` phrase, which means production and local differ again.

Current official source:

- IRS OBBBA FAQ says 25E and 30D are not allowed for vehicles acquired after 2025-09-30.
- IRS OBBBA FAQ says 25C and 25D expire after 2025-12-31.
- IRS 30C page says 30C applies from 2023-01-01 through 2026-06-30, with eligible census tract rules.
- Sources:
  - https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb
  - https://www.irs.gov/credits-deductions/alternative-fuel-vehicle-refueling-property-credit

Recommendation:

- Merge the production-fixed content into source.
- Add content regression tests for:
  - `Credit ends 2026-09-30`
  - `Mass Save $10,000`
  - `Mass Save up to $10,000`
  - `30D residential clean energy credit`
  - active TECH subtraction in 2026

## P1 Findings

### P1-1: The Live Project Simulator Is Still Not In Local Source

Production page:

- `/project-simulator/`
- Title: `Project Simulator: Combined Electrification Cost 2026`.
- Meta description length: 155 characters, now acceptable.
- H1: `Project Simulator`.
- JS bundle: `/_astro/ProjectSimulator.CveucR_2.js`.

What looks good on production:

- The page uses 10,000 Monte Carlo trials.
- It uses triangular distributions and a shared market factor/correlation around 0.5.
- It respects `prefers-reduced-motion` by skipping the animation batch.
- It communicates "planning simulation, not a quote."
- The page is now linked from the homepage/header.

Remaining issue:

- No `project-simulator` route/source exists in local `src/`.
- The production bundle exposes hard-coded project bands such as heat pump, mini-split, electrical panel, smart panel, generator, etc.
- Simulator assumptions are not visible in CSV with `source_id` and `last_reviewed`.

Recommendation:

- Recover the Project Simulator source first, then move cost bands and surprise probabilities to CSV.
- Add tests for deterministic seed behavior, p10 <= p50 <= p90, closed rebates not subtracted, and every simulator row having a source/review date.
- Rename "Most likely" to "Most common simulated total" or show p50/median next to it. Users may read "most likely" as expected cost.

### P1-2: Many Non-Flagship Calculators Still Duplicate Numeric Cost Bands In Component Code

This is the biggest architectural finding beyond source drift.

Examples:

- `src/components/SumpPumpCalculator.tsx` hard-codes the same cost bands that exist in `data/csv/sump-pump-cost-ranges.csv`.
- `src/components/HotTubHeatPumpCalculator.tsx` hard-codes bands while `data/csv/hot-tub-heat-pump-cost-ranges.csv` exists.
- `src/components/DoorReplacementCalculator.tsx` hard-codes bands while `data/csv/door-replacement-cost-ranges.csv` exists.
- `src/components/TankWaterHeaterCalculator.tsx` hard-codes bands while `data/csv/tank-water-heater-cost-ranges.csv` exists.
- `src/components/WaterTreatmentCalculator.tsx` hard-codes bands while `data/csv/water-treatment-cost-ranges.csv` exists.
- Similar hard-coded bands appear in AC, air sealing, boiler, ductwork, energy audit, furnace, generator, geothermal, heat pump dryer, recirculation, insulation, mini-split, off-grid solar, pool heat pump, roof, smart panel, solar, tankless, thermostat, window, and wood stove components.

Why this matters:

- The public promise says numbers live in CSVs.
- The tests can pass while the UI uses duplicated numbers.
- A future source refresh can update CSVs without updating the displayed calculator result.
- This is exactly how stale numbers survive.

Recommendation:

- Do not try to migrate all 33 calculators at once.
- Start with the 5 pages closest to traffic or trust risk:
  1. Sump pump.
  2. Tank water heater.
  3. Mini-split.
  4. AC replacement.
  5. Smart panel.
- For each, replace component literals with imported CSV rows from `src/lib/data.ts`.
- Add a test that fails if a calculator component contains `low: 123`, `mid: 123`, `high: 123`, or `equipment: { low:` patterns unless explicitly allowlisted as UI-only.

### P1-3: CSV Validation Treats Source/Review Columns As Optional

Current validator:

- `scripts/validate-csvs.cjs` validates `source_id` only if the column exists.
- It validates `last_reviewed` only if the column exists.

Numeric CSVs missing one or both fields:

- `addons-bands.csv`
- `brand-profiles.csv`
- `cost-multipliers.csv`
- `module-labor-rates.csv`
- `panel-risk-factors.csv`
- `state-labor-multipliers.csv`
- `zip-to-state.csv`

Why this matters:

- `state-labor-multipliers.csv`, `module-labor-rates.csv`, and `cost-multipliers.csv` are core calculator inputs.
- The About page says each CSV row carries source ID and `last_reviewed`.
- The build should enforce that promise, not rely on discipline.

Recommendation:

- Define which CSVs are "numeric source-of-truth" files.
- Require `source_id` and `last_reviewed` for those files.
- For files where `source_url` is intentionally used instead of `source_id`, document and enforce that alternative.
- Leave `zip-to-state.csv` as a possible exception if treated as a lookup table, but add `source_id` if ZIP coverage is claimed as a data product.

### P1-4: Rebate Tables Need Status, Not Just Amount And Expiration

Production calculator result panels are clearer now, but state-page tables are still ambiguous.

Example from live `/heat-pump-cost-ca/`:

- Table lists `TECH Clean California - Heat Pump HVAC`, amount `$1,000-$4,000`, expiration `unspecified`.
- The result panel separately says TECH is potential/context only and not subtracted.

Example from live `/heat-pump-water-heater-cost-ca/`:

- Table lists `TECH Clean California - HPWH`, amount `$500-$3,800`, expiration `unspecified`.
- The result panel separately says funding is fully reserved and not subtracted.

Problem:

- A user scanning the table can reasonably think the money is active.
- Expired 25C rows are also listed with dollar amounts. Expiration helps, but status would be clearer.

Recommendation:

- Add a `Status` column to state and city rebate tables.
- Use visible chips:
  - `Active`
  - `Potential`
  - `Income-qualified`
  - `Closed/reserved`
  - `Expired`
- Add a note above the table: "Only active confirmed incentives reduce net cost. Potential, expired, and closed programs are shown for context."

### P1-5: Outbound Source Links Have Meaningful Rot

Automated external link check:

- Unique external URLs found in live crawl: 231.
- Bad/blocked results: 68.
- Redirects: 45.

Some results are likely bot blocks, especially EIA/NREL/403/503 responses. But several look like real 404s or stale paths.

High-confidence examples to review:

- `https://afdc.energy.gov/laws/30C` returned 404. Search result suggests `https://afdc.energy.gov/laws/10513` and the Argonne/ArcGIS locator are current alternatives.
- `https://afdc.energy.gov/laws/30c-tract-lookup` returned 404. Current locator appears to be the ArcGIS 30C Tax Credit Eligibility Locator.
- `https://ahrefs.com/privacy` returned 404. Current Ahrefs privacy policy is `https://ahrefs.com/legal/privacy-policy`.
- Several old ENERGY STAR paths returned 404. Current air-source heat pump criteria path is `https://www.energystar.gov/products/air_source_heat_pumps/key-product-criteria`.
- Several old Energy.gov `eere/buildings` paths returned 404 or redirects to `/cmei/...`.
- Several NEEP paths should be replaced with `https://ashp.neep.org/` or the current ccASHP page.

Why this matters:

- Source quality is one of the site's main differentiators.
- Broken outbound source links reduce user trust.
- Link rot also weakens the correction/review workflow.

Recommendation:

- Add `npm run audit:links` or `npm run audit:sources`.
- Store expected exceptions for bot-blocked domains separately from real 404s.
- Refresh `src/data/source-notes.json` and source URLs in `.astro` guide pages.
- Treat IRS/DOE/ENERGY STAR/NEEP/AFDC links as P1 because they anchor YMYL-ish claims.

### P1-6: Dependency Advisories Need A Planned Astro Upgrade Path

Installed versions:

- Astro: 4.16.19.
- Vite: 5.4.21.
- `@astrojs/react`: 3.6.3.

`npm audit --omit=dev` reported:

- 11 production dependency advisories.
- 3 high severity advisories.
- 7 moderate advisories.
- Suggested fix path is Astro 7.0.3, which is semver-major.

Practical risk:

- Lower than a dynamic server app because the site is statically built.
- Still worth addressing because dev-server, build-chain, XSS, and SSR-related advisories accumulate and will eventually complicate maintenance.

Recommendation:

- Create a separate dependency-upgrade branch.
- Try Astro 5 or current stable migration incrementally rather than jumping casually.
- Run full build, route parity, and live-like preview after upgrade.
- Do not mix dependency upgrade with content/data fixes.

## P2 Findings

### P2-1: `.env.example` Is Stale

Current `.env.example` still references Plausible/Pirsch and generic `AD_NETWORK_ID`.

Actual code uses:

- GA4 hard-coded measurement ID in `Layout.astro`.
- Ahrefs Web Analytics script in `Layout.astro`.
- `PUBLIC_ADS_ENABLED`.
- `PUBLIC_AFFILIATES_ENABLED`.

Recommendation:

- Update `.env.example` so future deploys do not guess at analytics/ad/affiliate behavior.
- If Ahrefs data key is intentionally public, document that.

### P2-2: UI And Accessibility Are Mostly Sound, But Still Need Browser QA

Positive findings:

- Skip link exists.
- Focus-visible styles exist.
- Result panel uses `aria-live="polite"`.
- All local built images had `alt` attributes.
- Header uses native `details`/`summary` for dropdowns and mobile nav.
- Live crawl found exactly one H1 on every sitemap page.
- Live JSON-LD parsed cleanly.
- Internal linking has zero zero-inbound pages.

Issues and checks to add:

- `html { scroll-behavior: smooth; }` has no visible `prefers-reduced-motion` override in local CSS.
- Need mobile screenshot QA for header/dropdowns and calculator result panels.
- Need Project Simulator screenshot QA because the simulator is a distinct UI surface and not in local source.
- Need keyboard testing on dropdown navigation and simulator controls.

Recommendation:

- Add a Playwright smoke suite once browser tooling is available:
  - Homepage mobile and desktop.
  - Heat pump calculator.
  - CA state page with closed/reserved TECH.
  - Sump pump calculator.
  - Project Simulator.
  - One guide page.

### P2-3: Low-Inbound Pages Could Use Stronger Cluster Links

Live crawl found no orphan pages, which is good. Pages with only one or two inbound internal links include:

- `/guides/wood-pellet-stoves/`
- `/200a-to-400a-panel-upgrade-cost/`
- `/ducted-heat-pump-cost/`
- `/electric-furnace-cost-calculator/`
- `/guides/heat-pump-dryers/`
- `/guides/hot-tub-heat-pumps/`
- `/guides/roof-replacement/`
- `/guides/smart-panels/`
- `/guides/smart-thermostats/`
- `/guides/solar-payback/`
- `/guides/water-treatment/`
- `/heat-pump-operating-cost-calculator/`
- `/heat-pump-replacement-cost/`
- `/heat-pump-vs-ac/`
- `/solar-financing-comparison/`
- `/tankless-vs-hpwh/`
- `/water-heater-installation-cost-calculator/`

Recommendation:

- Add contextual links from relevant calculators to these pages.
- Add "related cost decisions" blocks to major calculators.
- Prioritize links into pages with actual GSC impressions or monetization potential.

## SEO And Traffic Assessment

### Technical SEO

Production is technically strong:

- 697 live sitemap URLs.
- Valid sitemap namespace.
- All sitemap URLs returned 200.
- All pages had title, description, canonical, H1, and parseable JSON-LD.
- No sitemap orphans by inbound crawl.
- Ahrefs and GA are present.

Main technical SEO risk:

- Local source is not production source. This is the whole game right now.

### Search Console Directional Data

Local GSC export:

- Rows: 150.
- Total clicks: 0.
- Total impressions: 438.

Top impression queries:

- `heat pump cost`: 38 impressions, position 81.5.
- `heat pump cost calculator`: 27 impressions, position 65.2.
- `75 gallon water heater installation cost calculator`: 20 impressions, position 76.6.
- `heat pump system cost`: 20 impressions, position 87.2.
- `how much does a heat pump cost`: 16 impressions, position 83.8.
- `solar panel cost calculator`: 15 impressions, position 92.1.

Striking-distance queries:

- `department of energy heat pump water heater cost installed`: 3 impressions, position 9.3.
- `sump pump battery backup cost`: 4 impressions, position 15.
- `average cost to install heat pump water heater us 2025`: 2 impressions, position 12.
- `heat pump cost oregon`: 7 impressions, position 24.9.

Interpretation:

- Head terms are not close yet. Do not chase them directly.
- The site is showing early traction on very specific queries where a calculator can beat generic articles.
- The traffic plan should be "compound precise long-tail wins", not "rank for heat pump cost next month."

## Highest-Impact Traffic Recommendations

### 1. Reconcile Production Source Before Any Growth Work

Impact: very high.  
Risk if skipped: very high.

This is not glamorous, but it is the strongest traffic recommendation. You cannot safely grow a site when the repo can redeploy fewer pages and stale data.

Deliverables:

- Production source restored.
- Local build produces 697 URLs or intentionally supersedes production with documented redirects.
- Route parity script added to CI.
- CA TECH production fix preserved in source.
- Project Simulator source preserved in source.

### 2. Build A "Striking Distance" Update Pack

Impact: high.  
Scope: small to medium.

Use the queries already close to visibility:

#### Sump pump battery backup

Current query: `sump pump battery backup cost`, average position around 15.

Recommendation:

- Tune existing `/sump-pump-cost-calculator/` title/H1/intro to put "battery backup" earlier.
- Add a dedicated comparison table:
  - battery backup only
  - combo primary plus battery
  - water-powered backup
  - smart monitored combo
  - generator-backed circuit
- Add FAQ schema questions exactly matching:
  - "How much does a sump pump battery backup cost?"
  - "How long does a sump pump battery backup run?"
  - "Is battery backup or water-powered backup better?"
- Avoid a new competing page unless the existing page cannot be retitled cleanly.

#### Heat pump water heater install cost

Current queries include DOE/HPWH installed-cost terms around positions 9 to 12.

Recommendation:

- Add a DOE/ENERGY STAR anchored section to `/heat-pump-water-heater-cost-calculator/`.
- Add a "installed cost by scenario" table:
  - 120V plug-in retrofit
  - 240V hybrid replacing electric
  - 240V hybrid replacing gas
  - tight closet relocation
  - panel/circuit adder
- Link from `/water-heater-installation-cost-calculator/` and the live water-heater state pages once source is recovered.

#### Heat pump cost Oregon

Current query: `heat pump cost oregon`, average position around 24.9.

Recommendation:

- Enrich `/heat-pump-cost-or/` with Oregon-specific copy:
  - Energy Trust of Oregon.
  - Oregon Department of Energy rebate status.
  - Pacific Northwest moderate/cold-climate distinction.
  - Electric vs gas/oil operating-cost paragraph.
- Add links from heat pump guide and heat pump by-state hub.

### 3. Create A `/changes/` Data Freshness Page

Impact: medium-high.  
Why: high trust, linkability, and repeat visits.

The site already has a source-cited/freshness stance. Make it visible.

Page concept:

- URL: `/changes/` or `/data-updates/`.
- Auto-list recent CSV/source changes:
  - program name
  - old status/value
  - new status/value
  - source URL
  - last reviewed date
  - affected calculators/pages
- Start with TECH Clean California, Mass Save cap, OBBBA credit sunsets, 30C expiration.

This is more defensible than a newsletter popup and fits the no-funnel brand.

### 4. Refresh Source Links And Turn It Into A Recurring Audit

Impact: medium.  
Trust impact: high.

Do not leave the 404s as a one-off cleanup. Link rot will come back.

Add a script that:

- Reads live sitemap or local build.
- Extracts outbound URLs.
- Checks status.
- Separates:
  - pass
  - redirect
  - likely bot-blocked
  - real 404/410
  - timeout
- Fails CI only on known-real 404s from source-canon domains.

### 5. Finish CSV-First For The Calculators That Can Rank

Impact: medium-high over time.  
Reason: prevents stale-data regressions.

Start with calculators that already show GSC impressions or monetization potential:

- Sump pump.
- HPWH/tank water heater.
- Mini-split.
- AC replacement.
- Smart panel.
- Solar payback/battery.

This is less visible than a new page, but it is what keeps future audits from rediscovering the same bug class.

## Monetization Recommendations

Do not overpush monetization yet. The local GSC export shows zero clicks in the sampled rows.

Best near-term monetization posture:

- Keep display ads off until there is meaningful traffic.
- Keep no lead-gen forms.
- Add affiliate only where product intent is explicit:
  - EV charger hardware/accessories.
  - Sump pump battery backups.
  - Smart thermostats.
  - Induction cookware/ranges.
  - HPWH accessories.
  - Energy monitors/smart panel accessories.
- Make the affiliate disclosure visible on the same page when enabled.

Highest monetization opportunity from current query data:

- Sump pump battery backup. This is product-intent, urgent, and affiliate-compatible without violating the no-funnel stance.

Avoid:

- Contractor quote widgets.
- Email-gated estimates.
- "Rebate ends soon" urgency language.

## Suggested Fix Order

1. Recover production source and merge it locally.
2. Run local build and verify 697 URLs or a documented redirect plan.
3. Preserve production CA TECH behavior in source and tests.
4. Bring Project Simulator source and assumptions into CSV.
5. Add route parity and content-regression tests.
6. Fix stale local incentive copy.
7. Add status chips to rebate tables.
8. Refresh high-confidence broken source links.
9. Tune the sump-pump and HPWH pages already near visibility.
10. Start CSV-first migration for non-flagship calculators.
11. Plan Astro upgrade in a separate branch.

## Do Not Do Yet

- Do not deploy this checkout as-is.
- Do not add another giant page batch before parity and source tests.
- Do not turn on ads while traffic is near zero.
- Do not add lead-gen forms.
- Do not rewrite the whole design. The UI is good enough; accuracy, parity, and source trust matter more.

## Files/Areas To Hand To Claude

Critical:

- `data/csv/rebate-programs.csv`
- `scripts/validate-csvs.cjs`
- `src/components/SumpPumpCalculator.tsx`
- `src/components/TankWaterHeaterCalculator.tsx`
- `src/components/MiniSplitCalculator.tsx`
- `src/components/AcCalculator.tsx`
- `src/pages/guides/ev-tco.astro`
- `src/pages/heat-pump-vs-gas-furnace.astro`
- `src/pages/guides/ac-replacement.astro`
- `src/pages/solar-payback-calculator.astro`
- `src/pages/heat-pump-cost-[state].astro`
- `src/pages/heat-pump-water-heater-cost-[state].astro`
- `src/data/source-notes.json`
- `src/components/Layout.astro`
- `.env.example`

Production-only source to recover:

- `/project-simulator/`
- `/privacy/`
- `/terms/`
- `/heat-pump-replacement-cost/`
- `/water-heater-installation-cost-by-state/`
- `/water-heater-installation-cost-{state}/`
- embedded calculator mode code (`embed=1`, `ec-embed`)
- updated production rebate data
- updated production header/nav with Project Simulator

## Sources Checked

- TECH Clean California single-family incentives: https://techcleanca.com/incentives/single-family-incentives/
- TECH Clean California incentives hub: https://techcleanca.com/incentives/
- IRS OBBBA FAQ: https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb
- IRS 30C Alternative Fuel Vehicle Refueling Property Credit: https://www.irs.gov/credits-deductions/alternative-fuel-vehicle-refueling-property-credit
- Ahrefs privacy policy current path: https://ahrefs.com/legal/privacy-policy
- AFDC 30C current law page found by search: https://afdc.energy.gov/laws/10513
- ENERGY STAR current heat pump criteria path: https://www.energystar.gov/products/air_source_heat_pumps/key-product-criteria
- NEEP cold-climate heat pump list: https://ashp.neep.org/

