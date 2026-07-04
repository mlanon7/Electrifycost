/*
 * Solar PV calculator — pure compute. Extracted verbatim from
 * src/components/SolarCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor, stateEnergy } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type RoofType = 'comp_shingle' | 'tile' | 'metal' | 'flat';
export type Complexity = 'simple' | 'standard' | 'complex' | 'historic_hoa';
export type Inverter = 'string' | 'micro' | 'optimizer';
export type Mount = 'rooftop' | 'ground';
export type BatterySize = 'none' | 'small' | 'medium' | 'large';

export interface SolarInputs {
  state: string;
  kw: number;
  roof: RoofType;
  complexity: Complexity;
  inverter: Inverter;
  mount: Mount;
  battery: BatterySize;
  annualKwh: number;
  installYear: number;
}

export const ROOF_OPTIONS: { value: RoofType; label: string }[] = [
  { value: 'comp_shingle', label: 'Composition shingle (baseline)' },
  { value: 'tile', label: 'Tile (concrete or clay)' },
  { value: 'metal', label: 'Metal (standing seam)' },
  { value: 'flat', label: 'Flat / membrane' },
];

export const COMPLEXITY_OPTIONS: { value: Complexity; label: string }[] = [
  { value: 'simple', label: 'Simple (single plane, no shade)' },
  { value: 'standard', label: 'Standard (2-3 planes)' },
  { value: 'complex', label: 'Complex (multiple planes / shade)' },
  { value: 'historic_hoa', label: 'Historic district / HOA' },
];

export const INVERTER_OPTIONS: { value: Inverter; label: string }[] = [
  { value: 'string', label: 'String inverter (cheapest)' },
  { value: 'optimizer', label: 'DC optimizers (SolarEdge-style)' },
  { value: 'micro', label: 'Microinverters (Enphase IQ8)' },
];

export const MOUNT_OPTIONS: { value: Mount; label: string }[] = [
  { value: 'rooftop', label: 'Rooftop' },
  { value: 'ground', label: 'Ground mount' },
];

export const BATTERY_OPTIONS: { value: BatterySize; label: string }[] = [
  { value: 'none', label: 'No battery' },
  { value: 'small', label: 'Small (~5 kWh)' },
  { value: 'medium', label: 'Medium (~10-13.5 kWh — Powerwall class)' },
  { value: 'large', label: 'Large (~20 kWh)' },
];

export const INSTALL_YEAR_OPTIONS: { value: number; label: string }[] = [
  { value: 2026, label: '2026 (no federal — 25D expired)' },
  { value: 2027, label: '2027 (no federal)' },
  { value: 2028, label: '2028 (no federal)' },
  { value: 2025, label: '2025 (historical — last 30% year)' },
];

const add = (a: CostBand3, b: CostBand3): CostBand3 => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 base installed cost ($/W DC), drawn from NREL/LBNL Tracking the Sun 2024 + EnergySage 2025 market data.
// Median residential PV installed cost stabilized at ~$3.30/W after the 2024-2025 module price drop.
// LBNL "Tracking the Sun" 2024 report median: $3.40/W; EnergySage Q4 2024 marketplace median: $2.92/W
// (excluding very small / very large outliers); we use $3.30/W mid with a meaningful spread.
const BASE_PER_W: CostBand3 = { low: 2.50, mid: 3.30, high: 4.50 };

// Roof complexity multipliers
const ROOF_MULT: Record<RoofType, number> = {
  comp_shingle: 1.00,   // baseline — flush mount on asphalt
  tile: 1.20,           // tile hooks / careful flashing; 15-20% premium
  metal: 1.10,          // standing-seam clamps; modest premium
  flat: 1.15,           // ballasted or membrane penetration; tilt frames
};

// Site complexity multipliers
const COMPLEXITY_MULT: Record<Complexity, number> = {
  simple: 0.95,         // single south-facing plane, two-story max, no shade
  standard: 1.00,       // typical 2-3 roof planes
  complex: 1.15,        // 4+ planes, shade mitigation, dormers, conduit runs
  historic_hoa: 1.20,   // HOA review, historic district, hidden conduit
};

// Inverter premium per Watt
const INVERTER_PREMIUM: Record<Inverter, number> = {
  string: 0,            // baseline cheap centralized inverter
  micro: 0.20,          // per-panel microinverters (Enphase IQ8 etc.) ~$0.18-0.22/W
  optimizer: 0.10,      // SolarEdge-style DC optimizers ~$0.08-0.12/W
};

// Mount premium per Watt
const MOUNT_PREMIUM: Record<Mount, number> = {
  rooftop: 0,           // baseline
  ground: 0.40,         // trenching, footings, conduit run ~$0.35-0.50/W
};

// Battery storage adders (installed, including ancillaries) — 2026 market
// Tesla Powerwall 3 13.5 kWh: ~$13,500-17,000 installed; LG Resu, Enphase IQ Battery similar/W.
const BATTERY_ADDER: Record<BatterySize, CostBand3> = {
  none:   { low: 0,      mid: 0,      high: 0 },
  small:  { low: 7000,   mid: 9000,   high: 11500 },   // ~5 kWh
  medium: { low: 13000,  mid: 16000,  high: 19500 },   // ~10-13.5 kWh
  large:  { low: 19000,  mid: 23000,  high: 28000 },   // ~20 kWh
};

// PVWatts-style annual production factors (kWh/kW installed/year).
// Drawn from NREL PVWatts national-average regional outputs for south-facing
// fixed roof tilt. Values represent specific yield for representative state.
export const PRODUCTION_KWH_PER_KW: Record<string, number> = {
  AL: 1400, AK: 1050, AZ: 1700, AR: 1400, CA: 1600, CO: 1600, CT: 1300,
  DE: 1350, DC: 1350, FL: 1450, GA: 1400, HI: 1700, ID: 1450, IL: 1300,
  IN: 1300, IA: 1350, KS: 1500, KY: 1300, LA: 1400, ME: 1250, MD: 1300,
  MA: 1300, MI: 1250, MN: 1350, MS: 1400, MO: 1400, MT: 1400, NE: 1450,
  NV: 1700, NH: 1300, NJ: 1300, NM: 1700, NY: 1250, NC: 1400, ND: 1400,
  OH: 1250, OK: 1500, OR: 1250, PA: 1300, RI: 1300, SC: 1400, SD: 1450,
  TN: 1350, TX: 1500, UT: 1600, VT: 1250, VA: 1350, WA: 1100, WV: 1250,
  WI: 1300, WY: 1500,
};

// 25D federal Residential Clean Energy Credit — TERMINATED by OBBBA for property
// placed in service after 2025-12-31. Pre-2026 historical installs got 30%.
// Source: IRS https://www.irs.gov/credits-deductions/residential-clean-energy-credit
function federal25DRate(year: number): number {
  if (year <= 2025) return 0.30;   // historical only
  return 0;                         // 2026 onward: not available
}

// State-level residential solar incentives (high-level 2026 snapshot).
// These are *approximations* for the calculator; the per-page guide links to
// each state's program for verification.
const STATE_SOLAR_INCENTIVE: Record<string, { name: string; perKw?: number; flat?: number; note: string }> = {
  NY: { name: 'NY-Sun Residential Block', perKw: 200, note: '$0.20-0.40/W declining-block (varies by region)' },
  MA: { name: 'MA SMART', perKw: 0, note: 'Production-based SMART program; 10-yr incentive payment (not modeled here)' },
  NJ: { name: 'NJ SuSI', perKw: 0, note: 'SREC-II program pays $90/MWh for 15 years; income stream, not upfront' },
  IL: { name: 'IL Shines Adjustable Block', perKw: 0, note: 'SRECs paid over 15 years' },
  MD: { name: 'MD Residential Clean Energy Grant', flat: 1000, note: '$1,000 flat grant for qualifying systems' },
  CT: { name: 'CT Residential Renewable Energy Solutions (RRES)', perKw: 0, note: 'Net-metering successor; tariff-based, not upfront' },
  RI: { name: 'RI Renewable Energy Growth', perKw: 0, note: 'Production-based tariff' },
  TX: { name: 'Austin Energy / CPS (city-specific)', flat: 2500, note: 'Austin Energy rebate where available' },
  CA: { name: 'CA NEM 3.0 / SGIP', perKw: 0, note: 'Battery incentives via SGIP; reduced NEM export rates under NEM 3.0' },
};

interface UtilityRebateEstimate { name: string; low: number; mid: number; high: number; }
// Conservative utility-rebate range applied where state has known program; otherwise 0
function utilityRebateRange(state: string, kw: number): UtilityRebateEstimate | null {
  const s = STATE_SOLAR_INCENTIVE[state];
  if (!s) return null;
  if (s.flat && s.flat > 0) return { name: s.name, low: s.flat * 0.8, mid: s.flat, high: s.flat * 1.1 };
  if (s.perKw && s.perKw > 0) {
    const v = s.perKw * kw;
    return { name: s.name, low: v * 0.7, mid: v, high: v * 1.2 };
  }
  return null;
}

export interface SolarResult extends CalcComputeOutput {
  federalCredit: CostBand3;
  stateAmt: CostBand3;
  stateRebateName: string | null;
  stateNote: string | null;
  net: CostBand3;
  fedRate: number;
  annualProduction: number;
  offsetPct: number;
  ratePerKwh: number;
  annualValue: number;
  paybackYears: number | null;
  lifetimeSavings: number;
  lifetimeNetReturn: number;
}

export function compute(inputs: SolarInputs, opts?: ComputeOpts): SolarResult {
  const { state, kw, roof, complexity, inverter, mount, battery, annualKwh, installYear } = inputs;
  const watts = kw * 1000;
  const stateMult = opts?.laborMult ?? (findStateLabor(state)?.electrician_multiplier ?? 1.0);
  const roofM = ROOF_MULT[roof];
  const complexM = COMPLEXITY_MULT[complexity];
  const invPrem = INVERTER_PREMIUM[inverter];
  const mountPrem = MOUNT_PREMIUM[mount];

  // Per-W cost adjusted for state + roof + complexity, plus inverter + mount premiums
  const adjustedPerW: CostBand3 = {
    low: (BASE_PER_W.low * stateMult * roofM * complexM) + invPrem + mountPrem,
    mid: (BASE_PER_W.mid * stateMult * roofM * complexM) + invPrem + mountPrem,
    high: (BASE_PER_W.high * stateMult * roofM * complexM) + invPrem + mountPrem,
  };

  const pvCost: CostBand3 = {
    low: adjustedPerW.low * watts,
    mid: adjustedPerW.mid * watts,
    high: adjustedPerW.high * watts,
  };

  const batteryCost = BATTERY_ADDER[battery];
  const gross = add(pvCost, batteryCost);

  // 25D federal credit
  const fedRate = federal25DRate(installYear);
  const federalCredit: CostBand3 = scale(gross, fedRate);

  // State / utility upfront rebate (where modeled)
  const stateRebate = utilityRebateRange(state, kw);
  const stateAmt: CostBand3 = stateRebate
    ? { low: stateRebate.low, mid: stateRebate.mid, high: stateRebate.high }
    : { low: 0, mid: 0, high: 0 };

  const net: CostBand3 = {
    low: Math.max(0, gross.low - federalCredit.low - stateAmt.low),
    mid: Math.max(0, gross.mid - federalCredit.mid - stateAmt.mid),
    high: Math.max(0, gross.high - federalCredit.high - stateAmt.high),
  };

  // Production estimate
  const yieldKwhPerKw = PRODUCTION_KWH_PER_KW[state] ?? 1350;
  const annualProduction = kw * yieldKwhPerKw;
  const offsetPct = Math.min(100, Math.round((annualProduction / Math.max(annualKwh, 1)) * 100));

  // Electricity rate for payback (cents/kWh from state-energy-prices.csv → $/kWh)
  const energyRow = stateEnergy.find(e => e.state === state);
  const ratePerKwh = energyRow ? energyRow.electricity_cents_per_kwh / 100 : 0.16;
  const annualValue = Math.min(annualProduction, annualKwh) * ratePerKwh;

  // Simple-payback period using mid net cost.
  const paybackYears = annualValue > 0 ? Math.round((net.mid / annualValue) * 10) / 10 : null;

  // 25-year cumulative savings (no escalation, conservative — utility rates do typically escalate ~3%/yr)
  const lifetimeSavings = annualValue * 25;
  const lifetimeNetReturn = lifetimeSavings - net.mid;

  return {
    gross, federalCredit, stateAmt, stateRebateName: stateRebate?.name ?? null,
    stateNote: STATE_SOLAR_INCENTIVE[state]?.note ?? null,
    net, fedRate, annualProduction, offsetPct, ratePerKwh, annualValue, paybackYears,
    lifetimeSavings, lifetimeNetReturn,
    brk: {},   // whole-job $/W pricing — no honest materials/labor split
    scope: `${kw} kW system`,
    attrs: [
      ['Inverter', INVERTER_OPTIONS.find(o => o.value === inverter)?.label ?? ''],
      ['Battery', BATTERY_OPTIONS.find(o => o.value === battery)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<SolarInputs> = {
  small:   { state: 'US', kw: 5, roof: 'comp_shingle', complexity: 'standard', inverter: 'string', mount: 'rooftop', battery: 'none', annualKwh: 10500, installYear: 2026 },
  typical: { state: 'US', kw: 8, roof: 'comp_shingle', complexity: 'standard', inverter: 'string', mount: 'rooftop', battery: 'none', annualKwh: 10500, installYear: 2026 },
  large:   { state: 'US', kw: 15, roof: 'comp_shingle', complexity: 'standard', inverter: 'string', mount: 'rooftop', battery: 'none', annualKwh: 10500, installYear: 2026 },
};

export const TIER_LABELS: TierLabels = {
  small: '5 kW',
  typical: '8 kW',
  large: '15 kW',
};

export const COST_MIX: CostMix = { material: 0.72, labor: 0.26, equipment: 0.02 };
