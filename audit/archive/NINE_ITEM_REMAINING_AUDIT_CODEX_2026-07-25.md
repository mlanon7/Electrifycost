# ElectrifyCost - Nine-Item Remaining Audit

Date: 2026-07-25  
Auditor: Codex  
Scope: live site (`https://electrifycost.com`), active project folder, latest pushed/fixed worktree, audit history, calculators, UI, SEO, traffic, monetization, and trust/content accuracy.

## Bottom Line

The live site is not broken. The current production surface has the major July fixes: 700 sitemap URLs, 30C past-tensed in calculator/rebate copy, Project Simulator v2, generated simulator bands, passing tests in the latest worktree, no sampled console errors, no sampled broken images, no sampled unlabeled controls, and no orphan/meta/internal-link issues.

The main thing left is operational: **the active local folder is stale and split from the fixed branch.** This folder is on `main` at `6e1416f`, **18 commits behind `origin/main`**, with additional uncommitted June 29 content corrections. It fails `npm test` today because stale 30C assertions expect a credit that is now expired. The newer worktree at `.claude/worktrees/crazy-almeida-15dd08` passes the full expanded test suite and builds cleanly. Do not deploy from the active folder until the two change sets are reconciled.

The highest-traffic-impact work is still not more broad content editing. It is authority and distribution: the July 24 traffic audit shows the site is technically healthy but authority-gated, with too many programmatic pages for the current backlink base. Push the Project Simulator as the linkable asset, deepen only the pages already getting impressions, and pause further programmatic expansion.

## What I Verified

- Active folder: `git status`, branch/worktree state, diffs, `npm test`, `npx tsc --noEmit`, `node scripts/check-links.cjs`, `npm audit --omit=dev`.
- Latest fixed worktree: `npm test`, `npx tsc --noEmit`, `npm run build`, `node scripts/check-links.cjs`, `node scripts/audit-scan.cjs`, `node scripts/contrast-check.cjs`.
- Live site: sitemap fetch, selected page metadata/content checks, browser UI checks on homepage, Project Simulator, heat pump calculator, EV charger calculator, contractor guide, and start guide.
- Traffic evidence: local Search Console export plus `audit/TRAFFIC_AUDIT_2026-07-24.md`.
- Current source checks: IRS 30C page, IRS OBBBA FAQ, FTC contractor advice, EPA charger calculator, SERP competitor sampling.

## P0 / Release Safety

### P0-1 - Active Folder Is Stale And Fails Tests

Evidence:

- Active folder: `main` at `6e1416f`; `origin/main` is `9c0c998`; `claude/crazy-almeida-15dd08` is `77cdced`.
- `git diff HEAD..origin/main` spans the July 30C expiry flip, Project Simulator v2, generated bands, source URL repairs, docs cleanup, and audit archive changes.
- Active-folder `npm test` fails the 30C targeted assertions:
  - `30C unknown -> potential only` fails because current date now excludes the credit.
  - `30C yes -> applied` fails for the same reason.
- Latest fixed worktree `npm test` passes the expanded 9-stage gate, including:
  - 30C historical vs post-expiry behavior.
  - 29 calculator assertions.
  - 39 Monte Carlo assertions.
  - 32 simulator state assertions.
  - scenario band drift check.

Recommendation:

1. Reconcile the active folder with the latest fixed worktree / `origin/main`.
2. Port the useful uncommitted June 29 content polish from the active folder into the latest branch.
3. Rerun `npm test`, `npx tsc --noEmit`, `npm run build`, and `node scripts/check-links.cjs`.

This is the most important non-SEO item because it prevents accidental regression if someone ships from the wrong checkout.

## 1. Federal Incentive Expiration Refresh

Status: mostly fixed on live/latest branch; stale in active folder.

What is correct now:

- IRS says 30C is not allowed for property placed in service after June 30, 2026.
- Latest worktree marks `FED_30C_EVSE` expired and tests both historical and post-expiry behavior.
- Live sampled pages use expired/past-tense 30C language on homepage, rebates, methodology, EV charger calculator, EV charger by-state, EV charger guide, and Project Simulator.

