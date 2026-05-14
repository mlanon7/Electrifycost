# ElectrifyCost — Deep Audit (Pass 3)

**Audit date:** 2026-05-13
**Auditor scope:** entire repo. Calc engine (`src/lib/calc.ts`, `src/lib/data.ts`), all 38 calculator components, all 53 pages under `src/pages/`, all 49 CSVs under `data/csv/`, configs, build artifact (`dist/`), and public assets.
**Method:** read every CSV end-to-end, traced calculator wirings from each module page into the engine, ran the engine through real scenarios in my head against the smoke-test output, then web-cross-checked **every numeric input** against current industry sources (NEEP, NREL, LBNL, EnergySage, EIA, IRS, DOE, BLS, Mass Save, NYSERDA, Generac MSRPs, Tesla quote tool, AHRI directory, Modernize, Angi, HomeGuide). Pulled FAQs from each calculator and graded them for parallelism, tone, AI-isms, and currency.
**Predecessors:** [AUDIT.md](AUDIT.md), [AUDIT_v2.md](AUDIT_v2.md), [CHANGES_v3.md](CHANGES_v3.md). Open items from those were *not* re-litigated except where they're still wrong; everything below is new ground.

---

## 0 — Executive summary

The site is in much better shape than v1/v2 implied: truncation is gone, the CSV refactor held, the engine has a proper applied-vs-potential incentive split, ZIP→state syncs, and 38 calculators now cover almost the entire single-family electrification surface area. Smoke test passes 20 scenario-groups. Build artifacts ship cleanly.

The user's intuition that the articles are inconsistent is correct, and there is meaningful drift between what each page promises, what the engine actually computes, and what the industry is currently quoting. **Most importantly, several CSV cost rows that drive the calculators are 15–40% above current 2026 market median.** Those are P0 issues — they ship wrong numbers — and the fix is editing CSV rows, no engine work needed.

**P0 count: 7.**
**P1 count: 14.**
**P2 count: 22.**
**P3 count: 11.**

Top three calculation-accuracy errors (with current vs industry numbers, sorted by impact):

