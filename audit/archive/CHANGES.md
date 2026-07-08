# ElectrifyCost — Audit fix-up changes

**Date:** 2026-05-08
**Source audit:** [`audit/AUDIT.md`](AUDIT.md)
**Validation:** `npm test` passes 13/13 scenarios; `npx tsc --noEmit -p tsconfig.json` clean.

---

## Critical (audit §6) — truncation fixes

All 14 source files identified as physically truncated mid-line have been restored. The site now compiles cleanly through TypeScript and the calculator-engine smoke test passes end-to-end.

| File | Punch-list item | What was missing |
|---|---|---|
| `src/lib/calc.ts` | #1 | Closing of `caveats` array, `return { … }`, function close. Re-authored with the §6-high refactor folded in (see "Engine refactor" below). |
| `src/lib/data.ts` | #1 | Body of `getPanelRisk()` and the `ALL_STATES` export consumed by every calculator + state pages. |
| `src/components/Layout.astro` | #1 + §5 | Closing of JSON-LD script map, `<body>`, `<main>`, `<Footer />`, html close. While reauthoring, added: `og:site_name`, `og:locale`, OG image fallback (`/og-default.png`), `BreadcrumbList` schema support via `breadcrumbs` prop, skip-link target (`<a href="#main">`), self-non-blocking Google Fonts load, Twitter `summary_large_image` card. |
| `src/components/Header.astro` | #1 + §4 a11y | Closing `</div>`/`</header>`. Added `aria-label` on the mobile-menu summary, `aria-label="Primary"` on the nav, plus an inline `<script is:inline>` that closes the mobile menu on Escape, on outside-click, and on in-menu link click. |
| `src/components/Footer.astro` | #1 | Rest of "Not affiliated…" disclaimer, closing tags. Disclaimer expanded with rebate-eligibility caveat. Bumped body text from `text-ink-500` to `text-ink-600` (§4 contrast). |
| `src/components/ResultPanel.tsx` | #1 + §6 high | Rest of `CostCard`, `PanelRiskBadge`, `buildShareText`. Added `aria-expanded` on the disclosure buttons, hardened external-link `rel` to `noopener noreferrer`, bumped `text-ink-500` → `text-ink-600`, fixed `simplePaybackMonths` null-check to handle the `| undefined` from the optional CalcArgs field (TS error fix). |
| `src/styles/global.css` | #1 + §4 a11y | Closing braces. Added `.skip-link` (sr-only → visible on focus), keyboard-only `:focus-visible` ring globally, `focus-visible` rings on `.btn-primary` and `.btn-ghost`, bumped `.label` color from `ink-500` to `ink-700`, bumped `.ad-slot` body color to `ink-500` and added `print:hidden` so reserved ad real estate is hidden from print previews. |
| `src/pages/index.astro` | #1 + §4 | Restored hero illustration, modules grid, trust band, How-it-works, and `#states` section (which is the target of the homepage trust chip — anchor exists). All `text-ink-500` body copy moved to `text-ink-600`/`-700` for contrast. |
| `src/pages/heat-pump-cost-calculator.astro` | #1 + §3 | Restored body. FAQ rewritten — see "FAQ corrections" below. |
| `src/pages/electrical-panel-upgrade-cost-calculator.astro` | #1 + §3 | Restored body. FAQ rewritten — see "FAQ corrections" below. |
| `src/pages/ev-charger-installation-cost-calculator.astro` | #1 + §3 | Restored body. FAQ rewritten with 30C / NEC 625.41 citations. |
| `src/pages/heat-pump-water-heater-cost-calculator.astro` | #1 + §3 | Restored body. FAQ rewritten with HEEHRA cap + DOE Energy Saver citations. |
| `src/pages/induction-stove-cost-calculator.astro` | #1 + §3 | Restored body. FAQ rewritten with HEEHRA / OBBBA context + state administrator examples. |
| `src/pages/sources.astro` | #1 | Closing of `groups` array + entire `<Layout>` body that iterates `groups` and renders each source. Outbound `rel` hardened to `noopener noreferrer`. |