Remaining issues:

- **P1:** live `/sources/` still shows source-note text: `Personal use 30% up to $1000 through 2026-06-30 in eligible census tracts`. It is historically true but reads less cleanly than the rest of the post-expiry copy. Change to: `Covered 30% up to $1,000 for qualifying personal-use property placed in service through 2026-06-30; expired after that date.`
- **P0 if active folder is used:** active local CSV still marks 30C `active`; do not deploy that state.

## 2. Search Console / GA4 Truth Audit

Status: partially available from local export and prior traffic audit; live connector unavailable in this Codex session.

Local export summary:

- 150 query rows.
- 438 impressions.
- 0 clicks.
- Query clusters by impressions:
  - heat pump: 280
  - solar: 76
  - heat pump water heater: 47
  - EV charger: 13
  - sump pump: 8
  - other: 14

Closest query opportunities in the local export:

- `department of energy heat pump water heater cost installed` - 3 impressions, position 9.3
- `average cost to install heat pump water heater us 2025` - 2 impressions, position 12
- `sump pump battery backup cost` - 4 impressions, position 15
- `heat pump cost oregon` - 7 impressions, position 24.9
- `heat pump replacement` - 8 impressions, position 30.9

The July 24 traffic audit is the stronger evidence source. It reports no penalty/deindexing, but a real mid-June Google impression decline and a Bing zero-impression problem after July 2. Its conclusion is right: the site is authority-gated, not content-gated.

Recommendation:

- Do not chase broad head terms first.
- Deepen pages already appearing in GSC, especially HPWH install cost, heat pump replacement, Oregon heat pump cost, and sump battery backup.
- Use GA4 and GSC as truth; treat Ahrefs Web Analytics as noisy because the July audit found heavy bot/direct noise.

## 3. Competitor SERP Audit

Status: traffic opportunity exists, but Google is rewarding authority and calculators from established domains.

SERP samples show:

- EV charger queries are crowded by EPA, EnergySage, Qmerit/installer content, Blink, CarMax, and local electricians.
- Whole-home/electrification planner queries surface Rewiring America, Aurora Solar, utility/program tools, and established energy organizations.
- Panel-upgrade cost queries surface Homewyse, electricians, and generic home-improvement publishers.
- Heat-pump operating-cost queries often surface utilities, Mass Save, Efficiency Maine, EPRI, ENERGY STAR, and state/regional tools.

ElectrifyCost's differentiation remains good: no funnel, source-cited, multi-project Monte Carlo, state-aware calculators, and transparent uncertainty. But Google will not reward that fully until the authority gap narrows.

Recommendation:

- Lead outreach with `/project-simulator/`, not a static calculator.
- Build one data-backed linkable page: `What Federal Home Energy Credits Still Exist in 2026?` or `Home Electrification Cost Benchmarks by Project Type`, sourced to the existing CSVs and IRS/DOE pages.
- Avoid publishing more broad programmatic pages until existing high-intent pages earn links or impressions.

## 4. Internal Linking / Crawl Depth

Status: technically clean, strategically heavy.

Latest fixed build:

- `node scripts/audit-scan.cjs`: 700 pages, 0 orphan pages, 0 meta descriptions over 160, 0 titles over 60, 0 internal trailing-slash redirect risks.
- Live sitemap: 700 URLs, status 200.

Remaining strategic issue:

- The July traffic audit identified roughly 580 template/programmatic pages against only 2 real referring domains. That page-count-to-authority ratio is likely hurting indexation and Bing visibility.

Recommendation:

- Pause new programmatic page sets.
- Consider consolidating or noindexing the thinnest 200 city pages if GSC confirms they remain discovered/crawled but not indexed.
- Keep state pages and brand pages if they show real impressions or local differentiation.
- Add more contextual internal links from the decision guides to the highest-impression long-tail pages, not just calculator hubs.

## 5. Calculator Credibility

