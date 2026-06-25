import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { streamer } from '@/lib/montecarlo.js';
import { money, domainFor, buildChart } from '@/lib/mc-chart';
import type { McResult } from '@/lib/mc-chart';
import { ALL_STATES, findStateLabor, findStateForZip } from '@/lib/data';
import scenarioData from '@/data/scenario-projects.json';
import riskEventsData from '@/data/risk-events.json';

/*
 * ProjectSimulator — the combined "Project Simulator" controller. React port of
 * ProjectCostPro's scenario-sim.js, adapted to ElectrifyCost: regional pricing
 * keys on STATE (using state-labor-multipliers) instead of ZIP, and the chart /
 * engine are shared with the per-calculator sim.
 *
 * Each selected project enters the Monte Carlo as ONE triangular draw over its
 * installed-cost TOTAL band, correlated across projects by the shared market
 * factor (rho 0.5). The combined most-likely total and the P10/P90 range emerge
 * from 10,000 trials — tighter than the naive sum of low/high, because projects
 * rarely all land at their extremes at once.
 */

const TRIALS = 10000;
const PER_FRAME = 320;
const RHO = 0.5;

interface Tier { name: string; label: string; low: number; high: number }
interface Project {
  slug: string; label: string; category: string; categoryLabel: string;
  summary?: string; calcUrl: string;
  mix: { material: number; labor: number; equipment: number };
  tiers: Tier[];
}
interface ScenarioData { projects: Project[] }
interface RiskEvent { label: string; p: number; costLow: number; costHigh: number; show_probability?: boolean }

const DATA = scenarioData as unknown as ScenarioData;
const RISK_EVENTS = riskEventsData as unknown as Record<string, RiskEvent[]>;

// Curated quick-start bundles (slug -> default tier).
const BUNDLES: { id: string; label: string; items: Record<string, string> }[] = [
  { id: 'whole-home', label: 'Whole-home electrification', items: { 'heat-pump': 'typical', 'heat-pump-water-heater': 'typical', 'induction-stove': 'typical', 'ev-charger': 'typical', 'electrical-panel': 'typical' } },
  { id: 'drop-gas', label: 'Drop the gas appliances', items: { 'heat-pump': 'typical', 'heat-pump-water-heater': 'typical', 'induction-stove': 'typical' } },
  { id: 'go-solar', label: 'Go solar + storage', items: { 'solar': 'typical', 'home-battery': 'typical', 'electrical-panel': 'typical' } },
  { id: 'new-ev', label: 'New EV at home', items: { 'ev-charger': 'typical', 'electrical-panel': 'typical', 'home-battery': 'typical' } },
  { id: 'envelope', label: 'Envelope first', items: { 'insulation': 'typical', 'air-sealing': 'typical', 'window-replacement': 'typical' } },
];

function triMedian(a: number, b: number): number {
  if (!(b > a)) return a;
  const m = a + 0.40 * (b - a), fc = (m - a) / (b - a);
  return (0.5 < fc) ? a + Math.sqrt(0.5 * (b - a) * (m - a)) : b - Math.sqrt(0.5 * (b - a) * (b - m));
}
function randSeed(): number { return (Math.random() * 4294967296) >>> 0; }

// Blended state labor index (avg of the three trades). National = 1.
function stateLaborIndex(state: string): number {
  if (!state) return 1;
  const sl = findStateLabor(state);
  if (!sl) return 1;
  return (sl.electrician_multiplier + sl.hvac_multiplier + sl.plumber_multiplier) / 3;
}

interface Selection { tier: string; qty: number }
interface ContribItem { slug: string; label: string; qty: number; median: number }
interface Model {
  items: { low: number; high: number }[];
  events: RiskEvent[];
  band: { low: number; high: number };
  contrib: ContribItem[];
  count: number;
  units: number;
}