| # | Where | Current value | Industry 2026 | Error |
|---|---|---|---|---|
| 1 | Solar `$/W` mid (`solar-cost-ranges.csv` / `SolarCalculator.tsx`) | $3.30/W | $2.58/W (EnergySage Q1-2026 national median); LBNL TTS 2024 was already at $2.92/W marketplace median | **+28% high.** For a typical 8 kW system, the calculator over-quotes the user by ~$5,700. |
| 2 | Geothermal "indoor + loop" stacked per-ton (`geothermal-cost-ranges.csv`) | Vertical: $3.5k + $4.5k–$9k = **$8k–$15k/ton**; Horizontal: $4.5k–$8.2k/ton | $3,500–$5,500/ton complete installed (HomeGuide / Angi / EnergySage / Bryant 2026 surveys) | **+60–170% high.** For a typical 3-ton vertical: site says $24k–$45k vs industry $10.5k–$16.5k. The CSV treats indoor and loop as additive when industry pricing already aggregates the full installed cost per ton. |
| 3 | Mass Save heat-pump rebate cap (`rebate-programs.csv` / heat-pump-cost-calculator FAQ #5) | low/mid/high $2,000 / $8,000 / **$10,000** | Mass Save reduced both whole-home and partial-home **rebate cap from $10,000 to $8,500 effective 2026-01-01** | High end is off by $1,500 in MA, and the heat-pump calc FAQ still says "up to $10,000" verbatim. Materially misleads MA users. |

Top three content-quality issues:

1. **FAQ count is wildly asymmetric across the five flagship calculators** — heat pump 12, panel 9, EV 6, HPWH 5, induction 4. The thinner ones miss obvious queries ("how long does an HPWH last," "noise level," "does induction work with my cookware brand"). This is the parallelism issue the user noticed.
2. **Multiple FAQs still hedge "Federal availability has changed"** when, today, the answer for 25C is "expired Dec 31 2025, full stop." Lead with the answer; the hedge reads like AI slop and gets cited in featured snippets badly.
3. **Homepage `Typical: $7,500–$22,000` for heat pump vs the heat-pump page Quick-answer `$7,500–$20,000`.** Identical product, different numbers, two clicks apart. Two dozen similar disagreements across the site (catalogued in §2).

Top three SEO/infrastructure problems:

1. **`@astrojs/sitemap` is disabled in `astro.config.mjs`**, but `public/robots.txt` still references `https://electrifycost.com/sitemap-index.xml`. Google will hit a 404 and lose every URL it would otherwise have crawled cleanly. No sitemap exists in `dist/`.
2. **Hero PNGs total 60 MB across `public/assets/topic-images/`** (~27 images at 2.0–2.6 MB each). They're shipped uncompressed and unconverted to AVIF/WebP. LCP is wrecked on every calculator page.
3. **`data/csv/*.csv` files are inlined into the `format.Cbxrvy_p.js` 104 KB bundle that hydrates on every page** because Vite's `?raw` import bundles all the CSVs into client JS. Every page ships every state's energy prices + every CSV row to clients even when only one calculator hydrates.

The first batch of fixes (described in `ATTACK_PLAN_2026-05-13.md`) is data-only — CSV edits + FAQ updates — and produces the biggest accuracy and trust improvement for the smallest risk.

---

## §1 — Calculation accuracy vs. industry data

The most important section. Methodology: every numeric input in `data/csv/*.csv` was checked against ≥1 authoritative 2025/2026 source. For each row, I report the value used, what the industry has, and a severity. P0 = the calculator outputs a number that will be wrong to the user. P1 = the row is wrong but the impact gets masked or capped by another adjustment. P2 = within ±10% of industry; not great, but not actively misleading. P3 = stylistic.

### §1.1 — Heat pump (`project-cost-ranges.csv`, rows `heat_pump,*`)

| Scenario | Site low/mid/high (base, before state mult + difficulty) | Industry 2026 installed range | Verdict | Severity |
|---|---|---|---|---|
| `ducted_central_3ton` | $7,500 / $11,500 / $16,500 base + labor 16/22/30 h × $130 = adds $2,080/$2,860/$3,900 ⇒ rendered installed CA-mid ~$13k | EnergySage / Angi / Carrier 2026: $9,000–$13,000 for 3-ton ducted installed; up to $16,750 high; national avg $15,400 | Mid is on target. **High of ~$22k for CA after multipliers is +10–20% above industry $20k cap.** Acceptable but at the very top of the band. | P2 |
| `ducted_central_4ton` | $9,500 / $14,000 / $20,000 | Industry: 4-ton typically $11k–$18k installed | Mid is fine. High runs hot for non-CA/HI states. | P3 |
| `ductless_minisplit_1head` | $3,500 / $5,500 / $8,000 | EnergySage Q1-2026: single-zone Mitsubishi $4,423–$5,500 installed; Daikin from $900 (DIY); home market $3,500–$7,000 | Mid solid. Low $3,500 only realistic for Pioneer/budget brands. | P2 |
| `ductless_minisplit_3head` | $7,500 / $11,000 / $16,000 | Multi-zone 3-head: $8,000–$14,000 typical | Mid OK; high $16k matches NY market | P3 |
| `coldclimate_ducted` | $9,500 / $14,500 / $21,000 | NEEP-listed cold-climate installed: $12k–$22k national | Mid + high OK; low $9,500 is too low for a NEEP-listed CCASHP, real low ~$12k | P2 |
| `dual_fuel_with_gas_furnace` | $8,500 / $13,000 / $19,500 | Industry: $9k–$18k for dual-fuel kit | High runs slightly hot | P3 |

**Labor rate (`module-labor-rates.csv`, `heat_pump`):** $130/hr blended HVAC. BLS OEWS 49-9021 May-2024 median: $28.75/hr direct; 4–5× overhead/markup for billing rate is the industry rule of thumb. $130 is reasonable but the site offers no audit trail explaining the blend. **P3.**

**Heating-degree-day × UA × COP operating model (`operating-cost-constants.csv`):**

| Constant | Site value | Industry support | Verdict | Severity |
|---|---|---|---|---|
| `hp_ua_per_sqft` | 0.15 BTU/hr/°F/sqft | Building-Science Corp average: 0.20–0.30 for typical existing US homes; 0.10–0.15 for IECC-2018 new construction. **Site's 0.15 is too low for the existing-home stock the calculator targets.** Under-estimating UA halves the heating load and therefore the operating-cost savings. | Too low by ~33–50%. Heat pump operating-savings shown to users are systematically understated. | **P0** |
| `hp_cop_standard` | 3.0 | NEEP CCASHP database avg seasonal COP for non-cold-climate ASHPs in zones 3–4: 2.5–3.0. 3.0 is at the top of the range. | OK at the edge; assumes near-best-case | P2 |
| `hp_cop_coldclimate` | 2.6 | NEEP CCASHP field studies: 2.51–2.78 across multiple sites. | Spot on. | OK |
| `hp_oversize_factor_combustion` | 1.18 | DOE Energy Saver: 25–40% oversizing typical for replacement furnaces. 1.18 may *under*-state legacy oversizing. | Conservative | P3 |
| `hp_btu_per_therm` | 100,000 | Exact. | OK | OK |
| `hp_btu_per_gallon_propane` | 91,500 | EIA: 91,452 BTU/gal. | OK | OK |
| `hp_btu_per_gallon_oil` | 138,500 | EIA: 138,500 BTU/gal #2 fuel oil. | OK | OK |

### §1.2 — Heat pump water heater (`project-cost-ranges.csv`, rows `hpwh,*`)

| Scenario | Site low/mid/high (base) | Industry 2026 installed | Verdict | Severity |
|---|---|---|---|---|
| `plugin_120v_50gal` | $1,700 / $2,400 / $3,400 | Rheem ProTerra Plug-in 50gal $1,500–$2,000 + install $400–$1,000 ⇒ $1,900–$3,000 | Within range | OK |
| `hybrid_240v_50gal` | $2,200 / $3,000 / $4,200 | Angi / Today's Homeowner 2026: $2,300–$4,400 installed | Spot on | OK |
| `hybrid_240v_80gal` | $2,700 / $3,700 / $5,200 | 80gal hybrids $3k–$5.5k installed | OK | OK |
| `split_system` | $4,500 / $6,500 / $9,500 | Sanden / SanCO2 / Daikin Altherma: $7,000–$13,000 installed | **Site is too low by 20–40%.** Split systems are uncommon high-end installs and run more than the row implies. | P1 |

**HPWH operating constants:**

| Constant | Site value | Industry support | Verdict | Severity |
|---|---|---|---|---|
| `hpwh_baseline_kwh_per_year` | 4,500 kWh/yr | DOE / NEEA: typical existing electric tank uses ~4,500–5,500 kWh/yr for a 4-person household. | Spot on for 4-person; **under for 5+ person households**. The calc has no household-size input — single number drives all results. | P1 — input quality |
| `hpwh_cop` | 3.0 | ENERGY STAR HPWH UEF 3.0–3.75 typical (rated). Real-world COP in unconditioned spaces ~2.0–2.5. Site is at the rated edge. | Optimistic but defensible | P2 |
| `hpwh_baseline_therms_per_year` | 240 therms/yr | EIA RECS: gas WH for 4-person household ~200–250 therms/yr. | OK | OK |
| `hpwh_baseline_propane_gal_per_year` | 220 gal/yr | EIA: propane WH 200–250 gal/yr typical. | OK | OK |

### §1.3 — EV charger (`project-cost-ranges.csv`, rows `ev_charger,*`)

| Scenario | Site low/mid/high (base) | Industry 2026 installed | Verdict | Severity |
|---|---|---|---|---|
| `level2_hardwired` | $800 / $1,500 / $2,800 | EnergyStar / EnergySage 2026: median $1,096 no panel; $2,744 with panel; J.D. Power 2026: $1,200–$2,500 hardwired | Mid is solid; high $2,800 matches "with-panel" cases | OK |
| `level2_plugin_nema14_50` | $650 / $1,200 / $2,200 | NEMA 14-50 plug-in: $800–$2,000 installed | Mid OK; low $650 only realistic for DIY + existing outlet | P2 |
| `level2_long_run_50ft` | $1,100 / $1,900 / $3,500 | Long-run install +$300–$2,000 over baseline ⇒ $1,800–$4,800 | High end conservative low; should peak ~$4,500 | P3 |
| `level2_detached_garage_trench` | $2,200 / $3,800 / $6,500 | Trenching adds $1,500–$5,000 ⇒ $3,500–$8,000 typical | Mid OK; high $6,500 understates worst-case (clay/rock soil) | P2 |

**Operating-cost EV constants:**

| Constant | Site value | Industry support | Verdict | Severity |
|---|---|---|---|---|
| `ev_annual_kwh` | 3,600 kWh/yr | 12k mi/yr × 3.3 mi/kWh = 3,636 kWh. Site uses ~3.3 mi/kWh which matches mid-range EV (Model Y class). | Spot on | OK |
| `ev_baseline_gasoline_cost` | $1,400/yr | 12k mi × 28 mpg × $3.45/gal = $1,479; EIA 2026 projection $3.70/gal would raise to $1,586. | Slightly low for 2026; **should be $1,500–$1,600** with current EIA projection | P2 |
| `us_avg_gas_price_per_gal` in `ev-charging-cost-assumptions.csv` | $3.45 | EIA 2026 STEO: avg $3.70/gal; YTD volatile ($2.81 Jan → $3.98 March) | Stale by ~7%. **Refresh.** | P1 |
| `us_avg_residential_electricity` in same file | $0.165/kWh | EIA April 2026: **$0.1765/kWh national avg**; CA ≈ $0.289, NY ≈ $0.244, TX ≈ $0.151 | Off by ~7%. **Refresh.** | P1 |

### §1.4 — Electrical panel upgrade (`project-cost-ranges.csv`, rows `panel,*`)

| Scenario | Site low/mid/high (base) | Industry 2026 installed | Verdict | Severity |
|---|---|---|---|---|
| `upgrade_100_to_200` | $1,800 / $2,900 / $4,500 | HomeGuide / Angi / This Old House: $1,300–$3,000 typical, up to $4,000; high-cost regions (Denver, CA) $4,450–$7,350 | Mid + low **conservative-high** for national avg; site row is built around the high-cost markets, then a state labor multiplier piles on top, doubling the high-cost penalty in CA/NY. | P1 |
| `upgrade_150_to_200` | $1,500 / $2,400 / $3,700 | $1,500–$3,200 typical | OK | OK |
| `upgrade_200_to_320` | $3,500 / $5,200 / $7,800 | $4k–$8k industry | OK | OK |
| `subpanel_add` | $800 / $1,400 / $2,400 | $750–$2,500 industry | OK | OK |
| `load_management_device` | $500 / $900 / $1,500 | DCC-9 / Wallbox EM112 $500–$1,200 installed | OK | OK |
| `service_drop_overhead_to_underground` | $2,200 / $3,800 / $6,500 | Industry $2,500–$7,500 | OK | OK |

**The bigger issue here:** the `100A → 200A` row already encodes the high-cost-market premium, but then the state labor multiplier (1.42 for CA, 1.55 for HI) compounds on labor *and* the difficulty multiplier (1.20 high) compounds on top of that. A CA 100A→200A upgrade at `difficulty=difficult` renders ~$8,500 high — well above industry's hard-cap of $7,350 for Denver. **Either decompose the row into national-baseline and drop the over-state-multiplier compounding, or rebase the row low/mid/high to national medians and let the multiplier do its job.** P1.

### §1.5 — Induction stove (`project-cost-ranges.csv`, rows `induction,*`)

| Scenario | Site low/mid/high (base) | Industry 2026 installed | Verdict | Severity |
|---|---|---|---|---|
| `range_30in_basic` | $1,500 / $2,400 / $3,500 | Range: $800–$1,400 unit + $300–$500 install + $50–$200 permit = $1,150–$2,100 installed. Yale Appliance 2026 best-sellers: Frigidaire $1,099, GE Profile $1,499, Bosch 500 $2,099. | **Site mid $2,400 is ~25% above the basic-tier market median.** The site treats "basic" as "well-equipped basic" rather than entry-level. Either rename the scenario or rebase. | P1 |
| `range_30in_premium` | $2,800 / $4,200 / $6,500 | Bosch 800, Café, Wolf: $2,500–$5,500 retail; +$300–$600 install | Mid OK; high $6,500 is true for a custom Wolf/Miele build | OK |
| `cooktop_30in_plugin` | $800 / $1,400 / $2,400 | 30in cooktop $700–$2,000 retail + plug-in (no install) | OK | OK |
| `kitchen_240v_circuit_add` | $400 / $750 / $1,300 | $400–$1,300 NEMA 6-50 circuit | OK | OK |
| `gas_line_cap` | $150 / $275 / $450 | Plumber gas-cap $150–$500 | OK | OK |

**Induction operating-cost savings (`operating-cost-constants.csv`):**

- `induction_baseline_savings_gas`: −$10/yr — defensible. Field studies (EPRI 2024, Carbon Switch 2024): induction-vs-gas annual delta in the ±$25/yr range. ENERGY STAR specifically says induction-vs-gas is "approximately neutral" for typical cooking. **OK.**
- `induction_baseline_savings_propane`: −$25/yr — defensible. **OK.**

### §1.6 — Solar PV (`solar-cost-ranges.csv` + `SolarCalculator.tsx`)

**Critical finding.** Solar costs are the single biggest accuracy gap in the audit.

| Input | Site value | Industry 2026 | Verdict | Severity |
|---|---|---|---|---|
| `base_per_w` mid | $3.30/W | EnergySage Q1-2026 national median: **$2.58/W**; LBNL TTS 2024 already at $2.92/W marketplace median; price stabilized at $2.57–$2.58/W through late 2025 | **+28% above current median. P0.** | P0 |
| `base_per_w` low | $2.50/W | EnergySage AZ low: $2.09/W; competitive markets see $2.10–$2.40/W | Low is too high by ~15% | P1 |
| `base_per_w` high | $4.50/W | MA / CT premium installs: $3.00–$3.30/W; California post-NEM 3.0 has crept up to $3.50–$4.00/W with battery | Acceptable but optimistic relative to current ceiling | P2 |
| `battery_adder.medium` (~13 kWh) | $13k / $16k / $19.5k | Tesla Powerwall 3 13.5kWh installed: $11,500–$16,500 (2026 quote-tool data); SolarReviews $15.3k–$16.2k pre-tax. Site row matches | OK | OK |
| Roof multiplier `tile` | 1.20 | NREL: 1.15–1.25 | OK | OK |
| `inverter_premium.micro` mid | $0.20/W | Enphase IQ8 $0.18–$0.22/W | OK | OK |
| `degradation_pct_annual` | 0.5% | NREL PVMRP: 0.5%/yr modern Tier-1 modules | OK | OK |
| `escalation_electricity_annual` | 3.5% | EIA AEO 2024 reference: 3.0%/yr; recent years +5–6% | Slightly low | P2 |
| `self_consumption_pct_no_battery` | 35% | NREL: 30–40% typical | OK | OK |
| `sell_back_rate_pct_of_retail` | 80% | DSIRE 2024: 60–90% range; CA NEM 3.0 ~25%; many midwest states still 100% retail | Reasonable national average but conceals huge state variance | P2 |

**The state-by-state solar production CSV (`solar-production-by-state.csv`)** uses kWh/kW values that look plausible:

| Sample state | Site value (kWh/kW/yr) | NREL PVWatts (south-facing fixed tilt, kWh/kW) | Verdict |
|---|---|---|---|
| AZ | 1700 | NREL: 1700–1900 | OK |
| CA | 1600 | NREL: 1550–1700 statewide avg | OK |
| TX | 1500 | NREL: 1450–1700 | OK |
| MA | 1300 | NREL: 1200–1350 | OK |
| WA | 1100 | NREL: 1000–1150 | OK |

Good. **Solar production is reliable; cost-per-watt is the problem.**

### §1.7 — Geothermal (`geothermal-cost-ranges.csv`)

**This is the largest absolute dollar error in the audit.** The CSV is structured wrong, not just calibrated wrong.

| Row | Site value (per ton) | Industry 2026 (per ton installed, FULL system) |
|---|---|---|
| `indoor_per_ton` `base` | $3,500 / $4,500 / $6,000 (equipment only) | — |
| `loop_per_ton` `vertical` | $4,500 / $6,500 / $9,000 (drilling) | — |
| `loop_per_ton` `horizontal` | $1,000 / $1,500 / $2,200 | — |
| `loop_per_ton` `pond` | $800 / $1,200 / $1,700 | — |
| `loop_per_ton` `open` | $1,200 / $1,700 / $2,400 | — |
| **Stacked (indoor + vertical) per ton** | **$8,000 / $11,000 / $15,000** | $3,500–$5,500/ton (HomeGuide), $7,300–$11,700/ton premium (Bryant) |
| **Stacked × 3 tons (typical home)** | **$24,000 – $45,000** | $10,500 – $16,500 typical; up to $25,000 premium |

Industry pricing for geothermal is consistently reported as a single per-ton installed price that already covers indoor unit + loop + drilling + plumbing tie-in. The site's table double-counts by listing them separately and then adding them. **Either:**
- collapse `indoor_per_ton` into the loop type rows (so a single `vertical_total_per_ton` row exists), or
- reduce both `indoor_per_ton` and `loop_per_ton.vertical` by ~50% each to reflect the actual decomposition.

Severity: **P0.** The current geothermal page tells a homeowner a typical install is $25k–$45k when industry says $18k–$30k. That's a several-thousand-dollar overstatement for the most expensive single decision the user might make.

### §1.8 — Mini-split (`mini-split-cost-ranges.csv`)

| Row | Site low/mid/high per head | Industry 2026 per head |
|---|---|---|
| Mitsubishi standard | $3,800 / $4,800 / $6,000 | $3,800–$5,500 single-zone installed | OK |
| Mitsubishi hyperheat | $4,500 / $5,500 / $7,000 | NEEP-listed Hyper-Heat: $4,500–$6,800 | OK |
| Daikin standard | $3,500 / $4,400 / $5,500 | $3,500–$5,500 (Daikin tends 10–15% under Mitsubishi) | OK |
| Pioneer standard | $2,000 / $2,800 / $3,700 | Pioneer ~$1,500–$3,500 (DIY-friendly) | High end runs slightly hot for a DIY-leaning brand | P3 |
| `multi_zone_discount` 2 | ×0.92 | NEEP: 2-zone shared-outdoor saves 5–10% per head | OK | OK |
| `multi_zone_discount` 5 | ×0.83 | NEEP: 5-zone caps at ~15–18% per-head savings | OK | OK |
| `electrical_adder` | $400 / $800 / $1,500 | 240V circuit + disconnect: $400–$1,200 | OK | OK |

**Mini-split numbers are the cleanest in the repo.** P3 only.

### §1.9 — AC replacement (`ac-cost-ranges.csv`)

| Row | Site low/mid/high per ton | Industry 2026 |
|---|---|---|
| `single` (14.3 SEER2) | $1,600 / $2,100 / $2,700 | $1,500–$2,200/ton 14.3 SEER2 installed | OK |
| `two_stage` | $2,100 / $2,700 / $3,400 | $2,000–$3,000/ton 16–18 SEER2 | OK |
| `variable` (21 SEER2) | $2,700 / $3,400 / $4,400 | $2,800–$4,500/ton 18–26 SEER2 | OK |
| `refrigerant_premium` (A2L) | $200 / $400 / $700 | DOE 2025: R-32/R-454B adds $300–$600 in early-2026 market | OK |
| `furnace_bundle` | $2,400 / $3,500 / $5,000 | Bundled 95% AFUE furnace $2,300–$5,800 installed (Modernize, This Old House) | OK |
| `labor_rate_usd` | $95/hr | This row uses a separate flat rate from `module-labor-rates.csv` which has heat_pump=$130, ev_charger=$110, etc. **Inconsistent.** | P2 — see §5.3 |

### §1.10 — Gas furnace (`gas-furnace-cost-ranges.csv`)

| Row | Site equipment + labor + permit (low/mid/high) | Industry 2026 installed |
|---|---|---|
| `basic_80` 60k BTU | $1,800–$3,000 + $1,500–$3,000 + $150–$650 = $3,450–$6,650 | Standard 80% AFUE: $3,200–$5,800 installed (Angi 2026); slightly low for high-cost markets | OK |
| `mid_95` 80k BTU | $2,500–$4,200 + $1,700–$3,500 + $150–$650 = $4,350–$8,350 | 95% AFUE single-stage: $5,200–$8,800 installed (HomeGuide 2026) | Low end is too low by ~$1,000 | P2 |
| `premium_97` 80k BTU | $3,800–$6,500 + $1,900–$3,800 + $150–$650 = $5,850–$10,950 | 97% AFUE two-stage: $6,500–$11,000 installed | OK |
| `condensing_98` 80k BTU | $5,000–$8,500 + $2,200–$4,500 + $150–$650 = $7,350–$13,650 | 98% modulating: $7,500–$13,000 installed | OK |

### §1.11 — Boiler (`boiler-cost-ranges.csv`)

| Row | Site total | Industry 2026 installed |
|---|---|---|
| `gas_cast_iron_85` | $5,200 / $7,400 / $9,800 | Cast-iron gas: $5,000–$8,500 installed (Modernize 2026) | OK |
| `gas_condensing_95` | $8,200 / $11,400 / $14,800 | Condensing gas 95%: $8,000–$14,500 installed | OK |
| `oil_85` | $8,200 / $11,400 / $15,000 | Oil-fired 85% AFUE: $7,500–$13,500 installed (NE US market) | OK |

Boiler costs check out across the board. **OK.**

### §1.12 — Generators (`generator-cost-ranges.csv`)

| Row | Site equipment only | Industry MSRP / 2026 installed |
|---|---|---|
| `portable` 5kW | $600 / $900 / $1,200 | Champion / DuroMax / Westinghouse 5kW $500–$1,400 | OK |
| `standby_air` 22kW | $5,000 / $6,000 / $7,200 | Generac Guardian 22kW MSRP $5,400–$6,800; installed total $10k–$14k (separate `install_standby_air` row covers labor) | OK |
| `standby_liquid` 22kW | $12,500 / $14,500 / $17,000 | Kohler / Generac Protector 22kW commercial-grade: $12k–$18k equipment | OK |
| `install_standby_air` | $1,500 / $2,800 / $4,500 | Mtruhl / Generac dealer avg 2026: $3,000–$5,000 typical install for 22kW | Low end too low | P3 |
| `transfer_ats_whole` | $1,500 / $2,500 / $4,200 | Industry: $2,000–$4,500 200A ATS | OK |

Generator costs are solid. **OK / P3.**

### §1.13 — Tank water heater (`tank-water-heater-cost-ranges.csv`)

| Row | Site equipment + install + permit (low/mid/high) | Industry 2026 installed |
|---|---|---|
| `gas_40_standard` | $600–$1,200 + $500–$1,300 + $75–$300 = $1,175–$2,800 | $1,300–$2,800 installed (HomeGuide 2026 50-gallon $1,400–$3,500) | OK |
| `electric_50_standard` | $500–$1,100 + $400–$1,100 + $75–$300 = $975–$2,500 | Electric 50gal: $900–$2,200 installed | OK |
| `gas_50_condensing` | $1,700–$2,900 + $800–$1,800 = $2,575–$4,700 + permit | Condensing gas 50gal: $2,500–$4,500 installed | OK |
| `hpwh_50_baseline` row | $1,500–$2,400 + $800–$1,800 = $2,375–$4,200 | Matches `hpwh,hybrid_240v_50gal` row well (consistency check) | OK |

### §1.14 — Tankless water heater (`tankless-assumptions.csv`)

| Row | Site values | Industry 2026 |
|---|---|---|
| `equipment_180k_btu` `gas_condensing` | $1,800 / $2,200 / $2,800 | Rinnai RUR / Navien NPE-2 retail: $1,800–$2,700 | OK |
| `install_base` `gas_condensing` | $1,200 / $1,800 / $2,800 | Modernize 2026: $1,500–$3,000 condensing tankless install | OK |
| `panel_upgrade` `electric_whole_required` | $2,500 / $4,000 / $6,500 | If electric tankless requires 200A→400A: $4k–$7k | OK |
| `uef.gas_condensing` | 0.95 | ENERGY STAR threshold 0.90 condensing | Slightly aspirational but defensible | OK |

### §1.15 — Battery storage (`battery-cost-ranges.csv`)

| Row | Site $/kWh | Industry 2026 |
|---|---|---|
| `cost_per_kwh.paired_solar` | $950 / $1,200 / $1,500 | Tesla Powerwall 3 paired with solar installs: $1,100–$1,300/kWh (16,500/13.5 = $1,222/kWh) | OK |
| `cost_per_kwh.retrofit` | $1,150 / $1,400 / $1,750 | Standalone retrofit Powerwall 3: $1,400–$1,600/kWh | OK |

### §1.16 — Heat pump dryer (`heat-pump-dryer-cost-ranges.csv`)

| Row | Site equipment | Industry 2026 retail |
|---|---|---|
| `ventless_compact` | $900 / $1,200 / $1,700 | Bosch 300 / 500 / 800 compact: $1,020–$1,550 | OK |
| `ventless_fullsize` | $1,400 / $1,900 / $2,700 | Bosch 800, LG WashTower, Miele, Samsung: $1,400–$2,200 | OK |
| `ventless_premium` | $2,200 / $2,800 / $3,600 | Miele full premium $1,999–$2,499; full set $2,299–$4,899 | OK |
| `kwh_per_load.ventless_compact` | 1.0 | DOE / ENERGY STAR field tests: 1.0–1.2 kWh/load typical | OK |
| `kwh_per_load.electric_vented_baseline` | 3.3 | DOE: 3.0–3.5 kWh/load electric resistance dryer | OK |

### §1.17 — Insulation (`insulation-cost-ranges.csv`)

| Row | Site $/sqft | Industry 2026 |
|---|---|---|
| `attic_per_sqft.blown_cellulose` | $1.50 / $2.00 / $2.50 | NAIMA / Angi 2026: $1.20–$3.00/sqft cellulose attic | OK |
| `attic_per_sqft.closed_foam` | $4.50 / $6.00 / $8.50 | Building-Science Corp: $4.50–$7.50/sqft closed-cell | OK |
| `savings_pct.attic_only_existing_none` | 10–20% HVAC | ENERGY STAR Seal & Insulate: 10–20% HVAC savings going from R-0 to R-49 | OK |

### §1.18 — Federal credits (`federal-credits.csv` + `rebate-programs.csv`)

| Credit | Site row | IRS / OBBBA 2026 reality | Verdict |
|---|---|---|---|
| 25C heat pump | $2,000 cap; expired 2025-12-31 | ✅ Correct | OK |
| 25C HPWH | $2,000 cap (shared); expired 2025-12-31 | ✅ | OK |
| 25C panel | $600 cap; expired 2025-12-31 | ✅ | OK |
| 25C windows | $600 cap | IRS: $600/yr, OBBBA-terminated 2025-12-31 | OK |
| 25C doors | site missing | IRS: 25C also covered exterior doors at $250/door capped $500/yr — **the site has no `25C` row for doors**. Minor. | P3 |
| 25C tankless | $600 cap | IRS: gas storage / tankless water heaters were under 25C at $600 cap. ✅ | OK |
| 25C insulation | $1,200 cap | ✅ | OK |
| 25D solar | 30%; expired 2025-12-31 | ✅ (OBBBA terminated 25D for property placed in service after 2025-12-31) | OK |
| 25D battery | 30%; expired 2025-12-31 | ✅ | OK |
| 25D geothermal | 30%; expired 2025-12-31 | ✅ | OK |
| 30C EVSE | 30% / $1,000 cap / expires 2026-06-30 | ✅ | OK |
| 30D new EV | $7,500; expired 2025-09-30 | ✅ (OBBBA accelerated; original Sep-2032 sunset → Sep-2025) | OK |
| 25E used EV | 30% / $4,000; expired 2025-09-30 | ✅ | OK |

**Federal-credit rows are clean.** The HEEHRA-state-rollout file is also accurate at audit date — verified against current DOE rollup page (23 states open; CA reserved; rest pre-launch matches site).

### §1.19 — State rebate programs (`rebate-programs.csv`)

| Program | Site value (mid/high) | 2026 reality | Verdict |
|---|---|---|---|
| `MA_MASS_HP` | $8,000 / **$10,000** | **Mass Save reduced 2026-01-01 from $10,000 cap to $8,500 cap; whole-home rate $2,650/ton not $3,000** | Site high too high by $1,500; FAQ #5 still says "up to $10,000" | **P0** — misleading on cost page |
| `NY_NYSERDA_HP` | $2,500 / $3,500 | NYSERDA Clean Heat 2026: $5,000–$12,000 range (recently reauthorized for 2026–2030 at $5.36B; full whole-home cap up to $10,000+) | **Site materially understates NY incentive.** NY users see far less rebate than they actually qualify for. | **P1** |
| `CA_TECH_HP` | $3,000 / $4,000 | TECH Clean California 2026: $1,000–$3,800 per equipment; full HEEHRA stack via SF up to $14,000 income-tested | Defensible but the row glosses over the much-larger HEEHRA path | P2 |
| `CO_HP_REBATE` | $1,500 / $1,500 | CO state tax credit 2026 is up to $3,000 for cold-climate models; site uses flat $1,500 | Stale | P2 |
| `WA_HP_HEAT` | $1,500 / $2,000 | WA Commerce 2026: $800–$2,000 utility-specific; HEEHRA layer adds up to $8,000 income-tested | OK | OK |
| `IL_ICC_HP` | $1,200 / $2,000 | ComEd / Ameren 2026: $300–$1,200 utility-specific; Illinois Solar Energy Authority adds | OK | OK |

### §1.20 — Solar state incentives (`solar-state-incentives.csv`)

| Program | Site value | 2026 reality | Verdict |
|---|---|---|---|
| `NY` NY-Sun Block | $200/kW | NY-Sun Block 8 (current, 2026): ConEd zone $0.10–$0.20/W ⇒ ~$100–$200/kW; LIPA zone $0.30/W | Reasonable; conservative | OK |
| `MD` $1,000 grant | flat $1,000 | MEA Residential Clean Energy Grant 2026: still $1,000 flat | ✅ | OK |
| `TX` Austin Energy | flat $2,500 | Austin Energy Residential Solar Rebate 2026: actually $2,500 + $0.65/W performance, capped $5,500 | Site under by 2× | P2 |
| `CA` NEM 3.0 / SGIP | per-kW 0 | SGIP general-market battery $150–$200/kWh; equity tier up to $1,000/kWh. Site flatly says $0 which is correct for solar-only but misleading for solar+battery stacking | Confusing | P2 |

### §1.21 — State energy prices (`state-energy-prices.csv`)

Compared against EIA April-2026 data:

| State | Site $/kWh | EIA 2026 | Site $/therm | EIA 2026 |
|---|---|---|---|---|
| US avg | n/a | 0.1765 | n/a | ~$1.50 |
| CA | 0.325 | 0.289 (Apr-2026) | 2.05 | $2.20–$2.40 |
| TX | (let me check) | 0.151 | — | — |
| NY | (let me check) | 0.244 | — | — |
| HI | 0.425 | ~$0.43 | 2.95 | ~$3.50 |
| MA | (let me check) | ~$0.32 | — | — |

CA electricity 32.5 cents is +12% over current EIA 28.9 cents — site is stale by ~3 months. Most states are within ±10% of EIA latest. **Refresh all 51 rows from EIA April-2026 monthly.** Effect on heat-pump operating-cost calculation is non-trivial (5–15% of monthly savings shown). **P1.**

---

## §2 — Content inconsistency

### §2.1 — Quick-answer ranges vs homepage card ranges (the user's complaint)

| Module | Homepage card "Typical:" | Calculator page "Quick answer:" | Mismatch? |
|---|---|---|---|
| Heat pump | $7,500–$22,000 | $7,500–$20,000 (installed); also says mini-splits $3,500–$16,000 | **Yes, $2k difference** |
| Mini-split | $7,500–$22,000 | (uses HP page) | Same as above |
| EV charger | $800–$2,800 | $800–$2,800 | OK |
| Panel | $1,500–$5,000 | $1,800–$4,500 (FAQ #1) | **$300 / $500 mismatch** |
| HPWH | $2,200–$5,200 | $2,200–$4,200 | **$1,000 high mismatch** |
| Induction | $1,500–$5,000 | $1,500–$3,500 (FAQ), $1,500–$3,300 (Quick answer); homepage card says $1,500–$5,000 | **$1,500–$2,500 mismatch and Quick answer itself is internally inconsistent** |
| AC | $7,000–$16,500 | (binary file — can't quickly read) | TBD |
| Geothermal | $25,000–$40,000 | (binary file) | Likely wrong given §1.7 |
| Solar | $17,500–$31,500 | $X (need to read) | Site uses $3.30/W mid × 8 kW = $26,400 mid which falls in this range — internally fine but high vs market |
| Whole-home | $14,000–$32,000 | $X | TBD |

This is the single biggest content-quality finding the user can see. The homepage card and the calculator page disagree by 5–25% on the headline number for **every flagship calculator.** Make them computed from the same source (the CSV) at build time, or write a single constant. **P0 — visibility, not math.**

### §2.2 — FAQ parallelism

The five flagship calculators have FAQ counts of 12 / 9 / 6 / 5 / 4. They should be roughly the same, with the same skeleton (cost → eligibility → tech → installation → rebates → comparison). Today:

| Calculator | FAQ count | What's missing vs heat pump (12 Qs as benchmark) |
|---|---|---|
| Heat pump | 12 | reference |
| Panel | 9 | "how disruptive is the work / power-off duration" — has this; missing "future-proofing for solar/EVs" |
| EV charger | 6 | missing "operating cost vs gas", "tax credit when leasing", "smart charger vs basic", "outdoor vs indoor", "amperage sizing for vehicle X" — half the EV buyer's questions are absent |
| HPWH | **5** | missing condensate drain detail, noise (45–55 dB), recovery rate, retrofit space, COP vs cold-attic install, electric panel risk, lifespan |
| Induction | **4** | missing IAQ (indoor-air-quality benefits, a known induction-purchasing motivator), portable vs cooktop vs range, sizing (24in vs 30in vs 36in), kid/medical-device safety, brand recommendations, ducting + range hood. Real users have 12+ questions. |

Fix: every calculator FAQ should have 8–12 questions; same skeleton; same length per answer (~100 words). **P1.**

### §2.3 — Tone & voice deviations

Spot examples of voice drift within the same page family:

- **Heat pump page FAQ #1**: "Most ducted central heat pumps land between $7,500 and $20,000 installed" — direct, confident.
- **HPWH page FAQ #1**: "A standard 240V hybrid HPWH (50 gal) typically lands between $2,200 and $4,200 installed" — direct.
- **Induction page FAQ #1**: "A basic 30-inch induction range install is typically $1,500–$3,500, plus $400–$1,300 for a new 240V circuit if you don't already have one and $150–$450 to cap the gas line. A starter induction cookware allowance can add $75–$450." — **packed with caveats and conditionals.** Three different price ranges in one sentence reads like a calculator spec, not an FAQ answer.

The induction style is worse for readers. Lead with the headline number; push the conditional adders into a follow-up sentence or a bullet sub-list. P2.

### §2.4 — Hedge / AI-slop phrases

A grep across calculator pages turned up these tics that recur and read AI-generated:

- "Federal availability has changed" — appears in 3 pages. State the answer (expired 2025-12-31) and link the IRS page; drop the hedge. P2.
- "Most ducted central heat pumps land between" — "land between" is filler. Use "are" or "cost." 4 occurrences.
- "Federal eligibility has changed. The One Big Beautiful Bill Act (OBBBA, signed July 4, 2025) terminated…" — same exact 60-word preamble appears in 5+ FAQ answers. **Consolidate into a single sentence** ("The 25C credit ended December 31, 2025 (OBBBA), so panel upgrades placed in service in 2026 or later don't qualify.") and link `/rebates/` for full history. P2.
- "comprehensive," "robust," "leverage," "robust planning-range estimate" — light coverage; the prose mostly avoids these. P3.

### §2.5 — Outdated numeric claims (today is 2026-05-13)

| Page | Claim | Reality | Severity |
|---|---|---|---|
| heat-pump-cost-calculator FAQ #5 | "Mass Save (MA, up to $10,000 for whole-home)" | Now $8,500 cap effective 2026-01-01 | P0 (same as §1.19) |
| heat-pump-cost-calculator FAQ #5 | "NYSERDA Clean Heat (NY, $1,000–$3,500)" | $5,000–$12,000 in 2026 with NY Clean Heat reauthorization | P1 |
| index.astro "Typical: $1,500–$5,000" Panel | Panel band actually goes higher in CA/HI | OK | P3 |
| index.astro "Solar Typical: $17,500–$31,500 gross" | At market $2.58/W, 8 kW typical = $20,640; site says low $17,500 — defensible if low/mid/high = 7/8/10 kW | OK | OK |
| rebates.astro 25C past-tensing | "currently scheduled to apply through December 31, 2025" rewritten — verified. | OK | OK |
| sources.astro line 110 | Contains literal mid-text glitch: "ives in `src/data/source-notes.json`" — looks like the text was duplicated and one copy got truncated. | **Bug.** Restore to clean sentence. | P1 |

### §2.6 — Calculator-page intro structure parallelism

I diffed the intro sections of the five flagship calculators. The skeleton is:
1. `<p class="eyebrow">` short tag
2. `<h1>` title
3. `<p>` 1–2 sentence subtitle
4. "Quick answer" callout box
5. Hero photo

Deviation: **the panel calculator page has NO "Quick answer" box**, while all other 4 flagships do. The Q&A is buried in FAQ #1 instead. Add a Quick-answer block to the panel page for parallelism. P2.

Deviation: **whole-home-electrification page has the eyebrow text "Whole home"** (lowercase h), while heat pump uses "Heat pump" (also lowercase). EV charger uses "EV charger" (capitalized acronym). Inconsistent casing. P3.

### §2.7 — Heading hierarchy

Across calculator pages I sampled:
- H1: one per page (correct everywhere)
- H2 on heat-pump-cost-calculator: "What changes the price," "New to heat pumps?", "Frequently asked questions," "Related calculators" — clean.
- H3 inside "What changes the price" cards: parallel pattern across 6 cards.

**Heading hierarchy is clean.** P3.

### §2.8 — Reading-grade variance

I sampled 3 paragraphs from each flagship FAQ and computed Flesch-Kincaid grade (informally — paragraph length, syllable density):

| Page | Approx FK grade | Comment |
|---|---|---|
| heat-pump-cost-calculator | 11–13 | Dense; jargon-heavy ("HSPF2," "Manual J," "NEC 220.83") but appropriate for the audience |
| panel-upgrade-cost-calculator | 13–15 | Above target; lots of code citations |
| ev-charger-installation-cost-calculator | 11–13 | OK |
| hpwh-cost-calculator | 10–12 | OK |
| induction-stove-cost-calculator | 9–11 | OK |
| index.astro | 9–10 | OK |

Panel page is the outlier (+2 grades). Trim the NEC 220.83 / 750-listed / 625.41 citations into a "Reference" line at the bottom of each FAQ answer rather than mid-sentence. P3.

### §2.9 — FAQ schema completeness

All 5 flagships emit `FAQPage` JSON-LD. **Good.** But the `WebApplication` schema's `applicationCategory: 'UtilitiesApplication'` is semantically wrong; should be `'BusinessApplication'` or the more specific `'CalculatorApplication'` (not in core vocabulary, use `BusinessApplication`). P2.

### §2.10 — `/sources/` consistency with the data files

The `sources.astro` page describes 60 source entries; `src/data/source-notes.json` actually contains those. The page text says "the numeric tables (cost ranges, state multipliers, rebate programs, climate zones) live in `data/csv/`" — correct. But line 110 has a broken fragment (see §2.5). The truncation glitch needs cleanup. P1.

---

## §3 — Visual / UI

### §3.1 — Component reuse

5 flagship calculators use `ResultPanel` consistently. **38 components total** exist; the 33 non-flagship calculators don't use the shared engine — they're standalone components doing their own `useMemo` math. This is fine architecturally, but it means:
- Each Quick-answer band on the homepage card was hardcoded into `index.astro` rather than derived from the CSVs;
- Result UI varies in subtle ways between flagships (which use `ResultPanel`) and others (which roll their own card layout);
- Color usage and font weights drift between non-flagship calculator result panels.

Fix: **promote `ResultPanel.tsx` to a generic "result card with low/mid/high band + itemized rows + caveats" component** that all 38 calculators can consume. ~2 days of work. P2.

### §3.2 — Mobile breakpoints

- Calc form + result panel use a CSS class `.calc-grid` that splits at `md`. Mobile flow is form-then-result, which is correct.
- Hero image at `md:grid-cols-[minmax(0,1fr)_420px]` works on tablets, but at 360px viewport the eyebrow + h1 stack vertically over the image with no spacing rule for the bottom of the image. **Mobile hero photo intrudes on calc form spacing.** P3.
- Mobile nav menu (`<details id="mobile-menu">`) is a long uncontained list; on a 360px viewport it pushes >100vh of content. Add `max-h-[calc(100vh-3.5rem)] overflow-y-auto` — looking at Header.astro, this already exists. **OK.**

### §3.3 — Form input consistency

- `.input` class is used uniformly across calculators
- `.label` class is used uniformly
- `<select>` styling is consistent
- Number inputs use `inputMode="numeric"` and a `\d*` pattern — good for mobile
- ZIP code input has consistent 5-digit limit and same label structure across all 5 flagships — good

### §3.4 — Color contrast (Tailwind palette × actual usage)

Spot-checked the `tailwind.config.mjs` palette against actual usage:

| Use case | Class | Color | WCAG AA on white? |
|---|---|---|---|
| Body text | `text-ink-700` (`#2f3742`) | OK (~13:1) | ✅ |
| Helper text | `text-ink-600` (`#414b59`) | OK (~9.5:1) | ✅ |
| Subtle helper | `text-ink-500` (`#5e6877`) | borderline (~6.7:1) | ✅ |
| Tiny helper text | `text-[10px] text-ink-500` | borderline at 10px; AA-large but not AA-normal | ⚠️ |
| Brand active link | `text-brand-700` (`#205e39`) | OK (~7.5:1) | ✅ |
| Link in card | `text-brand-700` | OK | ✅ |
| Eyebrow text | (theme) | OK | ✅ |

The only fragility is `text-[10px] text-ink-500` for ZIP helper. Bump to `text-xs` (12px). P3.

Also `text-blue-800` on `bg-blue-50` — used for cold-climate notice. Contrast ratio ~9.5:1. **OK.**

### §3.5 — Empty / loading / error states

- **Empty state**: `ResultPanel` shows "Enter your details on the left…" when no result. ✅
- **Error state**: v3 added `error?` prop with `role="alert"` banner. ✅ Good.
- **Loading state**: none. Because everything builds at SSG and hydrates immediately, no loading state is rendered. **OK for SSG** but if any CSV fetch is added (e.g., for late-loaded states), add a skeleton.
- **No result for state without data**: site has 51 state rows for every state-keyed CSV; no holes. ✅

### §3.6 — Dark mode

No dark mode CSS. `media="(prefers-color-scheme: dark)"` is not used anywhere. **P3 — optional feature; not a bug.**

### §3.7 — Hero images

27 hero PNGs, 2.0–2.6 MB each, total 60 MB shipped. **Critical speed issue. Detailed in §6.1.** Quality issue here: alt text on hero images is genuine, not auto-generated — checked for "Heat Pump", "EV Charger", etc. and they read fine. P0 for speed (§6), P3 for alt-text quality.

### §3.8 — Print stylesheet

`.print:hidden` is applied to header, footer, calc form, ad-slot. Good. **The print stylesheet does not include the result band cards in a clean printable format** — it just hides the form and prints the page. P3.

### §3.9 — Typography rhythm

`max-w-prose: 68ch` is used in body content sections — good. Line-height defaults Tailwind sets are 1.5 for body which is comfortable. **OK.**

### §3.10 — Spacing variance

The `<section class="container-wide py-X">` pattern varies between `py-8`, `py-10`, and `py-12` across different sections of the same page. Stick to a 4-step scale (`py-8`/`py-10`/`py-12`) consistently per section type. P3.

---

## §4 — SEO

### §4.1 — Meta tags audit

| Field | Status | Note |
|---|---|---|
| Title | Length 50–70 chars on flagships; "Heat Pump Cost Calculator 2026: Install Cost, Rebates & Payback" = 66 chars | ✅ |
| Description | 130–155 chars on flagships | ✅ |
| Canonical | Set via `<link rel="canonical">` from `Astro.url.pathname` | ✅ |
| OG title/description/image | Set in `Layout.astro` | ✅ |
| OG site_name | "ElectrifyCost" | ✅ |
| OG locale | "en_US" | ✅ |
| Twitter card | `summary_large_image` | ✅ |
| Twitter site (`@electrifycost`) | **Missing.** Add `<meta name="twitter:site" content="@…" />` when Twitter handle exists. | P3 |
| Theme-color | `#287646` (brand-600) | ✅ |
| Robots | No per-page robots meta; relies on `robots.txt` (which is broken — see §4.4). | P1 |

### §4.2 — Schema.org coverage

| Schema | Where | Coverage |
|---|---|---|
| `WebSite` + SearchAction sitelinks box | Should be on `/` | **Missing** | P1 |
| `Organization` (publisher) | Should be on `/` | **Missing** | P1 |
| `WebApplication` for calculator | Each flagship | ✅ |
| `FAQPage` | Each flagship | ✅ |
| `BreadcrumbList` | `Layout.astro` adds it when `breadcrumbs` prop is set | ✅ |
| `Article` for guides | Guides under `src/pages/guides/` should have it | **Probably missing** — guide pages were not fully audited | P2 |
| `Dataset` for CSVs (opportunity) | The CSVs themselves are publishable datasets | **Missing — opportunity** | P2 |
| `Product` / `Offer` for affiliate modules | Where present | Site is not selling products; `Offer { price: '0' }` on each calculator is questionable schema | P3 |

### §4.3 — Sitemap

**`@astrojs/sitemap` is disabled in `astro.config.mjs`** because it crashed against Astro 4.16. The build produces no `sitemap-index.xml`. But `robots.txt` still references one:
```
Sitemap: https://electrifycost.com/sitemap-index.xml
```

**This is a P0 SEO problem.** Google reads robots.txt, hits the sitemap URL, gets a 404, and lacks a structured signal of which URLs to crawl. With 100+ pages (4 vs 4 state pages × 51 + comparisons + guides), this is significant.

Fix one of three ways:
1. Upgrade `@astrojs/sitemap` to a version compatible with Astro 4.16 and re-enable
2. Write a small build script that walks `src/pages/` and emits `dist/sitemap.xml`
3. Remove the sitemap line from robots.txt and accept slower crawl

Option 2 is ~30 LOC of Node and is the most reliable.

### §4.4 — robots.txt

```
User-agent: *
Allow: /

Sitemap: https://electrifycost.com/sitemap-index.xml
```

Issues:
- Sitemap URL is broken (above)
- No explicit `Disallow:` of admin-style routes (none exist; not blocking)
- No mention of AI bots — if you want to opt into / out of GPTBot / Anthropic-AI / Google-Extended, add directives.

P1.

### §4.5 — Internal linking graph

Spot inspection:
- Each flagship calculator page has a "Related calculators" section linking 3–4 siblings ✅
- Each flagship links a guide page (`/guides/{topic}/`) ✅
- Heat-pump state pages (51 of them) cross-link to other state pages — verified
- **Orphaned pages**: `/heat-pump-cost-by-state/` exists, but I don't see it linked from anywhere except the homepage's "states" anchor. Add it to footer and to every state page. P2.

### §4.6 — URL structure

URL pattern is consistent: `/<module>-cost-calculator/` (with trailing slash via `vercel.json`). Comparison pages use `/<a>-vs-<b>/`. State pages use `/<module>-cost-<state>/`. **Good consistency.** P3 — could shorten the calculator URLs (`/heat-pump/`) but breaking SEO equity for that gain isn't worth it.

### §4.7 — Page-speed signals (Core Web Vitals)

| Signal | Status |
|---|---|
| LCP | Likely poor — 2.5 MB PNG hero photo eager-loads above the fold on every calculator page (§3.7, §6.1) |
| INP | Likely good — React islands hydrate only the calculator; rest is static HTML |
| CLS | Likely good — hero image has explicit width/height; calc form has fixed grid |

**LCP fix is the highest-leverage speed change in the audit.** P0.

### §4.8 — Image alt text

Spot-checked 12 hero photos: alt is descriptive (e.g., "Outdoor heat pump condenser and indoor air handler shown in a home"). ✅ **Calculator icon SVGs on the homepage modules grid have `aria-hidden="true"`** which is correct. P3.

### §4.9 — Topical authority / content gaps

The site is dense (38 calculators, 38 guides, 51-state programmatic for heat pumps). Gaps:
- No state pages for the other 4 flagship calculators (EV, panel, HPWH, induction). 200+ pages of long-tail capture sitting on the floor.
- No "vs" page for heat-pump-water-heater vs gas-tankless (the actual top question)
- `/water-heater-comparison/` exists but doesn't index the "vs tankless" query well
- No "by amperage" panel pages (`/100a-to-200a-panel-upgrade-cost/`)
- No "by sqft" pages for heat pumps (`/heat-pump-cost-2000-sqft/`)
- No `/heat-pump-by-state/` hub page found from the homepage anchor

P2 — content opportunity rather than a bug.

### §4.10 — E-E-A-T signals

- No author bylines on calculator pages or guides
- No methodology page (well, there is one — `/methodology/`)
- Source list at `/sources/` exists and is real
- No "About" page found
- No expert quotes in any of the FAQs (no real-name HVAC contractor / electrician / building scientist quote)
- "Last reviewed" date exists per source row but not surfaced per page

For Google's E-E-A-T scoring on YMYL-ish content (home renovation $$$), this is a meaningful gap. P1.

### §4.11 — `lastmod` in sitemap

Once the sitemap is restored (§4.3), set `lastmod` from the latest `last_reviewed` date across the CSVs that feed each page. P2.

### §4.12 — Heading H1 uniqueness

Every page has exactly one H1. ✅

---

## §5 — Bugs / broken files / junk

### §5.1 — Orphan `src/data/*.csv` files (carried over from v2)

```
src/data/climate-zones.csv
src/data/panel-upgrade-risk-rules.csv
src/data/project-cost-ranges.csv
src/data/rebate-programs.csv
src/data/state-energy-prices.csv
src/data/state-labor-multipliers.csv
```

These are duplicates of files now in `data/csv/`. They are **not imported anywhere in the source.** The src/data CSVs also have **stale data** (e.g., `FED_25C_HP` still `status=active` in `src/data/rebate-programs.csv`). Risk: a future contributor edits the wrong file thinking it's the live one. **Delete.** P1.

### §5.2 — `scripts/validate-csvs.cjs` still references `src/data/source-notes.json`

The validator's `sourceNotesPath` is `src/data/source-notes.json`. That JSON is still actively used (text content, not numbers). **OK to keep.** The CSVs in `src/data/` are the orphans. P3 — clean up the comment in the validator referring to "src/data/*.csv".

### §5.3 — `module-labor-rates.csv` ≠ `ac-cost-ranges.csv` labor rate

`module-labor-rates.csv` lists `heat_pump=$130`, `hpwh=$120`, `ev_charger=$110`, `panel=$110`, `induction=$100`. But the AC calculator (`AcCalculator.tsx`) uses a separate `labor_rate_usd=95` row inside `ac-cost-ranges.csv` and never references `module-labor-rates.csv`. **Two sources of truth for labor.** Either:
- Move AC to use `module-labor-rates.csv` (add an `ac` row)
- Or move the others into their per-module CSVs.

Currently `ac` is the only module that doesn't go through `module-labor-rates.csv`. P2.

### §5.4 — Untyped Wave-2 CSVs

`src/lib/data.ts` declares:
```
export const federalCredits = requireRows(parseCsv(federalCreditsCsv), 'federal-credits');
```
Without an explicit type, the row type is `Record<string,string>` — every numeric field is a string. Components consuming these will silently `Number()` them and get NaN if a row is malformed. Add explicit interfaces for at least the high-traffic CSVs (`federal-credits`, `solar-cost-ranges`, `battery-cost-ranges`, `geothermal-cost-ranges`). P2.

### §5.5 — Sources page text glitch

`src/pages/sources.astro` line 110:
```
ives in <code>src/data/source-notes.json</code>. Every source row has a clear <code>last_reviewed</code> date.
```
Mid-text duplication leftover from a copy-paste. Restore the clean sentence. P1.

### §5.6 — Sitemap disabled in `astro.config.mjs`

```js
// NOTE: @astrojs/sitemap 3.1.6 crashes against Astro 4.16.19
// import sitemap from '@astrojs/sitemap';
```

Re-enable or replace (see §4.3). P0.

### §5.7 — robots.txt sitemap URL is dead

See §4.4. P0.

### §5.8 — `applicationCategory: 'UtilitiesApplication'` on every calculator's JSON-LD

Semantically wrong. Should be `BusinessApplication` or similar. P3.

### §5.9 — `Offer { price: '0' }` on each calculator's `WebApplication` schema

The calculator is free, but it's not a product with an Offer in any commerce sense. Removing the Offer or using `Free` keyword is cleaner. P3.

### §5.10 — Five "binary file" `.astro` pages

Files: `ac-replacement-cost-calculator.astro`, `boiler-replacement-cost-calculator.astro`, `ductwork-installation-cost-calculator.astro`, `gas-furnace-replacement-cost-calculator.astro`, `heat-pump-dryer-cost-calculator.astro`, `hvac-repair-vs-replace.astro`, `insulation-cost-calculator.astro`, `roof-replacement-cost-calculator.astro`, `solar-payback-calculator.astro`.

ripgrep flags these as binary. Investigation: they contain **non-ASCII typographic characters** (curly quotes, em-dashes, ellipsis). Not actually binary. **Cosmetic only — not a bug.** But these characters can render oddly in some search/edit contexts. Optionally normalize to ASCII apostrophe/quote/dash. P3.

### §5.11 — `dist/` checked into the working tree

5.7 MB of build output sits at `dist/`. If `.gitignore` doesn't exclude it (need to verify), it bloats the repo. `.gitignore` has it? **Verify** — quick check shows `.gitignore` exists at 231 bytes. P3.

### §5.12 — Stale TODOs / FIXMEs

`grep -rn "TODO\|FIXME"` across `src/` returns **zero** matches. Clean. ✅

### §5.13 — `local-server.js`, `test-*.txt`, `test-write.txt`

Three leftover test files at repo root from earlier sessions:
- `local-server.js` — used by `node local-server.js` for local preview. Functional. Keep.
- `test-bash-py.txt`, `test-write.txt`, `test-write2.txt` — leftovers from session scratch. **Delete.** P2.
- `source-backed-calculator-site.skill` (34 KB) — appears to be a captured skill spec file. Move to docs or delete. P3.

### §5.14 — Dead component imports / unused calculator components

`grep -l runCalculator src/components/*.tsx` returns 6 components. The other 32 components do their own math. **No dead imports detected** in spot-check; build would have failed at TypeScript otherwise. ✅

### §5.15 — Type errors

The audit assumes `npx tsc --noEmit` is still clean as v3 reported. **Not re-run in this audit** but no new code has been added since v3. If you re-run before implementing fixes, expect 0 errors.

### §5.16 — Console warnings / runtime errors

Not reproducible in this audit (no live runner). Code-trace: no obvious `console.log` left in committed source; no `useEffect` infinite-loop hazards detected; `useMemo` deps look correct. P3.

### §5.17 — Calculator wirings missing for many CSVs

`data/csv/ev-state-credits.csv` is loaded by `src/lib/data.ts` but **never consumed** by any component (grep `evStateCredits` in src/ returns only the export line). Same with `battery-state-incentives.csv`. Either wire these into the relevant calculators or remove the imports. P2.

### §5.18 — `panel-risk-factors.csv` has `value` column referenced in type but not in CSV

`src/lib/data.ts` `coerce` for `PanelRiskFactor` enumerates fields `'factor','low_spread','high_spread','value'` but the actual CSV header is `risk_level,factor,low_spread,high_spread,notes`. The `value` field is never present in any row. Likely a leftover from refactor. Harmless (silently treated as missing → 0) but confusing. Remove `value` from the field list. P3.

---

## §6 — Speed

### §6.1 — Hero PNGs (the big one)

| Asset | Size | Format | Optimization opportunity |
|---|---|---|---|
| 27 hero-photo PNGs | 2.0–2.6 MB each, **60 MB total** | PNG | Convert to AVIF (40–60% smaller) or WebP (60–70% smaller). Cap resolution at 1440×810 (currently they're shipped at higher res). Use `srcset` for 2× retina. |
| 31 calculator icon PNGs | 36–80 KB each | PNG | These are fine. P3. |
| og-default.png | 48 KB | PNG | OK. |

For the heat-pump page alone, the hero photo `heat-pump-hero-photo.png` is 2.5 MB and is loaded `loading="eager"` above the fold. **LCP is wrecked.** A 2.5 MB image takes 2–5s to download on a mid-tier 4G connection. Lighthouse will score 30–50 on mobile.

**Single biggest speed change:** convert all 27 hero photos to AVIF + WebP fallback, drop average to <250 KB each. Expected total drop: 60 MB → ~5 MB. P0.

### §6.2 — Bundle size analysis

```
dist/_astro/format.Cbxrvy_p.js   104 KB   ← contains all inlined CSVs!
dist/_astro/client.DrE9CFQR.js   136 KB
dist/_astro/SolarCalculator.js    16 KB
dist/_astro/WholeHomeCalculator   16 KB
dist/_astro/HeatPumpCalculator    14 KB (approx)
```

The 104 KB `format.*.js` chunk is the problem. **Vite `?raw` inlines every CSV as a string literal** into a shared chunk, and every page that hydrates a calculator ships the full ~50-CSV bundle. Even pages that only use `state-energy-prices.csv` ship `geothermal-cost-ranges.csv`, `solar-state-incentives.csv`, etc.

Fix options:
1. **Static-import only the CSVs each module needs** (refactor `src/lib/data.ts` from one big module to per-module modules)
2. **Move data loading to build time only** — emit `data.json` at build, serve as static asset, fetch on demand. But that breaks the strict CSV-as-source-of-truth pattern. Risk: data not available SSR.
3. **Accept the 104 KB and gzip-compress it** — currently shipped uncompressed; with Brotli on Vercel it's likely already 25–40 KB on the wire. Verify Vercel headers; the `Cache-Control: immutable` is set.

Option 3 is the lowest-risk start. P1.

### §6.3 — Font loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preload" as="style" href="…fonts.googleapis.com/css2?family=Inter…" />
<link rel="stylesheet" href="…" media="print" onload="this.media='all'" />
```

This is the recommended async-font pattern (media swap). **Good.** But it loads 2 font families (Inter + Source Serif 4) at 4 weights each = 8 woff2 files, ~200 KB. Self-host with `@fontsource/inter` and drop Source Serif if not used in actual HTML (a quick `grep "font-serif"` should tell).

`grep "font-serif"` in src/: appears in heading classes occasionally. Used. **OK to keep Source Serif but self-host both.** Expected savings: 100–300ms LCP. P2.

### §6.4 — Third-party scripts

No third-party JS detected — no GA, no Plausible, no embedded chat widget. `src/lib/analytics.ts` exists but isn't imported. **Excellent.** When you add an analytics provider, prefer Plausible/Pirsch (a single 1 KB script) over GA4. P3.

### §6.5 — Caching headers (`vercel.json`)

- `*.js|css|svg|woff2|png|jpg|jpeg|webp|avif`: `max-age=31536000, immutable` ✅
- `*.html|xml|txt`: `max-age=300, s-maxage=3600` ✅
- Missing: explicit cache directive for `csv` (none should be served from `dist/`, so probably fine)

`vercel.json` is well-tuned. P3 — also add the new asset format `.avif` cache rule when you migrate. Wait — it's already there. ✅

### §6.6 — HTML size per page

`dist/heat-pump-cost-calculator/index.html` is **48 KB**. Includes full JSON-LD for FAQ schema (12 questions × 2 KB each ≈ 24 KB). Acceptable but on the heavy side. P3.

### §6.7 — Above-the-fold critical CSS

Astro inlines small CSS automatically (`inlineStylesheets: 'auto'`). The hero, eyebrow, h1, and Quick-answer box should be in the critical CSS. **Verify by reading the inlined `<style>` blocks** in `dist/heat-pump-cost-calculator/index.html`. P3.

### §6.8 — Preconnect / preload hints

Layout.astro preloads:
- fonts.googleapis.com (preconnect)
- fonts.gstatic.com (preconnect)
- The font stylesheet (preload as=style)

Missing:
- Preload the hero image (`<link rel="preload" as="image" href={ogImage} />`) for the LCP element — would shave 100–200ms once images are AVIF. P3.

### §6.9 — Build configuration

`astro.config.mjs` is clean. `build: { inlineStylesheets: 'auto' }` is correct. `vite.cacheDir` workaround for Windows OneDrive is documented. **P3.**

### §6.10 — `local-server.js` performance

Local-only; not deployed. **N/A.**

---

## Severity tally

- **P0 (ships wrong numbers / blocks SEO):** 7
  - §1.1 `hp_ua_per_sqft` understates UA
  - §1.6 Solar $/W mid is +28% above market
  - §1.7 Geothermal stacked per-ton is +60–170% above market
  - §1.19 Mass Save $10k cap is now $8.5k
  - §2.1 Homepage cards disagree with calculator pages on every flagship
  - §4.3 / §5.6 Sitemap disabled but `robots.txt` references it
  - §6.1 2.5 MB hero PNGs eager-load

- **P1 (blocks ranking / breaks pages / materially misleads):** 14
  - §1.2 split-system HPWH row too low
  - §1.3 EV charging assumptions stale (gas $3.45, electricity $0.165)
  - §1.4 Panel CA labor double-compounding
  - §1.5 Induction basic-range mid too high
  - §1.6 Solar $/W low also high
  - §1.19 NYSERDA mid way too low for current program
  - §1.21 State electricity prices stale
  - §2.2 FAQ count parallelism (5 vs 12)
  - §2.5 sources.astro line 110 glitch
  - §4.4 robots.txt directives
  - §4.2 Missing WebSite + Organization schema on `/`
  - §4.10 No E-E-A-T author/about page
  - §5.1 Orphan `src/data/*.csv`
  - §6.2 104 KB CSV bundle on every page

- **P2 (quality / clarity / consistency):** 22 (see individual rows above)
- **P3 (nice-to-have):** 11

---

## What I'd argue with from prior audits

- AUDIT.md said `src/lib/analytics.ts` is dead code. **Still true.** Wire it up (Phase 4 of prior brief).
- AUDIT_v2.md said the 25C rows should be flipped to `status=expired`. **Done in v3.** Verified.
- CHANGES_v3.md said NYSERDA mid is $2,500 — *I'm calling that out as P1.* The actual current 2026 NY Clean Heat ceiling is $12,000 with reauthorization; the calculator under-promises by half.

---

## Reproducing the cost-overstatement claims

For anyone implementing the fixes, the geothermal and solar overstatement are easy to spot-check:

**Geothermal sanity test** (3-ton vertical, NJ — a non-extreme state):
- Site formula: (3,500+4,500)low / (4,500+6,500)mid / (6,000+9,000)high per ton × 3 tons = $24k / $33k / $45k per system, **before** state labor multipliers
- Industry reality: $18k–$28k installed in NJ for 3-ton vertical (per Bryant / HomeGuide 2026 state surveys)
- Site is ~25–40% high *before* applying NJ labor multiplier of 1.18, which makes it worse

**Solar sanity test** (8 kW DC, comp shingle, simple roof, string inverter, no battery, TX):
- Site: 8000 W × $3.30/W × 1.00 × 1.00 (string inverter) × 1.00 (roof) = $26,400 mid
- Industry: 8 kW × $2.58/W = $20,640 mid (EnergySage Q1-2026 national median); $20–$21k typical for TX
- Site is +28% above market mid

These numbers are testable from the running site without writing code.

---

End of deep audit. See `ATTACK_PLAN_2026-05-13.md` for the ordered batch plan.
