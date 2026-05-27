import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateEnergy } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';

type Model = 'ventless_compact' | 'ventless_fullsize' | 'ventless_premium' | 'hybrid_vented' | 'combo';
type Current = 'electric_vented' | 'gas_vented' | 'none';
type Loads = 'light' | 'average' | 'heavy';

interface Band { low: number; mid: number; high: number; }

const MODELS: Record<Model, { equipment: Band; install: Band; kwhPerLoad: number; label: string }> = {
  ventless_compact:  { equipment: { low: 900, mid: 1300, high: 1700 }, install: { low: 0, mid: 150, high: 400 }, kwhPerLoad: 1.0, label: 'Compact ventless (4.0 cu ft)' },
  ventless_fullsize: { equipment: { low: 1400, mid: 1900, high: 2700 }, install: { low: 0, mid: 150, high: 400 }, kwhPerLoad: 1.2, label: 'Full-size ventless (7.5 cu ft)' },
  ventless_premium:  { equipment: { low: 2200, mid: 2800, high: 3600 }, install: { low: 0, mid: 200, high: 500 }, kwhPerLoad: 1.1, label: 'Premium ventless (Miele/Bosch 800)' },
  hybrid_vented:     { equipment: { low: 1100, mid: 1500, high: 2100 }, install: { low: 200, mid: 400, high: 800 }, kwhPerLoad: 1.3, label: 'Hybrid vented heat pump' },
  combo:             { equipment: { low: 1800, mid: 2400, high: 3200 }, install: { low: 0, mid: 200, high: 500 }, kwhPerLoad: 0.9, label: 'Washer-dryer combo (LG/GE)' },
};

const LOADS_PER_WEEK: Record<Loads, number> = { light: 3, average: 5, heavy: 8 };

const CURRENT_PER_LOAD: Record<Current, { kwh: number; therms: number; cost: (e: number, g: number) => number; label: string }> = {
  electric_vented: { kwh: 3.3, therms: 0, cost: (e, g) => 3.3 * e, label: 'Electric resistance vented' },
  gas_vented:      { kwh: 0.15, therms: 0.22, cost: (e, g) => 0.15 * e + 0.22 * g, label: 'Gas vented' },
  none:            { kwh: 0, therms: 0, cost: () => 0, label: 'No current dryer (line-dry / coin laundry)' },
};

function scale(b: Band, m: number): Band {
  return { low: b.low * m, mid: b.mid * m, high: b.high * m };
}
function add(a: Band, b: Band): Band {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}

export default function HeatPumpDryerCalculator() {
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [model, setModel] = useState<Model>('ventless_fullsize');
  const [current, setCurrent] = useState<Current>('electric_vented');
  const [loads, setLoads] = useState<Loads>('average');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const energy = findStateEnergy(state);
    const elec = (energy?.electricity_cents_per_kwh ?? 16) / 100;
    const gas = energy?.natural_gas_dollars_per_therm ?? 1.45;

    const m = MODELS[model];
    const gross = add(m.equipment, m.install);

    const loadsPerYear = LOADS_PER_WEEK[loads] * 52;
    const newAnnualKwh = m.kwhPerLoad * loadsPerYear;
    const newAnnualCost = newAnnualKwh * elec;

    const c = CURRENT_PER_LOAD[current];
    const oldAnnualCost = c.cost(elec, gas) * loadsPerYear;
    const annualSavings = Math.max(0, oldAnnualCost - newAnnualCost);
    const paybackYears = annualSavings > 0 ? Math.round((gross.mid / annualSavings) * 10) / 10 : null;

    return { gross, equipment: m.equipment, install: m.install, newAnnualKwh, newAnnualCost, oldAnnualCost, annualSavings, paybackYears, loadsPerYear, label: m.label };
  }, [state, model, current, loads]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
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
          <label className="label" htmlFor="model">Heat-pump dryer model</label>
          <select id="model" className="input" value={model} onChange={e => setModel(e.target.value as Model)}>
            <option value="ventless_compact">Compact ventless (4 cu ft)</option>
            <option value="ventless_fullsize">Full-size ventless (7.5 cu ft, most common)</option>
            <option value="ventless_premium">Premium ventless (Miele, Bosch 800)</option>
            <option value="hybrid_vented">Hybrid vented heat pump (Whirlpool)</option>
            <option value="combo">Washer-dryer combo (LG WashCombo)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="current">Current dryer</label>
          <select id="current" className="input" value={current} onChange={e => setCurrent(e.target.value as Current)}>
            <option value="electric_vented">Electric resistance (vented)</option>
            <option value="gas_vented">Gas (vented)</option>
            <option value="none">None / line-dry / coin laundry</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="loads">Loads per week</label>
          <select id="loads" className="input" value={loads} onChange={e => setLoads(e.target.value as Loads)}>
            <option value="light">Light (~3 loads/wk — 1-2 person household)</option>
            <option value="average">Average (~5 loads/wk — typical family)</option>
            <option value="heavy">Heavy (~8 loads/wk — large family, sports, kids)</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-blue-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {result.label} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Annual savings vs current</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.annualSavings)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">Old: {fmtUSD(result.oldAnnualCost)} → New: {fmtUSD(result.newAnnualCost)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Simple payback</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{result.paybackYears != null ? `${result.paybackYears} yr` : 'n/a'}</p>
              <p className="mt-1 text-[11px] text-ink-600">{result.loadsPerYear} loads/yr</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Equipment</span><span className="tabular-nums">{fmtUSD(result.equipment.mid)}</span></li>
              <li className="flex justify-between"><span>Install (delivery + setup)</span><span className="tabular-nums">{fmtUSD(result.install.mid)}</span></li>
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Total (mid)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Why ventless wins</h3>
            <p className="mt-2 text-sm text-ink-700">
              Vented dryers exhaust hot air outside — a hole in your envelope that costs heating dollars. Ventless heat-pump dryers recover the heat into condensate, no exterior vent needed. Especially valuable for apartments, condos, and interior-laundry installs where venting is impractical or impossible.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Rebate note:</strong> heat-pump clothes dryers qualify for the DOE HEEHRA / Home Energy Rebates program where state programs are open — up to $840 for income-qualified households (low or moderate AMI). The federal 25C credit ended Dec 31 2025 and never covered dryers. Some utilities (Mass Save, Energy Trust of Oregon, ConEd) offer $100–$500 rebates on ENERGY STAR heat-pump dryers.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Buying checklist</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· ENERGY STAR Most Efficient certified — best of the best for energy use per load.</li>
            <li>· 120V vs 240V — most full-size models work on a 120V outlet; check before ordering.</li>
            <li>· Drum capacity in cubic feet — match to your typical load size.</li>
            <li>· Condensate drain vs reservoir — drain is preferred but reservoir works in laundry rooms without plumbing.</li>
            <li>· Cycle time — heat pump dryers take 60–90 min vs 40–50 min for vented (acceptable tradeoff for most).</li>
            <li>· Brand network — Miele and Bosch have premium service networks; LG and Samsung have widest parts availability.</li>
            <li>· Stackability if floor space is tight — confirm depth and weight ratings.</li>
            <li>· 5+ year warranty on the compressor — the heat-pump-specific component.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