Status: latest branch is strong; data architecture still has a governance gap.

What is strong:

- Latest `npm test` passes calculator smoke tests, federal-credit assertions, Monte Carlo tests, simulator state tests, and generated-band drift checks.
- Project Simulator bands are generated from real calculator compute functions.
- 30C is no longer subtracted after expiration.
- Browser sampling found no console errors, no broken images, and no unlabeled controls.

Remaining issues:

- **P2:** Most bespoke calculator cost tables now live in pure TS modules under `src/lib/calcs`, which is a big improvement over inline component math, but it still violates the ideal CSV-first rule. The roadmap correctly keeps this as Phase 4.
- **P2:** `data.ts` still imports all 51 CSVs into the shared client data chunk. The July 5 audit called this the top CWV/code-health lever.
- **P3:** Result-panel consistency still varies outside the 5 flagships; the shared `ResultPanel` is not yet universal.

Recommendation:

- Do not retune calculator numbers casually. The current drift gate is valuable.
- Migrate one bespoke calculator family at a time from TS cost tables to CSV with snapshot tests.
- Split `data.ts` by module once the active-folder reconciliation is done.

## 6. Monetization

Status: correctly restrained.

What is clean:

- `AdSlot`, `AffiliateModule`, and `AffiliateDisclosure` are env-gated.
- Rendered fixed build has no ad slots by default.
- No email gate, lead form, newsletter pop-up, or contractor-referral funnel found.
- Privacy/terms and cookie consent are present; GA4 Consent Mode v2 is present globally.

Remaining monetization cautions:

- Traffic is still too low for display ads to matter.
- Activating affiliate modules before traffic and trust are stronger risks making the site feel less independent.
- If ads turn on later, add/verify `ads.txt` and update privacy copy at the same time.

Recommendation:

- Keep monetization off for now.
- If anything is added before ads, the least trust-damaging option is a non-gated downloadable/printable project report, already aligned with Project Simulator output.
- Do not add lead-gen unless the no-funnel position is deliberately abandoned.

## 7. Topical Authority Gaps

Status: the June/July guide additions solved the biggest navigation gap, but the next content should be evidence-driven.

Good additions already live:

- `/guides/should-i-electrify/`
- `/guides/is-a-heat-pump-worth-it/`
- `/guides/hiring-a-contractor/`
- `/project-simulator/`

Remaining opportunities:

- Heat pump replacement cost: already appearing in query data.
- HPWH installed cost: closest ranking opportunity in the local export.
- EV charger permit content: strong practical intent; avoid generic national claims by using state/city examples and primary permitting sources.
- Electrical panel load management: ties directly to avoiding unnecessary panel upgrades.
- Federal incentive history/current-status page: timely, source-backed, and likely linkable after OBBBA.
- Real-install validation/case-study page: even a small anonymous sample of actual bid vs calculator range would strengthen trust.

Recommendation:

- Create fewer, deeper pages.
- Start with the pages GSC already shows, not a new keyword wish list.
- Link every new page into the Project Simulator and the relevant calculator result panel.

## 8. Accessibility / Core Web Vitals / UI

Status: good, with a few known follow-ups.

Verified:

- Live sampled pages: no console errors/warnings.
- Live sampled pages: no broken images.
- Live sampled pages: no unlabeled controls in browser DOM.
- Forced horizontal scroll probe: the 8px scroll-width excess on simulator/calculator pages is clipped and not user-scrollable (`window.scrollX` remains 0).
- Latest fixed build: 701 pages built; 700 sitemap URLs.

Remaining issues:

- **P1/P2:** `npm audit --omit=dev` reports 9 production advisories, including high-severity Astro dependency advisories. The static deployment lowers practical exposure, but this still deserves an Astro upgrade plan.
- **P2:** `node scripts/check-links.cjs` in the latest fixed worktree reports 2 dead URLs:
  - `https://www.grundfos.com/us/products/comfort` in `guides/hot-water-recirculation.astro` - likely a real replacement needed.
  - `https://analytics.ahrefs.com` in `Layout.astro` - likely a checker false positive against the preconnect/root host; either skip-list the root host or have the checker validate `analytics.js`.
