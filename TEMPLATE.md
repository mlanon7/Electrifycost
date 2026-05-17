# TEMPLATE — Building a Similar Calculator-First Content Site

This is the meta-document for adapting ElectrifyCost's pattern to a new niche. If you're standing up a calculator-first site for HVAC SaaS, solar microgrids, EV total-cost-of-ownership, home renovation estimating, insurance quoting, or any other niche where the user wants **"give me a planning-range number based on my inputs, with the math shown"** — this is the playbook.

The 6-pass arc that got ElectrifyCost from zero to a 408-URL site with 38 calculators in 4 weeks is documented here. Use it as a recipe, not a script. The principles transfer; the specifics need adaptation.

---

## Part 1 — The pattern at a glance

A **calculator-first content site** has these architectural elements:

| Element | What it does | Reusable in your niche? |
|---|---|---|
| **Static-first build** | Pre-rendered HTML for every page; React only on calculator interactions | ✅ Always |
| **Interactive calculator islands** | One hydrated React component per page; rest is static | ✅ Always |
| **CSV-as-database** | Every numeric input in version-controlled CSV files | ✅ Always |
| **Source-cited engine** | Calculator math reads CSVs with `source_id` + `last_reviewed` per row | ✅ Always |
| **Programmatic SEO** | One template generates 50+ URLs by iterating a dimension (state, brand, year, sqft) | ✅ Almost always |
| **Guides + comparison pages** | Long-form content adjacent to each calculator, internally linked | ✅ Always |
| **Methodology + sources pages** | E-E-A-T anchor; explains formulas + lists every primary source URL | ✅ Always for YMYL |
| **No funnel** (optional) | No email gate, no lead form — trust-first | Optional — see below |
| **Quarterly source review** | Each CSV row carries `last_reviewed`; footer surfaces the max | ✅ Always |

---

## Part 2 — Tech stack (reusable starter)

```
- Astro 4.x          static-first SSG with React islands
- React 18 + TS      for calculator UI
- Tailwind 3.x       utility-first styling
- Vercel             static hosting, immutable cache, security headers
- @fontsource        self-hosted fonts (no Google Fonts third-party fetch)
- Vite ?raw imports  CSV files inlined at build
- Custom sitemap     postbuild script walks dist/ → emits sitemap.xml
- GitHub Actions CI  validators + tests + build on every push
- GA4 + Consent v2   privacy-friendly analytics
```

**Don't substitute** unless you have a specific reason. The combination is battle-tested:
- Astro's SSG is faster to build and deploy than Next.js / Remix for this use case
- Astro's hydration model (islands) makes "10 pages of static content + 1 hydrated calculator" trivially efficient
- Tailwind utility classes keep the styling lean and consistent
- Vercel's edge cache means cold-start latency is near-zero for static pages

**Easy substitutions that don't change the pattern:**
- Replace Vercel with Cloudflare Pages, Netlify, GitHub Pages, S3 + CloudFront
- Replace GA4 with Plausible / Pirsch / Fathom (the recommended path for the no-funnel position)
- Replace Tailwind with vanilla CSS / Pico.css / Tachyons if you have strong opinions about it
- Replace `@fontsource` with `@next/font` style if you're on Next.js instead

---

## Part 3 — The 6-pass build sequence

This is the order that worked. Skip ahead and you'll spend more time later debugging.

### Pass 1 — Scaffold + 5 flagship calculators

**Goal:** Prove the calculator engine works. Get one canonical page shape published.

- Astro + React + Tailwind scaffold
- Identify the 5 highest-search-volume modules in your niche
- Build a shared calculator engine (`src/lib/calc.ts`) that takes `args: CalcArgs` and returns `result: CalculatorResult` with low/mid/high bands + itemized breakdown + incentives + caveats
- Build 5 React components, one per flagship, each calling the shared engine
- Build 5 calculator pages with the same structure: hero + quick-answer callout + calculator + FAQ + "Related calculators"
- Add the methodology + sources pages
- Write a smoke-test script that runs ~12 input scenarios through the engine and asserts band ordering, incentive application, payback computation

**Deliverable at end of Pass 1:** 8 pages live. The shared engine + smoke test is the foundation everything else builds on.

### Pass 2 — Data refactor + programmatic SEO

**Goal:** Get to 50+ pages without writing 50+ pages of code.

