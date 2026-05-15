# Manus AI brief — Comprehensive audit of ElectrifyCost.com

You are auditing a newly-launched personal-finance / home-improvement website. This is a real production site, not a sandbox. The work is for the founder, who needs an honest, source-cited, decision-grade report — not marketing copy.

Spend as much time as you need (hours, not minutes). Do not stop at the first level of investigation. Use the live web for every claim. **Cite every factual statement with a working URL.**

---

## 1. Site context

- **URL:** https://electrifycost.com
- **Domain age:** new, launched ~May 2026.
- **Built with:** Astro 4 static site, React island calculators, Tailwind, Vercel deploy.
- **Topic:** U.S. home-electrification cost calculators (heat pumps, solar PV, batteries, EV chargers, water heaters, induction, panel upgrades, insulation, windows, audits, etc.) — 38 calculators across HVAC, electrical, EV, solar/resilience, water heating, envelope, appliances.
- **Positioning:** source-backed planning calculators, no email gate, no affiliate funnel. Differentiation is transparent methodology and citing primary sources (IRS, DOE, NREL, EIA, BLS, ENERGY STAR).
- **Federal credit landscape (very important for accuracy):**
  - 25C Energy Efficient Home Improvement Credit — **expired** for property placed in service after 2025-12-31 (OBBBA).
  - 25D Residential Clean Energy Credit — **expired** for property placed in service after 2025-12-31 (OBBBA). This kills the historic 30% federal solar / battery / geothermal credit for 2026 installs.
  - 30C Alternative Fuel Vehicle Refueling Property Credit — **still live through 2026-06-30**, eligible-census-tract gated.
  - 30D New Clean Vehicle Credit — terminated after 2025-09-30.
  - 25E Used Clean Vehicle Credit — terminated after 2025-09-30.
  - DOE HEEHRA/HOMES — state-rollout dependent.
- **Monetization plan:** AdSense (display) + affiliate (EnergySage-style lead gen) once approved. Currently no ads live.

You can find a full sitemap at https://electrifycost.com/sitemap.xml. Crawl it.

---

## 2. What I need you to do

Eight work streams, in this order. Do not skip ahead. Do not summarize what you "would" check — actually check it and report findings with evidence.

### Work stream 1 — Calculator accuracy (highest priority)

For **every one of the 38 calculators**, run the following procedure:

1. **Open the calculator page** in a browser. Note the URL.
2. **Run three input scenarios:** a low-end case (small home / cheapest config), a typical case (median U.S. household), and a high-end case (large home / premium config).
3. For each scenario, record:
   - Inputs used.
   - Calculator's low / mid / high gross cost output.
   - Calculator's net-after-incentives output.
   - Itemized breakdown if shown.
   - Sources the calculator cites.
4. **Compare to authoritative sources** for that equipment type. Required sources by category:
   - **Heat pumps, mini-split, geothermal, HPWH:** NREL Equipment Cost Database, ENERGY STAR product finder, Carbon Switch installed-cost surveys, recent (2025-2026) installer cost reports from EnergySage / Sealed / This Old House.
   - **Solar PV + battery:** NREL ATB 2024/2025 residential PV cost benchmarks, LBNL "Tracking the Sun" 2024/2025 report, EnergySage Marketplace median $/W, Wood Mackenzie Solar Market Insight, SEIA cost data.
   - **EV charger install + EV TCO:** NREL EVI-X data, AFDC station pricing, Plugshare, real EnergySage/Qmerit installer quote ranges, Edmunds/KBB TCO for EV vs gas comparison vehicles.
   - **Electrical panel upgrade:** Recent (2024-2026) installer quotes from Houzz, HomeAdvisor, This Old House, Reddit r/electricians threads.
   - **Ductwork, insulation, air sealing, windows, doors, roofs:** ENERGY STAR cost ranges, This Old House cost guides, HomeAdvisor 2025 cost reports, Manual J/D references, NFRC for windows.
   - **Tankless / tank water heater:** ENERGY STAR water heater data, Bradford White / Rheem / Rinnai installer guides.
   - **Generators:** Generac/Kohler/Champion installer pricing, NEC 702 compliance docs.
   - **Federal tax credits:** Always cross-check against IRS.gov primary pages (one per credit number).
   - **State / utility rebates:** DSIRE.org primary, state energy office pages, individual utility rebate pages.
