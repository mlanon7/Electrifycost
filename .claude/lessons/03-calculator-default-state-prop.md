# Lesson 03 — Calculator default-state prop (`initialState`)

**Date:** 2026-05-17
**Severity:** P0 (every state programmatic page showed wrong rebates initially)
**Commit fixing:** `973a426`

## What broke

All 51 heat-pump state programmatic pages (`/heat-pump-cost-tx/`, `/heat-pump-cost-ca/`, ...) had a hero saying "Heat Pump Cost in <State>" with state-specific data points (electricity ¢/kWh, climate zone, labor multiplier, rebate table). But the calculator below initially **hydrated with California as the state**, regardless of the URL.

So a user landing on `/heat-pump-cost-tx/`:
- Saw "Heat Pump Cost in Texas" in the H1 ✅
- Saw Texas-specific electricity rate in the stats grid ✅
- Saw the federal + Texas state rebate table ✅
- Saw the calculator with state pre-selected to **California** ❌
- Saw the "Incentives applied" section showing **TECH Clean California** ($3,000 off) — a CA-only program ❌

The user had to manually change the state dropdown to Texas to get correct rebates. The page contradicted itself.

## Root cause

In `src/components/HeatPumpCalculator.tsx`:

```typescript
export default function HeatPumpCalculator() {
  const [state, setState] = useState('CA');  // ← hardcoded default
  // ...
}
```

The component had no way to accept an override. The state programmatic pages rendered:

```astro
<HeatPumpCalculator client:load />
```

The page knew the user was on a Texas URL, but didn't communicate that to the calculator. The calculator hydrated with its own hardcoded 'CA' default.

## The fix

Three steps:

### Step 1: Add `initialState` prop to all 5 flagship calculators

```typescript
export default function HeatPumpCalculator({ initialState = 'CA' }: { initialState?: string }) {
  const [state, setState] = useState(initialState);
  // ...
}
```

Applied to: `HeatPumpCalculator.tsx`, `EvChargerCalculator.tsx`, `PanelCalculator.tsx`, `HpwhCalculator.tsx`, `InductionCalculator.tsx`.

### Step 2: Pass it from every state programmatic page

```astro
<!-- Before -->
<HeatPumpCalculator client:load />

<!-- After -->
<HeatPumpCalculator client:load initialState={stateCode} />
```

Applied to:
- `heat-pump-cost-[state].astro`
- `ev-charger-installation-cost-[state].astro` (new in same commit)
- `electrical-panel-upgrade-cost-[state].astro` (new)
- `heat-pump-water-heater-cost-[state].astro` (new)
- `induction-stove-cost-[state].astro` (new)

### Step 3: Verify by visiting `/heat-pump-cost-tx/`

The state dropdown now shows "Texas" by default. The rebate table inside the result panel now shows federal + Texas state programs only.

## Why this slipped through

1. The original heat-pump state template was the only one shipped initially. It worked because the developer happened to test from California (the default), which matched the hardcoded default, masking the bug.
2. Testing from other states would have caught it immediately, but no one did.
3. The `validate-pages.cjs` checks Layout balance, not React-island initial-state correctness.
4. The smoke test exercises the engine via `runCalculator()` directly, not via React hydration — so the engine's correct CA behavior was tested, but the wiring through to the React component's `useState` wasn't.

## Forward-looking rules

### Rule 1: Any time a calculator can be embedded on a context-aware page, accept `initialState` (or equivalent context props)

Hardcoded `useState('CA')` is fine when the calculator is on `/heat-pump-cost-calculator/` (the generic page). It's a bug when the calculator is on `/heat-pump-cost-tx/`.

Generalize: if you're building a React component that holds state which COULD differ from the page context, accept the context as a prop.

### Rule 2: When you build a state programmatic page, always view it for a non-default state

Don't just check `/heat-pump-cost-ca/` (matches the default). Check `/heat-pump-cost-tx/`, `/heat-pump-cost-me/`, or any non-CA state. The hydration mismatch will be immediately visible.

### Rule 3: Future state-keyed dimensions deserve the same treatment

If you add a "by-fuel" or "by-sqft" or "by-year" set of programmatic pages, the calculator on those pages should similarly accept `initialFuel`, `initialSqft`, etc. The pattern generalizes.

### Rule 4: Document the calculator's accepted props in the component's top comment

```typescript
/**
 * Heat pump cost calculator (flagship, uses shared engine).
 *
 * Props:
 * - initialState (optional, default 'CA'): pre-select the state dropdown.
 *   Pass this from any context-aware page (state programmatic, geo-detected, etc.)
 */
export default function HeatPumpCalculator({ initialState = 'CA' }) { ... }
```

## Detection signal in future projects

If you have programmatic pages keyed on a dimension AND a React component that holds state for that dimension AND viewing the programmatic page shows the component pre-set to a different value than the page URL implies:

→ the component is missing a prop. Add it. Pass it from every programmatic page.

## Related lesson

If the calculator also persists state via URL hash (using `use-url-state.ts` hooks), the priority should be: URL hash takes precedence over `initialState` prop, which takes precedence over the hardcoded default. The hooks already handle this correctly in `src/lib/use-url-state.ts` — don't reverse the order.
