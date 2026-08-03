# Changelog

All notable changes to ElectrifyCost. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) but tailored to a calculator + content site.

This file tracks shipped versions. Per-audit deep dives and pass-by-pass change logs live in `/audit/`.

---

## [Unreleased]

### Shipped (2026-07-31) — deindex the duplicate city pages
A deep audit measured what every prior "thin content" check missed: the 200 city pages average 2,260 words but are **near-identical**. `heat-pump-cost/austin-tx/` and `.../dallas-tx/` share **2,214 of 2,226 tokens — 0% unique**, differing only in the city name; across samples city pages are **0–5%** unique and state pages 2–7%. Word count was never the tell; the 1.5% word-count *variance* across 100 generated pages was. This is scaled-content duplication — what Bing de-indexes (site hit **exactly 0 impressions on 2026-07-02** and stayed there) and what Google logs as "Discovered – currently not indexed" (**317 pages**).
- **`noindex, follow` on all 200 city pages** via a new `noindex` prop on `Layout.astro`. They stay live and useful (~2,250 words, self-canonical, still linked from the by-city hubs); `follow` keeps link equity flowing. Reversible — one prop.
- **`build-sitemap.cjs` now auto-skips any `noindex` page**, so the sitemap is **500 URLs** (was 700) with no path allowlist to maintain. Add a noindex page anywhere and the sitemap stays correct by itself.
- **State pages kept indexed** — weak at 2–7% unique but they carry genuinely different data (labor multiplier, energy price, climate zone, rebates) and are the ones earning impressions.
- Corrects the 2026-07-24 "authority-gated" diagnosis: a sibling site at **DR 0** with a near-identical backlink profile and 292 pages was earning 28 organic visits while this site at DR 2 with 701 pages earned zero. Page count was a liability.
- New `.claude/lessons/12-programmatic-duplication.md` with the measurement command and thresholds (<10% do not index; 10–30% marginal; >30% fine).

