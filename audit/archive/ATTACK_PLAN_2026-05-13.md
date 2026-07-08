# ElectrifyCost — Attack Plan (Pass 3)

**Date:** 2026-05-13
**Driven by:** [`DEEP_AUDIT_2026-05-13.md`](DEEP_AUDIT_2026-05-13.md)
**Cadence:** each batch is sized for a ~half-day chunk (3–5 hours of focused work). Total: 8 batches, ~30–40 hours of engineering + content + ops work to ship every P0/P1 in the deep audit plus the high-value P2s.

Batches are ordered by **(risk-adjusted user impact) ÷ (effort + blast-radius)**. Batch 1 fixes the things that ship wrong numbers; Batches 2–4 fix trust and ranking; Batches 5+ are quality polish that compounds over time but doesn't move a single user's behavior on Day 1.

---

## TL;DR — if you only do three things

1. **Batch 1** — fix the wrong cost numbers (solar $/W, geothermal stacking, Mass Save cap, HP UA, NYSERDA underquote, EV/EIA price refresh). All CSV edits + ~6 FAQ rewrites. ~3 hours of work. Stops the site from over-quoting users by 25–60% on solar and geothermal, and from under-quoting NY heat-pump rebates by half. This is what the user is actually complaining about when they say "the articles are inconsistent."
2. **Batch 2** — restore the sitemap + fix robots.txt. ~1.5 hours. Without this, the SEO investment in 100+ pages is leaking value daily.
3. **Batch 3** — compress hero PNGs to AVIF/WebP. ~2 hours. LCP goes from 30–50 (mobile) to 80–90. Single biggest Core Web Vitals win available.

If you can ship those three batches in a focused day, you've eliminated all 7 P0 findings.

---

## Batch 1 — Calculation accuracy: edit the CSVs that ship wrong numbers

**Scope:** All P0 numeric findings + the highest-impact P1 findings. CSV edits only (no engine changes); plus 3 FAQ paragraphs that reference the changed numbers.

**Why first:** This is the only batch where the user can see a wrong number on the screen *today*. Every other batch is infrastructure, polish, or SEO; nothing else moves the user's perception of trust as fast.

**Why before Batch 2/3:** Batches 2/3 are SEO + speed wins. Both compound over months. The cost-accuracy errors hit every user who visits today.

**Files touched:**
- `data/csv/solar-cost-ranges.csv` — change `base_per_w` row: low/mid/high from `2.50/3.30/4.50` → `2.20/2.60/3.40` (EnergySage Q1-2026 + LBNL TTS 2024). Add a `last_reviewed: 2026-05-13` update.
- `data/csv/geothermal-cost-ranges.csv` — **restructure**: rename `indoor_per_ton` to drop it as an additive row OR halve both `indoor_per_ton` and `loop_per_ton.*` values so the sum matches industry per-ton installed pricing of $3,500–$5,500/ton (national) and $7,300–$11,700/ton premium. Recommended: drop `indoor_per_ton` entirely and rebase loop rows to: vertical `3500/4500/6500`, horizontal `2500/3500/5000`, pond `2200/3200/4500`, open `2800/3800/5200` (per-ton, fully-loaded, then the calculator just multiplies by tons).
- `data/csv/rebate-programs.csv` — `MA_MASS_HP` row: low/mid/high from `2000/8000/10000` → `1500/4500/8500` (Mass Save 2026 reduced cap). Update `last_reviewed` to `2026-05-13`. Also update `NY_NYSERDA_HP` mid/high from `2500/3500` → `5000/10000` (NY Clean Heat reauthorization).
- `data/csv/operating-cost-constants.csv` — change `hp_ua_per_sqft` from `0.15` → `0.22` (matches Building Science Corp typical existing-home stock).
- `data/csv/ev-charging-cost-assumptions.csv` — `us_avg_gas_price_per_gal` from `3.45` → `3.70`; `us_avg_residential_electricity` from `0.165` → `0.1765`.
- `data/csv/state-energy-prices.csv` — refresh all 51 rows from EIA April-2026 Electric Power Monthly Table 5.6.A (electricity) and Natural Gas Monthly Table 3 (gas). About 1 hour of careful data entry; biggest impact rows are CA (32.5 → 28.9), MA, CT, NY (24.4 looks already-right), HI.
- `data/csv/project-cost-ranges.csv` — `induction,range_30in_basic` material row: low/mid/high from `1100/1700/2400` → `850/1300/2000` (matches Yale Appliance 2026 best-sellers); `hpwh,split_system` from `4500/6500/9500` → `5500/8000/12000` (matches Sanden / Daikin Altherma installed). Leave heat-pump and panel rows alone — they're within tolerance.
- `src/pages/heat-pump-cost-calculator.astro` FAQ #5 — rewrite the Mass Save and NYSERDA dollar figures to match new CSV (Mass Save "up to $8,500"; NYSERDA "$5,000–$12,000 in 2026 under the reauthorized NY Clean Heat program through 2030").
- `src/pages/rebates.astro` — update the corresponding rebate program rows so the rebate landing matches the calculator's claims.
- `src/pages/sources.astro` line 110 — fix the "ives in `src/data/source-notes.json`" mid-text glitch (delete the duplicated fragment).

