# `data/csv/` — single source of truth for every numeric/data table

Every "database of numbers" the calculator engine consumes lives here. CSV columns use
`snake_case`. The runtime reads the CSVs at build time via Vite's `?raw` query (which
uses Node `fs` under the hood) and parses them with the in-house splitter in
`src/lib/data.ts`. The Node smoke-test (`scripts/smoke-test.cjs`) reads the same files
directly with `fs.readFileSync`.

These files are designed to round-trip cleanly through Google Sheets — open any of them
in Sheets, edit the numbers, then "Download → Comma-separated values (.csv)" back to
the same path. The build will fail fast if a table loads zero rows (see
`requireRows()` in `src/lib/data.ts`).

If you remove or rename a CSV, also update the imports at the top of `src/lib/data.ts`
**and** the file list in `scripts/smoke-test.cjs`.

---

## Files

### `project-cost-ranges.csv`
Per-module cost scenarios (the equipment + labor + permit anchors for each
project type).

| Column | Units | Notes |
|---|---|---|
| `module` | enum | `heat_pump` / `ev_charger` / `panel` / `hpwh` / `induction` |
| `scenario` | string | Scenario id (e.g. `ducted_central_3ton`) |
| `unit` | string | Unit of installation (e.g. `system`) |
| `base_low` / `base_mid` / `base_high` | USD | Reserved for direct anchor numbers (engine uses material + labor + permit components instead) |
| `material_low` / `_mid` / `_high` | USD | Equipment / parts cost band |
| `labor_hours_low` / `_mid` / `_high` | hours | Multiplied by module hourly rate × state multiplier |
| `permit_low` / `_mid` / `_high` | USD | Permit and inspection fees |
| `notes` | string | Free-text |
| `source_id` | string | Foreign key into `src/data/source-notes.json` |
| `last_reviewed` | ISO date | YYYY-MM-DD |

Consumed by: `getCostScenarios()`, `findCostScenario()` in `src/lib/data.ts`;
the engine in `src/lib/calc.ts`.

### `state-labor-multipliers.csv`
Per-state cost-of-labor multipliers, anchored to BLS OEWS data.

| Column | Units | Notes |
|---|---|---|
| `state` | string | 2-letter postal code (`AL`, `AK`, …, `DC`) |
| `state_name` | string | Long name |
| `electrician_multiplier` | dimensionless | `1.00` = U.S. average |
| `hvac_multiplier` | dimensionless | |
| `plumber_multiplier` | dimensionless | |
| `permit_avg` | USD | Typical per-permit average for the state |
| `notes` | string | Free-text |

Consumed by: `findStateLabor()`, `ALL_STATES` derived list, every calculator
component (state dropdown), `heat-pump-cost-[state].astro`.

### `state-energy-prices.csv`
Per-state retail energy prices, anchored to EIA monthly retail series.

| Column | Units |
|---|---|
| `state` | string (2-letter) |
| `state_name` | string |
| `electricity_cents_per_kwh` | ¢/kWh |
| `natural_gas_dollars_per_therm` | $/therm |
| `propane_dollars_per_gallon` | $/gal |
| `heating_oil_dollars_per_gallon` | $/gal |
| `source_id` | string |
| `last_reviewed` | ISO date |
| `notes` | string |

Consumed by: `findStateEnergy()` plus the operating-cost engine in `calc.ts`.

### `rebate-programs.csv`
Federal / state / utility incentive programs (25C, 30C, HEEHRA, NYSERDA, Mass Save,
TECH CA, …).

| Column | Notes |
|---|---|
| `program_id` | Stable identifier (`FED_25C_HP`, `MA_MASSAVE_HP`, …) |
| `scope` | `federal` / `state` / `utility` |
| `state` | State postal code or `US` |
| `utility` | Utility name (when applicable) |
| `module` | `heat_pump` / `ev_charger` / `panel` / `hpwh` / `induction` (or empty for cross-module) |
| `program_name` | Human-readable |
| `incentive_type` | `tax_credit` / `rebate` |
| `amount_low` / `_mid` / `_high` | USD; flat-amount programs |
| `percent` | % of cost; percentage-of-cost programs (set `0` for flat-amount) |
| `cap` | USD; per-program annual / lifetime cap |
| `income_rule` | `none` / `income_qualified` / etc. |
| `eligible_equipment` | Free-text |
| `expiration_date` | ISO date or empty |
| `status` | `active` / `state_rolling_out` / `placeholder` |
| `source_url` | Primary citation |
| `last_reviewed` | ISO date |
| `notes` | Free-text |

Consumed by: `getRebatesFor()`, `rebatePrograms`, the rebates page, every state page.

### `climate-zones.csv`
Per-state climate-zone band, used by the heat-pump operating-cost model.

| Column | Units |
|---|---|
| `state` / `state_name` | string |
| `iecc_zone` | string (`3A`, `5B`, etc.) |
| `heating_degree_days` | HDD base 65°F |
| `cooling_degree_days` | CDD base 65°F |
| `heat_pump_class` | `standard` or `coldclimate` |
| `notes` | Free-text |