- **P3:** `contrast-check.cjs` still prints `ink-400 on white` as a fail, documented as decorative-only. Keep it documented or make the script ignore decorative-only pairs to avoid audit noise.

## 9. Trust / E-E-A-T Layer

Status: strong, but there are a few wording/merge issues.

What is strong:

- Real author identity and credential disclaimer.
- Methodology and sources pages.
- Planning-ranges-not-bids framing.
- Visible no-funnel position.
- Source IDs, review dates, and primary-source links.

Remaining issues:

- **P1:** The live/latest contractor guide still includes over-categorical language that the active local folder has already corrected:
  - `Reading a scope of work and a bid is squarely within engineering practice`
  - `NEC 220.83` as the universal panel load calculation reference
  - broad warranty/insurance consequences for unlicensed work
  - `the difference is almost always in scope, not markup`
- **P1:** The live/latest start guide still leads with `for most homeowners, yes`, while the active local folder has a more defensible version: `for many homeowners it is worth evaluating on the normal replacement cycle`.
- **P2:** `/sources/` source-note wording for 30C should be made historical.

Recommendation:

- Port the active folder's June 29 content corrections into the latest branch before the next deploy.
- Keep contractor/legal/payment language jurisdiction-qualified.
- Keep electrification decision copy conditional, not promotional.

## Open Findings By Priority

| Priority | Finding | Recommended action |
|---|---|---|
| P0 | Active folder is behind fixed branch and fails `npm test` | Reconcile before any deploy or further broad edits |
| P1 | 30C source-note wording still reads too present-tense on `/sources/` | Update `IRS_30C.notes` to explicit expired/historical wording |
| P1 | Live contractor/start guides missed the prior local precision edits | Port the active folder guide diffs into latest branch |
| P1 | Authority/backlink gap is the traffic bottleneck | Promote Project Simulator; earn 5-10 real editorial links |
| P1 | npm audit has 9 production advisories | Plan Astro/dependency upgrade in a dedicated branch |
| P2 | Latest link checker still finds Grundfos dead URL | Replace with a verified live source or remove |
| P2 | Programmatic footprint may exceed authority | Pause expansion; consider city-page consolidation after GSC review |
| P2 | `data.ts` ships all CSVs to every calculator island | Split into per-module data imports |
| P2 | Bespoke calculator cost tables remain in TS | Migrate to CSV gradually with drift/snapshot tests |
| P3 | Contrast script reports decorative-only fail | Document or tune script to reduce false-positive audit noise |

## Highest-Impact Next Moves

1. **Reconcile branches/worktrees first.** This is the one operational risk.
2. **Fix the three small live leftovers:** `/sources/` 30C note, contractor/start-guide wording, Grundfos link.
3. **Run the full gate on the reconciled branch.**
4. **Do an authority push, not a page-count push:** outreach around Project Simulator, plus one source-backed linkable federal-incentive status page.
5. **Use GSC to pick the next three content improvements:** HPWH installed cost, heat pump replacement, Oregon heat pump cost / regional heat pump pages are better bets than generic head terms.

## Sources Consulted

- IRS 30C page: https://www.irs.gov/credits-deductions/alternative-fuel-vehicle-refueling-property-credit
- IRS OBBBA FAQ: https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb
- FTC contractor advice: https://consumer.ftc.gov/articles/how-avoid-home-improvement-scam
- EPA home EV charger calculator: https://www.epa.gov/greenvehicles/home-ev-charger-calculator
- Rewiring America planner: https://homes.rewiringamerica.org/calculator
- ElectrifyCost traffic audit: `audit/TRAFFIC_AUDIT_2026-07-24.md` in the latest worktree
- ElectrifyCost July full audits: `audit/FULL_AUDIT_2026-07-04.md`, `audit/FULL_AUDIT_2026-07-05.md`