**Risk:** Low. CSV edits don't change engine logic; smoke test will still pass (band ordering preserved). The geothermal restructure is the only one that could break a test scenario — re-run `npm test` after.

**Acceptance criteria:**
- [ ] `npm test` passes (13 scenarios + 7 v3 assertions still green)
- [ ] Geothermal page result for 3-ton vertical in NJ shows installed mid around $30k (previously ~$45k+)
- [ ] Solar page result for 8 kW in TX shows mid around $20–21k (previously ~$26k)
- [ ] Mass Save FAQ on heat-pump-cost-calculator says "$8,500" not "$10,000"
- [ ] NYSERDA FAQ says "$5,000–$12,000" with 2030 program horizon
- [ ] Spot-check 5 random state energy-price rows against current EIA — match within 0.5¢
- [ ] sources.astro line 110 reads cleanly

**Estimated effort:** 3 hours.

---

## Batch 2 — Restore sitemap + fix robots.txt + add WebSite/Organization schema

**Scope:** Two P0 fixes (sitemap + robots) and two P1 fixes (missing `WebSite` and `Organization` schema on the homepage). Schema fixes are 30 LOC of JSON-LD; sitemap is 50–100 LOC of build script or one dependency upgrade.

**Why now:** Once Batch 1 ships, the next-biggest gap is that Google literally can't find the site's URL list. Until robots.txt + sitemap is restored, every page that ranks does so despite the site, not because of it. This batch is the highest-leverage SEO change in the audit.

**Why after Batch 1:** Restoring crawl efficiency before the data is right means Google indexes wrong numbers. Fix data first, then signal to crawlers.

**Files touched:**
- `astro.config.mjs` — either:
  - **Option A:** upgrade `@astrojs/sitemap` to a version >=3.2 (test against Astro 4.16.19), re-enable the integration, set `changefreq: 'weekly'`, `priority: 0.7`, and add a `serialize()` hook to set `lastmod` from a "last reviewed" date keyed off the page's primary CSV(s).
  - **Option B:** add `scripts/build-sitemap.cjs` that walks `dist/` after `astro build` finishes (a postbuild step in `package.json`), emits `dist/sitemap.xml` with proper `<urlset>`, and copy `last-reviewed` per URL from a small static map.
- `public/robots.txt` — update sitemap URL if path changes (`sitemap.xml` vs `sitemap-index.xml`). Add `User-agent: GPTBot` + `Allow: /` (or `Disallow: /`) depending on AI-crawl policy.
- `src/pages/index.astro` (or `Layout.astro` conditional) — add JSON-LD blocks:
  ```json
  { "@type": "WebSite", "url": "https://electrifycost.com/", "name": "ElectrifyCost", "potentialAction": { "@type": "SearchAction", "target": { "@type": "EntryPoint", "urlTemplate": "https://electrifycost.com/?q={search_term_string}" }, "query-input": "required name=search_term_string" } }
  { "@type": "Organization", "name": "ElectrifyCost", "url": "https://electrifycost.com/", "logo": "https://electrifycost.com/favicon.svg", "sameAs": [] }
  ```
- `src/components/Layout.astro` — switch `applicationCategory: 'UtilitiesApplication'` to `'BusinessApplication'` (correct schema vocabulary) across the calculator-page schemas. Drop the meaningless `Offer { price: '0' }` block.

