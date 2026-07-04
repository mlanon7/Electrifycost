/*
 * Window replacement calculator — pure compute. Extracted verbatim from
 * src/components/WindowCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Material = 'vinyl' | 'fiberglass' | 'wood_clad' | 'aluminum';
export type Glazing = 'double_lowE' | 'triple_lowE' | 'storm_addon';
export type Install = 'retrofit' | 'new_construction';

export interface WindowInputs {
  state: string;
  count: number;
  material: Material;
  glazing: Glazing;
  install: Install;
}

export const MATERIAL_OPTIONS: { value: Material; label: string }[] = [
  { value: 'vinyl', label: 'Vinyl (most common, best value)' },
  { value: 'fiberglass', label: 'Fiberglass (premium, longest life)' },
  { value: 'wood_clad', label: 'Wood-clad (premium aesthetic)' },
  { value: 'aluminum', label: 'Aluminum (hot-climate / commercial)' },
];

// storm_addon is only offered (and only priced) for vinyl — the component
// hides this option for the other frame materials.
export const GLAZING_OPTIONS: { value: Glazing; label: string }[] = [
  { value: 'double_lowE', label: 'Double-pane Low-E (standard 2026)' },
  { value: 'triple_lowE', label: 'Triple-pane Low-E (best, cold climates)' },
  { value: 'storm_addon', label: 'Storm window addon (cheapest)' },
];

export const INSTALL_OPTIONS: { value: Install; label: string }[] = [
  { value: 'retrofit', label: 'Retrofit / pocket install (keep existing trim)' },
  { value: 'new_construction', label: 'Full frame replacement (new construction)' },
];

const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// Per-window installed cost 2026. Sources: Modernize 2024 contractor surveys, ENERGY STAR / NFRC database,
// Pella, Marvin, Andersen, Milgard, Jeld-Wen MSRPs. Standard double-hung sized roughly 36×60.
const PER_WINDOW: Record<Material, Record<Glazing, CostBand3>> = {
  vinyl: {
    double_lowE:  { low: 450, mid: 650, high: 900 },
    triple_lowE:  { low: 650, mid: 850, high: 1150 },
    storm_addon:  { low: 200, mid: 350, high: 500 },     // exterior storm window over existing
  },
  fiberglass: {
    double_lowE:  { low: 700, mid: 950, high: 1250 },
    triple_lowE:  { low: 900, mid: 1200, high: 1600 },
    storm_addon:  { low: 0, mid: 0, high: 0 },
  },
  wood_clad: {
    double_lowE:  { low: 950, mid: 1300, high: 1750 },
    triple_lowE:  { low: 1200, mid: 1650, high: 2200 },
    storm_addon:  { low: 0, mid: 0, high: 0 },
  },
  aluminum: {                                            // mostly hot-climate, low-thermal-bridge designs
    double_lowE:  { low: 600, mid: 850, high: 1150 },
    triple_lowE:  { low: 800, mid: 1100, high: 1500 },
    storm_addon:  { low: 0, mid: 0, high: 0 },
  },
};

const INSTALL_MULT: Record<Install, number> = {
  retrofit: 1.0,
  new_construction: 1.15,   // includes brick/siding trim work, drywall patching
};

export interface WindowResult extends CalcComputeOutput {
  perWindow: CostBand3;
  annualSavings: number;
}

export function compute(inputs: WindowInputs, opts?: ComputeOpts): WindowResult {
  const { state, count, material, glazing, install } = inputs;
  const lab = findStateLabor(state);
  const laborMult = opts?.laborMult ?? (lab?.electrician_multiplier ?? 1.0);  // proxy for general carpentry
  const installMult = INSTALL_MULT[install];
  const perWindow = PER_WINDOW[material][glazing];
  const gross: CostBand3 = scale(perWindow, count * laborMult * installMult);
  const annualSavings = count * 8;  // ENERGY STAR estimate: $8/yr saved per replaced window over single-pane

  return {
    perWindow, gross, annualSavings,
    brk: {},   // per-window installed pricing — no honest materials/labor split
    scope: `${count} windows · ${MATERIAL_OPTIONS.find(o => o.value === material)?.label.replace(/\s*\(.*\)$/, '') ?? material}`,
    attrs: [
      ['Frame material', MATERIAL_OPTIONS.find(o => o.value === material)?.label ?? ''],
      ['Glazing', GLAZING_OPTIONS.find(o => o.value === glazing)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<WindowInputs> = {
  small:   { state: 'US', count: 1, material: 'vinyl', glazing: 'double_lowE', install: 'retrofit' },
  typical: { state: 'US', count: 7, material: 'vinyl', glazing: 'double_lowE', install: 'retrofit' },
  large:   { state: 'US', count: 20, material: 'vinyl', glazing: 'double_lowE', install: 'retrofit' },
};

export const TIER_LABELS: TierLabels = {
  small: 'one window',
  typical: '5-8 windows',
  large: 'whole house',
};

export const COST_MIX: CostMix = { material: 0.70, labor: 0.27, equipment: 0.03 };