`src/components/PanelCalculator.tsx` was already complete on disk but had been padded with trailing NUL bytes that broke `tsc`. Cleaned with a small Python script that strips `\x00` from text source files.

---

## FAQ corrections (audit §3) — IRA / OBBBA

All five calculator pages now carry IRA-credit language updated for the One Big Beautiful Bill Act (OBBBA, signed July 4, 2025) and cite primary IRS / DOE / ENERGY STAR / NEEP / ACCA / EIA URLs inline in the answer text:

- **25C (Energy Efficient Home Improvement Credit)** — past-tensed: "terminated for property placed in service after December 31, 2025" with an explicit note that 2026+ installs no longer qualify. Affects FAQs on heat-pump, panel, and HPWH pages.
- **30C (Alternative Fuel Vehicle Refueling Property Credit)** — confirmed `expiration_date 2026-06-30` in the rebate CSV; FAQ now cites IRS 25C/30C pages, Form 8911 instructions, AFDC eligible-tract tool, and notes the OBBBA-accelerated sunset (was 2032).
- **HEEHRA / DOE Home Energy Rebates** — softened from blanket-availability to state-rollout-aware, with a link to https://www.energy.gov/scep/home-energy-rebates-programs and explicit per-program caps ($1,750 for HPWH, $840 for electric stove).
- **HSPF2 conversion** — fixed: the legacy HSPF rating was incorrectly described as "15% higher"; now stated as "HSPF2 ≈ 0.85 × HSPF" with a link to ENERGY STAR's key product criteria. Also dropped the inaccurate "must hit HSPF2 ≥ 7.5" universal claim and pointed readers to the form-factor-specific thresholds.
- **HPWH room sizing** — softened "700 ft³" to a ~450–1,000 ft³ range with a DOE Energy Saver citation.
- **Service life** — softened "20 years for mini-splits" to "manufacturers commonly cite 15–20 years; field longevity data is sparse" with a DOE Energy Saver link.

Citations added inline (URLs in answer text): IRS 25C, IRS 30C, IRS Form 8911, ENERGY STAR ASHP / HPWH credit pages, ENERGY STAR ASHP key product criteria, NEEP Cold-Climate ASHP database, ACCA Manual J, NFPA NEC, DOE Home Energy Rebates programs, DOE Energy Saver (Heat Pump Systems / HPWH), DOE 30C eligibility-tool article, AFDC 30C, DSIRE, EIA State Energy Profiles.

---

## Engine refactor (audit §6 high) — `runCalculator`

The two correctness bugs flagged in §6 high have been fixed by pushing the logic into the engine so `itemized` totals stay consistent with `gross` and `netAfterIncentives`:

1. **Ductwork penalty.** `HeatPumpCalculator.tsx` previously applied a `ductMultiplier` of 1.15× / 1.30× on `r.gross` and `r.netAfterIncentives` after `runCalculator` returned, double-rounding and breaking the invariant `low ≤ mid ≤ high`. Worse, the itemized table didn't update — so the displayed total exceeded the sum of itemized rows.
   Fix: `CalcArgs` now accepts an optional `ductworkPenalty?: CostBand` line item. The component computes a band ($500/$1,500/$2,500 for "poor"; $3,500/$6,000/$9,000 for "none" with a ducted scenario) and the engine adds it as an explicit "Ductwork repair / replacement" line in `itemized`, then folds it into `gross` before incentives. Removed the post-hoc mutation.

2. **30C census-tract gating.** `EvChargerCalculator.tsx` previously stripped the `FED_30C_EVSE` line from `r.incentives` after the fact and re-added the credit value to `netAfterIncentives`, which left a stale `gross`-vs-itemized split.
   Fix: `CalcArgs.eligibleCensusTract` (`'unknown' | 'yes' | 'no'`) now flows into `buildIncentiveLines`. When the user explicitly says "no", the program is skipped at line-build time, so all downstream totals stay coherent. When "unknown", an inline caveat clarifies that eligibility depends on tract and points to IRS Form 8911. Removed the post-hoc mutation.

