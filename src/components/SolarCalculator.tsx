import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, stateEnergy } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type RoofType = 'comp_shingle' | 'tile' | 'metal' | 'flat';
type Complexity = 'simple' | 'standard' | 'complex' | 'historic_hoa';
type Inverter = 'string' | 'micro' | 'optimizer';
type Mount = 'rooftop' | 'ground';
type BatterySize = 'none' | 'small' | 'medium' | 'large';

interface CostBand { low: number; mid: number; high: number; }
const add = (a: CostBand, b: CostBand): CostBand => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 base installed cost ($/W DC), drawn from NREL/LBNL Tracking the Sun 2024 + EnergySage 2025 market data.
// Median residential PV installed cost stabilized at ~$3.30/W after the 2024-2025 module price drop.
// LBNL "Tracking the Sun" 2024 report median: $3.40/W; EnergySage Q4 2024 marketplace median: $2.92/W
// (excluding very small / very large outliers); we use $3.30/W mid with a meaningful spread.
const BASE_PER_W: CostBand = { low: 2.50, mid: 3.30, high: 4.50 };

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
const BATTERY_ADDER: Record<BatterySize, CostBand> = {
  none:   { low: 0,      mid: 0,      high: 0 },
  small:  { low: 7000,   mid: 9000,   high: 11500 },   // ~5 kWh
  medium: { low: 13000,  mid: 16000,  high: 19500 },   // ~10-13.5 kWh
  large:  { low: 19000,  mid: 23000,  high: 28000 },   // ~20 kWh
};

