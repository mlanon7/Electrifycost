import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Material = 'vinyl' | 'fiberglass' | 'wood_clad' | 'aluminum';
type Glazing = 'double_lowE' | 'triple_lowE' | 'storm_addon';
type Install = 'retrofit' | 'new_construction';

interface CostBand { low: number; mid: number; high: number; }
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// Per-window installed cost 2026. Sources: Modernize 2024 contractor surveys, ENERGY STAR / NFRC database,
// Pella, Marvin, Andersen, Milgard, Jeld-Wen MSRPs. Standard double-hung sized roughly 36×60.
const PER_WINDOW: Record<Material, Record<Glazing, CostBand>> = {
  vinyl: {
    double_lowE:  { low: 450, mid: 650, high: 900 },
    triple_lowE:  { low: 650, mid: 850, high: 1150 },
    storm_addon:  { low: 200, mid: 350, high: 500 },     // exterior storm window over existing
  },
  fiberglass: {
    double_lowE:  { low: 700, mid: 950, high: 1250 },
    triple_lowE:  { low: 900, mid: 1200, high: 1600 },
    storm_addon:  { low: 0, mid: 0, high: 0 },
  },
  wood_clad: {
    double_lowE:  { low: 950, mid: 1300, high: 1750 },
    triple_lowE:  { low: 1200, mid: 1650, high: 2200 },
    storm_addon:  { low: 0, mid: 0, high: 0 },
  },
  aluminum: {                                            // mostly hot-climate, low-thermal-bridge designs
    double_lowE:  { low: 600, mid: 850, high: 1150 },
    triple_lowE:  { low: 800, mid: 1100, high: 1500 },
    storm_addon:  { low: 0, mid: 0, high: 0 },
  },
};

const INSTALL_MULT: Record<Install, number> = {
  retrofit: 1.0,
  new_construction: 1.15,   // includes brick/siding trim work, drywall patching
};

export default function WindowCalculator() {
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [count, setCount] = useState(12);
  const [material, setMaterial] = useState<Material>('vinyl');
  const [glazing, setGlazing] = useState<Glazing>('double_lowE');
  const [install, setInstall] = useState<Install>('retrofit');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.electrician_multiplier ?? 1.0;  // proxy for general carpentry
    const installMult = INSTALL_MULT[install];
    const perWindow = PER_WINDOW[material][glazing];
    const gross: CostBand = scale(perWindow, count * laborMult * installMult);
    const annualSavings = count * 8;  // ENERGY STAR estimate: $8/yr saved per replaced window over single-pane
    return { perWindow, gross, annualSavings };
  }, [state, count, material, glazing, install]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 94103" className="input mt-1 w-full" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Number of windows</label>
          <input type="number" min={1} max={60} step={1} value={count}
            onChange={e => setCount(Number(e.target.value) || 0)} className="input mt-1 w-full" />
          <p className="mt-1 text-[11px] text-ink-600">Typical 1,800 sqft home: 12-18 windows</p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Frame material</label>
          <select className="input mt-1 w-full" value={material} onChange={e => setMaterial(e.target.value as Material)}>
            <option value="vinyl">Vinyl (most common, best value)</option>
            <option value="fiberglass">Fiberglass (premium, longest life)</option>
            <option value="wood_clad">Wood-clad (premium aesthetic)</option>
            <option value="aluminum">Aluminum (hot-climate / commercial)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Glazing</label>
          <select className="input mt-1 w-full" value={glazing} onChange={e => setGlazing(e.target.value as Glazing)}>
            <option value="double_lowE">Double-pane Low-E (standard 2026)</option>
            <option value="triple_lowE">Triple-pane Low-E (best, cold climates)</option>
            {material === 'vinyl' && <option value="storm_addon">Storm window addon (cheapest)</option>}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Install type</label>
          <select className="input mt-1 w-full" value={install} onChange={e => setInstall(e.target.value as Install)}>
            <option value="retrofit">Retrofit / pocket install (keep existing trim)</option>
            <option value="new_construction">Full frame replacement (new construction)</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-blue-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {count} windows · {material.replace('_', ' ')} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Per window</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.perWindow.mid)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Annual HVAC savings (est.)</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-700">{fmtUSD(result.annualSavings)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">vs single-pane (ENERGY STAR estimate)</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Reality check:</strong> windows have the worst payback of any envelope upgrade — typically 20–40 years on energy savings alone. The right reasons to replace windows are: (1) rot or air leak you can&rsquo;t fix otherwise, (2) noise reduction, (3) aesthetics / curb appeal, (4) you&rsquo;re doing a major remodel anyway. If your only goal is energy savings, insulation and air-sealing are 5–10× better $/return.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· NFRC label on every unit (U-factor, SHGC, VT, AL).</li>
            <li>· U-factor ≤ 0.30 for ENERGY STAR (≤ 0.25 in cold climates).</li>
            <li>· Argon or krypton gas fill, not air.</li>
            <li>· Warm-edge spacer (not aluminum) between panes.</li>
            <li>· Manufacturer warranty: 20-yr glass seal, lifetime frame (transferable a plus).</li>
            <li>· Install warranty: 1-5 yr workmanship from installer.</li>
            <li>· Flashing detail: house wrap and pan flashing under sill, sealed.</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="window-replacement"
    />
    </>
  );
}
