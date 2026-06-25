// Shared calculator engine. All five module calculators consume this.
// The model is intentionally explicit and source-traceable: every output
// can be tied back to a row in one of the seed CSV files at /data/csv/.
//
// IMPORTANT: there are no hardcoded numeric tables in this file. Multipliers,
// labor rates, panel-risk factors, and operating-cost constants all come from
// data/csv/*.csv via the helpers in ./data.ts. To tune the model, edit the
// CSVs (a non-engineer can do this in a spreadsheet).
//
// Incentive eligibility is split into two buckets:
//   - `incentives` — confirmed for the user (subtracted from net cost)
//   - `potentialIncentives` — surface-only; not subtracted (e.g. 30C when
//      the user hasn't confirmed an eligible census tract; DOE Home Energy
//      Rebates when the state hasn't opened the program yet)
// This split avoids over-promising savings the user may not actually qualify
// for and is the v3 trust fix that backs the May-2026 audit.

import type {
  Module,
  CostRange,
  PanelRiskRule,
  RebateProgram,
  CostMultiplier,
} from './data';
import {
  findCostScenario,
  findStateLabor,
  findStateEnergy,
  findClimate,
  getRebatesFor,
  getPanelRisk,
  findCostMultiplier,
  findModuleLaborRate,
  findPanelRiskFactor,
  findOperatingCostConstant,
  findHomeEnergyRebateStatus,
  sources,
} from './data';

export type Difficulty = 'simple' | 'average' | 'difficult';
export type HomeType = 'single_family' | 'townhouse' | 'condo' | 'manufactured';
export type FuelType = 'natural_gas' | 'propane' | 'oil' | 'electric_resistance' | 'heat_pump';
export type Timing = 'emergency' | 'this_year' | 'planning';
export type IncomeBand = 'unknown' | 'standard' | 'moderate_income' | 'low_income';
export type PanelSize = 'unknown' | '60A' | '100A' | '125A' | '150A' | '200A' | '320/400A';
export type CensusTract = 'unknown' | 'yes' | 'no';

export interface CommonInput {
  zip?: string;
  state: string;
  homeSqft?: number;
  homeAgeBand?: string;
  fuelHeating?: FuelType;
  fuelWater?: FuelType;
  panelSize: PanelSize;
  difficulty: Difficulty;
  homeType?: HomeType;
  ductwork?: 'good' | 'fair' | 'poor' | 'none';
  timing?: Timing;
  income?: IncomeBand;
  utility?: string;
  contractorQuote?: number;
}

export interface CostBand {
  low: number;
  mid: number;
  high: number;
}

export interface IncentiveLineItem {
  programId: string;
  name: string;
  scope: 'federal' | 'state' | 'utility';
  incentiveType: 'tax_credit' | 'rebate';
  amount: CostBand;
  status: string;
  expiration: string;
  sourceUrl: string;
  caveat?: string;
  /** When true, this is a potential incentive (NOT subtracted from net). */
  potential?: boolean;
}

export interface CostBreakdownItem {
  label: string;
  amount: CostBand;
  notes?: string;
}

export interface CalculatorResult {
  module: Module;
  scenario: string;
  scenarioLabel: string;
  gross: CostBand;
  netAfterIncentives: CostBand;
  itemized: CostBreakdownItem[];
  /** Confirmed incentives — subtracted from netAfterIncentives. */
  incentives: IncentiveLineItem[];
  /** Potential incentives — eligibility is not confirmed; NOT subtracted. */
  potentialIncentives: IncentiveLineItem[];
  panelRisk?: PanelRiskRule;
  panelAdder?: CostBand;
  annualOperatingChange?: CostBand;
  monthlyEnergyImpact?: CostBand;
  energyImpactDirection?: 'savings' | 'increase' | 'neutral';
  simplePaybackMonths?: number | null;
  contractorChecklistKey: string;
  sourceIds: string[];
  reviewedAt: string;
  caveats: string[];
}

function bandFromTriple(low: number, mid: number, high: number): CostBand {
  return { low, mid, high };
}

function bandFromMultiplier(m: CostMultiplier): CostBand {
  return { low: m.low, mid: m.mid, high: m.high };
}

