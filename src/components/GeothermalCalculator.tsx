import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';

type Loop = 'vertical' | 'horizontal' | 'pond' | 'open';
type Tonnage = '2' | '3' | '4' | '5' | '6';
type Existing = 'yes' | 'no';

interface CostBand { low: number; mid: number; high: number; }
const add = (a: CostBand, b: CostBand): CostBand => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// Fully-loaded per-ton installed cost by loop type. Industry consolidates the
// indoor heat-pump unit + ground loop + plumbing tie-in into a single per-ton
// figure ($3,500–$5,500/ton typical, HomeGuide 2026; premium installs up to
// $11,700/ton, Bryant 2026). Sources: data/csv/geothermal-cost-ranges.csv.
const LOOP_PER_TON: Record<Loop, CostBand> = {
  vertical:   { low: 3500, mid: 4500, high: 6500 },
  horizontal: { low: 2500, mid: 3500, high: 5000 },
  pond:       { low: 2200, mid: 3200, high: 4500 },
  open:       { low: 2800, mid: 3800, high: 5200 },
};

const DUCT_REUSE_BONUS: CostBand = { low: -1500, mid: -2500, high: -4000 };  // savings if existing ducts reused

const PERMIT_DESIGN: CostBand = { low: 800, mid: 1500, high: 2800 };          // engineering + drilling permit

export default function GeothermalCalculator() {
  const [state, setState] = useState('NY');
  const [zip, setZip] = useState('');
  const [tonnage, setTonnage] = useState<Tonnage>('3');
  const [loop, setLoop] = useState<Loop>('vertical');
  const [existingDucts, setExistingDucts] = useState<Existing>('yes');
  const [installYear, setInstallYear] = useState(2026);

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const hvacMult = lab?.hvac_multiplier ?? 1.0;
    const ton = parseFloat(tonnage);
    // Fully-loaded per-ton install (indoor unit + loop + tie-in).
    const loopCost = scale(LOOP_PER_TON[loop], ton * hvacMult);
    const ductBonus = existingDucts === 'yes' ? DUCT_REUSE_BONUS : { low: 0, mid: 0, high: 0 };
    const permit = scale(PERMIT_DESIGN, hvacMult);

    const gross: CostBand = {
      low: loopCost.low + ductBonus.low + permit.low,
      mid: loopCost.mid + ductBonus.mid + permit.mid,
      high: loopCost.high + ductBonus.high + permit.high,
    };

    // Federal 25D credit — TERMINATED by OBBBA for property placed in service after 2025-12-31.
    // Source: IRS https://www.irs.gov/credits-deductions/residential-clean-energy-credit
    const fedRate = installYear <= 2025 ? 0.30 : 0;
    const fedCredit: CostBand = { low: gross.low * fedRate, mid: gross.mid * fedRate, high: gross.high * fedRate };
    const net: CostBand = { low: gross.low - fedCredit.low, mid: gross.mid - fedCredit.mid, high: gross.high - fedCredit.high };

    return { loopCost, ductBonus, permit, gross, fedCredit, net, fedRate };
  }, [state, tonnage, loop, existingDucts, installYear]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 14850" className="input mt-1 w-full" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">System size (tons)</label>
          <select className="input mt-1 w-full" value={tonnage} onChange={e => setTonnage(e.target.value as Tonnage)}>
            <option value="2">2 ton (small home)</option>
            <option value="3">3 ton (1,500–2,000 sqft)</option>
            <option value="4">4 ton (2,000–2,500 sqft)</option>
            <option value="5">5 ton (2,500–3,500 sqft)</option>
            <option value="6">6 ton (large)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Ground loop type</label>
          <select className="input mt-1 w-full" value={loop} onChange={e => setLoop(e.target.value as Loop)}>
            <option value="vertical">Vertical bore (most common, smallest yard)</option>
            <option value="horizontal">Horizontal trench (needs ~1 acre yard)</option>
            <option value="pond">Pond / lake loop (cheapest if available)</option>
            <option value="open">Open loop (well + discharge)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Existing ductwork?</label>
          <select className="input mt-1 w-full" value={existingDucts} onChange={e => setExistingDucts(e.target.value as Existing)}>
            <option value="yes">Yes (reuse)</option>
            <option value="no">No (add to install cost)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Install year</label>
          <select className="input mt-1 w-full" value={installYear} onChange={e => setInstallYear(Number(e.target.value))}>
            <option value={2026}>2026 (no federal — 25D expired)</option>
            <option value={2027}>2027 (no federal)</option>
            <option value={2025}>2025 (historical — last 30% year)</option>
          </select>
          <p className="mt-1 text-[11px] text-ink-500">25D credit terminated by OBBBA for property placed in service after 2025-12-31.</p>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {tonnage} ton · {loop} loop · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)} gross</p>
          </div>
          <div className="mt-4 rounded-lg border border-brand-200 bg-white/70 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Net after federal 25D credit ({Math.round(result.fedRate * 100)}%)</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.net.mid)}</p>
            <p className="mt-1 text-[11px] text-ink-600">Range {fmtUSDRange(result.net.low, result.net.high)} · {result.fedRate === 0 ? '25D expired after 2025-12-31 — only state programs apply' : 'historical 30% credit'}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>System install ({loop} loop, fully loaded)</span><span className="tabular-nums">{fmtUSD(result.loopCost.mid)}</span></li>
              {existingDucts === 'yes' && <li className="flex justify-between gap-3"><span>Duct reuse credit</span><span className="tabular-nums text-brand-700">{fmtUSD(result.ductBonus.mid)}</span></li>}
              <li className="flex justify-between gap-3"><span>Permit + design engineering</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
              <li className="mt-2 border-t border-ink-100 pt-2 text-[11px] text-ink-500">Industry consolidates indoor unit + loop into a single per-ton installed figure: $3,500–$5,500/ton typical (HomeGuide 2026), up to $11,700/ton premium.</li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Why geothermal</h3>
            <p className="mt-2 text-sm text-ink-700">
              Geothermal uses the constant 50–55°F earth temperature as its heat source/sink. COP of 4.0–5.5 (vs 2.5–3.5 for air-source), so 50%+ lower operating cost. Equipment lifespan 25+ years (vs 15 for air-source). The federal 25D credit (30%) was terminated by OBBBA after 2025-12-31. The trade-off is upfront cost and yard disruption.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Loop-type guidance:</strong> Vertical bore is the most common (suits small/normal yards, $20-30/ft drilling). Horizontal needs ~1 acre and trenching but is much cheaper. Pond requires a pond ≥8 ft deep year-round. Open-loop discharges well water — restricted in many jurisdictions and risks fouling.
        </div>
      </div>
    </div>
  );
}
