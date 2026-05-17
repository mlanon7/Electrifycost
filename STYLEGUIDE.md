# Style Guide — Voice, Tone, Disclaimers, Anti-AI-Slop

This is the editorial guide for any content shipped to electrifycost.com — calculator FAQs, guide pages, comparison pages, state-page prose, marketing copy. The site's positioning depends on these conventions.

---

## Brand position (read first)

**ElectrifyCost is a no-funnel, source-cited planning tool, not a sales surface.**

Three things follow from that:

1. **We don't sell installation.** We don't run a contractor referral funnel. We don't email-gate the calculator output. We don't push for newsletter signups. Every page should feel like a useful reference, not a lead-capture mechanism.
2. **We cite our work.** Every numeric claim links to a primary source (IRS, DOE, NREL, EIA, BLS, NEEP, ENERGY STAR) or to a CSV row at `/sources/` with a `last_reviewed` date. If you can't cite it, don't write it as fact.
3. **We're honest about uncertainty.** Cost ranges (low / mid / high) are planning estimates, not bids. Rebate amounts are subject to program rules. Federal credits have expiration dates. Every page reflects this.

If a piece of copy reads like a contractor's marketing site, an "ultimate guide" SEO farm, or a freshman's AP English paper, **it doesn't ship**.

---

## Voice

- **Plain English over jargon.** A homeowner with no HVAC background should understand it. When a technical term is required (HSPF2, Manual J, NEC 220.83), define it on first use or link to the glossary.
- **Direct, not cute.** "A 100A → 200A panel upgrade typically runs $2,000–$4,500 installed." NOT "Let's dive into the world of panel upgrades!"
- **Honest about tradeoffs.** "Heat pumps are great except in two cases: very cheap natural gas markets and homes with no decent ductwork." NOT "Heat pumps are the future of home heating!"
- **Specific over generic.** "Mass Save reduced its whole-home cap from $10,000 to $8,500 effective 2026-01-01." NOT "Local rebates are subject to change."
- **The reader is smart.** No "as you may know" / "let's explore" / "it's important to remember." Just say the thing.

---

## Tone

