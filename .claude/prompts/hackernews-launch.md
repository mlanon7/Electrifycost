# HackerNews "Show HN" launch kit

The single highest-leverage lever for breaking the position plateau. A successful Show HN produces 5K–50K sessions + 20–100 backlinks in 48 hours, which lifts head-term rankings off page 7. One-shot — the window is open now (days old, indexed, differentiated) and closes ~day 60 when the site becomes "another electrification site."

---

## Title variants (pick one — test order)

HN titles must be factual, no hype, no emoji, no clickbait. Front-load the interesting noun.

1. **`Show HN: Source-cited home electrification cost calculators, no email gate`**
2. **`Show HN: I built 38 home-electrification cost calculators with every number cited`**
3. **`Show HN: Heat pump / solar / EV cost calculators that show their sources`**
4. **`Show HN: A no-funnel cost calculator for electrifying your home`**

Recommended: **#1**. "Source-cited" + "no email gate" are the two things HN values (rigor + anti-dark-pattern). Under 80 chars.

## Post timing

- **Tuesday–Thursday, 8:00–9:30am ET.** That's when HN's daytime US audience is ramping and the new queue moves fast enough to get eyes but isn't yet saturated.
- Avoid Friday–Sunday (lower traffic) and Monday (backlog from weekend).
- Submit, then be available for the next 4–6 hours to answer every comment quickly. Engagement velocity in the first 2 hours determines whether it hits the front page.

## The URL to submit

`https://electrifycost.com/` (homepage — shows the full breadth of 38 calculators)

## The first comment (post immediately after submitting)

HN convention: the author drops a "context" comment right after submitting. This is where you tell the story. Keep it honest, technical, and free of marketing voice.

```
I'm a structural engineer (PhD, PE) and kept hitting the same wall when
researching my own home's electrification: every "cost calculator" online
either gates the result behind an email, funnels you to a contractor lead
form, or quotes a single national average that's useless for my state.

So I built the thing I wanted. Every number in the calculators is in a
version-controlled CSV with a primary-source citation (IRS, DOE, EIA, BLS,
NREL, NEEP, ENERGY STAR) and a last-reviewed date. ~200 sources listed at
/sources/. No email gate, no contractor funnel — just low/mid/high installed
cost bands with rebates applied, calibrated to your state's labor rates,
energy prices, and climate zone.

Stack: Astro static-first with React island calculators, Tailwind, CSV-as-
database (Vite ?raw imports), Vercel. The whole data layer is editable in a
spreadsheet, which matters because rebate programs change constantly — OBBBA
killed the federal 25C/25D credits at the end of 2025, and state programs
(Mass Save, NYSERDA) change their caps mid-year.

Things I know are rough: head-term SEO rankings are still climbing (it's
days old), some guides need diagrams, and the data needs quarterly review to
stay fresh. Happy to talk about the calculator engine, the CSV-first data
model, or the OBBBA federal-credit logic.

What home-electrification cost questions am I missing?
```

## Engagement strategy (first 6 hours)

- **Answer every top-level comment within 15 minutes** for the first 2 hours. Velocity matters.
- **Don't get defensive.** HN will poke holes — "your solar $/W is off", "you're missing X rebate", "the geothermal number looks high." Thank them, fix it live if you can, and say so. "Good catch — just updated the CSV, will deploy in a few minutes" is the best possible HN response.
- **Lean into the technical.** HN loves the CSV-as-database decision, the no-funnel stance, the source-citation rigor. Talk shop.
- **Don't argue politics.** Electrification + OBBBA can attract political comments. Stay strictly on cost/engineering/data. "I just publish the numbers; the calculator works the same regardless of policy view" defuses it.

## What to have ready before launching

- [ ] Site fully deployed and fast (run Lighthouse — LCP < 2.5s on the homepage)
- [ ] No console errors on any flagship calculator
- [ ] The `/about/` page live (HN clicks through to "who built this")
- [ ] GA4 + GSC live so you can watch the spike in real time
- [ ] 2–3 hours of clear calendar to babysit the thread
- [ ] A couple of known-rough-edges you can fix live (builds goodwill when you fix a reported issue within the thread)

## After the launch

- The traffic spike itself is temporary (24–72 hours). The VALUE is the backlinks: the HN thread, plus the inevitable reposts (Reddit, Twitter/X, niche newsletters that monitor HN) each become a backlink.
- Within 1–2 weeks of a successful HN run, watch GSC: head-term positions should improve as Google processes the new backlink profile + behavioral signals.
- Save the HN thread URL — it's a permanent backlink and a social-proof asset for the About page ("featured on Hacker News").

## If it flops

Most Show HN posts don't hit the front page. If it stalls in /new:
- Don't repost the same URL (HN penalizes reposts)
- Wait 2–3 months, ship a meaningful new feature (e.g., the city-level pages), and submit again with a different angle ("Show HN: I added city-level cost data to my electrification calculators")
- In the meantime, the newsletter outreach + Reddit seeding are the backup levers

## Cross-post targets (after HN, same week)

If HN goes well, ride the momentum:
- **r/SideProject** (Reddit) — "I built X" posts do well
- **r/IndieHackers** + indiehackers.com
- **Lobsters** (if you have an invite) — smaller but high-quality, similar audience to HN
- **r/HomeImprovement, r/heatpumps, r/solar** — but ONLY as a genuine answer to a relevant question, not a launch announcement (those subs ban self-promotion)

## Adapting to a future project

The Show HN formula transfers to any developer-built tool with a genuine angle:
1. Factual title front-loading the interesting noun
2. First-comment story: the personal pain that motivated it + the technical decisions
3. Honest "here's what's rough" section (HN rewards humility)
4. Fast, non-defensive engagement
5. Fix reported issues live

The angle that works on HN: technical rigor + anti-dark-pattern stance + a real personal story. ElectrifyCost has all three.
