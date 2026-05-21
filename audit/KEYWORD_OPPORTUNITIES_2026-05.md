# Keyword / page opportunities — 2026-05

Derived from: (1) the GSC export (150 real queries the site already gets impressions for), (2) WebSearch industry validation, (3) systematic long-tail modifier patterns. No paid-tool volume data — prioritization is by **winnability for a young site** (low competition) + **GSC-proven demand** + **existing data-readiness**, NOT raw volume.

Guiding principle (from GSC analysis): the site ranks for long-tail/local/specific queries (pages 1-3) but NOT head terms (pages 7-9). Build more long-tail; don't chase head terms until domain authority arrives.

---

## TIER 1 — Build now (GSC-proven + winnable + data exists)

These have direct GSC evidence, low competition, and the data/engine already exists. Same programmatic pattern as the sqft + city pages already shipped.

| Opportunity | URL pattern | GSC evidence | Notes |
|---|---|---|---|
| **Heat pump by tonnage** | `/2-ton-heat-pump-cost/`, `/3-ton-`, `/4-ton-`, `/5-ton-`, `/1.5-ton-` | "1 ton heat pump cost", "14 seer heat pump cost" | Distinct query pattern from the sqft pages. Industry data: 2-ton $3.5k-5.5k, 3-ton $9k-13k, 4-ton $8k-15k. 5 pages. |
| **Heat pump operating cost calculator** | `/heat-pump-operating-cost-calculator/` | "heat pump operating cost calculator", "heat pump electricity cost calculator", "heat pump electricity cost" | "Cost to run" intent (vs install cost). Engine already computes operating cost. Pairs with the existing calculators. |
| **Ducted heat pump cost** | `/ducted-heat-pump-cost/` | "ducted heat pump cost", "cost of ducted heat pump system", "cost to install ducted heat pump" | Distinct from mini-split/ductless. Maps to an existing calculator scenario. |
| **Electric furnace cost** | `/electric-furnace-cost-calculator/` | "electric furnace cost", "electric heat cost" | We have gas-furnace; electric-furnace is a gap. Also captures "electric heating cost calculator". |

---

## TIER 2 — Brand pages (zero current coverage, high commercial intent)

We have ZERO brand pages. Brand + cost queries are high-intent and moderate-competition. Requires brand-specific cost data (a new CSV: `brand-cost-multipliers.csv` keyed by brand, OR brand pages that frame the existing cost bands with brand-specific context). More research per brand, but high payoff.

| Cluster | URL pattern | Brands (priority order) |
|---|---|---|
| **Heat pump by brand** | `/{brand}-heat-pump-cost/` | Mitsubishi, Carrier, Trane, Bosch, Daikin, Lennox, Goodman, Rheem |
| **HPWH by brand** | `/{brand}-heat-pump-water-heater-cost/` | Rheem, AO Smith, Bradford White, Rinnai, Sanden |
| **EV charger by brand** | `/{brand}-ev-charger-installation-cost/` | ChargePoint, Wallbox, Tesla, Emporia, Grizzl-E |
| **Home battery by brand** | `/{brand}-battery-cost/` | Tesla Powerwall, Enphase IQ, LG, Franklin |

Industry data confirms wide brand spread (e.g., Bosch ~25-30% cheaper than Trane at same SEER), so brand pages have genuine differentiating content, not just templated filler.

---

## TIER 3 — GSC gaps, medium priority

| Opportunity | URL pattern | GSC evidence | Notes |
|---|---|---|---|
| **Replace furnace with heat pump** | `/replace-furnace-with-heat-pump-cost/` | "replace furnace with heat pump cost", "heat pump and furnace cost", "cost of heat pump and furnace" | Conversion-intent. A `heat-pump-vs-gas-furnace` comparison exists but not this exact-match action query. |
| **Dual-fuel heat pump cost** | `/dual-fuel-heat-pump-cost/` | "heat pump and furnace cost" | Hybrid system (HP + gas backup). Existing calculator scenario. |
| **Generic heating cost calculator** | `/heating-cost-calculator/` | "heating costs calculator", "electric heating cost calculator" | Broad operating-cost tool comparing fuels. Overlaps with operating-cost calc — could merge. |
| **1.5 / 2 / 3 ton AC by tonnage** | `/{n}-ton-ac-cost/` | (extrapolated from HP tonnage pattern) | AC equivalent of the tonnage pattern. |

---

## TIER 4 — Deprioritize (low winnability for a young site)

| Opportunity | Why deprioritize |
|---|---|
| Solar sub-pages (feed-in tariff calc, cost-per-kWh calc, solar payback variants) | GSC shows solar queries rank position 73-99. Solar SEO is dominated by EnergySage / SolarReviews with decade-old authority. Not winnable for 12+ months. Keep existing solar pages; don't add more. |
| "grid upgrade calculation ev charger" | Too niche; 1 impression. |
| Head terms ("heat pump cost", "solar panel cost calculator") | Already have pages; they rank page 7-9. Won't improve without backlinks (HN launch), not new pages. |

---

## Recommended build order

1. **Tonnage pages (5)** — clone the sqft-page pattern, ~30 min, GSC-proven, data ready.
2. **Heat pump operating cost calculator** — distinct "cost to run" intent, engine exists, ~1 hr.
3. **Ducted heat pump cost + electric furnace cost** — 2 gap pages, ~45 min.
4. **Brand pages (Tier 2)** — highest payoff but needs a brand-cost data layer first. ~half day. Start with heat pump brands (8 pages), then HPWH/EV/battery brands.
5. **Tier 3 conversion/dual-fuel pages** — after Tier 1-2 land and you can measure which patterns convert.

Total Tier 1: ~8 new pages, all GSC-justified, all winnable. Tier 2 brand pages: ~25 pages, higher effort, higher payoff.

---

## Long-tail modifier patterns (reference for future expansion)

Systematic modifiers that map to programmatic page opportunities across any module:

- **By size/capacity:** tonnage (HP/AC), gallons (water heater), kW (solar), amps (panel), kWh (battery)
- **By brand:** the dominant 5-8 brands per category
- **By type:** ducted / ductless / central / split / packaged
- **By location:** state (done), city (done), metro
- **Operating cost:** "cost to run X", "X electricity cost", "X monthly cost", "X operating cost calculator"
- **Action/conversion:** "replace X with Y", "convert gas to electric", "switch from X to Y cost"
- **Comparison:** "X vs Y cost" (several exist)
- **Intent (→ FAQ content, not new pages):** "is X worth it", "how long does X last", "do I need X"

The first four (size, brand, type, location) are the programmatic-SEO goldmines — each multiplies the URL count with thin per-page competition. The site has done location; size + brand are the next two dimensions.

Last reviewed: 2026-05-19.
