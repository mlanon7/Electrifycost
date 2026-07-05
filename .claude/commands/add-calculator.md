# /add-calculator — Add a new calculator

When the user wants to add a new calculator, walk through this procedure.

## Step 0 — Clarify scope

Ask the user:
1. **What's the module name?** (e.g., `solar-thermal`, `whole-home-battery`, `wood-stove`)
2. **Is it a flagship** (uses shared `runCalculator()` engine) **or bespoke** (own math)?
3. **What state-keyed dimensions matter** for this calculator? (electricity rate, labor type, climate, gas price, etc.)
4. **Does it have programmatic state pages too**, or is it one calculator page only for v1?

## Step 1 — Add the data

If flagship-style:
- Add cost scenario rows to `data/csv/project-cost-ranges.csv` with `material_low/mid/high`, `labor_hours_low/mid/high`, `permit_low/mid/high`, `source_id`, `last_reviewed`.
- If new labor rate, add row to `data/csv/module-labor-rates.csv`.
- If new panel-risk logic, add rows to `data/csv/panel-upgrade-risk-rules.csv`.

If bespoke:
- Create `data/csv/<module>-cost-ranges.csv` with whatever columns the calculator needs.
- Document the schema in `data/csv/README.md`.

**Every numeric column** needs `source_id` + `last_reviewed`. **Every URL** for the source goes in `src/data/source-notes.json`.

## Step 2 — Run validate-csvs

```bash
node scripts/validate-csvs.cjs
```

Must pass before proceeding.

## Step 3 — Create the React component

Copy a flagship pattern as the starting point — `src/components/HeatPumpCalculator.tsx` is the gold reference.

Key requirements:
- **Accept `initialState` prop** (default `'CA'`). Critical for state programmatic pages — see lessons/03.
- **Use `useMemo`** to recompute on input changes.
- **Render via `<ResultPanel result={result} />`** for visual consistency with the other flagships.
- **Fire the `calculator_used` GA4 event** via ResultPanel (already wired). No additional setup needed.

For bespoke calculators, follow the current pattern: put the pure math in a compute module at `src/lib/calcs/<slug>.ts` (see the existing 27 modules + `types.ts`), import it into the component, and give the component its own result UI (no ResultPanel). Keeping the math in a standalone module — not inline — is what lets `scripts/build-scenario-bands.cjs` run the real compute function headlessly so the Project Simulator's published bands can't drift. The only calculators that still compute inline are the 5 analysis calcs (WholeHome, EvTco, SolarPayback, EvChargingCost, HvacRepairReplace).

If the calculator should appear in the **Project Simulator**, add its tier config (see `flagship-tiers.ts` and `scripts/band-entry.ts`), then regenerate the bands with `node scripts/build-scenario-bands.cjs`. **Never hand-edit `src/data/scenario-projects.json`** — it is generated, and `build-scenario-bands.cjs --check` is stage 9 of `npm test`.

## Step 4 — Create the calculator page

Copy `src/pages/heat-pump-cost-calculator.astro` as the template. Update:
- Frontmatter: `faq` array (8–10 items), `schemaJsonLd` with `WebApplication` + `FAQPage`
- Layout props: `title`, `description`, `active`, `ogImage`, `breadcrumbs`
- Hero section: eyebrow ("<Module>"), H1, quick-answer callout matching homepage card range
- `<YourCalculator client:load />` islet
- Below-fold sections: "New to <topic>?" intro paragraph linking to the guide, FAQ section, AdSlot, AffiliateModule (if relevant), Related calculators

## Step 5 — Wire into the homepage

Edit `src/pages/index.astro`:
- Add a card to the `modules` array (icon path, href, title, pitch, typical range)
- The typical range MUST match the Quick-answer callout on the calculator page — see STYLEGUIDE.md.

## Step 6 — Wire into the header dropdown

Edit `src/components/Header.astro`:
- Add an item to the appropriate category's `items` array (HVAC, Solar & Power, EV, Water Heating, or Home Improvements).

## Step 7 — Add to the guide structure (if a guide exists)

If you're adding a guide too, also:
- Create `src/pages/guides/<slug>.astro` (see `/add-guide` command)
- Add an entry to `src/lib/guide-relationships.ts`
- Update sibling references in adjacent guide entries

## Step 8 — Smoke test

Add a representative scenario to `scripts/smoke-cases.json`:

```json
["<Module> default scenario", "<module>", "<scenario_id>", "CA", "100A", "average", "single_family", "unknown", null, null]
```

Add targeted assertions to `scripts/smoke-test.cjs` if the calculator has edge cases worth guarding (e.g., a regulatory date filter, a state-specific multiplier).

## Step 9 — Verify

```bash
npm test          # all 9 stages pass
npx tsc --noEmit  # zero errors
npm run build     # one more page than before (~700+)
```

If the build fails with `Unexpected "export"` — see `.claude/lessons/02-esbuild-template-literal-bug.md`. Most likely a nested template literal in the FAQ array.

## Step 10 — Add a state programmatic template (if needed)

If you said yes to "programmatic state pages" in step 0, see `/add-state-pages`.

## Step 11 — Ship

`/ship` once everything's verified.

## Common pitfalls

- **Forgot the `initialState` prop** — state pages will all hydrate with CA. Verify by viewing the calculator on `/cost-tx/`.
- **Numbers hardcoded in the React component instead of CSV** — refactor before shipping. Future updates require code changes vs CSV edits.
- **Quick-answer band drifts from homepage card** — both surfaces show different numbers. Verify by opening both pages side by side.
- **FAQ items don't link to primary sources** — every claim about a rebate, federal credit, or efficiency standard needs an inline URL. See STYLEGUIDE.md "Numeric claims — sourcing rules."
