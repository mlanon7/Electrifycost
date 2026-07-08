# ElectrifyCost — UX, Design System & IA Refinement Audit

**Audit date:** 2026-05-13
**Pass:** 4 — designer's punch list (not a re-litigation of Passes 1–3).
**Scope:** the parts of the site that prior audits explicitly didn't touch — usefulness gaps, navigation IA, color theme, typography, section separation, formatting consistency, scannability, trust surfaces, microcopy, performance perception, mobile, and competitive distinctiveness.
**Method:** walked every flagship page + a sample of non-flagships in source, catalogued every color/typography decision in `tailwind.config.mjs` + `src/styles/global.css`, ran WCAG contrast calculations on every text-on-bg pair actually in use, web-checked how EnergySage, Rewiring America, and Carbon Switch handle the same UX moments, and read a representative slice of `src/components/*.tsx` to spot drift.
**Out of scope:** anything already covered in `DEEP_AUDIT_2026-05-13.md`. Calculation accuracy, content inconsistency at the page-pair level, basic SEO, broken files, hero-image speed — not re-reported.

---

## 0 — Executive read

The site has good bones — a coherent brand palette, working type scale, lots of careful per-component thought — but it reads like 38 calculators stitched together rather than one product. The biggest opportunities sit in three buckets:

1. **One result-panel design, applied consistently across all 38 calculators.** Today the five flagships use `ResultPanel.tsx` with the canonical brand-green low/mid/high cards; another ~22 calculators roll their own using `emerald-*`, `amber-*`, `cyan-*`, `indigo-*` tones that drift away from the brand. Net effect: the user gets a subtly different visual language each time they navigate between calculators, which erodes the "I trust this site" feeling more than any single number could.
2. **The result is the focal point — make it actually feel like one.** Currently the result panel shares the page's neutral surface with the form, lives below a generic itemized table, and competes with three to seven other cards (incentives, panel risk, checklist, caveats, sources, copy/print buttons) for the user's eye. The single number a user came for is buried inside a 33%-width "Mid" card with a tiny "Most likely" pip.
3. **Make every calculator a step in a project, not an island.** The site has 38 tools but no through-line. Rewiring America's `homes.rewiringamerica.org` is winning the ranking war specifically because it presents *one plan for your home*, then drills into individual upgrades from that plan. ElectrifyCost has more accurate per-upgrade numbers and better source citations, but no plan layer above the calculators. This is the single biggest wedge available.

The rest of this document is the punch list.

---

## §1 — Feature gaps & usefulness

The user explicitly asked: *what would a real user actually want here that the site doesn't have?* Here are the highest-leverage gaps, then a longer punch list.

### Top 3 proposals

**1.1 — "Compare two scenarios side-by-side" toggle on every calculator** ★★★

The single most-requested affordance from competitive calculators (EnergySage's "better/worse case scenarios", Rewiring America's "your home / typical home" toggle): a way to put two builds next to each other without losing state. Today, if a user wants to compare a 3-ton vs 4-ton heat pump, or string vs micro inverters, they have to remember the first number, change the input, and hold both in their head.

**Proposal:** add a "Compare" action next to "Copy estimate" in the bottom action row. Clicking it snapshots the current inputs+result as "Scenario A," locks a second form column open with the same starting state, and renders the result panel as two columns sharing the same itemized rows, with deltas in a third column.

ASCII layout:
```
┌─────────────────────────────────────────────────────────────┐
│  Scenario A                  │  Scenario B                  │
│  3-ton ducted, MA, 200A      │  3-ton mini-split, MA, 200A  │
│  ──────────────────────      │  ──────────────────────      │
│  Mid: $11,050                │  Mid: $13,800   (+$2,750)    │
│  Net (mid): $6,550           │  Net (mid): $9,300  (+$2,750)│
│  Monthly: −$28               │  Monthly: −$31  (−$3)        │
└─────────────────────────────────────────────────────────────┘
```

User moment: someone is deciding between equipment trims, brands, or whether to add a battery. Today they can't see both at once.

Files: `ResultPanel.tsx` (add `comparisonResult?: CalculatorResult` prop + columnar render), each flagship's calculator component (snapshot + restore + dual-state pattern), `src/lib/calc.ts` (no changes — pure UI).

Effort: **M** (~1 day for the five flagships, ~3 hours each for the others if they switch to `ResultPanel`).

Bucket: usefulness win + retention win.

**1.2 — "Save link with my inputs" + "Email this estimate to myself"** ★★★

There's a "Copy estimate" button that copies a text blob to the clipboard, and a "Print summary" button. Neither captures the *inputs* — only the rendered output. So you can't come back to your saved estimate, re-run it after Mass Save changes the rebate, share it with a spouse who'll then tweak two inputs, or send it to a contractor and have them open the same calc page pre-filled.

**Proposal:**
- Replace "Copy estimate" with "**Share this estimate**" → opens a small popover with three actions:
  - **Copy link** — encodes the current form state into the URL hash (`#zip=02139&size=3ton&panel=200&...`) and copies. Already SSR-safe; the calculator hydrates from hash on mount.
  - **Email to myself** — `mailto:` link with a pre-filled subject + body that includes the link.
  - **Download PDF** — a print-styled one-pager (existing print stylesheet does most of this; add a "tile" header layout). PDF is generated client-side via `window.print()` into `Save as PDF`, no server roundtrip.
- Keep "Print summary" as a separate fast path.

User moment: the user got the answer they came for. The most likely next action isn't "leave the site" — it's "hold this for later" or "show it to my partner." Today there is no path from result to "I'll come back to this."

Files: `ResultPanel.tsx`, each flagship calculator (URL-hash encode/decode pattern in a hook), `src/lib/share.ts` (new — 80 LOC for hash encode/decode/version-tolerant migration).

Effort: **M** (1 day all-in including all five flagships).

Bucket: retention win + product-completeness win. Currently the site has *zero* persistence; this is shocking for a planning tool.

**1.3 — "Why this number?" expand on every result row** ★★★

The result panel shows an itemized table (equipment $X, labor $Y, permit $Z…) but doesn't show *how those numbers were computed for this specific run.* A user who's skeptical of the headline can't see why their state added 22% vs. national mid, or what the difficulty multiplier did, or which rebate row applied. They have to leave the page, visit `/methodology/`, and reverse-engineer it themselves.

**Proposal:** click any itemized row → expand a "Why this number?" drawer showing:
- The CSV row that fed it (e.g., `heat_pump,ducted_central_3ton — $11,500 mid`)
- The state multiplier applied (`MA × 1.18 labor`)
- The difficulty multiplier applied (`standard × 1.00`)
- A one-sentence plain-English summary ("In MA, HVAC labor runs 18% above the national mid; you picked 'standard difficulty,' so the equipment+labor mid lands at $11,500 × 1.18 = $13,570.")
- Source URLs used for this specific row.

ASCII sketch:
```
Heat pump equipment        $7,500   $11,500   $16,500     [▾ Why this number?]
└─ Drawer expands:
    Row used:  heat_pump · ducted_central_3ton
    Base mid:  $11,500 (national)
    Labor mult: MA × 1.18 → +$2,070 labor
    Difficulty: standard × 1.00
    Permit:     $250 (MA typical)
    Final mid:  $13,820
    Sources:    EnergySage HP Cost 2026 (rev. 2026-05-13)
                NEEP CCASHP Database
```

User moment: the showing-your-work moment. The site's whole pitch is "source-backed" — but at the result-row level, the user has to take it on faith. Make the source visible at the *moment of doubt*, not on a separate page.

Files: each calculator component (the itemized row builder already has the input data; just wire it through), `ResultPanel.tsx` (one new "expandable" affordance on each row).

Effort: **M** (1.5 days — the hard part is propagating the "math trace" from each calc component up to the itemized row; refactor candidate).

Bucket: trust win + E-E-A-T win. Aligns with the existing brand promise; no other competitor does this.

### Other feature ideas (shorter punch list)