function difficultyMultiplier(d: Difficulty): CostBand {
  return bandFromMultiplier(findCostMultiplier('difficulty', d));
}
function homeTypeMultiplier(t?: HomeType): CostBand {
  return bandFromMultiplier(findCostMultiplier('home_type', t ?? 'single_family'));
}
function timingMultiplier(t?: Timing): CostBand {
  return bandFromMultiplier(findCostMultiplier('timing', t ?? 'planning'));
}

function multiplyBand(a: CostBand, b: CostBand): CostBand {
  return { low: a.low * b.low, mid: a.mid * b.mid, high: a.high * b.high };
}
function addBand(a: CostBand, b: CostBand): CostBand {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}
function subtractBand(a: CostBand, b: CostBand): CostBand {
  return { low: Math.max(0, a.low - b.high), mid: Math.max(0, a.mid - b.mid), high: Math.max(0, a.high - b.low) };
}
function roundBand(b: CostBand, step = 25): CostBand {
  const r = (n: number) => Math.round(n / step) * step;
  return { low: r(b.low), mid: r(b.mid), high: r(b.high) };
}

function laborRateForModule(module: Module): number {
  return findModuleLaborRate(module);
}

function laborMultiplierForModule(state: string, module: Module): number {
  const sl = findStateLabor(state);
  if (!sl) return 1.0;
  switch (module) {
    case 'panel':
    case 'ev_charger':
    case 'induction':
      return sl.electrician_multiplier;
    case 'heat_pump':
      return sl.hvac_multiplier;
    case 'hpwh':
      return (sl.hvac_multiplier + sl.plumber_multiplier) / 2;
  }
}

function computeBaseCost(scenario: CostRange, module: Module, state: string): CostBand {
  const labor = laborRateForModule(module);
  const sm = laborMultiplierForModule(state, module);
  const baseLabor = bandFromTriple(
    scenario.labor_hours_low * labor * sm,
    scenario.labor_hours_mid * labor * sm,
    scenario.labor_hours_high * labor * sm,
  );
  const material = bandFromTriple(scenario.material_low, scenario.material_mid, scenario.material_high);
  const permit = bandFromTriple(scenario.permit_low, scenario.permit_mid, scenario.permit_high);
  return addBand(addBand(material, baseLabor), permit);
}

function applyIncentive(program: RebateProgram, gross: CostBand, income: IncomeBand): CostBand {
  if (program.income_rule === 'income_qualified' && (income === 'unknown' || income === 'standard')) {
    return bandFromTriple(0, 0, 0);
  }
  let lo = program.amount_low;
  let mi = program.amount_mid;
  let hi = program.amount_high;
  if (program.percent && program.percent > 0) {
    const pct = program.percent / 100;
    const cap = program.cap || Infinity;
    lo = Math.min(gross.low * pct, cap);
    mi = Math.min(gross.mid * pct, cap);
    hi = Math.min(gross.high * pct, cap);
  }
  return bandFromTriple(lo, mi, hi);
}

/**
 * True when expirationDate is a parseable YYYY-MM-DD that is strictly less
 * than `today`. The comparison is string-lexicographic on ISO dates, which is
 * date-correct without pulling in a date library.
 */
export function isExpired(expirationDate: string | undefined, today: string): boolean {
  if (!expirationDate) return false;
  if (expirationDate === 'unspecified' || expirationDate === 'none') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)) return false;
  return expirationDate < today;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface BuildIncentivesArgs {
  module: Module;
  state: string;
  income: IncomeBand;
  gross: CostBand;
  eligibleCensusTract: CensusTract;
  today: string;
}

