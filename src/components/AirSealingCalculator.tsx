import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, findClimate } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';

type Scope = 'diy' | 'pro_targeted' | 'deep' | 'ducts_only';
type Tightness = 'leaky' | 'average' | 'tight';
type IncludeDucts = 'yes' | 'no';

interface Band { low: number; mid: number; high: number; }

// Per CSV: air-sealing-cost-ranges.csv (BPI 2024 + Aeroseal)
function getSealingBand(scope: Scope, sqft: number): Band {
  if (scope === 'diy') return { low: 80, mid: 150, high: 300 };
  if (scope === 'ducts_only') return { low: 1200, mid: 1800, high: 2800 };
  if (scope === 'pro_targeted') {
    if (sqft < 1800) return { low: 500, mid: 800, high: 1300 };
    if (sqft < 3000) return { low: 800, mid: 1300, high: 2000 };
    return { low: 1300, mid: 2000, high: 3200 };
  }
  if (scope === 'deep') {
    if (sqft < 3000) return { low: 2000, mid: 3000, high: 4500 };
    return { low: 2800, mid: 4200, high: 6500 };
  }
  return { low: 0, mid: 0, high: 0 };
}

const DUCT_SEALING: Band = { low: 1200, mid: 1800, high: 2800 };

// HVAC savings % by scope
function hvacSavingsPct(scope: Scope, tight: Tightness): number {
  if (scope === 'diy') return 0.03;
  if (scope === 'ducts_only') return 0.10;
  if (scope === 'pro_targeted') return tight === 'leaky' ? 0.12 : tight === 'average' ? 0.08 : 0.04;
  if (scope === 'deep') return tight === 'leaky' ? 0.20 : tight === 'average' ? 0.14 : 0.07;
  return 0;
}

// Typical annual HVAC cost per sqft (rough from EIA RECS)
function annualHvacCostPerSqft(state: string): number {
  const zone = findClimate(state)?.iecc_zone ?? '4A';
  const head = zone[0];
  return head === '5' || head === '6' || head === '7' || head === '8' ? 1.20
    : head === '4' ? 1.00
    : head === '3' ? 0.85
    : 0.70;
}

function add(a: Band, b: Band): Band { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }
function scale(b: Band, m: number): Band { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }

export default function AirSealingCalculator() {
  const [state, setState] = useState('MA');
  const [zip, setZip] = useState('');
  const [sqft, setSqft] = useState(2000);
  const [scope, setScope] = useState<Scope>('pro_targeted');
  const [tight, setTight] = useState<Tightness>('average');
  const [includeDucts, setIncludeDucts] = useState<IncludeDucts>('no');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.electrician_multiplier ?? 1.0;
    const sealing = scale(getSealingBand(scope, sqft), laborMult);
    const ducts = includeDucts === 'yes' && scope !== 'ducts_only' ? scale(DUCT_SEALING, laborMult) : { low: 0, mid: 0, high: 0 };
    const gross = add(sealing, ducts);

    const savingsPct = hvacSavingsPct(scope, tight) + (includeDucts === 'yes' && scope !== 'ducts_only' ? 0.08 : 0);
    const annualHvacCost = annualHvacCostPerSqft(state) * sqft;
    const annualSavings = annualHvacCost * savingsPct;
    const paybackYears = annualSavings > 0 ? Math.round((gross.mid / annualSavings) * 10) / 10 : null;

    return { gross, sealing, ducts, savingsPct, annualHvacCost, annualSavings, paybackYears };
  }, [state, sqft, scope, tight, includeDucts]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  const climate = findClimate(state)?.iecc_zone ?? '4A';

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="label" htmlFor="state">State</label>
          <select id="state" className="input" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="zip">ZIP</label>
          <input id="zip" className="input" inputMode="numeric" pattern="\d*" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/[^0-9]/g, ''))} />
          <p className="mt-1 text-[10px] text-ink-500">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
        </div>

        <div>
          <label className="label" htmlFor="sqft">Home size (sqft)</label>
          <input id="sqft" className="input" type="number" min={500} max={6000} step={50} value={sqft} onChange={e => setSqft(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label" htmlFor="scope">Scope</label>
          <select id="scope" className="input" value={scope} onChange={e => setScope(e.target.value as Scope)}>
            <option value="diy">DIY (caulk + weatherstrip basics)</option>
            <option value="pro_targeted">Professional targeted (recommended)</option>
            <option value="deep">Deep sealing + blower-door verify</option>
            <option value="ducts_only">Duct sealing only (aerosolized / mastic)</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="tight">Current envelope tightness</label>
          <select id="tight" className="input" value={tight} onChange={e => setTight(e.target.value as Tightness)}>
            <option value="leaky">Leaky (drafty, pre-1980 home, no recent work)</option>
            <option value="average">Average (typical 1980-2010 construction)</option>
            <option value="tight">Tight (newer, recent sealing done)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ducts">Include duct sealing?</label>
          <select id="ducts" className="input" value={includeDucts} onChange={e => setIncludeDucts(e.target.value as IncludeDucts)} disabled={scope === 'ducts_only'}>
            <option value="no">No (envelope only)</option>
            <option value="yes">Yes (add duct sealing)</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {sqft} sqft · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">HVAC savings</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.annualSavings)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">{Math.round(result.savingsPct * 100)}% of HVAC bill</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Simple payback</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{result.paybackYears != null ? `${result.paybackYears} yr` : 'n/a'}</p>
              <p className="mt-1 text-[11px] text-ink-600">Climate zone: {climate}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Envelope sealing</span><span className="tabular-nums">{fmtUSD(result.sealing.mid)}</span></li>
              {includeDucts === 'yes' && scope !== 'ducts_only' && (
                <li className="flex justify-between"><span>Duct sealing</span><span className="tabular-nums">{fmtUSD(result.ducts.mid)}</span></li>
              )}
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Total (mid)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Why air-seal first</h3>
            <p className="mt-2 text-sm text-ink-700">
              Air leakage is invisible until measured. A leaky home (ACH50 ≥ 10) loses 30-50% more conditioned air than a sealed one (ACH50 ≤ 5). Sealing before insulation, heat pump, or window upgrades makes every downstream project work better — and often smaller.
            </p>
            <p className="mt-2 text-[11px] text-ink-500">
              Pair with a blower-door test (~$200-400 standalone) to measure pre/post.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Rebate note:</strong> air sealing qualifies for the DOE HOMES rebate (modeled-savings track) where state programs are open — up to $4,000 (moderate income) or $8,000 (low income) for projects with 35%+ modeled energy savings. Often layered with insulation. The federal 25C credit ended Dec 31 2025.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Pre- and post-blower-door numbers (ACH50 or CFM50). Without this, the contractor can&rsquo;t verify what was achieved.</li>
            <li>· BPI (Building Performance Institute) or RESNET certification — required for HOMES rebate eligibility.</li>
            <li>· Specific areas addressed: attic plane, rim joists, recessed lights, plumbing penetrations, top plates, knee walls, basement-to-living-space transitions.</li>
            <li>· Combustion safety test (CO, draft, depressurization). If you have any combustion appliance and air-seal too tight, you can backdraft. Critical safety check.</li>
            <li>· Target ACH50 in writing. Mid-range goal: 3-5 ACH50 for retrofits; new construction targets 1-3.</li>
            <li>· Materials: low-VOC sealants, dense-pack cellulose for stuffed cavities, intumescent caulk at electrical penetrations.</li>
            <li>· Recessed light treatment — IC-rated cans or fixture replacement, not blanket-cover.</li>
            <li>· Photo documentation of inaccessible areas.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
