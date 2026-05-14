import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';

type Pump = 'basic' | 'heavy' | 'battery_only' | 'combo' | 'water_powered' | 'smart' | 'generator_circuit';

interface Band { low: number; mid: number; high: number; }

const PUMPS: Record<Pump, { equipment: Band; install: Band; gpm: number; label: string }> = {
  basic:             { equipment: { low: 180, mid: 260, high: 380 },  install: { low: 250, mid: 400, high: 650 },   gpm: 40, label: 'Basic primary 1/3 HP' },
  heavy:             { equipment: { low: 280, mid: 420, high: 650 },  install: { low: 300, mid: 500, high: 800 },   gpm: 60, label: 'Heavy-duty 1/2 HP' },
  battery_only:      { equipment: { low: 250, mid: 400, high: 650 },  install: { low: 200, mid: 400, high: 700 },   gpm: 25, label: 'Battery backup only (standalone DC)' },
  combo:             { equipment: { low: 500, mid: 800, high: 1300 }, install: { low: 400, mid: 700, high: 1200 },  gpm: 55, label: 'Combo primary + battery backup' },
  water_powered:     { equipment: { low: 180, mid: 300, high: 500 },  install: { low: 250, mid: 500, high: 900 },   gpm: 35, label: 'Water-powered backup' },
  smart:             { equipment: { low: 800, mid: 1200, high: 1800 }, install: { low: 500, mid: 900, high: 1500 },  gpm: 55, label: 'Smart WiFi combo' },
  generator_circuit: { equipment: { low: 180, mid: 260, high: 380 },  install: { low: 1500, mid: 2500, high: 4000 }, gpm: 40, label: 'Primary on generator circuit' },
};

function scale(b: Band, m: number): Band { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: Band, b: Band): Band { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export default function SumpPumpCalculator() {
  const [state, setState] = useState('IL');
  const [zip, setZip] = useState('');
  const [pump, setPump] = useState<Pump>('combo');
  const [floodRisk, setFloodRisk] = useState<'low' | 'medium' | 'high'>('medium');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.plumber_multiplier ?? 1.0;
    const p = PUMPS[pump];
    const install = scale(p.install, laborMult);
    const gross = add(p.equipment, install);

    const recommendation =
      floodRisk === 'high' && pump !== 'combo' && pump !== 'smart' && pump !== 'generator_circuit'
        ? 'Upgrade to combo or smart — high flood risk warrants battery backup'
        : floodRisk === 'low' && pump === 'smart'
        ? 'Smart features may be overkill; combo is likely enough'
        : 'Good match for your risk profile';

    return { equipment: p.equipment, install, gross, label: p.label, recommendation };
  }, [state, pump, floodRisk]);

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
        <div>
          <label className="label" htmlFor="pump">Sump pump configuration</label>
          <select id="pump" className="input" value={pump} onChange={e => setPump(e.target.value as Pump)}>
            <option value="basic">Basic primary 1/3 HP only</option>
            <option value="heavy">Heavy-duty 1/2 HP only</option>
            <option value="battery_only">Battery backup (add to existing)</option>
            <option value="combo">Combo primary + battery backup (most popular)</option>
            <option value="water_powered">Water-powered backup (no battery)</option>
            <option value="smart">Smart WiFi combo with monitoring</option>
            <option value="generator_circuit">Primary on generator critical-loads circuit</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="risk">Basement flood risk</label>
          <select id="risk" className="input" value={floodRisk} onChange={e => setFloodRisk(e.target.value as 'low' | 'medium' | 'high')}>
            <option value="low">Low (rarely floods, no finished space)</option>
            <option value="medium">Medium (occasional water, finished basement)</option>
            <option value="high">High (regular flooding, valuable contents)</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-blue-300/60 bg-gradient-to-br from-blue-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Installed cost · {result.label} · {stateName}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <p className="mt-3 text-sm text-blue-800">{result.recommendation}</p>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Backup matters more than capacity:</strong> the most common sump-pump failure isn't horsepower — it's power loss during the same storm that caused the flooding. A 1/3 HP primary + DC battery backup outperforms a 1 HP primary alone during outages. Test the backup quarterly; battery replacement every 4-5 years.
        </div>
      </div>
    </div>
  );
}