function buildIncentiveLines({
  module, state, income, gross, eligibleCensusTract, today,
}: BuildIncentivesArgs): { applied: IncentiveLineItem[]; potential: IncentiveLineItem[] } {
  const programs = getRebatesFor(module, state);
  const applied: IncentiveLineItem[] = [];
  const potential: IncentiveLineItem[] = [];

  for (const p of programs) {
    // Skip placeholder rows whenever a real state is selected.
    if (p.status === 'placeholder' && state) continue;
    // Skip expired programs entirely — neither applied nor potential.
    if (isExpired(p.expiration_date, today)) continue;
    // 30C: if user confirmed not eligible, skip; if unknown, surface as potential.
    if (p.program_id === 'FED_30C_EVSE' && eligibleCensusTract === 'no') continue;

    const amount = applyIncentive(p, gross, income);
    if (amount.low === 0 && amount.mid === 0 && amount.high === 0) continue;

    const base: IncentiveLineItem = {
      programId: p.program_id,
      name: p.program_name,
      scope: p.scope,
      incentiveType: p.incentive_type,
      amount,
      status: p.status,
      expiration: p.expiration_date,
      sourceUrl: p.source_url,
    };

    // Closed or fully-reserved programs (e.g. TECH Clean California after funds were
    // fully reserved): surface for context but never subtract from net.
    if (p.status === 'reserved' || p.status === 'closed') {
      potential.push({
        ...base,
        potential: true,
        caveat: (p.status === 'reserved' ? 'Funding fully reserved' : 'Closed to new applicants')
          + ' — the administrator is not accepting new reservations. Shown for context; not subtracted from your net cost above.',
      });
      continue;
    }

    // 30C with unknown census tract → potential.
    if (p.program_id === 'FED_30C_EVSE' && eligibleCensusTract === 'unknown') {
      potential.push({
        ...base,
        potential: true,
        caveat: 'Eligibility depends on the install address being in a qualifying census tract. Verify via the IRS Form 8911 instructions or DOE eligibility tool. Not subtracted from your net cost above.',
      });
      continue;
    }

    // DOE Home Energy Rebates (HEEHRA / HOMES): gate by per-state status.
    // If the program isn't `open` in this state, surface as potential.
    if (p.program_id.startsWith('DOE_HOMES')) {
      const stateStatus = findHomeEnergyRebateStatus(state)?.status ?? 'unknown';
      if (stateStatus !== 'open') {
        const statusLabel = stateStatus === 'reserved' ? 'Funding reserved'
          : stateStatus === 'closed' ? 'Closed to new applicants'
          : stateStatus === 'prelaunch' ? 'Program not yet launched in your state'
          : 'State rollout status unknown';
        potential.push({
          ...base,
          potential: true,
          caveat: `${statusLabel}. Check with your state energy office before relying on this amount. Not subtracted from your net cost above.`,
        });
        continue;
      }
    }

    // Default caveat assignment for confirmed lines.
    const caveat: string | undefined =
      p.income_rule === 'income_qualified'
        ? 'Income-qualified. Eligibility and amounts vary by state administrator.'
        : p.status === 'state_rolling_out'
          ? 'Program is rolling out by state. Check your state energy office for availability.'
          : undefined;

    applied.push({ ...base, caveat });
  }

  return { applied, potential };
}

interface OperatingArgs {
  state: string;
  module: Module;
  baseFuel?: FuelType;
  homeSqft?: number;
}

function spread(center: number, frac: number, floor: number): CostBand {
  const s = Math.max(Math.abs(center) * frac, floor);
  return bandFromTriple(center - s, center, center + s);
}

