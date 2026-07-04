/*
 * Smart panel calculator — pure compute. Extracted verbatim from
 * src/components/SmartPanelCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Product = 'span_drive' | 'span_home' | 'lumin' | 'schneider' | 'emporia' | 'load_shed_device' | 'traditional';

export interface SmartPanelInputs {
  state: string;
  product: Product;
  avoidsUpgrade: boolean;
}

/** Product select choices, in the order the calculator renders them. */
export const PRODUCT_OPTIONS: { value: Product; label: string }[] = [
  { value: 'span_drive', label: 'Span Drive (full smart panel replacement)' },
  { value: 'span_home', label: 'Span Home Panel (premium tier)' },
  { value: 'schneider', label: 'Schneider Square D Energy Center' },
  { value: 'lumin', label: 'Lumin Smart Panel (add-on next to existing)' },
  { value: 'load_shed_device', label: 'Load-shed device only (DCC-9-USA, Wallbox)' },
  { value: 'emporia', label: 'Emporia Vue Smart Panel (monitoring only)' },
  { value: 'traditional', label: 'Traditional 200A panel (baseline for comparison)' },
];

const PRODUCTS: Record<Product, { equipment: CostBand3; install: CostBand3; label: string; type: 'replace' | 'addon' | 'monitor' | 'baseline' }> = {
  span_drive:        { equipment: { low: 3500, mid: 4000, high: 4500 }, install: { low: 1800, mid: 2800, high: 4500 }, label: 'Span Drive (full smart panel)', type: 'replace' },
  span_home:         { equipment: { low: 4000, mid: 4500, high: 5200 }, install: { low: 1800, mid: 2800, high: 4500 }, label: 'Span Home Panel (premium)', type: 'replace' },
  lumin:             { equipment: { low: 1800, mid: 2200, high: 2800 }, install: { low: 800, mid: 1200, high: 2000 }, label: 'Lumin Smart Panel (add-on)', type: 'addon' },
  schneider:         { equipment: { low: 3200, mid: 3800, high: 4500 }, install: { low: 1800, mid: 2800, high: 4500 }, label: 'Schneider Square D Energy Center', type: 'replace' },
  emporia:           { equipment: { low: 400, mid: 700, high: 1200 },   install: { low: 400, mid: 700, high: 1200 }, label: 'Emporia Vue Smart Panel (monitoring)', type: 'monitor' },
  load_shed_device:  { equipment: { low: 500, mid: 900, high: 1500 },   install: { low: 400, mid: 800, high: 1500 }, label: 'Load-shed device (DCC-9-USA, Wallbox)', type: 'addon' },
  traditional:       { equipment: { low: 700, mid: 1100, high: 1800 }, install: { low: 1500, mid: 2500, high: 4000 }, label: 'Traditional 200A panel (baseline)', type: 'baseline' },
};

const PANEL_UPGRADE_AVOIDED: CostBand3 = { low: 1500, mid: 3000, high: 5500 };

function scale(b: CostBand3, m: number): CostBand3 { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: CostBand3, b: CostBand3): CostBand3 { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export interface SmartPanelResult extends CalcComputeOutput {
  equipment: CostBand3;
  install: CostBand3;
  permit: CostBand3;
  traditional: CostBand3;
  premium: number;
  avoidedUpgradeValue: number;
  netPremium: number;
  label: string;
  type: 'replace' | 'addon' | 'monitor' | 'baseline';
}

export function compute(inputs: SmartPanelInputs, opts?: ComputeOpts): SmartPanelResult {
  const { state, product, avoidsUpgrade } = inputs;
  const laborMult = opts?.laborMult
    ?? (findStateLabor(state)?.electrician_multiplier ?? 1.0);
  const p = PRODUCTS[product];
  const install = scale(p.install, laborMult);
  const permit: CostBand3 = { low: 200, mid: 400, high: 800 };
  const gross = add(add(p.equipment, install), permit);

  const traditional = add(add(PRODUCTS.traditional.equipment, scale(PRODUCTS.traditional.install, laborMult)), permit);
  const premium = gross.mid - traditional.mid;
  const avoidedUpgradeValue = avoidsUpgrade ? PANEL_UPGRADE_AVOIDED.mid : 0;
  const netPremium = premium - avoidedUpgradeValue;

  return {
    equipment: p.equipment, install, permit, gross, traditional, premium, avoidedUpgradeValue, netPremium, label: p.label, type: p.type,
    // Genuine category split: panel hardware (m) + electrician install (l) +
    // permit (p) sum exactly to gross.
    brk: {
      m: [Math.round(p.equipment.low), Math.round(p.equipment.high)],
      l: [Math.round(install.low), Math.round(install.high)],
      p: [Math.round(permit.low), Math.round(permit.high)],
    },
    scope: p.label,
    attrs: [['Product', PRODUCT_OPTIONS.find(o => o.value === product)?.label ?? '']],
  };
}

export const TIER_INPUTS: TierInputs<SmartPanelInputs> = {
  small:   { state: 'US', product: 'emporia', avoidsUpgrade: false },      // monitoring only
  typical: { state: 'US', product: 'lumin', avoidsUpgrade: true },         // component default (span_drive) prices as a large job; the mid-priced smart panel + install is the Lumin add-on
  large:   { state: 'US', product: 'span_drive', avoidsUpgrade: true },    // full smart panel replacement
};

export const TIER_LABELS: TierLabels = {
  small: 'monitoring only',
  typical: 'smart panel + install',
  large: 'smart panel + subpanel',
};

export const COST_MIX: CostMix = { material: 0.60, labor: 0.37, equipment: 0.03 };