- Helpful. Not promotional.
- Confident on facts. Cautious on predictions.
- Skeptical of contractor sales tactics. Especially "you definitely need a panel upgrade" without an NEC 220.83 load calc, "$3,000 just in case" line items, and "this rebate is only available for the next 48 hours" pressure.
- Direct disagreement is fine. If conventional wisdom is wrong (e.g., "EV-vs-gas TCO is dramatic" — it's not; depreciation kills the case for many vehicles), say so.

---

## AI-slop tells to avoid

If you see these phrases in draft copy, rewrite. They're statistical markers of unreviewed LLM output:

| Slop | Why it's slop | Fix |
|---|---|---|
| "In today's rapidly evolving landscape" | Filler | Delete the whole opening |
| "It's important to note that" | Padding | Delete; just state the fact |
| "Let's dive into" / "Let's explore" | Cute filler | Delete |
| "Comprehensive guide" / "Ultimate guide" | Empty superlative | Delete or replace with the specific scope ("How they work, types, cost, lifespan") |
| "Robust solution" / "Leverage" / "Holistic approach" | MBA-speak | Use plain English |
| "We need to consider" | Passive | "Consider X" or "X matters because…" |
| "There are several factors to consider" | Empty preamble | Just list the factors |
| Three-adjective stacks: "innovative, sustainable, and efficient" | LLM rhythm | Pick one, or none |
| Em-dashes used for emphasis 5× in a paragraph | LLM tic | Replace some with periods or commas |
| "While it's true that X, it's also important to recognize Y" | Hedge construction | "X is true. Y is also true." |
| "Federal availability has changed" (without specifics) | Vague hedge | State the exact date + the OBBBA reference + the IRS URL |
| "Some experts say" | Anonymous-authority cop-out | Name the source: "NEEP's 2026 cold-climate ASHP database shows…" |

When in doubt, read the paragraph aloud. If you wouldn't say it aloud to a homeowner friend, rewrite.

---

## Disclaimers — load-bearing, do not remove

These appear repeatedly across the site for a reason. They're load-bearing for the YMYL E-E-A-T signal Google uses for home-renovation content. Don't edit them away in pursuit of "tighter copy."

### Universal (homepage + calculator pages)

> "Estimates are planning ranges, not contractor quotes."

> "Actual prices depend on your home, local labor rates, equipment selection, code requirements, utility rules, and contractor availability."

### Rebate-related (calculator pages + rebates page)

> "Rebate eligibility varies; always verify with the program administrator before claiming."

### Federal-credit-related (any page referencing 25C / 25D / 30C)

> "Federal eligibility was changed by the One Big Beautiful Bill Act (OBBBA, signed July 4, 2025). Verify current IRS guidance at https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit."

### About page + methodology

> "The cost ranges here are planning estimates, not bids. Always work with a licensed professional in your state for the actual installation."

> "This site is not a substitute for an NEC 220.83 load calculation by a licensed electrician."

---

## Numeric claims — sourcing rules

Every numeric claim falls into one of four categories. Different rules apply:

| Category | Examples | Sourcing rule |
|---|---|---|
| **Equipment cost / labor / install** | "$8,500 mid for a 3-ton heat pump in CA" | Comes from a CSV row with `source_id` + `last_reviewed`. Don't inline-source unless the prose specifically references industry context. |
| **Rebate amount / cap** | "Mass Save caps at $8,500" | Comes from `rebate-programs.csv`. Inline-link the program URL in FAQ answers. |
| **Federal credit** | "25C provided 30% up to $2,000 for HPs" | Inline-link IRS URL. State the OBBBA expiration date. |
| **Industry benchmark / efficiency standard** | "Modern HPs deliver COP ≈ 3.0" | Inline-link NEEP database, ENERGY STAR product finder, NREL benchmark study, or LBNL technical report. |

**If you cannot cite a claim with a working URL or a CSV row, it doesn't ship.**

---

## Headline + H1 conventions

- **Calculator pages:** "<Module> Cost Calculator 2026: Install Cost, Rebates & Payback" or similar. Keep under 70 chars.
- **State programmatic:** "<Module> Cost in <State>" e.g. "Heat Pump Cost in Texas — Installed Price, Rebates, Payback"
- **Guide pages:** Template A canonical form is "<Topic>: The Complete Guide" or "<Topic>: How They Work, Types, Cost". Avoid "Ultimate Guide to X."
- **Comparison pages:** "<A> vs. <B>: Cost, Efficiency, and When Each Wins"
- **By-state hubs:** "<Module> Cost by State 2026"

Year ("2026") in titles only when the content has time-sensitive elements (rebates, credit expiration dates, refrigerant transitions). Skip it on timeless content.

---

## Quick-answer callouts

Most calculator pages have a "Quick answer" callout box right under the H1. The pattern:

```html
<p class="mt-3 rounded-md border border-ink-200 bg-ink-50 p-3 text-sm text-ink-800">
  <strong>Quick answer:</strong> $2,000–$4,500 typical, $4,500–$7,500 in
  high-cost markets. <a href="...">Smart load management</a> often replaces
  a $4,000 upgrade for $500–$1,500.
</p>
```

Rules:
- One sentence (or two short ones).
- A specific dollar range, not "varies widely."
- Optional link to a related calculator or alternative path.
- **Match the homepage's "Typical:" card range** for the same module. If the homepage says `$1,800–$4,500`, the Quick answer says `$1,800–$4,500`. Mismatches are a P0 trust hit.

---

## FAQ section conventions

Every flagship calculator page has a "Frequently asked questions" section with **8–10 questions** rendered as `<details>` accordion items. Conventions:

- **Question count parity** — heat pump has 12, panel has 9, EV has 10, HPWH has 10, induction has 10. New flagships should aim for 8–10.
- **Question pattern (in order):** cost → eligibility → tech / efficiency → installation logistics → rebates → comparison to alternatives → lifespan → contractor red flags
- **Answer length:** 60–120 words. Long enough to be substantive, short enough to scan.
- **Lead with the answer**, then add caveats. NOT "It depends on many factors…" → State the answer first, then qualify.
- **Cite at least one URL** in any answer about federal credits, rebates, or technical standards.

Every flagship FAQ is also emitted as `FAQPage` JSON-LD via the page's `schemaJsonLd` array. If you add or edit FAQs, the schema updates automatically (it maps from the `faq` array in the frontmatter).

---

## OBBBA preamble — consolidate, don't repeat

The One Big Beautiful Bill Act (OBBBA, 2025-07-04) terminated multiple federal credits. Each affected FAQ should reference it briefly — but **don't paste the same 60-word preamble verbatim in every answer.** The pattern that works:

> "The federal 25C credit (which covered <X> up to $<Y>) expired Dec 31 2025 under OBBBA. State and utility programs may still apply — see /rebates/."

One sentence. No long preamble. Link to `/rebates/` for the full history.

---

## State-page templating

The 51 per-state programmatic pages share a template. To keep them from feeling like SEO chaff:

- **State-specific data points** (electricity ¢/kWh, gas $/therm, climate zone, HDD, labor multiplier, rebate count) are pulled from CSVs and displayed in the hero stats grid. These are REAL state-specific values, not template variables.
- **State-name-interpolated FAQ** — each FAQ answer uses `${stateName}` and `${electricityCents}` to compute a state-specific dollar amount inline. This is required for the page to feel local.
- **Optional state-unique paragraph** (not yet shipped on all 51 × 5 = 255 state pages but planned): one paragraph mentioning the state's named utility programs (Mass Save, NYSERDA, ConEd, PG&E, Eversource), HEEHRA rollout status, and any quirks (cold-climate states, CARB-strict states, etc.).
- **Calculator** must hydrate with the page's state pre-selected. Don't ship a state page that defaults to California.

If a state-page paragraph could be rendered with any state name substituted and it would still make sense, it's too generic. Replace it with state-specific content.

---

## What NOT to put on the site

Hard "no" list:

- **Lead-capture forms anywhere.** No "get free quotes" buttons. No "save your estimate, enter your email." No newsletter pop-ups. No contractor referral widgets (Networx, Modernize, Angi Leads).
- **Affiliate links without disclosure.** If affiliate links are present on a page, the `AffiliateDisclosure` component must be present too. FTC compliance is not optional.
- **Time-pressure language.** "This rebate ends soon!" "Only 3 spots left!" "Get your free quote before prices rise!" — all sales pressure tactics, all banned.
- **Anonymous-authority claims.** "Experts agree…" / "Studies show…" — name the source or don't make the claim.
- **AI-generated images without disclosure.** If we use a hero image generated by an image model, it gets cited in the alt text. (Currently the 27 hero photos in `/public/assets/topic-images/` are stock photography or commissioned art, not AI-generated.)
- **Cookies the user can't opt out of.** GA4 is wired with Consent Mode v2; the cookie banner offers genuine accept/decline (no dark pattern).

If any of these surfaces is up for discussion as a future feature, treat it as a deliberate pivot from the brand position, not a routine task.

---

## Reusability — for adapting to a new niche

If you're using this style guide as the template for a similar calculator-first site in a different niche (e.g., HVAC contractor SaaS, EV TCO consumer site, home renovation estimator, solar microgrid sizing):

The transferable parts:
- The voice (plain English, direct, honest, source-cited)
- The disclaimer pattern (planning ranges not bids; verify with licensed professional)
- The numeric-sourcing rules (every claim links to a primary source)
- The AI-slop blacklist
- The "no funnel" position is optional — if you're building a lead-gen product, the brand position changes. Just be deliberate about it.

The niche-specific parts:
- Replace OBBBA references with whatever regulatory landscape applies in your domain
- Replace IRS / DOE / NEEP / ENERGY STAR with the primary-source canon for your niche
- Replace state-by-state programmatic SEO with whatever geographic dimension your domain has (state, country, utility service area, fuel mix, climate zone)
- Replace the homepage's "Typical: $X-$Y" card pattern with whatever the headline unit of your niche is (annual savings, monthly bill, total ownership cost, etc.)

The pattern itself — calculator + transparent inputs + cited sources + planning-range disclaimers + programmatic SEO + guides — is broadly applicable.