function computeAnnualOperatingChange({ state, module, baseFuel, homeSqft = 1800 }: OperatingArgs): CostBand | undefined {
  const energy = findStateEnergy(state);
  const climate = findClimate(state);
  if (!energy) return undefined;
  const elec = energy.electricity_cents_per_kwh / 100;
  const defaultFrac = findOperatingCostConstant('spread_default_frac');

  if (module === 'heat_pump' && climate) {
    const uaPerSqft = findOperatingCostConstant('hp_ua_per_sqft');
    const copStandard = findOperatingCostConstant('hp_cop_standard');
    const copCold = findOperatingCostConstant('hp_cop_coldclimate');
    const oversizeC = findOperatingCostConstant('hp_oversize_factor_combustion');
    const oversizeO = findOperatingCostConstant('hp_oversize_factor_oil');
    const btuTherm = findOperatingCostConstant('hp_btu_per_therm');
    const btuPropane = findOperatingCostConstant('hp_btu_per_gallon_propane');
    const btuOil = findOperatingCostConstant('hp_btu_per_gallon_oil');
    const btuKwh = findOperatingCostConstant('hp_btu_per_kwh');
    const floor = findOperatingCostConstant('spread_floor_heat_pump');
    const ua = homeSqft * uaPerSqft;
    const heatingBtu = climate.heating_degree_days * 24 * ua;
    const heatingKwh = heatingBtu / btuKwh;
    const cop = climate.heat_pump_class === 'coldclimate' ? copCold : copStandard;
    const newElec = (heatingKwh / cop) * elec;
    let oldFuel = 0;
    switch (baseFuel) {
      case 'natural_gas': oldFuel = (heatingBtu * oversizeC) / btuTherm * energy.natural_gas_dollars_per_therm; break;
      case 'propane': oldFuel = (heatingBtu * oversizeC) / btuPropane * energy.propane_dollars_per_gallon; break;
      case 'oil': oldFuel = (heatingBtu * oversizeO) / btuOil * energy.heating_oil_dollars_per_gallon; break;
      case 'electric_resistance': oldFuel = heatingKwh * elec; break;
      default: oldFuel = newElec;
    }
    return spread(newElec - oldFuel, defaultFrac, floor);
  }

  if (module === 'hpwh') {
    const baseKwh = findOperatingCostConstant('hpwh_baseline_kwh_per_year');
    const cop = findOperatingCostConstant('hpwh_cop');
    const baselineTherms = findOperatingCostConstant('hpwh_baseline_therms_per_year');
    const baselinePropane = findOperatingCostConstant('hpwh_baseline_propane_gal_per_year');
    const baselineOil = findOperatingCostConstant('hpwh_baseline_oil_gal_per_year');
    const floor = findOperatingCostConstant('spread_floor_hpwh');
    const newElec = (baseKwh / cop) * elec;
    let oldFuel = 0;
    switch (baseFuel) {
      case 'natural_gas': oldFuel = baselineTherms * energy.natural_gas_dollars_per_therm; break;
      case 'propane': oldFuel = baselinePropane * energy.propane_dollars_per_gallon; break;
      case 'oil': oldFuel = baselineOil * energy.heating_oil_dollars_per_gallon; break;
      case 'electric_resistance': oldFuel = baseKwh * elec; break;
      default: oldFuel = newElec;
    }
    return spread(newElec - oldFuel, defaultFrac, floor);
  }

  if (module === 'induction') {
    const sg = findOperatingCostConstant('induction_baseline_savings_gas');
    const sp = findOperatingCostConstant('induction_baseline_savings_propane');
    const frac = findOperatingCostConstant('spread_frac_induction');
    const floor = findOperatingCostConstant('spread_floor_induction');
    const annual = baseFuel === 'natural_gas' ? sg : baseFuel === 'propane' ? sp : 0;
    return spread(annual, frac, floor);
  }

  if (module === 'ev_charger') {
    const evKwh = findOperatingCostConstant('ev_annual_kwh');
    const gasoline = findOperatingCostConstant('ev_baseline_gasoline_cost');
    const frac = findOperatingCostConstant('spread_frac_ev');
    const floor = findOperatingCostConstant('spread_default_floor');
    const evCost = evKwh * elec;
    return spread(evCost - gasoline, frac, floor);
  }

  return undefined;
}

function panelAdderForModule(module: Module, panelSize: PanelSize, difficulty: Difficulty, state: string): { band: CostBand; risk?: PanelRiskRule } | undefined {
  const risk = getPanelRisk(module, panelSize);
  if (!risk) return undefined;
  if (risk.risk_level === 'minimal' || risk.risk_level === 'low') {
    return { band: bandFromTriple(0, 0, 0), risk };
  }
  let scenarioName = 'upgrade_100_to_200';
  if (panelSize === '150A') scenarioName = 'upgrade_150_to_200';
  if (panelSize === '60A') scenarioName = 'upgrade_100_to_200';
  const sc = findCostScenario('panel', scenarioName);
  if (!sc) return { band: bandFromTriple(0, 0, 0), risk };
  const base = computeBaseCost(sc, 'panel', state);
  const dm = difficultyMultiplier(difficulty);
  let raw = multiplyBand(base, dm);
  const fr = findPanelRiskFactor(risk.risk_level);
  raw = {
    low: raw.low * fr.factor * fr.low_spread,
    mid: raw.mid * fr.factor,
    high: raw.high * fr.factor * fr.high_spread,
  };
  return { band: roundBand(raw, 25), risk };
}

