import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';

type System = 'softener_basic' | 'softener_premium' | 'salt_free' | 'whole_house_carbon' | 'softener_carbon_combo' | 'ro_undersink' | 'ro_whole_house' | 'iron_filter';

interface Band { low: number; mid: number; high: number; }

const SYS: Record<System, { equipment: Band; install: Band; saltLbYr: number; kwhYr: number; label: string }> = {
  softener_basic:        { equipment: { low: 400, mid: 650, high: 900 },   install: { low: 400, mid: 700, high: 1100 }, saltLbYr: 250, kwhYr: 40, label: 'Basic salt softener (Whirlpool, Morton)' },
  softener_premium:      { equipment: { low: 1500, mid: 2500, high: 3800 }, install: { low: 800, mid: 1400, high: 2200 }, saltLbYr: 200, kwhYr: 30, label: 'Premium softener (Kinetico, Culligan)' },
  salt_free:             { equipment: { low: 800, mid: 1400, high: 2200 }, install: { low: 300, mid: 600, high: 1100 }, saltLbYr: 0,   kwhYr: 0,  label: 'Salt-free conditioner (TAC/template)' },
  whole_house_carbon:    { equipment: { low: 500, mid: 900, high: 1500 },  install: { low: 300, mid: 600, high: 1100 }, saltLbYr: 0,   kwhYr: 0,  label: 'Whole-house carbon (chlorine + taste)' },
  softener_carbon_combo: { equipment: { low: 1200, mid: 2000, high: 3000 }, install: { low: 600, mid: 1100, high: 1800 }, saltLbYr: 250, kwhYr: 40, label: 'Combo softener + carbon (Pentair, Aquasana)' },
  ro_undersink:          { equipment: { low: 200, mid: 450, high: 800 },  install: { low: 150, mid: 350, high: 650 }, saltLbYr: 0,   kwhYr: 0,  label: 'Reverse osmosis (undersink kitchen)' },
  ro_whole_house:        { equipment: { low: 3500, mid: 5500, high: 8500 }, install: { low: 1500, mid: 2500, high: 4000 }, saltLbYr: 0,   kwhYr: 200, label: 'Whole-house RO + storage tank' },
  iron_filter:           { equipment: { low: 900, mid: 1500, high: 2500 }, install: { low: 500, mid: 900, high: 1500 }, saltLbYr: 0,   kwhYr: 30, label: 'Iron + sulfur filter (well water)' },
};

const SALT_PRICE_PER_LB = 0.18;
const ELEC_RATE = 0.16;

function scale(b: Band, m: number): Band { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: Band, b: Band): Band { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export default function WaterTreatmentCalculator() {
  const [state, setState] = useState('TX');
  const [zip, setZip] = useState('');
  const [system, setSystem] = useState<System>('softener_carbon_combo');
  const [hardness, setHardness] = useState<'soft' | 'moderate' | 'hard' | 'very_hard'>('hard');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.plumber_multiplier ?? 1.0;
    const s = SYS[system];
    const install = scale(s.install, laborMult);
    const gross = add(s.equipment, install);

    // Adjust salt use by hardness (very hard doubles salt; soft halves)
    const hardnessMult = hardness === 'soft' ? 0.5 : hardness === 'moderate' ? 0.8 : hardness === 'hard' ? 1.0 : 1.5;
    const annualSaltCost = s.saltLbYr * hardnessMult * SALT_PRICE_PER_LB;
    const annualElec = s.kwhYr * ELEC_RATE;
    const annualOp = annualSaltCost + annualElec;

    return { equipment: s.equipment, install, gross, annualSaltCost, annualElec, annualOp, label: s.label };
  }, [state, system, hardness]);

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
          <p className="mt-1 text-[10px] text-ink-600">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
        </div>
        <div>
          <label className="label" htmlFor="system">System type</label>
          <select id="system" className="input" value={system} onChange={e => setSystem(e.target.value as System)}>
            <option value="softener_basic">Basic salt softener</option>
            <option value="softener_premium">Premium softener (Kinetico/Culligan)</option>
            <option value="salt_free">Salt-free conditioner</option>
            <option value="whole_house_carbon">Whole-house carbon (chlorine + taste)</option>
            <option value="softener_carbon_combo">Combo softener + carbon (most common)</option>
            <option value="ro_undersink">RO undersink (drinking water only)</option>
            <option value="ro_whole_house">Whole-house RO</option>
            <option value="iron_filter">Iron + sulfur filter (well water)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="hardness">Water hardness</label>
          <select id="hardness" className="input" value={hardness} onChange={e => setHardness(e.target.value as 'soft' | 'moderate' | 'hard' | 'very_hard')}>
            <option value="soft">Soft (&lt;3 gpg / &lt;50 ppm)</option>
            <option value="moderate">Moderate (3-7 gpg)</option>
            <option value="hard">Hard (7-15 gpg, typical Midwest)</option>
            <option value="very_hard">Very hard (15+ gpg, Southwest/Florida)</option>
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
              <p className="mt-1 text-[11px] text-ink-600">Salt: {fmtUSD(result.annualSaltCost)} · Electric: {fmtUSD(result.annualElec)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">HPWH compatibility</p>
              <p className="mt-0.5 text-sm font-medium text-brand-800">{system.includes('softener') ? '✓ Recommended before HPWH' : 'Optional'}</p>
              <p className="mt-1 text-[11px] text-ink-600">Hard water shortens HPWH coil life ~30%</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Why softener pairs with HPWH:</strong> heat pump water heaters circulate water through small-diameter copper or stainless coils that scale faster than tank elements. Installing a softener before a HPWH retrofit often pays back through extended equipment life. Same logic for tankless gas — manufacturers void warranties if hardness exceeds 7-10 gpg without treatment.
        </div>
      </div>
    </div>
  );
}
