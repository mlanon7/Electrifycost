# Lesson 12 — Programmatic pages can be long and still be duplicates

**Date:** 2026-07-31
**Severity:** the most likely single cause of the site's search collapse
**Surface:** `src/pages/heat-pump-cost/[city].astro`, `src/pages/heat-pump-water-heater-cost/[city].astro`

## What went wrong

For two months the working theory for the traffic collapse was **authority** — not enough backlinks.
That theory was comfortable, partly true, and *wrong about the binding constraint*.

The 200 city pages average **2,260 words**. By every "thin content" heuristic they look healthy. They
were not thin. They were **near-identical**:

| Comparison | Unique tokens | Verdict |
|---|---|---|
| `heat-pump-cost/austin-tx/` vs `.../dallas-tx/` | **12 of 2,226** | **0% unique** — only the city name differs |
| `austin-tx` vs `boise-id` (different state) | 77 of 2,226 | 3% unique |
| City pages generally (10 samples) | — | **0–5% unique** |
| State pages generally (10 samples) | — | 2–7% unique |

Two same-state city pages differed **by the word "Austin"**. Nothing else. Not the price bands, not
the climate note, not the rebate list — because those are keyed to *state*, and every city in a
state resolves to identical state data.

That is scaled-content duplication. Bing de-indexes it aggressively (the site went to **exactly 0
impressions on 2026-07-02 and stayed there**), and Google quietly declines to index it (**317 pages
"Discovered – currently not indexed"**).

## Why the word count fooled us

Every prior audit measured **length** and passed. The giveaway was never length — it was
**variance**. Across 100 city pages the word count ranged 2,225–2,260: a **1.5% spread**. Real pages
written about real places do not cluster that tightly. A near-zero spread across a programmatic set
is the tell.

## How to measure it (do this before shipping any programmatic dimension)

```bash
strip(){ sed 's/<script[^>]*>.*<\/script>//g; s/<[^>]*>/ /g' "$1" \
         | tr -s ' \n' '\n' | sed '/^$/d' | sort -u; }

strip dist/<page-a>/index.html > /tmp/a.txt
strip dist/<page-b>/index.html > /tmp/b.txt

total=$(wc -w < /tmp/a.txt)
uniq=$(comm -23 /tmp/a.txt /tmp/b.txt | wc -w)
echo "uniqueness: $(( uniq * 100 / total ))%"
```

**Thresholds:**

| Uniqueness | Verdict |
|---|---|
| **< 10%** | Do not index. The variable is a label, not content. |
| **10–30%** | Marginal. Index only if the page answers a query the parent cannot. |
| **> 30%** | Genuinely differentiated. Fine to index. |

## The fix applied

`noindex, follow` on all 200 city pages, via a new `noindex` prop on `Layout.astro`.

- They **stay live and useful** — ~2,250 words, self-canonical, still linked from the by-city hubs.
- `follow` keeps internal link equity flowing to the calculators and state pages.
- `scripts/build-sitemap.cjs` now **auto-skips any page emitting `noindex`**, so the sitemap dropped
  700 → **500 URLs** with no path allowlist to maintain. Add a `noindex` page anywhere and the
  sitemap stays correct by itself.

State pages were **kept indexed**: at 2–7% unique they are weak but they carry genuinely different
data (labor multiplier, energy price, climate zone, rebate set), and they are the ones actually
earning impressions (`heat pump cost oregon`, position 24.9).

## The rules going forward

1. **Measure uniqueness before shipping a programmatic dimension.** Word count proves nothing.
2. **If the variable only changes a label, it does not deserve a URL.** A city that resolves to
   state-level data is a label. The state page already answers the query.
3. **Watch the variance, not the mean.** A tight word-count spread across a generated set is the
   duplication tell.
4. **Prefer fewer, differentiated pages.** A sibling site (PetPlanWise) with **DR 0** — lower
   authority than this site's DR 2, near-identical backlink profile, and 292 pages instead of 701 —
   was earning 28 organic visits and 25 keywords while this site earned zero. Page count was a
   liability, not an asset.
5. **`noindex` is not deletion.** It is the reversible, non-destructive way to remove a duplication
   liability while keeping pages for the visitors who reach them.

## Related

- `audit/FULL_AUDIT_2026-07-31.md` — the audit that found it
- `audit/archive/TRAFFIC_AUDIT_2026-07-24.md` — the earlier "authority-gated" diagnosis this corrects
- `.claude/lessons/08-astro-route-collision-patterns.md` — how these routes are shaped