export interface CalcArgs extends CommonInput {
  module: Module;
  scenario: string;
  scenarioLabel: string;
  contractorChecklistKey: string;
  removalAdder?: number;
  circuitAdder?: CostBand;
  ductworkPenalty?: CostBand;
  tightSpacePenalty?: CostBand;
  eligibleCensusTract?: CensusTract;
  /** Override "today" for tests. Defaults to current ISO date. */
  asOf?: string;
}

export function runCalculator(args: CalcArgs): CalculatorResult {
  const sc = findCostScenario(args.module, args.scenario);
  if (!sc) throw new Error('Cost scenario not found: ' + args.module + ' / ' + args.scenario);

  const today = args.asOf ?? todayIso();
  const base = computeBaseCost(sc, args.module, args.state);
  const dm = difficultyMultiplier(args.difficulty);
  const ht = homeTypeMultiplier(args.homeType);
  const tm = timingMultiplier(args.timing);
  let gross = multiplyBand(multiplyBand(multiplyBand(base, dm), ht), tm);

  const itemized: CostBreakdownItem[] = [
    { label: 'Equipment', amount: bandFromTriple(sc.material_low, sc.material_mid, sc.material_high) },
    {
      label: 'Labor',
      amount: bandFromTriple(
        sc.labor_hours_low * laborRateForModule(args.module) * laborMultiplierForModule(args.state, args.module),
        sc.labor_hours_mid * laborRateForModule(args.module) * laborMultiplierForModule(args.state, args.module),
        sc.labor_hours_high * laborRateForModule(args.module) * laborMultiplierForModule(args.state, args.module),
      ),
      notes: 'State labor multiplier applied (' + args.state + ').',
    },
    { label: 'Permit & inspection', amount: bandFromTriple(sc.permit_low, sc.permit_mid, sc.permit_high) },
  ];

  // Band-consistent subtraction: low-minus-low, mid-minus-mid, high-minus-high.
  // (subtractBand inverts low/high — correct for net-after-incentives, wrong here:
  //  using subtractBand inflated adjustment.high by absorbing the full band spread.)
  const components = addBand(addBand(itemized[0].amount, itemized[1].amount), itemized[2].amount);
  const adjustment: CostBand = {
    low: Math.max(0, gross.low - components.low),
    mid: Math.max(0, gross.mid - components.mid),
    high: Math.max(0, gross.high - components.high),
  };
  if (adjustment.mid > 25) {
    itemized.push({
      label: 'Job complexity adjustment',
      amount: adjustment,
      notes: 'Reflects installation difficulty, home type, and timing.',
    });
  }

  if (args.circuitAdder && args.circuitAdder.mid > 0) {
    gross = addBand(gross, args.circuitAdder);
    itemized.push({ label: 'Circuit / wiring add-on', amount: args.circuitAdder });
  }
  if (args.removalAdder && args.removalAdder > 0) {
    const r = bandFromTriple(args.removalAdder * 0.7, args.removalAdder, args.removalAdder * 1.3);
    gross = addBand(gross, r);
    itemized.push({ label: 'Removal & disposal of old equipment', amount: r });
  }
  if (args.ductworkPenalty && args.ductworkPenalty.mid > 0) {
    gross = addBand(gross, args.ductworkPenalty);
    itemized.push({ label: 'Ductwork repair / replacement', amount: args.ductworkPenalty, notes: 'Existing ducts in poor condition or missing.' });
  }
  if (args.tightSpacePenalty && args.tightSpacePenalty.mid > 0) {
    gross = addBand(gross, args.tightSpacePenalty);
    itemized.push({ label: 'Tight-space install adder', amount: args.tightSpacePenalty, notes: 'Closet/utility-room install adds labor for ducted intake.' });
  }

  const panel = panelAdderForModule(args.module, args.panelSize, args.difficulty, args.state);
  if (panel && panel.band.mid > 0) {
    gross = addBand(gross, panel.band);
    itemized.push({ label: 'Possible panel upgrade', amount: panel.band, notes: panel.risk?.explanation });
  }
  gross = roundBand(gross, 25);

  const { applied: incentives, potential: potentialIncentives } = buildIncentiveLines({
    module: args.module,
    state: args.state,
    income: args.income ?? 'unknown',
    gross,
    eligibleCensusTract: args.eligibleCensusTract ?? 'unknown',
    today,
  });

  const totalApplied = incentives.reduce<CostBand>((acc, i) => addBand(acc, i.amount), bandFromTriple(0, 0, 0));
  const netAfterIncentives = roundBand(subtractBand(gross, totalApplied), 25);

  const opChange = computeAnnualOperatingChange({
    state: args.state,
    module: args.module,
    baseFuel: args.module === 'hpwh' ? args.fuelWater : args.fuelHeating,
    homeSqft: args.homeSqft,
  });

  let monthlyEnergyImpact: CostBand | undefined;
  let simplePaybackMonths: number | null = null;
  let energyImpactDirection: 'savings' | 'increase' | 'neutral' | undefined;
  if (opChange) {
    const neutralThreshold = findOperatingCostConstant('neutral_threshold_usd_per_year');
    monthlyEnergyImpact = { low: opChange.low / 12, mid: opChange.mid / 12, high: opChange.high / 12 };
    const straddlesZero = opChange.low < 0 && opChange.high > 0;
    if (Math.abs(opChange.mid) < neutralThreshold && straddlesZero) {
      energyImpactDirection = 'neutral';
    } else if (opChange.mid < 0) {
      energyImpactDirection = 'savings';
      const annualSavings = -opChange.mid;
      const incremental = netAfterIncentives.mid;
      simplePaybackMonths = incremental > 0 && annualSavings > 0
        ? Math.round((incremental / annualSavings) * 12)
        : null;
    } else {
      energyImpactDirection = 'increase';
    }
  }

  const sourceIds = new Set<string>();
  sourceIds.add(sc.source_id);
  if (args.module !== 'panel') sourceIds.add('SRC_EIA_RETAIL');
  sourceIds.add('SRC_BLS_ELECTRICIAN');
  for (const i of [...incentives, ...potentialIncentives]) {
    if (i.programId.startsWith('FED_25C')) sourceIds.add('SRC_IRS_25C');
    if (i.programId.startsWith('FED_30C')) sourceIds.add('SRC_IRS_8911');
    if (i.programId.startsWith('DOE_HOMES')) sourceIds.add('SRC_DOE_HOMES');
  }
  const latestReview = [...sourceIds].map(id => sources[id]?.last_reviewed).filter(Boolean).sort().pop() ?? sc.last_reviewed;

  const caveats: string[] = [
    'Estimates are planning ranges, not contractor quotes. Actual prices depend on your home, local labor rates, equipment, code requirements, utility rules, and contractor availability.',
  ];
  if (args.panelSize === 'unknown') {
    caveats.push('Panel size unknown; results assume an average load profile.');
  }
  if (args.income === 'low_income' || args.income === 'moderate_income') {
    caveats.push('Income-qualified rebates require state-administrator verification.');
  }
  if (panel?.risk && (panel.risk.risk_level === 'high' || panel.risk.risk_level === 'critical')) {
    caveats.push('Panel upgrade is included probabilistically.');
  }
  if (args.ductwork === 'poor' || args.ductwork === 'none') {
    caveats.push(args.ductwork === 'none'
      ? 'No existing ductwork; ductless mini-splits may be more practical.'
      : 'Ductwork in poor condition may require repair or replacement.');
  }
  if (args.eligibleCensusTract === 'no') {
    caveats.push('Federal 30C credit excluded; install address is not in an eligible census tract.');
  }
  if (potentialIncentives.length > 0) {
    caveats.push('Some incentives are surfaced as "potential" because eligibility is not yet confirmed; they are not subtracted from your net cost.');
  }

  return {
    module: args.module,
    scenario: args.scenario,
    scenarioLabel: args.scenarioLabel,
    gross,
    netAfterIncentives,
    itemized,
    incentives,
    potentialIncentives,
    panelRisk: panel?.risk,
    panelAdder: panel?.band,
    annualOperatingChange: opChange,
    monthlyEnergyImpact,
    energyImpactDirection,
    simplePaybackMonths,
    contractorChecklistKey: args.contractorChecklistKey,
    sourceIds: [...sourceIds],
    reviewedAt: latestReview,
    caveats,
  };
}
