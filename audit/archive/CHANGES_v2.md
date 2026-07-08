# ElectrifyCost — Part-1 refactor changes (CSV layer + local-server)

**Date:** 2026-05-08
**Predecessor:** [`audit/CHANGES.md`](CHANGES.md) (truncation fixes + IRA/OBBBA copy)
**Validation:** `npm test` 13/13 ✓; `npx tsc --noEmit` clean ✓; `node local-server.js` walk ✓ (HTML/CSV/MD/JSON all serve with correct MIME and CORS; 404 returns 404; OPTIONS returns 204; DELETE returns 405).

This pass ports every "database of numbers" out of TS/JS into editable CSVs under `data/csv/` and adds a zero-dependency `local-server.js` for static walks. The runtime calculator and the smoke-test now read the same files. Nothing in the calculator math itself changed; the engine's outputs match v1 byte-for-byte across all 13 smoke-test scenarios.

---

## 1 — New top-level layout

```
data/
└── csv/
    ├── README.md                          NEW: per-CSV column docs + editing checklist
    ├── project-cost-ranges.csv            MOVED from src/data/
    ├── state-labor-multipliers.csv        MOVED from src/data/
    ├── state-energy-prices.csv            MOVED from src/data/
    ├── rebate-programs.csv                MOVED from src/data/
    ├── climate-zones.csv                  MOVED from src/data/
    ├── panel-upgrade-risk-rules.csv       MOVED from src/data/
    ├── cost-multipliers.csv               NEW: difficulty / home_type / timing factors
    ├── module-labor-rates.csv             NEW: hourly rate by module
    ├── panel-risk-factors.csv             NEW: probability-weighted upgrade factors
    ├── addons-bands.csv                   NEW: ductwork / tight-space / induction add-ons
    └── operating-cost-constants.csv       NEW: COPs / BTU constants / baselines / spreads
local-server.js                            NEW: zero-dep static server (port 4173)
```

`src/data/` retains only the *non-numeric* JSON tables (`contractor-checklists.json`, `glossary.json`, `source-notes.json`) — text/copy that doesn't fit the spreadsheet round-trip workflow and that the user explicitly said should stay where they are.

---

## 2 — New CSVs (data extracted from TS)

Five new CSVs hold tables that were previously hardcoded in TypeScript. The numeric values are unchanged from the v1 engine — only their location changed.

### `data/csv/cost-multipliers.csv`
The `difficulty` / `home_type` / `timing` cost-band multipliers that used to be `switch` statements in `src/lib/calc.ts` (`difficultyMultiplier()`, `homeTypeMultiplier()`, `timingMultiplier()`). Eleven rows: 3 difficulties × 1 + 4 home types × 1 + 3 timings × 1 = 10 keyed rows + nothing extra; one row per `(factor_type, factor_key)`.

### `data/csv/module-labor-rates.csv`
Per-module hourly labor rates ($110–$130/hr), previously hardcoded in `laborRateForModule()` in `calc.ts`. Five rows.

### `data/csv/panel-risk-factors.csv`
Probability-weighted multipliers per `risk_level` plus the `low_spread`/`high_spread` (0.9 / 1.1) used inside `panelAdderForModule()`. Five rows.

### `data/csv/addons-bands.csv`
Six itemized add-on bands previously hardcoded in calculator components:

| addon_id | Was hardcoded in | Band ($) |
|---|---|---|
| `ductwork_repair_poor` | `HeatPumpCalculator.ductworkPenaltyFor()` | 500 / 1500 / 2500 |
| `ductwork_replace_none` | same | 3500 / 6000 / 9000 |
| `hpwh_tight_space` | `HpwhCalculator.tightSpacePenaltyFor()` | 200 / 400 / 700 |
| `hpwh_removal_old_unit` | `HpwhCalculator` (`removalAdder = removeOld ? 200 : 0`) | 140 / 200 / 260 |
| `induction_240v_circuit` | `InductionCalculator` | 400 / 750 / 1300 |
| `induction_gas_line_cap` | same | 150 / 275 / 450 |
| `induction_cookware_starter` | same | 75 / 200 / 450 |

### `data/csv/operating-cost-constants.csv`
Twenty-four operating-cost / model constants (UA factor, COPs, oversize factors, BTU conversions, HPWH baselines, EV kWh / gasoline anchor, induction baseline savings, uncertainty spreads). Previously these were inline magic numbers in `computeAnnualOperatingChange()`.

---

## 3 — Code changes

### `src/lib/data.ts`
- New imports for the five new CSVs plus path-updated imports for the six existing CSVs (now under `../../data/csv/`).
- New typed exports: `costMultipliers`, `moduleLaborRates`, `panelRiskFactors`, `addonBands`, `operatingCostConstants`.
- New typed lookup helpers: `findCostMultiplier(factor_type, factor_key)`, `findModuleLaborRate(module)`, `findPanelRiskFactor(risk_level)`, `findAddonBand(addon_id)`, `findOperatingCostConstant(constant_id)`. Each throws a clear "missing row" error if the key isn't found.
- New `requireRows()` build-time fail-fast guard: every CSV-derived `export const` is wrapped so that if any table loads zero rows the build dies during `astro build` rather than silently shipping zero values.
- Numeric coercion expanded for the new column names: `low`, `mid`, `high`, `hourly_rate_usd`, `factor`, `low_spread`, `high_spread`, `value`.
- The JSON imports (`contractor-checklists`, `source-notes`) still resolve via the existing `@/data/...` alias.