// PVWatts-style annual production factors (kWh/kW installed/year).
// Drawn from NREL PVWatts national-average regional outputs for south-facing
// fixed roof tilt. Values represent specific yield for representative state.
const PRODUCTION_KWH_PER_KW: Record<string, number> = {
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

export default function SolarCalculator() {
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [kw, setKw] = useState(7);                     // system DC size
  const [roof, setRoof] = useState<RoofType>('comp_shingle');
  const [complexity, setComplexity] = useState<Complexity>('standard');
  const [inverter, setInverter] = useState<Inverter>('string');
  const [mount, setMount] = useState<Mount>('rooftop');
  const [battery, setBattery] = useState<BatterySize>('none');
  const [annualKwh, setAnnualKwh] = useState(10500);   // U.S. avg residential = 10,500 kWh/year (EIA 2024)
  const [installYear, setInstallYear] = useState(2026);

  // ZIP → state auto-sync
  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const watts = kw * 1000;
    const stateMult = findStateLabor(state)?.electrician_multiplier ?? 1.0;
    const roofM = ROOF_MULT[roof];
    const complexM = COMPLEXITY_MULT[complexity];
    const invPrem = INVERTER_PREMIUM[inverter];
    const mountPrem = MOUNT_PREMIUM[mount];

    // Per-W cost adjusted for state + roof + complexity, plus inverter + mount premiums
    const adjustedPerW: CostBand = {
      low: (BASE_PER_W.low * stateMult * roofM * complexM) + invPrem + mountPrem,
      mid: (BASE_PER_W.mid * stateMult * roofM * complexM) + invPrem + mountPrem,
      high: (BASE_PER_W.high * stateMult * roofM * complexM) + invPrem + mountPrem,
    };

    const pvCost: CostBand = {
      low: adjustedPerW.low * watts,
      mid: adjustedPerW.mid * watts,
      high: adjustedPerW.high * watts,
    };

    const batteryCost = BATTERY_ADDER[battery];
    const gross = add(pvCost, batteryCost);

    // 25D federal credit
    const fedRate = federal25DRate(installYear);
    const federalCredit: CostBand = scale(gross, fedRate);

    // State / utility upfront rebate (where modeled)
    const stateRebate = utilityRebateRange(state, kw);
    const stateAmt: CostBand = stateRebate
      ? { low: stateRebate.low, mid: stateRebate.mid, high: stateRebate.high }
      : { low: 0, mid: 0, high: 0 };

    const net: CostBand = {
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
    };
  }, [state, kw, roof, complexity, inverter, mount, battery, annualKwh, installYear]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  const yieldKwhPerKw = PRODUCTION_KWH_PER_KW[state] ?? 1350;

  return (
    <>
    <div className="card overflow-hidden">
      {/* Inputs */}
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 90210"
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-600">Optional — auto-detects state</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">
            System size: <span className="font-bold tabular-nums text-ink-900">{kw} kW DC</span>
          </label>
          <input
            type="range" min={3} max={15} step={0.5} value={kw}
            onChange={e => setKw(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-ink-600">
            <span>3 kW (small)</span><span>7 kW (typical)</span><span>15 kW (large)</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Roof type</label>
          <select className="input mt-1 w-full" value={roof} onChange={e => setRoof(e.target.value as RoofType)}>
            <option value="comp_shingle">Composition shingle (baseline)</option>
            <option value="tile">Tile (concrete or clay)</option>
            <option value="metal">Metal (standing seam)</option>
            <option value="flat">Flat / membrane</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Site complexity</label>
          <select className="input mt-1 w-full" value={complexity} onChange={e => setComplexity(e.target.value as Complexity)}>
            <option value="simple">Simple (single plane, no shade)</option>
            <option value="standard">Standard (2-3 planes)</option>
            <option value="complex">Complex (multiple planes / shade)</option>
            <option value="historic_hoa">Historic district / HOA</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Inverter</label>
          <select className="input mt-1 w-full" value={inverter} onChange={e => setInverter(e.target.value as Inverter)}>
            <option value="string">String inverter (cheapest)</option>
            <option value="optimizer">DC optimizers (SolarEdge-style)</option>
            <option value="micro">Microinverters (Enphase IQ8)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Mount type</label>
          <select className="input mt-1 w-full" value={mount} onChange={e => setMount(e.target.value as Mount)}>
            <option value="rooftop">Rooftop</option>
            <option value="ground">Ground mount</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Battery storage</label>
          <select className="input mt-1 w-full" value={battery} onChange={e => setBattery(e.target.value as BatterySize)}>
            <option value="none">No battery</option>
            <option value="small">Small (~5 kWh)</option>
            <option value="medium">Medium (~10-13.5 kWh — Powerwall class)</option>
            <option value="large">Large (~20 kWh)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Annual electricity use (kWh)</label>
          <input
            type="number" min={1000} max={50000} step={100} value={annualKwh}
            onChange={e => setAnnualKwh(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-600">U.S. average = ~10,500 kWh/year (EIA)</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Install year</label>
          <select className="input mt-1 w-full" value={installYear} onChange={e => setInstallYear(Number(e.target.value))}>
            <option value={2026}>2026 (no federal — 25D expired)</option>
            <option value={2027}>2027 (no federal)</option>
            <option value={2028}>2028 (no federal)</option>
            <option value={2025}>2025 (historical — last 30% year)</option>
          </select>
          <p className="mt-1 text-[11px] text-ink-600">25D Residential Clean Energy Credit terminated by OBBBA for property placed in service after 2025-12-31.</p>
        </div>
      </div>

      {/* Results */}
      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Estimated installed cost · {kw} kW · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)} gross</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Net after incentives (mid)</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.net.mid)}</p>
              <p className="mt-1 text-[11px] text-ink-600">
                Range {fmtUSDRange(result.net.low, result.net.high)}
              </p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Payback (years)</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">
                {result.paybackYears != null ? `${result.paybackYears} yr` : 'n/a'}
              </p>
              <p className="mt-1 text-[11px] text-ink-600">
                Saves ~{fmtUSD(result.annualValue)}/yr at current rates
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Incentive breakdown */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Incentive stack</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-ink-700">Federal 25D ({Math.round(result.fedRate * 100)}%)</span>
                <span className="font-medium tabular-nums text-brand-700">
                  −{fmtUSD(result.federalCredit.mid)}
                </span>
              </li>
              {result.stateRebateName && (
                <li className="flex justify-between gap-3">
                  <span className="text-ink-700">{result.stateRebateName}</span>
                  <span className="font-medium tabular-nums text-brand-700">
                    {result.stateAmt.mid > 0 ? `−${fmtUSD(result.stateAmt.mid)}` : 'tariff/SREC'}
                  </span>
                </li>
              )}
              {result.stateNote && (
                <li className="text-[11px] text-ink-600 leading-relaxed">{result.stateNote}</li>
              )}
            </ul>
            <p className="mt-3 text-[11px] text-ink-600">
              25D credit is non-refundable but carries forward. SRECs and production tariffs (MA SMART, NJ SuSI, IL Shines) are paid over 10-15 years, not upfront.
            </p>
          </div>

          {/* Production estimate */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Production &amp; offset</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Annual production</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{result.annualProduction.toLocaleString()} kWh</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">% of your usage</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{result.offsetPct}%</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Specific yield</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{yieldKwhPerKw} kWh/kW/yr</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">25-yr savings</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{fmtUSD(result.lifetimeSavings)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-ink-600">
              Production uses NREL PVWatts-style state averages. Real output depends on roof orientation, tilt, and shade. Rate escalation (typically 2-4%/yr) is not modeled — actual savings usually beat this estimate.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Note:</strong> This is a planning-range estimate, not a contractor quote. Roof condition, shade analysis, interconnection costs, and your utility's net-metering successor tariff all affect the actual number. Get 3 written quotes and compare $/W after all credits.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Per-Watt installed cost <em>gross</em> (before any state/utility rebate). Compare to $2.50-$3.30/W national median. The federal 25D credit is 0% for 2026 installs, so per-watt should be compared on gross cost.</li>
            <li>· Production guarantee in kWh (annual) tied to performance, not a vague "estimate."</li>
            <li>· Inverter warranty (string: 10 yr standard, micro: 25 yr) and panel performance warranty (typically 25-yr 84-86% retained capacity).</li>
            <li>· Roof penetration warranty separate from solar warranty.</li>
            <li>· Whether the bid includes critter guard, monitoring, and main-service-panel work if needed.</li>
            <li>· Net-metering tariff your install will be enrolled under (some states have moved to export-rate successor tariffs — e.g., CA NEM 3.0).</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="solar"
    />
    </>
  );
}
