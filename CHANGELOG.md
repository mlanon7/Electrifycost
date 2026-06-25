# Changelog

All notable changes to ElectrifyCost. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) but tailored to a calculator + content site.

This file tracks shipped versions. Per-audit deep dives and pass-by-pass change logs live in `/audit/`.

---

## [Unreleased]

### Shipped (2026-06-24) — Monte Carlo cost simulation + Project Simulator
- **Probabilistic cost engine.** `src/lib/montecarlo.js` — ported math-identical from ProjectCostPro (triangular per-line-item draws, one-factor Gaussian copula ρ=0.5, beta-PERT surprise adders); ESM wrapper so it imports as a Vite island and is `require()`-able. `scripts/test-montecarlo.cjs` (39 assertions) + `scripts/validate-risk-events.cjs` wired into `npm test` (now **6 stages**). Calibration constants are load-bearing — see `.claude/lessons/11-monte-carlo-simulation.md`.
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
- **Audit 2026-05-27 (`20fda58`).** Closed P0 (wrong 30D credit date in ev-tco guide) + 12 P1 + 13 P2 + 3 Ahrefs items. New `/privacy/` and `/terms/` pages (unblock ad-network applications) + Footer "Legal" column; `vercel.json` HTML Cache-Control now matches clean URLs; `BreadcrumbList` on all 6 `[state]` templates (357 pages) + `/rebates/`; `WebApplication` schema on sqft/tonnage/brand pages; hero "planning range" disclaimer on state pages; site-wide `text-ink-500 → ink-600` (WCAG AA contrast); `:focus-visible` ring + cookie-banner/hamburger 44×44 touch targets; `*.csv?raw` declaration in `env.d.ts` (tsc baseline 51 errors → 0); CA `hvac_multiplier` 1.38 → 1.45. Full doc: `audit/AUDIT_2026-05-27.md`.
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
- Keyword Tier 3 (audit/KEYWORD_OPPORTUNITIES_2026-05.md): replace-furnace-with-heat-pump, dual-fuel, generic heating-cost calculator, AC-by-tonnage
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
See audit/KEYWORD_OPPORTUNITIES_2026-05.md.

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
