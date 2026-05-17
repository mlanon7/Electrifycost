# Roadmap

Living document of what's planned, deferred, or under consideration. Not a commitment, but useful for understanding direction.

Items here are loosely ordered by priority (top = sooner). When something ships, move it to `CHANGELOG.md` and delete the entry here.

---

## Up next (next 30 days)

### Acquisition + indexing

- **Reddit seeding.** Genuinely useful answers in r/heatpumps, r/electricvehicles, r/solar, r/HomeImprovement, r/HVAC — link the calculator when it's the actual best resource for the OP's question. 2–3 posts/week.
- **HackerNews "Show HN" launch post.** One-shot, big traffic + backlink potential. The "no-funnel, source-cited, OBBBA-current" angle has genuine HN appeal.
- **Newsletter outreach.** Email ~30 climate / electrification newsletters and blogs (Canary Media, Heatmap, Volts, Distilled, The Cool Down, Electrify This). "Free source-backed calculator, no funnel, would your readers find this useful?" Expect 1–3% reply rate; each yes is a high-DA backlink.
- **Manually request indexing in GSC** on the top-10 highest-value URLs (already prioritized; see `CLAUDE.md` § "When indexing fails").

### Quality

- **Fix the HPWH state template FAQ.** The `heat-pump-water-heater-cost-[state].astro` file uses plain-string FAQ (no `${stateName}` interpolation) as a workaround for an esbuild parser bug. Find the trigger and re-introduce state-specific FAQ content like the other 5 state templates.
- **State-specific paragraph per state page.** Currently the per-state prose is generic ("Texas is in a moderate climate zone, standard ASHPs work well…"). Replace with named utility programs, HEEHRA rollout status, contractor density, climate quirks — one paragraph per state × per module.

---

## Phase 3 — deeper guide content (~30 days work)

Deferred from Phase 1 + Phase 2 of the guide-unification effort. Achievable in a focused session with editorial design support.

- **Inline SVG diagrams** for the 32 non-flagship guides. Each needs a custom diagram per topic. Examples: ductwork airflow loss illustration, water heater BTU/gal comparison chart, panel-amp-vs-loads load distribution, attic insulation R-value section view.
- **Custom callout cards** with topic-specific content. Examples: "Red flags when a contractor quotes your panel upgrade", "The $200 ductwork test that saves $4,000 on a heat pump install", "Why a Wi-Fi-enabled thermostat saves more than a smart panel".
- **Glossary cross-linking inside FAQ answers.** Every technical term that appears in `glossary.json` should auto-link to its glossary anchor on first mention. Currently a manual exercise; could be a Remark / Astro plugin.

---

## Phase 4 — engine + data refinements

- **Per-module CSV chunking.** Refactor `src/lib/data.ts` (435 LOC, ~50 `?raw` imports) into per-domain modules so calculators import only the data they need. Drops the ~104 KB shared bundle currently hydrated on every calculator page. Estimated work: 2–3 hours + careful testing across 38 calculators.
- **Live rebate refresh script.** A quarterly automated script that reads DSIRE + AFDC + state energy office RSS feeds and flags rebate rows whose `last_reviewed` date is > 90 days old. Email-style summary to the maintainer for manual verification.
- **`labor_rate_usd` row in `ac-cost-ranges.csv` cleanup.** The AC calculator uses an inline `LABOR_RATE_USD` constant; the CSV has a `labor_rate_usd` row that's loaded but unused. Either wire it or drop the row.
- **Eliminate the `panel-risk-factors.csv` `value` column** referenced in type but absent in CSV (harmless but confusing).

---

## Phase 5 — monetization activation

Only flip these on after analytics data confirms ≥5,000 monthly sessions and ≥30% session duration > 60s. Sooner = no ROI; later = leaving money on the table.

