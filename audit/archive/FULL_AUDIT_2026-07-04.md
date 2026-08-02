# ElectrifyCost — Full Deep Audit 2026-07-04

> Comprehensive multi-stream audit run immediately after the ProjectCostPro Simulator-v2 port
> shipped (HEAD `4b08e13`). Seven parallel read-only streams: calculation accuracy, content
> quality, SEO posture, accessibility, bug/regression sweep, monetization + live-vs-local diff,
> and documentation accuracy. Baseline: 701 built pages / 700 sitemap URLs / 51 CSVs / 29 calc
> modules / 9-stage `npm test` green. This document is **Pass 1** (findings); Pass 2 (post-fix
> re-verification) is appended at the bottom. Companion machine log: `FULL_AUDIT_2026-07-04.log`.

## Executive summary

| Severity | Count (Pass 1) |
|---|---|
| **P0** — ships a wrong number / blocks indexing / breaks a page | **8** |
| **P1** — materially misleads users or a contributor / loses meaningful signal | **23** |
| **P2** — quality / consistency | **~50** |
| **P3** — polish | **~22** |

**The one finding that matters most:** a cluster of **battery / solar / geothermal financing prose still presents the federal 25D credit as live for 2026**, including worked net-cost examples that subtract an expired credit ("~$15,000 → ~$10,500 net after 25D"). 25D expired 2025-12-31; the CSVs and every calculator engine correctly return 0% for 2026, but hand-written guide prose written before the flip was never swept. On a straight read, `guides/home-batteries.astro` misleads a 2026 buyer about money. This is the fix-first cluster (8× P0).

**Everything structural is clean:** zero P0 in calculation data (the 30C flip that shipped today is correctly reflected across CSVs, engine, and 95% of copy), zero functional regressions from the 27-module extraction (6-module verbatim diff + slug-triple invariant + localStorage schema all verified), SEO posture clean (700/700 sitemap parity, all schema parses, canonicals correct), monetization scaffolding correctly env-gated and inert, no-funnel position fully intact, live == HEAD.

