# ElectrifyCost Full Audit — 2026-06-25 (Claude)

> Method: 7 parallel dimension auditors (build/route-parity health, incentive accuracy,
> calculator plausibility, technical SEO, content/voice/disclaimers, data governance,
> code/engine) → adversarial verification of every P0/P1 finding against the *current*
> tree and live site (default-to-refute) → synthesis. 18 agents total. Run against
> HEAD `3a1a092`, live and in sync.

## Executive Summary

**Overall health: STRONG. Ship-clean, no P0 defects.** Every P0-area check passed verification against the current tree (HEAD `3a1a092`, live and in sync). The `npm test` suite is green across all 7 stages, the production build emits 698 pages and a 697-URL sitemap with no warnings, and the live site matches HEAD. The federal-credit data (OBBBA), Mass Save cap guard, E-E-A-T byline, and state-page disclaimers are all correct and actively defended by validators.

The five things that actually matter, in priority order:

1. **One genuine single-source-of-truth violation (P1):** the electrical-panel state-page FAQ hardcodes `$1800–$4500` and multiplies by the state labor index instead of computing from CSV via `calc.ts`, so the FAQ and the live calculator disagree on the same scenario (verified on CA/TX).
2. **Solar low-band undershoot (P2):** `solar-cost-ranges.csv` sets a `$2.20/W` floor while its own note cites the EnergySage 2026 marketplace median of `$2.58/W` — a 14.6% gap below the cited benchmark.
3. **Analytics coverage gap (P2):** only the 5 core calculators fire `calculator_used`; 32 of 37 calculators fire no conversion event, which will distort affiliate/Mediavine attribution once monetization flips on.
4. **Two stale/under-governed data surfaces (P2):** `state-energy-prices.csv` is ~85 days stale (`2026-04-01`), and the two incentive CSVs (`rebate-programs.csv`, `home-energy-rebate-status.csv`) lack the structured `source_id` column every other incentive table uses.
5. **Content-guard hardening (P2):** `validate-content.cjs` catches the high-impact stale figures but misses several AI-slop hedge patterns the STYLEGUIDE explicitly bans.

Nothing here is user-facing-broken. The P1 is a data-consistency defect worth fixing soon; the rest is polish and governance.

## Verification Performed

| Check | Result |
|---|---|
| `npm test` | **PASS** — exit 0, all 7 stages green |
| → validate-csvs | 51 CSVs OK |
| → validate-risk-events | OK |
| → validate-pages | 132 .astro OK |
| → validate-content | 140 .astro scanned, **no banned strings** |
| → smoke-test | 13 scenarios + 9 targeted assertion groups pass |
| → new-calc-tests | 29/29 |
| → test-montecarlo | 39/39 (calibration gate) |
| `npm run build` | **PASS** — exit 0, 698 pages in 8.18s, no warnings/deprecations |
| Postbuild sitemap | 697 URLs written to `dist/sitemap.xml`, correct `sitemap/0.9` namespace |
| Repo ↔ live parity | **true** — HEAD `3a1a092` in sync with electrifycost.com (CA/TX panel + state-page disclaimers fetched and confirmed live) |

---

## P0 — Wrong / broken user-facing or data integrity

**None.** Every P0-area item below was adversarially re-confirmed as *correct* against the current tree. They are recorded here as verified-clean, not as defects.

