# ElectrifyCost — Full Deep Audit 2026-07-31

> Third full-site audit in the July series, and the first with a week of hindsight on the
> 2026-07-24 traffic work. Sources: Google Search Console, Bing Webmaster Tools and the Ahrefs
> dashboard (all via the signed-in browser — the Ahrefs **API** remains unusable, the account is
> Basic and every endpoint returns `Insufficient plan`), plus the full local gate and direct live
> probes. Baseline: branch `77cdced`; shipped as `2b3ac46`.

## Executive summary

Google is **quietly improving**. Bing is **still at absolute zero** — now 27 consecutive days. The
site itself is healthy: 9/9 gate, clean types, 701 pages, no orphans, no broken internal links.

The headline finding is not about ElectrifyCost in isolation. It is the **portfolio comparison**,
which forces a real revision of the "authority-gated" diagnosis I have been running with since
2026-07-24. See §3 — it is the most decision-relevant thing in this report.

| Area | Status |
|---|---|
| Google (GSC) | 0 clicks / 226 impressions / **position 39.9** (was 49.6) — improving |
| Bing | **0 impressions Jul 2 → Jul 28**, 27 straight days |
| Bing sitemap | **Was de-registered — re-submitted 7/31, now "Processing"** (§2.1) |
| Local gate | 9/9 green, `tsc` clean, 701 pages / 700 sitemap URLs |
| Dependencies | 9 advisories → **5** (remaining need a breaking Astro 7 major) |
| Content P1s | **All fixed and shipped** (§5) |

---

## §1 — Google: slow recovery from a very low base

| Window | Clicks | Impressions | Avg position |
|---|---|---|---|
| 90 d (to Jul 22, measured 07-24) | 28 | 6,450 | 51.2 |
| 28 d (Jun 25 – Jul 22, measured 07-24) | 0 | 198 | 49.6 |
| **28 d (Jul 2 – Jul 29, measured today)** | **0** | **226** | **39.9** |

Position has moved **51.2 → 49.6 → 39.9** across three readings, and impressions per day are up
(~7/day → ~8/day) on a window that now excludes the pre-collapse period entirely. That is a genuine,
if slow, upward trend.

Clicks remain 0, which is arithmetic rather than a defect: position ~40 is results page 4. Top
queries are the right commercial ones — `heat pump water heater cost` (12), `heat pump replacement
cost` (12), `heat pump cost` (10) — all at 0 clicks.

## §2 — Bing: still zero, and one regression I caused

Impressions are **exactly 0 every day from July 2 through July 28** — 27 consecutive days. The
2026-07-24 recovery actions (IndexNow re-ping of 700 URLs, URL Submission of 10 key pages) changed
nothing, exactly as §3.2 of the 07-24 audit predicted they would not.

### §2.1 — The sitemap was de-registered (regression, now fixed)

On 07-24 Bing showed **2 sitemaps registered, both "Success"**, last crawled Jul 20/22. Today:

- Home screen: *"Your site does not have a sitemap or we are not aware of it."*
- Sitemaps table: **0 rows** ("No data found"), while the stale summary counters still read
  "Known sitemaps 2 / 1.4K URLs discovered".

The site's own sitemap is fine — apex returns **200, 131 KB, `application/xml`, 700 URLs**, correct
`sitemap/0.9` namespace, declared in robots.txt.

**Probable cause: my own 07-24 change.** `www.electrifycost.com/sitemap.xml` was one of the two
registered sitemaps. Changing `www` from a 307 to a **308 permanent** redirect tells Bing that
sitemap URL is permanently gone, and it appears to have de-registered it — plausibly taking the
apex entry with it in the same re-evaluation. Bing's ongoing de-indexing of the site is a confound,
so this is not proven, but the timing and mechanism line up and I am recording it as self-inflicted
rather than assuming otherwise.

**Fixed:** re-submitted `https://electrifycost.com/sitemap.xml` on 2026-07-31 (status: Processing).
Only the apex was submitted — re-registering the `www` URL would recreate the problem, since it now
permanently redirects.

The 308 itself is still correct and stays. The lesson is narrower: **when a host starts permanently
redirecting, de-register its sitemap in Bing deliberately rather than letting Bing infer it.**

### §2.2 — Bing is now explicitly warning about the IndexNow batch

New recommendation, not present on 07-24:

> *"Avoid IndexNow Batch Mode to prevent excessive server load and potential indexing delays."*

This is a direct response to the 700-URL batch submitted on 07-24. The submission script's own
header warns about this, and I proceeded anyway on the reasoning that a re-inclusion attempt
justified it. Bing disagrees, and says it can *cause indexing delays*. **Do not re-run
`indexnow-submit.cjs` against the full sitemap again** — new/changed URLs only.

## §3 — The portfolio comparison that revises the diagnosis

Ahrefs dashboard, all four sibling sites, same account, same 30-day window:

