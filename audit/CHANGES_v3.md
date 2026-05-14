# ElectrifyCost — v3 changes (trust/correctness, ZIP↔state, ad/affiliate scaffolding)

**Date:** 2026-05-11
**Predecessors:** [`audit/CHANGES.md`](CHANGES.md) (v1: truncation + IRA/OBBBA), [`audit/CHANGES_v2.md`](CHANGES_v2.md) (CSV refactor + local-server).
**Brief:** the comprehensive audit pasted by the user on 2026-05-11 (Phase 1 trust/correctness; Phase 2 quote-check + input upgrades; Phase 3 SEO expansion; Phase 4 monetization layer).
**Validation:** `npx tsc --noEmit` clean ✓; `npm test` 13 scenarios + 7 targeted assertions pass ✓; `node local-server.js` walk ✓.

This pass ships Phase 1 in full, the highest-value pieces of Phase 2 (shared bid-check) and Phase 4 (gated ad slots, affiliate scaffolding), plus the OG image asset from Phase 3. The bulk of Phase 2 (rich per-module inputs) and Phase 3 (programmatic state pages × 4 modules, hub pages, comparison pages, data pages) are explicitly deferred to a follow-up session because each is a multi-hour content effort on top of the calculator engine work that landed here.

---

## 1 — Trust & correctness (Phase 1, complete)

### 1.1 Date-aware incentive filter
`src/lib/calc.ts` adds `isExpired(expiration_date, today)` and skips expired programs inside `buildIncentiveLines()`. Programs whose `expiration_date` is a parseable `YYYY-MM-DD` and lexicographically less than `today` are excluded from both `applied` and `potential` arrays. `today` is configurable via `CalcArgs.asOf?: string` so the smoke-test can pin historical dates.

### 1.2 25C flipped to `status=expired`
`data/csv/rebate-programs.csv`: `FED_25C_HP`, `FED_25C_HPWH`, and `FED_25C_PANEL` flipped from `status=active` to `status=expired`. Rows are retained for historical context and explicit notes added in the CSV. The engine's date filter (§1.1) means these never appear in 2026-forward output regardless of the `status` column — belt-and-suspenders.

### 1.3 Applied vs. potential incentives
`CalculatorResult` now exposes two arrays:
- `incentives: IncentiveLineItem[]` — confirmed; subtracted from `netAfterIncentives`.
- `potentialIncentives: IncentiveLineItem[]` — eligibility not yet confirmed; **not** subtracted.

The audit's biggest UX-trust complaint was that 30C-unknown subtracted from net. Now: when `eligibleCensusTract === 'unknown'`, the 30C credit lands in `potentialIncentives`. When `'yes'`, it lands in `incentives`. When `'no'`, it's excluded entirely. Same split applies to DOE Home Energy Rebates that the user's state hasn't launched (see §1.4).

`ResultPanel.tsx` renders potential incentives in an amber-tinted card titled "Possible additional incentives" with the caveat "These are not subtracted from the net cost above because eligibility isn't confirmed for your address yet."

### 1.4 HEEHRA state-rollout gate
New `data/csv/home-energy-rebate-status.csv` with 51 rows (50 states + DC), columns: `state, program, status, administrator, source_url, last_reviewed, notes`. Statuses are `open`, `reserved`, `closed`, `prelaunch`, `unknown`. As of audit date, 13 states are populated as `open` (AZ, CO, DC, GA, HI, IL, ME, MA, MN, NM, NY, NC, OR, RI, VT, WA), CA as `reserved` (single-family fully reserved), the rest as `prelaunch`. The list is conservative on purpose — flipping a row to `open` is one CSV edit.

`buildIncentiveLines()` looks up the state's status via `findHomeEnergyRebateStatus()`. If status isn't `open`, the program goes to `potentialIncentives` with a status-specific caveat ("Program not yet launched in your state", "Funding reserved", etc.).

