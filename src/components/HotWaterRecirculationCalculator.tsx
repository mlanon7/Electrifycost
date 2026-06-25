import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, findStateEnergy } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Type = 'dedicated' | 'crossover' | 'demand' | 'timer' | 'tankless';

interface Band { low: number; mid: number; high: number; }

const TYPES: Record<Type, { pump: Band; install: Band; waterSavedGalYr: number; electricityKwhYr: number; label: string }> = {
  dedicated: { pump: { low: 250, mid: 400, high: 650 },  install: { low: 400, mid: 800, high: 1500 }, waterSavedGalYr: 12000, electricityKwhYr: 250, label: 'Dedicated return loop (best)' },
  crossover: { pump: { low: 180, mid: 275, high: 400 },  install: { low: 150, mid: 300, high: 600 },  waterSavedGalYr: 8000,  electricityKwhYr: 150, label: 'Crossover (no new return line)' },
  demand:    { pump: { low: 300, mid: 450, high: 650 },  install: { low: 200, mid: 400, high: 800 },  waterSavedGalYr: 10000, electricityKwhYr: 80,  label: 'Demand-activated (most efficient)' },
  timer:     { pump: { low: 150, mid: 225, high: 350 },  install: { low: 100, mid: 250, high: 500 },  waterSavedGalYr: 5000,  electricityKwhYr: 400, label: 'Timer-only continuous loop' },
  tankless:  { pump: { low: 400, mid: 600, high: 900 },  install: { low: 300, mid: 600, high: 1200 }, waterSavedGalYr: 9000,  electricityKwhYr: 200, label: 'Tankless-compatible kit' },
};

const WATER_RATE_PER_1000_GAL = 8.50; // US average for water + sewer combined

function scale(b: Band, m: number): Band { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: Band, b: Band): Band { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export default function HotWaterRecirculationCalculator() {
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [type, setType] = useState<Type>('demand');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.plumber_multiplier ?? 1.0;
    const t = TYPES[type];
    const install = scale(t.install, laborMult);
    const gross = add(t.pump, install);

    const energy = findStateEnergy(state);
    const elec = (energy?.electricity_cents_per_kwh ?? 16) / 100;
    const waterSavings = (t.waterSavedGalYr / 1000) * WATER_RATE_PER_1000_GAL;
    const pumpCost = t.electricityKwhYr * elec;
    const netSavings = waterSavings - pumpCost;

    return { pump: t.pump, install, gross, waterSavings, pumpCost, netSavings, label: t.label, waterSavedGalYr: t.waterSavedGalYr };
  }, [state, type]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="label" htmlFor="state">State</label>
          <select id="state" className="input" value={state} onChange={e => setState(e.target.value)}>{ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select>
        </div>
        <div>
          <label className="label" htmlFor="zip">ZIP</label>
          <input id="zip" className="input" inputMode="numeric" pattern="\d*" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/[^0-9]/g, ''))} />
          <p className="mt-1 text-[10px] text-ink-600">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="type">System type</label>
          <select id="type" className="input" value={type} onChange={e => setType(e.target.value as Type)}>
            <option value="dedicated">Dedicated return loop (best performance, renovation only)</option>
            <option value="crossover">Crossover undersink (no new line — most common retrofit)</option>
            <option value="demand">Demand-activated (button or motion — most efficient)</option>
            <option value="timer">Timer-only continuous loop (cheapest but wasteful)</option>
            <option value="tankless">Tankless-compatible kit (Navien ComfortFlow, Rinnai)</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Installed cost · {result.label} · {stateName}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Water saved</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{result.waterSavedGalYr.toLocaleString()} gal/yr</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Water-bill savings</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.waterSavings)}/yr</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Pump electricity</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">−{fmtUSD(result.pumpCost)}/yr</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Comfort vs savings:</strong> the main reason to install recirculation is convenience — hot water at the tap in 1-2 seconds instead of 30-60. Water savings are a secondary benefit and depend heavily on how far the farthest fixture is from the water heater. In hot-water-energy terms, timer-pump systems can actually INCREASE energy use through standby losses. Demand-activated is the only type that reliably saves both water AND energy.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="hot-water-recirculation"
    />
    </>
  );
}
