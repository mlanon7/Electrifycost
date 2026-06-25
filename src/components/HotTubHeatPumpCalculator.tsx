import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, findStateEnergy } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Heater = 'hp_small' | 'hp_med' | 'hp_large' | 'electric' | 'gas';

interface Band { low: number; mid: number; high: number; }

const HEATERS: Record<Heater, { equipment: Band; install: Band; annualKwh: number; annualTherms: number; label: string }> = {
  hp_small:  { equipment: { low: 1800, mid: 2400, high: 3200 }, install: { low: 400, mid: 800, high: 1500 }, annualKwh: 1100, annualTherms: 0, label: 'Heat pump 300 gal' },
  hp_med:    { equipment: { low: 2200, mid: 2800, high: 3800 }, install: { low: 500, mid: 900, high: 1700 }, annualKwh: 1500, annualTherms: 0, label: 'Heat pump 450 gal' },
  hp_large:  { equipment: { low: 2800, mid: 3500, high: 4800 }, install: { low: 600, mid: 1100, high: 2000 }, annualKwh: 1900, annualTherms: 0, label: 'Heat pump 600+ gal' },
  electric:  { equipment: { low: 400, mid: 600, high: 900 }, install: { low: 200, mid: 400, high: 800 }, annualKwh: 3800, annualTherms: 0, label: 'Electric resistance (built-in, baseline)' },
  gas:       { equipment: { low: 1500, mid: 2200, high: 3200 }, install: { low: 800, mid: 1500, high: 2800 }, annualKwh: 200, annualTherms: 250, label: 'Gas heater (built-in)' },
};

function scale(b: Band, m: number): Band { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: Band, b: Band): Band { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export default function HotTubHeatPumpCalculator() {
  useCalculatorUsed('hot-tub-heat-pump');
  const [state, setState] = useState('OR');
  const [zip, setZip] = useState('');
  const [heater, setHeater] = useState<Heater>('hp_med');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.electrician_multiplier ?? 1.0;
    const h = HEATERS[heater];
    const install = scale(h.install, laborMult);
    const gross = add(h.equipment, install);

    const energy = findStateEnergy(state);
    const elec = (energy?.electricity_cents_per_kwh ?? 16) / 100;
    const gas = energy?.natural_gas_dollars_per_therm ?? 1.45;
    const annualOp = h.annualKwh * elec + h.annualTherms * gas;

    // Compare to electric resistance baseline
    const baselineKwh = 3800;
    const baselineOp = baselineKwh * elec;
    const savings = Math.max(0, baselineOp - annualOp);

    return { equipment: h.equipment, install, gross, annualOp, savings, label: h.label };
  }, [state, heater]);

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
          <label className="label" htmlFor="heater">Heater type</label>
          <select id="heater" className="input" value={heater} onChange={e => setHeater(e.target.value as Heater)}>
            <option value="hp_small">Heat pump 300 gal tub</option>
            <option value="hp_med">Heat pump 450 gal tub (most common)</option>
            <option value="hp_large">Heat pump 600+ gal / swim spa</option>
            <option value="electric">Electric resistance (built-in baseline)</option>
            <option value="gas">Gas heater (NG/propane built-in)</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-blue-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Installed cost · {result.label} · {stateName}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Annual operating cost</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.annualOp)}/yr</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Savings vs electric resistance</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.savings)}/yr</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Climate caveat:</strong> heat-pump hot-tub heaters work well above 50°F outdoor; below that they need backup electric resistance. Cover quality matters more than heater choice — a premium insulated cover (R-12+) cuts annual energy 30-50% on any heater. Most factory-included covers are R-3 to R-5.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="hot-tub-heat-pump"
    />
    </>
  );
}