**Risk:** Low–medium. The sitemap dependency-upgrade option (A) could clash with Astro 4.16; test locally. The build-script option (B) is more boilerplate but zero blast radius.

**Acceptance criteria:**
- [ ] `dist/sitemap.xml` (or sitemap-index.xml) exists after `npm run build` with all 100+ pages
- [ ] curl `electrifycost.com/sitemap.xml` returns 200 (test in preview env)
- [ ] Schema Validator (validator.schema.org) shows WebSite + Organization on homepage and no errors on calculator-page WebApplication
- [ ] robots.txt sitemap URL matches the emitted sitemap path

**Estimated effort:** 1.5–2 hours.

---

## Batch 3 — Compress hero PNGs to AVIF/WebP

**Scope:** All 27 hero PNGs in `public/assets/topic-images/*-hero-photo.png`. The 31 calculator icon PNGs are already small (<80 KB) and don't need this treatment.

**Why now:** With sitemap and data correct, the next biggest blocker to ranking is Core Web Vitals — and LCP is currently in the red on every calculator page because of these images.

**Why after Batches 1 & 2:** Speed doesn't matter if the numbers are wrong (Batch 1) or crawlers can't find pages (Batch 2). Speed is a multiplier on traffic, not a creator of it.

**Files touched:**
- `scripts/compress-hero-images.cjs` (new) — Node script using `sharp` to:
  1. Find all `*-hero-photo.png` in `public/assets/topic-images/`
  2. Emit `*-hero-photo.avif` (quality 60) and `*-hero-photo.webp` (quality 75) next to the originals
  3. Resize source to 1440×810 (current resolution is higher than the rendered 420px column needs)
- `src/components/Layout.astro` — change hero-image markup pattern to `<picture>`:
  ```html
  <picture>
    <source srcset="…hero-photo.avif" type="image/avif" />
    <source srcset="…hero-photo.webp" type="image/webp" />
    <img src="…hero-photo.png" loading="eager" decoding="async" width="1440" height="810" />
  </picture>
  ```
- Update each calculator page that uses the hero-image pattern (35 pages) — sed pass or template macro
- `package.json` — add `compress-images` script + `sharp` to devDependencies; add to the `build` step (`"build": "node scripts/compress-hero-images.cjs && astro build"`)
- Optionally delete the original PNGs after AVIF/WebP are in place. Safer to keep them as fallback.

**Risk:** Low. AVIF/WebP both supported in 95%+ of US browsers (Can I Use 2026). `<picture>` fallback to PNG covers the rest. The only real risk is image quality regression — verify visually at 1440px width.

**Acceptance criteria:**
- [ ] Total hero-photo asset budget < 8 MB (down from 60 MB)
- [ ] Lighthouse Mobile LCP on `/heat-pump-cost-calculator/` < 2.5s (currently likely 4–6s)
- [ ] Lighthouse Mobile performance score > 80
- [ ] Visual diff (eyeball check) of 5 random hero photos shows no quality loss at the rendered size

**Estimated effort:** 2–3 hours.

---

## Batch 4 — FAQ parallelism + content inconsistency cleanup

**Scope:** Bring all 5 flagship FAQs to 9–10 questions of consistent length and tone. Eliminate the duplicate 60-word OBBBA preamble. Reconcile every homepage card "Typical:" range with the corresponding calculator page "Quick answer" range. Add Quick-answer box to the panel calculator page.

**Why now:** The user explicitly flagged content inconsistency. After fixing the numbers (Batch 1), fix the *prose* that wraps the numbers.

**Why after Batch 1:** No point rewriting an FAQ that quotes the wrong Mass Save cap. Fix data first, then rewrite the explanation.