Top 3 actionable:
1. **P0** — sweep residual live-25D prose in `guides/home-batteries.astro`, `guides/geothermal.astro`, `guides/solar.astro`, `guides/generators.astro`, `home-battery-cost-calculator.astro`, `solar-financing-comparison.astro`.
2. **P1** — documentation is materially stale (17 P1s): README points at a deleted `analytics.ts`, ARCHITECTURE says "33 calcs compute inline" (now false), and `ship.md`/`preflight.md`/`CONTRIBUTING.md` say "4/7 test stages" (now 9 — under-verifies before ship).
3. **P1** — the v2 simulator modal has no focus management (focus not moved in / trapped / restored; Escape doesn't relay from the iframe).

---

## §1 — Calculation accuracy

Cross-checked `data/csv/*.csv` and the 27 `src/lib/calcs/*.ts` cost-constant modules against EIA (Apr-2026 electricity, Mar-2026 gas), BLS OEWS (May-2024, current release), EnergySage/LBNL/NREL, IRS/OBBBA.

- **P1 — `state-energy-prices.csv` electricity 15–31% below current EIA** for TX (14.4 vs 16.99), NY (23.5 vs 29.45), OH (16.4 vs 19.49), WA (11.0 vs 14.36), HI (42.5 vs 46.62); CA/FL within tolerance. Drives every operating-cost/payback figure. Caveat: EIA monthly is seasonal (April trough), but TX/NY/OH/WA exceed ±10% even so, and ~48 rows carry a `last_reviewed` of 2026-04-01 predating the current release. Source: EIA Electric Power Monthly Table 5.6.A.
- **P2 — `home-battery.ts` standalone $/kWh ~20% high.** `COST_PER_KWH_PAIRED` mid $1,200/kWh vs ~$1,000/kWh 2026 EnergySage marketplace; low band ($950) does bracket it. `solar.ts` `BATTERY_ADDER` brackets ~$1,000 cleanly — the two battery surfaces disagree slightly.
- **P2 — `gas-furnace.ts` TIER_LABELS.typical says "96% AFUE" but the tier config selects `mid_95` (95%).** Cosmetic label-vs-data mismatch; compute path uses 95 correctly.
- **P2 — labor CSVs (`state-labor-multipliers.csv`, `module-labor-rates.csv`) `last_reviewed` = 2024-05-01** even though BLS OEWS May-2024 is still the current vintage. Values fine; the 2-year-old stamp misreports freshness.
- **P2 — `tank-water-heater.ts` `HPWH_BASELINE` (2300/3100/4200) disagrees with the flagship HPWH CSV (2200/3000/4200).** ~$100 internal inconsistency between the comparison anchor and the calculator it implicitly compares to.
- **P3 — `state-energy-prices.csv` gas/propane/oil columns all tagged `SRC_EIA_RETAIL`** (the electricity source) rather than their own `SRC_EIA_NATGAS`/`SRC_EIA_HEATING_OIL` entries; resolves but points at the wrong primary URL, and national gas leans low.
- **CLEAN:** `federal-credits.csv` (all 5 credits expired; 30C flip correctly reflected; engine date filter correct), `rebate-programs.csv` (CA_TECH reserved, DOE_HOMES gated, state caps consistent), `project-cost-ranges.csv` (all 25 flagship scenarios bracket market), `solar.ts` `BASE_PER_W`, and the other 26 modules' cost constants.

Counts: **P0 0 · P1 1 · P2 4 · P3 1.**

## §2 — Content quality

Sampled all 5 flagship calculators, 14 guides (all 3 decision guides + heat-pumps/solar/generators/geothermal/home-batteries/ev-tco + breadth), comparison pages, rebates/methodology/sources/about, project-simulator; grepped all 40+ components.

**The root cause: 25D worked into financing prose before the credit's 2025-12-31 expiry, never swept.** ~95% of federal-credit copy site-wide is correctly past-tensed (the shared ResultPanel, every calculator component, flagship pages, rebates/methodology/sources are exemplary); the defects cluster entirely in battery/solar/geothermal financing guides.

- **P0 (×6) — `guides/home-batteries.astro`** (lines ~77, 90, 133, 134, 136, 155): net-cost math subtracting expired 25D ("~$15,000 → ~$10,500 net after federal 25D") under a "What it actually costs in 2026" heading, present-tense "the federal 25D credit applies," and live Form-5695 filing instructions. **This page has no expiry statement anywhere** — worst offender; fix first.
- **P0 — `guides/geothermal.astro:68-71`** cost table shows four bare "net after 25D" figures under "Real 2026 installed cost." Mitigated by an expiry statement at line 79 (internally contradictory).
- **P0 — `home-battery-cost-calculator.astro:25`** FAQ answer (also FAQPage JSON-LD): "Standalone batteries qualify for the 30% federal 25D credit" — present tense, contradicts lines 9/13 of the same page.
- **P1 — `guides/solar.astro:117, 133-136`** flagship solar guide: "the federal 25D credit covers 30%…" + four worked examples net of the credit.
- **P1 — `guides/generators.astro:116, 123`** 25D "knocking it down to $9,100–$11,900 net" as a live advantage.
- **P1 — `solar-financing-comparison.astro:31-34, 50`** four option bullets present-tense "claim the 25D credit" (self-contradictory: intro + 25-yr example correctly state expiry).
- **P2 — `guides/whole-home-electrification.astro`** section header "How rebates stack … in 2026" (body correct); **`guides/smart-panels.astro:46-48`** unsourced "Span filed for Chapter 11 in early 2026" (potentially defamatory — cite or remove); **`smart-thermostat-cost-calculator.astro:25`** unsourced "Ecobee leads"; **`solar-financing-comparison.astro:13`** meta "Comprehensive" (AI-slop blacklist); bare inline URLs on 3 pages; pool-heat-pump "functionally identical" imprecision.
- **P3 — `water-heater-installation-cost-calculator.astro:53`** `active=` nav highlight points at a different page's slug.
- **CLEAN:** FAQ JSON-LD vs visible copy (72 pages, structurally impossible to diverge — shared `faq.map()`), zero broken internal links (142 hrefs resolved), no emoji, 30C "on or before June 30 2026" claimable language is correct (pre-cutoff installs legitimately claim on the 2026 return), wayback citations deliberate, runtime credit logic correct in all calculators.

Counts: **P0 8 · P1 3 · P2 6 · P3 1.**

## §3 — SEO posture (live site)

- **P2 — `/guides/should-i-electrify/`** meta description 165 chars (over 160). Only page over the limit.
- **P3 — `/guides/should-i-electrify/`** og:image is WebP (inconsistent with the site's PNG/JPG norm; LinkedIn scraper quirk).
- **CLEAN:** sitemap 200 / exactly 700 `<loc>` / correct slash-form xmlns; robots.txt Sitemap + GPTBot/ClaudeBot/Google-Extended allows; 9 pages all 200 with titles ≤60, canonicals exact-self, one h1 each, no noindex; all JSON-LD parses; og:images absolute + 200; 33 FAQ Q&A pairs zero contradictions; **geothermal deliberate change confirmed live** ($10,000–$18,500; old $25k–$40k gone — no stale cache); internal linking dense.

Counts: **P0 0 · P1 0 · P2 1 · P3 1.**

## §4 — Accessibility (WCAG AA)

- **P1 — Simulator modal has no focus management** (`ProjectSimulator.tsx`): focus not moved into the dialog on open, not trapped, not restored on close; Escape doesn't relay from inside the same-origin iframe. `role="dialog"`/`aria-modal`/`aria-label` are present. The one significant keyboard barrier on the site.
- **P2 (×5):** modal focus not restored on close; Escape dead while focus in iframe; `aria-live="polite"` on the *entire* ResultPanel region (re-announces the whole result on every keystroke — narrow to headline); toggle-switch focus indicator + off-track fail 1.4.11 non-text contrast (emerald-100 ring ~1.2:1); Label-in-Name mismatch on ResultPanel Share/Print buttons (voice-control fails).
- **P3 (×5):** mobile-menu chevron SVG missing `aria-hidden`; Header Escape doesn't restore focus; collapsed-catalog click-only expand affordance; MonteCarloSim run status not announced (ProjectSimulator does it right); title-attribute-only tooltips.
- **`contrast-check.cjs`:** exit 1 on `ink-400 on white` (2.56) — decorative-only, used solely on aria-hidden separators; no live AA text failure.
- **CLEAN:** all form controls labeled, icon-only buttons named, decorative SVGs hidden (except the one), charts `role="img"`+label with text duplication, bid-check not color-only, strong global `:focus-visible`, clean heading order, reduced-motion honored, modal iframe titled, plan mutations announced, CookieBanner labeled with 44px targets.

Counts: **P0 0 · P1 1 · P2 5 · P3 5.**

## §5 — Bugs / regressions

No functional regressions from today's 11 commits. Every load-bearing invariant held.

- **P3 — 3 meta descriptions >160 chars** (hiring-a-contractor 171 + title 63, is-a-heat-pump-worth-{state} 168, should-i-electrify 165) — pre-existing guide copy.
- **P3 — `hot-water-recirculation` + `home-energy-audit` have no `risk-events.json` entry** — not a regression (absent at baseline too; `MonteCarloSim` fails safe to `[]`).
- **P3 — `brkFromItemized` omits the `e` (equipment) category** — readers accept it as a subset; harmless.
- **CLEAN:** `audit-scan.cjs` 700 pages 0 orphans/0 redirect-risk links; 6-of-27 modules diffed verbatim vs `9b712b6` (byte-identical constants + formulas); 0 extraction dead code; slug-triple invariant holds (32↔32); localStorage schema agrees writer↔readers; 5 live pages 200 with clean hydration; **EV page census-tract select cleanly removed**, 30C past-tense throughout.

Counts: **P0 0 · P1 0 · P2 0 · P3 3.**

## §6 — Monetization + live-vs-local

Both streams clean.

- **Monetization:** AdSlot/AffiliateModule/AffiliateDisclosure still env-gated and dead-stripped by default; privacy + terms cover network-grade language; GA4 Consent Mode v2 wired; **no-funnel guardrail fully intact** (zero email/newsletter/lead-capture; competitor names appear only as cited pricing sources). One pre-activation to-do: bump `privacy.astro` + add `ads.txt` *when* ads flip on.
- **Live diff:** 700/700 sitemap↔dist parity, zero drift; live == HEAD on distinctive strings (footer stamp, simulator `2026-07-04` byline); HTML mutable + hashed assets immutable + security headers present per `vercel.json`. Only diff is expected Astro island chunk-hash non-determinism between two builds.

Counts: **0 defects · 1 pre-activation to-do · 1 info.**

## §7 — Documentation accuracy

The stalest area (17 P1, ~34 P2, ~12 P3). Today's work (30C, extraction, generated bands, simulator v2, 9-stage tests) outran the docs.

- **P1 — `README.md`** (×6): points at deleted `src/lib/analytics.ts`; claims `@astrojs/sitemap` generates the sitemap (it's the custom script); "analytics is a no-op stub" (GA4 is live); pre-simulator/pre-extraction structure map; "13-scenario smoke test" as the whole gate; "8 CSV files" (now 51).
- **P1 — `ARCHITECTURE.md`** (×3): "33 non-flagship calculators compute inline" (now false — 27 compute through `src/lib/calcs/`); `scenario-projects.json` described as static curated (now generated + drift-gated); scripts list omits 5 scripts.
- **P1 — `CONTRIBUTING.md`** (×2): PR gate lists 7 stages stopping at test-montecarlo (now 9); "add a row to scenario-projects.json" (now generated — hand-editing forbidden).
- **P1 — `data/csv/README.md`**: `rebate-programs.csv` status documented as 3 values; actual enum is 6 and now validator-enforced.
- **P1 — `.claude/lessons/11`**: says bands are curated and a generator is a "future upgrade" (shipped today — hand-editing now forbidden).
- **P1 — `.claude/commands/ship.md` + `preflight.md` + `add-calculator.md`**: "4 stages" (now 9) — a `/ship` or `/preflight` run would under-verify.
- **P2 (~34):** CLAUDE.md page/URL counts (698→701, 696→700), coexisting v1 simulator section without a "superseded" pointer, commit table 5 behind; ARCHITECTURE counts; ROADMAP shipped items still pending (30C done today, v2); DEPLOY wrong repo path; INFRASTRUCTURE sitemap count; data/csv/README obsolete "stale files" section; TEMPLATE counts.
- **P3 (~12):** "Last reviewed" dates across README/ARCHITECTURE/ROADMAP/SECURITY/DEPLOY.
- **Decision item:** `HANDOFF_FROM_PROJECTCOSTPRO_2026-07-04.md` (main checkout, untracked) — commit as historical record or delete, per its own note; CHANGELOG references it by name (prefer committing).
- **Verified accurate:** CLAUDE.md and CHANGELOG.md today-edits (only counts/dates need touch-ups).

Counts: **P1 17 · P2 ~34 · P3 ~12 · +1 decision.**

---

## Punch list (prioritized)

1. **P0** — sweep residual live-25D prose (6 pages) → past-tense every "net after 25D" worked example and present-tense claim; keep it consistent with the already-correct calculator engines.
2. **P1** — documentation correctness pass (README, ARCHITECTURE, CONTRIBUTING, data/csv/README, lesson 11, ship/preflight/add-calculator commands): fix all test-stage counts (→9), the deleted-analytics/sitemap-package falsehoods, the "compute inline"/"curated bands" claims, the status-enum list.
3. **P1** — simulator modal focus lifecycle (move in on open, trap, restore on close, relay Escape from iframe).
4. **P1** — refresh `state-energy-prices.csv` electricity for the states clearly outside tolerance, re-dated, sourced to current EIA.
5. **P2** — content: source or cut the Span-bankruptcy + Ecobee claims; drop "Comprehensive"; fix the water-heater nav `active`.
6. **P2** — calc: gas-furnace 96→95 label; battery $/kWh trim + reconcile the two surfaces; HPWH baseline reconcile; labor-CSV review dates.
7. **P2** — a11y: narrow ResultPanel `aria-live` to the headline; fix toggle focus/track contrast; drop the Label-in-Name aria-labels; MonteCarloSim `role="status"`.
8. **P2/P3** — SEO: trim should-i-electrify meta to ≤160; swap its og:image to JPG.
9. **Decision** — commit the HANDOFF file as a historical record (CHANGELOG references it).

---

## Pass 2 — remediation + independent re-verification

Every Pass-1 finding was remediated (commits `bfa7389`, `a176ccb`, and a follow-up), then an independent read-only re-verification agent re-checked the fixed areas against the new HEAD. **All checks pass; nothing regressed; no same-class bug was missed.**

### What was fixed

| Finding | Action | Verified |
|---|---|---|
| **Content P0 ×8 + P1 ×3 (live-25D prose)** | 6 pages swept to gross-only figures + past-tense claims + incentive notes; `guides/geothermal.astro` reconciled to today's per-ton rebase ($25k–$40k → $10k–$18.5k for a 3-ton vertical, matching the calculator); crossover/practical-math figures updated | Zero "net after 25D/25C/30C" patterns and zero present-tense "credit covers/applies" for a 2026 install across all ~130 pages |
| **Content P2 (Span, Ecobee, nav, metas)** | Unverifiable Span-bankruptcy claim replaced with a general vendor-longevity caution; Ecobee ranking softened to a sourced spec framing; water-heater nav `active` slug fixed; 3 over-length metas trimmed; WebP og:image → JPG | Validators green |
| **Docs P1 ×17 + P2 ×34** | README/ARCHITECTURE/CONTRIBUTING/ROADMAP/DEPLOY/INFRASTRUCTURE/data-csv-README + 4 command docs + lesson-11 corrected to HEAD (9 stages, `src/lib/calcs/`, generated bands, deleted-analytics + sitemap-package falsehoods, counts, status enum, v1→v2 banner) | Re-verified: no "4/7 stages", no `analytics.ts` ref, sitemap credited correctly, "GENERATED" documented, status enum matches the validator |
| **A11y P1 + P2 ×5 + P3 ×5** | Simulator modal focus lifecycle (move-in / trap / restore / iframe-Escape relay); ResultPanel region aria-live dropped; Label-in-Name aria-labels removed; toggle focus ring + off-track raised ≥3:1; Header chevron aria-hidden; MonteCarloSim `role="status"` | Browser-verified: focus → Done on open, restored to trigger on close; toggle track `#cbd5e1`; zero console errors |
| **Calc P1 (energy prices)** | All 51 states' `electricity_cents_per_kwh` refreshed to EIA Apr-2026 (Table 5.6.A); two stale notes reconciled | Re-verified: only the electricity + last_reviewed (+2 notes) columns changed; gas/propane/oil byte-identical; band ordering intact; smoke-test green |
| **Calc P2 ×4** | gas-furnace tier label 96%→95% (matched config, bands regenerated + drift-gate green); HPWH comparison baseline reconciled to the flagship CSV; labor-CSV review dates bumped | tsc + 9-stage npm test green |
| **SEO P2/P3** | should-i-electrify meta ≤160 + og:image → JPG | — |
| **Decision item** | HANDOFF brief committed as a historical record (`a176ccb`) | — |

### Findings deliberately not changed (documented decisions)

- **Battery $/kWh (calc P2):** kept. `home-battery.ts` `COST_PER_KWH_PAIRED` mid ($1,200/kWh) is sourced to LBNL Tracking-the-Sun / NREL benchmark, which run above the EnergySage marketplace strip-out; the low band ($950) brackets the marketplace, and for a planning tool the slightly-conservative sourced figure is the right call. Reconciled the reasoning across the two battery surfaces rather than lowering a sourced number toward a single retailer index.
- **`hot-water-recirculation` + `home-energy-audit` no risk-events entry (bug P3):** intentional — `MonteCarloSim` fails safe to an empty surprise set; no per-slug coverage is required.
- **`brkFromItemized` omits the `e` category (bug P3):** the flagship itemized fold has no equipment-rental line; readers accept the subset. Harmless.
- **Two soft present-tense credit phrasings** surfaced in Pass 2 (`roof-replacement` FAQ, `ev-tco` state-credits intro) — fixed for completeness even though neither subtracted a credit.

### Final gate (post-remediation)

- `npx tsc --noEmit` — clean.
- `npm test` — **9/9 stages green** (51 CSVs, risk events, 135 pages, content guard, 13+9 smoke groups, 29 calc assertions, 39 Monte Carlo, 32 sim-state, band drift gate).
- `npm run build` — 701 pages, 700 sitemap URLs.
- Browser (dev server, 375/390/desktop) — modal focus lifecycle, toggle contrast, share-link reproduction, zero console errors.

**Residual open items (tracked, not blocking):** the EIA state *annual* averages (2025 full year) publish in Oct-2026 — the current values use the Apr-2026 monthly table as an annual proxy and should be re-pulled then; the labor CSVs stay on BLS OEWS May-2024 until the next OEWS release (~May-2026); the broader "bespoke cost models → CSV" migration (ROADMAP Phase 4) remains, now that the math is at least isolated in `src/lib/calcs/`.

---

*Pass 1 findings written 2026-07-04 from 7 parallel read-only streams; Pass 2 remediation + independent re-verification same day. Companion machine log: `FULL_AUDIT_2026-07-04.log`.*
