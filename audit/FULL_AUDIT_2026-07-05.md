# ElectrifyCost — Full Deep Audit 2026-07-05

> Second full-site deep audit (the first ran 2026-07-04 — see `FULL_AUDIT_2026-07-04.md`).
> Seven fresh parallel read-only streams, each briefed to go deeper than the prior pass, verify
> the 2026-07-04 fixes held on the live site, and surface anything new. Baseline: HEAD `e81f2c7`,
> 701 built pages / 700 sitemap URLs / 51 CSVs / 9-stage `npm test` green. All findings were then
> remediated (commit `aa44a73`). Companion machine log: `FULL_AUDIT_2026-07-05.log`.

## Executive summary

**Zero P0.** The site is in strong shape — the 2026-07-04 remediation held across every stream
(25D prose stayed swept, simulator modal focus intact, docs accurate, EIA prices current). This
pass found calibration drift, a systemic-but-benign layout hairline, a real accessibility gap the
first audit's flagship-only form check missed, and a scatter of content/SEO/perf nits.

| Severity | Count | Status |
|---|---|---|
| **P0** | 0 | — |
| **P1** | 4 | all fixed |
| **P2** | ~14 | all fixed (2 documented-defensible kept) |
| **P3** | ~12 | fixed the shipping-visible ones; 1 perf item deferred with rationale |

### The four P1s (all fixed)

1. **Geothermal was rebased *too low* on 2026-07-04.** Yesterday's change trusted the internal
   `DEEP_AUDIT_2026-05-13` doc (which claimed a 3-ton vertical is "$10.5–16.5k") and undershot the
   market. A fresh live-source check (HomeGuide / Angi / Fixr / HomeAdvisor / Carrier / Bryant
   2026) is unanimous: a 3-ton vertical geothermal is **$20,000–$32,000 installed** (~$25,500 avg,
   ~$8,500/ton — vertical drilling dominates). Raised the per-ton constants (`geothermal.ts` +
   `geothermal-cost-ranges.csv`), regenerated the bands (typical now $20,300–$31,800), and
   re-reconciled the guide + calculator-page copy. This converges on the live-source truth rather
   than ping-ponging.
2. **14 bespoke calculators had detached form labels** (`<label>` with no `htmlFor`, control with
   no `id`). Screen readers announced the fields as unlabeled; clicking a label didn't focus it
   (WCAG 1.3.1 / 3.3.2 / 4.1.2). The 2026-07-04 "all form controls labeled — CLEAN" claim only
   validated the 5 flagships (which are correct). Associated all 14 (browser-verified: label click
   now focuses the control).
3. **Two FAQ answers still framed a federal credit as live for 2026** — `ac-replacement`
   ("The 25D … covers …", also feeding FAQPage JSON-LD) and `ev-tco` ("For 2026, four
   qualifications matter" for the expired 30D/25E). Past-tensed both.
4. **~8px horizontal-scroll hairline on every `.section-shelf` page** — `.section-shelf::before`
   uses `margin-inline: calc(50% - 50vw)`, and `100vw` includes the scrollbar gutter. Fixed with
   `overflow-x: clip` on `html` (the scroll container; on `body` it doesn't clip a viewport-relative
   margin). Browser-verified: `canScrollHorizontally: false`, nothing paints off-screen, sticky +
   smooth-scroll intact.

---

## §1 — Calculation correctness (deep, all 32 calculators)

- **P1 — geothermal too low** (fixed, see summary #1).
- **P2 — mini-split "typical" tier pinned the priciest brand+spec** (premium Mitsubishi Hyper-Heat),
  giving a 3-zone typical of $12,480–$20,680 vs the mainstream $6,500–$12,000. Switched the small +
  typical tiers to the mid/value brand (Fujitsu) standard spec; large keeps the cold-climate
  upgrade. Typical is now $9,312–$15,928 — brackets the published band. Regenerated.
- **P2 (kept, documented-defensible):** AC two-stage "typical" sits at the high end of the market
  (the tier is legitimately a two-stage premium, and the low band is defensible); the standalone
  battery small-tier $/kWh runs above `solar.ts`'s small `BATTERY_ADDER` (both sourced; small
  systems genuinely carry a higher $/kWh from fixed install costs). Left as-is with rationale.
- **P3 (fixed):** gas-furnace `TIER_LABELS.typical` "96% AFUE" → "95%" was already fixed 2026-07-04;
  today's residual polish items (generator no-op ternary, boiler duplicate oil tier, thermostat
  identical Ecobee/Nest bands) are cosmetic and left.
