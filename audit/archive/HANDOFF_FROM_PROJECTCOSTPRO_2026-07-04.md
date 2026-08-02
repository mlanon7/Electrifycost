# Handoff: port the 2026-07-04 ProjectCostPro upgrades to Electrifycost

**From:** projectcostpro.com working session, 2026-07-04 (commits `157d935`, `89af93e`, `90af5dc` on
`mlanon7/projectcostpro`, all live).
**To:** the next AI session working in this repo (`D:\claude projects\Websites\Electrifycost\`).
**Owner:** Martin Lashgari, Ph.D., P.E., PMP.

## How to use this document

1. Read this file end to end, then `CLAUDE.md` in this repo. **Where this handoff and
   Electrifycost's own rules conflict, Electrifycost's CLAUDE.md wins** (stack, validators,
   commit format, byline/E-E-A-T, no-funnel).
2. This is a **behavioral spec with a working reference implementation**, not a file-copy job.
   ProjectCostPro is vanilla JS with runtime CSV fetches; Electrifycost is Astro 4 + React + TS +
   Tailwind with build-time CSV imports. Port the contracts and behaviors in React/TS idiom.
3. The reference implementation is on the same disk — read it freely:
   `D:\claude projects\Websites\projectcostpro\` (files listed per item below). Live behavior:
   https://projectcostpro.com/tools/home-cost-simulator/ and any calculator page.
4. Work top to bottom: items are ordered by value. A/B are one project (B is A's prerequisite).
   Present a short design for A+B and get the owner's approval before building; the rest are
   small enough to just do.
5. Ship through Electrifycost's own gates (`npm test`, 4 stages) + browser verification at
   375px / 412px / desktop, exactly like the acceptance lists below.

---

## A. Project Simulator v2 — the flagship port

**What it is:** a `/tools/`-style page where a visitor builds a *plan* of multiple projects
(heat pump + panel upgrade + EV charger + insulation…), each as a configured instance, and gets an
honest combined budget from a 10,000-trial Monte Carlo (correlated draws over each project's band)
plus a professional plan report. On ProjectCostPro this is the site's differentiator; nothing on
Electrifycost does this today.

> Note: `projectcostpro/docs/PORTABLE_SIMULATOR_PLAYBOOK.md` describes the ORIGINAL (v1)
> architecture. This handoff **supersedes its state-model sections** — v1's slug-keyed selection
> map, ×1–9 quantity stepper, and "Custom" chips were replaced in v2 after an owner + GPT audit
> found them misleading. Use the playbook for the Monte Carlo math background only.

**Core model (the part that must survive translation):**

- State is an **ordered array of project instances**, never a slug-keyed map. An instance is either
  - `preset`: `{ slug, tier }` — band comes from the published scenario table, regionally indexed; or
  - `custom`: `{ slug, band:{low,high}, spec, qs, brk, locLabel }` — captured from the real
    calculator; band used **as-is** (its region is already baked in).
- **Duplicate-as-instance replaces any quantity multiplier.** Two heat pumps = two independently
  configurable instances. Never ship a generic ×N stepper.
- **Custom configurations serialize INTO the share URL** (base64url JSON per instance:
  `{l,h,s,q,g,b}` = band low/high, spec string, share-param query string, region label, cost
  breakdown). Acceptance: a share link opened in a clean browser (no localStorage) reproduces every
  band and spec exactly, and Edit reopens the calculator with the exact inputs via `q`.
- **Fail closed, visibly:** an unknown tier name, an unreadable custom blob, or a
  saved-in-another-browser token falls back to *Typical* with a visible notice. Never silently
  substitute a different preset (v1 silently fell through to the LARGE tier — a real bug).
- **"Clear plan" clears the plan only.** It must never delete the visitor's saved calculator
  configurations (v1 wiped them sitewide).
- Plan persists to localStorage (versioned document); the URL always wins over storage on load.

**Page anatomy (mobile order = DOM order):** hero + ZIP → **"Your project plan"** workspace
(cards: project name, Preset/Custom badge, spec line, band, full-width scenario select with
untruncated labels, Edit / Duplicate / Remove, per-project "most likely ≈ $X · Y% of total" after a
run) → results + report → **"Add projects"** catalog (search + quick-start bundles + simple rows:
name, typical band, "+ Add", "Add saved setup" when a saved config exists), auto-collapsed on
phones. In v1 the result sat ~4,400px deep on a 390px phone; v2 puts it at ~1,800px.

**Results + report:**
- Headline cards: Optimistic (P10) · **Most likely (median, P50)** · Safer budget (P90). Use the
  median and label it honestly — do not display the distribution mode.
- "Planning cushion: $Δ (+P%) between the median and the safer budget" (P90 − P50).
- **Plan summary table**: Project | Scope | Planning band | Most likely | Share, plus a Total row
  and per-project cost-breakdown `<details>` (materials/labor/…) for custom instances.
- Meta line: date · region pricing · trials · seed · surprises on/off.
- **Save as PDF** = print CSS that emits a branded report only (header strip with brand + URL;
  hide nav/catalog/controls; `beforeprint` opens all details; monochrome-safe).
- **Download CSV** = the same schedule rows + totals + P10/median/P90 + meta, BOM-prefixed blob.
- Seeded reruns: `seed=` in the URL pins a run; the run button is a "Re-run simulation" reseed —
  input changes re-run automatically.

**Region consistency rule:** the simulator's ZIP multiplies PRESET bands (weighted by each
project's material/labor/equipment mix); when the user opens a calculator popup to customize, the
simulator's ZIP rides along into the calculator so custom and preset bands share one regional
basis. Custom bands are never re-multiplied by the page ZIP.

**Reference files (read these first):**
- `projectcostpro/shared/scenario-sim.js` — the whole controller; the top-of-file `SimCodec` IIFE
  (b64url codec, `encodeInstances`, `decodeParam`, `sanitizeQs`, `cleanBrk`, `composeSpec`) is
  framework-free ES5 you can lift into TS nearly verbatim.
- `projectcostpro/scripts/test-sim-state.js` — 32 codec assertions (round-trip, legacy expansion,
  fail-closed, sanitizer). Port the assertions with the codec; wire into this repo's test gate.
- `projectcostpro/shared/montecarlo.js` — triangular draws + shared market factor (rho ≈ 0.5),
  percentiles incl. p50; deterministic seeded; framework-free.
- `projectcostpro/tools/home-cost-simulator/index.html` + the `sim-*` blocks in
  `projectcostpro/shared/styles.css` — layout, print CSS, report styling.
- `projectcostpro/shared/scenario-projects.json` + `scripts/build-scenario-bands.cjs` — the
  published per-project tier bands are **generated by running each calculator's real engine
  headlessly** with a `--check` drift gate. Electrifycost must do the equivalent (a script that
  renders each React calculator's compute function on preset inputs at build time) so simulator
  bands can never drift from the calculators.

**Electrifycost adaptation notes:** one hydrated island for the whole simulator page; the
"embedded calculator popup" can be the actual calculator component rendered in a modal (no iframe
needed — same bundle), which makes the snapshot handoff (item B) a plain callback/context instead
of localStorage transport. Keep localStorage only for plan persistence and cross-page saved
configs. Everything else (codec, fail-closed rules, report, print/CSV) ports as specified.

**Deferred here too — do not build:** the two-level line-item Monte Carlo (sampling each
calculator's internal line items). Both audits deferred it; capture the per-project breakdown in
snapshots now so it stays possible later.

## B. Calculator → snapshot contract (prerequisite for A's custom capture)

Every calculator, on a **real user interaction**, publishes a structured estimate snapshot:

```
{ v:2, low, high,                 // installed band, rounded
  sub,                            // the calculator's own scope sentence ("280 sq ft deck - …")
  qs,                             // share-param query string that reproduces these exact inputs
  attrs: [[label, choice], …],    // every labeled SELECT choice (material/system/finish)
  brk: { m:[l,h], l:[l,h], e:[l,h], p:[l,h], k:[l,h] },   // category cost breakdown
  loc,                            // resolved pricing-region label
  mode, ts }
```

Two rules that came from real bugs:
1. **Gate on genuine interaction** (`Event.isTrusted` on pointerdown/keydown/input/change — in
   React, gate on actual handler invocations, which are trusted by construction, but make sure
   programmatic prefill from share-URL params does NOT mark the calculator as "customized").
   Without the gate, opening a shared link created phantom "Custom" entries in the simulator.
2. Provide a deliberate test seam (PCP uses `window.__PCP_TOUCH()`) so automation can arm the same
   flag a real tap would — synthetic events can't, and E2E checks need a path.

The spec line shown to users is composed as: select choices first (parenthetical price hints
stripped; boolean-ish choices like "Yes - include stairs" dropped; short ambiguous values
disambiguated with their label noun, e.g. "Composite railing"), then the scope sentence. See
`composeSpec` in `scenario-sim.js` + its tests.

Prerequisite check: Electrifycost calculators need shareable `?param=` URLs (PCP pattern: every
logical input key serializes/restores; numeric params clamped to input min/max so a crafted link
can't render absurd totals; select params retried after options populate). If Electrifycost lacks
this, build it first — it's independently valuable (every estimate becomes addressable).

## C. Bid-check with per-line scope (new feature for Electrifycost — optional but cheap)

"Is this contractor quote in range?" tool on each calculator page: quote input + scope select
(materials-only / basic / full / unknown) → Within / Low / Way under / High + honest advice.
The 2026-07-04 addition: a **"Custom — choose included items"** scope that lists the calculator's
current line items as checkboxes; the comparison band is rebuilt from exactly the ticked lines
using the engine's own markup gating (lines whose basis is installed-subcontract/permit/fixed pass
through unmarked; the rest carry the effective markup). Advice copy states that unticked items
(permits, extras) would be on top. Reference: `projectcostpro/shared/bid-check.js` (~190 lines,
logic is framework-free), `.bid-lines` CSS block in `styles.css`.

## D. Hero/OG image weight — JPEG fallback policy

PCP's photographic hero PNGs sat at a palette-PNG floor (300–570 KB each; 21.9 MB total) and were
the `og:image` targets. Fix that shipped: generate JPEG fallbacks (sharp, quality 78, mozjpeg,
progressive, 1200px) → 6.1 MB total; point `<img>` fallback + `og:image` + `twitter:image` at the
.jpg; keep PNG masters on disk so stale external OG caches never 404. Reference:
`projectcostpro/scripts/convert-heroes-jpg.cjs`.
**Electrifycost action:** audit `public/` + OG image targets for photographic PNGs > ~250 KB. If
Astro's asset pipeline already emits optimized formats for page images, only the static OG
targets likely need this. Skip entirely if nothing is heavy — measure first.

## E. Data governance — make derived pricing classifications explicit (zero-drift)

PCP's engine derived each rate row's markup gate (`material_delivered` / `labor_unit` /
`equipment_rental` / `installed_subcontract` / `permit` / `fixed`) from free-text keywords; a
reworded note could silently change pricing. Fix: an explicit `basis_type` column on every rates
row, written by a script to the **currently derived** value (zero behavior change, proven by the
band drift gate), with the engine preferring the explicit value and falling back to derivation on
unknowns. Reference: `projectcostpro/scripts/standardize-basis.cjs` + `shared/engine.js`
(`VALID_BASIS_TYPES`).
**Electrifycost action:** find any place a keyword/heuristic classifies data rows (markup gating,
rebate eligibility flags, credit-expiry logic). Same recipe: explicit enum column, script-written
from current behavior, validator rejects unknown values, drift gate proves zero change.

## F. Mobile table gotcha (this one bit us twice — check Electrifycost now)

A global mobile rule (`@media(max-width:640px){ table{table-layout:fixed} }` + `td{word-break:
break-word}`) is fine for 2–3 column content tables but **destroys any 4-5 column money table**:
equal-width crushed columns and "$15,700–$26,800" shattered one character per line (a single row
rendered 598px tall). Fix pattern for wide tables: scoped `table-layout:auto; min-width:<natural>;
word-break:normal` inside an `overflow-x:auto` wrapper, and at ≤640px **fold the columns that are
duplicated elsewhere** so the essential columns (name + range) fit a 375px phone with zero
side-scroll. Audit Electrifycost's comparison/rebate tables at 375px for the same crush; also two
grid gotchas: never leave explicit `grid-column` placement unscoped by a min-width media query,
and stacked card grids need `grid-template-columns:minmax(0,1fr)` or long child content forces
page-level horizontal scroll.

## G. Source-URL health pass — the method (run it on Electrifycost's CSVs)

Status-check every distinct `source_url`; classification rules learned the hard way:
- **403/429/timeout ≠ dead.** bls.gov 403s ALL datacenter clients; retailers bot-wall. Only
  404/410/NXDOMAIN counts as dead. Skip-list known bot-walls (homedepot, angi, homeadvisor…).
- **HomeGuide tell:** paths that EXIST return 403 to datacenter clients; missing paths return 404
  — so you can verify a replacement slug exists without seeing the page.
- Replace only hard-dead URLs, with existence-verified targets; keep everything else.
- Working BLS deep-link format (verified in a real browser):
  `https://data.bls.gov/oesprofile/?major_group=XX0000&occupation=XXXXXX&measure=04`.
Reference: this pass found 19 dead HomeGuide paths (62 row references) on PCP after two earlier
passes had already fixed 40+ links — rot is continuous; make it a quarterly habit.

## H. Small disciplines worth copying

- **Cache-busting:** PCP hand-versions shared assets (`?v=YYYYMMDD`). Astro fingerprints bundles
  automatically — but check anything served from `public/` (fonts, OG images, any hand-included
  script) for the same staleness risk under long cache headers.
- **Freshness pipeline:** one per-URL date from git history driving footer stamp + JSON-LD
  `dateModified` + sitemap `lastmod`, with a validator that fails on disagreement or future dates
  (`projectcostpro/scripts/sync-freshness.cjs` + `validate-dates.js`). Port if Electrifycost's
  three clocks can disagree.
- **CI:** PCP runs all validators on every push (`.github/workflows/validate.yml`, ~15s). If this
  repo has no Actions workflow for `npm test`, add one.

## Non-goals / guardrails (unchanged from portfolio rules)

No funnel surfaces of any kind; planning ranges, never single numbers; byline + last-reviewed on
every new surface ("Martin Lashgari, Ph.D., P.E., PMP"); passive monetization only; no Craftsman
or other licensed content in public files; simulator copy must repeat "planning simulation, not a
quote or bid." The simulator is a YMYL surface — keep the AACE Class 5 framing and the
methodology/sources links PCP uses.

---

*Written by the ProjectCostPro session on 2026-07-04. Full context if needed:
`projectcostpro/PROJECTCOSTPRO_AUDIT_2026-07-04_SIMULATOR_COMBINED_PLAN.md` (design decisions +
adopt/modify/defer verdicts vs the GPT audit) and `projectcostpro/.claude/latest.md` (state of
that repo). This file is not deployed by Astro; commit it or delete it after the port ships.*
