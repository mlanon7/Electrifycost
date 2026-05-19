# Prompt: Cold-start SEO strategy

Use this when a new (≤90-day-old) site needs an honest acquisition strategy. Avoids the trap of "apply to Mediavine immediately" advice that doesn't work for cold-start domains.

---

## The prompt

```
You are advising the founder of a calculator-first content site that has
been live for [N] days. The site is well-built — content depth + source
citations + programmatic SEO are all in place. But organic traffic is
near-zero because the domain is too young to have authority.

Your job: design an honest 90-day acquisition strategy that respects
cold-start realities. Most "SEO advice" online is for established sites
and doesn't work for cold-start domains. Be specific about what works
when domain authority = 0.

---

## Site context

URL: [the site URL]
Niche: [e.g., home electrification cost calculators]
Domain age: [N] days
Indexed pages (estimated): [number from GSC]
Total URLs in sitemap: [number]
Brand position: [no-funnel / lead-gen / hybrid]
Monetization wired: [analytics + reserved ad slots / + affiliate / + Mediavine]
Founder's available time: [hours per week]

## What I need from you

### Step 1: Honest cold-start expectations

A days-old site can't hit Mediavine. It can't hit affiliate ROI. It can
barely hit AdSense's revenue floor. Set realistic numerical expectations
for months 1-12 based on:
- Typical organic indexing ramp curves (4-8 weeks for the first 1K
  sessions; 6-9 months for 10K monthly sessions)
- The site's niche difficulty (which competitors are entrenched? what's
  the domain-authority gap?)
- The current acquisition baseline (zero — no backlinks, no traffic,
  no brand searches)

Don't sugarcoat. The first 4-6 months are essentially $0 regardless
of what's wired.

### Step 2: The acquisition levers that actually work for cold-start

For each lever, give: effort (hours), realistic outcome, time-to-effect.

DO INCLUDE these levers (they work for cold-start):
- Google Search Console setup + sitemap submission + manual URL
  inspection (~1 hour total; effect in 24-72 hours per URL submitted)
- Bing Webmaster Tools (parallel; same setup; ~30 min)
- Reddit seeding: genuinely useful answers in 5-10 niche subreddits
  (~30 min per useful answer; multi-week cumulative effect)
- HackerNews "Show HN" launch: one-shot lever (~1 hour to draft;
  potentially 5K-50K sessions in 48 hours if it lands)
- Newsletter outreach: email ~30 niche newsletters and blogs (~3-5
  hours to draft + send; 1-3% reply rate; each yes is a high-DA
  backlink)
- Directory listings: DSIRE for energy, Rewiring America's tools page,
  niche-specific aggregators (~2-3 hours for the legitimate ones)
- Content depth: more programmatic SEO surface, deeper guides
  (compounds over time; the first deep Google crawl sets topical
  authority signal)
- IndieHackers / r/SideProject / "Build in Public" launches: smaller
  than HN but cumulative
- Backlink outreach to .edu and .gov sites in adjacent topics

DO NOT INCLUDE these (they don't work for cold-start):
- Mediavine / Raptive / AdThrive application (traffic threshold not
  met; application gets ignored)
- Paid Google Ads / Facebook Ads (negative ROI at zero conversion
  baseline; better to keep that money in the bank)
- Email newsletter (no subscribers; just wires the infrastructure)
- Affiliate program signup beyond Amazon Associates (no traffic to
  convert)
- "SEO link building" services (low-quality backlinks now penalize)
- "Hire a freelance SEO" services (~$2K-$10K; cold-start sites can't
  recoup that cost)

### Step 3: Concrete 90-day plan

Week 1:
- Specific actions, expected outcome, time required

Weeks 2-4:
- Same structure

Weeks 5-8:
- Same

Weeks 9-12:
- Same

Each action item should be:
- Specific (a URL, a subreddit, a newsletter name)
- Time-bounded (hours, not "ongoing")
- Measurable (number of submissions, expected response rate)

### Step 4: The single highest-ROI action for a cold-start site

Identify ONE action the founder should take this week if they only
have 2 hours. Justify why it beats all alternatives.

For most cold-start content sites, the answer is one of:
- GSC + sitemap submission + manual URL inspection (highest-leverage
  passive move)
- A well-targeted HackerNews launch (highest-leverage active move)
- A 30-newsletter outreach email (highest-leverage active move for
  backlink quality)

Pick one. Justify it.

### Step 5: When to revisit the strategy

Set concrete trigger conditions:
- "When monthly sessions cross [N] → reconsider Mediavine application"
- "When monthly sessions cross [M] → wire affiliate cards"
- "If no organic ramp visible by day [X] → re-audit for technical
  blockers (indexing, schema, crawl errors)"

Don't leave this open-ended. The founder needs to know when to act
on which signal.

### Step 6: Cold-start traps to avoid

Specific anti-patterns for cold-start sites:
- Spending on paid ads before earned-traffic baseline exists
- Applying to Mediavine before traffic threshold (wasted application)
- Adding lead-capture forms before earning trust (kills bounce rate
  + ranking)
- Sticky popups / interstitials (Google penalizes; also looks
  desperate)
- "Aged backlink package" / "guest post network" services
  (low-quality links now penalize)
- Pivoting the niche before giving SEO 6+ months to compound

---

## Output format

Deliver as a single markdown report:
1. Honest cold-start expectations (revenue + traffic by month)
2. Lever-by-lever effectiveness table (DO include / DO NOT include)
3. Concrete 90-day week-by-week plan
4. The single highest-ROI action this week
5. Trigger conditions for strategy revisions
6. Cold-start traps to avoid

Total length: 1,500-3,000 words. No fluff. Every recommendation
should be actionable in under 2 hours of founder time.
```

---

## How to use

### Best path: paste into Claude.ai or ChatGPT with the site context filled in

This is a strategy prompt, not a code-execution prompt. It belongs in a chat session, not as a Claude Code agent.

### Update the bracketed values

Before pasting, fill in `[N] days`, `[the site URL]`, `[number from GSC]`, `[hours per week]`, etc. The strategy specifics depend on these.

### Adapting to a new niche

Replace the example numbers (Mediavine thresholds, indexing curves) only if they're different in your niche. The cold-start math is universal:
- Indexing takes 4-8 weeks for first 1K sessions, ANYWHERE
- Ad networks require established traffic, EVERYWHERE
- Backlink outreach + content depth + community seeding are the only levers that work at zero authority

The Reddit subreddits + newsletters list IS niche-specific. Curate yours.

## When this prompt is wrong

If the site has been live for **6+ months** with no traffic, this prompt's "be patient, indexing compounds" advice is wrong. At that point the issue is probably technical (sitemap errors, robots.txt blocks, no internal linking, thin content, low-quality backlink profile). Use a forensic audit prompt instead.
