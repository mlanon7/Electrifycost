# Prompt: Data verification (quarterly source review)

Use this prompt when you want an AI to cross-check the site's numeric data against current primary sources. Pair with `/refresh-sources` for the actual edit work.

---

## The prompt

```
You are doing a quarterly data-verification pass on a calculator-first
content site. The site's CSV data lives in data/csv/*.csv with each row
carrying a source_id (foreign key to src/data/source-notes.json) and a
last_reviewed date.

Your job: cross-check each numeric value against its CURRENT primary
source (not Reddit, not industry blogs — only the primary source URL).
Report which rows need updating, what the new value should be, and the
URL backing the new value.

---

## Step 1: Surface stale rows

Read all CSVs in data/csv/. For each row, find the last_reviewed date.
Flag rows where last_reviewed > 90 days old.

## Step 2: Look up the source URL

For each flagged row's source_id, look up the URL in
src/data/source-notes.json. This is the canonical primary source.

## Step 3: Verify the current value

Open the source URL. Find the current published value. Compare to the
row's value.

For each comparison, classify:
- UNCHANGED: value still matches the source; just bump last_reviewed
- CHANGED-MINOR: value drifted within tolerance (e.g., ±5% for energy
  prices, ±10% for equipment cost). Update + bump last_reviewed.
- CHANGED-MATERIAL: value drifted substantially. Highlight; founder
  decides whether to update or whether the source itself is wrong.
- SOURCE-DEAD: URL is now 404 / archived / replaced. Find a replacement
  primary source. Update source_id, value, and last_reviewed.
- PROGRAM-EXPIRED: a rebate program ended or a credit was repealed.
  Set status='expired' and bump last_reviewed.

## Step 4: Special categories

For these data categories, use these specific primary-source canons:

### Federal tax credits + caps
- IRS publication pages (e.g., https://www.irs.gov/credits-deductions/...)
- OBBBA-affected credits: 25C, 25D, 30C, 30D, 25E — check that the
  expiration dates encoded in CSVs match current IRS guidance
- Federal-credits.csv is the master reference

### State rebate programs
- DSIRE (https://www.dsireusa.org/) — searchable by state + technology
- State energy office websites (Mass Save, NYSERDA, CT Energize, etc.)
- For each state program, verify: amount, cap, eligibility, expiration

### DOE HEEHRA rollout
- https://www.energy.gov/scep/home-energy-rebates-programs
- For each state, check: launched (date) / pre-launch (estimated date) /
  reserved (fully allocated) / not-yet-open

### Energy prices
- EIA EPM Table 5.6.A (electricity, monthly)
  https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_a
- EIA STEO (forecasts)
- For each of the 51 states + DC: cents per kWh

### Natural gas prices
- EIA Natural Gas Weekly / Monthly
- For each state: dollars per therm

### Equipment costs
- EnergySage marketplace median (refreshed quarterly)
  https://www.energysage.com/local-data/
- LBNL Tracking the Sun (solar PV) — annual report
- NREL benchmark studies — annual updates per technology
- ENERGY STAR product finder (efficiency-keyed pricing)

### Labor rates
- BLS OEWS (May annual release)
  - https://www.bls.gov/oes/current/oes472111.htm (electricians)
  - https://www.bls.gov/oes/current/oes499021.htm (HVAC mechanics)
  - https://www.bls.gov/oes/current/oes472152.htm (plumbers)
- For each state: median hourly wage, scale to 4x-5x for blended rate

### Heat pump performance specs
- NEEP ASHP database (cold-climate ASHP performance data)
  https://ashp.neep.org/
- ENERGY STAR Air-Source Heat Pump Specifications
- For each equipment scenario: HSPF2 minimum, SEER2 minimum, COP at
  low ambient

### Solar production
- NREL PVWatts (https://pvwatts.nrel.gov/)
- For each state, south-facing fixed tilt: kWh/kW/yr

### Refrigerant transition
- EPA SNAP program updates
- AHRI technical bulletins
- Verify: current required refrigerants (R-32, R-454B as of 2025+)

## Step 5: Format the report

For each updated row, output:

```
File: data/csv/<file>.csv
Row: <row number or unique key>
Column: <column name>
Old value: <old>
New value: <new>
Source URL: <URL>
Last reviewed bump: <YYYY-MM-DD>
Severity: P0 / P1 / P2 / P3
Notes: <1-2 sentence why this change>
```

P0 = ships wrong number to users (e.g., expired rebate still listed as active)
P1 = materially drifts from current industry (>15% off median)
P2 = within tolerance but worth refreshing for freshness signal
P3 = no value change; just bump last_reviewed

## Step 6: Summary

End with:
- Total rows audited: N
- Rows requiring update: M (P0: x, P1: y, P2: z, P3: w)
- Sources that have moved / changed URL: list
- New programs to add (if any state launched a new program not in CSVs)
- Programs to mark expired (if any have ended)

Don't make the edits yourself — output the report for human review.
```

---

## How to use

### Best path: dispatch to a research agent

In Claude Code, use the `Agent` tool with `subagent_type: "general-purpose"` and paste this prompt with the project root prepended. Let the agent spend 30-60 min crawling sources.

### Alternative: paste into ChatGPT / Claude.ai

Same prompt works directly. Output goes into an audit doc under `audit/`.

### Cadence

- **Monthly:** energy prices (EIA releases monthly, 51 state rows)
- **Quarterly:** rebates + equipment costs + HEEHRA rollout
- **Annually:** labor rates (BLS OEWS), federal credit publications, efficiency standards
- **Event-driven:** new federal legislation (OBBBA-class events), state-legislative session updates, utility rate cases

### Adapting to a new niche

Replace:
- The IRS / DOE / EIA / BLS / NREL / NEEP / ENERGY STAR canon with your niche's primary sources
- The OBBBA-specific credit list with your niche's regulatory landscape
- The state-by-state dimension with whatever geographic / categorical dimension your data is keyed on
- The CSV file names with your niche's actual data files

The structure (last_reviewed timestamp + source_id + per-source canon + severity classification) generalizes.
