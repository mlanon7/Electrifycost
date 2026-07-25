# ElectrifyCost — Traffic & Search-Visibility Audit 2026-07-24

> Triggered by an observed "sudden traffic drop" visible in Ahrefs and Bing. This audit separates
> three distinct things that were being read as one event: a **reporting artifact**, a **real
> mid-June Google decline**, and a **hard Bing zero since July 2**. Sources: Google Search Console
> (domain property), Bing Webmaster Tools, Ahrefs Web Analytics + project dashboard, and direct
> live-site probes. Ahrefs API was unavailable (account is on a Basic/free plan — every endpoint,
> including the free one, returns `Insufficient plan`), so Ahrefs figures come from the UI.

## Executive summary

**There is no site failure, no penalty, and no deindexation.** The site is healthy technically.
The "drop you saw today" is not real. The drop that *is* real happened ~6 weeks ago, and its cause
is the thing the June 14 review already named: **the site is authority-gated, not content-gated.**

| Signal | Reading | Verdict |
|---|---|---|
| "Ahrefs views dropped today" | Final chart segment is the **incomplete current day** (dashboard is UTC; it was ~01:00 UTC) | **Artifact — not a real drop** |
| Ahrefs Web Analytics, 30 d | 209 unique visitors, **+19 vs prior period** | Flat-to-up |
| Google impressions | ~101/day (pre-Jun) → **~7/day** (last 28 d) | **Real, −93%, mid-June** |
| Google clicks | 28 in 90 d → **0 in the last 28 d** | Real |
| Bing impressions | Ramping to 146/day, then **exactly 0 from Jul 2 for 21 straight days** | **Real, unexplained by any site fault** |
| Manual actions | **No issues detected** | Clean |

---

## §1 — The "drop today" is a reporting artifact

The Ahrefs Web Analytics daily chart ends in a **dotted** segment falling to zero. Dotted = the
current, still-accumulating period. The dashboard runs on **UTC**, and it was only ~01:00 UTC when
checked — roughly one hour of data plotted against full 24-hour days. The same dotted-tail collapse
appears on the ProjectCostPro and PetPlanWise charts simultaneously; three unrelated sites do not
crash in the same hour.

Ahrefs' own 30-day totals contradict the visual: **256 views / 209 unique visitors / 214 visits,
+19 visitors versus the prior period.** ElectrifyCost also showed **9 visitors in the last 24 h**
(ProjectCostPro 35, PetPlanWise 27, FirstYearCost 0) — the site is alive and being visited.

Similarly, the project card's alarming **"Organic keywords 0 (−1)"** is a change of *one keyword*
in Ahrefs' database. At this scale that is noise, not signal.

## §2 — The real Google decline (mid-June)

Google Search Console, domain property `electrifycost.com`:

| Window | Clicks | Impressions | CTR | Avg position |
|---|---|---|---|---|
| 90 days (May 13 – Jul 22) | 28 | 6,450 | 0.4% | 51.2 |
| 28 days (Jun 25 – Jul 22) | **0** | 198 | 0% | 49.6 |
| 7 days (Jul 16 – Jul 22) | **0** | 86 | 0% | **39.7** |

Impressions ran **300–450/day through early June**, then collapsed around **June 10–17** and have
stayed flat since — from ~101/day averaged over the first 62 days to ~7/day over the last 28.

**Why 0 clicks is arithmetically expected, not a tracking bug:** at average position ~40–50 the site
sits on results page 4–5. Nobody clicks there. The top queries prove it — `heat pump cost` earned
**285 impressions and 0 clicks**; `heat pump system cost` 190 / 0; `cost of heat pump` 125 / 0.
The site is being *shown* for exactly the right commercial queries and ranking too deep to be seen.

**Probable cause — timing fits, and it is not a site fault.** Google's **May 2026 core update
completed June 2, 2026** after an unusually volatile rollout, with elevated turbulence continuing
through mid-June. A domain launched in May 2026 typically receives a provisional discovery boost
in its first weeks; once Google has enough data it re-rates the site on authority. ElectrifyCost has
essentially no external authority (see §4), so the re-rating landed hard.

**Encouraging counter-signal:** average position is *improving* (51.2 → 49.6 → **39.7**) and the
last-7-day impression rate (~12/day) is running ahead of the 28-day rate (~7/day). The trend has
turned up off the bottom, from a very low base.

## §3 — Bing: exactly zero since July 2

Bing Webmaster Tools daily impressions, May 31 – Jul 22:

- June ramp — 5, 8, 9, 6, 11, 10, 8, 24, 32, 46, 42, 38, 23, 27, 38, 35, 42, 26, 37, 31, 32, 61,
  46, 68, 72, 59, 49, **146** (Jun 28), 69, 66
- **Jul 1: 29 → Jul 2 through Jul 22: 0, every single day (21 consecutive days).**

A clean zero for three weeks after a healthy 66/day is not ranking decay — decay is gradual and
noisy. Something switched off. **But every fault hypothesis is ruled out:**

- Sitemap: **crawled successfully Jul 22**, 700 URLs, status Success, 0 errors, 0 warnings.
- Homepage URL inspection: **"Indexed successfully — URL can appear on Bing"**, *no SEO/GEO issues*.
- Bingbot is not blocked (200 on a live fetch with the bingbot UA); robots.txt allows all.

The one contradicting signal: **Site Explorer returns "No pages found"** for the property, which is
consistent with Bing having dropped the *interior* pages from its serving index while retaining the
homepage. Unresolved — this is the single item worth active follow-up (see actions).

