import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type DoorType = 'front_steel' | 'front_fiberglass_mid' | 'front_fiberglass_premium' | 'front_wood' | 'sliding_vinyl' | 'sliding_fiberglass' | 'sliding_wood' | 'french' | 'garage_steel_single' | 'garage_steel_double' | 'garage_premium';

interface Band { low: number; mid: number; high: number; }

const DOORS: Record<DoorType, { equipment: Band; install: Band; label: string }> = {
  front_steel:              { equipment: { low: 200, mid: 400, high: 650 },   install: { low: 300, mid: 500, high: 800 },   label: 'Front — steel basic' },
  front_fiberglass_mid:     { equipment: { low: 500, mid: 850, high: 1300 },  install: { low: 300, mid: 600, high: 1000 },  label: 'Front — fiberglass mid (most popular)' },
  front_fiberglass_premium: { equipment: { low: 1100, mid: 1700, high: 2400 }, install: { low: 400, mid: 700, high: 1200 },  label: 'Front — fiberglass premium' },
  front_wood:               { equipment: { low: 1500, mid: 2400, high: 3800 }, install: { low: 500, mid: 900, high: 1500 },  label: 'Front — solid wood' },
  sliding_vinyl:            { equipment: { low: 800, mid: 1200, high: 1800 }, install: { low: 400, mid: 700, high: 1100 },  label: 'Sliding patio — vinyl basic' },
  sliding_fiberglass:       { equipment: { low: 2000, mid: 3200, high: 4800 }, install: { low: 600, mid: 1100, high: 1800 }, label: 'Sliding patio — fiberglass premium' },
  sliding_wood:             { equipment: { low: 3500, mid: 5500, high: 8500 }, install: { low: 800, mid: 1400, high: 2200 }, label: 'Sliding patio — wood premium' },
  french:                   { equipment: { low: 1800, mid: 2800, high: 4500 }, install: { low: 700, mid: 1300, high: 2200 }, label: 'French double door' },
  garage_steel_single:      { equipment: { low: 500, mid: 850, high: 1300 },  install: { low: 300, mid: 500, high: 900 },   label: 'Garage — steel single 8x7' },
  garage_steel_double:      { equipment: { low: 900, mid: 1500, high: 2400 }, install: { low: 400, mid: 700, high: 1200 },  label: 'Garage — steel double 16x7' },
  garage_premium:           { equipment: { low: 2500, mid: 4500, high: 8500 }, install: { low: 500, mid: 1000, high: 1800 }, label: 'Garage — premium double (carriage/wood/glass)' },
};

function scale(b: Band, m: number): Band { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: Band, b: Band): Band { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export default function DoorReplacementCalculator() {
  const [state, setState] = useState('OH');
  const [zip, setZip] = useState('');
  const [door, setDoor] = useState<DoorType>('front_fiberglass_mid');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.electrician_multiplier ?? 1.0;
    const d = DOORS[door];
    const install = scale(d.install, laborMult);
    const gross = add(d.equipment, install);
    return { equipment: d.equipment, install, gross, label: d.label };
  }, [state, door]);

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
          <label className="label" htmlFor="door">Door type</label>
          <select id="door" className="input" value={door} onChange={e => setDoor(e.target.value as DoorType)}>
            <optgroup label="Front entry">
              <option value="front_steel">Steel basic</option>
              <option value="front_fiberglass_mid">Fiberglass mid (most popular)</option>
              <option value="front_fiberglass_premium">Fiberglass premium</option>
              <option value="front_wood">Solid wood</option>
            </optgroup>
            <optgroup label="Patio">
              <option value="sliding_vinyl">Sliding vinyl basic</option>
              <option value="sliding_fiberglass">Sliding fiberglass premium</option>
              <option value="sliding_wood">Sliding wood premium</option>
              <option value="french">French double door</option>
            </optgroup>
            <optgroup label="Garage">
              <option value="garage_steel_single">Steel single 8×7</option>
              <option value="garage_steel_double">Steel double 16×7</option>
              <option value="garage_premium">Premium (carriage / wood / glass)</option>
            </optgroup>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Installed cost · {result.label} · {stateName}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Energy note:</strong> a U-factor of 0.30 or lower is the modern target for ENERGY STAR. The 25C credit for ENERGY STAR exterior doors (was 30% up to $250 per door, $500 total) expired Dec 31 2025. Door replacement doesn&rsquo;t generate huge energy savings — 1–3% of HVAC — but matters for comfort, security, and curb appeal at resale.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="door-replacement"
    />
    </>
  );
}
