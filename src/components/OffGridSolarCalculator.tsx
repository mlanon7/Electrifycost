import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Profile = 'cabin_basic' | 'cabin_full' | 'homestead_modest' | 'homestead_full' | 'backup';

interface Band { low: number; mid: number; high: number; }

const PROFILES: Record<Profile, { dailyKwh: number; pvKw: number; batteryKwh: number; pv: Band; battery: Band; inverter: Band; install: Band; label: string }> = {
  cabin_basic:      { dailyKwh: 5, pvKw: 1.5, batteryKwh: 10, pv: { low: 3000, mid: 4500, high: 6000 }, battery: { low: 5000, mid: 7000, high: 10000 }, inverter: { low: 800, mid: 1200, high: 1800 }, install: { low: 2000, mid: 3500, high: 6000 }, label: 'Weekend cabin (basic loads)' },
  cabin_full:       { dailyKwh: 15, pvKw: 4, batteryKwh: 20, pv: { low: 7500, mid: 11000, high: 15000 }, battery: { low: 10000, mid: 15000, high: 22000 }, inverter: { low: 1500, mid: 2200, high: 3200 }, install: { low: 4000, mid: 7000, high: 11000 }, label: 'Full-time cabin (small home)' },
  homestead_modest: { dailyKwh: 25, pvKw: 7, batteryKwh: 30, pv: { low: 13500, mid: 19500, high: 27000 }, battery: { low: 15000, mid: 22000, high: 32000 }, inverter: { low: 2500, mid: 3500, high: 5000 }, install: { low: 6000, mid: 11000, high: 18000 }, label: 'Modest homestead (gas heat + cooking)' },
  homestead_full:   { dailyKwh: 40, pvKw: 12, batteryKwh: 60, pv: { low: 23000, mid: 33500, high: 46000 }, battery: { low: 30000, mid: 45000, high: 65000 }, inverter: { low: 4000, mid: 6000, high: 8500 }, install: { low: 9000, mid: 16000, high: 28000 }, label: 'Full-electric homestead' },
  backup:           { dailyKwh: 0, pvKw: 10, batteryKwh: 40, pv: { low: 18000, mid: 26000, high: 36000 }, battery: { low: 20000, mid: 30000, high: 42000 }, inverter: { low: 3000, mid: 4500, high: 6500 }, install: { low: 7000, mid: 13000, high: 22000 }, label: 'Grid-tied whole-home backup' },
};

function add(a: Band, b: Band): Band { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export default function OffGridSolarCalculator() {
  const [state, setState] = useState('MT');
  const [zip, setZip] = useState('');
  const [profile, setProfile] = useState<Profile>('cabin_full');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const p = PROFILES[profile];
    const gross = add(add(add(p.pv, p.battery), p.inverter), p.install);
    return { ...p, gross };
  }, [profile]);

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
          <label className="label" htmlFor="profile">Use profile</label>
          <select id="profile" className="input" value={profile} onChange={e => setProfile(e.target.value as Profile)}>
            <option value="cabin_basic">Weekend cabin (5 kWh/day basic)</option>
            <option value="cabin_full">Full-time cabin (15 kWh/day small home)</option>
            <option value="homestead_modest">Modest homestead (25 kWh/day, gas heat)</option>
            <option value="homestead_full">Full-electric homestead (40 kWh/day)</option>
            <option value="backup">Grid-tied with whole-home backup capability</option>
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
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">PV array</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{result.pvKw} kW</p>
              <p className="mt-1 text-[11px] text-ink-600">{fmtUSD(result.pv.mid)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Battery</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{result.batteryKwh} kWh</p>
              <p className="mt-1 text-[11px] text-ink-600">{fmtUSD(result.battery.mid)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Inverter + install</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.inverter.mid + result.install.mid)}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Off-grid economics:</strong> off-grid is expensive — grid power averages 16¢/kWh; off-grid power often costs 50-80¢/kWh over 20 years once you include battery replacement. The rationale is location (no grid), independence (preppers/homesteaders), or resilience (grid-tied with full-backup). The federal 25D credit covered off-grid solar through 2025-12-31 (now expired); state programs vary.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="off-grid-solar"
    />
    </>
  );
}