| Site | DR | Referring domains | Total visitors | Organic traffic | Organic keywords |
|---|---|---|---|---|---|
| **Electrifycost** | **2** | 424 (+171) | 251 (+34) | **0** | **0 (−1)** |
| Projectcostpro | 1 | 385 (+170) | 934 (+712) | 0 | 4 (+3) |
| **Petplanwise** | **0** | 419 (+178) | 815 (+401) | **28 (+17)** | **25 (+16)** |
| Firstyearcost | 0 | 412 (+167) | 6 | 0 | 0 |

**PetPlanWise has DR 0 — lower than ElectrifyCost — and a near-identical referring-domain profile
(419 vs 424, both +~170 in 30 days, both scraper-grade). It is gaining organic keywords (+16) and
real organic traffic (28). ElectrifyCost has zero of both.**

This does not fit a pure authority explanation. If backlink authority were the binding constraint,
the DR-0 site with the same link profile would not be outperforming the DR-2 site. Two candidate
explanations remain, and they are not mutually exclusive:

1. **Niche competitiveness.** Home-electrification cost queries are among the most contested
   commercial SERPs on the open web — EnergySage, Angi, Modernize, This Old House, Forbes Home,
   plus utility and government tools. Pet-care cost queries are far less defended. Identical
   authority buys page-1 presence in one niche and page-4 in the other.
2. **Page-count-to-authority ratio.** ElectrifyCost carries **~701 pages, ~580 of them programmatic
   template variations**. PetPlanWise carries 292. Per unit of authority, ElectrifyCost is asking
   search engines to index and trust roughly 2.4× as many near-template pages.

**Revised conclusion:** the 07-24 audit's "authority-gated" framing was directionally right but
incomplete. Backlinks alone will not fix this, because a sibling with the same backlinks is already
ranking. The differentiators are **niche difficulty** (structural, can only be answered with genuinely
differentiated content) and **the thin-page ratio** (fully within our control).

That materially raises the priority of consolidating the programmatic footprint relative to pure
link-building — the opposite of the weighting in the 07-24 report.

## §4 — Code, build and dependency health

All green:

- `npm test` **9/9**, `npx tsc --noEmit` clean, `npm run build` **701 pages / 700 sitemap URLs**.
- `audit-scan`: **0 orphans**, 0 titles > 60, 0 metas > 160, 0 internal trailing-slash redirect risks.
- `contrast-check`: 20/21 pairs pass; the single failure is the documented decorative-only
  `ink-400 on white`.
- Live: apex 200 in ~0.3 s; robots.txt correct; no `noindex`; no `X-Robots-Tag`.

**Dependencies:** `npm audit --omit=dev` reported **9** production advisories (6 high — PostCSS path
traversal, sharp/libvips CVEs). `npm audit fix` (non-breaking) reduced this to **5**; `package.json`
is unchanged and the full gate plus build were re-verified green after the lockfile change. The
remaining 5 require `astro@7.1.6`, a **breaking major**, and are deliberately deferred to a dedicated
upgrade branch. All are **build-time** dependencies with no runtime surface on a static CDN deploy.

