import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Brand = 'mitsubishi' | 'daikin' | 'fujitsu' | 'lg' | 'pioneer';
type Zones = '1' | '2' | '3' | '4' | '5';
type Spec = 'standard' | 'hyperheat';

interface CostBand { low: number; mid: number; high: number; }
const add = (a: CostBand, b: CostBand): CostBand => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 installed cost per indoor head (zone), all-in including outdoor unit allocation,
// line-set, condensate pump, electrical. Sources: NEEP cold-climate database, Energy Vanguard
// 2024 mini-split survey, Mitsubishi/Daikin/Fujitsu MSRP plus typical contractor markup.
const PER_HEAD: Record<Brand, Record<Spec, CostBand>> = {
  mitsubishi: {
    standard:  { low: 3800, mid: 4800, high: 6000 },
    hyperheat: { low: 4500, mid: 5500, high: 7000 },   // Hyper-Heat H2i (cold-climate)
  },
  daikin: {
    standard:  { low: 3500, mid: 4400, high: 5500 },
    hyperheat: { low: 4200, mid: 5100, high: 6500 },   // Aurora
  },
  fujitsu: {
    standard:  { low: 3300, mid: 4200, high: 5200 },
    hyperheat: { low: 4000, mid: 4900, high: 6200 },   // Halcyon XLTH
  },
  lg: {
    standard:  { low: 3000, mid: 3900, high: 4800 },
    hyperheat: { low: 3700, mid: 4600, high: 5800 },
  },
  pioneer: {                                            // Budget brand — DIY-adjacent
    standard:  { low: 2000, mid: 2800, high: 3700 },
    hyperheat: { low: 2700, mid: 3500, high: 4600 },
  },
};

// Multi-zone economies: each additional head shares an outdoor unit so marginal cost drops.
const MULTI_ZONE_DISCOUNT: Record<Zones, number> = {
  '1': 1.0,
  '2': 0.92,
  '3': 0.88,
  '4': 0.85,
  '5': 0.83,
};

const ELECTRICAL_ADDER: CostBand = { low: 400, mid: 800, high: 1500 };  // 240V circuit + disconnect
const PERMIT: CostBand = { low: 200, mid: 400, high: 700 };

export default function MiniSplitCalculator() {
  const [state, setState] = useState('MA');
  const [zip, setZip] = useState('');
  const [zones, setZones] = useState<Zones>('2');
  const [brand, setBrand] = useState<Brand>('mitsubishi');
  const [spec, setSpec] = useState<Spec>('hyperheat');
  const [needsCircuit, setNeedsCircuit] = useState<'yes' | 'no'>('yes');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const hvacMult = lab?.hvac_multiplier ?? 1.0;
    const perHead = PER_HEAD[brand][spec];
    const numZones = parseInt(zones, 10);
    const discount = MULTI_ZONE_DISCOUNT[zones];
    const equipPerHeadAdj: CostBand = scale(perHead, discount);
    const equip: CostBand = scale(equipPerHeadAdj, numZones * hvacMult);
    const elec = needsCircuit === 'yes' ? scale(ELECTRICAL_ADDER, hvacMult) : { low: 0, mid: 0, high: 0 };
    const permit = scale(PERMIT, hvacMult);
    const gross = add(add(equip, elec), permit);
    return { equip, elec, permit, gross };
  }, [state, zones, brand, spec, needsCircuit]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 02134" className="input mt-1 w-full" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Number of indoor heads (zones)</label>
          <select className="input mt-1 w-full" value={zones} onChange={e => setZones(e.target.value as Zones)}>
            <option value="1">1 zone (single room or open floor)</option>
            <option value="2">2 zones</option>
            <option value="3">3 zones</option>
            <option value="4">4 zones</option>
            <option value="5">5 zones (max for most outdoor units)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Brand</label>
          <select className="input mt-1 w-full" value={brand} onChange={e => setBrand(e.target.value as Brand)}>
            <option value="mitsubishi">Mitsubishi (Hyper-Heat — premium)</option>
            <option value="daikin">Daikin (Aurora — premium)</option>
            <option value="fujitsu">Fujitsu (Halcyon — value/mid)</option>
            <option value="lg">LG (mid)</option>
            <option value="pioneer">Pioneer (budget / DIY-adjacent)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Cold-climate spec?</label>
          <select className="input mt-1 w-full" value={spec} onChange={e => setSpec(e.target.value as Spec)}>
            <option value="hyperheat">Yes — cold-climate (rated to -13°F or lower)</option>
            <option value="standard">No — standard (drops capacity below 17°F)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Need new 240V circuit?</label>
          <select className="input mt-1 w-full" value={needsCircuit} onChange={e => setNeedsCircuit(e.target.value as 'yes' | 'no')}>
            <option value="yes">Yes (standard for new install)</option>
            <option value="no">No (existing circuit available)</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {zones} zone · {brand} {spec === 'hyperheat' ? 'cold-climate' : 'standard'} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>Equipment + install labor</span><span className="tabular-nums">{fmtUSD(result.equip.mid)}</span></li>
              {needsCircuit === 'yes' && <li className="flex justify-between gap-3"><span>240V circuit + disconnect</span><span className="tabular-nums">{fmtUSD(result.elec.mid)}</span></li>}
              <li className="flex justify-between gap-3"><span>Permit + inspection</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Quote check</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-700">
              <li>· NEEP listing for cold-climate models (ashp.neep.org).</li>
              <li>· HSPF2 ≥ 9.0 for ENERGY STAR Most Efficient.</li>
              <li>· Manual J load calc per zone, not eye-balled BTU sizing.</li>
              <li>· 12-yr compressor / 10-yr parts warranty registered to your address.</li>
              <li>· Refrigerant: R-454B or R-32 (post-2025).</li>
              <li>· Vacuum-and-charge test report at commissioning.</li>
            </ul>
          </div>
        </div>
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Cold-climate note:</strong> in zones 5+, choose hyper-heat or equivalent (rated to -13°F). NEEP&rsquo;s Cold Climate Heat Pump Specification list is the authoritative reference. Federal 25C credit ended 2025-12-31; state and utility heat-pump rebates remain widely available.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="mini-split"
    />
    </>
  );
}
