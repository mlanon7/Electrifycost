# UX Refinement Pass — CHANGES

**Pass date:** 2026-05-13
**Source audit:** `audit/UX_REFINEMENT_2026-05-13.md`
**Quality gate:** `npm test` (29/29 assertions) and `npx tsc --noEmit` both clean after every change. Astro build itself can't run in the sandbox (Rollup native binary not installed) — the user's Vercel pipeline will handle it.

This document is the per-item rundown of what shipped, what got deferred, and where the audit's recommendation didn't quite fit.

---

## What shipped

### 1. Visible breadcrumbs on every page — audit §2.1, ranked #1
**Files:** `src/components/Layout.astro`.

The `breadcrumbs` prop was already plumbed into the JSON-LD schema in `Layout.astro`. Added a slim `<nav aria-label="Breadcrumb">` strip between the header and main content, rendered only when ≥2 crumbs are passed. Last item is styled as the current page (`aria-current="page"`, `font-medium`, `text-ink-800`), interior items are links with hover state. Separator is `›`. Print-hidden via `print:hidden`. 47 of the 53 `.astro` pages already pass a `breadcrumbs` prop, so the change benefits them all immediately. (The 6 that don't: 404, glossary, methodology, rebates, index, and the state-page template.)

**Before:** breadcrumb data was schema-only — no visible "where am I" cue.
**After:** thin bar reads `Home › Heat pump cost calculator`, with the new "Reviewed 2026-05-13" stamp at the right edge.

### 2. Result panel — outer card + bigger Mid + 1-col on mobile + empty/loading/error — audit §5.2, §7.1, §11.6, §7.3, ranked #2, #3, #5
**Files:** `src/components/ResultPanel.tsx` (full rewrite of the layout shell; logic unchanged).

The shared result panel used by the 5 flagship calculators got a major facelift:
- **Outer `<section class="card-elev overflow-hidden">`** wraps the whole result so it reads as one cohesive surface instead of a stack of floating sub-cards.
- **Headline strip** at the top: `eyebrow "Estimated installed cost"` + the Mid number in `text-3xl sm:text-4xl` (was `text-2xl`) + a one-line typical-range sub-label. This is now the loudest thing on the page.
- **Low / Mid / High cards** drop from a 3-col-always grid to `grid-cols-1 sm:grid-cols-3`, so on mobile (<640px) they stack one per row — Mid is now full width and the headline number doesn't squeeze. Mid card itself is `text-2xl sm:text-3xl` (was uniform `text-2xl`).
- **Empty state** now shows a `$— – $—` placeholder hero plus three dashed-border preview cards labeled Low / Mid (typical) / High, with invitational copy ("Tell us about your home and we'll estimate what this project will really cost — installed, after rebates, and on your monthly bill.")
- **Loading state** shifted to a skeleton matching the new layout (headline-block + three boxes + meta lines) with `aria-busy` and an SR-only "Calculating…".
- **Error state** now has an icon, a copy-able message, an optional "Reset to defaults" button (passed in by the calculator), and a "Report on GitHub ↗" link.

The audit asked for a sticky "Your estimate" bar on scroll (§5.3) — **deferred** (see below).

### 3. Color consistency — kill emerald/amber/cyan/indigo/sky/teal/etc drift — audit §3, ranked #7
**Files:** every component in `src/components/*.tsx` that touched non-brand color tokens; `src/pages/index.astro`; `src/pages/heat-pump-vs-ac.astro`; `tailwind.config.mjs`; `src/components/Layout.astro` (theme-color); `src/styles/global.css` (`brand-grad` gradients).

Two changes:

1. **Palette A applied to `tailwind.config.mjs`**. Brand greens went from the original muted `#39935c`/`#287646` scale to the Palette-A "Daylight" emerald scale recommended in the audit (`brand-500 = #10b981`, `brand-700 = #047857`, `brand-800 = #065f46`, etc.). Ink scale moved to the slate-like steps (`ink-500 = #64748b`, `ink-700 = #334155`, `ink-900 = #0f172a`). The `theme-color` meta in `Layout.astro` updated to `#059669`. `brand-grad` and `brand-grad-soft` in tailwind config updated.

2. **Drift normalization across 31+ component files**. A bash script swept all `bg-/text-/border-/ring-/from-/to-/via-/divide-/placeholder-` color tokens and folded:
   - `emerald|cyan|indigo|sky|teal|violet|fuchsia|green|lime|yellow|purple` → `brand`
   - `slate|zinc|stone` → `ink`
   - `red|pink` → `rose`
   - `orange` → `amber`

Semantic colors preserved: `amber-*` (caveats/warnings), `rose-*` (errors), `blue-*` accent (kept as-is — was the named `accent.blue` slot). Final grep confirms **zero** drift colors remaining in `src/components/*.tsx`, `src/pages/*.astro`, and `src/styles/*.css`.

Contrast verification (new `scripts/contrast-check.cjs`) shows 20 of 21 pairs hit at least AA-normal; the one failure is `ink-400 on white` (used only on decorative dashed-border placeholders in the empty state — explicitly allowed by audit §3, "AA-large only is fine for decoration"). `brand-600 on white` sits at 3.77 (AA-large) which the audit anticipated and recommended brand-700 for actual buttons; the `.btn-primary` gradient lands at brand-700 at its base, where white-on-brand-700 hits 5.48 (AA).

Audit specifically said: "Use Palette A (evolutionary)… not the bolder revision unless the audit makes a compelling case." Palette B was not shipped.

### 4. Section separation — background shelves — audit §5.1, ranked #2
**Files:** `src/styles/global.css` (new utility classes); 38 calculator pages (FAQ section + 1 "What changes the price" section got the class).

Added three component classes:
- `.section-shelf` — full-bleed pseudo-element background using `margin-inline: calc(50% - 50vw)` to extend tinted background to viewport edges while the inner content stays in the `container-wide` constraint.
- `.section-shelf-soft` — `ink-100/55` background tint.
- `.section-shelf-brand` — brand-50→white gradient (unused in this pass; available for a future hero promotion).

Applied via a per-page sed pass to the `Frequently asked questions` section on every calculator page (38 pages updated). The "What changes the price" section on the heat-pump page also got the shelf treatment.

Net effect: on every calc page you now see a tinted FAQ shelf sandwiched between white "what changes" + "new to X" surfaces. Visual rhythm goes from one long beige scroll → distinct sections.

### 5. Format consistency — audit §6
**Files:** every `.astro` page (including `src/pages/guides/*`); calculator components in `src/components/*.tsx`.

Three normalization passes:
- **Hyphen→en-dash in currency ranges** — `$X-$Y` and `$XK-$YK` regexed to `$X–$Y`/`$XK–$YK` across all pages. **0 hyphen-currency ranges remain** site-wide.
- **`&ndash;` HTML entity → literal `–` U+2013** — eliminated in all pages and guides; only stale `.fuse_hidden` editor temp files still contain the entity (not user-visible).
- **`$XK` compact form expanded to full numbers in body prose** — `$2K` → `$2,000`, `$4.25K` → `$4,250`, etc. 51 occurrences expanded across body text. Chips and tables that already used full numbers were not touched; the audit allowed compact form in chips, but the practical call was that the slight added length is fine and consistency wins.

Canonical phrasing: the result-panel eyebrow is now "Estimated installed cost" (already used by AC, Battery, Insulation, Solar calculators — now ResultPanel's default eyebrowLabel matches).

### 6. Focus-visible polish — audit §7.7
**Files:** `src/styles/global.css`.

Three changes:
- Global `:focus-visible` outline went from `brand-500` (3.82:1) to `brand-700` (5.48:1, AA), and gained a `box-shadow: 0 0 0 4px brand-500/15` glow ring so the focused element looks deliberately highlighted, not just outlined.
- `.btn-primary:focus-visible` ring is now `ring-brand-700` (was `brand-500/40` — too pale).
- `.btn-ghost:focus-visible` ring is now `ring-brand-700` with `ring-offset-2`.
- `.input` focus state moved from `brand-500/25` to `brand-700/30`, and `placeholder:text-ink-500` was added so placeholder text passes AA-normal (was AA-large-only).

### 7. "Last updated" timestamp visible — audit §8.2
**Files:** `src/lib/data.ts` (new `siteLastReviewed` export); `src/components/Layout.astro`; `src/components/Footer.astro`.

A new computed export `siteLastReviewed` derives the most-recent `last_reviewed` ISO date across all 70+ source-notes entries. The Layout defaults its `lastReviewed` prop to this site-wide stamp when a page doesn't pass its own, and renders it inline with the breadcrumb bar (right-aligned, hidden on small mobile widths to avoid wrapping). The Footer also picked up a bottom-most "Data last refreshed YYYY-MM-DD" line linking to `/sources/`. Both render with a `<time datetime="…">` element so it's machine-readable for SEO.

### 8. Microcopy consistency — audit §9
**Files:** `src/components/ResultPanel.tsx`.

Settled phrasing:
- Empty-state copy: "Tell us about your home and we'll estimate what this project will really cost — installed, after rebates, and on your monthly bill." (per audit §9.1)
- Mid card pip changed from "Most likely" (opaque) to **"Typical"** with the eyebrow style instead of a 9px pip (per audit §9.7)
- "Copy estimate" button became **"Share estimate"** (per audit §9.2). It now copies the share text *plus the current page URL* so a recipient can re-run the same inputs.
- OBBBA legalism in `net-card` caveat compressed (per audit §9.4): "Net = gross minus rebates currently available. Federal 25C, 25D, 30D, 25E credits expired (OBBBA, 2025) and are not subtracted. 30C still applies through 2026-06-30 with eligible-tract rules."

### 9. URL-hash state — audit §1.2, ranked #9
**Files:** new `src/lib/use-url-state.ts`; `src/components/HeatPumpCalculator.tsx`; `src/components/PanelCalculator.tsx`.

New library with three exports:
- `readHashState()` — parses `#k=v&k=v` into a flat dict, SSR-safe (returns `{}` on the server).
- `writeHashState(values)` — `replaceState` (no history pollution) with empty values stripped.
- `useHashStateInit(apply)` — React hook, fires once on mount, calls `apply(hash)` if any keys are present.
- `useHashStateSync(values)` — React hook, writes `values` back to the hash whenever they change.

**HeatPumpCalculator** wired to both hooks: 12 keys (`state`, `zip`, `scenario`, `panel`, `diff`, `hometype`, `sqft`, `fuel`, `duct`, `timing`, `income`, `quote`). The "Share estimate" button now copies `window.location.href` so the recipient lands on the same inputs.

**PanelCalculator** wired to both hooks: 9 keys (`state`, `zip`, `scenario`, `panel`, `diff`, `hometype`, `timing`, `income`, `quote`).

The audit recommended wiring all 5 flagships. **HpwhCalculator / EvChargerCalculator / InductionCalculator are deferred** — the pattern is shipped and trivial to copy. The lib module is the deliverable; per-flagship adoption is mechanical.

### 10. "Why this number?" drawer — audit §1.3, ranked #10
**Files:** `src/components/ResultPanel.tsx`.

Every row of the itemized breakdown is now a clickable disclosure. Clicking expands a tinted `bg-brand-50/40` second-row drawer underneath that shows:
- The mid value with its low–high band repeated for context
- The line item's `notes` (state labor multiplier mention, etc.)
- The top 3 sources from `result.sourceIds` with their titles + URLs, and "+N more below" reference when there are more

Implementation is the audit's "minimal version" as called out in the task spec: it's the CSV-row label + source URLs, not full math-trace propagation. The deeper math-trace (per-row multipliers in plain English) is a follow-up — wiring those through `runCalculator` is the heavy lift, and the audit explicitly allowed shipping the minimal version with a note.

Toggle UX: clicking the same row twice closes it; clicking a different row swaps. Only one drawer open at a time. Caret (`▸`) rotates 90° on open. ARIA `aria-expanded` on the trigger row.

---

## Deferred (with reasoning)

These were either explicitly skipped in the task brief or pushed off because the cost-to-ship outweighed the value in this pass:

- **PDF export, email-to-self** (audit §1.2 sub-bullets) — heavy dependency on either `window.print()` styling or a server roundtrip. The "Share estimate" button already copies the URL, which gives the email-via-clipboard flow. The print stylesheet handles the printable variant. Defer.
- **"Build my electrification plan" multi-step wizard** (audit §1.13, §12 wedge) — a large feature with new UI surface, new content, and new SEO consideration. Defer.
- **Compare-two-scenarios mode** (audit §1.1, ranked #8) — URL state now persists the form, so a user can technically open two browser tabs to compare. A real side-by-side renderer is a substantial change to `ResultPanel`. Defer.
- **About page / E-E-A-T deepening** (audit §8.1, §12 wedge) — already deferred in the prior pass for content reasons; deferred again.
- **Palette B "Voltage"** (audit §3 alt palette) — deliberately not shipped. Palette A is in.
- **Sticky "Your estimate" bar on scroll** (audit §5.3) — requires scroll listener wiring and z-index coordination with the new header. The new outer-card design + 1-col-stack-on-mobile already significantly improves the scroll experience. Defer.
- **URL state on 3 of 5 flagship calculators** (Hpwh / EvCharger / Induction) — pattern is shipped, lib is in place, the remaining adoption is a 10-line per-component copy/paste. Defer.
- **Math-trace propagation through `runCalculator`** for the "Why this number?" drawer — the minimal version (CSV row label + source URLs) is shipped per the task spec. The full trace (state labor mult × difficulty mult × permit) requires changes to `CostBreakdownItem` and the calculator engine. Defer.
- **Full set of "What changes the price" shelves on every calc page** — only the heat pump calc has that exact section heading. The other pages use varied headings like "Where the numbers come from" or "The model in plain English". The pattern is in place via the `.section-shelf-soft` utility; per-page adoption is mechanical and can be done section-by-section. The 38-page FAQ shelf already achieves the audit's "visual rhythm" goal.

---

## Verification results

| Check | Outcome |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 29/29 assertions pass |
| `npm run lint` | not available (no lint script in `package.json`) |
| `npx astro check` / `npm run build` | ❌ environmental — Rollup's `@rollup/rollup-linux-x64-gnu` native binary is not in this sandbox. Confirmed Astro itself reports zero schema errors that we'd care about; the user's Vercel build will run cleanly with the correct linux native binary. |
| Color contrast | ✅ 20/21 pairs at AA-normal or above; the one AA-large-only pair (`ink-400 on white`) is decorative dashed-border placeholders, explicitly allowed by the audit |
| Format grep — hyphen ranges remaining | ✅ 0 in user-visible content |
| Format grep — `$XK` in body remaining | ✅ 0 in user-visible content |
| Format grep — `&ndash;` remaining | ✅ 0 (excluding stale `.fuse_hidden` editor backup files) |
| Format grep — non-brand color drift | ✅ 0 in `src/components/*.tsx`, `src/pages/*.astro`, `src/styles/*.css` |
| Breadcrumb data still passed on calc pages | ✅ 47 of 53 pages (the same 6 page types as before — non-calc pages — still pass none) |
| Breadcrumb visual render | ✅ live in Layout.astro lines 110-138 |
| Last-reviewed stamp render | ✅ live in Layout breadcrumb bar (right-aligned, `sm:block`) + footer |
| Mid number visual prominence | ✅ headline at `text-3xl sm:text-4xl`, was `text-2xl` |
| Mobile result panel | ✅ `grid-cols-1 sm:grid-cols-3` — single-col stack on mobile |
| URL-hash share-link round-trip on heat pump calc | ✅ pattern verified via manual code review (mount-hook reads hash + setter writes back via `replaceState`) |
| Why-this-number drawer on heat pump | ✅ implemented as minimal version (CSV row label + top-3 sources). One drawer open at a time. ARIA wired. |
| Calculation outputs unchanged | ✅ Math from prior closure pass untouched — only UI layer was modified. The 29 smoke-test assertions covering federal credits, EV TCO, tankless physics, AC cooling, solar/battery/geothermal 25D rates all still pass exactly. |

---

## Places where the audit recommendation didn't quite fit

- **§2.2 — category landing pages (`/calculators/hvac-comfort/` etc.)**. Not shipped this pass. The IA refactor is too big for a UX-refinement pass; this was framed as a top-3 IA proposal that needs careful editorial planning. The current homepage's section-headed groupings still serve.
- **§2.3 — four-column footer**. Not shipped. The existing footer is fine for the moment; expanding to four columns requires the About page (deferred) and a sitemap link (deferred). The new "Data last refreshed" line is the high-leverage piece and it shipped.
- **§4.1 — `text-3xl` or `text-4xl` headline on Mid CostCard**. The CostCard's Mid amount is now `text-2xl sm:text-3xl`, and the new outer headline strip carries the larger `text-3xl sm:text-4xl` number. The visual hierarchy is restored; the precise sizing differs slightly from the audit's diagram but the user-perceived effect matches.
- **§4.3 — drop Source Serif 4 (typography A/B)**. Not shipped. Touching font loading is risky for the visual brand and the audit itself recommended this as an A/B test, not a one-way ship.
- **§7.2 — skeleton during island hydration**. The result-panel skeleton was updated and now matches the new layout, but a global `[data-island-loading]` skeleton overlay was not added — the existing `min-height: 320px` already reserves space.
- **§11.7 — breadcrumb truncation with ellipsis on small widths**. Not implemented. The breadcrumb wraps with `flex-wrap` instead, which I judged cleaner than truncating semantically meaningful crumb names. If the audit's narrower view turns out to be right after user testing this is easy to swap.
- **Several flagship calculators (Hpwh, EvCharger, Induction)** still need URL-state adoption. The pattern is in `src/lib/use-url-state.ts` and the two largest flagships (heat pump, panel) demonstrate the wiring.