**Correction to the Codex 07-25 audit:** it lists the Grundfos source URL as needing replacement.
It returns `Recv failure: Connection was reset` — active blocking of non-browser clients, not a 404
(the *original* Grundfos URL genuinely 404'd in the 07-05 audit; this replacement does not). Verify
in a real browser before swapping out what is probably a live primary source.

## §5 — Content corrections shipped

Ported the owner's uncommitted 2026-06-29 content-precision edits from the stale main-folder
checkout, applied **semantically** rather than as a patch, because the branch is 18 commits ahead and
the July work had already fixed part of the set.

- **`hiring-a-contractor`** — byline no longer claims reading bids is "squarely within engineering
  practice"; now states plainly that the author is not an HVAC or electrical contractor and that
  rules vary by jurisdiction. `NEC 220.83` no longer presented as *the* universal dwelling-load
  method (fixed in both the checklist and the suggested question). License / insurance / permit
  bullets no longer assert universal warranty, insurance or resale consequences. Refrigerant
  question rewritten around manufacturer A2L requirements. Added the FTC consumer-advice source.
- **`should-i-electrify`** — "for most homeowners, yes" → "for many homeowners it is worth
  evaluating", with the actual dependencies named. Sequencing claims softened from savings promises
  to concrete mechanisms. HPWH bullet now cites DOE water-heating guidance and discloses the
  noise / cool-exhaust tradeoff. The "see the whole picture" CTA now points at `/project-simulator/`.
- **`source-notes` `IRS_30C`** — the note read as though 30C were still claimable. Now explicitly
  expired. This was the live `/sources/` P1 in the Codex audit.

### ⚠️ Deliberately not ported

The stale folder's `data/csv/federal-credits.csv` still carries **30C `status=active`** — its June 29
edit only reworded the note and never flipped the status. Porting that file wholesale would have
**reverted the July expiry flip** and put the site back to implying a dead federal credit is
claimable, which `CLAUDE.md` names as a hard rule. Anyone reconciling these folders must port
content selectively, never in bulk.

## §6 — Open items

| Priority | Item | Note |
|---|---|---|
| P1 | **Stale main folder** — `main` at `6e1416f`, 18 behind, 19 uncommitted files, fails `npm test` | Now 19 behind (`2b3ac46`). Do not deploy from it. Its useful content is ported; the CSV must not be. |
| P1 | **Consolidate the programmatic footprint** | Raised in priority by §3. The 200 city pages are the thinnest cluster. Google already declines to index 317 discovered pages. |
| P1 | Bing re-inclusion | Watch Site Explorer. Sitemap re-submitted; nothing else mechanical remains. |
| P2 | Astro 7 upgrade | Clears the remaining 5 advisories. Dedicated branch, full regression pass. |
| P2 | `data.ts` ships all 51 CSVs to every island | Still the top CWV lever (from 07-05). |
| P3 | Grundfos URL | Probably fine — verify in a browser before changing. |
| P3 | Contrast script decorative-pair false positive | Document or tune to reduce audit noise. |

## §7 — What to actually watch

Not Ahrefs Web Analytics — it remains ~86% direct/bot noise. The two signals that mean something:

1. **Bing Site Explorer** — the day it stops saying "No pages found" is the day Bing re-included the site.
2. **GSC average position** — 51.2 → 49.6 → **39.9**. If it reaches the low 20s, clicks start
   appearing on their own. That is the honest leading indicator.

---

## §8 — Addendum: the duplication measurement (the actual root cause)

A second pass the same day measured what every prior "thin content" check missed. **The programmatic
pages are not thin — they are near-identical.**

| Comparison | Unique tokens | Uniqueness |
|---|---|---|
| `heat-pump-cost/austin-tx/` vs `.../dallas-tx/` | **12 of 2,226** | **0%** — differs only by the city name |
| `austin-tx` vs `boise-id` (different state) | 77 of 2,226 | 3% |
| City pages, 10 samples | — | **0–5%** |
| State pages, 10 samples | — | 2–7% |

City pages average **2,260 words**, so every length-based check passed. The tell was never length —
it was **variance**: across 100 generated pages the word count spans 2,225–2,260, a **1.5% spread**.
Pages genuinely written about different places do not cluster that tightly.

This is scaled-content duplication, and it explains the evidence better than authority does:

- **Bing** de-indexes it aggressively → exactly 0 impressions from July 2, unmoved by every
  mechanical recovery action (sitemap, IndexNow, URL submission — all tried, all no-ops).
- **Google** declines it quietly → **317 pages "Discovered – currently not indexed"**.
- **The sibling comparison in §3 now has a mechanism.** PetPlanWise: DR 0, 292 pages, ranking.
  ElectrifyCost: DR 2, 701 pages of which ~557 are 93–100% duplicates, not ranking. **Page count was
  the liability.**

**Fixed:** `noindex, follow` on all 200 city pages via a new `noindex` prop on `Layout.astro`;
`build-sitemap.cjs` now auto-skips any `noindex` page (sitemap 700 → **500 URLs**, no allowlist to
maintain). Pages stay live and useful for visitors and keep passing link equity. State pages kept
indexed — weak, but they carry genuinely different data and are the ones earning impressions.
Reasoning, measurement command, and thresholds: `.claude/lessons/12-programmatic-duplication.md`.

## §9 — What to add (evidence-led, not speculative)

Ranked by what GSC shows is *already* surfacing, rather than by keyword wish-list.

1. **Deepen the Tesla / 240V outlet angle.** The strongest emerging cluster after heat pumps is
   Tesla charger installation — `tesla 240v outlet installation cost` (6), plus four near-duplicate
   phrasings (~4 each): ~22 impressions in 28 days. `/tesla-ev-charger-installation-cost/` exists and
   is solid (3,179 words) **but mentions "240V" only twice.** "Just an outlet, not a hardwired
   charger" is a distinct sub-intent with its own price band (NEMA 14-50 vs hardwired). Adding that
   comparison to the Tesla page and the EV charger calculator targets a query already surfacing.
2. **HPWH installed cost.** `heat pump water heater cost` is the joint-top query (12 impressions).
   Deepen the existing page rather than adding new URLs.
3. **`heat pump replacement cost`** (12 impressions) — the page exists; strengthen the swap-out
   framing that the query implies.
4. **Do not add another programmatic dimension.** §8 is why. If one is ever proposed, measure
   uniqueness first with the command in lesson 12 and require > 30%.

---

*Prior reports (all in `archive/`): `TRAFFIC_AUDIT_2026-07-24.md`, `FULL_AUDIT_2026-07-05.md`,
`FULL_AUDIT_2026-07-04.md`. Independent third-party passes (Codex, also in `archive/`):
`NINE_ITEM_REMAINING_AUDIT_CODEX_2026-07-25.md` and the three 2026-06-25 reports.
Index of everything: `README.md`.*
