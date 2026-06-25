import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, stateEnergy } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Type = 'gas_condensing' | 'gas_non_condensing' | 'electric_pos' | 'electric_whole';
type Size = '140k' | '180k' | '199k' | 'electric_18' | 'electric_27' | 'electric_36';
type Existing = 'gas_tank' | 'electric_tank' | 'none_new';
type GasLine = 'adequate' | 'upsize' | 'new_run';

interface CostBand { low: number; mid: number; high: number; }
const add = (a: CostBand, b: CostBand): CostBand => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 installed cost — Rinnai, Navien, Rheem, Bosch, A.O. Smith. Source: manufacturer MSRPs, contractor surveys.
const EQUIPMENT: Record<Type, Record<Size, CostBand>> = {
  gas_non_condensing: {     // direct vent, 80% AFUE, cheaper, shorter venting limits
    '140k': { low: 1000, mid: 1300, high: 1600 },
    '180k': { low: 1200, mid: 1500, high: 1900 },
    '199k': { low: 1400, mid: 1750, high: 2200 },
    'electric_18': { low: 0, mid: 0, high: 0 },
    'electric_27': { low: 0, mid: 0, high: 0 },
    'electric_36': { low: 0, mid: 0, high: 0 },
  },
  gas_condensing: {         // sealed combustion, 95% AFUE, PVC venting up to 100 ft
    '140k': { low: 1500, mid: 1900, high: 2400 },
    '180k': { low: 1800, mid: 2200, high: 2800 },
    '199k': { low: 2100, mid: 2600, high: 3300 },
    'electric_18': { low: 0, mid: 0, high: 0 },
    'electric_27': { low: 0, mid: 0, high: 0 },
    'electric_36': { low: 0, mid: 0, high: 0 },
  },
  electric_pos: {           // point-of-use under-sink — for additional bathrooms / kitchen
    '140k': { low: 0, mid: 0, high: 0 },
    '180k': { low: 0, mid: 0, high: 0 },
    '199k': { low: 0, mid: 0, high: 0 },
    'electric_18': { low: 250, mid: 350, high: 500 },
    'electric_27': { low: 0, mid: 0, high: 0 },
    'electric_36': { low: 0, mid: 0, high: 0 },
  },
  electric_whole: {         // whole-home — typically Stiebel Eltron Tempra Plus or EcoSmart
    '140k': { low: 0, mid: 0, high: 0 },
    '180k': { low: 0, mid: 0, high: 0 },
    '199k': { low: 0, mid: 0, high: 0 },
    'electric_18': { low: 0, mid: 0, high: 0 },
    'electric_27': { low: 700, mid: 900, high: 1100 },     // 27 kW, 3-shower capable in warm-water states
    'electric_36': { low: 900, mid: 1200, high: 1500 },    // 36 kW, whole-home in cold-water states
  },
};

// Installation labor + materials
const INSTALL_BASE: Record<Type, CostBand> = {
  gas_non_condensing: { low: 800, mid: 1300, high: 2000 },
  gas_condensing: { low: 1200, mid: 1800, high: 2800 },     // PVC venting + condensate drain
  electric_pos: { low: 200, mid: 400, high: 700 },          // 240V circuit nearby
  electric_whole: { low: 1500, mid: 2500, high: 4000 },     // multiple 50A circuits + panel upgrade often required
};

// Gas line work
const GAS_LINE: Record<GasLine, CostBand> = {
  adequate: { low: 0, mid: 0, high: 0 },
  upsize: { low: 500, mid: 900, high: 1500 },               // 1/2" → 3/4" run for tankless demand
  new_run: { low: 800, mid: 1500, high: 2800 },             // new run from meter
};

// Electric panel upgrade likelihood for electric whole-home tankless (it needs 100-150A by itself)
const PANEL_UPGRADE: CostBand = { low: 2500, mid: 4000, high: 6500 };

// Tank removal + disposal
const TANK_REMOVE: CostBand = { low: 150, mid: 250, high: 400 };

// Permit
const PERMIT: CostBand = { low: 250, mid: 450, high: 800 };

// Annual operating cost estimate based on actual water-heating physics.
// Energy to heat water = gallons × 8.34 lb/gal × ΔT °F × 1 BTU/lb-°F
// 1 therm = 100,000 BTU; 1 kWh = 3,412 BTU.
// Default: 64 gal/day × 8.34 × 70°F rise = 37,363 BTU/day = 0.374 therm/day delivered (before UEF losses).
// Source: DOE water-heating methodology https://www.energy.gov/energysaver/estimating-costs-and-efficiency-storage-water-heaters
function annualOperatingCost(
  type: Type,
  gasPerTherm: number,
  elecRate: number,
  galPerDay = 64,
  tempRiseF = 70,
): number {
  const btuPerDayDelivered = galPerDay * 8.34 * tempRiseF;
  const thermsPerDayDelivered = btuPerDayDelivered / 100_000;
  const kwhPerDayDelivered = btuPerDayDelivered / 3412;
  switch (type) {
    case 'gas_non_condensing': return (thermsPerDayDelivered / 0.82) * gasPerTherm * 365;  // UEF ~0.82
    case 'gas_condensing':     return (thermsPerDayDelivered / 0.95) * gasPerTherm * 365;  // UEF ~0.95
    case 'electric_pos':
    case 'electric_whole':     return (kwhPerDayDelivered / 0.99) * elecRate * 365;        // UEF ~0.99
  }
}