| # | Idea | User moment | Effort | Bucket |
|---|---|---|---|---|
| 1.4 | **Project chaining** — panel calc result can feed heat-pump install cost as a panel-adder. Today users have to re-enter | "I just figured out my panel upgrade — now I need to estimate my heat pump but the panel work is already paid for." | M | Usefulness |
| 1.5 | **Last-updated stamp visible at result** (not only in the collapsed Sources section) — "Reviewed 2026-05-13, refreshed weekly" | "Are these numbers stale? When was Mass Save updated?" | XS | Trust |
| 1.6 | **Unit toggles** — kBtu/h vs kW for heat pumps, $/yr vs $/mo for operating cost. The current calc shows "$/mo" only; many users think in annual | "I know my gas bill annually, not monthly" | S | Usefulness |
| 1.7 | **"What to do next" CTAs from the result** — instead of just "Related calculators" buried at the bottom, embed action chips inside the result panel: *Find an installer (link to /find-an-installer)*, *File your rebate (link to rebate-program detail)*, *Run the savings calc* | "OK, I have my number. What's the next move?" | S | Conversion / usefulness |
| 1.8 | **Methodology depth pages per calculator** — `/methodology/heat-pump/` showing the full UA × HDD × COP derivation, not the catch-all `/methodology/` page everyone shares | "I want to understand the operating-cost math, not just trust it." Power users + HVAC pros vet the site before recommending it. | M | E-E-A-T |
| 1.9 | **Glossary tooltips inline** — every "HSPF2", "COP", "AFUE", "Manual J" should be a dotted-underline tooltip that explains in 1 sentence. Currently glossary is a separate page; users won't visit it | "What is HSPF2 again?" | S (one component, 40 terms) | Usefulness |
| 1.10 | **Per-page bibliography on every calculator page** ("Sources used for this calculator") in addition to the all-site `/sources/` index. Today only the *result-panel* lists sources, after the user runs the calc. The page itself doesn't surface them. | "I haven't run the calc yet; show me you have the data first." | S | Trust |
| 1.11 | **Run history sidebar (this session only)** — last 3–5 calcs run, with a "restore" button. Power users run many. No persistence beyond the tab. | "What was my heat-pump number again? I just ran panel and HPWH after it." | S (sessionStorage) | Usefulness |
| 1.12 | **Mailing-list signup** — *"Notify me when Mass Save / NYSERDA / your-state rebate changes"*. The site is in a great position to do this (every rebate has a clean version + last_reviewed); no competitor offers this | "Send me an email when rebates change in my state." | M (needs a mail service) | Conversion / retention |
| 1.13 | **Multi-step "Build my electrification plan" wizard** — sits above the calculators, asks 8 questions, returns a 5-step ordered plan with cost rollup. *This is Rewiring America's wedge*; ElectrifyCost has better data behind it. | "I don't know which calc to start with" | L | Wedge — see §12 |
| 1.14 | **"vs. status quo" baseline comparison** in every operating-cost result — "$0 (stay with gas) vs $-28/mo (heat pump)". Today the bill-impact card just shows the delta. Re-frame as a side-by-side. | "What does 'savings vs current fuel' actually compare to?" | S | Visibility |
| 1.15 | **Bid-check / quote-upload mode** — already a partial feature (QuoteCheck block exists). Currently buried behind a "contractor quote" input that's not surfaced prominently. Promote to a top-level mode: *"I have a quote — is it fair?"* | "I got a $14,500 quote. Is that high or low?" | S (mostly UX promotion of existing feature) | Conversion |
| 1.16 | **State-page-as-landing** — Heat-pump-by-state pages exist, but landing on `/heat-pump-cost-massachusetts/` drops you on a static numbers page with the calculator buried below. Should auto-fill the calculator with that state's defaults. | "I came from Google for Massachusetts; show me my answer in one screen" | S | SEO + UX |
| 1.17 | **"Find a contractor" referral surface** — explicit "no-funnel" is in the footer, but the user still has the next-step problem. Curated state-specific referral list (Mass Save HPC contractors, NEEP-listed contractors) is a low-bar value-add | "OK now who do I actually call?" | M | Conversion |
| 1.18 | **Inverse mode for incentive eligibility** — "I have a $4,500 budget — what can I do?" turns the calc inside-out | "I don't know which upgrade fits my budget" | M | Wedge |

---

## §2 — Information architecture & navigation

### Top 3 proposals

**2.1 — Add breadcrumbs visually on every page** ★★

The breadcrumb data is shipped to JSON-LD (Schema.org BreadcrumbList) but is *not rendered visually* anywhere on the page. The user navigates between pages with no "where am I" cue except the active nav-pill — which is hidden behind a dropdown.

**Proposal:** a thin, non-noisy breadcrumb bar between header and hero on every page that's not the homepage:

```
Home › HVAC › Heat pump cost calculator
```

12px text, `text-ink-600`, separated by `›`, sticky-adjacent to header but not sticky itself. The current crumbs prop already exists in `Layout.astro`; just render it.

User moment: someone landed on `/heat-pump-cost-massachusetts/` from Google and wants to compare other states. Today there's no path from a state page back to the state hub.

Files: `Layout.astro` (add a `<nav aria-label="Breadcrumb">` block reading the existing prop), every calc page already passes `breadcrumbs`.

Effort: **XS** (one component change, all pages benefit).

**2.2 — Replace the homepage's "every calculator" megalist with grouped category landing pages** ★★

The homepage currently shows all 38 calculators as cards in 6 groups, but each "group label" is just a heading — there's no `/hvac/`, `/water-heating/`, `/solar-power/` hub page. The Header dropdowns *are* category groupings (5 categories), so the IA is internally inconsistent: nav says "HVAC is a category," homepage says "HVAC is just a header in a flat list."

**Proposal:** create five category landing pages at:
- `/calculators/hvac-comfort/`
- `/calculators/solar-power/`
- `/calculators/ev/`
- `/calculators/water-heating/`
- `/calculators/home-improvements/`

Each page: short orientation paragraph ("Heating, cooling, and ductwork upgrades. Start with whole-home electrification or jump to a specific calculator."), then 5–9 cards for that category, then a "Most popular" pin (e.g., heat pump for HVAC). The homepage stops being a wall of cards — instead it shows a 3×2 of the categories + "Whole-home" as the primary CTA + 3 most-used flagships.

User moment: a first-time visitor lands on the homepage and sees 38 cards. Choice paralysis. Categories give them an obvious next step.

Files: 5 new `.astro` files, slim down `index.astro`, update Footer "Calculators" links to point at the new hubs.

Effort: **M** (~half day).

Bucket: orientation + SEO (each hub becomes a thin/medium SEO target for category-level queries).

**2.3 — Footer audit: shipping IA-incomplete today** ★

Current footer surfaces:
- Brand blurb
- 5 flagship calc links
- Methodology / Sources / Rebates / Glossary

