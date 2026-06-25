import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, stateEnergy } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Size = '85k' | '110k' | '125k' | '140k';
type PoolGallons = '10k' | '15k' | '20k' | '30k' | '40k';
type Climate = 'warm' | 'mild' | 'cool';

interface CostBand { low: number; mid: number; high: number; }
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 equipment + install. Sources: Pentair UltraTemp, Hayward HeatPro, Raypak Crosswind, AquaCal HeatWave.
const EQUIPMENT: Record<Size, CostBand> = {
  '85k':   { low: 2500, mid: 3200, high: 4000 },   // 85k BTU/hr — small pools
  '110k':  { low: 3000, mid: 3800, high: 4700 },   // 110k BTU/hr — mid pools
  '125k':  { low: 3500, mid: 4300, high: 5200 },   // 125k BTU/hr — large pools, cool climates
  '140k':  { low: 4000, mid: 4900, high: 6000 },   // 140k BTU/hr — premium / spas
};

const INSTALL: CostBand = { low: 800, mid: 1400, high: 2200 };  // pad + electrical + plumbing tie-in
const ELECTRICAL: CostBand = { low: 600, mid: 1100, high: 1800 }; // 240V/50A circuit from panel

// Operating cost approximate: 0.5-1.5 kWh per °F-day of heating, depending on pool size and ambient
// Simplified: assume 60-150 hours/month at rated kW input (~4-7 kW for 85-140k BTU/hr units; COP ~4-6)
function annualOpKwh(size: Size, climate: Climate): number {
  const baseKwh: Record<Size, number> = { '85k': 600, '110k': 800, '125k': 1000, '140k': 1200 };
  const climateMult: Record<Climate, number> = { warm: 0.7, mild: 1.0, cool: 1.5 };
  return baseKwh[size] * climateMult[climate];
}

export default function PoolHpCalculator() {
  useCalculatorUsed('pool-heat-pump');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');
  const [size, setSize] = useState<Size>('110k');
  const [gallons, setGallons] = useState<PoolGallons>('20k');
  const [climate, setClimate] = useState<Climate>('warm');
  const [needsCircuit, setNeedsCircuit] = useState<'yes' | 'no'>('yes');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const elecMult = lab?.electrician_multiplier ?? 1.0;
    const plumbMult = lab?.plumber_multiplier ?? 1.0;
    const equipment = EQUIPMENT[size];
    const install = scale(INSTALL, plumbMult);
    const electrical = needsCircuit === 'yes' ? scale(ELECTRICAL, elecMult) : { low: 0, mid: 0, high: 0 };
    const gross: CostBand = {
      low: equipment.low + install.low + electrical.low,
      mid: equipment.mid + install.mid + electrical.mid,
      high: equipment.high + install.high + electrical.high,
    };
    const annualKwh = annualOpKwh(size, climate);
    const eRow = stateEnergy.find(e => e.state === state);
    const rate = eRow ? eRow.electricity_cents_per_kwh / 100 : 0.16;
    const annualOpCost = annualKwh * rate;
    return { equipment, install, electrical, gross, annualKwh, annualOpCost };
  }, [state, size, climate, needsCircuit]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 33101" className="input mt-1 w-full" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Pool gallons</label>
          <select className="input mt-1 w-full" value={gallons} onChange={e => setGallons(e.target.value as PoolGallons)}>
            <option value="10k">10,000 gal (small)</option>
            <option value="15k">15,000 gal</option>
            <option value="20k">20,000 gal (typical)</option>
            <option value="30k">30,000 gal (large)</option>
            <option value="40k">40,000 gal (very large)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Heat pump size</label>
          <select className="input mt-1 w-full" value={size} onChange={e => setSize(e.target.value as Size)}>
            <option value="85k">85,000 BTU/hr (small pools, warm climate)</option>
            <option value="110k">110,000 BTU/hr (typical)</option>
            <option value="125k">125,000 BTU/hr (larger pools)</option>
            <option value="140k">140,000 BTU/hr (premium / spas)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Climate</label>
          <select className="input mt-1 w-full" value={climate} onChange={e => setClimate(e.target.value as Climate)}>
            <option value="warm">Warm (FL, TX coast, Gulf Coast)</option>
            <option value="mild">Mild (CA, NC, AZ)</option>
            <option value="cool">Cool (Northeast, Mid-Atlantic, Mountain — usable May-Oct only)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Need new 240V/50A circuit?</label>
          <select className="input mt-1 w-full" value={needsCircuit} onChange={e => setNeedsCircuit(e.target.value as 'yes' | 'no')}>
            <option value="yes">Yes (most installs)</option>
            <option value="no">No (existing pool circuit usable)</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {size.replace('k', ',000')} BTU/hr · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Annual op cost</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.annualOpCost)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">~{result.annualKwh.toLocaleString()} kWh</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">vs gas heater</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-700">~50-70% less</p>
              <p className="mt-1 text-[11px] text-ink-600">COP 4-6 vs 80% AFUE gas</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Climate reality:</strong> Pool heat pumps work down to ~50°F ambient. Below that, capacity drops sharply and you need a solar cover or gas heater. In warm states (FL, TX coast, AZ, HI, S. CA), a heat pump alone is fine year-round. In mild climates, expect May-October pool season. In cool climates, you&rsquo;re looking at June-September; consider gas heater as backup or solar pool cover.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Sizing math</h3>
          <p className="mt-2 text-sm text-ink-700">
            BTU/hr needed ≈ pool surface area × desired temp rise × 12. A 20,000-gal pool with 400 sqft surface, raising 10°F: ~48,000 BTU/hr (continuous) — but you want recovery time, so 110,000 BTU/hr unit. Most warm-climate residential pools land at 85,000-110,000 BTU/hr; cool climates and spas push to 125,000-140,000 BTU/hr.
          </p>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="pool-heat-pump"
    />
    </>
  );
}