| id | What was checked | Result |
|---|---|---|
| `fed-credit-reference-correct` | `data/csv/federal-credits.csv` rows 2–13 + `ResultPanel.tsx:194` | 25C/25D/30D/25E all `expired` (end_dates `2025-12-31`/`2025-09-30`, last_reviewed `2026-05-11`); 30C `active` through `2026-06-30`. Copy states it verbatim. **Correct.** |
| `federal-credit-expiry-dates-correct` | `calc.ts:200–205` `isExpired()` + census-tract gating `calc.ts:232–233` | Lexicographic ISO date comparison verified: `isExpired('2025-12-31','2026-06-25')=true`, `isExpired('2026-06-30',…)=false`. 30C tract gating separate and correct. **Correct.** |
| `mass-save-cap-guard-working` | `scripts/validate-content.cjs:19–20` | Bans the stale `Mass Save (up to $10,000)`; zero matches across 140 files. Guard active. **Correct.** |
| `source-id-resolution-complete` | 51 CSVs vs `src/data/source-notes.json` | 49/51 carry `source_id`; all unique source_ids resolve. (Audit-internal note: actual unique count is **152**, not the 137 originally stated.) **Correct.** |
| `p-e-byline-present` | `about.astro:18,66–67,71,74` + live `/about/` | `Ph.D., P.E., PMP` + `structural engineer` byline + honorificSuffix schema + "My engineering background is in structural — not HVAC or electrical" caveat. **Correct, E-E-A-T intact.** |
| `state-page-disclaimer-present` | `heat-pump-cost-[state].astro:102–103` + live `/heat-pump-cost-ca/` | "Planning range, not a contractor quote. Verify state and utility programs with the linked administrator…" rendered at top of calculator section across 8 templates. **Correct.** |

---

## P1 — Significant accuracy / SEO / quality gap

### `hardcoded-panel-cost-faq` — FAQ hardcodes panel cost, diverges from the calculator

**Evidence:** `src/pages/electrical-panel-upgrade-cost-[state].astro:44` hardcodes `1800`–`4500` and multiplies by the state labor multiplier rather than computing via `calc.ts:computeBaseCost()`. Verified live: TX renders `$1800–$4500`, CA renders `$2556–$6390` (`1800×1.42` / `4500×1.42`). The calculator with default difficulty/homeType/timing produces a *different* range (~`$1525–$5125` for TX), so the FAQ and the calculator on the same page state inconsistent numbers for the same scenario. This is a direct single-source-of-truth violation.

*Correction to the original finding for the record:* the hardcoded constants correspond to the CSV `base_low`/`base_high`, **not** `material_low`/`material_high` (those are 700/1700), and labor *is* implicitly included via the multiplier — so the "omits labor entirely" framing was overstated. The core defect — FAQ ≠ calculator — stands.

**Recommendation:** Load `project-cost-ranges` in the page frontmatter, resolve `findCostScenario('panel','upgrade_100_to_200')`, apply the same state labor multiplier + permit path `calc.ts` uses, and interpolate the computed range into the FAQ. Remove the literals.

---

## P2 — Minor polish / governance

### `solar-cost-baseline-low-band-too-low`
`data/csv/solar-cost-ranges.csv:2` `base_per_w` = low `$2.20` / mid `$2.60` / high `$3.40`, while the same row's note cites EnergySage 2026 marketplace median `$2.58/W` and LBNL TTS 2024 `$2.92/W`. The `$2.20` floor sits 14.6% below the cited median.
**Recommendation:** Raise the low band to `$2.35–$2.40/W`; consider `low=2.40 / mid=2.75 / high=3.50` to keep spread while anchoring to the stated benchmark. The mid should represent the marketplace norm, not the optimistic floor.

### `conversion-tracking-gap`
`src/components/ResultPanel.tsx:55–61` is the only place `gtag('event','calculator_used')` fires, covering the 5 core calculators. The other **32 of 37** calculators (Solar, Battery, AC, etc.) fire nothing (`grep -l gtag src/components/*Calculator.tsx` → 0). Verified live: `/solar-panel-cost-calculator/` fires no event. Downgraded from the original framing because the 5 tracked calcs carry the homepage-featured traffic and the 32 are custom islands (not on the shared engine), so this is a monetization-analytics gap, not a UX or accuracy bug.
**Recommendation:** Add a shared `useConversionEvent` hook (mirror `useHashStateSync`) and call it from each calculator on result compute, so affiliate/Mediavine attribution covers the full product.

### `data-freshness-state-energy-prices`
`data/csv/state-energy-prices.csv` — all 51 rows `last_reviewed=2026-04-01`, ~85 days old (90-day cutoff ≈ `2026-03-27`). Feeds heat-pump-vs-gas TCO and EV operating costs.
**Recommendation:** Pull latest EIA retail prices, update values, stamp `last_reviewed: 2026-06-25`; schedule with the Q3 EIA refresh.