5. **Score each calculator** on a 1-5 scale across: cost accuracy, incentive accuracy, copy accuracy, edge-case handling, transparency of sources.
6. **Flag specific errors** with the exact URL, screenshot if possible, and the correct value per authoritative source.

**Deliverable for this section:** a table — one row per calculator — with the scenarios you ran, comparison values, scores, and a "verdict" column (PASS / NEEDS_REVIEW / FAIL).

### Work stream 2 — Content accuracy & topical fit

For every page on the site:

1. Verify that the page content matches what the URL slug / H1 / title promise. Flag any page where content is off-topic or misleading.
2. Check FAQ Q&A blocks for technical correctness. Cite the authoritative source disproving any wrong answer.
3. Check that "guide" pages link to the matching calculator and vice versa.
4. Check guide page word counts and section structure. A real guide should be 1,500-3,500 words with H2/H3 sections, not a thin stub.
5. Flag any contradictions across pages (e.g., one page says 25D is 30%, another says 0% for 2026 — that's a contradiction).
6. Check that "last reviewed" / "data last updated" dates exist on price-sensitive content.

**Deliverable:** prioritized list of content defects — Critical / High / Medium / Low — with file path + the correct content.

### Work stream 3 — UI/UX testing

Test in Chrome at: **mobile 375px, mobile 414px, tablet 768px, laptop 1280px, desktop 1440px, desktop 1920px.**

For each width, test these pages:
- Homepage
- Heat pump calculator
- Solar calculator
- EV charger calculator
- HPWH calculator
- A guide page (`/guides/heat-pumps/`)
- The rebates page
- The methodology page
- A state page (`/heat-pump-cost-ma/`)

For each, record:
- Header / nav usable? Logo readable? No overflow?
- Hero photo loads, not distorted, alt text exists?
- Calculator inputs all clickable? Keyboard accessible? Touch targets ≥44×44px?
- Result panel renders correctly? Numbers readable?
- Any horizontal scroll / layout shift / CLS issues?
- Hover states work on desktop, but no broken tap behavior on mobile?
- Footer renders, links resolve?
- Performance — record Lighthouse score (Performance, Accessibility, Best Practices, SEO) for at least 5 pages.

**Deliverable:** bug list with screenshots / Lighthouse scores, prioritized.

### Work stream 4 — SEO audit

1. **Technical SEO**
   - Verify `sitemap.xml` exists and is well-formed.
   - Verify `robots.txt` is reasonable.
   - Verify canonical tags on every page.
   - Verify Schema.org JSON-LD present where appropriate (WebApplication / FAQPage on calculators, Article on guides, BreadcrumbList everywhere).
   - Run https://search.google.com/test/rich-results on 10 representative pages.
   - Check Core Web Vitals via PageSpeed Insights for 10 representative pages.
2. **Content SEO**
   - Title tag lengths (target 45-60 chars) and meta description lengths (target 135-155 chars) — flag any pages outside the range.
   - H1 uniqueness and presence on every page.
   - Internal linking density — does each calculator link to ≥3 related pages?
   - Image alt text — flag missing or generic alt text.
3. **Keyword targeting**
   - For each top-15 calculator, identify the primary target keyword and intent.
   - Estimate monthly search volume using Google Keyword Planner / Ubersuggest / Ahrefs free tier / SEMrush free tier (whatever you can access).
   - Identify gaps where the site is missing pages for high-volume related queries.
4. **Backlink baseline** — site is brand new so should have ~0 referring domains. Confirm with Ahrefs Backlink Checker (free) or similar.

**Deliverable:** SEO scorecard + opportunity backlog.

### Work stream 5 — Visual & brand audit

1. Audit color palette accessibility — check WCAG AA contrast across all text on backgrounds. Flag combinations < 4.5:1 for normal text.
2. Audit typography hierarchy — does H1 → H2 → H3 follow consistently?
3. Audit imagery — are hero photos consistent in aspect ratio, lighting, level of detail? Are they actually relevant to the page topic or generic stock?
4. Check the logo on different backgrounds.
5. Check Open Graph image rendering using https://www.opengraph.xyz on 10 pages.
6. Check that there are no broken images, no missing favicons, no console errors related to assets.

**Deliverable:** visual / brand scorecard with annotated examples.

### Work stream 6 — Market research

1. **Search demand**
   - For each of the 38 calculator topics, estimate U.S. monthly search volume for the primary commercial keyword. Use Google Keyword Planner / Ubersuggest / SEMrush.
   - Identify the top 3 SERPs for each calculator (incognito Google searches from a U.S. IP).
2. **Audience signals**
   - What is the homeowner demographic searching these terms? (Age, income, location heat map, urgency drivers — e.g., a broken furnace forces action.)
   - What seasonal patterns matter? Heat pump and HVAC searches spike in summer + winter. Solar peaks late winter / early spring. EV charger searches correlate with EV sales releases.
3. **Adjacent monetization markets**
   - What's the AdSense RPM range for finance / home-improvement vertical content in the U.S.? Cite Mediavine, Raptive, AdThrive published benchmarks where possible.
   - What's the typical affiliate payout for: heat pump leads (Sealed, Carbon Switch, Project Solar), solar leads (EnergySage, Solar.com, Modernize), EV charger leads (Qmerit, Treehouse, Quick Charge Pro), HPWH leads, panel upgrade leads?

**Deliverable:** demand + monetization landscape report.

### Work stream 7 — Competitive analysis

Identify and analyze the top 10 direct + adjacent competitors. Likely candidates (verify and add others you find):
- **EnergySage** — solar + heat pump marketplace.
- **Sealed** — heat pump full-service.
- **Carbon Switch** — heat pump education + comparison.
- **HomeAdvisor / Angi** — cost guides generally.
- **Modernize** — home-improvement lead-gen.
- **This Old House** — cost guides and how-to content.
- **Bob Vila** — cost guides.
- **Forbes Home / Forbes Advisor** — cost guides + affiliate.
- **NerdWallet (home improvement)** — adjacent finance content.
- **DOE Better Buildings / Home Energy Saver** — government calculators (low intent but high authority).
- **Project Solar / Solar.com** — solar quotes.
- **Elephant Energy / QuiltSpace** — heat pump regional players.
- **Rewiring America** — electrification advocacy + calculators.

For each, document:
- Their domain authority (Ahrefs DR or Moz DA).
- Estimated monthly organic traffic (SEMrush / Ahrefs).
- Their top 10 ranking pages.
- Their monetization model (ads, leads, services).
- Where ElectrifyCost can beat them (gaps in their coverage, freshness, source-backing, transparency).
- Where they will beat ElectrifyCost (domain age, link profile, brand).

**Deliverable:** competitive matrix + opportunity analysis.

### Work stream 8 — Traffic & revenue projection (24 months)

This is the most important section for the founder. Build a realistic, source-cited projection.

**Methodology requirements:**
1. For each calculator page, calculate the **monthly search volume × estimated click-through rate × position probability curve** based on a new-domain ranking trajectory.
2. New-domain assumption: months 0-3 ranking averages page 4-5; months 3-9 averages page 2-3; months 9-18 averages page 1-2 (assuming content velocity + 50+ referring domains acquired); months 18-24 stabilizes top 5 for long-tail terms.
3. **Build three scenarios:** Conservative (no proactive link building), Base (organic + 1 outreach push), Aggressive (active link-building + PR + 2 viral moments).

**Tables required:**

| Month | Conservative pageviews | Base pageviews | Aggressive pageviews |
|---|---:|---:|---:|
| 3 | … | … | … |
| 6 | … | … | … |
| 9 | … | … | … |
| 12 | … | … | … |
| 18 | … | … | … |
| 24 | … | … | … |

| Revenue stream | Base case M-12 | Base case M-24 |
|---|---:|---:|
| AdSense / Mediavine / Raptive | … | … |
| Affiliate (heat pump leads) | … | … |
| Affiliate (solar leads) | … | … |
| Affiliate (EV charger leads) | … | … |
| Other affiliate / sponsored | … | … |
| **Total** | … | … |

**Each row must cite the underlying assumption** (RPM range × pageviews; lead conversion % × payout × visits).

**Sensitivity analysis:** what's the break-even on RPM / conversion rate for the site to cover hosting + tooling + time at $40/hr?

**Deliverable:** the projection tables + a one-page narrative explaining the math and the biggest variables that could move it ±50%.

---

## 3. Final report format

Deliver one master document (PDF or long-form Markdown). Required structure:

```
1. EXECUTIVE SUMMARY                   (1 page)
   - Overall verdict (ship-ready / needs work / fundamental gaps)
   - Top 5 things to fix this week
   - Top 5 things to build over the next 90 days
   - 24-month opportunity sizing in one sentence

2. CALCULATOR ACCURACY REPORT          (large table + per-calculator notes)
3. CONTENT ACCURACY & TOPICAL FIT      (defect list)
4. UI / UX FINDINGS                    (bug list + Lighthouse scores)
5. SEO AUDIT                           (scorecard + opportunity backlog)
6. VISUAL / BRAND AUDIT                (annotated examples)
7. MARKET RESEARCH                     (demand + monetization)
8. COMPETITIVE ANALYSIS                (matrix + commentary)
9. 24-MONTH TRAFFIC & REVENUE FORECAST (tables + narrative)
10. PRIORITIZED RECOMMENDATION BACKLOG (P0 / P1 / P2 / P3)
11. APPENDIX A: All sources cited      (every URL used)
12. APPENDIX B: Calculator test data   (full inputs/outputs for every scenario)
```

---

## 4. Quality bar — non-negotiable

- **Every factual claim must have a URL citation.** No claim like "industry data shows" without a link.
- **Every recommendation must be specific.** Not "improve SEO" — instead "Trim title on `/insulation-cost-calculator/` from 89 chars to 56 chars: 'Insulation Cost Calculator 2026: Attic, Wall, Whole-House'."
- **Every projection must show the math.** Not "estimated $2k/mo by month 12" — instead "12,000 monthly pageviews × $18 RPM × 0.92 viewability factor = $1,987/mo."
- **Flag anything you cannot verify** rather than fabricating. If a calculator's source cite is unreachable, say so.
- **Use the founder's actual reading time as a constraint.** Long tables are fine; long prose paragraphs are not. Bullets and tables preferred.
- **Severity tags everywhere:** Critical / High / Medium / Low / Nice-to-have.

---

## 5. Things to specifically look for (the founder's stated concerns)

1. **Heat-pump bias.** The site has historically over-indexed on heat pumps. Confirm the site no longer presents only heat pump examples in places that should show all calculators (homepage hero card, state hubs, navigation pillars).
2. **Federal credit currency.** Any copy still claiming 25C / 25D / 30D as available in 2026 is wrong and must be flagged.
3. **Mobile usability.** Header logo, dropdown nav, and calculator inputs must all work cleanly on a 375px iPhone.
4. **Build / deploy health.** Visit 20+ random URLs from the sitemap and confirm none return 404 or broken hero images.
5. **Page speed.** Anything > 3s Largest Contentful Paint on a 4G connection is a problem.

---

## 6. What done looks like

A founder-grade audit they can act on. Specifically:

- A spreadsheet (Google Sheets / CSV) of every calculator with PASS / NEEDS_REVIEW / FAIL.
- A defect list they can paste into their developer's task tracker, each defect with file path + the fix.
- A 24-month revenue model they can show an advisor or investor without embarrassment.
- A clear list of the 5 things to do this week that will move the needle the most.

Begin. Take your time. Cite everything.