**Files touched:**
- `src/pages/heat-pump-water-heater-cost-calculator.astro` — add 4 FAQs: noise level, recovery rate, condensate drain detail, retrofit space, lifespan/warranty
- `src/pages/induction-stove-cost-calculator.astro` — add 5 FAQs: IAQ benefits, portable vs cooktop vs range sizing (24/30/36"), kid safety + pacemaker FAQ, brand recommendations, range hood/ducting
- `src/pages/ev-charger-installation-cost-calculator.astro` — add 3 FAQs: smart vs basic charger trade-offs, operating cost vs gas, leasing-vs-buying tax-credit treatment
- All 5 flagship FAQs — find/replace the OBBBA preamble to a single sentence + linked rebates page
- `src/pages/index.astro` — replace each homepage card's `typical:` hardcoded string with a computed value from the actual cost CSV (read low/high from `costRanges`). This eliminates by-construction the homepage-vs-page mismatches in §2.1.
- `src/pages/electrical-panel-upgrade-cost-calculator.astro` — add the "Quick answer" callout block (parallel with other 4 calculators)
- Lowercase H1 eyebrow text consistently or capitalize all (pick one; suggest sentence case: "Heat pump", "EV charger", "Whole home")

**Risk:** Low. Pure content + a single homepage refactor.

**Acceptance criteria:**
- [ ] Each flagship FAQ has 8–12 questions
- [ ] FAQ answer length variance < 50% (longest answer / shortest answer < 1.5×)
- [ ] OBBBA preamble appears at most once per page
- [ ] Every homepage card's "Typical:" range matches the corresponding `/calculator/` page's Quick-answer range character-for-character
- [ ] Panel calculator has a Quick-answer block

**Estimated effort:** 4–5 hours (writing).

---

## Batch 5 — Panel labor multiplier double-compounding + AC labor consistency

**Scope:** Engine + CSV adjustments to address the §1.4 finding (panel high in CA/HI runs above industry hard-cap) and §5.3 (AC uses a separate labor rate).

**Why now:** This is the only engine change in the plan. Sized for a single batch so it doesn't get bundled with content work.

**Files touched:**
- `data/csv/project-cost-ranges.csv` — rebase `panel,upgrade_100_to_200` labor hours and material to **national medians**, not high-cost-market-loaded. Suggested: material/labor_hours/permit columns dropped by ~15%, so CSV values reflect national baseline before the state multiplier amplifies.
- `data/csv/ac-cost-ranges.csv` — drop the `labor_rate_usd` row (95 → references); use `module-labor-rates.csv` instead.
- `data/csv/module-labor-rates.csv` — add an `ac` row: rate 110, notes "HVAC mechanic blended rate (BLS 49-9021 + overhead) — same as ev_charger reference for cooling-only work."
- `src/components/AcCalculator.tsx` — refactor to read labor rate from `findModuleLaborRate('ac')` instead of CSV row. Single source of truth.
- `scripts/smoke-test.cjs` — add a high-cost-state panel-upgrade scenario (CA difficult 100A→200A) to assert the high band is bounded by industry ceiling (~$8,000 not $9,000+).

**Risk:** Medium. Rebasing panel CSV could cascade into many state-page renders. Re-run smoke test; eyeball 5 random state pages to confirm panel cost band is plausible.

**Acceptance criteria:**
- [ ] CA difficult 100A→200A panel renders ≤ $7,500 high (industry hard-cap)
- [ ] National-median state (OH/PA/NC) 100A→200A panel renders ~$2,500 mid (industry average)
- [ ] `npm test` passes with new high-cost-state assertion
- [ ] AC calculator shows the same labor rate basis as other electric work in the build inspector

**Estimated effort:** 3 hours.

---

## Batch 6 — Stale data cleanup + E-E-A-T signals

**Scope:** Delete the orphan `src/data/*.csv` files; add an Author / Methodology page strengthening; surface "last reviewed" per calculator.

**Why now:** Both are quality wins. The orphan deletion eliminates a foot-gun for future contributors; E-E-A-T moves Google's quality-rater opinion of the site on YMYL queries.

**Files touched:**
- Delete `src/data/climate-zones.csv`, `src/data/panel-upgrade-risk-rules.csv`, `src/data/project-cost-ranges.csv`, `src/data/rebate-programs.csv`, `src/data/state-energy-prices.csv`, `src/data/state-labor-multipliers.csv` (6 orphan files)
- Keep `src/data/contractor-checklists.json`, `src/data/glossary.json`, `src/data/source-notes.json` (text content; intentionally kept here)
- `src/pages/about.astro` (new) — write an honest one-page About: who runs the site, what its data update cadence is, no-affiliate disclosure, link to methodology and sources. ~600 words.
- `src/pages/methodology.astro` — add a "Reviewed by" line + a recent reviewers section (even if just "Reviewed by site editor on {last_reviewed}")
- `src/components/Layout.astro` — add a "Last reviewed: {lastReviewed}" line in the page header for calculator pages (when the prop is passed)
- Each flagship calculator page — set `lastReviewed="2026-05-13"` in the `<Layout>` props
- `scripts/validate-csvs.cjs` — update comment that mentions `src/data/*.csv` (the JSON file path is still right; the CSV path is now stale-reference-only)

**Risk:** Low. Orphan deletion is safe — the files aren't imported anywhere; only edge case is if a contributor was relying on them locally (they shouldn't be).