### Shipped (2026-07-04) — Simulator v2 port (ProjectCostPro handoff) + 30C expiry flip
The sister-site session handed off its 2026-07-04 simulator overhaul (`audit/archive/HANDOFF_FROM_PROJECTCOSTPRO_2026-07-04.md`); this is the behavioral port into the Astro/React/TS idiom, plus the 30C expiry that came due the same day:
- **30C expiry flip.** The last live federal credit (30C, EV chargers) expired for property placed in service after 2026-06-30. CSVs flipped to `expired`, smoke tests converted to `asOf`-pinned historical coverage + a present-day gone-entirely assertion, dead census-tract inputs removed from the EV/whole-home calculators, and every page claim that 30C was still claimable rewritten past-tense (13 pages, FAQ JSON-LD kept consistent).
- **Calculator compute extraction (27 modules).** Every bespoke simulator-catalog calculator's math moved verbatim into pure `src/lib/calcs/<slug>.ts` modules (`compute(inputs, opts)` + `TIER_INPUTS`/`TIER_LABELS`/`COST_MIX`); the islands call the same functions, proven by the untouched formula-mirror tests.
- **Share URLs + v2 estimate snapshots everywhere.** All 32 catalog calculators (5 flagships + 27 bespoke) now serialize/restore validated hash share URLs and publish a structured estimate snapshot (`ec:est:<slug>`: band + scope sentence + share-param qs + labeled selects + category breakdown + region label) gated on genuine trusted-event interaction (`window.__EC_TOUCH()` test seam) — share-link replays can never create phantom Customs.
- **Generated simulator bands + drift gate.** `scripts/build-scenario-bands.cjs` (esbuild, no new deps) runs the real compute functions headlessly at national labor and writes `src/data/scenario-projects.json`; `--check` is npm-test stage 9, so published bands can never drift from the calculators again. The regeneration recalibrated tiers in both directions and caught geothermal page copy still contradicting the 2026-05-13 P0 audit rebase (page now matches the audited math).
- **Project Simulator v2.** Instance model (ordered plan; Duplicate replaces the ×N stepper), plan workspace above results, custom configs serialized INTO the share URL (base64url; clean-browser reproduction verified), fail-closed decode with visible notices (v1's silent large-tier fallback is dead), median (P50) headline honestly labeled, planning-cushion line, plan-summary table with per-custom breakdowns, CSV export, branded print-only PDF report, seeded reruns (`seed=` pins a run), Clear-plan never touches saved calculator configs. New `scripts/test-sim-state.cjs` (32 codec assertions) is npm-test stage 8.
- **Scope-aware bid check.** The flagship bid check gains a "Custom — choose included items" mode (comparison band rebuilt from exactly the ticked line items) and a Way-under tier with honest exclusion advice.
- **Governance + CI.** Explicit status enums enforced in `validate-csvs.cjs` (zero drift); CI now runs the full 9-stage `npm test` + `tsc --noEmit` (it previously ran 4 stages and no type check). Mobile money-table audit at 375px found all tables already on the overflow-wrapper pattern; the new report table folds columns instead of side-scrolling.

### Shipped (2026-06-27) — product audit: build the decision on-ramp
An honest product/UX/growth audit (`audit/archive/PRODUCT_AUDIT_2026-06-27.md`, 6 agents incl. an adversarial lens) found the site's single necessary shortcoming: it only answered "what will THIS install cost" — the question homeowners ask *last* — with no on-ramp for the much larger undecided audience. That gap, not domain age, is the root of the discovery problem. Built the missing front door, fully inside the no-funnel stance:
- **`/guides/should-i-electrify/`** — orientation hub routing undecided visitors to the right tool by situation, the money-saving order, and the 2026 incentive reality.
- **`/guides/is-a-heat-pump-worth-it/`** — decision-framed guide targeting the high-demand "is it worth it" query (operating-cost math by fuel, premium after rebates, climate limits, honest worth-it/closer-call cases); ends in the calculator.
- **`/guides/hiring-a-contractor/`** — how to vet a contractor & compare bids; linked from every flagship result panel.
- Homepage hero on-ramp ("Not sure where to start?"), a "Start here" section on the guides hub, and internal links from the heat-pump/whole-home hubs. All citations verified live (0 dead).
- **Reframed the inline cost simulator for homeowners** — leads with "Your likely cost range" + the single most-likely number; the "Monte Carlo / 10,000 scenarios" detail moved to a method footnote (rigor kept, jargon demoted). No math change.
- **Deliberately not done:** email capture — retention is the wrong problem before acquisition works; "no email, ever" stays.
- Site totals: 698 → **701 built pages**, 697 → **700 sitemap URLs**.

### Shipped (2026-06-25) — full-audit remediation (Claude audit, waves 1-4)
A second, independent multi-agent audit (`audit/archive/FULL_AUDIT_CLAUDE_2026-06-25.md`, 18 agents, every P0/P1 adversarially re-verified) confirmed the site ship-clean (no P0 defects) and surfaced one P1 plus governance/polish P2s. Fixed:
- **P1 — panel-FAQ single-source-of-truth.** `electrical-panel-upgrade-cost-[state]` FAQ hardcoded `$1800/$4500 × labor` and disagreed with the on-page calculator; it now computes the default range from the shared engine (`runCalculator`). FAQ == calculator (CA $1,850-$5,925, TX $1,550-$5,075).
- **Conversion tracking on all 32 bespoke calculators.** New `useCalculatorUsed` hook (`src/lib/track.ts`) fires `calculator_used` from every calculator island, not just the 5 flagships — affiliate/Mediavine attribution now covers the full product.
- **`source_id` on the last two un-attributed CSVs** (`rebate-programs.csv`, `home-energy-rebate-status.csv`); every numeric-input CSV now carries resolvable source attribution.
- **Solar base `$/W` reconciled.** `solar-cost-ranges.csv` `base_per_w` was stale at `$2.20/2.60/3.40` (below the EnergySage benchmark) while the live calculator used `$2.50/3.30/4.50`; the CSV now mirrors the calculator.
- **Content guard + caveats.** Extended `validate-content.cjs` with the remaining STYLEGUIDE AI-slop patterns; added the universal "Actual prices depend…" caveat to all flagship result panels; removed "leverage" from 2 guides; trimmed two over-length SEO fields.
- **Deferred (documented in ROADMAP Phase 4):** the full bespoke-calculator→CSV migration, comparison-page context→CSV, and the EIA energy-price refresh — each needs output-snapshot regression coverage or unpublished EIA data, so not done blind.

### Shipped (2026-06-25) — Codex full-site audit response
- **California TECH rebates corrected.** TECH Clean California's single-family heat-pump HVAC + HPWH funds are fully reserved statewide (no new reservations as of early 2026, verified on the program's incentives page). The two `CA_TECH_*` rows in `rebate-programs.csv` move `active` → `reserved`; `calc.ts` now routes any `reserved`/`closed` rebate to **potential** context — shown with a "funding fully reserved, not subtracted" caveat, never deducted from net. New smoke-test assertions (`CA_TECH_HP`/`CA_TECH_HPWH` not in applied, in potential) guard it. Previously CA net estimates ran ~$1k–$4k too low.
- **Federal-credit copy fixes.** Solar-payback FAQ called the residential clean-energy credit "30D" (it is **25D**); the EV-TCO guide framed 30D as active in 2026 and folded used-EVs into 30D (used-EV is **25E**) — both corrected and the new/used credits split. Stale "Mass Save $10,000" copy on 5 guide/comparison pages updated to the current **$8,500** cap. Hot-tub guide no longer lists closed TECH incentives as available; sources page no longer describes expired 25C/25D as currently applied.
- **Content-accuracy regression guard.** New `scripts/validate-content.cjs` (now **stage 4** of `npm test`, **7 stages** total) fails the build on high-signal banned strings: stale Mass Save cap, `30D residential clean energy`, the wrong EV sunset date, and a couple of AI-slop tells.
- **Data governance.** `brand-profiles.csv` gains a `source_id` (`EC_BRAND_BENCHMARK`, a new editorial-benchmark entry in `source-notes.json`) — every numeric-input CSV now carries source attribution. Removed "leverage" (AI-slop) from 2 guides; trimmed the Project Simulator meta description under 160 chars.
- **Note:** the audit's headline "live pages missing from source" finding was a stale-checkout artifact (it audited an un-pulled working copy of the main repo); every route is present on `main`. No source recovery was needed.

