# Changelog

All notable changes to ElectrifyCost. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) but tailored to a calculator + content site.

This file tracks shipped versions. Per-audit deep dives and pass-by-pass change logs live in `/audit/`.

---

## [Unreleased]

### Planned
- Keyword Tier 3 (audit/KEYWORD_OPPORTUNITIES_2026-05.md): replace-furnace-with-heat-pump, dual-fuel, generic heating-cost calculator, AC-by-tonnage
- Inline SVG diagrams for the 32 non-Template-A guides (per-topic design work)
- Custom callout cards on non-flagship guides ("red flags", "key insight", "bid-padding tactics")
- Per-module CSV chunking refactor to drop the 104 KB shared `?raw` bundle
- About page reviewer pattern: add a named licensed electrician / HVAC tech as quarterly content reviewer

---

## [2026.05.19] — Keyword expansion: size + brand dimensions (Tier 1 + Tier 2)

Driven by GSC data analysis (audit/KEYWORD_OPPORTUNITIES_2026-05.md): the site
ranks for long-tail/local/specific queries but not head terms. Added the two
next programmatic dimensions — **size** and **brand** — both thin-competition.

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
