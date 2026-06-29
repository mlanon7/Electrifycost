# ElectrifyCost Product Audit — 2026-06-27 (Claude)

> Not a technical/SEO audit (those are elsewhere and the site passes them). This asks the
> harder question: is this a good, useful product real people will adopt, and what's the
> honest thing holding it back? Method: 5 independent honest lenses (first-time-user
> usefulness, trust/credibility, competitive reason-to-exist, growth/business reality, and
> an adversarial "why won't people use this") + a synthesis. The lenses fetched the live
> site directly and were given the hard truths (DR 2, ~438 impressions / 0 clicks, spam-only
> backlinks, deliberate no-funnel/no-email stance). They converged with unusual unanimity.

## Bottom line

You have built the best-sourced home-electrification cost calculator on the open web, and almost no one will ever see it. The product is not the problem. The fact that it answers the *last* question in a homeowner's journey — while being marketed to and findable by people asking the *first* — is the problem. Today it is the best-built calculator in a room with no one in it.

---

## The single necessary shortcoming

**There is no on-ramp for an undecided homeowner.**

The site only answers *"what will THIS specific install cost?"* — a question people ask right before they call contractors, at which point they get a binding quote instead of a planning range. The far larger early-stage audience — *"should I electrify?"*, *"is a heat pump worth it in my climate?"*, *"heat pump vs. gas furnace over 15 years?"* — is where the search volume, the curiosity, the shareable content, and the natural backlinks all live. The site had **nothing** pointed there.

This matters more than DR 2 or the backlink deficit because **those are symptoms.** A days-old domain ranks through topical relevance and earned links to genuinely useful early-funnel content — and the site had chosen not to produce the thing that earns either. Fix the discovery-stage content and SEO, links, and retention all become addressable. Leave it, and no amount of waiting, polish, or new calculators changes the outcome.

## What's genuinely excellent (and worth protecting)

- The trust layer is elite: 200+ primary sources with review dates, a real P.E. byline, transparent itemization, planning-ranges-not-bids. A skeptical engineer-homeowner trusts this over any lead-gen funnel.
- The calculators are decision-useful, not toys — real cost drivers (ductwork, panel risk, permits), state labor multipliers, rebates pre-applied.
- The Monte Carlo P10/likely/P90 is genuinely novel for bid-validation.

The quality is the reason this is fixable: a distribution problem solved with the same rigor as the product.

## Secondary shortcomings (all downstream of the necessary one)

| Problem | Why it compounds |
|---|---|
| Zero retention by design | One lookup, gone forever. No return-visit signal to Google, no direct channel. |
| Monte Carlo framed for engineers | "Roll 10,000 scenarios" signals complexity, not clarity. Lead with the most-likely number. |
| Breadth reads as thin | 38 calculators (sump pump, water softener) dilute link equity; a young site should feel focused. |
| Result ends where the hard question begins | No canonical "how to vet a contractor / compare bids" resource. |
| No outcome proof | Sources prove the *method*; nothing proves the *benefit*. No case studies, no real-install-vs-range data. |

## Recommended moves (honest about effort and odds)

1. **Build the top-of-funnel lane** — decision pages aimed at real demand, each ending in a calculator. The one move that can turn the tap; a content grind, not a code task.
2. **Earn 5–10 real editorial links by hand** — one novel linkable asset + outreach. Slow, unglamorous, the unavoidable cost of the no-funnel choice.
3. **Reframe Monte Carlo** — lead with the most-likely number; hide the jargon.
4. **Decide if "no email, ever" is a principle or a ceiling** — a non-gating rebate-change opt-in is the one ethical retention hook. (Owner's call: keep it for now — retention is the wrong problem before acquisition works.)
5. **Tighten the surface** — feature the 6–8 decisions that matter; demote the long tail.
6. **Add the "how to vet a contractor / compare bids" guide** — highest-friction next decision, inherently shareable.

## What was implemented in response (2026-06-27)

- ✅ #1 (foundation): `/guides/should-i-electrify/`, `/guides/is-a-heat-pump-worth-it/`, homepage hero on-ramp, guides-hub "Start here" section, internal links from heat-pump/whole-home hubs.
- ✅ #3: inline cost simulator reframed to lead with the likely range + most-likely number.
- ✅ #6: `/guides/hiring-a-contractor/`, linked from every flagship result panel.
- ⏳ #2 (earn links): not a code task — the new decision content + a future linkable dataset are the assets; outreach is manual.
- ⏭ #4 (email): deliberately not done; "no email, ever" kept.
- ◻ #5 (tighten): homepage already features ~20 of 38; a deeper trim/directory split is a follow-up.

**The one sentence to keep:** the site was a finished product searching for a distribution strategy it was explicitly designed not to have. This pass builds the front door; earning a few real links is the remaining, unavoidable grind.