Note: two sitemap entries are registered (`electrifycost.com` and `www.electrifycost.com`). Host
handling itself is correct — `www` → apex (307), `http` → `https` (308), and every canonical points
to the apex — so this is not duplicate content, but the `http://www` path takes two hops.

## §4 — The uncomfortable finding: most "traffic" is not human

Ahrefs Web Analytics, last 30 days:

| Dimension | Reading |
|---|---|
| Channels | **Direct 85.6%** (179), Search 7.2% (15), Internal 7.2%, AI search 1.0% |
| Geography | **Singapore 43.5%**, US 36.4%, **Russia 11.5%**, Canada 5.3% |
| Browsers | Chrome 65.6%, Edge 14.4%, **Yandex Browser 9.1%** |
| Engagement | **Bounce 90.7%**, 1.2 views/visit, 1m 14s |

Overwhelming direct traffic, a plurality from Singapore (a major datacenter region), a Russian +
Yandex Browser cluster, and a 90.7% bounce at 1.2 pages — that is the signature of bot and
datacenter noise, not homeowners researching heat pumps. **Real organic search traffic is ~15
visitors per 30 days.**

**Backlinks tell the same story.** Ahrefs reports **392 referring domains (+186 in 30 days)** while
Bing Webmaster Tools sees **2** (`projectcostpro.com` — our own sister-site cross-link — and
`irepairheatingandair.com`). Domain Rating is still **2**. 392 genuine referring domains would not
leave DR at 2. Those links are scraper/auto-generated junk; they are not authority and should not be
mistaken for progress. Nothing here looks like a *harmful* attack, but it is worth monitoring.

## §5 — What is verifiably healthy (ruled out, with evidence)

- **Live and fast:** homepage 200 from Vercel, 0.32 s, 66 KB.
- **No penalty:** GSC Manual Actions — *No issues detected*.
- **Indexable:** no `noindex` meta, no `X-Robots-Tag`, robots.txt `Allow: /` plus explicit GPTBot /
  ClaudeBot / Google-Extended allowances.
- **Sitemap correct:** 700 URLs, correct `sitemap/0.9` namespace (the historic bug has not regressed).
- **Crawlers not blocked:** Googlebot, bingbot, AhrefsBot, AhrefsSiteAudit all receive 200.
- **Indexation broadly stable:** **309 indexed** (vs ~339 in mid-June — a modest decline, not a
  collapse). Not indexed 394: *Discovered – currently not indexed* 317, *Crawled – currently not
  indexed* 74, redirects 3. The 317 "discovered but not crawled" is a **crawl-budget/authority**
  symptom typical of a low-authority domain, not a technical defect.
- **Analytics intact:** GA4 (`G-5CMBX2RBY4`) and the Ahrefs script are both present in the live HTML
  and `analytics.ahrefs.com/analytics.js` returns 200 — the measurement layer is not broken.
- **Presentation:** the homepage renders cleanly — clear value proposition, honest low/mid/high
  framing, the decision on-ramp CTA, and the trust strip (204 primary sources · 22 rebate programs ·
  25 cost scenarios · 51 states + DC). No funnel, consistent with the brand position.

## §6 — Actions, in priority order

**P1 — Backlinks are the entire game.** Two real referring domains is the root cause of everything
above. Impressions on `heat pump cost` at position ~50 convert to clicks only by moving to page 1,
and for a YMYL-adjacent cost query that requires external authority. The `ROADMAP.md` plays
(newsletter outreach to Canary Media / Heatmap / Volts, the Show HN launch kit at
`.claude/prompts/hackernews-launch.md`, genuine Reddit participation) are the correct levers and are
now the *only* ones that matter. Everything else is downstream.

**P1 — Resolve the Bing zero.** The sitemap is being read and the homepage is indexed, yet Site
Explorer is empty and impressions are exactly 0 for 21 days. Re-run `node scripts/indexnow-submit.cjs`
to re-ping the 700 URLs, then re-check Site Explorer in ~7 days. If it stays empty, this is worth
raising with Bing support — the data does not match any site-side fault.

**P2 — Stop reading Ahrefs Web Analytics as a traffic number.** It is ~86% bot/direct noise.
GA4 is already wired with Consent Mode v2; use **GA4 as the human-traffic source of truth** and treat
GSC clicks as the demand signal. Never judge a trend from the final (dotted) day of any chart.

**P2 — Target winnable queries, not head terms.** The 28-day query set shows genuine long-tail
traction — `heat pump replacement cost` (11 impressions), `heat pump water heater cost` (7),
`tesla 240v outlet installation cost` (5). These are far more winnable than `heat pump cost` (285
impressions, position ~50). Deepen the pages that already surface for them.

**P3 — Monitor the scraper backlinks.** 392 Ahrefs referring domains against DR 2 and 2 Bing-visible
domains. Not currently harmful; worth a monthly glance for a genuine spam attack.

**P3 — Trim the `http://www` redirect chain** (two hops to reach the canonical apex).

---

## Method note

Every number here was read from a primary console (GSC, BWT, Ahrefs UI) or probed directly against
the live site. No figure is inferred from a chart shape alone — the mid-June Google decline was read
off the chart *and* confirmed against 90/28/7-day totals. The Ahrefs API could not be used: the
account is on a Basic/free plan and every endpoint returns `Insufficient plan`.

*Prior full-site audits: `FULL_AUDIT_2026-07-05.md`, `FULL_AUDIT_2026-07-04.md`. Index: `README.md`.*