### Shipped (2026-06-24) — Monte Carlo cost simulation + Project Simulator
- **Probabilistic cost engine.** `src/lib/montecarlo.js` — ported math-identical from ProjectCostPro (triangular per-line-item draws, one-factor Gaussian copula ρ=0.5, beta-PERT surprise adders); ESM wrapper so it imports as a Vite island and is `require()`-able. `scripts/test-montecarlo.cjs` (39 assertions) + `scripts/validate-risk-events.cjs` wired into `npm test` (now **7 stages** with the 2026-06-25 content guard). Calibration constants are load-bearing — see `.claude/lessons/11-monte-carlo-simulation.md`.
- **Per-calculator inline sim** on every calculator that yields an installed-cost band. `src/components/MonteCarloSim.tsx` renders P10 / most-likely / P90 + a streaming SVG density curve + a sourced "real-world surprises" toggle; models **gross installed cost**, markup 1:1. Embedded once in `ResultPanel.tsx` (covers the 5 flagships + every programmatic state/city/brand page) and rolled out to 27 bespoke calculators. The published band is shown only as a faint reference — **nothing relabeled**.
- **The Project Simulator (`/project-simulator/`)** — a new flagship tool. Pick multiple projects, set scale + quantity, and get one combined cost distribution (the portfolio effect: tighter than the naive low+low / high+high sum). `ProjectSimulator.tsx` + `src/data/scenario-projects.json` (curated per-project tiers + cost mix). Curated bundles, contribution bar, surprise toggle, share-state URLs, Save-as-PDF.
- **ZIP-based regional pricing.** A prominent ZIP bar at the top resolves ZIP → state (`findStateForZip`) → blended labor index applied to each project's labor cost share.
- **"Custom" read-back.** A row's ↗ opens the real calculator in a same-origin iframe popup (`?embed=1` strips the site chrome); on **Done** the simulator picks up that calculator's estimate as a "Custom" tier. `MonteCarloSim` persists `localStorage['ec:est:<slug>']` from one write-point across all calculators. The simulator ZIP auto-fills the popup — flagships via the URL hash (native, reliable), bespoke via a Layout prefill script. Saved bands are used as-is (not re-region-indexed) — no double-counting.
- **Featured nav.** Bold filled "Simulator · New" pill left of Guides/Rebates. The small per-item nav icons were dropped to make room (the pill is the nav's visual anchor; dropdown chevrons + pill icon kept).
- **Risk-event data + validator.** `src/data/risk-events.json` (85 events across 30 calculators) — sourced cost ranges, reasoned-prior probabilities softened to "Possible" when unsourced. Honesty stance documented; P.E. byline + "planning simulation, not a quote" on the page.
- **Site totals:** 697 → **698 built pages**, 696 → **697 sitemap URLs** (the new `/project-simulator/`).

### Shipped (2026-06-14 → 2026-06-20) — deliverability, indexing, portfolio links
- **Single site email (`79dcd06`).** Replaced two stray addresses (`hello@electrifycost.com`, `mkml.inc@gmail.com`) across about/privacy/terms with the one verified mailbox `martin@electrifycost.com`. One contact address sitewide — fewer aliases, less auth surface, one inbox.
- **IndexNow wired (`6e1652d`).** Bing Webmaster Tools' #1 recommendation for the site. Key file at the root + `scripts/indexnow-submit.cjs` (no deps). Submitted all 696 URLs (verified 200 OK; Bing's IndexNow dashboard shows 696 received). Bing + DuckDuckGo are ~half of search referrers. Documented in `INFRASTRUCTURE.md`.
- **Portfolio cross-link with ProjectCostPro (`5e81200` here + `3c4bfb6` in projectcostpro).** Strategic, asymmetric cross-linking between the two sister sites: 8 PCP electrification calculators → EC's deeper specialist calculators; 3 EC pages → PCP for the broader renovation projects EC doesn't cover. Contextual, varied-anchor, one-per-page (not sitewide footer). Strategy + full map in `.claude/lessons/10-portfolio-cross-linking.md`.
- **Live search-console audit (2026-06-14, via Chrome).** GSC: 339 indexed, 302 "discovered – not indexed" (crawl rationing on a young domain), avg position 48.3 (improving). Bing: all 696 URLs read; 13 clicks / 430 impressions; its own top two recommendations were "set up IndexNow" (now done) and "not enough inbound links from high-quality domains." Conclusion: **authority-gated, not content-gated** — third-party backlinks are the lever. No code change; recorded for traceability.

