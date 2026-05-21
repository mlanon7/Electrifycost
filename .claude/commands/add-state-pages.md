# /add-state-pages — Clone a state-programmatic template for a new module

When the user wants 51 per-state pages for a new module (one per U.S. state + DC).

> **Other programmatic dimensions** (city, size/tonnage/sqft, brand) follow the
> same data-CSV + template pattern but use DIFFERENT URL shapes to avoid route
> collisions. Before adding any new dimension, read
> `.claude/lessons/08-astro-route-collision-patterns.md`. Quick reference:
> - **State** → prefix-form dynamic `<module>-cost-[state].astro` → `/<module>-cost-tx/`
> - **City** → subpath dynamic `<module>-cost/[city].astro` → `/<module>-cost/houston-tx/` (data: `top-cities.csv`)
> - **Size** → prefix-form STATIC files `<module>-cost-3-ton.astro` → `/<module>-cost-3-ton/`
> - **Brand** → suffix-form dynamic `[brand]-<module>-cost.astro` → `/mitsubishi-<module>-cost/` (data: `brand-profiles.csv`, helper `brandsByCategory()`)
>
> NEVER add a second greedy single-segment dynamic at an existing prefix —
> `<module>-cost-[state]` + `<module>-cost-[anything]` collides. Build after the
> FIRST new page to confirm no collision before scaling.

## Step 0 — Verify prerequisites

The new module must already have:
- A calculator component (e.g., `MyModuleCalculator.tsx`) that accepts an `initialState` prop
- A `data/csv/<module>-cost-ranges.csv` or rows in `project-cost-ranges.csv` for it
- Rebate rows in `data/csv/rebate-programs.csv` filterable by `module === '<module>'`

If any prerequisite is missing, run `/add-calculator` first.

## Step 1 — Clone the state template

Use `src/pages/heat-pump-cost-[state].astro` as the canonical reference. Create:

```
src/pages/<module>-cost-[state].astro
```

## Step 2 — Make ONLY these substitutions

Do not deviate from the heat-pump template structure beyond these specific swaps:

1. **Import:** `HeatPumpCalculator` → `<YourModule>Calculator`
2. **JSX:** `<HeatPumpCalculator ... />` → `<YourModule>Calculator ... />`
3. **Rebate filter:** `r.module === 'heat_pump'` → `r.module === '<module>'`
4. **Active URL prop:** `active="/heat-pump-cost-calculator/"` → `"/<module>-cost-calculator/"`
5. **Cross-link grid path:** `/heat-pump-cost-${s.code.toLowerCase()}/` → `/<module>-cost-${s.code.toLowerCase()}/`
6. **Title:** `Heat Pump Cost in ${stateName}` → `<Module> Cost in ${stateName}`
7. **H1:** same swap as title
8. **`<h2>Heat pump cost by state</h2>`** → `<h2><Module> cost by state</h2>`
9. **FAQ array:** rewrite the 4 questions to be module-specific

## Step 3 — Pass initialState to the calculator

**CRITICAL.** The calculator JSX MUST be:

```astro
<YourModuleCalculator client:load initialState={stateCode} />
```

If you forget `initialState={stateCode}`, every state page initially hydrates with California as the default state, surfacing wrong rebates. See `.claude/lessons/03-calculator-default-state-prop.md`.

## Step 4 — Beware the esbuild template-literal bug

When writing the FAQ array with state-name interpolation, use SIMPLE patterns. The pattern that builds reliably:

```typescript
const faq = [
  {
    q: `How much does <module> cost in ${stateName}?`,
    a: `In ${stateName}, a typical ... runs ${fmtUSD(low * (labor?.electrician_multiplier ?? 1))}–${fmtUSD(high * (labor?.electrician_multiplier ?? 1))} installed. ...`,
  },
];
```

The patterns that BREAK the build (`Unexpected "export"` error):

```typescript
// AVOID — nested backtick inside an interpolation
a: `... ${condition ? `nested ${expr}` : 'fallback'} ...`,

// AVOID — too many nested interpolations with Unicode chars in same expression
```

See `.claude/lessons/02-esbuild-template-literal-bug.md` for full bug recipe. If you hit it, use string concatenation with `+` instead of nested backticks, OR replace `${stateName}` interpolation with plain strings that just reference the state by name.

## Step 5 — Create the by-state hub page

Path: `src/pages/<module>-cost-by-state.astro`

Use `src/pages/heat-pump-cost-by-state.astro` as the template. It's a sortable table + 51 links.

Two `cheapest`/`expensive` callout cards at the top (based on whichever state-keyed dimension is most relevant for your module).

## Step 6 — Add to the homepage state-hub section

Edit `src/pages/index.astro`. The "Deep dives by state" section near the bottom — add a new card linking to your by-state hub.

## Step 7 — Verify

```bash
npm test
npx tsc --noEmit
npm run build
```

Build should show **52 new pages** (51 state pages + 1 hub).

If the build fails with `Unexpected "export"` — simplify the FAQ template literals (see Step 4).

## Step 8 — Visual check (one state at random)

```
http://localhost:4321/<module>-cost-tx/
```

Verify:
- Hero says "TX" or "Texas"
- Stats grid shows Texas-specific electricity rate / labor multiplier / climate
- **Calculator is pre-selected to Texas** (this is the test for the `initialState` prop)
- Rebate table shows ONLY federal + Texas state programs (not California)
- "Cost by state" cross-link grid at the bottom shows all 51 states

Also check the by-state hub: `http://localhost:4321/<module>-cost-by-state/`.

## Step 9 — Ship

`/ship`

After Vercel deploys, also submit the new sitemap entries in GSC if you want the new pages indexed faster than the 4–8 week organic discovery cycle. URL inspection for the hub + 2–3 sample state pages should be enough — Google will discover the rest via the cross-link grid.

## Common pitfalls

- **Forgot `initialState`** — state pages all show California. Single biggest pitfall. Verify on `/<module>-cost-tx/`.
- **Same `id` collisions across multiple state templates** — `id="states"` shouldn't appear on a state page since the homepage uses `#states` anchor.
- **Rebate filter typo** — `r.module === 'heat_pump'` instead of `r.module === '<your-module>'` quietly surfaces wrong rebates everywhere.
- **Forgot to add the hub page link to the homepage** — the 51 new state pages exist but are orphaned from the main nav.