### `data-governance-missing-source-id`
`rebate-programs.csv:1` and `home-energy-rebate-status.csv:1` lack a `source_id` column (they carry `source_url` only). All other incentive tables (`federal-credits.csv`, `solar-state-incentives.csv`, `battery-state-incentives.csv`) use structured `source_id`. Not a correctness bug — `validate-csvs.cjs:47` treats `source_id` as optional and UI attribution flows via `source_url` — but it's an inconsistency in the traceability model.
**Recommendation:** Add `source_id` (after `source_url`, before `last_reviewed`) to both files, mapping each program to its `source-notes.json` entry (e.g. `DSIRE_CA`, `SRC_AFDC_LAWS`, `CPUC_SGIP`).

### `faq-hardcoded-numbers`
Several comparison/FAQ pages hardcode dollar context that can't be centrally updated: `load-management-vs-panel-upgrade.astro:13` (`$500–$1,500` / `$2,000–$4,500`), `battery-vs-generator.astro:11` (`$200–$1,200/yr` TOU, `$1,800–$2,600/yr` NEM), `heat-pump-vs-ac.astro:72` (`$900–$1,200/yr` vs `$1,400–$1,800`).
**Recommendation:** For calculator-owned modules, reference the CSV. For third-party/tariff figures (Span, Lumin, TOU/NEM), move to a dedicated `comparative-cost-context.csv` with `last_reviewed`.

### `standalone-calc-missing-csv`
`SolarCalculator.tsx:20–58` and `BatteryCalculator.tsx:20–52` hardcode `BASE_PER_W`, `ROOF_MULT`, `COST_PER_KWH_*`, state-incentive tables, etc. as TS objects — violating the "numbers live in CSV" principle and leaving no non-engineer edit path or audit trail.
**Recommendation:** Extract to `data/csv/solar-cost-config.csv` / `battery-cost-config.csv` and load via the existing `parseCsv()` pattern.

### `ev-charger-level2-hardwired-benchmark-check`
`project-cost-ranges.csv:8` `ev_charger,level2_hardwired` mid `$1,500` sits at the high end of current market; the cited `SRC_AFDC_LAWS` (2026-05-01) did not return pricing on fetch. Low confidence.
**Recommendation:** Cross-check against a current installer-cost study or add a CSV note bounding the benchmark to Q2 2026.

### `missing-actual-prices-caveat`
`STYLEGUIDE.md:89`'s universal "Actual prices depend on your home, local labor rates, equipment selection…" caveat is absent from `heat-pump-cost-calculator.astro` (lines 94–98 say only "planning-level").
**Recommendation:** Add the exact STYLEGUIDE caveat near the result panel on all flagship calculator pages.

### `ai-slop-patterns-not-guarded`
`validate-content.cjs:18–29` checks 6 patterns; STYLEGUIDE lines 40–57 list more ("While it's true that…", "There are several factors", "Some experts say", "It's important to recognize").
**Recommendation:** Extend the banned list with the remaining high-signal hedges so the guard matches the documented standard.

### `title-length-ducted-hp`
`src/pages/ducted-heat-pump-cost.astro:3` title is 61 chars (1 over).
**Recommendation:** Trim to ≤60, e.g. `Ducted Heat Pump Cost 2026 — Installed Price` (45).

### `meta-desc-length-hot-tub-hp`
`src/pages/guides/hot-tub-heat-pumps.astro:8` description is 161 chars (1 over).
**Recommendation:** Drop one clause to ≤160 (e.g. "the 50°F limit … saves more than the upgrade.").

