import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, findStateEnergy } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Fuel = 'natural_gas' | 'electric' | 'propane';
type Tier = 'standard' | 'powervent' | 'condensing';
type Size = 40 | 50 | 80;

interface Band { low: number; mid: number; high: number; }

// From tank-water-heater-cost-ranges.csv. 2026 mid-quote dollars.
const CFG: Record<Fuel, Record<Tier, { equipment: Record<Size, Band>; install: Band; uef: number; annualKwh: number; annualTherms: number; label: string }>> = {
  natural_gas: {
    standard: {
      equipment: {
        40: { low: 600, mid: 850, high: 1200 },
        50: { low: 700, mid: 1000, high: 1400 },
        80: { low: 1100, mid: 1500, high: 2000 },
      },
      install: { low: 500, mid: 800, high: 1300 },
      uef: 0.62, annualKwh: 0, annualTherms: 220, label: 'Atmospheric-vent 0.62 UEF',
    },
    powervent: {
      equipment: {
        40: { low: 900, mid: 1300, high: 1700 },
        50: { low: 1100, mid: 1500, high: 2000 },
        80: { low: 1500, mid: 2100, high: 2700 },
      },
      install: { low: 700, mid: 1100, high: 1600 },
      uef: 0.68, annualKwh: 0, annualTherms: 200, label: 'Power-vent 0.68 UEF',
    },
    condensing: {
      equipment: {
        40: { low: 1400, mid: 1900, high: 2500 },
        50: { low: 1700, mid: 2200, high: 2900 },
        80: { low: 2200, mid: 2800, high: 3700 },
      },
      install: { low: 800, mid: 1200, high: 1800 },
      uef: 0.86, annualKwh: 0, annualTherms: 158, label: 'Condensing 0.86 UEF',
    },
  },
  electric: {
    standard: {
      equipment: {
        40: { low: 400, mid: 650, high: 950 },
        50: { low: 500, mid: 750, high: 1100 },
        80: { low: 750, mid: 1100, high: 1500 },
      },
      install: { low: 400, mid: 700, high: 1100 },
      uef: 0.91, annualKwh: 4880, annualTherms: 0, label: 'Resistance 0.91 UEF',
    },
    powervent: {
      equipment: {
        40: { low: 400, mid: 650, high: 950 },
        50: { low: 500, mid: 750, high: 1100 },
        80: { low: 750, mid: 1100, high: 1500 },
      },
      install: { low: 400, mid: 700, high: 1100 },
      uef: 0.91, annualKwh: 4880, annualTherms: 0, label: 'Resistance (no power-vent variant)',
    },
    condensing: {
      equipment: {
        40: { low: 400, mid: 650, high: 950 },
        50: { low: 500, mid: 750, high: 1100 },
        80: { low: 750, mid: 1100, high: 1500 },
      },
      install: { low: 400, mid: 700, high: 1100 },
      uef: 0.91, annualKwh: 4880, annualTherms: 0, label: 'Resistance (no condensing variant)',
    },
  },
  propane: {
    standard: {
      equipment: {
        40: { low: 650, mid: 900, high: 1300 },
        50: { low: 800, mid: 1100, high: 1500 },
        80: { low: 1200, mid: 1700, high: 2300 },
      },
      install: { low: 500, mid: 800, high: 1300 },
      uef: 0.62, annualKwh: 0, annualTherms: 220, label: 'Atmospheric LP 0.62 UEF',
    },
    powervent: {
      equipment: {
        40: { low: 1000, mid: 1400, high: 1800 },
        50: { low: 1200, mid: 1600, high: 2100 },
        80: { low: 1600, mid: 2200, high: 2900 },
      },
      install: { low: 700, mid: 1100, high: 1600 },
      uef: 0.68, annualKwh: 0, annualTherms: 200, label: 'LP power-vent 0.68 UEF',
    },
    condensing: {
      equipment: {
        40: { low: 1500, mid: 2000, high: 2700 },
        50: { low: 1800, mid: 2400, high: 3100 },
        80: { low: 2300, mid: 3000, high: 3900 },
      },
      install: { low: 800, mid: 1200, high: 1800 },
      uef: 0.86, annualKwh: 0, annualTherms: 158, label: 'LP condensing 0.86 UEF',
    },
  },
};

// HPWH baseline (for head-to-head)
const HPWH_BASELINE = { low: 2300, mid: 3100, high: 4200, annualKwh: 1380 };
// Tankless gas baseline
const TANKLESS_GAS_BASELINE = { low: 2800, mid: 4300, high: 6500, annualTherms: 180 };

