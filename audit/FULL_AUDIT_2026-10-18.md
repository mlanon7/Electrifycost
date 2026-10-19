# ElectrifyCost — Full Deep Audit 2026-10-18

> First audit since 2026-07-31, and a clean natural experiment: **zero commits landed between
> July 31 and today**, so the site sat untouched for 2.5 months after the deindex of the 200
> duplicate city pages. Whatever moved is attributable to that change plus normal search dynamics.
> Sources: Google Search Console, Bing Webmaster Tools, Ahrefs dashboard and GA4 (all via the
> signed-in browser; the Ahrefs **API** remains unusable on a Basic plan).

## Executive summary

**Bing recovered completely. Google did not. And the binding constraint has moved — it is no longer
ranking, it is click-through.**

| Signal | 2026-07-31 | 2026-10-18 |
|---|---|---|
| **Bing impressions** | **0/day for 27 days** | **~350/day** (359, 358, 319, 353 recent) |
| **Bing clicks** | 0 | **219 total**, 5–13/day |
| Bing CTR | — | 2.46% across 721 keywords |
| Google impressions | 8.1/day | **1.75/day** |
| Google position | 39.9 | **52.3** |
| Google clicks | 0 | **1** (in 92 days) |
| Ahrefs organic (Google-only est.) | 0 | **0** |
| GA4 active users | — | 10 / 7 days, **+33%** |

The July 31 work **fixed Bing**. First impression returned **Aug 16**, sustained recovery from
**Aug 21** — roughly three weeks after the sitemap re-submission and the duplicate deindex. Google
continued its own independent decline.

## §1 — Verdict on the July 31 deindex

The honest question: did noindexing 200 city pages help, hurt, or do nothing?

**It did not cost traffic.** GSC's page report for the last 92 days lists **56 pages total** that
earned any impression at all — out of 701. **Not one is a city page.** The deindexed pages were
contributing zero before they were removed, so removing them cost nothing.

**It plausibly helped Bing.** Bing went from 27 consecutive days of absolute zero to ~350
impressions/day beginning three weeks after the change. That is the expected lag for a
re-registered sitemap plus a reduced-duplication crawl. Not proof — Bing publishes no notice — but
the timing fits and no competing explanation presents itself.

**It is only a quarter applied.** GSC reports **46** pages "Excluded by noindex tag" against the
200 that carry the tag. Google has not recrawled the rest in 2.5 months, which is itself a
crawl-budget signal. Indexed pages fell 309 to **246**.

| Not-indexed reason | Pages |
|---|---|
| Discovered – currently not indexed | **311** |
| Crawled – currently not indexed | 91 |
| Excluded by noindex tag | 46 |
| Page with redirect | 3 |

## §2 — Bing is now the traffic engine

219 clicks / 8.9K impressions / 2.46% CTR / 721 keywords / 88 pages earning.

**Top earning pages:**

| Page | Impressions | Clicks | CTR | Position |
|---|---|---|---|---|
| `/tesla-powerwall-home-battery-cost/` | 828 | **38** | 4.59% | 4.23 |
| `/guides/ev-charging-cost/` | **606** | 6 | **0.99%** | 6.29 |
| `/off-grid-solar-cost-calculator/` | **391** | **0** | **0.00%** | 6.17 |
| `/mini-split-heat-pump-cost-calculator/` | 368 | 12 | 3.26% | 4.48 |
| `/guides/pool-heat-pumps/` | 312 | 7 | 2.24% | 5.05 |
| `/guides/heat-pump-dryers/` | 275 | 10 | 3.64% | 5.17 |
| `/guides/is-a-heat-pump-worth-it/` | 182 | **18** | **9.89%** | 4.21 |
| `/heat-pump-operating-cost-calculator/` | 116 | 11 | **9.48%** | 4.01 |

**Every top performer is a calculator or a guide. Not one is a programmatic state or city page.**
That holds on Google too: the GSC top pages are the EV charger calculator (95), the
is-a-heat-pump-worth-it guide (39), the homepage (37) and `/heat-pump-replacement-cost/` (30).

The ~557-page programmatic layer earns nothing on either engine. The site's real asset is its ~75
calculators and guides.

## §3 — The finding: the ranking is won, the click is lost

The site now holds **page-one Bing positions** on real commercial queries and converts several of
them at zero.

| Bing keyword | Impressions | Clicks | Position |
|---|---|---|---|
| off grid solar system cost | 161 | **0** | 9.16 |
| local off grid solar system cost calculator | 93 | **0** | **3.83** |
| affordable off grid solar system cost calculator | 35 | **0** | **1.63** |

Position **1.63** with zero clicks is not a ranking problem.

**The pattern, measured across the whole Bing page report:** pages whose title or meta carries a
concrete dollar figure convert; pages whose meta lists the calculator's features convert at or near
zero.

| CTR | Page | What the snippet led with |
|---|---|---|
| **13.79%** | `/hot-water-recirculation-cost-calculator/` | type comparison |
| **13.04%** | `/goodman-heat-pump-cost/` | "Installed Price" |
| **9.89%** | `/guides/is-a-heat-pump-worth-it/` | asks the question and answers it |
| **9.48%** | `/heat-pump-operating-cost-calculator/` | **"($80-$200/mo)"** |
| 0.99% | `/guides/ev-charging-cost/` | "how to read kWh per 100 mi" |
| **0.00%** | `/off-grid-solar-cost-calculator/` | "PV array, battery, inverter, install" |
| **0.00%** | `/generator-cost-calculator/` | a list of generator types |
| **0.00%** | `/solar-panel-cost-calculator/` | an **expired** tax credit |