- **Activate `PUBLIC_ADS_ENABLED=true`** in Vercel env. Empty `<AdSlot />` containers are reserved on every calculator + state page; they only render when this flag flips.
- **Apply to Mediavine Journey tier** (1,000 monthly sessions threshold). Once accepted, paste their snippet into `AdSlot.astro`.
- **Wire affiliate cards** in `AffiliateModule.astro` for the EV charger and HPWH categories first. Amazon Associates + Lectron + EVBASE — already FTC-disclosed via the existing `AffiliateDisclosure` component. Set `PUBLIC_AFFILIATES_ENABLED=true` in Vercel.
- **Contractor lead form (state pages only).** Optional and only if the no-funnel stance is revisited. If activated: Modernize / Networx widget on the state-programmatic pages (not the main calculator pages, which preserve the "no funnel" brand).
- **Sponsored content from utility / DOE programs.** Long sales cycle (3–6 months) but high-trust. Pursue once a state page or guide is ranking #1–3 for its target query.

---

## Phase 6 — content depth + new niches

- **New flagship calculators:** smart water meter, EV battery health, home energy storage TCO, geothermal ground-loop sizing.
- **Per-state pages for the remaining modules** that don't have them yet: AC, mini-split, geothermal, ductwork, insulation, windows, generator, battery, water heaters (tank + tankless). 51 each × 10 modules = +510 URLs.
- **Per-fuel guides:** "Heating with oil in 2026", "Heating with propane in 2026", "Heating with natural gas in 2026". Each compares the user's current fuel cost against the heat-pump alternative state by state.
- **Year-over-year archives:** "Heat pump cost in 2025 vs 2026" type pages anchored to historical CSV snapshots. Differentiates the site from competitors who just say "2026 prices" without showing the trend.

---

## Possibly never (deliberately deferred)

These have been suggested or considered but explicitly are not happening:

- **Server-side rendering / API backend.** The site is fully static; the calculator math runs in the browser. Adding a server would invite complexity for no UX or SEO gain.
- **A CMS (WordPress / Sanity / Contentful).** CSVs in git + Astro pages cover everything a CMS would, with better audit ergonomics.
- **An account system.** No accounts. URL-hash state replaces "save your estimate."
- **Email newsletter.** Considered. Rejected for now — violates the no-funnel position. Would only reconsider with a strong editorial reason (like a quarterly "what changed in rebates" digest).
- **Mobile app.** The site IS the app. Mobile Lighthouse scores are already good. A dedicated app adds maintenance cost with marginal user benefit.
- **Forum or comments.** Out of scope. Would invite moderation cost and SEO-quality risk (UGC spam).
- **Native localization (Spanish, Portuguese, French).** Considered for v3 but not now. Calculator math is locale-neutral but the rebate landscape is entirely U.S.-specific. The right path is probably a sibling site under a different domain (electrifycost.es / .pt) rather than a multilingual variant of the existing site.
- **Open data API.** Not yet. The CSVs are public via the repo and via `/sources/`. A formal API would invite rate-limiting needs and breaking-change politics. Reconsider if 10+ users actually ask for one.

---

## Long-shot / experimental

- **Embeddable widget.** Single `<iframe src="...">` distribution so utility / HVAC sites can embed a calculator. Each embed is a backlink + brand impression. Significant effort to design the iframe shell + handle resize messages.
- **Comparison view (heat pump vs. furnace vs. dual-fuel over 15 years).** Side-by-side TCO with sticky scroll and a "Save scenario" URL hash. Differentiated content vs. competitors.
- **Manual J calculator.** A simplified residential load calculator (room-by-room, with insulation R-values, glazing area, infiltration ACH) that outputs recommended BTU/hr. Most ASHPs are oversized; this would be a real homeowner service.
- **NEC 220.83 load calculator.** Pair with the panel-upgrade calculator. Same logic: most panels are big enough; this would prove it.
- **AI Chat / Copilot.** Could let users describe their home in natural language ("1,800 sqft single-story in Texas with a 100A panel and propane heat") and route to the right calculator with pre-filled inputs. Adds infrastructure cost; would need to gate behind real traffic data.

---

Last reviewed: 2026-05-17.