export default function ProjectSimulator() {
  const PROJECTS = useMemo(() => {
    const map: Record<string, Project> = {};
    DATA.projects.forEach(p => { map[p.slug] = p; });
    return map;
  }, []);
  const ORDER = useMemo(() => DATA.projects.map(p => p.slug), []);
  const CATS = useMemo(() => {
    const seen: Record<string, { id: string; label: string; slugs: string[] }> = {};
    const list: { id: string; label: string; slugs: string[] }[] = [];
    DATA.projects.forEach(p => {
      if (!seen[p.category]) { seen[p.category] = { id: p.category, label: p.categoryLabel || p.category, slugs: [] }; list.push(seen[p.category]); }
      seen[p.category].slugs.push(p.slug);
    });
    return list;
  }, []);

  const [selected, setSelected] = useState<Record<string, Selection>>({});
  const [zip, setZip] = useState('');
  const [includeSurprises, setIncludeSurprises] = useState(false);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Per-calculator "Custom" estimates read back from a calculator the user
  // configured in the popup (or on its own page) — keyed by slug.
  const [saved, setSaved] = useState<Record<string, { low: number; high: number }>>({});
  // The slug whose calculator is currently open in the in-page popup.
  const [modalSlug, setModalSlug] = useState<string | null>(null);
  const restoredRef = useRef(false);

  // ZIP drives regional pricing: resolve to a state, then apply that state's
  // labor index to the labor share of each project's cost mix.
  const stateCode = zip.length === 5 ? (findStateForZip(zip) || '') : '';
  const stateName = stateCode ? (ALL_STATES.find(s => s.code === stateCode)?.name || '') : '';
  const laborIdx = stateLaborIndex(stateCode);

  const regionIndex = useCallback((p: Project) => {
    return p.mix.material * 1 + p.mix.labor * laborIdx + p.mix.equipment * 1;
  }, [laborIdx]);

  const tierByName = useCallback((p: Project, name: string): Tier => {
    return p.tiers.find(t => t.name === name) || p.tiers[p.tiers.length - 1];
  }, []);

  const bandFor = useCallback((slug: string, tierName: string) => {
    const p = PROJECTS[slug];
    // A saved "Custom" estimate already reflects the user's own config + region
    // (set in the calculator), so the page region index is NOT re-applied.
    if (tierName === 'saved' && saved[slug]) {
      return { low: saved[slug].low, high: saved[slug].high, label: 'Your saved estimate' };
    }
    const t = tierByName(p, tierName === 'saved' ? 'typical' : tierName);
    const idx = regionIndex(p);
    return { low: Math.round(t.low * idx), high: Math.round(t.high * idx), label: t.label };
  }, [PROJECTS, tierByName, regionIndex, saved]);

  // ---- share-state + saved-config load (read on mount, write on change) ----
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (typeof window === 'undefined') return;
    // Load any per-calculator "Custom" estimates the user saved earlier.
    const savedNow: Record<string, { low: number; high: number }> = {};
    ORDER.forEach(slug => {
      try {
        const raw = localStorage.getItem('ec:est:' + slug);
        if (!raw) return;
        const o = JSON.parse(raw);
        if (o && o.int === true && o.high > o.low && o.low > 0) savedNow[slug] = { low: o.low, high: o.high };
      } catch { /* ignore */ }
    });
    if (Object.keys(savedNow).length) setSaved(savedNow);
    const q = new URLSearchParams(window.location.search);
    const z = (q.get('z') || '').replace(/\D/g, '').slice(0, 5);
    if (z) setZip(z);
    if (q.get('s') === '1') setIncludeSurprises(true);
    const p = q.get('p');
    if (p) {
      const next: Record<string, Selection> = {};
      p.split(',').forEach(tok => {
        const [slug, tier, qty] = tok.split(':');
        if (!PROJECTS[slug]) return;
        let t = PROJECTS[slug].tiers.some(x => x.name === tier) ? tier : 'typical';
        if (tier === 'saved' && savedNow[slug]) t = 'saved';
        next[slug] = { tier: t, qty: Math.max(1, Math.min(9, parseInt(qty, 10) || 1)) };
      });
      if (Object.keys(next).length) setSelected(next);
    }
  }, [PROJECTS, ORDER]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    const parts = Object.keys(selected).map(slug => `${slug}:${selected[slug].tier}:${selected[slug].qty}`);
    const q: string[] = [];
    if (parts.length) q.push('p=' + encodeURIComponent(parts.join(',')));
    if (zip) q.push('z=' + zip);
    if (includeSurprises) q.push('s=1');
    const qs = q.join('&');
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [selected, zip, includeSurprises]);

  // ---- selection mutations ----
  const toggleProject = (slug: string, on: boolean) => {
    setSelected(prev => {
      const next = { ...prev };
      if (on) { if (!next[slug]) next[slug] = { tier: saved[slug] ? 'saved' : 'typical', qty: 1 }; }
      else { delete next[slug]; }
      return next;
    });
  };
  const setTier = (slug: string, tier: string) => setSelected(prev => prev[slug] ? { ...prev, [slug]: { ...prev[slug], tier } } : prev);
  const setQty = (slug: string, d: number) => setSelected(prev => {
    if (!prev[slug]) return prev;
    const qty = Math.max(1, Math.min(9, (prev[slug].qty || 1) + d));
    return { ...prev, [slug]: { ...prev[slug], qty } };
  });
  const applyBundle = (b: typeof BUNDLES[number]) => {
    const next: Record<string, Selection> = {};
    Object.keys(b.items).forEach(slug => { if (PROJECTS[slug]) next[slug] = { tier: saved[slug] ? 'saved' : b.items[slug], qty: 1 }; });
    setSelected(next);
  };
  const clearAll = () => setSelected({});

  // ---- embedded-calculator popup + "Custom" read-back ----
  const removeSaved = (slug: string) => {
    try { localStorage.removeItem('ec:est:' + slug); } catch { /* ignore */ }
    setSaved(prev => { const n = { ...prev }; delete n[slug]; return n; });
    setSelected(prev => (prev[slug] && prev[slug].tier === 'saved') ? { ...prev, [slug]: { ...prev[slug], tier: 'typical' } } : prev);
  };
  // On popup close, re-read the calculator's saved estimate and offer it as a
  // "Custom" tier (matching ProjectCostPro's scenario-sim read-back).
  const closeModal = () => {
    const slug = modalSlug;
    setModalSlug(null);
    if (!slug) return;
    try {
      const raw = localStorage.getItem('ec:est:' + slug);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.int === true && o.high > o.low && o.low > 0) {
          setSaved(prev => ({ ...prev, [slug]: { low: o.low, high: o.high } }));
          setSelected(prev => ({ ...prev, [slug]: { tier: 'saved', qty: prev[slug]?.qty || 1 } }));
        }
      }
    } catch { /* ignore */ }
  };
  // Lock body scroll + wire Escape while the popup is open.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('sim-modal-open', !!modalSlug);
    if (!modalSlug) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('sim-modal-open'); document.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalSlug]);

  // ---- model assembly ----
  const model = useMemo<Model | null>(() => {
    const slugs = Object.keys(selected);
    if (!slugs.length) return null;
    const items: { low: number; high: number }[] = [];
    const events: RiskEvent[] = [];
    const naive = { low: 0, high: 0 };
    const contrib: ContribItem[] = [];
    slugs.forEach(slug => {
      const p = PROJECTS[slug]; if (!p) return;
      const s = selected[slug];
      const b = bandFor(slug, s.tier);
      const qty = s.qty || 1;
      for (let i = 0; i < qty; i++) {
        items.push({ low: b.low, high: b.high });
        naive.low += b.low; naive.high += b.high;
        const evs = RISK_EVENTS[slug];
        if (evs) evs.forEach(ev => events.push(ev));
      }
      contrib.push({ slug, label: p.label, qty, median: triMedian(b.low, b.high) * qty });
    });
    if (!items.length) return null;
    return { items, events, band: naive, contrib, count: slugs.length, units: items.length };
  }, [selected, PROJECTS, bandFor]);

  // ---- share / print ----
  const [shareLabel, setShareLabel] = useState('Copy shareable link');
  const copyShare = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.origin + window.location.pathname + window.location.search;
    const done = () => { setShareLabel('Link copied'); setTimeout(() => setShareLabel('Copy shareable link'), 1800); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link:', url));
    else window.prompt('Copy this link:', url);
  };

  // ---- picker render helpers ----
  const matches = (p: Project) => !query.trim() || p.label.toLowerCase().includes(query.trim().toLowerCase());
  const anySelected = Object.keys(selected).length > 0;

  return (
    <>
    <div className="sim-zipbar">
      <label className="sim-ziplabel" htmlFor="sim-zip">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.7-6-10a6 6 0 0 1 12 0c0 4.3-6 10-6 10z" /><circle cx="12" cy="11" r="2.2" /></svg>
        Your ZIP
      </label>
      <input
        id="sim-zip" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={5}
        value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
        placeholder="e.g. 94105" autoComplete="postal-code" aria-describedby="sim-zip-note"
      />
      <span className={`sim-zip-note${stateCode ? ' is-set' : ''}`} id="sim-zip-note">
        {zip.length === 5
          ? (stateCode ? `Pricing for ${stateName} — applied to every project` : 'Not a recognized US ZIP — using national pricing')
          : 'National average — add a ZIP for local labor pricing'}
      </span>
    </div>
    <div className="sim-layout">
      {/* ============ PICKER ============ */}
      <section className="sim-picker" aria-label="Choose projects">
        <div className="sim-picker-bar">
          <div className="sim-bundles" aria-label="Quick-start bundles">
            <span className="sim-bundles-lbl">Quick start:</span>
            {BUNDLES.map(b => (
              <button key={b.id} type="button" className="sim-bundle" onClick={() => applyBundle(b)}>{b.label}</button>
            ))}
          </div>
          <div className="sim-picker-tools">
            <label className="sim-search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter projects…" autoComplete="off" aria-label="Filter projects" />
            </label>
            <button type="button" className="sim-clear" onClick={clearAll}>Clear</button>
          </div>
        </div>

        {anySelected && (
          <div className="sim-chosen">
            <span className="sim-chosen-lbl">Your plan <b>{Object.keys(selected).length}</b></span>
            {Object.keys(selected).map(slug => (
              <button key={slug} type="button" className="sim-chip" onClick={() => toggleProject(slug, false)} aria-label={`Remove ${PROJECTS[slug].label}`}>
                <span>{PROJECTS[slug].label}{selected[slug].qty > 1 ? ` ×${selected[slug].qty}` : ''}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            ))}
          </div>
        )}

        <div className="sim-groups">
          {CATS.map(cat => {
            const rows = cat.slugs.filter(s => matches(PROJECTS[s]));
            if (!rows.length) return null;
            const hasSel = cat.slugs.some(s => !!selected[s]);
            const open = collapsed[cat.id] !== undefined ? !collapsed[cat.id] : (anySelected ? hasSel : true);
            return (
              <details key={cat.id} className="sim-group" open={open}>
                <summary onClick={e => { e.preventDefault(); setCollapsed(c => ({ ...c, [cat.id]: open })); }}>
                  <span className="sim-group-name">{cat.label}</span>
                  <span className="sim-group-count">{rows.length}</span>
                </summary>
                <div className="sim-group-body">
                  {rows.map(slug => {
                    const p = PROJECTS[slug];
                    const sel = selected[slug];
                    const dispTier = sel ? sel.tier : (saved[slug] ? 'saved' : 'typical');
                    const b = bandFor(slug, dispTier);
                    const usingSaved = !!saved[slug] && dispTier === 'saved';
                    return (
                      <div key={slug} className={`sim-row${sel ? ' is-on' : ''}`}>
                        <label className="sim-check">
                          <input type="checkbox" checked={!!sel} onChange={e => toggleProject(slug, e.target.checked)} />
                          <span className="sim-check-box" aria-hidden="true" />
                          <span className="sim-row-name">{p.label}</span>
                        </label>
                        <a className="sim-row-link" href={p.calcUrl} onClick={e => { e.preventDefault(); setModalSlug(slug); }} title={`Adjust the ${p.label} calculator`} aria-label={`Open the ${p.label} calculator to adjust its assumptions`}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
                        </a>
                        {usingSaved && (
                          <span className="sim-saved-tag" title="You set this up in its calculator — × removes it">Custom
                            <button type="button" className="sim-saved-x" onClick={() => removeSaved(slug)} aria-label={`Remove your saved estimate for ${p.label}`}>×</button>
                          </span>
                        )}
                        <div className="sim-row-ctl">
                          <select className="sim-tier" value={dispTier} onChange={e => setTier(slug, e.target.value)} aria-label={`${p.label} scale`}>
                            {p.tiers.map(t => <option key={t.name} value={t.name}>{tierLabel(t)}</option>)}
                            {saved[slug] && <option value="saved">Custom · your estimate</option>}
                          </select>
                          <span className="sim-qty">
                            <button type="button" className="sim-qty-btn" onClick={() => setQty(slug, -1)} aria-label="Fewer" disabled={!sel}>&minus;</button>
                            <span className="sim-qty-n">{sel ? sel.qty : 1}</span>
                            <button type="button" className="sim-qty-btn" onClick={() => setQty(slug, 1)} aria-label="More" disabled={!sel}>+</button>
                          </span>
                          <span className="sim-row-band">{money(b.low)}–{money(b.high)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {/* ============ RESULT ============ */}
      <section className="sim-result" aria-label="Combined cost estimate">
        <div className="sim-result-inner">
          {!model ? (
            <div className="sim-empty">
              <span className="sim-empty-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3 3v18h18" /><path d="M7 14l3-4 3 3 4-6" /></svg>
              </span>
              <p>Pick one or more projects to roll the combined simulation.</p>
            </div>
          ) : (
            <SimResult
              model={model}
              includeSurprises={includeSurprises}
              onToggleSurprises={setIncludeSurprises}
              shareLabel={shareLabel}
              onShare={copyShare}
            />
          )}
        </div>
      </section>
    </div>

    {modalSlug && (
      <div className="sim-modal" role="dialog" aria-modal="true" aria-label={`${PROJECTS[modalSlug].label} calculator`}>
        <div className="sim-modal-backdrop" onClick={closeModal} />
        <div className="sim-modal-panel">
          <div className="sim-modal-head">
            <div className="sim-modal-titlewrap">
              <span className="sim-modal-title">{PROJECTS[modalSlug].label} calculator</span>
              <span className="sim-modal-hint">Adjust the inputs — your changes apply to your plan when you click Done.</span>
            </div>
            <button type="button" className="sim-modal-close" onClick={closeModal}>Done</button>
          </div>
          <iframe className="sim-modal-frame" title={`${PROJECTS[modalSlug].label} calculator`} src={`${PROJECTS[modalSlug].calcUrl}?embed=1${zip.length === 5 ? `&zip=${zip}#zip=${zip}` : ''}`} loading="lazy" />
        </div>
      </div>
    )}
    </>
  );
}

function tierLabel(t: Tier): string {
  const nm = t.name === 'small' ? 'Small' : t.name === 'large' ? 'Large' : 'Typical';
  return (t.label && t.label.toLowerCase() !== 'typical') ? `${nm} · ${t.label}` : `${nm} project`;
}

/* ===================== result (own animation state) ===================== */
const CSEG = 6;

function SimResult({ model, includeSurprises, onToggleSurprises, shareLabel, onShare }: {
  model: Model;
  includeSurprises: boolean;
  onToggleSurprises: (v: boolean) => void;
  shareLabel: string;
  onShare: () => void;
}) {
  const [res, setRes] = useState<McResult | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const stopRaf = () => { if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };

  // signature of the model so we only re-run when the selection/region actually changes
  const sig = model.items.map(it => `${it.low}-${it.high}`).join('|') + '::' + model.events.length;

  const run = useCallback((seed: number) => {
    stopRaf();
    setRunning(true);
    setProgress(0);
    const stream = streamer(model.items, {
      trials: TRIALS, rho: RHO, markup: { low: 1, high: 1 }, band: model.band, seed,
      events: model.events.length ? model.events : [],
    });
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setRes(stream.batch(TRIALS) as McResult); setProgress(TRIALS); setRunning(false); return;
    }
    let done = 0;
    const frame = () => {
      const nb = Math.min(PER_FRAME, TRIALS - done);
      const r = stream.batch(nb) as McResult;
      done += nb;
      setRes(r); setProgress(done);
      if (done < TRIALS) rafRef.current = requestAnimationFrame(frame);
      else { rafRef.current = null; setRunning(false); }
    };
    rafRef.current = requestAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // Re-run (debounced) whenever the selection/region signature changes.
  useEffect(() => {
    const t = setTimeout(() => run(randSeed()), 240);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  useEffect(() => () => stopRaf(), []);

  const dist = res ? ((includeSurprises && res.events) ? res.events : res.base) : null;
  const dom = domainFor(model.band, includeSurprises);
  const chartHtml = dist ? buildChart(dist, model.band, dom, { W: 660, ariaLabel: 'Combined cost probability distribution' }) : '';
  const counter = running
    ? `simulating ${progress.toLocaleString('en-US')} / ${TRIALS.toLocaleString('en-US')} scenarios`
    : res ? `${TRIALS.toLocaleString('en-US')} scenarios simulated` : '';

  const unitNote = model.units > model.count
    ? `${model.units} items across ${model.count} project types`
    : `${model.count} ${model.count === 1 ? 'project' : 'projects'}`;

  // contribution bar
  const total = model.contrib.reduce((s, c) => s + c.median, 0) || 1;
  const sortedContrib = model.contrib.slice().sort((a, b) => b.median - a.median);

  return (
    <div className="sim-output">
      <div className="sim-selcount">{model.count} {model.count === 1 ? 'project selected' : 'projects selected'}</div>
      <div className="mc-cards">
        <div className="mc-card"><span className="mc-card-label">Optimistic</span><span className="mc-card-val">{dist ? money(dist.p10) : '—'}</span><span className="mc-card-sub">10% chance under</span></div>
        <div className="mc-card mc-card-mid"><span className="mc-card-label">Most likely</span><span className="mc-card-val">{dist ? money(dist.mode) : '—'}</span><span className="mc-card-sub">the single most-likely total</span></div>
        <div className="mc-card"><span className="mc-card-label">Safer budget</span><span className="mc-card-val">{dist ? money(dist.p90) : '—'}</span><span className="mc-card-sub">90% chance under</span></div>
      </div>

      <p className="mc-summary">
        {dist ? (
          <>
            Across {unitNote}, the most-likely combined total is about <b>{money(dist.mode)}</b>. The simulation puts roughly
            {' '}8 in 10 outcomes between <b>{money(dist.p10)}</b> and <b>{money(dist.p90)}</b> — tighter than the simple
            {' '}{money(model.band.low)}–{money(model.band.high)} sum, because the projects rarely all land at their extremes at once.
          </>
        ) : <>Rolling 10,000 combined scenarios…</>}
      </p>

      <div className="mc-chart">{dist ? <div dangerouslySetInnerHTML={{ __html: chartHtml }} /> : <div className="mc-chart-empty"><span>Rolling 10,000 scenarios…</span></div>}</div>
      <p className="mc-refnote">{dist ? `Faint lines mark the naive low–high sum (${money(model.band.low)}–${money(model.band.high)}) — the full theoretical spread if everything peaked together.` : ''}</p>

      <div className="sim-contrib">
        <p className="sim-contrib-lbl">What&apos;s driving the total (by most-likely share)</p>
        <div className="sim-cbar">
          {sortedContrib.map((c, i) => (
            <span key={c.slug} className={`sim-cbar-seg sim-cseg-${i % CSEG}`} style={{ width: `${(100 * c.median / total).toFixed(1)}%` }} title={`${c.label} — ${money(c.median)}`} />
          ))}
        </div>
        <ul className="sim-clegend">
          {sortedContrib.map((c, i) => (
            <li key={c.slug}><span className={`sim-cdot sim-cseg-${i % CSEG}`} />{c.label}{c.qty > 1 ? ` ×${c.qty}` : ''} <b>{money(c.median)}</b></li>
          ))}
        </ul>
      </div>

      <div className="sim-controls">
        <label className="mc-switch">
          <input type="checkbox" checked={includeSurprises} onChange={e => onToggleSurprises(e.target.checked)} />
          <span className="mc-switch-track"><span className="mc-switch-thumb" /></span>
          <span className="mc-switch-text">Include real-world surprises</span>
        </label>
        <p className="mc-surprise-stat">
          {includeSurprises && dist && res?.events
            ? <>About <b>{Math.round((res.events.pctHitAny ?? 0) * 100)}%</b> of plans like this hit at least one real-world surprise — typically <b>+{money(res.events.meanAddedWhenHit ?? 0)}</b>.</>
            : (includeSurprises ? 'No catalogued surprises for the selected projects yet.' : '')}
        </p>
      </div>

      <div className="sim-actions">
        <button type="button" className="mc-run" onClick={() => run(randSeed())} disabled={running}>{running ? 'Running…' : 'Run again'}</button>
        <button type="button" className="sim-btn-ghost" onClick={onShare}>{shareLabel}</button>
        <button type="button" className="sim-btn-ghost" onClick={() => typeof window !== 'undefined' && window.print()}>Save as PDF</button>
        <span className="mc-counter">{counter}</span>
      </div>

      <p className="mc-method">
        Each project is drawn from a triangular distribution and the projects move together through a shared market factor
        (correlation ≈ 0.5), so the combined most-likely total and the range <em>emerge</em> from the simulation rather than
        the sum of the published bands. A planning simulation, not a quote. <a href="/methodology/">How this works</a>.
      </p>
    </div>
  );
}