function scale(b: Band, m: number): Band { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: Band, b: Band): Band { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export default function TankWaterHeaterCalculator({ initialState }: { initialState?: string } = {}) {
  useCalculatorUsed('tank-water-heater');
  const [state, setState] = useState(initialState ?? 'OH');
  const [zip, setZip] = useState('');
  const [fuel, setFuel] = useState<Fuel>('natural_gas');
  const [tier, setTier] = useState<Tier>('standard');
  const [size, setSize] = useState<Size>(50);

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.plumber_multiplier ?? 1.0;
    const cfg = CFG[fuel][tier];
    const equipment = cfg.equipment[size];
    const install = scale(cfg.install, laborMult);
    const permit: Band = { low: 75, mid: 150, high: 300 };
    const gross = add(add(equipment, install), permit);

    const energy = findStateEnergy(state);
    const elec = (energy?.electricity_cents_per_kwh ?? 16) / 100;
    const gas = energy?.natural_gas_dollars_per_therm ?? 1.45;
    const propane = energy?.propane_dollars_per_gallon ?? 2.85;

    const annualEnergyCost =
      fuel === 'natural_gas' ? cfg.annualTherms * gas
      : fuel === 'propane'    ? (cfg.annualTherms * 100000 / 91500) * propane // 91500 BTU/gal
      : cfg.annualKwh * elec;

    // Comparison vs HPWH (electric homes) or vs HPWH-from-gas (gas homes)
    const hpwhAnnualCost = HPWH_BASELINE.annualKwh * elec;
    const hpwhInstallMult = 1.0;
    const hpwhGross: Band = scale({ low: HPWH_BASELINE.low, mid: HPWH_BASELINE.mid, high: HPWH_BASELINE.high }, hpwhInstallMult);
    const hpwhSavingsPerYear = annualEnergyCost - hpwhAnnualCost;

    return { equipment, install, permit, gross, annualEnergyCost, hpwhGross, hpwhAnnualCost, hpwhSavingsPerYear, label: cfg.label, uef: cfg.uef };
  }, [state, fuel, tier, size]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="label" htmlFor="state">State</label>
          <select id="state" className="input" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="zip">ZIP</label>
          <input id="zip" className="input" inputMode="numeric" pattern="\d*" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/[^0-9]/g, ''))} />
          <p className="mt-1 text-[10px] text-ink-600">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
        </div>

        <div>
          <label className="label" htmlFor="fuel">Fuel</label>
          <select id="fuel" className="input" value={fuel} onChange={e => setFuel(e.target.value as Fuel)}>
            <option value="natural_gas">Natural gas (most common)</option>
            <option value="electric">Electric resistance</option>
            <option value="propane">Propane (rural)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tier">Efficiency tier</label>
          <select id="tier" className="input" value={tier} onChange={e => setTier(e.target.value as Tier)}>
            <option value="standard">Standard atmospheric vent (gas/LP) or resistance (electric)</option>
            <option value="powervent" disabled={fuel === 'electric'}>Power-vent (gas/LP only)</option>
            <option value="condensing" disabled={fuel === 'electric'}>Condensing 95%+ (gas/LP only)</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="size">Tank size</label>
          <select id="size" className="input" value={size} onChange={e => setSize(Number(e.target.value) as Size)}>
            <option value={40}>40 gal (1-3 people)</option>
            <option value={50}>50 gal (3-5 people, most common)</option>
            <option value={80}>80 gal (large family or solar self-consumption)</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-blue-300/60 bg-gradient-to-br from-blue-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Installed cost · {result.label} {size}-gal · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">Annual operating cost</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-800">{fmtUSD(result.annualEnergyCost)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">UEF {result.uef.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">HPWH alternative</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-800">{fmtUSD(result.hpwhGross.mid)}</p>
              <p className="mt-1 text-[11px] text-ink-600">Saves {fmtUSD(Math.max(0, result.hpwhSavingsPerYear))}/yr op</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Equipment ({size} gal)</span><span className="tabular-nums">{fmtUSD(result.equipment.mid)}</span></li>
              <li className="flex justify-between"><span>Install + venting</span><span className="tabular-nums">{fmtUSD(result.install.mid)}</span></li>
              <li className="flex justify-between"><span>Permit &amp; inspection</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Total (mid)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Three-way comparison</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Standard tank (this calc)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
              <li className="flex justify-between"><span>HPWH (50-gal hybrid)</span><span className="tabular-nums">{fmtUSD(result.hpwhGross.mid)}</span></li>
              <li className="flex justify-between"><span>Tankless gas</span><span className="tabular-nums">{fmtUSD(TANKLESS_GAS_BASELINE.mid)}</span></li>
            </ul>
            <p className="mt-2 text-[11px] text-ink-600">HPWH typically saves $300-500/yr in operating cost vs gas tank; HEEHRA rebate up to $1,750 for income-qualified buyers.</p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Federal note:</strong> the 25C credit for high-efficiency gas water heaters expired 2025-12-31 (OBBBA). HEEHRA is electric-only — tank gas/propane water heaters do not qualify. Some gas utilities still offer $50-300 rebates on condensing tank installs. HPWH qualifies for HEEHRA up to $1,750.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· UEF (Uniform Energy Factor) in writing — replaces older EF rating.</li>
            <li>· Expansion tank included (required by most codes since 2012).</li>
            <li>· T&P (temperature/pressure) valve and drip pan included.</li>
            <li>· Sediment trap on gas line, dielectric unions on water lines.</li>
            <li>· Old unit haul-away included.</li>
            <li>· Combustion-air check (CO test) at startup for atmospheric-vent gas.</li>
            <li>· 6+ year tank warranty (premium tier offers 12 years).</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="tank-water-heater"
    />
    </>
  );
}
