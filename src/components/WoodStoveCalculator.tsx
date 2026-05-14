import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';

type Stove = 'wood_small' | 'wood_medium' | 'wood_large_catalytic' | 'pellet_small' | 'pellet_medium' | 'pellet_large' | 'pellet_insert' | 'masonry';

interface Band { low: number; mid: number; high: number; }

const STOVES: Record<Stove, { equipment: Band; install: Band; fuel: Band; label: string }> = {
  wood_small:           { equipment: { low: 1400, mid: 2200, high: 3200 }, install: { low: 1500, mid: 2500, high: 4500 }, fuel: { low: 400, mid: 600, high: 900 }, label: 'Small wood stove (1500 sqft)' },
  wood_medium:          { equipment: { low: 1800, mid: 2800, high: 4000 }, install: { low: 1600, mid: 2700, high: 4800 }, fuel: { low: 500, mid: 800, high: 1200 }, label: 'Medium wood stove (2000 sqft)' },
  wood_large_catalytic: { equipment: { low: 2800, mid: 4200, high: 6000 }, install: { low: 1800, mid: 3000, high: 5200 }, fuel: { low: 700, mid: 1100, high: 1600 }, label: 'Large catalytic wood stove' },
  pellet_small:         { equipment: { low: 1800, mid: 2600, high: 3800 }, install: { low: 1200, mid: 2000, high: 3500 }, fuel: { low: 500, mid: 750, high: 1100 }, label: 'Small pellet stove (1500 sqft)' },
  pellet_medium:        { equipment: { low: 2200, mid: 3200, high: 4500 }, install: { low: 1300, mid: 2200, high: 3800 }, fuel: { low: 650, mid: 1000, high: 1500 }, label: 'Medium pellet stove (2000 sqft)' },
  pellet_large:         { equipment: { low: 2800, mid: 4000, high: 5500 }, install: { low: 1400, mid: 2400, high: 4200 }, fuel: { low: 800, mid: 1200, high: 1800 }, label: 'Large pellet stove' },
  pellet_insert:        { equipment: { low: 2500, mid: 3500, high: 5000 }, install: { low: 1500, mid: 2500, high: 4000 }, fuel: { low: 600, mid: 900, high: 1300 }, label: 'Pellet insert (fireplace retrofit)' },
  masonry:              { equipment: { low: 8000, mid: 15000, high: 28000 }, install: { low: 5000, mid: 10000, high: 18000 }, fuel: { low: 400, mid: 600, high: 900 }, label: 'Russian/masonry heater (premium)' },
};

function scale(b: Band, m: number): Band { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: Band, b: Band): Band { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export default function WoodStoveCalculator() {
  const [state, setState] = useState('VT');
  const [zip, setZip] = useState('');
  const [stove, setStove] = useState<Stove>('wood_medium');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.hvac_multiplier ?? 1.0;
    const s = STOVES[stove];
    const install = scale(s.install, laborMult);
    const gross = add(s.equipment, install);
    return { equipment: s.equipment, install, gross, fuel: s.fuel, label: s.label };
  }, [state, stove]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="label" htmlFor="state">State</label>
          <select id="state" className="input" value={state} onChange={e => setState(e.target.value)}>{ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select>
        </div>
        <div>
          <label className="label" htmlFor="zip">ZIP</label>
          <input id="zip" className="input" inputMode="numeric" pattern="\d*" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/[^0-9]/g, ''))} />
          <p className="mt-1 text-[10px] text-ink-500">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="stove">Stove type</label>
          <select id="stove" className="input" value={stove} onChange={e => setStove(e.target.value as Stove)}>
            <optgroup label="Wood">
              <option value="wood_small">Small wood stove (1500 sqft)</option>
              <option value="wood_medium">Medium wood stove (2000 sqft)</option>
              <option value="wood_large_catalytic">Large catalytic wood stove (2500+ sqft)</option>
            </optgroup>
            <optgroup label="Pellet">
              <option value="pellet_small">Small pellet stove (1500 sqft)</option>
              <option value="pellet_medium">Medium pellet stove (2000 sqft)</option>
              <option value="pellet_large">Large pellet stove (2500+ sqft)</option>
              <option value="pellet_insert">Pellet insert (fireplace retrofit)</option>
            </optgroup>
            <optgroup label="Premium">
              <option value="masonry">Russian / masonry heater</option>
            </optgroup>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Installed cost · {result.label} · {stateName}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 rounded-lg border border-amber-200 bg-white/70 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Annual fuel cost</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-800">{fmtUSDRange(result.fuel.low, result.fuel.high)}/yr</p>
            <p className="mt-1 text-[11px] text-ink-600">Wood: 3-5 cords/yr at $200–$400/cord · Pellets: 3-5 tons/yr at $250–$350/ton</p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>EPA + permit note:</strong> only EPA 2020-certified stoves can be installed in most jurisdictions. Stovepipe (Class A chimney) must meet UL 103 HT and clear from combustibles per manufacturer specs. Hearth pad with proper R-value required underneath. Most areas need a building permit and final inspection. The 25C credit for biomass stoves (was up to $2,000) expired Dec 31 2025 — only state programs remain.
        </div>
      </div>
    </div>
  );
}