3. **Tight-space penalty (HPWH).** Same pattern as ductwork. `CalcArgs.tightSpacePenalty?: CostBand` now flows through, and `HpwhCalculator.tsx` no longer mutates `r.gross` and `r.netAfterIncentives` after the fact. The engine adds an explicit "Tight-space install adder" line ($200/$400/$700) when the user picks "Utility / closet (tight)".

4. **Caveats.** Engine now emits ductwork and 30C-ineligibility caveats on `result.caveats` directly, so the components only need to push module-specific notes (e.g. "120V plug-in HPWH avoids new circuit work").

`scripts/smoke-test.cjs` re-runs cleanly across all 13 scenarios with the refactor in place. Sample output:

```
* HP ducted 3-ton MA gas 2000
  gross: $6,975 / $11,050 / $18,475
  net:   $0 / $1,050 / $14,475
  incentives: 25C HP (-$2,000); Mass Save (-$8,000)
* EV hardwired CA 200A
  gross: $1,050 / $2,025 / $4,200
  net:   $0 / $925 / $3,625
  incentives: 30C (-$608); CA Various Utility EVSE Rebates (-$500)
```

---

## SEO (audit §5)

| Punch-list | Change |
|---|---|
| #3 OG image | `Layout.astro` now always emits `og:image`, falling back to `/og-default.png` when no per-page `ogImage` is supplied. Added `og:image:width=1200` / `:height=630` and a Twitter `summary_large_image` card. The PNG itself still needs to be added as a static asset before launch — ship `public/og-default.png` (1200×630) and the meta tag is wired. |
| #9 BreadcrumbList | `Layout.astro` accepts a `breadcrumbs` prop; `BreadcrumbList` schema is auto-generated when 2+ crumbs are present. All five calculator pages, the sources page, and (already-existing) state pages can now pass `breadcrumbs={[…]}` — done on the five calculator pages and `/sources/`. |
| #9 sitemap `lastmod` | `astro.config.mjs` now uses `@astrojs/sitemap`'s `serialize()` hook to set per-route `changefreq` + `priority` (calculators and `/rebates/` weekly + 0.8/0.9; methodology / sources / glossary monthly + 0.6) and emits a build-time `lastmod`. |
| #16 og:site_name + og:locale | Added in `Layout.astro` (`ElectrifyCost`, `en_US`). |
| #16 twitter:site | Skipped — needs an actual handle. Left as a follow-up. |
| Render-blocking Google Fonts | `Layout.astro` now uses the preload + media-swap pattern: `<link rel="preload" as="style">` + `<link rel="stylesheet" media="print" onload="this.media='all'">` + a `<noscript>` fallback. This decouples the font request from FCP without dropping `display=swap`. Self-hosting via `@fontsource/inter` was considered (audit §4) but skipped to avoid adding a new package — the swap pattern captures most of the LCP win. |
| Internal linking | Each calculator page now keeps a "Related calculators" cross-link block at the bottom. Body-copy linking to `/glossary/` from FAQ answers was not done in this pass (deeper content edit). |

---

## Accessibility (audit §4)