**Acceptance criteria:**
- [ ] `grep -r "src/data/.*\.csv" .` returns only the comment in validate-csvs.cjs
- [ ] `npm run build` succeeds without the orphan files
- [ ] `/about/` page exists and is linked from the footer
- [ ] Heat-pump calculator page shows "Last reviewed: May 13, 2026" in the header

**Estimated effort:** 3 hours.

---

## Batch 7 — Bundle-size + font self-hosting

**Scope:** Reduce the 104 KB `format.*.js` chunk; self-host Inter + Source Serif 4.

**Why now:** With heroes compressed (Batch 3), the remaining performance issue is the CSV-bundle weight. This batch finishes Core Web Vitals.

**Files touched:**
- `package.json` — add `@fontsource/inter@^5`, `@fontsource/source-serif-4@^5` to dependencies
- `src/styles/global.css` — import the fontsource entries: `@import "@fontsource/inter/400.css"; @import "@fontsource/inter/500.css"; …` (4 weights × 2 families = 8 imports)
- `src/components/Layout.astro` — delete the Google Fonts preconnect + preload + stylesheet links; rely on self-hosted fonts
- `src/lib/data.ts` — refactor from single module to per-domain modules:
  - `src/lib/data/states.ts` (state-energy-prices, state-labor-multipliers, climate-zones, zip-to-state, home-energy-rebate-status)
  - `src/lib/data/projects.ts` (project-cost-ranges, cost-multipliers, module-labor-rates, addons-bands, panel-upgrade-risk-rules, panel-risk-factors)
  - `src/lib/data/incentives.ts` (rebate-programs, federal-credits)
  - `src/lib/data/solar.ts` (solar-cost-ranges, solar-state-incentives, solar-production-by-state, solar-payback-assumptions, off-grid-solar-cost-ranges)
  - `src/lib/data/water.ts` (hpwh, tankless, tank water heater, recirculation, water-treatment, hot-tub-heat-pump, pool-heat-pump)
  - `src/lib/data/ev.ts` (ev-tco, ev-state-credits, ev-charging-cost-assumptions, generator)
  - And so on
- Each calculator imports only its own domain. Vite tree-shakes the rest.

**Risk:** Medium. The data.ts refactor touches every calculator's import. Mitigate by keeping `src/lib/data.ts` as a re-export barrel that calls into the per-domain modules, so existing imports keep working. Iterate: refactor one domain, ship, watch.

**Acceptance criteria:**
- [ ] Largest JS chunk hydrated by the heat-pump page ≤ 40 KB (down from 104 KB)
- [ ] No Google Fonts request in the Network panel (self-hosted)
- [ ] Lighthouse Mobile score remains > 80

**Estimated effort:** 4–6 hours (per-domain modules are tedious but mechanical).

---

## Batch 8 — Programmatic SEO expansion + analytics wire-up

**Scope:** The deferred Phase 3 from prior audits (programmatic state pages for EV, panel, HPWH, induction, plus a `/heat-pump-cost-by-state/` hub) + wire `src/lib/analytics.ts` into calculators.

**Why now:** With data + speed + content fixed, the remaining open opportunity is long-tail capture. Each state page is ~$0 marginal cost (data + template already exist) and earns long-tail traffic for years.

**Why last:** The programmatic-page work assumes the data feeding it is correct. Doing this before Batch 1 would just multiply wrong-data exposure across 200+ new pages.

