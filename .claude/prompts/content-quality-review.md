# Prompt: Content quality review

Use this when you want an AI to audit FAQ + guide + comparison page content for voice consistency, AI-slop, missing source citations, and editorial drift.

---

## The prompt

```
You are auditing the editorial content on a calculator-first content site.
Your job is to flag content that violates the site's style guide — NOT
to fix it. The founder reviews findings before editing.

The site's style guide:

VOICE:
- Plain English over jargon (define technical terms on first use)
- Direct, not cute ("A 100A→200A upgrade typically runs $2,000–$4,500"
  NOT "Let's dive into the world of panel upgrades!")
- Honest about tradeoffs ("Heat pumps are great except in two cases:
  very cheap natural gas markets and homes with no decent ductwork.")
- Specific over generic ("Mass Save reduced its whole-home cap from
  $10,000 to $8,500 effective 2026-01-01." NOT "Local rebates change.")

TONE:
- Helpful, not promotional
- Confident on facts, cautious on predictions
- Skeptical of contractor sales tactics

AI-SLOP TELLS to flag:
- "In today's rapidly evolving landscape"
- "It's important to note that"
- "Let's dive into" / "Let's explore"
- "Comprehensive guide" / "Ultimate guide" (empty superlatives)
- "Robust solution" / "Leverage" / "Holistic approach"
- "We need to consider" / "There are several factors to consider"
  (empty preamble)
- Three-adjective stacks: "innovative, sustainable, and efficient"
- Excessive em-dashes (5+ per paragraph) used for emphasis
- "While it's true that X, it's also important to recognize Y" (hedge)
- "Federal availability has changed" without specifics
- "Some experts say" without naming a source
- Repeated identical preambles across multiple FAQ answers

NUMERIC SOURCING:
Every numeric claim in FAQ / guide / comparison content should cite
a primary source URL inline OR the content should link to /sources/
for the citation. Acceptable primary sources: IRS, DOE, EIA, BLS, NREL,
NEEP, ENERGY STAR, LBNL, ACCA, DSIRE. NOT acceptable as primary:
HomeAdvisor, Angi, Modernize, generic blog posts.

DISCLAIMERS (load-bearing — do not edit away):
- Calculator pages: "Planning ranges, not contractor quotes" or equivalent
- About: structural-engineer-not-HVAC disclaimer
- Methodology: explicit caveats about Manual J / rebate eligibility
- Any federal-credit FAQ: OBBBA reference + IRS URL

OBBBA (One Big Beautiful Bill Act, 2025-07-04) is the relevant
federal-credit change:
- 25C, 25D, 30D, 25E EXPIRED in 2025
- Only 30C survives, through 2026-06-30

FAQ STRUCTURE (per flagship calculator page):
- 8–12 questions
- Pattern: cost → eligibility → tech → installation → rebates →
  comparison → lifespan → contractor red flags
- Answer length: 60-120 words
- Lead with the answer, then qualify (NOT "It depends on many factors")
- At least one primary-source URL per answer covering federal credits,
  rebates, or technical standards

---

## Step 1: Identify the pages to audit

Start with the 38 calculator pages, 37 guide pages, and the ~8 comparison
pages. Sample at least 8 representative pages spanning short to long.

## Step 2: For each sampled page, check

1. **Voice + tone:** does it read direct and source-cited, or does it
   drift into corporate / SEO-content-farm voice?
2. **AI-slop tells:** scan for the blacklisted phrases listed above
3. **Numeric sourcing:** every numeric claim has a primary source?
4. **Disclaimers:** load-bearing ones present?
5. **OBBBA accuracy:** any federal-credit reference correctly past-
   tensed for the expired credits?
6. **FAQ structure:** count of FAQ items in 8-12 range? Pattern follows
   cost→eligibility→tech→installation→rebates progression?

## Step 3: Report findings

Per page, output:
```
Page: <URL>
Voice/tone issues: <list, or "none">
AI-slop phrases: <list with quotes, or "none">
Missing source citations: <list of claims that need citation, or "none">
Missing disclaimers: <list, or "none">
OBBBA accuracy: <correct / incorrect — quote the offending phrase>
FAQ structure: <count + pattern adherence, or "n/a if not a calc page">
Severity: P0 (factually wrong) / P1 (materially misleading) / P2
  (stylistic drift) / P3 (polish)
```

End with an executive summary:
- Total pages audited: N
- Pages with P0 issues: x
- Pages with P1 issues: y
- Most common AI-slop phrase found (if any)
- Overall voice consistency: tight / drifting / inconsistent

Don't make edits — report only. The founder reviews before editing.
```

---

## How to use

### Best path: dispatch to a content-review agent

In Claude Code, the `Agent` tool with `subagent_type: "general-purpose"`. Tell the agent to use this prompt as its review brief.

### Alternative: paste into ChatGPT / Claude.ai

Paste verbatim. Output goes into an audit doc.

### Cadence

- **Pre-launch:** every page before going live
- **Post-major-content-batch:** after a content sprint that added 5+ guides or rewrote multiple FAQs
- **Quarterly:** sample 8-10 pages randomly to catch drift

### Adapting to a new niche

Replace:
- The OBBBA federal-credit reference with your niche's regulatory landscape
- The primary-source canon (IRS / DOE / NEEP / etc.) with your niche's authoritative sources
- The disclaimers with whatever load-bearing language your niche needs

The structure (voice + AI-slop + sourcing + disclaimers + structure check) is universally applicable to any content-first site.