### Infrastructure (2026-06-14) — email authentication
- **Set up `martin@electrifycost.com`** on ImprovMX (forwarding in, Gmail "send as" relaying out via `smtp.improvmx.com`). Hardened with the full auth stack: SPF (existing), **DKIM** (two `dkimprovmx{1,2}._domainkey` CNAMEs), and **DMARC** (`_dmarc` TXT, `p=none` monitoring). Verified **10/10 on mail-tester.com** ("properly authenticated"). All records managed in Vercel DNS. Documented in `INFRASTRUCTURE.md`; setup gotchas in `.claude/lessons/09-email-auth-dmarc-dkim.md`. Pending: tighten DMARC `p=none` → `p=quarantine` ~2026-07-05. Not a code change — recorded here for traceability.

### Shipped (2026-05-27 → 2026-06-14) — data-driven audit + build sprint
- **Audit 2026-05-27 (`20fda58`).** Closed P0 (wrong 30D credit date in ev-tco guide) + 12 P1 + 13 P2 + 3 Ahrefs items. New `/privacy/` and `/terms/` pages (unblock ad-network applications) + Footer "Legal" column; `vercel.json` HTML Cache-Control now matches clean URLs; `BreadcrumbList` on all 6 `[state]` templates (357 pages) + `/rebates/`; `WebApplication` schema on sqft/tonnage/brand pages; hero "planning range" disclaimer on state pages; site-wide `text-ink-500 → ink-600` (WCAG AA contrast); `:focus-visible` ring + cookie-banner/hamburger 44×44 touch targets; `*.csv?raw` declaration in `env.d.ts` (tsc baseline 51 errors → 0); CA `hvac_multiplier` 1.38 → 1.45. Full doc: `audit/archive/AUDIT_2026-05-27.md`.
- **Brand deepening + replacement page (`13ea0ab`).** GSC showed brand pages are the best performers (Bosch pos 10.6). Deepened all 22 `[brand]-*` pages 4 → 8 FAQs with inline primary-source URLs (IRS/DOE/ENERGY STAR/NEEP/AFDC/CPUC/DSIRE). New `/heat-pump-replacement-cost/` page targets the pos-28 "heat pump replacement" gap.
- **Water-heater state pages (`e2f59e2`).** 51 `water-heater-installation-cost-[state]` pages + by-state hub, targeting the GSC water-heater demand cluster (#2 by impressions). `TankWaterHeaterCalculator` gains the `initialState` prop (state-programmatic convention).
- **P2/P3 backlog (`6e38723`).** CWV measured (Lighthouse: home 87/96/96/100, calc 93/94/96/100 — passes Mediavine targets); logo PNG 58KB → 19KB; `source_id`+`last_reviewed` added to the last 7 CSVs (all 51 now carry provenance); named studies cited (LBNL Aeroseal, Nest white paper); internal links into geothermal + battery-vs-generator; ResultPanel row toggle made keyboard-accessible (`<button>` + `aria-expanded`); dingbat/emoji policy codified in `STYLEGUIDE.md`; sitemap priority 0.7 for brand/tonnage/replacement/hub pages; `AffiliateModule` `kind` union trimmed to placed kinds.
- **Removed junk:** `MANUS_AUDIT_PROMPT.md` (orphan external-agent prompt), `scripts/optimize-images.cjs` (stale — targeted PNG hero photos that no longer exist; superseded by `recompress-images.cjs`).

### Fixed (post-review of GPT audit, 2026-05-19)
- **Heat-pump content leaked onto 4 non-HP state templates.** The panel / EV / HPWH / induction `[state]` templates (204 pages) had heat-pump meta descriptions, schema names ("Heat Pump Cost Calculator"), hero subtitles, stat grids (Climate zone / Natural gas / Heat pump class), and "Heat pump rebates" headings — leftover from the clone-then-differentiate build. Each now has module-correct description, schema name, subtitle, a module-appropriate 3-card stat grid, and rebates heading.
- **Structured data silently dropped on 12 keyword templates.** `ducted-heat-pump-cost`, `electric-furnace-cost-calculator`, the 5 tonnage pages, `heat-pump-operating-cost-calculator`, and all 4 `[brand]-*` templates defined `schemaJsonLd` but never passed it to `<Layout>`, so FAQPage/WebPage JSON-LD didn't reach the HTML. Added `schemaJsonLd={schemaJsonLd}` to all 12.
- **Brand CSV had unsourceable precise percentages** ("10-20% above value brands", "25-30% under Trane"). Softened to qualitative positioning to match the site's source-cited standard.
- **Sump-pump battery-backup intent strengthened** on the existing position-15 page (added 3 exact-intent FAQ on backup cost / runtime / selection) rather than creating a competing `/sump-pump-battery-backup-cost/` URL that would cannibalize the ranking.

### Planned
- Keyword Tier 3 (audit/archive/KEYWORD_OPPORTUNITIES_2026-05.md): replace-furnace-with-heat-pump, dual-fuel, generic heating-cost calculator, AC-by-tonnage
- Inline SVG diagrams for the 32 non-Template-A guides (per-topic design work)
- Custom callout cards on non-flagship guides ("red flags", "key insight", "bid-padding tactics")
- Per-module CSV chunking refactor to drop the 104 KB shared `?raw` bundle
- About page reviewer pattern: add a named licensed electrician / HVAC tech as quarterly content reviewer

---

## [2026.05.19] — Keyword expansion: size + brand dimensions (Tier 1 + Tier 2)

Tier 1 (size) is GSC-proven (the export had tonnage/operating-cost queries).
Tier 2 (brand) is a **strategic bet, NOT GSC-proven** — the export had no brand
queries (site was days old with no brand pages to surface). Validate brand-page
performance with Ahrefs + post-launch GSC, not as GSC-driven the way Tier 1 is.
See audit/archive/KEYWORD_OPPORTUNITIES_2026-05.md.

### Added — Tier 2 brand pages (22 pages)
- `data/csv/brand-profiles.csv` — 22 brand rows (category, brand, slug, tier, positioning, models, price_note)
- `src/lib/data.ts` — `BRAND_PROFILES` + `brandsByCategory()` exports
- `[brand]-heat-pump-cost.astro` → 8 pages (Mitsubishi, Carrier, Trane, Daikin, Bosch, Lennox, Goodman, Rheem)
- `[brand]-heat-pump-water-heater-cost.astro` → 5 (Rheem, AO Smith, Bradford White, Rinnai, Sanden)
- `[brand]-ev-charger-installation-cost.astro` → 5 (ChargePoint, Wallbox, Tesla, Emporia, Grizzl-E)
- `[brand]-home-battery-cost.astro` → 4 (Tesla Powerwall, Enphase, LG, Franklin)
- "Cost by brand" link sections added to the 4 parent calculator pages (discoverability)
- Suffix-form URLs (`/mitsubishi-heat-pump-cost/`) — collision-free with the prefix-form `heat-pump-cost-[state]` route

### Added — Tier 1 size/type/operating pages (8 pages)
- Heat pump by tonnage: `/heat-pump-cost-{1-5,2,3,4,5}-ton/` (5 static, prefix form)
- `/heat-pump-operating-cost-calculator/` — "cost to run" intent
- `/ducted-heat-pump-cost/` — ducted vs ductless framing
- `/electric-furnace-cost-calculator/` — content page, recommends heat pump alternative

### Fixed
- `brand-profiles.csv` price-note commas (`$2,200`) broke CSV parsing → switched to k-notation (`$2.2k`)

### Site totals
- 612 → **642 built pages**, 611 → **641 sitemap URLs**

---

## [2026.05.19] — City programmatic pages + content gaps + HN kit

### Added
- **200 city programmatic pages**: `heat-pump-cost/[city].astro` + `heat-pump-water-heater-cost/[city].astro` for the 100 largest U.S. metros (subpath URLs to avoid route collision)
- `data/csv/top-cities.csv` (100 cities → state) + `ALL_CITIES`/`findCity`/`stateName` in data.ts
- `/heat-pump-cost-by-city/` + `/heat-pump-water-heater-cost-by-city/` hubs
- `/water-heater-installation-cost-calculator/` — exact-match for the recurring "75 gallon water heater installation cost" query (20 GSC impressions, no prior exact page)
- Named gov-source citations (NREL/DOE/EIA) on 6 flagship FAQ pages — replicating the DOE-page-1 ranking pattern
- Internal links from the flagship heat-pump page to striking-distance + geo pages
- `.claude/prompts/hackernews-launch.md` — Show HN launch kit

### Fixed
- HPWH city cluster was orphaned (sitemap-only) → added by-city hub + calculator/homepage links

---

## [2026.05.17] — Documentation set + .claude/ toolkit

### Added
- Root docs: CONTRIBUTING, CHANGELOG, ARCHITECTURE, STYLEGUIDE, TEMPLATE, SECURITY, ROADMAP, LICENSE
- `.claude/` toolkit: README + 9 commands + 7 lessons + 4 reusable prompts
- `.gitignore`: keep `.claude/` workflow docs committed, ignore only `worktrees/`/`cache`/`tasks`

---

## [2026.05.17] — Phase 2 guide unification + CLAUDE.md

### Added
- Numbered H2 sections (1.–N.) on all 32 non-Template-A guides
- TOC pill-bar at the top of every guide with anchor jump-links
- Slug-style `id` attributes on every H2 across all 37 guides
- **CLAUDE.md** — AI-assistant working-context file (~330 lines)
- **CONTRIBUTING.md** + **CHANGELOG.md** + **LICENSE** (this commit)

### Changed
- `RelatedGuides` component: added `id="related-guides"` + `scroll-mt-20` so TOC anchors clear the sticky header

---

## [2026.05.17] — Phase 1 guide unification

### Added
- `src/components/RelatedGuides.astro` — uniform "Related guides" footer (3 sibling cards + calculator CTA button)
- `src/lib/guide-relationships.ts` — 37-entry relationship map keyed by guide slug
- `<RelatedGuides>` injected into all 37 guides

### Changed
- `.eyebrow` CSS utility updated to match Template A recipe (`text-xs` + `tracking-wider` + `text-brand-700`)
- `.guide-prose` selectors now use `:is(.guide-prose, .prose-guide)` — Template C guides instantly gain full prose styling that previously came from browser defaults

### Fixed
- Phantom `.prose-guide` class had no CSS definition → Template C guides rendered with bare browser styles. Aliased in this pass.

---

## [2026.05.17] — Google Analytics 4 wiring

### Added
- GA4 with measurement ID `G-5CMBX2RBY4` in `Layout.astro`
- Google Consent Mode v2 with `denied` defaults (GDPR + CCPA compliant from first byte)
- `src/components/CookieBanner.astro` — Accept / Decline UI, localStorage-backed decision
- `calculator_used` custom GA4 event firing from `ResultPanel.tsx` per (module, scenario)

---

## [2026.05.17] — Sitemap namespace fix

### Fixed
- `scripts/build-sitemap.cjs` emitted `xmlns="http://www.sitemaps.org/schemas/sitemap-0.9"` (hyphen). Correct namespace is `sitemap/0.9` (slash). Google Search Console rejected the sitemap as malformed; ~5 days of crawl velocity lost before the fix.

---

## [2026.05.17] — Header logo reduction

### Changed
- Header logo reduced 15% across all breakpoints (mobile 32 → 27px, tablet 36 → 31px, desktop 40 → 34px)

---

## [2026.05.17] — Pass 5: About page + 215 new pages

### Added
- `/about/` page — founder bio (Martin Lashgari, Ph.D., P.E., PMP) + AboutPage + Person JSON-LD
- **204 new state programmatic pages:** EV charger × 51, panel × 51, HPWH × 51, induction × 51
- **4 new by-state hubs** for the same modules
- **5 cost-by-sqft pages** for heat pump (1000 / 1500 / 2000 / 2500 / 3000)
- Footer "About" link

### Fixed (P0)
- State programmatic pages hydrated the calculator with `useState('CA')` regardless of the page's state. A visitor to `/heat-pump-cost-tx/` saw California rebates initially.
- All 5 flagship calculators (HeatPump, EvCharger, Panel, Hpwh, Induction) now accept an `initialState` prop. Every state page passes `initialState={stateCode}`.

### Site totals
- 91 → **109 .astro source files**
- 200 → **409 built HTML pages**
- 156 → **408 sitemap URLs**

---

## [2026.05.17] — Pass 4 audit fixes

### Added
- 4 new per-amp panel pages: `/100a-to-200a-panel-upgrade-cost/`, `/200a-to-400a-panel-upgrade-cost/`, `/subpanel-cost/`, `/load-management-vs-panel-upgrade/`
- Self-hosted Inter + Source Serif 4 via `@fontsource` (eliminates 3 third-party Google Fonts fetches per page)
- Article schema on `/guides/` hub via `CollectionPage` (all 37 sub-guides already had `TechArticle`)
- Smoke-test assertions guarding panel CA-difficult cap (high band ≤ $8,000)

### Fixed (P0/P1)
- EV charger page regression: 4 deleted sections (AffiliateDisclosure, AffiliateModule, "New to home EV charging?", visible FAQ render, Related calculators) restored
- Panel CA double-compounding: `upgrade_100_to_200` labor hours rebased 8/12/18 → 7/10/14 to keep CA-difficult high within industry $7.5K cap

### Removed
- 6 orphan stale CSVs in `src/data/*.csv` (live copies under `data/csv/`)
- Dead `src/lib/analytics.ts` shim (was never imported)

---

## [2026.05.13] — Deep audit Pass 3 + UX refinement

### Added
- `/whole-home-electrification-cost-calculator/` flagship
- `/heat-pump-cost-by-state/` + `/solar-panel-cost-by-state/` hub pages
- URL-hash state on heat-pump + panel calculators (shareable inputs)
- "Why this number?" expandable drawer per itemized line in ResultPanel
- "Last reviewed" timestamp in breadcrumb bar + footer
- Section-shelf full-bleed background utility for guide visual rhythm
- `scripts/build-sitemap.cjs` postbuild script (replaces broken `@astrojs/sitemap`)
- `.github/workflows/ci.yml` running validators + tests + build on every push/PR

### Changed
- **Solar $/W rebased:** mid `$3.30` → `$2.60` matching EnergySage Q1-2026 marketplace median (28% accuracy correction)
- **Geothermal restructured:** dropped `indoor_per_ton`, rebased loop rows to fully-loaded `$/ton` (industry consolidates indoor + loop into a single per-ton figure)
- **Mass Save HP rebate cap** $10,000 → $8,500 (effective 2026-01-01 per Mass Save)
- **NYSERDA Clean Heat** $1,000–$3,500 → $2,000–$12,000 (2026–2030 reauthorization at $5.36B)
- EV charging assumptions: gas `$3.45` → `$3.70`/gal, electricity `0.165` → `0.1765`/kWh (EIA April 2026)
- `hp_ua_per_sqft` `0.15` → `0.22` (existing-home stock baseline)
- All flagship `WebApplication` schemas: `applicationCategory: 'UtilitiesApplication'` → `'BusinessApplication'`
- All 27 hero PNGs compressed to AVIF + WebP via `<picture>` triples (58.5 MB → 4.4 MB)

### Fixed
- `sources.astro` line 110 mid-text glitch
- 5 pre-existing `class=` / `className=` mismatches in non-flagship calculators
- Robots.txt sitemap URL: `sitemap-index.xml` (404) → `sitemap.xml`

---

## [2026.05.08] — Initial deep audit + recovery

### Added
- Initial audit report identifying 14 truncated source files
- Restored: `Layout.astro`, `Header.astro`, `Footer.astro`, `ResultPanel.tsx`, `calc.ts`, `data.ts`, `index.astro`, `sources.astro`, the 5 flagship calculator pages, `global.css`

### Fixed
- `runCalculator()` was missing the `return` statement; restored with full result-object construction
- `ALL_STATES` export missing from `data.ts`; restored
- Truncation in 14 ship-path files blocked `npm run build` entirely

---

## [2026.05.01] — Initial scaffold (R5 audit)

### Added
- Astro 4 + React + Tailwind scaffold
- 5 flagship calculator pages + shared engine in `src/lib/calc.ts`
- 51 per-state heat-pump programmatic pages
- Methodology + sources + rebates + glossary + 404
- CSV-first data layer (49 files)
- `vercel.json` with security + cache headers

---

## Conventions for future entries

- **Date as `[YYYY.MM.DD]`** at the section header. Multiple sections on the same day are fine (sort by commit time descending).
- **Subsections** in this order: Added → Changed → Fixed → Removed → Deprecated → Security.
- **Link audit docs** (`/audit/*.md`) for the deep-dive context behind each ship.
- **One-line "why"** for non-obvious changes. Future you will thank you.
- **Site totals** noted when a release changes URL count or page count materially.
