# /refresh-sources — Quarterly source-review playbook

Run this every 90 days. The site's competitive moat is **data freshness** — let it decay 6 months and a competitor with fresher numbers eats your lunch.

## Step 1 — Surface stale rows

Find every CSV row whose `last_reviewed` date is more than 90 days old:

```bash
cd "D:/claude projects/Electrifycost" && for f in data/csv/*.csv; do
  awk -F',' -v cutoff="$(date -d '90 days ago' +%Y-%m-%d)" '
    NR==1 { for (i=1; i<=NF; i++) if ($i == "last_reviewed") col=i; next }
    col && $col < cutoff { print FILENAME ":" NR ": " $col " - " $0 }
  ' "$f"
done
```

This emits each stale row with its file, row number, last_reviewed date, and the full row content.

## Step 2 — Categorize the stale rows

Group by what likely changed:

| Category | What to verify | Where to look |
|---|---|---|
| Federal credits + caps | OBBBA + IRS updates | https://www.irs.gov/credits-deductions |
| State rebate programs | Cap changes, new programs, ended programs | DSIRE: https://www.dsireusa.org/, state energy office sites |
| HEEHRA rollout | State-by-state launch dates | https://www.energy.gov/scep/home-energy-rebates-programs |
| Energy prices | Monthly EIA EPM updates | https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_a |
| Equipment costs | Industry surveys, EnergySage marketplace data | https://www.energysage.com/local-data/ + LBNL TTS reports |
| Labor rates | BLS OEWS annual update (May release) | https://www.bls.gov/oes/ |
| Refrigerant transition | EPA/AHRI dates | https://www.epa.gov/ozone-layer-protection |

## Step 3 — Verify each stale row against its primary source

For each row:
1. Open the source URL listed in the row's `source_id` (look up in `src/data/source-notes.json`)
2. Find the current published value
3. Compare to the row's value

**Decision tree:**
- **Value unchanged + still authoritative** → just bump `last_reviewed` to today
- **Value changed** → update the value AND bump `last_reviewed`. Document the change in the commit body with the new source URL.
- **Source URL is now 404 / archived / superseded** → find the replacement primary source, update `source_id`, update `last_reviewed`. If the source row in `src/data/source-notes.json` is now wrong too, fix it.
- **Program is now defunct / repealed** → set the row's `status` column to `"expired"` and bump `last_reviewed`. The engine will then filter it out of `applied` incentives but may still surface as `potential` for historical context (handled in `calc.ts`).

## Step 4 — Run the smoke test

```bash
node scripts/smoke-test.cjs
```

The 13 scenarios + 9 assertion groups will surface any computed band that drifted materially from the previous baseline. If an assertion now fails, **think about whether the assertion is now wrong** (industry shifted, threshold should move) vs whether your refresh introduced a bug.

## Step 5 — Spot-check 3 calculator pages in the browser

After rebuilding, view 3 random calculator pages on the dev server and verify:
- Quick-answer band still feels right (industry-comparable)
- Result panel for default inputs renders without console errors
- Rebate table reflects any programs you marked as expired/active

## Step 6 — Spot-check the homepage

The homepage "Typical: $X–$Y" cards are hardcoded in `src/pages/index.astro`. If a flagship calculator's band shifted by ≥10%, update the corresponding card too. See STYLEGUIDE.md "Quick-answer callouts" — drift between homepage card and Quick-answer is a P0 trust hit.

## Step 7 — Commit

Single commit message captures the refresh as one logical unit:

```
Quarterly source review: 2026 Q3 refresh

15 rows updated:
- 8 state electricity rates refreshed against EIA Aug 2026 EPM
- 3 rebate programs updated (NYSERDA tier change, Mass Save 2026
  schedule, CT Energize reauthorization)
- 1 federal credit row marked expired (25C tax-year 2025 final close)
- 3 equipment-cost rows refreshed against EnergySage Q3 2026 data

last_reviewed bumped to 2026-XX-XX on all touched rows.
Footer "Data last refreshed" stamp will update on next deploy.

Verification:
- smoke-test passes with bands within tolerance
- 3 random calculator pages render correctly with new data
- Homepage cards re-verified vs Quick-answer bands

Co-Authored-By: ...
```

## Step 8 — Ship

`/ship`

## Cadence guidance

- **Monthly:** energy prices (EIA releases monthly). 51 state rows; should take 20 minutes if you script it.
- **Quarterly:** rebate programs, equipment costs, refrigerant transition status, HEEHRA rollout. ~2 hours.
- **Annually:** labor rates (BLS OEWS), federal credit caps (annual IRS publication updates), efficiency standards (SEER2/HSPF2 thresholds — rare updates).
- **Event-driven:** new federal legislation (OBBBA-class events), state legislative session updates, utility rate cases — these don't follow a calendar.

## Sticky reminder

The footer's "Data last refreshed YYYY-MM-DD" surfaces the MAX `last_reviewed` across all source-notes entries. If you only update one row in a quarter, the footer date won't move materially. Aim for **at least 20–30 rows touched per quarter** to show meaningful freshness.