- **CLEAN:** all 32 published projects structurally sound (no inverted/zero-width/negative bands,
  monotonic tiers); the generated `scenario-projects.json` matches the compute functions to the
  dollar (drift gate green); edge cases (state `US`, min/max inputs, every select option) produce
  no NaN/negative gross; operating-cost physics (UA, COP, therm/kWh, AFUE) sane; all 5 federal
  credits correctly 0 for 2026; EIA energy prices current (2026-07-04 refresh held).

## §2 — Content quality + temporal consistency

- **P1 (fixed ×2):** `ac-replacement` 25D "covers", `ev-tco` "For 2026 four qualifications" (summary #3).
- **P2 (fixed):** AC SEER2 minimum was wrong (site said 14.3 North / 15.2 South; the 2023 DOE
  minimum for split-system central AC is **13.4 North / 14.3 South** — verified against multiple
  sources; corrected in two spots). Gas-furnace "As of 2024 DOE requires 95% AFUE" is wrong on
  timing — the 95% rule's compliance date is **2028**, 80% is still legal now (corrected in three
  spots incl. the FAQ question framing). Sourced-out the unverified Schneider "$30B" figure. Dropped
  an AI-slop "Comprehensive" from the water-heater-comparison meta.
- **P2/P3 (fixed):** four meta descriptions had dangling ", and." / ", and a." copy-generation
  artifacts (`ac-replacement`, `guides/boilers`, `guides/gas-furnaces`, `guides/solar-payback`) —
  rewritten to complete sentences; `guides/index` geothermal card blurb 25D past-tensed; the
  `hiring-a-contractor` meta trimmed to ≤160.
- **CLEAN:** no residual live-25D worked examples site-wide (the 2026-07-04 sweep held), zero broken
  internal links (908 hrefs → 700 routes), FAQ JSON-LD ↔ visible copy structurally can't diverge,
  no emoji / funnel / single-number framing, factual spot-check of NEC/Manual-J/refrigerant/UEF
  claims correct.

## §3 — SEO / schema / meta

- **P2 (fixed):** the heat-pump by-state hub hand-coded a `BreadcrumbList` *and* passed `breadcrumbs`
  to Layout (which emits its own) — duplicate identical structured data. Removed the hand-coded one.
- **P3 (fixed):** four `*-cost-[state]` templates rendered "1 rebate programs" (no pluralization) —
  added singular/plural via a hoisted const (avoiding the Astro frontmatter
  ternary-in-template-literal parser bug, which bit the first attempt).
- **P3 (observations, not defects):** solar state pages emit only `WebPage` (no FAQPage — a
  rich-result gap, not an error); several city/state pages fall back to `og-default.png`. Left as
  design choices.
- **CLEAN:** all 21 page-type templates — titles ≤60, metas present ≤160, one h1, self-referential
  canonicals, `lang`, absolute+resolvable OG/twitter, valid type-appropriate JSON-LD, sitemap 700
  URLs correct namespace, robots allows, programmatic pages genuinely unique (no thin content).

## §4 — Accessibility (WCAG AA)

