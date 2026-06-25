import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Product = 'span_drive' | 'span_home' | 'lumin' | 'schneider' | 'emporia' | 'load_shed_device' | 'traditional';

interface Band { low: number; mid: number; high: number; }

const PRODUCTS: Record<Product, { equipment: Band; install: Band; label: string; type: 'replace' | 'addon' | 'monitor' | 'baseline' }> = {
  span_drive:        { equipment: { low: 3500, mid: 4000, high: 4500 }, install: { low: 1800, mid: 2800, high: 4500 }, label: 'Span Drive (full smart panel)', type: 'replace' },
  span_home:         { equipment: { low: 4000, mid: 4500, high: 5200 }, install: { low: 1800, mid: 2800, high: 4500 }, label: 'Span Home Panel (premium)', type: 'replace' },
  lumin:             { equipment: { low: 1800, mid: 2200, high: 2800 }, install: { low: 800, mid: 1200, high: 2000 }, label: 'Lumin Smart Panel (add-on)', type: 'addon' },
  schneider:         { equipment: { low: 3200, mid: 3800, high: 4500 }, install: { low: 1800, mid: 2800, high: 4500 }, label: 'Schneider Square D Energy Center', type: 'replace' },
  emporia:           { equipment: { low: 400, mid: 700, high: 1200 },   install: { low: 400, mid: 700, high: 1200 }, label: 'Emporia Vue Smart Panel (monitoring)', type: 'monitor' },
  load_shed_device:  { equipment: { low: 500, mid: 900, high: 1500 },   install: { low: 400, mid: 800, high: 1500 }, label: 'Load-shed device (DCC-9-USA, Wallbox)', type: 'addon' },
  traditional:       { equipment: { low: 700, mid: 1100, high: 1800 }, install: { low: 1500, mid: 2500, high: 4000 }, label: 'Traditional 200A panel (baseline)', type: 'baseline' },
};

const PANEL_UPGRADE_AVOIDED: Band = { low: 1500, mid: 3000, high: 5500 };

function scale(b: Band, m: number): Band { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: Band, b: Band): Band { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export default function SmartPanelCalculator() {
  useCalculatorUsed('smart-panel');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [product, setProduct] = useState<Product>('span_drive');
  const [avoidsUpgrade, setAvoidsUpgrade] = useState(true);

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.electrician_multiplier ?? 1.0;
    const p = PRODUCTS[product];
    const install = scale(p.install, laborMult);
    const permit: Band = { low: 200, mid: 400, high: 800 };
    const gross = add(add(p.equipment, install), permit);

    const traditional = add(add(PRODUCTS.traditional.equipment, scale(PRODUCTS.traditional.install, laborMult)), permit);
    const premium = gross.mid - traditional.mid;
    const avoidedUpgradeValue = avoidsUpgrade ? PANEL_UPGRADE_AVOIDED.mid : 0;
    const netPremium = premium - avoidedUpgradeValue;

    return { equipment: p.equipment, install, permit, gross, traditional, premium, avoidedUpgradeValue, netPremium, label: p.label, type: p.type };
  }, [state, product, avoidsUpgrade]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <>
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
          <p className="mt-1 text-[10px] text-ink-600">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="product">Smart panel product</label>
          <select id="product" className="input" value={product} onChange={e => setProduct(e.target.value as Product)}>
            <option value="span_drive">Span Drive (full smart panel replacement)</option>
            <option value="span_home">Span Home Panel (premium tier)</option>
            <option value="schneider">Schneider Square D Energy Center</option>
            <option value="lumin">Lumin Smart Panel (add-on next to existing)</option>
            <option value="load_shed_device">Load-shed device only (DCC-9-USA, Wallbox)</option>
            <option value="emporia">Emporia Vue Smart Panel (monitoring only)</option>
            <option value="traditional">Traditional 200A panel (baseline for comparison)</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={avoidsUpgrade} onChange={e => setAvoidsUpgrade(e.target.checked)} />
            Smart features will let me avoid a 100A→200A service upgrade ($1,500–$5,500)
          </label>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {result.label} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Premium over traditional</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.premium)}</p>
              <p className="mt-1 text-[11px] text-ink-600">Traditional 200A: {fmtUSD(result.traditional.mid)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Net after avoided upgrade</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-700">{result.netPremium > 0 ? fmtUSD(result.netPremium) : fmtUSD(0)}</p>
              <p className="mt-1 text-[11px] text-ink-600">{result.netPremium < 0 ? 'Smart panel is cheaper after avoided upgrade' : 'Smart panel still costs more'}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">When smart panel wins</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-700">
              <li>· You have a 100A or 125A service and want to add a heat pump + EV charger without upgrading.</li>
              <li>· You have solar + battery and want time-of-use load shifting.</li>
              <li>· You want app visibility into circuit-level consumption.</li>
              <li>· You're considering future backup-battery integration.</li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">When traditional wins</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-700">
              <li>· You already have 200A+ service and aren't adding major loads.</li>
              <li>· You don't need circuit-level monitoring or app control.</li>
              <li>· You're not planning solar/battery integration.</li>
              <li>· Budget is the dominant constraint — traditional is $3,000–$4,000 cheaper.</li>
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Federal note:</strong> the 25C federal credit (with historical caps on qualifying electrical panel/service upgrades) expired Dec 31 2025 (OBBBA). Do not assume smart-panel hardware itself receives a separate federal credit — verify against current IRS guidance before claiming. HEEHRA (DOE Home Energy Rebates) covers up to $4,000 toward electrical panel work for income-qualified households where state programs are open. Some utility programs (PG&E, ConEd, Mass Save) offer $200–$1,500 rebates on smart-panel installs.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="smart-panel"
    />
    </>
  );
}
