# Lesson 10 — Portfolio cross-linking (ElectrifyCost ↔ ProjectCostPro)

**Date:** 2026-06-20
**Severity:** P2 (do it wrong and it looks like a link scheme; do it right and it's free referral + cross-discovery)
**Context:** the owner runs a small family of same-pattern cost-calculator sites. ElectrifyCost and ProjectCostPro launched ~the same time (~May 2026) and overlap heavily. This lesson records the cross-link strategy, the live map (so the links aren't accidentally deleted), and the rules for extending it.

## The relationship

- **ProjectCostPro** (projectcostpro.com) = the **generalist** — 52 hand-authored home-project calculators (roofing, deck, siding, kitchen/bath, driveways, HVAC, water heater, solar, panel, EV charger, etc.). Vanilla HTML, no build. Repo: `../projectcostpro`.
- **ElectrifyCost** = the **specialist** for the electrification subset — deeper, source-cited, state-by-state, rebate-aware calculators for heat pumps, solar, EV chargers, panels, water heaters, etc.

So the natural, defensible link graph is **generalist → specialist** (PCP sends its electrification-adjacent traffic to EC's deeper version) and **specialist → generalist** (EC sends users to PCP for the broader projects EC doesn't cover).

## The honest SEO reality (set expectations)

Same-owner cross-links pass **little ranking authority** — they're not independent third-party votes, and both domains are young/low-authority anyway. The real value is **referral traffic + faster cross-discovery/crawl + genuine UX**. The lever that actually moves rankings is **third-party** links (newsletters, HN, Reddit, industry blogs) — see `ROADMAP.md`. Don't expect cross-linking to lift positions; do it because it helps users and costs nothing.

## The rules (what keeps it defensible, not a "link scheme")

1. **Contextual, in-content links** — inside relevant prose / related-calculator sections. NOT sitewide footer links on every page.
2. **Varied anchor text + framing** per page — never the same exact-match commercial anchor repeated.
3. **One link per page**, only where the destination genuinely helps that page's reader.
4. **Asymmetric on purpose** — generalist→specialist heavier (8) than specialist→generalist (3). Perfect reciprocity at scale is the spammy pattern; asymmetry reads natural.
5. **Normal dofollow links** — no `nofollow` (would kill even the crawl-discovery benefit), no `target=_blank` templating.
6. **Neutral editorial framing — do NOT write "our sister site."** Name the destination ("ProjectCostPro's roofing calculator", "ProjectCostPro covers 50+ home-project calculators"). Explicitly advertising the common ownership hand-feeds Google the same-owner signal, which further discounts an already-low-authority link — and the link is just as useful to the reader without it. (The first pass used "our sister site"; removed 2026-06-20.)

## The live map (as of 2026-06-20 — `5e81200` here, `3c4bfb6` in projectcostpro)

**PCP → EC** (8) — each PCP calculator's "Related calculators" section links to EC's deeper version:

| ProjectCostPro page | → ElectrifyCost |
|---|---|
| `/calculators/hvac/` | `/heat-pump-cost-calculator/` |
| `/calculators/mini-split/` | `/mini-split-heat-pump-cost-calculator/` |
| `/calculators/electrical-panel/` | `/electrical-panel-upgrade-cost-calculator/` |
| `/calculators/ev-charger/` | `/ev-charger-installation-cost-calculator/` |
| `/calculators/solar/` | `/solar-panel-cost-calculator/` |
| `/calculators/water-heater/` | `/heat-pump-water-heater-cost-calculator/` |
| `/calculators/generator/` | `/battery-vs-generator/` |
| `/calculators/insulation/` | `/insulation-cost-calculator/` |

**EC → PCP** (3) — EC points to PCP for the broader projects it doesn't cover:

| ElectrifyCost page | → ProjectCostPro | placement |
|---|---|---|
| `/guides/roof-replacement/` | `/calculators/roofing/` | section "1. How a residential roof is priced" |
| `/about/` | `/` (homepage) | "What this site is not" list |
| `/whole-home-electrification-cost-calculator/` | `/` (homepage) | under "Per-module calculators" |

## How to extend it (the next time you add a cross-link)

- Add it only where there's a **genuine topical overlap** and the destination is the better resource for that reader.
- Keep the asymmetry and the per-page-contextual discipline above.
- After shipping, ping IndexNow on **both** sides so Bing recrawls the changed pages: EC uses `node scripts/indexnow-submit.cjs <urls>`; PCP uses `node scripts/submit-indexnow.cjs` (its own key).
- PCP is a separate repo with its own validators (`npm run validate`) and its own `main` deploy — commit/push there independently. Watch for a remote that's ahead (PCP gets edited from other sessions): `git stash` any unrelated working changes, rebase/reset to `origin/main`, re-apply, then restore the stash.

## What NOT to do

- No sitewide footer links across either site (the classic network smell).
- No reciprocal exact-match anchor blocks.
- Don't link every overlapping topic just because you can — curate to where it's genuinely useful (we deliberately did 8, not all ~12 overlaps).
- Don't treat this as a substitute for third-party link-building — it isn't.