**Files touched:**
- `src/pages/ev-charger-installation-cost-[state].astro` (new) — clone of `heat-pump-cost-[state].astro` adapted for EV
- `src/pages/electrical-panel-upgrade-cost-[state].astro` (new)
- `src/pages/heat-pump-water-heater-cost-[state].astro` (new)
- `src/pages/induction-stove-cost-[state].astro` (new)
- `src/pages/heat-pump-cost-by-state.astro` — currently exists but verify it's linked from the homepage and footer
- `src/pages/ev-charger-cost-by-state.astro`, `panel-upgrade-cost-by-state.astro`, etc. (hub pages for each programmatic group)
- `src/lib/analytics.ts` — leave the file as-is; wire `track()` calls in:
  - `HeatPumpCalculator.tsx` (track `calculator_started`, `calculator_completed`)
  - Same for other 4 flagships
  - `ResultPanel.tsx` (`copy_estimate_clicked`, `print_estimate_clicked`)
  - State-page hero (`state_entered`)
- `src/components/Layout.astro` — add Plausible script tag (`<script defer data-domain="electrifycost.com" src="https://plausible.io/js/script.js"></script>`) at end of `<head>`. Plausible is cookie-less, GDPR-safe, 1 KB.

**Risk:** Low–medium. The 200+ new state pages will increase build time by ~20%. Verify build still completes under 60s.

**Acceptance criteria:**
- [ ] 4 × 51 = 204 new state-permutation pages exist in `dist/`
- [ ] Sitemap (now restored from Batch 2) includes them
- [ ] Plausible dashboard shows `pageview` events on a deployed preview
- [ ] At least 5 of the 11 `track()` event types fire on a manual flagship calculator walkthrough

**Estimated effort:** 6–8 hours.

---

## Inter-batch dependencies

```
Batch 1 (data fixes)   ──┐
                         ├──→ Batch 4 (FAQ rewrites — quotes the new numbers)
                         │
Batch 2 (sitemap)        ├──→ Batch 8 (state pages — need sitemap to register them)
                         │
Batch 3 (image compress) ┤
                         │
Batch 5 (engine + AC)    ┤
                         │
Batch 6 (cleanup + EEAT) ┤
                         │
Batch 7 (bundle + fonts) ┘
```

Batches 1–7 can run mostly in parallel after Batch 1 ships. Batch 8 should wait for Batches 1–4 to land so it doesn't multiply wrong content.

---

## What's NOT in this plan (intentional)

- **Dark mode** — no user demand; not a bug.
- **i18n / Spanish translation** — long-term; would 2× content workload; tabling.
- **Affiliate-link product lists** — `AffiliateModule` shells exist (per CHANGES_v3.md); filling them with real product picks is a content + commerce question, not an audit fix. Note: the `Offer { price: '0' }` schema cleanup in Batch 2 is the only schema work tied to the calculator's commerce identity.
- **Heat-pump advanced inputs** (fuel-use override, oversizing factor adjustments) — Phase 2 carry-forward, useful but not urgent. Today's calculator already produces defensible numbers; adding 5 more inputs without re-anchoring the underlying CSV first multiplies error surface.
- **GitHub Actions CI** — should exist (would have caught the v1 truncation event in 5 minutes) but doesn't block any user-facing fix. Add at any time.

---

## Verification checklist (before declaring the plan "done")

After all 8 batches:

- [ ] `npm test` exits 0 with the 13 + 7 + (new) 5 = 25 assertions green
- [ ] `npm run build` completes in < 60s
- [ ] `dist/sitemap.xml` exists and lists 300+ pages
- [ ] Lighthouse Mobile on `/heat-pump-cost-calculator/` ≥ 85 in all four categories
- [ ] Geothermal 3-ton vertical NJ renders $25k–$32k installed mid (was $35k–$45k)
- [ ] Solar 8 kW TX renders $20k–$22k mid (was $26k–$28k)
- [ ] Mass Save FAQ across the site says "$8,500" not "$10,000"
- [ ] Homepage "Typical:" cards match calculator page Quick-answer ranges
- [ ] `/sources/` page reads cleanly (line-110 glitch gone)
- [ ] No file under `src/data/*.csv` remains
- [ ] robots.txt sitemap URL resolves 200
- [ ] Plausible (or chosen analytics provider) shows events from a sample session

If all are green, the third-pass audit's findings have shipped.

---

End of attack plan.