Consumed by: `findClimate()`; the heat-pump operating-cost branch in `calc.ts`.

### `panel-upgrade-risk-rules.csv`
Probability-of-upgrade matrix indexed by `trigger_module × current_panel`.

| Column | Notes |
|---|---|
| `rule_id` | `PR01`, `PR02`, … |
| `trigger_module` | which calculator the rule applies to |
| `current_panel` | `unknown` / `60A` / `100A` / `125A` / `150A` / `200A` / `320/400A` |
| `target_addition` | Free-text describing the load being added |
| `risk_level` | `minimal` / `low` / `medium` / `high` / `critical` |
| `upgrade_recommendation` | Free-text |
| `explanation` | Sentence shown to the user in the panel-risk card |

Consumed by: `getPanelRisk()`; the `panelAdderForModule()` function in `calc.ts`
combines `risk_level` with the matching row of `panel-risk-factors.csv`.

### `cost-multipliers.csv` *(new in this refactor)*
The difficulty / home-type / timing multipliers that used to be hardcoded `switch`
statements in `calc.ts`. One row per `(factor_type, factor_key)` combination.

| Column | Notes |
|---|---|
| `factor_type` | `difficulty` / `home_type` / `timing` |
| `factor_key` | The enum value (e.g. `simple`, `condo`, `emergency`) |
| `low` / `mid` / `high` | Multiplier band applied to gross cost |
| `notes` | Free-text |

Consumed by: `findCostMultiplier()` in `data.ts`; the `difficultyMultiplier()`,
`homeTypeMultiplier()`, `timingMultiplier()` functions in `calc.ts`.

### `module-labor-rates.csv` *(new in this refactor)*
Hourly labor rates by module — previously hardcoded in `laborRateForModule()`.

| Column | Units |
|---|---|
| `module` | enum |
| `hourly_rate_usd` | USD/hr |
| `notes` | string |

Consumed by: `findModuleLaborRate()` in `data.ts`; `laborRateForModule()` in `calc.ts`.

### `panel-risk-factors.csv` *(new in this refactor)*
Probability-weighted upgrade factor for each `risk_level`, plus a low/high spread
that captures the uncertainty.

| Column | Notes |
|---|---|
| `risk_level` | `minimal` / `low` / `medium` / `high` / `critical` |
| `factor` | Probability-weighted multiplier on the panel-upgrade base cost (0 → 1) |
| `low_spread` | Multiplier on the low end (typically `0.90`) |
| `high_spread` | Multiplier on the high end (typically `1.10`) |
| `notes` | Free-text |

Consumed by: `findPanelRiskFactor()` in `data.ts`; the panel adder branch in
`calc.ts`.

### `addons-bands.csv` *(new in this refactor)*
Discrete add-on cost bands previously hardcoded in calculator components:
ductwork penalties, HPWH tight-space and removal, induction circuit / gas-cap /
cookware.

| Column | Units |
|---|---|
| `addon_id` | Stable identifier (`ductwork_repair_poor`, `induction_240v_circuit`, …) |
| `module` | which module owns the add-on |
| `low` / `mid` / `high` | USD band |
| `notes` | Free-text |

Consumed by: `findAddonBand()` in `data.ts`; called from
`HeatPumpCalculator.tsx` (ductwork), `HpwhCalculator.tsx` (tight space, removal),
`InductionCalculator.tsx` (240V circuit, gas line cap, cookware).

### `operating-cost-constants.csv` *(new in this refactor)*
Physics / model constants for the operating-cost change calculation: UA factor,
heat-pump COPs, oversize factors, BTU conversions, HPWH baselines, EV kWh and
gasoline anchor, induction baseline savings, uncertainty spreads.

| Column | Notes |
|---|---|
| `constant_id` | Stable identifier (e.g. `hp_ua_per_sqft`) |
| `value` | Numeric value |
| `units` | Free-text units description |
| `notes` | Free-text |

Consumed by: `findOperatingCostConstant()` in `data.ts`; the
`computeAnnualOperatingChange()` function in `calc.ts`. The smoke-test references
the same constants by id.

---

## Editing checklist

1. Open the CSV in your editor or Google Sheets.
2. Edit cells. Don't reorder columns.
3. If you add or remove a row that's referenced by `addon_id` /
   `constant_id` / `factor_type+factor_key` / `risk_level` / `module`, also
   update the corresponding lookup name in `src/lib/calc.ts` or the calculator
   component that calls `findAddonBand()` / `findOperatingCostConstant()` /
   etc. The build will throw if a key goes missing.
4. Run `npm test` — the smoke-test reads the same CSVs and asserts the
   `low ≤ mid ≤ high` invariant on every scenario.
5. Run `npx tsc --noEmit` — clean.
6. Run `npm run build` — Astro/Vite will catch any missing CSV at build time.

## Stale files

The original CSVs are still on disk under `src/data/` because the cowork
session can't delete files there. They are no longer imported anywhere in the
code. **Delete them manually before committing** so the source of truth stays
unambiguous.
