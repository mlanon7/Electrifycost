# Lesson 05 — CSV as single source of truth

**Date:** 2026-05 (architectural decision, not a single-commit fix)
**Severity:** N/A — design pattern, not a bug

## The decision

Every numeric input on the site lives in `data/csv/*.csv`. Never duplicated in TypeScript constants, JSON files, or React component literals.

49 CSVs cover everything: cost ranges, labor multipliers, state energy prices, climate data, rebate programs, federal credit caps, operating-cost physics constants, panel-risk rules, solar production data, battery $/kWh tables.

## Why this pattern

### Versionable

Every numeric change is a `git diff` on a CSV. You can see WHO changed WHAT WHEN. PR reviewers can read the change directly.

### Auditable

Each row carries a `source_id` (foreign key into `src/data/source-notes.json`) and a `last_reviewed` date column. The data lineage is encoded into the format itself.

### Editable by non-engineers

A research analyst, the founder, or a contractor with subject-matter expertise can open the CSV in Google Sheets, edit a row, download as CSV, commit. No code review for content-only updates.

### Testable

The smoke test in `scripts/smoke-test.cjs` reads CSVs directly via `fs.readFileSync` and parses them with a plain-Node CSV parser. The runtime calculator reads the SAME files via Vite's `?raw` import. Single source of truth, validated independently.

### Easy to refresh

Quarterly source reviews touch CSVs directly. See `.claude/commands/refresh-sources.md`.

### Cheap to evolve

Adding a new column to a CSV is a 5-minute change: update the schema, update `data.ts`'s `coerce()` function, update validators. No DB migration. No backwards-compat dance.

## What NOT to do

These patterns have been considered and rejected:

### ❌ Hard-code numbers in calculator components

```typescript
// BAD
const STATE_ELEC_PRICES = {
  CA: 0.325,
  TX: 0.151,
  // ...
};
```

If the value is in the component, you can't update it without code review + deploy + test cycle. CSVs let researchers update prices without touching code.

### ❌ Use a database

A SQL DB would give you query power and remote editability, but:
- Adds a runtime dependency (latency, downtime, scaling)
- Loses git-based audit trail
- Loses "open in Google Sheets" ergonomics
- Harder to roll back to a previous data state

### ❌ Use a headless CMS (Sanity, Contentful, etc.)

CMS gives you a nicer editor UI but:
- Vendor lock-in
- API rate limits in CI builds
- Cost ($$/mo for any meaningful content volume)
- Separate user-management problem
- Loses git-based audit trail

### ❌ Use JSON files

JSON is fine for textual data (`src/data/glossary.json`, `src/data/source-notes.json`) but bad for numeric tables:
- Worse diff readability than CSV for tabular data
- Harder to edit in a spreadsheet (Google Sheets doesn't natively export JSON)
- Harder for non-engineers to author

CSV is the right tool for tabular numbers. JSON is the right tool for hierarchical/textual data. Use both for what they're each good at.

### ❌ Mix sources

Don't have SOME costs in CSV and OTHERS in TypeScript. The split decays. New developers get confused. Updates miss one location. Single source per logical dataset.

## Forward-looking rules

### Rule 1: When in doubt, CSV-ify

If you're typing numeric values into a `.tsx` or `.astro` file, stop. Ask: should this be in a CSV instead? Almost always yes.

The exceptions:
- **UI defaults** like `useState('CA')` — that's UI ergonomics, not data
- **Tailwind class strings** — that's styling, not data
- **Magic-number constants for the engine** like `BTU_PER_THERM = 100000` — these COULD be in a CSV, but the universal-constants set is small enough that `operating-cost-constants.csv` covers them cleanly

### Rule 2: Every numeric CSV column needs `source_id` + `last_reviewed`

If you're adding a new CSV, those two columns are mandatory. No exceptions.

### Rule 3: `requireRows()` guards against silent data loss

`src/lib/data.ts` exports a `requireRows()` helper that throws if a CSV loads zero rows. Use it for every CSV import. If the file is missing or empty, the build fails fast instead of silently shipping calculators with no data.

### Rule 4: The validator script enforces schema

`scripts/validate-csvs.cjs` checks that each CSV has the expected column names and that numeric columns parse as numbers. Run before every commit. If you add a new CSV, add its schema to the validator.

### Rule 5: Source URLs go in `src/data/source-notes.json`

The CSV row's `source_id` is a foreign key. The actual URL + description + `last_reviewed` is in `source-notes.json`. The Sources page reads from there.

This separation lets a single source (e.g., "EIA EPM Monthly") back many CSV rows without duplicating the URL.

## Real-world payoff

In one quarterly refresh, updating 30 state electricity prices was a 20-minute edit to one CSV. Same change in a hardcoded-TypeScript world would have been 30 line changes across multiple files, a PR, a code review, a CI run, and a deploy.

The CSV-first pattern compounds over time as the data volume grows. By the time you have 200 rebate programs and 50 cost scenarios, you can't maintain the data without it.

## When NOT to use CSV

If a dataset is genuinely hierarchical (nested objects, optional fields, varied schemas across rows), JSON beats CSV. Example: `contractor-checklists.json` has 5 modules × ~10 questions each — JSON's nesting is natural; CSV would be awkward.

The rule: tabular numeric data → CSV. Tree-shaped textual data → JSON.

## Detection signal in future projects

If you find:
- A `const X_VALUES = { state1: 0.1, state2: 0.2, ... }` in `.ts` or `.tsx`
- An inline `if (state === 'CA') return 1.42` lookup
- An "updated this number" commit that touched 5+ files

→ refactor to CSV. The pattern saves time within 3 months.
