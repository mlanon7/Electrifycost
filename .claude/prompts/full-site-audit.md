# Prompt: Full site audit

Drop this into any AI assistant (Claude, ChatGPT, Manus, Gemini) when you want a comprehensive 3rd-party audit. The prompt is self-contained — no project context needed beyond what's in the prompt itself.

For routine in-session audits within Claude Code, use the `/audit-site` slash command instead, which dispatches parallel sub-agents.

---

## The audit brief

```
You are auditing a newly-launched personal-finance / home-improvement website.
This is a real production site, not a sandbox. The work is for the founder,
who needs an honest, source-cited, decision-grade report — not marketing copy.

Spend as much time as you need (hours, not minutes). Do not stop at the first
level of investigation. Use the live web for every claim. Cite every factual
statement with a working URL.

---

## 1. Site context

- URL: https://electrifycost.com
- Domain age: launched May 2026
- Built with: Astro 4 static site, React island calculators, Tailwind, Vercel
- Topic: U.S. home-electrification cost calculators (38 calculators across
  HVAC, electrical, EV, solar/resilience, water heating, envelope, appliances)
- Positioning: source-backed planning calculators, no email gate, no
  affiliate funnel. Differentiation is transparent methodology and citing
  primary sources (IRS, DOE, NREL, EIA, BLS, ENERGY STAR, NEEP).
- Federal credit landscape (very important for accuracy):
  - 25C Energy Efficient Home Improvement — EXPIRED 2025-12-31 (OBBBA)
  - 25D Residential Clean Energy — EXPIRED 2025-12-31 (OBBBA)
  - 30C Alternative Fuel Vehicle Refueling — LIVE through 2026-06-30
  - 30D New Clean Vehicle — TERMINATED 2025-09-30
  - 25E Used Clean Vehicle — TERMINATED 2025-09-30
  - DOE HEEHRA/HOMES — state-rollout dependent
- Monetization plan: AdSense (display) + affiliate once approved.
  Currently no ads live.
- Sitemap: https://electrifycost.com/sitemap.xml — crawl it

## 2. What I need (8 work streams, in this order)

### Stream 1: Calculator accuracy (highest priority)

For each of the 38 calculators:
1. Open the calculator URL
2. Run THREE scenarios: low-end (small home, cheapest config), typical
   (median U.S. household), high-end (large home, premium config)
3. Record inputs, gross output (low/mid/high), net-after-incentives,
   itemized breakdown, sources cited
4. Compare to authoritative sources:
   - Heat pumps / HPWH / mini-split / geothermal: NREL Equipment Cost
     Database, ENERGY STAR product finder, EnergySage marketplace data,
     Carbon Switch surveys
   - Solar PV + battery: NREL ATB benchmarks, LBNL "Tracking the Sun"
     2024/2025, EnergySage Q1 median $/W, Wood Mackenzie SMI, SEIA
   - EV charger install + EV TCO: NREL EVI-X, AFDC station pricing,
     EnergySage / Qmerit quotes, Edmunds/KBB TCO
   - Electrical panel: HomeAdvisor, Houzz, This Old House (2024-2026)
   - Envelope (insulation, windows, doors, roofs): ENERGY STAR cost
     ranges, This Old House guides, HomeAdvisor reports, NFRC
5. Report severity per row: P0 = ships wrong number, P1 = materially
   misleading but capped/masked, P2 = within ±10%, P3 = stylistic

### Stream 2: Content quality

- Crawl 6-8 representative pages spanning short and long content
- Audit FAQs for AI-slop tells: "in today's landscape", "comprehensive
  solution", "let's dive into", "robust", "leverage", "holistic"
- Voice consistency: voice should be plain English, direct, source-cited.
  Flag any guide / FAQ that drifts to corporate / SEO-content-farm voice
- Disclaimer presence: every calculator page should have "planning ranges,
  not contractor quotes" or equivalent. Flag missing disclaimers
- Source citation: every numeric claim in FAQ answers should link to a
  primary-source URL inline OR the page should link to /sources/ for the
  full citation set

### Stream 3: SEO posture

- Sitemap.xml — verify it parses correctly (`xmlns="http://www.sitemaps.
  org/schemas/sitemap/0.9"` — slash, not hyphen)
