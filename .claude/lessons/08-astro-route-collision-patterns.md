# Lesson 08 — Astro route-collision patterns for programmatic SEO

**Date:** 2026-05-19
**Severity:** P1 (would break the build / silently shadow pages if gotten wrong)
**Context:** adding city, size (tonnage/sqft), and brand dimensions on top of the existing state dimension.

## The trap

The existing dynamic route `src/pages/heat-pump-cost-[state].astro` is **greedy**: it compiles to a route that matches **any** `/heat-pump-cost-<single-segment>/`. So a naive attempt to add:

- `heat-pump-cost-[city].astro` → COLLIDES (same pattern `heat-pump-cost-[x]`, Astro errors "two dynamic routes")
- `heat-pump-cost-2-ton/` via a dynamic `[size]` route → COLLIDES with `[state]`
- `/heat-pump-cost-houston-tx/` as a city → would be CLAIMED by `[state]` (state="houston-tx")

If you add a second greedy single-segment dynamic route at the same prefix, Astro either throws a route-collision error at build time or silently shadows one route with the other. Both are bad.

## The three collision-free shapes

When you need MORE dimensions on the same calculator, pick one of these — each is a distinct URL *shape* that the greedy `[state]` route cannot match:

### Shape A — Prefix-form STATIC file
`heat-pump-cost-3-ton.astro` → `/heat-pump-cost-3-ton/`

- It's a STATIC route (no brackets). Astro resolves static routes **before** dynamic ones.
- The `[state]` route's `getStaticPaths` only emits real state codes (tx, ca, ...), never "3-ton", so no output-path collision.
- This is exactly how `heat-pump-cost-by-state.astro` and `heat-pump-cost-by-city.astro` already coexist with `heat-pump-cost-[state].astro`.
- Use for: a SMALL fixed set (sqft tiers, tonnage tiers, by-state/by-city hubs). One file per value.

### Shape B — Subpath dynamic route
`heat-pump-cost/[city].astro` → `/heat-pump-cost/<city>/`

- A different path LEVEL. `/heat-pump-cost/houston-tx/` (slash) is not the same as `/heat-pump-cost-houston-tx/` (hyphen).
- The greedy `[state]` route matches the hyphen form only; the subpath is invisible to it.
- **Caveat:** don't reuse a subpath that's already a dynamic route. `/heat-pump-cost/[city]` is fine, but you can't ALSO put `/heat-pump-cost/[size]` there (two greedy dynamics at the same subpath = collision again).
- Use for: a LARGE set keyed on one param (100 cities). One template, one CSV.

### Shape C — Suffix-form dynamic route
`[brand]-heat-pump-cost.astro` → `/<brand>-heat-pump-cost/`

- A different URL SHAPE. The `[state]` route matches `heat-pump-cost-<x>` (prefix); this matches `<x>-heat-pump-cost` (suffix). They never overlap.
- Multiple suffix dynamics coexist if their suffixes differ: `[brand]-heat-pump-cost`, `[brand]-heat-pump-water-heater-cost`, `[brand]-ev-charger-installation-cost` are all distinct (anchored on different literal suffixes).
- **Caveat:** a suffix dynamic WILL match a prefix static of the same shape. `/ducted-heat-pump-cost/` (static) is matched by `[brand]-heat-pump-cost` (brand="ducted"). Astro gives the static priority and the dynamic `getStaticPaths` never emits "ducted", so it's fine in practice — but keep static-suffix files and dynamic-suffix routes from emitting the same slug.
- Use for: a MEDIUM set keyed on one param where the keyword reads best as a prefix (brand names: "mitsubishi heat pump cost"). One template, one CSV.

## The decision tree

```
Need to add a dimension to /<module>-cost-... ?
│
├─ Is it a small fixed set (≤ ~8 values)?
│   └─ Shape A: prefix-form static files  (/<module>-cost-<value>/)
│
├─ Is it a large set (50-100+), and the param reads fine as a path segment?
│   └─ Shape B: subpath dynamic  (/<module>-cost/<value>/)
│
└─ Is it a medium set where the keyword reads best with the value FIRST?
    └─ Shape C: suffix-form dynamic  (/<value>-<module>-cost/)
```

## What we shipped (proof the patterns coexist)

All of these build together cleanly (642 pages):
- `heat-pump-cost-[state].astro` (greedy dynamic, prefix) — 51 pages
- `heat-pump-cost-by-state.astro`, `-by-city.astro` (static, prefix) — hubs
- `heat-pump-cost-3-ton.astro` ... `-5-ton.astro`, `-1000-sqft.astro` ... (static, prefix) — 10 pages
- `heat-pump-cost/[city].astro` (dynamic, subpath) — 100 pages
- `[brand]-heat-pump-cost.astro` (dynamic, suffix) — 8 pages
- `ducted-heat-pump-cost.astro` (static, suffix — coexists with the brand dynamic via static priority)

## Forward-looking rules

### Rule 1: Never add a second greedy single-segment dynamic at the same prefix
`foo-cost-[a].astro` + `foo-cost-[b].astro` = collision. Always.

### Rule 2: Build IMMEDIATELY after adding the first page of a new dimension
Don't write 22 brand pages then discover a collision. Add ONE, run `npm run build`, confirm the page count went up by the right amount AND existing pages still build. Then scale.

### Rule 3: Verify a non-default slug renders
After adding a dimension, open a page whose slug is NOT a state code and NOT the calculator default — e.g. visit `/heat-pump-cost/houston-tx/` and `/mitsubishi-heat-pump-cost/`. Confirm the right template handled it (check the H1).

### Rule 4: Static files win, but keep slugs disjoint
A static `ducted-heat-pump-cost.astro` and a dynamic `[brand]-heat-pump-cost.astro` coexist ONLY because the brand `getStaticPaths` never emits "ducted". If you ever add "ducted" as a brand slug, you'd have two sources for one URL. Keep static-suffix slugs out of the dynamic-suffix data set.

## Detection signal

- Build error "Two dynamic routes ... collide" → you added a second greedy dynamic at an existing prefix. Switch the new one to a different shape (A/B/C).
- A new programmatic page renders the WRONG template's content (e.g., a brand page showing state content) → a greedy dynamic is shadowing your new route. Check URL shapes.
- A new page 404s despite being in `getStaticPaths` → its slug is being claimed by another route with higher priority. Check for an overlapping static file or a greedy dynamic.