### `src/lib/calc.ts`
- Removed the hardcoded `switch (d)`/`switch (t)`/`switch (module)` statements that produced multipliers and labor rates. They now defer to `findCostMultiplier()` / `findModuleLaborRate()`.
- Removed the inline panel-risk factor literals (`0.40 / 0.75 / 1.00` and the `0.9 / 1.1` spread); replaced with `findPanelRiskFactor(risk.risk_level)` lookup.
- Replaced every operating-cost magic number (`0.15`, `3.0`, `2.6`, `1.18`, `1.20`, `100000`, `91500`, `138500`, `3412`, `4500`, `240`, `220`, `215`, `-10`, `-25`, `3600`, `1400`, `0.30`, `0.50`, `0.20`, `30`, `60`, `20`) with `findOperatingCostConstant('<id>')` lookups against `operating-cost-constants.csv`. The neutral-direction threshold also moved into the CSV.
- The `spread()` helper is now called with explicit `frac` and `floor` arguments (sourced from the CSV) instead of relying on default-parameter constants.
- No change to the public API. `runCalculator(args)` returns the same shape and the same numbers given the same inputs.

### `src/components/HeatPumpCalculator.tsx`
- `ductworkPenaltyFor()` now reads `findAddonBand('ductwork_repair_poor')` and `findAddonBand('ductwork_replace_none')` instead of literal bands.

### `src/components/HpwhCalculator.tsx`
- `tightSpacePenaltyFor()` reads `findAddonBand('hpwh_tight_space')`.
- The `removalAdder` anchor (was `200`) reads `findAddonBand('hpwh_removal_old_unit').mid`.

### `src/components/InductionCalculator.tsx`
- 240V circuit, gas-cap, and cookware bands all source from `findAddonBand(...)`.

### `scripts/smoke-test.cjs`
- Mirrors the CSV refactor end-to-end: reads all eleven CSVs from `data/csv/`, looks up multipliers / labor rates / panel-risk factors / operating-cost constants by key, no hardcoded duplicates.
- New `require1()` data-load guard mirrors `requireRows()` in `data.ts`.
- New `assertOrdered()` helper asserts the `low ≤ mid ≤ high` invariant on every scenario's `gross` and `net` bands.
- The script now exits non-zero (`process.exit(1)`) when any data-load check fails, any scenario throws, or any band-ordering assertion fails. (Audit v1 §6-low called this out — fixed.)

### `README.md`
- New "Where the numbers live" section pointing readers at `data/csv/` and `data/csv/README.md`.
- New "Static-server walk" subsection documenting `node local-server.js`.
- Updated project-tree section: `src/data/` now only contains JSON; numeric tables live under `data/csv/`.

### `local-server.js` (new)
- Zero-dependency Node static server, ~130 LOC, ESM (project is `"type": "module"`).
- Built only on `node:http` / `node:fs` / `node:path` / `node:url`.
- Listens on `127.0.0.1:4173` (override with `PORT=...`); root is `process.argv[2] || cwd`.
- Correct MIME types for `.html`/`.htm`/`.js`/`.mjs`/`.cjs`/`.css`/`.json`/`.csv`/`.tsv`/`.md`/`.txt`/`.svg`/`.png`/`.jpg`/`.jpeg`/`.gif`/`.webp`/`.ico`/`.woff`/`.woff2`/`.ttf`/`.otf`/`.xml`/`.map`/`.wasm`.
- Permissive CORS (`Access-Control-Allow-Origin: *`) so a separate `astro dev` instance, devtools, or a notebook can fetch the CSVs without preflight friction.
- `..`-traversal blocked: `path.normalize` + `abs.startsWith(ROOT)`.
- `OPTIONS` returns 204; non-GET/HEAD return 405 with `Allow:` header.
- Directory listing fallback when no `index.html` is present (handy for browsing `/data/csv/`).
- Used during verification — see §5.

---

## 4 — Files added / changed / left alone

**Added (new files):**
- `data/csv/README.md`
- `data/csv/cost-multipliers.csv`
- `data/csv/module-labor-rates.csv`
- `data/csv/panel-risk-factors.csv`
- `data/csv/addons-bands.csv`
- `data/csv/operating-cost-constants.csv`
- `local-server.js`
- `audit/AUDIT_v2.md`
- `audit/CHANGES_v2.md` (this file)

**Moved (existing CSVs relocated to `data/csv/`):**
- `project-cost-ranges.csv`
- `state-labor-multipliers.csv`
- `state-energy-prices.csv`
- `rebate-programs.csv`
- `climate-zones.csv`
- `panel-upgrade-risk-rules.csv`

