# Lesson 02 — esbuild template-literal parse bug in Astro frontmatter

**Date:** 2026-05-17
**Severity:** P1 (blocks build; affects content shipping)
**Commits:** `973a426` (worked around in `heat-pump-water-heater-cost-[state].astro`)

## What broke

`npm run build` failed with:

```
[ERROR] [vite] x Build failed in 850ms
Unexpected "export"
  Location: D:/claude projects/Electrifycost/src/pages/<file>.astro:42:0
```

Line 42 in the offending file was `const faq = [` — a normal TypeScript const declaration with no `export` keyword nearby. The error message claimed an unexpected `export` token at a line that didn't contain `export`.

## The actual trigger

The Astro frontmatter contained a FAQ array with **nested template literals using `${}` interpolation mixed with Unicode characters and a conditional**:

```typescript
const faq = [
  {
    q: `What is the monthly cost in ${stateName}?`,
    a: `For a ${variable} household at ${electricityCents.toFixed(1)}¢/kWh in ${stateName}, an HPWH runs about $${(hpwhAnnual / 12).toFixed(0)}/month — roughly 1/3 the energy use of a standard electric tank, and ${annualSavings > 0 ? `about $${annualSavings.toFixed(0)}/year less than a gas tank water heater at $${gasPrice.toFixed(2)}/therm` : 'comparable to gas water heating in your low-gas-cost state'}.`,
  },
];
```

This combines:
1. Outer template literal (backtick)
2. Multiple `${expression}` interpolations
3. A ternary inside the interpolation that ITSELF returns a template literal (nested backtick)
4. Unicode characters: `¢`, `—`, `°`
5. Dollar-sign followed by other content (`$${X}` produces a literal `$` then an interpolation)

The combination — specifically the **nested backtick inside a `${expression}` inside an outer backtick** — confuses Astro's preprocessor + esbuild's parser. The error reports a misleading line and an `Unexpected "export"` message.

## Confirmation

In the same project, the heat-pump state template uses similar template literals **without nested backticks** and builds fine:

```typescript
// WORKS
a: `In ${stateName}, a typical ducted central heat pump runs ${labor ? fmtUSD(7500 * labor.hvac_multiplier) : '$7,500'}–${labor ? fmtUSD(20000 * labor.hvac_multiplier) : '$20,000'} installed.`
```

The ternary returns a **string literal** (`'$7,500'`), not another template literal. That's the safe pattern.

## The workaround

For the HPWH state template, we used plain string concatenation instead:

```typescript
// SAFE
a: 'For a 4-person household at ' + electricityCents.toFixed(1) + ' cents per kWh in ' + stateName + ', an HPWH runs about $' + (hpwhAnnual / 12).toFixed(0) + '/month. Roughly 1/3 the energy use of a standard electric tank.'
```

Or even simpler — use plain strings without `${stateName}` interpolation in the FAQ array entirely, and let the state-name appear in the page H1 / title / hero stats instead.

## Forward-looking rules

### Rule 1: NEVER nest template literals in Astro frontmatter

If you need a conditional inside an interpolation, return a **string** from the ternary, not another template literal:

```typescript
// SAFE
${condition ? 'option-a-string' : 'option-b-string'}

// SAFE
${condition ? someFunction(x) : 'fallback'}

// SAFE
${condition ? '$' + value.toFixed(2) : 'n/a'}

// BREAKS BUILD (eventually, depending on Unicode / other context)
${condition ? `nested template ${x}` : 'fallback'}
```

### Rule 2: Build EARLY when writing new `.astro` files with template literals

Don't write 10 new state templates with complex FAQ arrays and then run `npm run build` for the first time. Build after each template is finished. The error only points at the broken file — if 10 are broken, the first one's error message will mask the others.

### Rule 3: When in doubt, prefer string concatenation

For multi-line FAQ answers with conditionals, string concatenation with `+` is verbose but **always parses correctly**. The verbosity is worth the reliability.

### Rule 4: If you hit `Unexpected "export"` and the line doesn't contain `export`

Don't trust the line number. Search the FILE for nested backticks (`` ` `` inside `${}`). That's almost always the culprit.

## Why this is an Astro/esbuild bug, not a JS bug

In vanilla TypeScript, nested template literals are perfectly legal:

```typescript
const x = `outer ${condition ? `inner ${y}` : 'fallback'} more`;
```

This compiles fine with `tsc`. The bug is somewhere in Astro's preprocessing of `.astro` frontmatter through esbuild — possibly Astro's wrapping of the frontmatter into a synthetic module confuses the JS lexer when nested backticks are present.

There's a small chance this gets fixed in a future Astro release. Until then, the workaround is reliable.

## Detection signal

If `npm run build` fails with:
- `Unexpected "export"` and the cited line doesn't contain `export`
- The file is a `.astro` page with a frontmatter `const faq = [` or similar array literal
- The array contents have backticks and `${}` interpolations

→ search for nested backticks. Refactor with string concatenation. Build succeeds.