- **P1 (fixed):** 14 detached form labels (summary #2).
- **P2 (fixed):** two small-text-on-tint pairs failed AA — the sim Preset/Custom badge and the
  catalog price band on hover (ink-500 on `#f1f5f9` = 4.34:1). Darkened both to ink-600 (7.24:1).
- **P3 (fixed):** the toggle off-state track border (`#94a3b8`, 2.56:1) raised to `#64748b` (4.76:1)
  for 1.4.11 non-text contrast.
- **CLEAN + prior fixes held (6/6):** simulator modal focus lifecycle, ResultPanel aria-live removal,
  Label-in-Name, toggle focus ring, header chevron aria-hidden, MonteCarloSim `role="status"` all
  verified present. Keyboard traversal, landmarks, heading order, chart `role="img"`+text, image
  alt, reduced-motion all clean.

## §5 — Bugs / data integrity / link health

- **P2 (fixed):** 4 hard-dead source URLs — `mass.gov/orgs/department-of-energy-resources` (404),
  `mieleusa.com/.../heat-pump-tumble-dryers-1452` (404), `grundfos.com/.../comfort-system-pm-pumps`
  (404), `heatpumpcollaborative.org` (NXDOMAIN) — replaced with verified-live targets (the first two
  return 403 to datacenter clients = alive; NEEP `ashp.neep.org` 200).
- **P3 (documented, not fixed):** several `*-cost-ranges` / `*-assumptions` CSVs are parsed by
  `data.ts` but not consumed at runtime (the modules hardcode the same values) — a latent-drift
  architecture risk, not a live defect. Kept the geothermal CSV in sync with its module as the
  lightweight governance move; the broader "make modules read the CSVs" refactor stays on the
  roadmap.
- **CLEAN:** build clean, `audit-scan` 0 orphans, slug-triple invariant holds (32↔32), localStorage
  schema agrees writer↔readers, the share-URL codec fails closed on every hostile input probed
  (giant/nested/unicode/NaN/duplicate/41+-token), 8 of the module↔CSV pairs match cell-for-cell.

## §6 — Performance / CWV / code health / monetization

- **P2 (fixed):** the `<picture>` fallback `<img src>` pointed at `.webp` on 37 heroes — a browser
  supporting neither AVIF nor WebP (the exact case the JPG exists for) got an undecodable WebP, and
  the JPGs were dead weight. Retargeted the `<img>` fallback to `.jpg` (the one bare-`<img>` by-state
  hub kept `.webp` since it has no `<picture>` fallback and WebP-direct is smaller). Fixed a real
  `og:image` 404 on `hiring-a-contractor` (`electrical-panel-hero-photo.jpg` doesn't exist →
  `panel-upgrade-hero-photo.jpg`). Added `preconnect` for the two async analytics origins.
- **P1 (DEFERRED, documented):** `data.ts` imports all 51 CSVs at the top level, so every calculator
  island ships the whole ~46KB-gz data chunk (a heat-pump page needs ~6–8 CSVs, ships 51). This is
  the single biggest CWV lever, but splitting `data.ts` into per-module data barrels touches all 40
  calculators' imports and risks hydration regressions across the fleet — scoped as a dedicated
  follow-up rather than rushed into a broad audit-remediation commit. Recorded as the top perf item.
- **CLEAN:** code-splitting excellent (every island its own chunk), zero `console.*`/TODO in shipped
  code, no duplicate option arrays post-extraction, monetization fully env-gated + inert, no-funnel
  intact, GA4 Consent Mode v2 correct, security headers + cache-control sane, no image over 250KB,
  fonts self-hosted subset-only.

---

## Pass 2 — verification

Every fix was verified: `npx tsc --noEmit` clean; `npm test` **9/9 green** (incl. the regenerated
geothermal + mini-split bands passing the drift gate); `npm run build` 701 pages / 700 sitemap URLs;
browser (dev server, desktop + 390px): no horizontal scroll (`canScrollHorizontally: false`), catalog
project names render in full (0 truncation), the insulation calculator's 7 controls all labelled with
label-click focusing the control, geothermal simulator band shows $20,300–$31,800, zero console errors.
Shipped in commit `aa44a73`, pushed to `main`.

### Kept-as-is (documented decisions)
- AC two-stage typical band + standalone-battery small-tier $/kWh — both sourced and defensible.
- The `data.ts` CSV-split (top perf lever) — deferred as a scoped follow-up, not rushed.
- Latent-drift CSVs (parsed-but-unconsumed) — geothermal kept in sync; the general refactor is roadmap.

*Two full-site deep audits now on record (2026-07-04, 2026-07-05). Companion machine log:
`FULL_AUDIT_2026-07-05.log`.*