- Migrate every numeric input from TS to CSV (`data/csv/*.csv`)
- Add `source_id` + `last_reviewed` columns to every row
- Build a "programmatic-state-pages" template: one `.astro` file using `getStaticPaths()` to emit N pages, one per dimension value
- Pick the dimension that matters most in your niche: U.S. states (electrification, insurance, real-estate), countries (international SaaS), brand/model (EV vehicles, appliance models), year (insurance quotes), capacity (solar arrays), home characteristics (sqft, age, fuel)
- Build the by-dimension hub page that links to all N programmatic pages

**Deliverable at end of Pass 2:** 50–100 pages live, all calibrated to the dimension you chose.

### Pass 3 — Audit + accuracy correction

**Goal:** Verify every number on the site against an authoritative primary source.

This pass exists because the first two passes inevitably ship some wrong numbers. Examples from ElectrifyCost's Pass 3 (real, embarrassing):
- Solar $/W mid was $3.30 — industry median was $2.58. The calculator over-quoted by 28%.
- Geothermal CSV had "indoor + loop" as additive, but industry pricing is a single per-ton installed figure. The calculator over-quoted by 60–170%.
- Mass Save heat-pump rebate cap was $10,000 — actually $8,500 effective 2026-01-01.

**Process:**
- For every CSV row, find ≥1 authoritative 2024–current primary source
- Sources by category (substitute your domain's primary-source canon):
  - Equipment costs → NREL benchmark studies, ENERGY STAR product finder
  - Labor costs → BLS Occupational Wage Statistics
  - Energy prices → EIA State Energy Profiles
  - Climate / weather → IECC, NOAA, NREL PVWatts
  - Tax credits → IRS publications, recent regulatory changes
  - Rebates → DSIRE, state energy office websites, utility incentive pages
- For each row, record: site value → industry value → severity (P0 = ships wrong, P1 = materially misleading, P2 = within tolerance, P3 = stylistic)
- Fix the P0s. Defer the P3s.

**Deliverable at end of Pass 3:** Same 50–100 pages but with verified numbers. This is when the site becomes trustworthy.

### Pass 4 — Content depth + UX

**Goal:** Make each page substantive enough to actually rank.

- Add 8–12 FAQ items per flagship calculator, each citing a primary source URL inline
- Build long-form guide pages (~2,000–3,500 words each) for each major topic in the niche
- Add comparison pages (`A-vs-B`) for the high-volume "which should I choose" queries
- Build per-amp / per-tier / per-sqft pages as deeper programmatic surface
- Add cookie banner + analytics + Consent Mode v2 (you need traffic data from day 1)
- Add About page with founder bio, methodology link, editorial policy — closes the E-E-A-T gap for YMYL content

**Deliverable at end of Pass 4:** 200+ pages, deep content on flagships, ready for indexing.

### Pass 5 — Programmatic SEO expansion

**Goal:** 5–10× the URL count by adding more dimensions.

For ElectrifyCost this meant adding state-programmatic pages for 4 more modules (204 new pages) + cost-by-sqft variants (5 new pages) + per-amp panel-upgrade variants (4 new pages). Total: +213 URLs.

For your niche, the second-dimension might be:
- **Real estate:** state × property-type, state × bedrooms, year × city, school-district × home-age
- **Insurance:** state × age × condition, breed × age (for pets), make × model × year (for autos)
- **HVAC SaaS:** state × license-type, certification × year, equipment-brand × tier
- **EV TCO:** make × model × year, charging-pattern × annual-miles

Most niches have at least 3 useful dimensions. Phase the rollout: pick the highest-value one, build it, ship it, measure, then add the next.

**Deliverable at end of Pass 5:** 300–500 pages. The site has critical mass for organic discovery.

### Pass 6 — Audit, normalize, formalize

**Goal:** Clean up the inconsistencies that crept in across passes 1–5.

- Read every guide / page side-by-side and identify formatting drift (different templates evolved as the site grew)
- Unify the eyebrow / H1 / TOC / footer / CTA across all content
- Add a "Related X" footer to every content page (massive internal-linking SEO lift)
- Submit `sitemap.xml` to Google Search Console + Bing Webmaster Tools
- Manually request indexing on the 10 highest-value URLs in GSC

**Deliverable at end of Pass 6:** A coherent, internally-linked, indexed site. From here it's content + acquisition.

---

## Part 4 — Decisions to make BEFORE starting

These are choices you can't easily reverse later.

### 1. Niche scope — broad or narrow?

| Pattern | Pros | Cons |
|---|---|---|
| **Single topic, deep** (e.g., just heat pumps) | Easier to be authoritative; faster Pass-1 ship | Limited URL volume; harder programmatic SEO |
| **Topical cluster** (ElectrifyCost: residential electrification) | Wider URL surface; calculator-to-calculator cross-linking compounds | Demands more research breadth in Pass 3 |
| **Multi-niche umbrella** (e.g., all of home improvement) | Massive URL ceiling | Loses authority signal; harder to rank; harder to maintain |

**Recommendation:** Start with a topical cluster — 5–10 related calculators in one domain. ElectrifyCost is residential electrification (HVAC + electrical + EV + water heating + envelope + appliances); a sibling pattern could be home renovation (kitchen + bathroom + roofing + flooring + windows + paint), small-business compliance (LLC formation + payroll + sales tax + permits), or pet insurance (by breed × age × condition).

### 2. Funnel vs. no funnel

ElectrifyCost is no-funnel by design (no email gate, no lead form). The tradeoffs:

| Path | Revenue model | Ranking-friendly? | Trust signal |
|---|---|---|---|
| **No funnel** (this site) | Display ads + affiliate | Yes (no intrusive interstitials) | High |
| **Soft funnel** (email gate for "save your estimate") | Newsletter monetization + ads | Medium | Medium |
| **Hard funnel** (lead form gates the result) | Per-lead sales to contractors / agents | Low (Google penalizes interstitials) | Low |

**Recommendation:** Default to no-funnel for trust + ranking, add monetization as gated env-var-flipped surfaces (`PUBLIC_ADS_ENABLED`, `PUBLIC_AFFILIATES_ENABLED`) so you can flip them on once traffic is real.

### 3. Geographic granularity

Most U.S. consumer niches benefit from state-level programmatic SEO. International niches may need country-level + city-level. B2B SaaS may need industry × state. Pick once; build the entire site's data model around it.

**ElectrifyCost dimensions:** state (51) × module (6 with state pages so far) × sqft (5 for heat pump) = ~331 programmatic pages.

### 4. Data source canon

Identify the 5–10 primary sources you'll cite repeatedly. For ElectrifyCost it's IRS / DOE / EIA / BLS / NREL / NEEP / ENERGY STAR / ACCA / DSIRE / LBNL. For other niches:

| Niche | Likely canon |
|---|---|
| Auto insurance | NAIC, state DOIs, NHTSA, IIHS, CarMD |
| Real estate | Zillow ZHVI, Redfin Data Center, FRED, FHFA, county assessor APIs |
| Health (YMYL) | CDC, NIH, FDA, AAFP — note: harder E-E-A-T bar |
| EV TCO | EPA fuel economy, AAA Your Driving Costs, Kelley Blue Book, Edmunds, Edmunds 5-Yr Cost-to-Own |
| Tax & compliance | IRS, state DORs, Department of Labor, SBA |

If you can't identify ≥5 primary sources for your niche, the niche is probably too narrow or too informal for the E-E-A-T positioning to work.

### 5. Update cadence

Some data ages fast. Energy prices change monthly. Rebate programs change quarterly. Federal tax credits change annually (and sometimes mid-year). Vehicle MSRPs change annually. Insurance rates change continuously.

**Recommendation:** Bake the `last_reviewed` column into every CSV. Surface the max across all rows in the footer ("Data last refreshed YYYY-MM-DD"). Commit to a quarterly source-review process. Skip this and your site decays into stale-data territory within 6 months.

---

## Part 5 — Anti-patterns from this build

Lessons learned the hard way:

| Anti-pattern | Consequence | Fix |
|---|---|---|
| **Three different page templates running in parallel** | Readers notice; site feels unmaintained | Pick ONE canonical template at Pass 1. Migrate any drift in Pass 6. |
| **`<urlset xmlns="...sitemap-0.9">` (hyphen)** | Google rejects sitemap. ~5 days of crawl velocity lost. | Use `sitemap/0.9` (slash). Verify the live URL in GSC after deploy. |
| **Calculator hardcoded `useState('CA')`** | Every state page initially shows California rebates regardless of URL | Accept `initialState` prop on all calculator components |
| **Two CSS class names doing the same job (`.guide-prose` vs `.prose-guide`)** | Maintenance confusion; one class silently does nothing | Use `:is(.guide-prose, .prose-guide)` selectors or pick one name |
| **Truncated source files committed to repo** | `npm run build` fails site-wide | CI workflow on every push. Files-truncation-during-edit happens; CI catches it. |
| **Nested template literals in `.astro` frontmatter with Unicode characters** | esbuild parse error: `Unexpected "export"` at a `const faq = [` line | Use string concatenation with `+` instead of nested backticks |
| **Inline numeric values in TS/JS instead of CSV** | Update lag between calculator output and homepage card "Typical:" range | All numbers in CSV. Homepage cards read from the same data files. |
| **OBBBA-style preamble pasted in every FAQ answer** | AI-slop signal; reader fatigue | One short reference per page; link to `/rebates/` for the full history |
| **Forgetting to verify the sitemap actually opens in a browser after deploy** | Hidden namespace bugs survive for weeks | Always open the live `/sitemap.xml` after a Vercel deploy |

---

## Part 6 — How to fork this repo for a new niche

Practical steps:

```bash
# Clone the repo
git clone https://github.com/mlanon7/Electrifycost.git my-new-site
cd my-new-site

# Reset history
rm -rf .git && git init && git add . && git commit -m "Initial scaffold from ElectrifyCost template"

# Update the project name + URLs throughout
# Files to grep + replace:
#   - package.json (name)
#   - astro.config.mjs (site)
#   - src/components/Layout.astro (siteOrigin default)
#   - src/components/Header.astro, Footer.astro (logo, link)
#   - public/robots.txt (Sitemap URL)
#   - All src/pages/*.astro Layout schemaJsonLd absolute URLs
#   - scripts/build-sitemap.cjs (SITE const)
```

Then:

1. **Decide your niche + dimensions** (Part 4 §§1–4 above)
2. **Replace data files** — write your own CSVs in `data/csv/` matching your niche
3. **Rewrite the engine** — `src/lib/calc.ts` is electrification-specific. The pattern (band math + multipliers + incentive stacking) generalizes, but the specifics change. Keep the smoke-test structure; rewrite the assertions.
4. **Rebuild the flagship pages** — clone one of `src/pages/heat-pump-cost-calculator.astro` style files; swap module-specific content
5. **Rebuild guides** — clone `src/pages/guides/heat-pumps.astro` style; new topic, new SVG diagrams if you have them
6. **Repoint analytics** — change `G-5CMBX2RBY4` in `Layout.astro` to your GA4 property
7. **Repoint the About page** — `src/pages/about.astro` is biographical to Martin Lashgari; change the founder info

The architecture, build scripts, CI workflow, CSV-first data layer, page template structure, guide format, programmatic SEO scaffolding, sitemap generator, consent-mode wiring, and `RelatedGuides` component all transfer with zero or near-zero changes. Most of the work is replacing content + numbers, not code.

**Estimated time** from `git clone` to "100-page niche-specific site is live on Vercel": 2–4 weeks at full focus.

---

## Part 7 — What this template does NOT solve

Honest scope:

- **Acquisition is your problem.** Programmatic SEO works but takes 4–9 months for a cold-start domain. You still need backlinks, content distribution, and traffic seeding (Reddit / HN launch / newsletter outreach) to escape the obscurity gap.
- **Editorial labor is your problem.** Every CSV row needs primary-source citation. Every FAQ needs writing. Every guide needs ~2,000 words. AI assistance helps, but the editorial bar (no slop, real sourcing, voice consistency) means you still review every word.
- **Monetization is your problem.** Display-ad networks (Mediavine / Raptive) require ≥1,000–25,000 monthly sessions before they'll accept you. Affiliate programs require traffic to convert. The first 6–12 months are unmonetized.
- **The legal moat is thin.** Cost calculators are competitive. Your moat is data freshness + editorial trust + topical depth — not technology. Maintain the data, and the moat compounds; let it decay, and a competitor with fresh data eats your lunch.

---

## Closing thought

The pattern in this repo took ~30 days of focused work to ship from zero to 400+ URLs with verified data. The TEMPLATE.md exists so the same pattern is repeatable in 10–15 days for the next niche — most of the architectural decisions and tooling are already made.

The hard parts are choosing the right niche, identifying the right primary sources, and writing the editorial content. The easy part is now this codebase.

---

**Last reviewed: 2026-05-17**