Someone searching "off grid solar system cost" wants the cost. The snippet offered a parts list.

### Fixed

Rewrote title and meta on **20 pages** so the **price leads** — the ten worst Bing converters, then
the ten highest-value calculators that had the same feature-list meta (a scan found **65 pages**
with no price in the snippet at all). Every figure is lifted
from that page's own published quick-answer, so snippet and content cannot disagree:

| Page | Now leads with |
|---|---|
| off-grid solar | $10,000–$23,000 cabin to $40,000–$82,000 homestead |
| ev charging cost | $5.10 per 100 miles at home vs ~$12 gas |
| mini-split | $3,500–$6,000 single zone |
| pool heat pump | $4,000–$8,500 vs $2,500–$5,500 gas |
| heat pump dryer | $900–$1,700 entry, $2,200–$3,600 premium |
| smart panel | Span $5,800–$9,000, Lumin $2,800–$4,800 |
| generator | 22 kW standby $11,000–$17,500 |
| boiler | 85% AFUE gas $4,500–$8,500 |
| solar | 7 kW $17,500–$31,500 gross |
| electrical panel | $1,500–$3,000 replacement, $500–$2,000 subpanel |
| **ev charger install** | **$1,000–$2,800 hardwired** (Google’s top page, 95 impressions) |
| heat pump | 3-ton ducted $7,500–$22,000 |
| water heater install | $1,200–$2,800 standard tank |
| heat pump water heater | 50-gal 240V hybrid $2,200–$4,200 |
| panel upgrade | 100A→200A $2,500–$5,000 |
| insulation | $4,500–$8,500 for 1,800 sqft |
| ac replacement | 3-ton two-stage $8,000–$11,500 |
| gas furnace | 95% AFUE $4,500–$8,500 |
| geothermal | 3-ton vertical bore $20,000–$32,000 |
| tankless | gas condensing $4,500–$8,500 |

**No ranking change is required for this to pay.** Those two worst pages alone are 997 impressions
returning 6 clicks. At the ~9% CTR comparable pages already achieve, that is roughly 90 clicks.

> ⚠️ One self-inflicted bug, caught on live verification: the generator page declares `description`
> twice (JSON-LD schema and Layout meta) and the schema string began with the same sentence, so the
> string replace hit the schema instead. Restored and corrected; the other nine were verified clean.
> **Lesson: check for duplicate `description` declarations before any bulk meta edit.**

## §4 — Why Google specifically is still flat

The sibling comparison, same account, same window:

| Site | DR | Pages crawled | Organic traffic | Organic keywords |
|---|---|---|---|---|
| **Electrifycost** | **4** | **746** | **0** | **0** |
| Projectcostpro | 8 | 234 | 386 | 134 |
| Petplanwise | 2 | 500 | **614** | **254** |

ElectrifyCost carries the **most pages** and earns **zero** Google keywords, while a **DR-2** sibling
earns 254. Domain Rating rose 2 to 4 and referring domains 424 to 752, and Google visibility still
did not move — which again says the constraint is not raw authority.

**Important caveat on the numbers that look worst:** Ahrefs "organic traffic" is a **Google-only
estimate** and cannot see Bing, where the real 219 clicks are. GA4 undercounts for a different
reason — Consent Mode v2 defaults `analytics_storage` to denied, so only cookie-accepting visitors
are counted. The site is performing better than either dashboard shows.

## §5 — Technical health

Clean. `npm test` 9/9, `tsc` clean, build 701 pages / 500 sitemap URLs, apex 200 in ~0.2 s, city
pages correctly `noindex, follow`, sitemap carries zero city URLs.

## §6 — What to do next, in order

1. **Let the CTR fix run.** It needs a recrawl cycle. Re-measure Bing CTR on those ten pages in
   2–3 weeks. This is the highest-confidence lever on the board and needs no new content.
2. **Deepen the proven winners, not the page count.** `/tesla-powerwall-home-battery-cost/` (828
   impressions, 38 clicks) is the single best page on the site, and the Powerwall / 13.5 kWh /
   price-per-kWh cluster is live demand. `/guides/ev-charging-cost/` and the off-grid solar
   calculator are the next two.
3. **Finish applying the price-led snippet pattern.** 20 pages are done; a scan found **65** with
   no price in the meta. The remaining ~45 are mostly guides, which need a hand-written hook rather
   than a quick-answer figure, so they are a writing task rather than a mechanical one.
4. **Do not add programmatic pages.** 557 of them earn nothing on either engine. See
   `.claude/lessons/12-programmatic-duplication.md`.
5. **Open question, not yet actioned:** the 357 state pages are 2–7% unique and earn nothing. The
   city deindex was neutral-to-positive, so the same treatment is defensible — but it is a strategy
   call and the evidence does not yet demand it.

*Prior reports in `archive/`. Index: `README.md`.*
