# /update-data — CSV update procedure

When the user wants to change a numeric value (cost, rebate, energy price, multiplier, etc.).

## Cardinal rule

**Numbers go in CSVs, never in code.** If you find a hardcoded number in a `.tsx` or `.astro` file that should be in a CSV, that's a bug. Move it to CSV first, then update.

The only exception: per-calculator UI defaults (e.g., `useState('CA')` for state dropdown) are UI ergonomics, not data.

## Procedure

### 1. Find the CSV

Search by likely keywords:

```bash
grep -l "<keyword>" data/csv/*.csv
```

The 49 CSVs cluster by module. The relevant ones:

| CSV | Contains |
|---|---|
| `project-cost-ranges.csv` | 5 flagship modules × multiple scenarios |
| `<module>-cost-ranges.csv` | bespoke calculator costs (one file per module) |
| `state-energy-prices.csv` | 51 rows, ¢/kWh and gas/oil/propane $/unit |
| `state-labor-multipliers.csv` | 51 rows, electrician/HVAC/plumber mult + permit_avg |
| `climate-zones.csv` | 51 rows, IECC zone + HDD/CDD + heat-pump class |
| `rebate-programs.csv` | federal + state + utility programs |
| `federal-credits.csv` | 25C/25D/30C/30D/25E + caps + expiration |
| `home-energy-rebate-status.csv` | HEEHRA per-state rollout status |
| `operating-cost-constants.csv` | physics constants (COP, UA, BTU conversions) |
| `solar-cost-ranges.csv` | $/W bands + adders |
| `solar-state-incentives.csv` | per-state solar programs |
| `solar-production-by-state.csv` | kWh/kW/yr by state |
| `battery-cost-ranges.csv` | $/kWh by chemistry + use case |
| `cost-multipliers.csv` | difficulty / home-type / timing bands |
| `module-labor-rates.csv` | hourly rate by module |
| `panel-risk-factors.csv` | upgrade probability by risk level |
| `panel-upgrade-risk-rules.csv` | risk classification per (module, panelSize) |

### 2. Verify the new value with a primary source

Don't update from "industry average" or "what Reddit says" — use a primary source:

| Domain | Primary source canon |
|---|---|
| Federal tax credits | IRS publication pages: https://www.irs.gov/credits-deductions/... |
| State programs | DSIRE: https://www.dsireusa.org/ or state energy office |
| Energy prices | EIA: https://www.eia.gov/state/ or EIA EPM Table 5.6.A |
| Equipment costs | EnergySage 2026 marketplace median, LBNL TTS, NREL benchmark studies |
| Labor rates | BLS OEWS: https://www.bls.gov/oes/ |
| Heat pump performance | NEEP ASHP database: https://ashp.neep.org/ |
| Solar production | NREL PVWatts: https://pvwatts.nrel.gov/ |

If the source isn't on this list, ask the user whether the source is credible enough.

### 3. Edit the row

Open the CSV. Update the value(s). DO NOT change other columns.

### 4. Bump `last_reviewed`

In the same row, set `last_reviewed` to today's date in `YYYY-MM-DD` format.

If you're updating multiple rows in a batch (e.g., refreshing all 51 state electricity prices from a new EIA release), bump `last_reviewed` on all of them.

### 5. Update `source_id` if the source changed

If the new value comes from a different primary source than the previous `source_id`, update `source_id` and make sure that source is documented in `src/data/source-notes.json`. If it's a new source, add an entry there too with `last_reviewed` matching.

### 6. Run the validators

```bash
node scripts/validate-csvs.cjs
node scripts/smoke-test.cjs
node scripts/new-calc-tests.cjs
```

If smoke tests fail because the new value changes a computed range, **think carefully** — the assertion may be the wrong one, or the new value may be wrong. Don't blindly bump the assertion threshold.

### 7. Cross-check the homepage card

If your change affects the headline range for a flagship calculator, also verify that the homepage's `index.astro` "Typical:" card range and the calculator page's Quick-answer callout band STILL MATCH the new computed range. Drift between these is a P0 trust hit. See STYLEGUIDE.md.

### 8. Build

```bash
npm run build
```

### 9. Commit

The commit message should include:
- WHAT changed (rebate cap, energy price, etc.)
- The OLD value → NEW value
- The PRIMARY SOURCE URL backing the change
- The `last_reviewed` bump

Example:

```
Refresh CA electricity rate per EIA April 2026

state-energy-prices.csv CA row: 32.5 → 34.0 ¢/kWh.
Source: EIA EPM Table 5.6.A, April 2026 release
(https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_a).

last_reviewed bumped to 2026-05-17. Footer's "Data last refreshed" line
auto-updates via siteLastReviewed.

Verification:
- smoke-test still passes (CA heat pump operating-cost recompute fits
  within expected ±15% band)
- Homepage "Typical:" card unchanged (band is national)
```

### 10. Ship

`/ship`

## When the change cascades

Some CSV changes affect many computed values. Be aware:

- Changing `state-labor-multipliers.csv` electrician_multiplier affects EVERY EV / panel / induction calculator on every state page
- Changing `operating-cost-constants.csv` `hp_ua_per_sqft` affects every heat pump operating-cost computation
- Changing `federal-credits.csv` expiration dates can invalidate FAQ language and methodology copy — search for the expiration date in `src/pages/**/*.astro` and update inline references too

For cascading changes, do a broader spot-check after the build. Open 3–4 affected pages and verify the displayed numbers look right.

## Common pitfalls

- **Forgot to bump `last_reviewed`** — the footer's "Data last refreshed" stamp won't update, making the site look stale even though data is fresh.
- **Bumped `last_reviewed` but didn't update the value** — review date claims freshness without backing.
- **Changed a value with no primary-source citation** — fails the editorial bar. Always cite.
- **Updated CSV but the value is also hardcoded in TS somewhere** — the source-of-truth gets out of sync. Search for the old value in `src/` to make sure it's not duplicated.