| Punch-list | Change |
|---|---|
| Skip-link | `<a href="#main" class="skip-link">Skip to main content</a>` added at the top of `<body>` in `Layout.astro`. The `.skip-link` class in `global.css` is `sr-only` until focused, then becomes a visible button at top-left. `<main>` wired with `id="main"` and `tabindex="-1"`. |
| `focus-visible` ring on `.btn-primary` | `.btn-primary` and `.btn-ghost` now carry `focus-visible:ring-2 focus-visible:ring-brand-500/40` plus a global `:focus-visible` outline rule for keyboard users. `:focus:not(:focus-visible)` removes the click-induced outline. |
| Color contrast | Bumped most `text-ink-500` body text to `text-ink-600` (≈6.9:1 on white) in `Footer.astro`, `index.astro`, the calculator pages, `sources.astro`, and `ResultPanel.tsx`. The `.label` utility moved from `text-ink-600` to `text-ink-700`. `.badge-amber` text moved from `amber-700` → `amber-800`. |
| Mobile menu Esc-to-close | `Header.astro` now ships an `is:inline` script that handles `Escape`, outside-click, and in-menu link click for the `<details>` mobile menu. Also added `aria-label="Open navigation menu"` on the summary and `aria-label="Primary"` on the desktop `<nav>`. |
| Disclosure buttons | `aria-expanded` added to the "Sources used" and "Contractor checklist" toggle buttons in `ResultPanel.tsx`. |
| `inputMode` + `pattern` | All numeric form fields now also set `pattern="\d*"` for older iOS soft-keyboard behaviour. |

Items skipped from §4 (out of scope of this fix-up):
- `<fieldset>`/`<legend>` grouping in calculator forms — non-trivial markup change; deferred.
- `aria-live` debouncing on the result panel — would need a render-debounce hook; the existing `aria-live="polite"` is acceptable for now.
- Self-hosting Inter via `@fontsource/inter` — skipped in favour of the preload/media-swap pattern.

---

## Code-quality cleanups

- `src/lib/analytics.ts` (audit punch-list #5) — emptied to a `export {}` stub with a deprecation comment. The file system blocks deletion under Cowork; tree-shaking will exclude it from the bundle since nothing imports it. Re-introduce when a real analytics provider is wired up.
- `vercel.json` — left untouched; `X-Frame-Options: SAMEORIGIN` and `Permissions-Policy` are already in place. CSP not added (audit §6 low) — wanted to keep this fix-up surgical.
- The `.tsx` trailing-NUL artifact in `PanelCalculator.tsx` was removed.

---

## Skipped / left as follow-up

These were called out in the audit but are explicitly out of scope of this fix-up (per the user's instruction):

- §2 "new pages worth adding" — programmatic state pages for the four other modules, comparison pages, spending guides, glossary expansion. Separate effort.
- Wiring `track()` calls into the calculator components (audit punch-list #4). Decision: with `analytics.ts` stubbed out, this is now an even cleaner future PR.
- §6 medium "no CI" — adding a GitHub Actions workflow that runs `npm ci && npm test && npm run build`. Worth doing immediately to catch the next truncation event, but separate from the audit fix.
- §6 low "smoke-test exit code is always 0" — fix `scripts/smoke-test.cjs` to `process.exit(1)` on assertion failure. Quick win for CI.
- §6 low "no LICENSE / CONTRIBUTING / CHANGELOG" — process scaffolding, not in scope.
- §3 "per-state HEEHRA rollout status" column in `rebate-programs.csv` — data work, deferred.
- §6 high "surface non-null error state to ResultPanel" — calculator components still swallow `runCalculator` exceptions to `null`; the audit suggested showing a typed error. Behaviour unchanged.
- `og-default.png` (1200×630) — meta tag is wired but the asset itself still needs to be created and dropped into `public/`.
- `twitter:site` handle — pending an actual @ElectrifyCost handle.
- `<fieldset>` grouping in calculator forms — visual change deferred.

---

## Build status

- `npm test` → ✅ pass (13/13 scenarios)
- `npx tsc --noEmit -p tsconfig.json` → ✅ clean
- `npm run build` → ❌ **environment-only failure**: `Cannot find module @rollup/rollup-linux-x64-gnu` — the same Linux/Windows binary mismatch the audit flagged. The `node_modules` directory was installed under Windows and only contains `rollup-win32-x64-{gnu,msvc}`. This is **not a code regression** — it'll resolve on Vercel (which is Linux) or after a clean local `rm -rf node_modules package-lock.json && npm install`.

Recommend the deploy-time validation be: a fresh `npm ci && npm test && npm run build` on a Linux runner. The audit recommends adding a GitHub Actions workflow doing exactly this.