### 1.5 Past-tense 25C copy across the site
- `src/pages/index.astro`: hero copy bumped from "ZIP-aware" (which was a lie — ZIP wasn't actually used) to "Type a ZIP and we auto-detect your state". Sample preview card swapped `Federal 25C −$2,000` for `25C federal credit ended Dec 31 2025`. Sample net cost bumped accordingly. "Apply federal credits (25C, 30C)…" line rewritten to lead with 30C (still live) and past-tense 25C.
- `src/pages/rebates.astro`: the "currently scheduled to apply through December 31, 2025" sentence rewritten to past-tense with an inline `<span class="font-medium">expired</span>` note for clarity.
- `src/pages/heat-pump-cost-[state].astro`: FAQ #3 (Rebates) rewritten — no more "stack 25C" claim. Now: "In 2026 the federal 25C credit no longer applies…" with an explicit note about how the calculator separates confirmed credits from potential ones.
- `src/pages/methodology.astro`: "Incentives reflect federal credits (IRC §25C and §30C)…" rewritten to lead with 30C and explain the date filter. Added a new "Incentive freshness policy" subsection explaining the applied vs. potential split.
- `src/pages/sources.astro`: stale `src/data/` pointer updated to `data/csv/` (v2 carry-over fixed in this pass).

### 1.6 Smoke-test rewritten for new semantics
`scripts/smoke-test.cjs` mirrors the engine's date filter and state-status gate. 13 existing scenarios still pass (default `today` strips 25C). Seven new targeted assertion groups added:
- **30C `unknown`** → not in `applied`, **is** in `potential`.
- **30C `yes`** → in `applied`, not in `potential`.
- **30C `no`** → excluded from both arrays.
- **HEEHRA in `prelaunch` state (TX)** → not in `applied`, in `potential`.
- **HEEHRA in `open` state (NY)** → in `applied`.
- **25C with `asOf=2025-06-01`** → applies historically (regression guard).
- **25C with `asOf=2026-05-08`** → not applied; not even surfaced as potential.

The script exits non-zero on any assertion failure.

### 1.7 Engine errors surface in `ResultPanel`
The calculator components previously did `try { runCalculator(args); } catch { return null; }`, which silently rendered the empty-state copy ("Enter your details on the left…") whenever the engine threw. With the now-dynamic CSV layer, a missing CSV row throws a precise message — those messages should reach the user.

Each calculator now returns `{ result, error }` from its `useMemo`. `ResultPanel` accepts an `error?: string | null` prop and renders a clear `role="alert"` banner ("Couldn't compute an estimate") with the engine message when set.

### 1.8 ZIP ↔ state sync
New `data/csv/zip-to-state.csv` with 56 rows: state ZIP-range mappings (including multi-range states — DC has two, TX has four, etc., to handle non-contiguous prefixes). New helper `findStateForZip(zip)` in `data.ts` returns the matching state code (first-match-wins; DC ranges are tighter than MD's so DC wins by ordering).

Each of the 5 calculator components watches the `zip` state via `useEffect`; when ZIP reaches 5 digits and resolves to a state, the state dropdown auto-updates. The user can still pick a state manually after.

Visible UI confirmation: when ZIP is 5 digits the label now reads `ZIP (state auto-set from ZIP)` in brand-green; otherwise `ZIP (optional — auto-sets state)` in ink-600. Users see the sync happen.

The homepage's stale "ZIP-aware" claim is now actually accurate.

---

## 2 — Phase 2.1 (shared bid-check) and Phase 2.4 (panel-risk table gaps) — done

### 2.1 Shared QuoteCheckPanel
The bid-check pattern that previously only lived inside `PanelCalculator` was extracted into a `<QuoteCheck>` component inside `ResultPanel.tsx`. Every calculator now passes `contractorQuote={...}` to `ResultPanel`, and `ResultPanel` renders the bid-check block whenever a quote is set.

The block shows:
- a headline coloring quote-vs-band (brand green = in range, amber = below low, rose = above high)
- the user's quote and the typical range
- a contextual checklist ("Ask the contractor to itemize…" when high; "Confirm permits, grounding, code…" when low)

Wires into all 5 calculators in one shared component. Closes the audit's "high-value-for-monetization" call-out about quote-comparison users being high-intent.

### 2.4 Panel-risk table gaps filled
`data/csv/panel-upgrade-risk-rules.csv` now has 28 rules (up from 18). Added:
- `ev_charger × 320/400A` and `heat_pump × 320/400A` (1 each)
- `hpwh × {unknown, 125A, 150A, 320/400A}` (4 new)
- `induction × {unknown, 125A, 150A, 320/400A}` (4 new)

Full 5-module × 7-panel-size matrix now covered (with `induction × unknown` defaulting to medium-risk, recommending a load assessment).

---

## 3 — Phase 3.5 (OG image) and Phase 4.1/4.2 (monetization scaffolding) — done

### 3.5 og-default.png
`public/og-default.png` — 1200×630 PNG, 46 KB, generated via Pillow (Python). Layout:
- Top accent stripe in brand green
- Subtle 60×60 grid background
- Brand-name heading
- Tagline + module list
- Four KPI bullets (low/mid/high ranges, date-aware rebates, state labor + energy, no-email promise)
- Domain footer

Layout.astro's `og:image` meta tag was already wired in v1; the asset now exists.

### 4.1 Ad slots hidden behind PUBLIC_ADS_ENABLED
New `src/components/AdSlot.astro`. Renders nothing user-visible unless `import.meta.env.PUBLIC_ADS_ENABLED === 'true'`. CLS-safe container preserved for when ads turn on. All 5 calculator pages updated to use `<AdSlot />` instead of the literal `<div class="ad-slot">Ad slot reserved</div>` text. Users no longer see "Ad slot reserved" in production.

(The state heat-pump page and homepage retain the original literal — sed didn't match through the truncated mount view of those longer files. To complete: replace those 2 remaining instances with `<AdSlot />` and add the import. Two-line manual edit per file.)

### 4.2 Affiliate scaffolding
New `src/components/AffiliateDisclosure.astro` — FTC-compliant disclosure shown above any affiliate-linked product list. Always rendered when an `AffiliateModule` is present; not gated.

New `src/components/AffiliateModule.astro` — reserved slot keyed by module kind (`ev_charger | load_management | induction | hpwh | heat_pump`). Renders nothing unless `PUBLIC_AFFILIATES_ENABLED === 'true'`. CLS-safe.

Both components are wired but not yet placed on any page — that's the right boundary because the audit recommended scaffolding only, not real product lists, until accuracy lands first.

---

## 4 — Files added / changed

**Added:**
- `data/csv/home-energy-rebate-status.csv` — 51 rows of HEEHRA rollout status
- `data/csv/zip-to-state.csv` — 56 ZIP-range rows
- `public/og-default.png` — 1200×630 social preview asset
- `src/components/AdSlot.astro`
- `src/components/AffiliateDisclosure.astro`
- `src/components/AffiliateModule.astro`
- `audit/CHANGES_v3.md` (this file)

**Modified:**
- `src/lib/calc.ts` — `isExpired()`, applied/potential split, state-status gate, `today`/`asOf` plumbing, `potentialIncentives` field on `CalculatorResult`
- `src/lib/data.ts` — `HomeEnergyRebateRow`, `findHomeEnergyRebateStatus()`, `ZipToStateRow`, `findStateForZip()` + the two CSV imports
- `src/components/ResultPanel.tsx` — `error?` and `contractorQuote?` props; QuoteCheck component; potential-incentives card; share-text updated
- `src/components/HeatPumpCalculator.tsx` + `EvChargerCalculator.tsx` + `HpwhCalculator.tsx` + `InductionCalculator.tsx` + `PanelCalculator.tsx` — `useEffect` for ZIP→state sync; visible auto-set label; `{result, error}` tuple from useMemo; `contractorQuote` prop wired through
- `scripts/smoke-test.cjs` — mirrors engine logic; 7 new targeted assertions
- `data/csv/rebate-programs.csv` — 3 × 25C rows flipped to `expired`
- `data/csv/panel-upgrade-risk-rules.csv` — 10 new rows for previously-missing module × panel combinations
- `src/pages/index.astro` — past-tensed 25C; honest ZIP-aware copy; sample preview updated
- `src/pages/rebates.astro` — 25C past-tensed; v3 freshness language
- `src/pages/heat-pump-cost-[state].astro` — FAQ #3 rewritten for 2026
- `src/pages/methodology.astro` — incentives bullet rewritten; new "Incentive freshness policy" section
- `src/pages/sources.astro` — stale `src/data/` reference fixed
- 5 calculator pages now `import AdSlot from '@/components/AdSlot.astro'` and use `<AdSlot />`

---

## 5 — Verification

### `npx tsc --noEmit -p tsconfig.json`
Clean, exit 0.

### `npm test`
13 default scenarios + 7 targeted v3 assertions all pass. Sample output:

```
* HP CA mid 100A gas
  gross: $7,825 / $13,225 / $22,275
  net:   $7,825 / $13,225 / $22,275
  (no 25C subtracted — date filter active)

--- v3 targeted assertions ---
  30C unknown → potential only          OK
  30C yes → applied                     OK
  30C no → excluded entirely            OK
  HEEHRA prelaunch (TX) → potential     OK
  HEEHRA open (NY) → applied            OK
  25C with asOf=2025-06-01 → applied    OK
  25C with asOf=2026-05-08 → not        OK

OK: 13 scenarios + 7 targeted assertion groups passed.
```

### ZIP→state lookup spot-check
Verified 10 sample ZIPs from the live CSV: 90210→CA, 10001→NY, 33101→FL, 60601→IL, 78701→TX, 99501→AK, 01001→MA, 20500→DC, 97201→OR, 00501→NY. All correct.

### `npm run build`
Still the same Linux/Windows rollup-binary mismatch the v1/v2 audits documented (environmental, not a code regression). Verifies on Vercel or any clean Linux runner.

---

## 6 — Deferred to a follow-up session

The original brief specified four phases. Phase 1 + the high-value pieces of Phase 2 / Phase 3 / Phase 4 shipped in this pass. The following are sized for a separate session each:

### Phase 2 — remaining
- **P2.2** EV calculator richer inputs: charger amperage, wire run distance, existing-panel headroom, annual miles, EV efficiency, gasoline price, home electricity-rate override. Plumb through the operating-cost calc. Hide behind a basic/advanced toggle.
- **P2.3** HPWH inputs: household size, water-heater age, install-space volume, condensate routing. Scale `hpwh_baseline_kwh_per_year` by household size.
- **P2.5** Heat-pump advanced inputs: current annual fuel use, existing system efficiency (AFUE/HSPF override), insulation quality, existing AC. Plus a "savings confidence" badge.

These are each ~150 LOC of form work × 1 calculator + matching engine plumbing. Heavy.

### Phase 3 — programmatic SEO (deferred)
- **P3.1** Four state-permutation templates for EV charger, panel, HPWH, and induction. ~200 long-tail pages.
- **P3.2** Four hub pages (cost-by-state per module + a whole-home pillar).
- **P3.3** Four comparison pages (HP-vs-furnace, HPWH-vs-tankless, induction-vs-gas, 100A→200A).
- **P3.4** Public `/data/` pages exposing the CSVs as downloadable, citable resources.

### Phase 4 — monetization (partial; rest deferred)
- Wire `<AdSlot />` into the remaining two pages (homepage and state heat-pump template) — the sed pass didn't reach them through the mount view, so it's a 2-file manual edit.
- Place `<AffiliateModule kind="…" />` slots beneath each calculator's result panel (5 placements).
- Build the first affiliate product lists (EV chargers, induction cookware, smart-panel / load-management devices, HPWH accessories).
- Add a real analytics provider hook (audit recommended Plausible / Pirsch / GA4 click tracking).

### Other carry-forwards
- Manually delete the orphaned `src/data/*.csv` files (Cowork can't delete user files; user task).
- GitHub Actions CI (`npm ci && tsc --noEmit && npm test && npm run build`) — would have caught half of the mount-truncation surprises along the way.
- `npm run serve` script in `package.json` wrapping `node local-server.js`.

---

## 7 — Verified URLs / sources

The audit's "Source Links Checked" list was re-verified for this pass — all five primary URLs still resolve and reflect the language used in v3:

- IRS Energy Efficient Home Improvement Credit: https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit (confirms 2025-12-31 cutoff)
- IRS Form 8911 Instructions: https://www.irs.gov/instructions/i8911 (confirms 30C 2026-06-30 cutoff + eligible-census-tract rule)
- IRS Alternative Fuel Vehicle Refueling Property Credit: https://www.irs.gov/credits-deductions/alternative-fuel-vehicle-refueling-property-credit
- DOE Home Energy Rebates: https://www.energy.gov/scep/home-energy-rebates-programs (state-by-state rollout)
- AFDC Laws and Incentives: https://afdc.energy.gov/laws

The HEEHRA-status CSV's `source_url` columns all point at the DOE rollup page; the per-state administrator field is the human-readable handoff to the actual state portal. A future refresh would replace some of those with direct state-administrator URLs (NYSERDA, Mass Save, TECH CA, etc.).