- Robots.txt — verify Sitemap directive, GPTBot/ClaudeBot allow rules
- Per-page meta — title length (50-70 chars), description length (130-155),
  canonical href accuracy
- Schema JSON-LD — verify presence of WebSite + Organization on /;
  WebApplication + FAQPage on calculator pages; TechArticle on guides;
  BreadcrumbList on pages with breadcrumbs; AboutPage + Person on /about/
- Internal linking — every guide should link to its calculator + 3 siblings.
  Every state programmatic page should cross-link to all 50 other states
- Core Web Vitals via Lighthouse or PageSpeed Insights — flag any page
  with LCP > 2.5s, CLS > 0.1, or INP > 200ms

### Stream 4: Accessibility

- Color contrast — text-ink-500 on white may be borderline at small font
  sizes; verify with a contrast checker
- Semantic HTML — H1 uniqueness, heading hierarchy (no jumps from H1 to
  H3), correct landmark roles
- Keyboard nav — Tab order, focus-visible rings on btn-primary and form
  inputs
- Screen reader — aria-live on calculator result region, alt text on
  hero images, aria-labels on icon-only buttons
- Reduced motion — verify any animations respect prefers-reduced-motion

### Stream 5: Bug sweep

- Browse 10 random pages, check the browser console for errors
- Verify the calculator result panel updates without flicker on input
  change
- Verify the state programmatic pages pre-select the correct state
  (NOT California by default — see if /heat-pump-cost-tx/ shows Texas
  in the state dropdown)
- Verify the sitemap URL count matches the build report

### Stream 6: Monetization readiness

- Identify reserved <AdSlot> positions on each calculator page
- Identify reserved AffiliateModule slots (env-gated, currently not
  rendering)
- Estimate the ad-network application timeline given current traffic
  (use Mediavine Journey 1K threshold as floor)
- Identify the highest-value affiliate categories given the calculator
  mix (EV chargers, induction ranges, HPWHs typically have the best
  retail-product affiliate fit)

### Stream 7: Live vs local diff

If the user provides both production URL and local repo, check for:
- Pages live on production but not in repo (stale deploys)
- Pages in repo but not deployed (cache stale)
- Different versions of the same page (CDN cache lag)

### Stream 8: Strategic / forward-looking

- What 3 wins would deliver the most value in the next 30 days?
- What 3 wins for the next 90 days?
- What pivot risks exist if traffic doesn't ramp?
- Competitive landscape: HomeAdvisor, Modernize, EnergySage, Rewiring
  America Tools, This Old House calculators. What's ElectrifyCost's
  competitive moat? Is it defensible?

---

## 3. Report format

For each stream, deliver:
- A markdown table with columns: Finding | Severity | URL | Fix
- A 2-3 sentence executive summary at the top of the stream
- All claims cited with a working URL

For the overall audit, deliver:
- An executive summary at the top: top-3 P0 findings, top-3 P1, top-3
  strategic
- A prioritized punch list (P0 → P3) the founder can work through
- An estimated revenue trajectory over 6 / 12 / 18 months given current
  state

## 4. What to skip

- Don't audit the audit/ historical files — those are project artifacts,
  not user-facing content
- Don't audit src/ source code unless flagging a bug visible on the live
  site
- Don't propose UI redesigns — the site has an established design system

Begin.
```

---

## How to use this prompt

### Inside Claude Code

Don't use this prompt directly inside a Claude Code session — use the `/audit-site` slash command instead, which dispatches the work as parallel sub-agents and synthesizes the report.

### In ChatGPT / Claude.ai / Gemini

Paste the prompt verbatim. The model will spend ~30-60 minutes (in agentic mode) walking through the streams. Output goes into `audit/AUDIT_YYYY-MM-DD.md`.

### In Manus

Manus is well-suited for this prompt — it's designed for multi-stream sustained investigation. Expect ~1-2 hour runtime for a thorough pass.

### Adapting to a new niche

Edit the federal-credit landscape section, the primary-source canon, and the URL. Everything else (the 8-stream structure, the severity scale, the report format) is niche-neutral.