### `panel-upgrade-labor-hours-capped-correctly` *(verified-clean, recorded for the trail)*
`project-cost-ranges.csv:12` caps panel labor hours at 7/10/14 (was 8/12/18) to keep the CA-difficult high band under the $7.5K industry cap; test "Panel CA difficult high ≤ $8,000" passes. The data is correct. (The original finding's supporting math cited `$95/hr` and conflated multipliers; actual rate is `$110/hr` per `module-labor-rates.csv:5`, electrician multiplier 1.42. Conclusion unaffected.) **No change required.**

---

## P3 — Nits

- **`heat-pump-ducted-3ton-range-verification`** — `project-cost-ranges.csv:2` mid `$13.5K` is 7.6% under EnergySage 2025 `$14.5K` national avg; acceptable given non-CA markets. Optionally document the downward adjustment in the CSV note. No change required.
- **`battery-cost-13-5kwh-range-slightly-high`** — `battery-cost-ranges.csv` retrofit `$1.4K/kWh` mid is at the upper bound of 2026 retrofit costs but reasonable for standalone-install labor. Add a note clarifying retrofit-vs-paired-solar split. No change required.
- **`seo-opportunity-topical-clustering`** — Audit `RelatedGuides` coverage across all 38 guides; ensure each links 3–5 related guides/calculators via shared topic tags.
- **`seo-opportunity-featured-snippets`** — Restructure long FAQ answers (e.g. `heat-pump-cost-calculator.astro` FAQ #1, ~400 words) to lead with a 40–60-word summary for position-zero eligibility.
- **`last-reviewed-dates-mostly-current`** — Most CSVs refreshed within 30 days (May–June 2026); only `state-energy-prices.csv` is outside the window (see P2). Quarterly cadence on track.
- **`three-adjective-stacks-not-caught`** — No guard for "X, Y, and Z" adjective stacks; low priority given false-positive risk (e.g. "ducted, ductless, and dual-fuel"). Make any rule narrow.

---

## What was checked and found clean

- **Federal credits / OBBBA** — CSV data, `isExpired()` logic, census-tract gating, and user-facing copy all correct as of 2026-06-25 (30C active 5 more days; monitor `2026-06-30`).
- **Mass Save $8,500 cap** — guard active, zero stale `$10,000` references.
- **E-E-A-T** — P.E./Ph.D./PMP byline, schema honorificSuffix, and scoped structural-engineer caveat present on `/about/` source and live.
- **State-page disclaimers** — "verify with administrator" present and positioned across all 8 calculator-state templates, live-confirmed.
- **Source traceability** — 49/51 CSVs carry resolvable `source_id`; validator enforces it at test time.
- **Panel labor-hour cap** — correctly calibrated to the $7.5K CA ceiling; test gate green.
- **Build/test/parity** — 7/7 test stages, clean build, 697-URL sitemap with correct namespace, repo in sync with live.
- **SEO fundamentals** — meta descriptions, canonicals, breadcrumb + WebApplication/FAQPage JSON-LD, single H1 per page, robots.txt — all clean except the two 1-char edge cases above.

---

## Refuted / non-issues appendix

The orchestrator's verified set dropped **no findings** during adversarial re-confirmation (`REFUTED / DROPPED: []`). For transparency, the items that *survived* re-confirmation but had their **original framing corrected or severity adjusted** are noted inline above so the reader can trust the rigor:

- `hardcoded-panel-cost-faq` (P1) — kept; corrected the "material_low/high" attribution (actually `base_low/high`) and the "omits labor entirely" claim (labor is included, imprecisely).
- `conversion-tracking-gap` — downgraded **P1→P2**; "31 of 37" corrected to **32 of 37**; not a shared-pattern fix (32 separate islands).
- `panel-upgrade-labor-hours-capped-correctly` — downgraded **P1→P2** (verified-clean data; finding's own math had a wrong labor rate, `$95` vs actual `$110`).
- `data-governance-missing-source-id` — held at **P2** (not a correctness bug; `source_id` is optional by design, `source_url` provides attribution).
- `source-id-resolution-complete` — confirmed clean; unique source_id count corrected **137 → 152**.

Separately, the prior **Codex (2026-06-25) audit's false-missing claims** — Project Simulator, privacy/terms, water-heater state pages, and the heat-pump-replacement page — were **not reproduced**; all exist in source and live, consistent with the known-correct ground truth. They are listed here only to confirm they were checked and rejected.
