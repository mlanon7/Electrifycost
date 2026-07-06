/*
 * Geothermal calculator — pure compute. Extracted verbatim from
 * src/components/GeothermalCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Loop = 'vertical' | 'horizontal' | 'pond' | 'open';
export type Tonnage = '2' | '3' | '4' | '5' | '6';
export type Existing = 'yes' | 'no';

export interface GeothermalInputs {
  state: string;
  tonnage: Tonnage;
  loop: Loop;
  existingDucts: Existing;
  installYear: number;
}

export const TONNAGE_OPTIONS: { value: Tonnage; label: string }[] = [
  { value: '2', label: '2 ton (small home)' },
  { value: '3', label: '3 ton (1,500–2,000 sqft)' },
  { value: '4', label: '4 ton (2,000–2,500 sqft)' },
  { value: '5', label: '5 ton (2,500–3,500 sqft)' },
  { value: '6', label: '6 ton (large)' },
];

export const LOOP_OPTIONS: { value: Loop; label: string }[] = [
  { value: 'vertical', label: 'Vertical bore (most common, smallest yard)' },
  { value: 'horizontal', label: 'Horizontal trench (needs ~1 acre yard)' },
  { value: 'pond', label: 'Pond / lake loop (cheapest if available)' },
  { value: 'open', label: 'Open loop (well + discharge)' },
];

export const DUCT_OPTIONS: { value: Existing; label: string }[] = [
  { value: 'yes', label: 'Yes (reuse)' },
  { value: 'no', label: 'No (add to install cost)' },
];

export const YEAR_OPTIONS: { value: number; label: string }[] = [
  { value: 2026, label: '2026 (no federal — 25D expired)' },
  { value: 2027, label: '2027 (no federal)' },
  { value: 2025, label: '2025 (historical — last 30% year)' },
];

const add = (a: CostBand3, b: CostBand3): CostBand3 => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });
void add; // helper moved verbatim from the component (it was defined-but-unused there as well)

// Fully-loaded per-ton installed cost by loop type: indoor heat-pump unit +
// ground loop + drilling/trenching + plumbing tie-in in one figure. The ground
// loop is 50–70% of the total and drilling dominates it, so VERTICAL (which
// needs 150–200 ft of bore per ton at $15–30/ft) is the priciest loop. 2026
// market: a 3-ton system averages ~$25,500 installed ($20k–$32k in standard
// soil, $35k+ in rock), i.e. ~$8,500/ton nationally, $4,500–$12,500/ton by
// geology (HomeGuide / Angi / Fixr / HomeAdvisor / Carrier / Bryant 2026).
// Sources: data/csv/geothermal-cost-ranges.csv.
const LOOP_PER_TON: Record<Loop, CostBand3> = {
  vertical:   { low: 7000, mid: 8500, high: 11000 },  // drilling-heavy — priciest
  horizontal: { low: 5500, mid: 7000, high: 9000 },   // trenching (needs ~1 acre)
  pond:       { low: 5000, mid: 6500, high: 8000 },   // cheapest when water available
  open:       { low: 5500, mid: 7000, high: 9000 },   // well + discharge
};

const DUCT_REUSE_BONUS: CostBand3 = { low: -1500, mid: -2500, high: -4000 };  // savings if existing ducts reused

const PERMIT_DESIGN: CostBand3 = { low: 800, mid: 1500, high: 2800 };          // engineering + drilling permit

export interface GeothermalResult extends CalcComputeOutput {
  loopCost: CostBand3;
  ductBonus: CostBand3;
  permit: CostBand3;
  fedCredit: CostBand3;
  net: CostBand3;
  fedRate: number;
}

export function compute(inputs: GeothermalInputs, opts?: ComputeOpts): GeothermalResult {
  const { state, tonnage, loop, existingDucts, installYear } = inputs;
  const hvacMult = opts?.laborMult ?? (findStateLabor(state)?.hvac_multiplier ?? 1.0);
  const ton = parseFloat(tonnage);
  // Fully-loaded per-ton install (indoor unit + loop + tie-in).
  const loopCost = scale(LOOP_PER_TON[loop], ton * hvacMult);
  const ductBonus = existingDucts === 'yes' ? DUCT_REUSE_BONUS : { low: 0, mid: 0, high: 0 };
  const permit = scale(PERMIT_DESIGN, hvacMult);

  const gross: CostBand3 = {
    low: loopCost.low + ductBonus.low + permit.low,
    mid: loopCost.mid + ductBonus.mid + permit.mid,
    high: loopCost.high + ductBonus.high + permit.high,
  };

  // Federal 25D credit — TERMINATED by OBBBA for property placed in service after 2025-12-31.
  // Source: IRS https://www.irs.gov/credits-deductions/residential-clean-energy-credit
  const fedRate = installYear <= 2025 ? 0.30 : 0;
  const fedCredit: CostBand3 = { low: gross.low * fedRate, mid: gross.mid * fedRate, high: gross.high * fedRate };
  const net: CostBand3 = { low: gross.low - fedCredit.low, mid: gross.mid - fedCredit.mid, high: gross.high - fedCredit.high };

  return {
    loopCost, ductBonus, permit, gross, fedCredit, net, fedRate,
    brk: {},   // industry consolidates unit + loop into one per-ton installed figure — no honest category split
    scope: `${tonnage} ton · ${LOOP_OPTIONS.find(o => o.value === loop)?.label.replace(/\s*\(.*\)$/, '') ?? loop}`,
    attrs: [
      ['Ground loop', LOOP_OPTIONS.find(o => o.value === loop)?.label ?? ''],
      ['Existing ductwork', DUCT_OPTIONS.find(o => o.value === existingDucts)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<GeothermalInputs> = {
  small:   { state: 'US', tonnage: '2', loop: 'vertical', existingDucts: 'yes', installYear: 2026 },
  typical: { state: 'US', tonnage: '3', loop: 'vertical', existingDucts: 'yes', installYear: 2026 },
  large:   { state: 'US', tonnage: '6', loop: 'vertical', existingDucts: 'no', installYear: 2026 },
};

export const TIER_LABELS: TierLabels = {
  small: 'small home',
  typical: 'typical loop field',
  large: 'large / vertical bores',
};

export const COST_MIX: CostMix = { material: 0.42, labor: 0.43, equipment: 0.15 };