What's missing:
- About page (still doesn't exist; deferred in prior pass)
- Per-category index links (above)
- State-level hub links (`/heat-pump-cost-by-state/` is orphaned per prior audit)
- A clear "All calculators" or "Site map" link (38 calcs and no full index)
- Contact / "report a stale value"
- Privacy / Terms (any site should have these)
- Last-updated stamp for the *site* (not just per-page) — "Data last refreshed 2026-05-13"

**Proposal:** four-column footer with explicit columns: *Calculators* (links to 5 category hubs + "All calculators"), *Trust* (methodology, sources, glossary, rebates, about), *Site* (sitemap.xml, privacy, terms, contact), *Updated* (last-refreshed timestamp, GitHub-issue / feedback link).

Effort: **S** (one component change).

### Other IA observations

| # | Item | Note | Severity |
|---|---|---|---|
| 2.4 | **404 page is friendly but featureless** — lists 5 flagships and stops | Add a search box (even a simple `<input>` that runs site:electrifycost.com via Google) + breadcrumb back + a category jump | P3 |
| 2.5 | **Mobile nav** uses nested `<details>` accordions; 5 categories × ~8 items = 40-item drawer. Long. | Reorder by usage frequency (Whole Home, Heat Pump, Solar, Panel, EV — known top-5 — pinned above the accordions) | P3 |
| 2.6 | **No global search** | A single in-header `⌘K` style search with calculator + guide + state-page index would be high-value for the 38-tool surface. Hard to build now; flag for future | P2 (effort L) |
| 2.7 | **Homepage hero photo of "whole-home electrification" is illustrative but not load-bearing** | Replace with a live mini-calc result widget (already partially there — the right column shows a static sample). Make it interactive: a 3-input mini-heat-pump calc embedded directly on the homepage. *Hugely* improves immediate value perception. | P1 |
| 2.8 | **State pages link to other state pages but not back to the state hub** | Add a "← All states" link in the state-page breadcrumb. Plus a "Compare to neighboring state" chip row | P2 |
| 2.9 | **Guides + Calculators are sibling concepts but the IA treats them as totally separate trees** | Every guide page already has a `/guides/heat-pumps/` URL; every calc has `/heat-pump-cost-calculator/`. Add a guide↔calc back-reference card on each page (probably already there for some). Verify parallel coverage | P3 |
| 2.10 | **`/sources/` page** is a vertical scroll wall of 60 source cards grouped by category. Useful as an SEO destination but not actually browsable. Add a sticky category jump-nav on the right (TOC), search-within-page filter, and a "most-used by calculator X" cross-link | P2 |
| 2.11 | **Rebates page** is data-table-shaped; no programmatic state filter, no "show me only programs in MA" | Add a state dropdown that filters the table client-side. ~30 LOC | P2 |
| 2.12 | **No `/about/`** — meaningful for E-E-A-T per prior audit; promote from "deferred" to top-3 IA priority | P1 |

---

## §3 — Visual design system: the color theme

### Current palette catalog

The Tailwind theme defines `brand` (green) and `ink` (cool gray) scales plus three accent colors. In practice the components are using:

| Token | Hex | Usage |
|---|---|---|
| `brand.50` | `#f0f9f4` | Net-card background, mid CostCard, eyebrow surface |
| `brand.100` | `#dcefe2` | `badge-green` bg, brand chip bg |
| `brand.300` | `#8ecaa3` | mid CostCard ring, badge accent |
| `brand.500` | `#39935c` | btn-primary top, focus ring |
| `brand.600` | `#287646` | Logo box bg, theme-color, primary text on white (low contrast — see below) |
| `brand.700` | `#205e39` | btn-primary bottom, all `<a>` links, eyebrow, nav-active |
| `brand.800` | `#1c4b30` | `badge-green` text, net-card-amount |
| `ink.500–900` | grays | Body, headers, helpers |
| `accent.blue` `#2563eb` | unused outside config |
| `accent.amber` `#d97706` | unused outside config |
| `accent.rose` `#b91c1c` | unused outside config |

**Plus drift from Tailwind defaults outside the configured palette:**
- `emerald-*` is used in 22 component files (SolarCalculator, SolarPaybackCalculator, BatteryCalculator, OffGridSolarCalculator, EvTcoCalculator, GeothermalCalculator, AcCalculator, etc.) — emerald is a *different* green from `brand`. Side-by-side on the same page, these look like two slightly mismatched greens (color blind users won't notice; designers will).
- `amber-*`, `cyan-*`, `indigo-*`, `sky-*`, `teal-*`, `orange-*`, `purple-*`, `stone-*`, `slate-*`, `zinc-*`, `red-*`, `yellow-*`, `violet-*`, `rose-*` all appear across the 33 non-flagship calculators. Total: ~238 occurrences of non-palette color tokens across `src/components/`.

### Contrast ratios (computed)

| Pair | Ratio | WCAG-AA (normal) | WCAG-AAA (normal) |
|---|---|---|---|
| `ink-800` on white (default body) | 15.59 | ✅ | ✅ |
| `ink-700` on white (body) | 12.03 | ✅ | ✅ |
| `ink-600` on white (helper) | 8.84 | ✅ | ✅ |
| `ink-500` on white (subtle helper) | 5.64 | ✅ | ❌ |
| `ink-400` on white | 3.06 | ⚠️ AA-large only | ❌ |
| `brand-600` on white (logo, btn-primary top) | 5.57 | ✅ | ❌ |
| `brand-700` on white (links, eyebrow) | 7.72 | ✅ | ✅ |
| `brand-500` on white (focus ring) | 3.82 | ⚠️ AA-large only | ❌ |
| White on `brand-600` (logo box, badge) | 5.57 | ✅ | ❌ |
| White on `brand-700` (skip-link) | 7.72 | ✅ | ✅ |
| `brand-800` on `brand-50` (net-card-amount) | 9.32 | ✅ | ✅ |
| `brand-700` on `brand-50` (net-card-title) | 7.19 | ✅ | ✅ |
| `brand-800` on `brand-100` (badge-green) | 8.33 | ✅ | ✅ |
| `amber-800` on `amber-100` | 6.37 | ✅ | ❌ |
| `rose-800` on `rose-50` | 7.30 | ✅ | ✅ |
| `amber-900` on `amber-50` (caveat callouts) | 8.75 | ✅ | ✅ |
| `ink-500` on white (nav icon, helper) | 5.64 | ✅ | ❌ |

**Issues that exist today:**
- The `text-[10px] text-ink-500` ZIP-helper (flagged in prior audit) is at AA-large only — and at 10px it isn't *large*. Bump to 12px / `text-xs`.
- `brand-500` focus ring at 3.82 contrast is borderline. The focus-visible ring should be one step darker — `brand-600` or `brand-700`.
- No actual contrast failures in current usage. The palette is honest.

### Critique of the current palette

**Strengths:**
- The greens are correctly *trustworthy* not loud (avoid Carbon Switch's bright lime). The slightly desaturated `brand-600/700` feels editorial.
- The `ink` scale is well-tuned — 9 steps, evenly spaced, AAA on the deeper steps.
- High-contrast result amounts (brand-800 on brand-50 = 9.32:1) means the headline number reads cleanly.

**Weaknesses:**
- The palette is **too monochromatic**. With only brand-green for accent, the site can't distinguish between "this is a savings figure" (positive) and "this is just brand-styled" (neutral). Every link, every eyebrow, every focus ring is the same green. By the time you reach the result-panel "monthly savings" callout — the most important number on the page — the green has been used so many times that it doesn't read as "savings, look here."
- The "green" doesn't quite feel like **electricity**. It feels like *lawn care*, *organic produce*, or *quiet finance*. The brand promise is "electrify your home" — a more electric/voltage-y accent (cyan? lime? voltage-yellow?) would be on-brand. Currently the site palette gives no visual cue that it's about electrification specifically.
- **Drift into emerald/amber/cyan in 22 component files** undermines the brand. A user scrolling between SolarCalculator (emerald) → ResultPanel (brand) → AcCalculator (amber) sees three different "primary" tones.
- The three named accents (`accent.blue`, `accent.amber`, `accent.rose`) are configured but **never used.** Components use raw Tailwind defaults (`bg-amber-50`, `text-rose-700`) instead. Dead config — and a missed opportunity to introduce a second deliberate accent.

### Proposed palette A — "Daylight" (evolutionary, safer)

Same shape as today; brighter, more confident green; cleaner ink; one deliberate warm accent (solar-amber) reserved for *potential / pending / amber-state* cues only.

**Hex values:**

| Token | Current | Proposed A | Why |
|---|---|---|---|
| `brand.50` | `#f0f9f4` | `#ecfdf5` | Slightly cooler; reads cleaner against white |
| `brand.500` | `#39935c` | `#10b981` (Tailwind emerald-500) | More confident; matches the emerald drift already in use, so 22 components stop being "wrong" |
| `brand.600` | `#287646` | `#059669` | Higher contrast: 5.57 → 5.13 on white (still AA; usable on buttons) |
| `brand.700` | `#205e39` | `#047857` | The link/eyebrow color: 7.72 → 5.48. Acceptable, still AA. Or hold at current `#205e39` for AAA |
| `brand.800` | `#1c4b30` | `#065f46` | Net-card-amount: 9.32 → 7.29. Still AAA-large, just-AAA-normal |
| `ink.500` | `#5e6877` | `#475569` | Slate-style: cleaner, slightly cooler |
| `ink.700` | `#2f3742` | `#1e293b` | Body text — stronger contrast against white |
| `ink.900` | `#13171c` | `#020617` | True near-black for headlines |
| **Accent: `solar`** | (unused) | `#f59e0b` / `#b45309` | The **only** non-green accent — reserved for *potential* incentives and *attention* callouts, replacing today's amber drift |

**Sample text-on-bg pairs (palette A, computed):**

| Pair | Ratio | Pass |
|---|---|---|
| `ink-700` on white (body) | 14.63 | AAA |
| `ink-600` on white (helper) | 10.35 | AAA |
| `ink-500` on white (subtle) | 7.58 | AAA |
| `brand-700` on white (link/active) | 5.48 | AA / AAA-large |
| `brand-800` on `brand-50` (result amount) | 7.29 | AAA |
| `brand-700` on `brand-50` (eyebrow) | 5.21 | AA / AAA-large |
| White on `brand-700` (primary btn) | 5.48 | AA / AAA-large |
| `solar-deep` on `solar-100` (caveat) | 4.51 | AA |

**Rationale:** evolutionary — same color language, slightly punchier, and crucially: matches the emerald drift already in 22 component files so the brand-vs-emerald drift just disappears. Lower risk than a full reskin.

**Emotional positioning:** "clean, modern, growth — the same site, more confident."

### Proposed palette B — "Voltage" (bolder revision)

Reframes the brand from "trustworthy green" to "trustworthy *electric.*" Primary becomes a deep teal/cyan (the universal "energy" cue — Tesla, GE, EnergySage, IBM's modern marks all sit here); secondary lime-green is reserved for the *single* highest-value moment on every result: monthly bill savings. This is the bigger swing.

**Hex values:**

| Token | Hex | Usage |
|---|---|---|
| `brand.50` | `#ecfeff` | Surfaces, eyebrow backgrounds, net-card |
| `brand.100` | `#cffafe` | Chip bg |
| `brand.500` | `#06b6d4` (cyan) | Buttons, ring, brand accent |
| `brand.600` | `#0891b2` | Hover state, logo box |
| `brand.700` | `#0e7490` | Links, eyebrow text |
| `brand.800` | `#155e75` | Net-card-amount, deep headline accent |
| **Secondary: `savings`** | `#84cc16` / `#65a30d` / `#3f6212` (lime) | Used **only** for "monthly savings $" and "annual savings $" callouts. Never for general links or buttons. This is the rule. |
| **Accent: `caution`** | `#d97706` / `#92400e` (amber) | Caveats, "potential incentives" block — replaces today's drifty amber |
| **Accent: `alert`** | `#dc2626` / `#9f1239` (rose) | Errors, "panel risk: high/critical" badges |
| `ink.500` | `#78716c` (warm) | Helper |
| `ink.700` | `#3f3f46` | Body |
| `ink.900` | `#18181b` | Headlines |

**Sample contrast (palette B, computed):**

| Pair | Ratio | Pass |
|---|---|---|
| `ink-700` on white (body) | 10.44 | AAA |
| `brand-700` on white (link/active) | 5.36 | AA / AAA-large |
| `brand-800` on white (deep link) | 7.27 | AAA |
| `lime-700` on white (savings text) | 4.99 | AA / AAA-large |
| `lime-800` on white BIG number (monthly savings) | 7.08 | AAA |
| `brand-800` on `brand-50` (result amount) | 6.99 | AA / AAA-large |
| `brand-700` on `brand-50` (eyebrow) | 5.15 | AA / AAA-large |
| White on `brand-700` (primary btn) | 5.36 | AA / AAA-large |
| `amber-deep` on `amber-100` (caveat) | 6.37 | AA / AAA-large |
| `rose-deep` on `rose-100` (error) | 6.56 | AA / AAA-large |

**Rationale:** the boldest move. Three things change:
1. **Cyan-teal primary** = visually distinct from EnergySage (which is bright green) and Rewiring America (which uses orange/yellow). Stands out in SERP previews; reads as "energy/utility."
2. **Lime-green secondary, *reserved for savings only*.** Today, brand-green is used for everything, so when a user lands on the result and sees a green "$28/mo savings" number, the green is just-another-link-color. In palette B, lime is *only* used for monetary-savings figures site-wide. That single semantic discipline makes the savings number pop without any extra layout work.
3. **Amber and rose get explicit "caveat" and "alert" roles**, replacing the current ad-hoc amber-50/rose-50 usage.

**Emotional positioning:** "modern, electric, optimistic, distinctively yours."

**Risk:** big visual change. Requires:
- Touching all 38 calculator components to replace `emerald-*` → `brand-*` and reserve `lime-*` for savings-only.
- Re-doing OG images / favicon if they're brand-tinted (they currently use `#287646`).
- A communications moment ("we refreshed the look").

**Recommendation:** ship A first (low-risk drift fix), then evaluate B as a 6-month polish target after the prior-audit P0/P1 work has settled.

### Smaller palette items

- **Replace** `text-[10px]` helpers with `text-xs` (12px) for AA-normal compliance.
- **State colors for forms:** focus is brand-green; hover, active, disabled, error, success are inconsistent. Define explicitly: `:hover` = ink-300 border, `:focus-visible` = brand-600 ring (one step darker than current), `:disabled` = ink-200 bg + ink-400 text, error = rose-500 border + rose-100 bg.
- **Dark mode:** none today. Defer (effort L). When you do it, anchor against palette A or B and use CSS variables instead of Tailwind classes.

---

## §4 — Typography & rhythm

### Top 3 proposals

**4.1 — Promote tabular figures more aggressively and bigger** ★★

The result-panel CostCard amount is `text-2xl` (24px) with `tabular-nums`. Good — but the user's eye lands on the headline number for ~0.5 seconds when the result renders. 24px isn't loud enough. Bump the *Mid* cost (the answer) to `text-3xl` (30px) or `text-4xl` (36px), keep Low/High at `text-2xl`. The visual weight ratio between answer and aside should be 1.5×.

ASCII:
```
┌─ Low ──────┐   ┌─ MID (most likely) ─┐   ┌─ High ─────┐
│ $7,500     │   │  $11,500            │   │ $16,500    │
│ best case  │   │  typical            │   │ worst case │
└────────────┘   └─────────────────────┘   └────────────┘
```

Currently all three are visually the same weight; the only differentiator is the `bg-brand-50` tint + a tiny "Most likely" pip. The user's eye scans all three equally.

Files: `ResultPanel.tsx` (CostCard amount class), each calculator that rolls its own result UI.

Effort: **XS**.

**4.2 — Cap the type scale at 6 sizes** ★

Today the components use (counted): `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`. Twelve sizes. Even ignoring the tiny custom pixel sizes (which are accessibility-marginal), the system has too many.

**Proposal:** define a typography scale of exactly 7 sizes (px, line-height pairs):
- `text-display` 36/40 — h1 only
- `text-h2` 24/30 — h2
- `text-h3` 18/26 — h3, result-amount-large
- `text-body` 16/24 — default body
- `text-sm` 14/20 — secondary, FAQ summaries
- `text-xs` 12/16 — meta, badges
- (Optionally `text-2xs` 11/14 — only for tiny eyebrow labels; never below 11px)

Forbid `text-[10px]` and `text-[9px]` in the codebase via an ESLint rule. The eyebrow at `text-[11px]` is borderline but acceptable; bump to `text-xs` 12px.

Files: a `typography.css` stub + audit pass on components.

Effort: **M** (mechanical replacement, ~3 hours).

**4.3 — One-font experiment: drop Source Serif 4** ★

The site loads two font families (Inter + Source Serif 4) with 4 weights each = 8 woff2 files (~200 KB). Source Serif is used for h1/h2 only — global.css applies `font-serif` to them. The serif gives the site an "editorial cost-guide" feel.

But: the serif weights aren't getting their money's worth. The h1 and h2 are short (`Heat Pump Cost Calculator` is 4 words, 25 characters). A serif's value is in long-form reading, not headlines. Inter is good enough at display sizes with the `tracking-tightest` letter-spacing already in use.

**Proposal:** A/B-test dropping Source Serif. If retained, *self-host* it (per prior audit recommendation) and load only the 600 weight (drop 500/700). Expected savings: 100–150 KB transfer.

If kept, lean *harder* on it — use the serif on result-amount headlines too. Today it's a half-commitment.

Effort: **S** (drop-test); **M** (commit to all-serif headlines).

### Other typography observations

| # | Item | Note |
|---|---|---|
| 4.4 | **Body line-height 1.6** with `text-wrap: pretty` is solid. Keep. | OK |
| 4.5 | **`max-w-prose: 68ch`** — well-chosen for readability. Applied inconsistently (some sections wrap to full container-wide). Audit: every body paragraph should be 60–75ch | P3 |
| 4.6 | **Numeric typography:** `font-variant-numeric: tabular-nums` is on everywhere via global.css. **Good** — best-in-class practice. | OK |
| 4.7 | **Heading hierarchy** on calc pages is clean (per prior audit). The *visual* weight difference between h2 (`text-xl` = 20px) and h3 (`text-sm font-semibold` = 14px) is too small — both look like "section labels." Bump h2 to `text-2xl` (24px) or pull h3 down to `text-xs`. Currently they fight. | P2 |
| 4.8 | **Font weights:** Inter 400/500/600/700 loaded; in use are 400, 500, 600, 700 in multiple places. Audit shows ~20% of `font-medium` (500) usage could collapse to 400 with a darker color. Keeping all 4 is fine. | OK |
| 4.9 | **Italic usage:** rare, used in net-card caveat ("These are *not* subtracted"). Good restraint. | OK |
| 4.10 | **Letter-spacing custom utilities** (`tracking-tightest`, `tracking-tight-display`) are used on h1/h2. Used sparingly elsewhere. Fine. | OK |
| 4.11 | **No drop-cap or magazine-style intro paragraph** anywhere. Could be a nice editorial touch on guide pages (not calculators). Stretch idea. | P3 |

---

## §5 — Section separation & visual hierarchy within pages

This is the user-flagged area. Walking each flagship calc page top-to-bottom:

```
[Header bar]
[(no breadcrumb)]
[Hero section: eyebrow + h1 + intro + Quick-answer band + hero photo]   ← section 1
[Calculator: form + result panel]                                       ← section 2
[What changes the price: 6 cards in a grid]                             ← section 3
[New to heat pumps: prose + link to guide]                              ← section 4
[FAQ: 12 collapsed accordion cards]                                     ← section 5
[Related calculators: 4-link list]                                      ← section 6
[Footer]
```

Today, section boundaries are signaled only by `<section class="container-wide py-10">` whitespace. No background-color change, no rule, no card surface. The page reads as one long beige scroll.

### Top 3 proposals

**5.1 — Alternate section backgrounds to create real "shelves"** ★★★

The eye needs visual rhythm to scan a long page. Today every section is white with vertical padding.

**Proposal:** alternate backgrounds in a 5-step pattern across the page:
1. Hero — `bg-gradient-to-b from-brand-50 to-white` (current homepage hero already uses this; promote to all flagship pages)
2. Calculator — white (the canonical "tool" surface)
3. "What changes the price" — `bg-ink-50/60` (subtle gray; matches the footer surface)
4. "New to heat pumps" — white with serif type
5. FAQ — `bg-ink-50/40`
6. Related calculators — white

This single change makes the page feel composed instead of stacked. ASCII:
```
██████████  hero band (tinted)
            calculator (white card on white bg)
░░░░░░░░░░  "what changes the price" (gray-50)
            "new to heat pumps" (white)
░░░░░░░░░░  FAQ (gray-50)
            related (white)
```

Files: each flagship `.astro` page wraps the relevant `<section>` with a colored bg, plus updates to `global.css` for the gradient utility.

Effort: **S** (one pass across 38 pages — could template via a shared component).

**5.2 — Make the result panel a visually dominant card** ★★★

Today the result panel is rendered as a `<div className="space-y-4">` with subsidiary cards inside it. No outer container. Form is on the left in `.calc-form` (sticky on desktop), result on the right.

**Proposal:** wrap the result panel in an outer `card-elev` (existing utility) with `bg-gradient-to-br from-white via-white to-brand-50/40` — giving it a single big-card silhouette instead of a flat right column. The Low/Mid/High band sits on top, full width inside the card. The itemized table, incentives, monthly impact, panel risk, etc. become *sub-cards* inside, divided by `border-t border-ink-100`, not floating peers.

Today the result panel can have 7+ floating cards. The user can't tell which card is the "main" answer. A single bordered container would.

Files: `ResultPanel.tsx` outer wrapper.

Effort: **XS**.

**5.3 — Add a sticky "Your estimate" bar on mobile + scroll-past-fold desktop** ★★

When the user enters inputs at the top of a long page and the result is below the fold, they scroll back up to check the number and back down to keep tweaking. Painful.

**Proposal:** when the result panel scrolls out of view, show a slim sticky bar at the top of the viewport (above the page header):
```
[ Your estimate: $7,500 – $22,000 (mid: $11,500) · Net $6,550 ]   [ Jump to result ↓ ]
```

12px text, brand-50 bg, slides down on scroll-past-result, slides up on scroll-back. Works on mobile (where the form is above the result) and on desktop scroll-past.

Effort: **S** (one component + a scroll listener).

### Other section-separation items

| # | Item | Note |
|---|---|---|
| 5.4 | **Quick-answer band** is a `border + bg-ink-50` paragraph. Visually it's *another* gray block among many. Promote to a `card-elev` with `bg-brand-50` and a small "Quick answer" eyebrow above the number. Like a callout, not a paragraph | P1 |
| 5.5 | **"What changes the price" 6 cards** are visually identical to FAQ cards. Differentiate: turn this section into illustrated "factor chips" (icon + name + 1-line range) rather than card+paragraph | P2 |
| 5.6 | **FAQ accordion** uses `<details class="card p-4">` — each FAQ is a full card, which is heavy. On a 12-FAQ page that's 12 stacked white boxes. Slim to: divider-rule layout (no card, no shadow), only the expanded one gets a faint left-border accent | P2 |
| 5.7 | **"Related calculators" 4-link list** is a bare `<ul>` at the bottom. Promote to 4 mini-cards with icon + name + typical range. Currently it's afterthought-shaped; could be a meaningful "next action" surface | P2 |
| 5.8 | **Above-the-fold composition desktop** — eyebrow + h1 + intro + Quick-answer + hero photo is a lot for the first viewport on a 1280×720 screen. The Quick-answer band gets pushed below the fold on smaller laptops. Either: (a) shorten intro to 1 sentence, or (b) move Quick-answer to be the very first thing under h1 | P1 |
| 5.9 | **Above-the-fold mobile** — at 375×800 you see eyebrow, h1, half of intro. Hero photo is below the fold. Move hero photo above-the-fold by reducing its height to 250px max on mobile, or skip it entirely on mobile | P1 |
| 5.10 | **Form vs result vertical alignment desktop** — form is sticky top:4.5rem, result is not. When the result is short, the form has empty space below it. Consider symmetric padding or a "tip card" filling the form column's empty space (e.g., "Three things to double-check before signing a quote") | P3 |

---

## §6 — Format consistency

### The single canonical-format proposal

Pick one canonical format per category and enforce by linting + a `format.ts` helper module that every component must use.

| Category | Variants found | Canonical |
|---|---|---|
| **Currency values** | `$11,050` / `$7,500-$22,000` / `$7,500–$22,000` / `$11.5K` / `1,400-$3,600` (missing $) | `$11,050` (no decimals; always with `$`). Use existing `fmtUSD()` |
| **Currency ranges** | `$7,500–$22,000` (en-dash) / `$7,500-$22,000` (hyphen) / `$7,500 to $22,000` / `$2,200&ndash;$4,200` | `$7,500–$22,000` (en-dash, no spaces). Use `fmtUSDRange()` |
| **Compact currency** | `$11.5K` (homepage rare), `$11k`, `$11,500` | Never compact in body text. Compact (`$11K`) only allowed in chips/badges where space is tight. |
| **Percentages** | `30%` / `30 %` / `~30%` / `30% (mid)` | `30%` no space, no leading `~` unless followed by number |
| **Date** | `2025-12-31`, `December 31, 2025`, `Dec 31 2025`, `Dec. 31, 2025` | ISO (`2025-12-31`) in metadata and "Last reviewed"; "December 31, 2025" in body prose; never `Dec 31 2025` |
| **Range with units** | `5-10 yr` / `8 to 14 yr` / `8-14 yr payback` | `8–14 yr` (en-dash, no spaces); always abbreviated unit (`yr` not `years`) when in a chip; full unit in body |
| **Compound nouns** | `heat pump`, `heat-pump`, `Heat Pump`, `heat pumps` | `heat pump` (open compound, lower-case) in body; `Heat Pump` only at start of sentence or in proper-noun product names; never `heat-pump` as a noun (only as adjective: "heat-pump water heater") |
| **Acronyms** | `HSPF2` first use never expanded inconsistently; `COP` sometimes expanded, often not; `SEER2` mixed | Always expand on first use *per page*: "HSPF2 (Heating Seasonal Performance Factor)". Then bare. Use a `<dfn>` tag with a tooltip for inline definitions (see §1.9) |
| **State names** | `Massachusetts` / `MA` / `Mass.` | Full name on first use in body; postal abbreviation (`MA`) thereafter and in chips/tables |
| **"Up to"** | `$8,500 cap`, `up to $8,500`, `capped at $8,500` | `up to $8,500` in body; `cap: $8,500` in tables |

### Top 3 proposals

**6.1 — Add a `format.ts` module that's the single source of truth** ★★

`src/lib/format.ts` already exists with `fmtUSD`, `fmtUSDRange`, `fmtMonths`. Extend it with `fmtDate(iso, style: 'short'|'long')`, `fmtRange(low, high, unit)`, `fmtPct(n)`. Forbid raw `${low}-${high}` template strings in components via lint rule.

Effort: **S** (the helpers); **M** (the audit pass across components).

**6.2 — Pick a single dash character: en-dash (–) for ranges, em-dash (—) for prose breaks** ★

Currently the codebase mixes `-`, `–`, `—`, `&ndash;`, `&mdash;`. Settle:
- Numeric range: `–` (U+2013 en-dash). Never `-`.
- Prose pause: `—` (U+2014 em-dash). Never `--`.
- Hyphenation: `-` (ASCII hyphen) only.

Add a `prettier`/ESLint rule that flags `-` between digits. Mechanical fix.

Effort: **S**.

**6.3 — Sentence-case all UI labels** ★

Today: "Heat Pump" (title case) sits next to "Mini-split / ductless" (sentence case). Buttons say "Copy estimate" (sentence) and "Save Profile" (title) on different components. Headings: "Frequently asked questions" (sentence) vs "Related calculators" (sentence) vs "What changes the price" (sentence) — these are fine; pick sentence case as the rule.

Eyebrow text is the only place where lower-case + tracking-wider makes sense ("HEAT PUMP") and is used consistently.

**Rule:**
- Eyebrows: ALL CAPS with tracking
- Buttons: sentence case
- H1/H2/H3: sentence case (only proper nouns capitalized)
- Chip labels / badges: sentence case
- Section labels: sentence case

Audit pass: ~30 places need fixing.

Effort: **S**.

### Other formatting items

| # | Item |
|---|---|
| 6.4 | **Source citation style** is inconsistent. Sometimes the source is a footer link (`source ↗`), sometimes inline parenthetical ("(per NEEP 2024)"), sometimes embedded ("EnergySage Q4 2024"). Pick one: per-row footer link with `↗` icon. |
| 6.5 | **OBBBA preamble** (per prior audit) — already consolidated; verify on all 38 pages |
| 6.6 | **Quick-answer block** — present on 4/5 flagships; structure is "X to Y for typical install. Z if state-specific. Federal credit ended Dec 31 2025." Standardize the structure across all flagships and non-flagships |
| 6.7 | **Footnote/asterisk usage** — no consistent system. The "Net = gross minus active incentives" footnote on the net-card uses no marker; the "Last reviewed" date sits as a sibling. Add an `<aside class="footnote">` pattern with proper styling |

---

## §7 — Visibility / scannability

### Top 3 proposals

**7.1 — The result headline number should be the largest text on the page** ★★★

Today the page h1 is `text-3xl`/`text-4xl` (30–36px) and the *Mid* result is `text-2xl` (24px). The h1 says "Heat Pump Cost Calculator." The Mid says "$11,500." The Mid is the actual answer; the h1 is a label. Their visual hierarchy is inverted.

**Proposal:** when a result is rendered, give the Mid amount `text-4xl` (36px), tabular figures, and inline within a wide `net-card`. The h1 stays text-3xl but its visual rank correctly drops once you've scrolled to the result.

Effort: **XS**.

**7.2 — Loading state is currently missing on all non-flagship calculators** ★

Flagship calcs hydrate immediately (the result is computed synchronously, no fetch). Good. But on slow mobile, the *island* itself takes 400–800 ms to hydrate, during which the page shows a blank white card.

**Proposal:** add a skeleton placeholder during island hydration. The existing `[data-island-loading]` selector reserves `min-height: 320px` already; just add a skeleton inside it that fades out when the island mounts. Reuse `ResultPanel`'s existing skeleton.

Effort: **S** (one component + an Astro client:visible pattern review).

**7.3 — Error and empty states are functional but unstyled** ★

`ResultPanel` shows error state when engine throws (red text in a card). The non-flagship calculators have no error state at all — they crash silently or render NaN. Empty state is "Enter your details on the left…" in `text-sm text-ink-600` — fine, but no illustration, no example, no preview.

**Proposal:**
- Empty state should *preview* a sample result with a "Try with your inputs" CTA. Static, no math, just a teaser. Removes the "blank canvas" intimidation.
- Error state should include a clear "Reset to defaults" button, a copy-able error ID, and a link to GitHub issue tracker.

Effort: **S** for both.

### Other scannability items

| # | Item |
|---|---|
| 7.4 | **Form labels** are `text-[11px] font-semibold uppercase tracking-wider` (the `.label` class). At 11px uppercase, these are at the small end of readable. Bump to 12px (`text-xs`) and reduce tracking to `0.05em`. Still recognizable as labels; more legible | P2 |
| 7.5 | **Placeholder text** in inputs is at the default Tailwind color (`text-ink-400`-ish, contrast 3.06) — at the AA-large boundary. Bump to `placeholder:text-ink-500` for AA-normal | P2 |
| 7.6 | **Helper text under inputs** like "Optional — auto-detects state" is at 11px ink-500 — same readability issue. Bump to 12px | P2 |
| 7.7 | **Focus-visible ring** (`outline: 2px solid theme('colors.brand.500')`) is brand-green at 3.82 contrast on white — passes AA-large but fails AAA. Bump to `brand-700` | P2 |
| 7.8 | **CTA visibility from result** — there's no obvious "next action" button after the result. "Find an installer" / "File the rebate" links should be visible without scrolling | P1 (overlap with §1.7) |
| 7.9 | **"Sources used" collapsed by default** — hiding the strongest E-E-A-T signal behind a click is a missed opportunity. Default to *expanded* on result pages; let the user collapse if they want | P2 |
| 7.10 | **Slider thumbs** (used in SolarCalculator's system-size slider) — default Tailwind/browser thumb. Style with `accent-brand-600` already done. Verify touch-target is 24×24+ on mobile | P3 |

---

## §8 — Trust & E-E-A-T surfaces

### Top 3 proposals

**8.1 — Ship the About page already** ★★★

Deferred in prior audits. This is the single most-recommended fix for Google's quality-rater opinion on YMYL content (which home renovation cost calculators are). One page, ~600 words, covering:
- Who runs the site (a name, ideally a photo, even if it's a single editor)
- Editorial standards (how often we review; what we cite; what we don't)
- No-affiliate disclosure (the footer already says this; expand)
- How to report errors (GitHub issue tracker)
- Methodology summary (1 paragraph + link)
- "Reviewed by" — eventually want a real HVAC contractor / electrician quoted

User moment: a journalist, a Wirecutter writer, or a homeowner who's nervous about the source googles "who runs ElectrifyCost" and finds a real human + clear standards. Drastically improves the trust-stack.

Files: `src/pages/about.astro`.

Effort: **S** (1–2 hours of writing).

**8.2 — Add a "Reviewed by [editor name] · 2026-05-13" line at the top of every calculator page** ★★

Currently `lastReviewed` is supported as a prop in `Layout.astro` but isn't *rendered* anywhere visually. The result-panel "Last reviewed" line is inside the collapsed Sources block; user has to click to find it.

**Proposal:** add a thin line under the h1 of every calculator page:
```
Heat Pump Cost Calculator
Reviewed 2026-05-13 by Site Editor · Updated weekly · 14 sources used
```

The "14 sources used" is a hover-tooltip listing the sources.

Files: `Layout.astro` (header band component) + per-page lastReviewed prop.

Effort: **XS**.

**8.3 — Add an inline source for every quoted number in body prose** ★★

Today the body prose says "Most ducted central heat pumps cost $7,500 to $20,000 installed" without an inline source. The user has to scroll to the Sources block to verify. This is the canonical E-E-A-T anti-pattern — claim a number, hide the source.

**Proposal:** every numeric claim in body prose carries an inline superscript citation linking to the source in the page bibliography (see §1.10). E.g.:
```
Most ducted central heat pumps cost $7,500 to $20,000 installed.¹
                                                                ^→ EnergySage 2026 HP Cost Report
```

Files: a `<Cite>` Astro component that registers a source-id and renders a numbered ref; bibliography rendering at page bottom.

Effort: **M** (~1 day for the component + retrofit on flagship pages).

### Other trust items

| # | Item |
|---|---|
| 8.4 | **No "How we make money" disclosure** — the site says no affiliate, no email gate, but doesn't explain how it sustains itself. Even "this site is a personal project / not yet monetized" is more honest than silence. | P2 |
| 8.5 | **Methodology page lacks a "Reviewed by" stamp** — same as 8.2. Add a maintainer name and review cadence | P2 |
| 8.6 | **No real-name expert quote in any FAQ** — flagged in prior audit. Even one quote from one named HVAC contractor on the heat-pump FAQ ("Joe Smith, NATE-certified, recommends Manual J before any quote") would be a YMYL trust uplift | P2 |
| 8.7 | **No "Last refreshed: data-points" timestamp** at a granular level — just per-source. Add an "all-site data freshness" timestamp on the homepage and on `/methodology/` | P3 |
| 8.8 | **No author/editor schema** — `Person` JSON-LD on the about page once it exists, with `author` references on each calculator's `WebApplication` schema | P2 |

---

## §9 — Microcopy

A few drift items I noticed:

### Top 3 proposals

**9.1 — Empty-state copy: from sterile to inviting** ★

Today: `"Enter your details on the left and we'll estimate installed cost, rebates, payback, and panel risk."` — accurate, dry, list-shaped.

**Proposal:** `"Tell us about your home and we'll estimate what a heat pump will really cost — installed, after rebates, and on your monthly bill."` — same length, but specific to the calculator (varies per page), action-shaped, and starts with the user.

Files: each calc component's empty-state copy.

Effort: **XS**.

**9.2 — Button labels — settle the verb** ★

Today: `Copy estimate`, `Print summary`. The two share a row but the verbs are different (`copy` vs `print`). When the new sharing actions land (§1.2), settle on action-verbs:
- `Share` (popover)
- `Print`
- `Compare` (§1.1)

Effort: **XS**.

**9.3 — Result phrasing canonical form** ★

Variants in the codebase today: `Estimated installed cost`, `Your estimated cost`, `Cost estimate`, `Estimated cost · 3-ton · MA`. Pick one structure:
- Header eyebrow: `Estimated installed cost · {size} · {state}`
- Headline: `${mid}`
- Sub: `range ${low}–${high}`

Apply across `ResultPanel.tsx` and the 22 components that roll their own result UI.

Effort: **S**.

### Other microcopy items

| # | Item |
|---|---|
| 9.4 | **Caveat list** in net-card today: `"Net = gross minus active incentives only. Federal 25C, 25D, 30D, 25E credits expired (OBBBA, 2025)…"` — 35-word legalism. Compress to: `"Net = gross minus rebates currently available. Federal 25C/25D credits expired Dec 31 2025."` and link to a longer explainer | P2 |
| 9.5 | **Tooltip prose** is mostly absent (no tooltips yet — see §1.9). When they land, keep them ≤12 words and ≤2 sentences | P3 |
| 9.6 | **Form-error messages** — when a user enters a 4-digit ZIP, today the validation silently slices it to 5 chars max. No feedback. Add: "ZIP must be 5 digits" hint when user types fewer than 5 | P2 |
| 9.7 | **"Most likely" pip** on the Mid card is 9px text. The phrase is opaque (most likely *what*?). Replace with "Typical" or "Mid estimate" — and use the eyebrow style, not a custom pip | P2 |

---

## §10 — Performance perception

(Distinct from §6 in the prior audit, which is about actual speed.)

### Top 3 proposals

**10.1 — Skeleton-load the result panel during hydration** ★★

The flagship calculators are `client:load`, meaning React hydrates as soon as the page is interactive. On mid-tier 4G this is 200–800 ms. During that window, the page shows the form (rendered SSR) but the result area is blank. The user wonders if it's broken.

**Proposal:** SSR a static `ResultPanel` skeleton (three gray boxes for low/mid/high, plus a gray itemized rows skeleton). When React mounts, swap in the real result. Already partially supported by `[data-island-loading] { min-height: 320px }` — just add the visual.

Effort: **S**.

**10.2 — Animate result updates with a 200ms fade** ★

When the user changes an input, the result numbers update instantly. Good for power users; jarring for the rest. A 150–200ms CSS transition on the numeric values would create a sense of "calculating" without slowing things down.

**Proposal:**
```css
.amount { transition: color 150ms, opacity 150ms; }
.amount.updating { opacity: 0.6; }
```

Then on input change, set `updating` for 150ms and clear. CSS-only; no JS animation library needed.

Effort: **XS**.

**10.3 — Respect `prefers-reduced-motion`** ★★

The site has no animations today, but when the above transitions land + the section transitions (§5.1) start using motion, wrap everything in:
```css
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

Effort: **XS**.

---

## §11 — Mobile-specific

### Top 3 proposals

**11.1 — Numeric inputs need numeric keyboards** ★

Spot-checked: `inputMode="numeric"` is set on ZIP and most number inputs. **Good.** But not all. Audit pass:
- ZIP → `inputMode="numeric" pattern="\d*"` ✅
- "Annual electricity use (kWh)" in SolarCalculator → `type="number"` (works but iOS keyboard isn't optimal). Add `inputMode="decimal"`
- All other "number" inputs: same.

Effort: **XS** (mechanical audit).

**11.2 — Tap targets** ★★

Tailwind defaults: `<button>` is 32–36px tall (small for touch). WCAG recommends 44×44px minimum.

**Audit:**
- Primary button (`.btn-primary` with `py-2.5`) = ~44px tall ✅
- Ghost button (`.btn-ghost` same padding) = ~44px ✅
- Sliders / range inputs — verify thumb is 24×24+ on mobile (CSS `::-webkit-slider-thumb`)
- Header nav-item — `py-1.5` = ~30px tall; mobile menu uses py-2 = ~36px. Bump mobile nav links to py-3 (~44px)
- Form-input `<select>` is 36–40px; borderline. Bump to py-3

Effort: **S** (audit + targeted bumps).

**11.3 — Sticky elements behavior on mobile** ★

Header is `sticky top-0`. On mobile that's correct — but the desktop calc form's `position: sticky; top: 4.5rem` (set in media query >1024px) doesn't apply on mobile, so the form is just above the result.

The mobile flow is fine *if* there's a sticky "your estimate" bar (see §5.3). Otherwise: confirm the result panel anchors with `scroll-margin-top` so that after the user submits, it can be scrolled to with `result.scrollIntoView()` — currently not wired.

Effort: **S**.

### Other mobile items

| # | Item |
|---|---|
| 11.4 | **FAQ accordion on mobile** — taps work; the chevron-rotation animation is absent. Add a 100ms rotate on `<details[open]>` for affordance | P3 |
| 11.5 | **Mobile hero photo** intrudes into form spacing (per prior audit) — add `mt-4` on the form column at the md breakpoint | P3 |
| 11.6 | **Mobile result panel** — Low/Mid/High cards are in a 3-col grid that stays 3-col even on 360px. They squeeze. Switch to a 1-col stack on mobile (`grid-cols-1 sm:grid-cols-3`) — the Mid card gets full width = much more legible | P1 |
| 11.7 | **Mobile breadcrumbs** — when 5.1's breadcrumb lands, ensure it truncates with `…` at small widths (`Home › … › Heat pump calculator`) | P2 |

---

## §12 — Anything else: 5 wedge ideas

Things that don't fit other buckets — ideas to make ElectrifyCost distinctively different from EnergySage / Carbon Switch / Rewiring America.

### Wedge 1 — **"Open source calculations"**

The site is already CSV-first. Lean *all the way in*: publish every CSV as a downloadable file from `/sources/`, with a "Why this number?" drawer (§1.3) that points to the exact CSV row. Make it the site's tagline: *"Every number here is in a CSV you can download."* No competitor does this. It's a defensive moat against AI scrapers (they'll quote you anyway) and an offensive trust signal (Wirecutter, Consumer Reports, Vox journalists love this).

Effort: M. Impact: identity-defining.

### Wedge 2 — **Plain-Markdown "Print my plan" PDF**

Rewiring America's planner produces a glossy PDF; it's a marketing artifact, not useful. ElectrifyCost can ship a plain, *editable*, Markdown-source PDF with the user's exact inputs, computed numbers, sources, and a printable checklist. Send it to your contractor, your spouse, your tax preparer. *Bring this to the quote.* Single most actionable artifact in the space.

Effort: M (already 80% there with the print stylesheet). Impact: distribution + retention.

### Wedge 3 — **Live "rebate diff" feed**

Every CSV has a `last_reviewed` date. Add a feed at `/changes/` that auto-lists "What changed in the last 30 / 90 days" — Mass Save dropped cap to $8,500, NYSERDA reauthorized through 2030, CA TECH program X, etc. Becomes the canonical changelog for residential electrification incentives in the US. Bloggers, journalists, contractors will link to it.

Effort: S (Git log of CSV changes feeds straight in). Impact: SEO + authority signal.

### Wedge 4 — **"Bring this to your quote" checklist mode**

Promote the existing contractor checklist into a standalone mode: user inputs their state + project, gets a printable 2-page document with (a) typical price band, (b) checklist of 15 questions to ask, (c) red-flag list, (d) rebate filing steps. Distinct from any other tool — current calculators are "what does it cost"; this is "what do I bring to the conversation." Contractors will eventually reference it because it makes the customer better-informed (and they cost less to close).

Effort: S (the data exists in `contractor-checklists.json`). Impact: viral + sticky.

### Wedge 5 — **Inverse calculator: "I have $X — what should I do?"**

EnergySage and Rewiring America both ask "tell us about your home, we'll tell you what to do." ElectrifyCost can flip it: **give me a budget, give me a goal (comfort, savings, carbon, resilience), I'll rank your project options.** Pure optimization on top of the existing CSV math — no new data needed. Unique angle. Frames the site as a planner, not a calculator-collection.

Effort: M. Impact: positioning shift.

---

## §13 — Top 10 prioritized

Ordered by **impact ÷ effort** for a redesign-pass budget.

| # | Item | Bucket | Effort | Why now |
|---|---|---|---|---|
| 1 | **Visible breadcrumb on every page** (§2.1) | IA | XS | One-line layout change; immediate orientation win for the entire site |
| 2 | **Alternate section backgrounds for visual rhythm** (§5.1) | Hierarchy | S | Solves the user's "section separation" complaint directly; the site will *feel* different in one PR |
| 3 | **Result-panel outer card + Mid headline at text-4xl** (§5.2 + §7.1) | Hierarchy | XS | The single most important visual moment on every page; takes 30 minutes |
| 4 | **Promote the result-panel `Sources` block to expanded-by-default** + per-page bibliography (§7.9 + §1.10) | Trust | S | Existing data, no math, big E-E-A-T signal |
| 5 | **Mobile result panel: stack to 1-col on small widths** (§11.6) | Mobile | XS | Visible improvement on 40%+ of traffic; a single grid class change |
| 6 | **About page** (§8.1) | Trust | S | 1–2 hours of writing; long-overdue. YMYL trust uplift |
| 7 | **Eliminate emerald/amber/cyan color drift in 22 components → standardize on `brand-*` (palette A)** (§3 Palette A) | Color | M | One coherent brand. Half-day refactor; permanent fix |
| 8 | **Compare-two-scenarios mode** (§1.1) | Usefulness | M | Highest-rated unmet user feature across competitor user reviews |
| 9 | **"Share this estimate" with URL hash + email-to-self** (§1.2) | Retention | M | Site currently has zero persistence; this opens the funnel |
| 10 | **"Why this number?" drawer on every itemized row** (§1.3) | Trust / E-E-A-T | M | The site's unique-selling-proposition made literal; no competitor does this |

A two-week sprint hits #1–7 cleanly; #8–10 are the second sprint.

---

## §14 — What I considered but ruled out

- **Full dark mode** — high effort, low payoff for a daytime planning tool. Defer until palette settles.
- **Animations on result update beyond a fade** — risks "calculator math feels fake." Stick to a single 150ms opacity transition.
- **Carousel for "related calculators"** — flat link list is better for SEO and scanning.
- **Hamburger menu on desktop** — the explicit category dropdowns work; don't hide nav.
- **Bottom-fixed CTA bar on desktop** — visually heavy; sticky estimate-bar (§5.3) is the better move.
- **Live chat widget** — outside-brand and slow; not for a no-funnel site.

---

## §15 — Verification suggestions for any redesign pass

When implementing any of the above:
- Re-run the contrast script (this audit shipped one — see §3) on the proposed palette before merging.
- Lighthouse mobile + desktop pre- and post-, target ≥ 90 on both.
- Visual regression: 5 flagship pages × {mobile-360, mobile-414, tablet-768, desktop-1280, desktop-1440} = 25 screenshots; eyeball every one.
- A11y: axe-core scan on each flagship; expect 0 critical/serious.
- Print preview: PDF the heat-pump page and verify the print stylesheet still produces a clean 1-page summary.

---

End of refinement audit.

Sources:
- [EnergySage heat pump calculator features](https://www.energysage.com/electricity/house-watts/how-many-watts-does-an-air-source-heat-pump-use/)
- [EnergySage heat pump cost 2025](https://www.energysage.com/clean-heating-cooling/air-source-heat-pumps/costs-and-benefits-air-source-heat-pumps/)
- [Rewiring America Personal Electrification Planner](https://homes.rewiringamerica.org/personal-electrification-planner)
- [Rewiring America Planner methodology](https://homes.rewiringamerica.org/data-methodology)
- [Carbon Switch reports](https://carbonswitch.com/reports)
- [WCAG 2.1 contrast guidance](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