**Changed:**
- `src/lib/data.ts` — new imports, types, helpers, `requireRows` guard
- `src/lib/calc.ts` — removed hardcoded numeric literals, all reads via lookups
- `src/components/HeatPumpCalculator.tsx` — ductwork bands via `findAddonBand`
- `src/components/HpwhCalculator.tsx` — tight-space + removal anchor via `findAddonBand`
- `src/components/InductionCalculator.tsx` — circuit + gas-cap + cookware via `findAddonBand`
- `scripts/smoke-test.cjs` — read from `data/csv/`, fail-fast, assertions, non-zero exit
- `README.md` — CSV layer + local-server docs

**Left alone (unchanged):**
- `src/data/contractor-checklists.json`, `src/data/glossary.json`, `src/data/source-notes.json` — these are text/copy, not numeric tables. The user explicitly said FAQ text and copy strings stay where they are.
- All `src/pages/*.astro` files — the page templates already get their numbers via `data.ts` and didn't need any change. (Verified: only state pages hit `rebatePrograms` / `findStateLabor` / `findStateEnergy` / `findClimate` directly, and those imports still work.)
- `src/components/Layout.astro`, `Header.astro`, `Footer.astro`, `ResultPanel.tsx`, `EvChargerCalculator.tsx`, `PanelCalculator.tsx` — none of them held numeric tables.
- `astro.config.mjs`, `tailwind.config.mjs`, `tsconfig.json`, `vercel.json`, `package.json` — no config change needed (Vite resolves `?raw` from anywhere within the project root).
- `public/`, `DEPLOY.md`, `.env.example` — unchanged.

**Stale files left in place (could not be deleted — Cowork file-delete permission denied):**
- `src/data/project-cost-ranges.csv`
- `src/data/state-labor-multipliers.csv`
- `src/data/state-energy-prices.csv`
- `src/data/rebate-programs.csv`
- `src/data/climate-zones.csv`
- `src/data/panel-upgrade-risk-rules.csv`

These CSVs are no longer imported by any code (verified by grepping every `src/**` for `src/data/*.csv` references — only the JSON files are referenced, never the CSVs). They're orphans and should be deleted manually before the next commit so the source of truth stays unambiguous. The `data/csv/README.md` "Stale files" section calls this out.

---

## 5 — Verification

### `npx tsc --noEmit -p tsconfig.json`
Clean — exit 0.

### `npm test` (smoke-test, 13 scenarios)
All 13 pass. Sample output:

```
* HP CA mid 100A gas
  gross: $7,825 / $13,225 / $22,275
  net:   $5,825 / $11,225 / $20,275
  ...
* HPWH 240V 50gal CA gas
  gross: $2,125 / $3,500 / $6,250
  net:   $0 / $1,450 / $5,125
* Induction range CA 100A
  gross: $1,350 / $2,475 / $4,350
  net:   $1,350 / $2,475 / $4,350

OK: 13 scenarios passed.
```

Numbers match v1 (`audit/AUDIT.md` Appendix B) byte-for-byte, confirming the CSV refactor is value-preserving.

### `npm run build`
Same environmental failure as v1 audit: `Cannot find module @rollup/rollup-linux-x64-gnu`. The `node_modules` was installed under Windows; this Linux sandbox can't fetch the missing optional binary (`npm install --no-save @rollup/rollup-linux-x64-gnu` returns 403 from the registry mirror). **Not a code regression.** A clean `rm -rf node_modules package-lock.json && npm install` on the deploy target (Vercel = Linux) will resolve it. The audit v1 already documented this.

### `node local-server.js` walk
Server boots on first try, prints the listening line, serves all four content types correctly:

```
ROOT:    200 ctype=text/html; charset=utf-8 size=1150
CSV:     200 ctype=text/csv; charset=utf-8 size=806
MD:      200 ctype=text/markdown; charset=utf-8 size=9158
JSON:    200 ctype=application/json; charset=utf-8 size=730
404:     404
OPTIONS: 204
TRAVERSE_DOTDOT: 404
METHOD_DELETE:   405
```

CORS headers present on every response (`Access-Control-Allow-Origin: *` etc.). `Content-Length` matches file size on disk. Path traversal (`/../etc/passwd`) is blocked. Directory listing renders correctly when there's no `index.html` (verified at `/data/csv/`).

---

## 6 — Items NOT done (deferred / out of scope)

- Deleting the now-orphaned CSVs in `src/data/` (Cowork can't delete user files; user must `rm` them locally).
- Wiring `track()` calls into the calculator components (still deferred from v1 audit; analytics.ts remains a stub).
- Adding the 4 missing programmatic state-page templates (`ev-charger-installation-cost-[state]`, `electrical-panel-upgrade-cost-[state]`, `heat-pump-water-heater-cost-[state]`, `induction-stove-cost-[state]`).
- Adding GitHub Actions CI (would catch a future truncation event the same way the audit caught the v1 one).
- Adding `LICENSE`, `CONTRIBUTING.md`, `CHANGELOG.md`.
- Producing the actual `og-default.png` (1200×630) — meta tag is wired in v1, still no asset on disk.
- New content pages from §2 of the v1 audit (programmatic state matrix; comparison pages; spending guides).

These are listed in `audit/AUDIT_v2.md` §2 / §11 with priorities.