export default function TanklessCalculator() {
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [type, setType] = useState<Type>('gas_condensing');
  const [size, setSize] = useState<Size>('180k');
  const [existing, setExisting] = useState<Existing>('gas_tank');
  const [gasLine, setGasLine] = useState<GasLine>('upsize');
  const [panelOk, setPanelOk] = useState<'yes' | 'no' | 'unknown'>('yes');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const plumbMult = lab?.plumber_multiplier ?? 1.0;
    const elecMult = lab?.electrician_multiplier ?? 1.0;
    const eRow = stateEnergy.find(e => e.state === state);
    const elecRate = eRow ? eRow.electricity_cents_per_kwh / 100 : 0.16;
    const gasRate = eRow ? eRow.natural_gas_dollars_per_therm : 1.50;

    const equipment = EQUIPMENT[type][size];
    const isGas = type === 'gas_condensing' || type === 'gas_non_condensing';
    const install = scale(INSTALL_BASE[type], isGas ? plumbMult : elecMult);
    const gasLineCost = isGas ? scale(GAS_LINE[gasLine], plumbMult) : { low: 0, mid: 0, high: 0 };
    const panelUpgrade = type === 'electric_whole' && (panelOk === 'no' || panelOk === 'unknown')
      ? (panelOk === 'no' ? scale(PANEL_UPGRADE, elecMult) : scale(PANEL_UPGRADE, elecMult * 0.5))
      : { low: 0, mid: 0, high: 0 };
    const tankRemove = existing === 'gas_tank' || existing === 'electric_tank'
      ? scale(TANK_REMOVE, plumbMult) : { low: 0, mid: 0, high: 0 };
    const permit = scale(PERMIT, plumbMult);

    const gross = add(add(add(add(add(equipment, install), gasLineCost), panelUpgrade), tankRemove), permit);

    const operating = annualOperatingCost(type, gasRate, elecRate);
    // Tank baseline same physics: 0.374 therm/day delivered, divide by UEF
    const dailyThermDelivered = 64 * 8.34 * 70 / 100_000;
    const dailyKwhDelivered = 64 * 8.34 * 70 / 3412;
    const tankBaselineGas = (dailyThermDelivered / 0.62) * gasRate * 365;        // UEF 0.62 standard gas tank
    const tankBaselineElec = (dailyKwhDelivered / 0.92) * elecRate * 365;        // UEF 0.92 standard electric tank
    const baselineForComparison = existing === 'electric_tank' ? tankBaselineElec : tankBaselineGas;
    const annualSavings = baselineForComparison - operating;  // can be negative — that's the truth

    return { equipment, install, gasLineCost, panelUpgrade, tankRemove, permit, gross, operating, annualSavings };
  }, [state, type, size, existing, gasLine, panelOk]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  const validSizes: Size[] = type === 'gas_condensing' || type === 'gas_non_condensing'
    ? ['140k', '180k', '199k']
    : type === 'electric_pos'
    ? ['electric_18']
    : ['electric_27', 'electric_36'];

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 94103"
            className="input mt-1 w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Tankless type</label>
          <select className="input mt-1 w-full" value={type} onChange={e => { setType(e.target.value as Type); setSize(e.target.value.startsWith('gas') ? '180k' : e.target.value === 'electric_pos' ? 'electric_18' : 'electric_27'); }}>
            <option value="gas_condensing">Gas condensing (95% AFUE — recommended)</option>
            <option value="gas_non_condensing">Gas non-condensing (82% AFUE — cheaper)</option>
            <option value="electric_whole">Electric whole-home (27-36 kW — needs panel capacity)</option>
            <option value="electric_pos">Electric point-of-use (under-sink booster)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Size</label>
          <select className="input mt-1 w-full" value={size} onChange={e => setSize(e.target.value as Size)}>
            {validSizes.map(s => (
              <option key={s} value={s}>
                {s === '140k' ? '140,000 BTU/hr (2-3 bath)' :
                 s === '180k' ? '180,000 BTU/hr (3 bath)' :
                 s === '199k' ? '199,000 BTU/hr (4+ bath)' :
                 s === 'electric_18' ? '18 kW point-of-use' :
                 s === 'electric_27' ? '27 kW (warm-water states)' :
                 '36 kW (cold-water states)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Existing water heater</label>
          <select className="input mt-1 w-full" value={existing} onChange={e => setExisting(e.target.value as Existing)}>
            <option value="gas_tank">Gas tank (40-50 gal)</option>
            <option value="electric_tank">Electric tank (40-50 gal)</option>
            <option value="none_new">New construction / no existing</option>
          </select>
        </div>

        {(type === 'gas_condensing' || type === 'gas_non_condensing') && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Gas line</label>
            <select className="input mt-1 w-full" value={gasLine} onChange={e => setGasLine(e.target.value as GasLine)}>
              <option value="adequate">Adequate as-is</option>
              <option value="upsize">Upsize existing run</option>
              <option value="new_run">New run from meter</option>
            </select>
          </div>
        )}

        {type === 'electric_whole' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Panel capacity for 100-150A draw?</label>
            <select className="input mt-1 w-full" value={panelOk} onChange={e => setPanelOk(e.target.value as typeof panelOk)}>
              <option value="yes">Yes — 200A+ service with spare capacity</option>
              <option value="no">No — needs panel upgrade</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        )}
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-blue-300/60 bg-gradient-to-br from-blue-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Installed cost · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">Annual operating cost</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-800">{fmtUSD(result.operating)}/yr</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">Annual savings vs tank baseline</p>
              <p className={`mt-0.5 text-xl font-semibold tabular-nums ${result.annualSavings >= 0 ? 'text-brand-700' : 'text-rose-700'}`}>
                {result.annualSavings >= 0 ? '+' : ''}{fmtUSD(result.annualSavings)}/yr
              </p>
              <p className="mt-1 text-[11px] text-ink-600">vs comparable tank water heater (negative = costs more)</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>Equipment</span><span className="tabular-nums">{fmtUSD(result.equipment.mid)}</span></li>
              <li className="flex justify-between gap-3"><span>Install (labor + materials)</span><span className="tabular-nums">{fmtUSD(result.install.mid)}</span></li>
              {result.gasLineCost.mid > 0 && (
                <li className="flex justify-between gap-3"><span>Gas line work</span><span className="tabular-nums">{fmtUSD(result.gasLineCost.mid)}</span></li>
              )}
              {result.panelUpgrade.mid > 0 && (
                <li className="flex justify-between gap-3"><span>Panel upgrade (likely)</span><span className="tabular-nums">{fmtUSD(result.panelUpgrade.mid)}</span></li>
              )}
              {result.tankRemove.mid > 0 && (
                <li className="flex justify-between gap-3"><span>Tank removal + disposal</span><span className="tabular-nums">{fmtUSD(result.tankRemove.mid)}</span></li>
              )}
              <li className="flex justify-between gap-3"><span>Permit + inspection</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
            </ul>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Consider HPWH instead</h3>
            <p className="mt-2 text-sm text-ink-700">
              A heat pump water heater (HPWH) installs for $2,500–$5,500 — comparable to gas tankless — and qualifies for income-tiered DOE Home Energy Rebates ($1,750 max in HEEHRA-open states). Operating cost is the lowest of any category. The catch: needs ~700 cu-ft of free air to breathe and a condensate drain. Best fit for unfinished basements and garages.
            </p>
            <a href="/heat-pump-water-heater-cost-calculator/" className="mt-2 inline-block text-xs font-medium text-brand-700">Open HPWH calculator →</a>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Electric tankless caveat:</strong> whole-home electric tankless (27-36 kW) draws 100-150A continuous on its own. Most existing residential panels (100A or even 200A with normal loads) cannot accommodate this. Real-world: electric whole-home tankless almost always triggers a panel upgrade ($1,500–$5,000) plus a service-entrance upgrade if the utility transformer is undersized. Point-of-use electric (under-sink for one fixture) is the only electric tankless that&rsquo;s typically practical without panel work.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· UEF (Uniform Energy Factor) — 0.95+ for condensing gas, 0.82-0.86 for non-condensing, 0.99 for electric.</li>
            <li>· Flow rate at design temperature rise (GPM @ 70°F rise in cold climates). 5+ GPM = 2-3 simultaneous showers.</li>
            <li>· Vent type — sealed Cat IV PVC for condensing (cheap, long runs OK); Cat III stainless for non-condensing (limited length).</li>
            <li>· Condensate handling for condensing units — drain to plumbing stack or sump, neutralizer cartridge required in some jurisdictions.</li>
            <li>· Water hardness — most tankless require &lt; 7 grains/gallon or a softener; warranties void without descaling annually in hard-water areas.</li>
            <li>· Recirculation pump option if you have long pipe runs and want instant hot water.</li>
            <li>· Warranty (heat exchanger 12-15 yr, parts 5 yr, labor 1 yr typical).</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="tankless-water-heater"
    />
    </>
  );
}
