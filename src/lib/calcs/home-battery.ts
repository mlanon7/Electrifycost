/*
 * Home battery calculator — pure compute. Extracted verbatim from
 * src/components/BatteryCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor, stateEnergy } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type UseCase = 'backup_only' | 'self_consumption' | 'tou_arbitrage' | 'full_home_backup';
export type Chemistry = 'lfp' | 'nmc';
export type PairedSolar = 'yes' | 'no';
export type Panel = '100A' | '200A' | 'unknown';

export interface BatteryInputs {
  state: string;
  kwh: number;
  useCase: UseCase;
  chemistry: Chemistry;
  paired: PairedSolar;
  panel: Panel;
  installYear: number;
}

export const USECASE_OPTIONS: { value: UseCase; label: string }[] = [
  { value: 'self_consumption', label: 'Self-consumption (NEM 3.0 / VDER)' },
  { value: 'tou_arbitrage', label: 'Time-of-use arbitrage' },
  { value: 'backup_only', label: 'Backup-only (critical loads)' },
  { value: 'full_home_backup', label: 'Full-home backup' },
];

export const CHEMISTRY_OPTIONS: { value: Chemistry; label: string }[] = [
  { value: 'lfp', label: 'LFP (LiFePO4 — safer, longer-cycle)' },
  { value: 'nmc', label: 'NMC (denser, older Powerwall, LG)' },
];

export const PAIRED_OPTIONS: { value: PairedSolar; label: string }[] = [
  { value: 'yes', label: 'Yes — installed together (cheaper)' },
  { value: 'no', label: 'No — retrofit to existing panels' },
];

export const PANEL_OPTIONS: { value: Panel; label: string }[] = [
  { value: '200A', label: '200A (standard)' },
  { value: '100A', label: '100A (may need subpanel for backup)' },
  { value: 'unknown', label: 'Unknown' },
];

export const YEAR_OPTIONS: { value: number; label: string }[] = [
  { value: 2026, label: '2026 (no federal — 25D expired)' },
  { value: 2027, label: '2027 (no federal)' },
  { value: 2028, label: '2028 (no federal)' },
  { value: 2025, label: '2025 (historical — last 30% year)' },
];

const add = (a: CostBand3, b: CostBand3): CostBand3 => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 installed cost benchmarks ($/kWh installed, including inverter integration and labor).
// LBNL "Tracking the Sun" 2024 reports a median $1,330/kWh installed for paired solar-plus-storage;
// retrofitted standalone storage commands a premium. NREL's 2024 storage benchmark for residential
// (single Powerwall-class system): $1,200–$1,500/kWh installed for 10-13.5 kWh systems, with smaller
// systems closer to $1,500/kWh and larger systems trending toward $1,100/kWh.
const COST_PER_KWH_PAIRED: CostBand3 = { low: 950, mid: 1200, high: 1500 };       // installed at same time as solar
const COST_PER_KWH_RETROFIT: CostBand3 = { low: 1150, mid: 1400, high: 1750 };    // standalone retrofit

// LFP (LiFePO4) chemistry: 0-5% premium for cycle life + safety vs NMC for residential class.
const CHEMISTRY_PREMIUM: Record<Chemistry, number> = {
  lfp: 1.03,   // ~3% premium typical, often comparable
  nmc: 1.00,
};

// Use-case driven labor + transfer switch cost. Full-home backup requires whole-house automatic
// transfer switch + critical load panel resizing; backup-only is a small subpanel install.
const USECASE_PREMIUM: Record<UseCase, number> = {
  backup_only: 1.00,            // small subpanel, 4-6 critical circuits
  self_consumption: 1.05,       // grid-tied storage, no transfer switch
  tou_arbitrage: 1.05,
  full_home_backup: 1.15,       // automatic transfer switch + critical load panel
};

// Permit fees baseline (state labor multiplier scales this)
const BASE_PERMIT: CostBand3 = { low: 250, mid: 500, high: 900 };

// State storage incentive snapshot (2026). Per-kWh upfront or one-time grants.
// Values are conservative — many programs have tiers/income limits.
interface StateIncentive { name: string; perKwh?: number; flat?: number; cap?: number; note: string; }
const STATE_BATTERY_INCENTIVE: Record<string, StateIncentive> = {
  CA: { name: 'CA SGIP (Equity Resiliency tier)', perKwh: 150, cap: 5000, note: 'Self-Generation Incentive Program — General Market tier; higher tiers for low-income, fire-prone areas, medical baseline.' },
  CT: { name: 'CT Energy Storage Solutions', perKwh: 200, cap: 7500, note: 'CT Green Bank — declining-block upfront incentive plus performance payments.' },
  MA: { name: 'MA ConnectedSolutions', flat: 0, note: 'Performance-based: pays ~$275–$300/kWh-year for grid services, not upfront — not modeled in upfront cost.' },
  MD: { name: 'MD Energy Storage Tax Credit', perKwh: 0, cap: 5000, note: '30% state income-tax credit up to $5,000 (separate from federal 25D). 2025 expansion makes it more accessible.' },
  NY: { name: 'NY-Sun Storage adder', perKwh: 250, cap: 5000, note: 'NY-Sun Residential Storage Incentive — varies by region and declining block.' },
  OR: { name: 'OR Solar + Storage Rebate', flat: 2500, note: 'Energy Trust of Oregon — combined solar + storage rebate.' },
  CO: { name: 'Xcel Energy Battery Pilot', flat: 0, note: 'Tariff-based, not upfront.' },
};

function utilityRebateRange(state: string, kwh: number): CostBand3 & { name: string; note: string } | null {
  const s = STATE_BATTERY_INCENTIVE[state];
  if (!s) return null;
  if (s.flat && s.flat > 0) {
    return { name: s.name, note: s.note, low: s.flat * 0.8, mid: s.flat, high: s.flat * 1.1 };
  }
  if (s.perKwh && s.perKwh > 0) {
    const v = Math.min(s.perKwh * kwh, s.cap ?? Infinity);
    return { name: s.name, note: s.note, low: v * 0.7, mid: v, high: v * 1.2 };
  }
  return null;
}

// TOU arbitrage savings — rough heuristic. Daily cycle, 80% depth of discharge, 90% round-trip efficiency.
// Savings per kWh-cycled equals (peak-rate - off-peak-rate). Median ratio ~3:1 in TOU-aggressive states.
function annualArbitrageSavings(state: string, kwh: number): number {
  const row = stateEnergy.find(e => e.state === state);
  const rate = row ? row.electricity_cents_per_kwh / 100 : 0.16;
  // TOU spread by state (rough)
  const touSpread: Record<string, number> = {
    CA: 0.30, NY: 0.20, MA: 0.18, HI: 0.25, CT: 0.18, NJ: 0.15, NH: 0.15, RI: 0.18,
    AZ: 0.15, NV: 0.12, FL: 0.10, TX: 0.12, IL: 0.10, MD: 0.12,
  };
  const spread = touSpread[state] ?? Math.max(0.05, rate * 0.5);
  const usableDaily = kwh * 0.80 * 0.90;
  return usableDaily * spread * 365;
}

// Avoided outage cost — qualitative. Use a small annualized resilience value:
// average household loses $150–$300/year in spoilage + lost-productivity from outages (NREL ICE Calculator)
function annualResilienceValue(useCase: UseCase): number {
  switch (useCase) {
    case 'backup_only': return 100;
    case 'self_consumption': return 50;
    case 'tou_arbitrage': return 50;
    case 'full_home_backup': return 250;
  }
}

export interface BatteryResult extends CalcComputeOutput {
  federalCredit: CostBand3;
  stateAmt: CostBand3;
  stateRebate: (CostBand3 & { name: string; note: string }) | null;
  net: CostBand3;
  fedRate: number;
  annualSavings: number;
  tou: number;
  resilience: number;
  paybackYears: number | null;
}

export function compute(inputs: BatteryInputs, opts?: ComputeOpts): BatteryResult {
  const { state, kwh, useCase, chemistry, paired, panel, installYear } = inputs;
  const stateMult = opts?.laborMult ?? (findStateLabor(state)?.electrician_multiplier ?? 1.0);
  const basePerKwh = paired === 'yes' ? COST_PER_KWH_PAIRED : COST_PER_KWH_RETROFIT;
  const chemMult = CHEMISTRY_PREMIUM[chemistry];
  const ucMult = USECASE_PREMIUM[useCase];

  const equipmentAndLabor: CostBand3 = {
    low: basePerKwh.low * kwh * chemMult * ucMult * stateMult,
    mid: basePerKwh.mid * kwh * chemMult * ucMult * stateMult,
    high: basePerKwh.high * kwh * chemMult * ucMult * stateMult,
  };

  // Panel-adjacent work: 100A panels often need a critical-load subpanel; 200A typically does not for backup-only
  const panelAdder: CostBand3 = panel === '100A' && (useCase === 'full_home_backup' || useCase === 'backup_only')
    ? { low: 800, mid: 1400, high: 2200 }
    : { low: 0, mid: 0, high: 0 };

  const permit: CostBand3 = scale(BASE_PERMIT, stateMult);

  const gross = add(add(equipmentAndLabor, panelAdder), permit);

  // 25D federal credit — TERMINATED by OBBBA for property placed in service after 2025-12-31.
  // Standalone battery >=3 kWh qualified historically; not available for 2026 onward.
  // Source: IRS https://www.irs.gov/credits-deductions/residential-clean-energy-credit
  const fedRate = installYear <= 2025 ? 0.30 : 0;
  const federalCredit: CostBand3 = scale(gross, fedRate);

  const stateRebate = utilityRebateRange(state, kwh);
  const stateAmt: CostBand3 = stateRebate
    ? { low: stateRebate.low, mid: stateRebate.mid, high: stateRebate.high }
    : { low: 0, mid: 0, high: 0 };

  const net: CostBand3 = {
    low: Math.max(0, gross.low - federalCredit.low - stateAmt.low),
    mid: Math.max(0, gross.mid - federalCredit.mid - stateAmt.mid),
    high: Math.max(0, gross.high - federalCredit.high - stateAmt.high),
  };

  // Operating savings
  const tou = useCase === 'tou_arbitrage' || useCase === 'self_consumption'
    ? annualArbitrageSavings(state, kwh)
    : 0;
  const resilience = annualResilienceValue(useCase);
  const annualSavings = tou + resilience;
  const paybackYears = annualSavings > 0 ? Math.round((net.mid / annualSavings) * 10) / 10 : null;

  return {
    gross, federalCredit, stateAmt, stateRebate, net, fedRate,
    annualSavings, tou, resilience, paybackYears,
    brk: {},   // $/kWh installed pricing lumps battery hardware + labor into one line — no honest category split
    scope: `${kwh} kWh · ${USECASE_OPTIONS.find(o => o.value === useCase)?.label.replace(/\s*\(.*\)$/, '') ?? useCase}`,
    attrs: [
      ['Cell chemistry', CHEMISTRY_OPTIONS.find(o => o.value === chemistry)?.label ?? ''],
      ['Paired with solar', PAIRED_OPTIONS.find(o => o.value === paired)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<BatteryInputs> = {
  small:   { state: 'US', kwh: 8, useCase: 'backup_only', chemistry: 'lfp', paired: 'yes', panel: '200A', installYear: 2026 },
  typical: { state: 'US', kwh: 13.5, useCase: 'self_consumption', chemistry: 'lfp', paired: 'yes', panel: '200A', installYear: 2026 },
  large:   { state: 'US', kwh: 20, useCase: 'full_home_backup', chemistry: 'lfp', paired: 'yes', panel: '200A', installYear: 2026 },
};

export const TIER_LABELS: TierLabels = {
  small: 'single unit',
  typical: 'two units',
  large: 'whole-home backup',
};

export const COST_MIX: CostMix = { material: 0.78, labor: 0.20, equipment: 0.02 };
