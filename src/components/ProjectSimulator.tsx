import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { streamer } from '@/lib/montecarlo.js';
import { money, domainFor, buildChart } from '@/lib/mc-chart';
import type { McResult, McDist } from '@/lib/mc-chart';
import { ALL_STATES, findStateLabor, findStateForZip } from '@/lib/data';
import {
  encodeInstances, decodeParam, composeSpec, sanitizeQs, cleanBrk,
  type SimInstance, type SimBrk, type SnapLike, type DecodeCtx,
} from '@/lib/sim-codec';
import { readEstimateSnapshot } from '@/lib/estimate-snapshot';
import scenarioData from '@/data/scenario-projects.json';
import riskEventsData from '@/data/risk-events.json';

/*
 * ProjectSimulator v2 — instance model. Port of ProjectCostPro's scenario-sim
 * v2 (commit 157d935) into React.
 *
 * The primary object is a CONFIGURED PROJECT INSTANCE, not a slug: the plan is
 * an ordered list; each instance is either a named preset tier (band from the
 * GENERATED scenario table, regionally indexed) or a custom configuration
 * captured from the real calculator (band + spec + share-param qs + breakdown,
 * used AS-IS — its region is already baked in). Duplicate replaces the old
 * ×N stepper: two heat pumps are two independently configurable instances.
 *
 * Custom instances serialize INTO the share URL (base64url JSON), so a link
 * reproduces the whole plan on a clean browser with no localStorage. Decoding
 * fails closed to Typical WITH a visible notice — never silently to another
 * preset. "Clear plan" clears the plan only; saved calculator configurations
 * (ec:est:*) are the visitor's own work and are never bulk-deleted.
 */

const TRIALS = 10000;
const PER_FRAME = 320;
const RHO = 0.5;
const PLAN_KEY = 'ec:sim:plan';

interface Tier { name: string; label: string; low: number; high: number }
interface Project {
  slug: string; label: string; category: string; categoryLabel: string;
  calcUrl: string;
  mix: { material: number; labor: number; equipment: number };
  tiers: Tier[];
}
interface ScenarioData { projects: Project[] }
interface RiskEvent { label: string; p: number; costLow: number; costHigh: number; show_probability?: boolean }

const DATA = scenarioData as unknown as ScenarioData;
const RISK_EVENTS = riskEventsData as unknown as Record<string, RiskEvent[]>;

// A plan instance. `tier` is the last preset tier (kept while kind==='custom'
// so the select can switch back); the custom cfg fields are kept while
// kind==='preset' so "Custom — …" stays selectable.
interface Inst {
  id: number;
  slug: string;
  kind: 'preset' | 'custom';
  tier: string;
  band?: { low: number; high: number };
  spec?: string;
  qs?: string;
  brk?: SimBrk | null;
  locLabel?: string;
}

interface ContribRow { id: number; label: string; spec: string; band: { low: number; high: number }; custom: boolean; brk?: SimBrk | null; median: number }
interface Model {
  items: { low: number; high: number }[];
  events: RiskEvent[];
  band: { low: number; high: number };
  contrib: ContribRow[];
  count: number;
}

// Curated quick-start bundles (slug -> preset tier). Applying one REPLACES the plan.
const BUNDLES: { id: string; label: string; items: [string, string][] }[] = [
  { id: 'whole-home', label: 'Whole-home electrification', items: [['heat-pump', 'typical'], ['heat-pump-water-heater', 'typical'], ['induction-stove', 'typical'], ['ev-charger', 'typical'], ['electrical-panel', 'typical']] },
  { id: 'drop-gas', label: 'Drop the gas appliances', items: [['heat-pump', 'typical'], ['heat-pump-water-heater', 'typical'], ['induction-stove', 'typical']] },
  { id: 'go-solar', label: 'Go solar + storage', items: [['solar', 'typical'], ['home-battery', 'typical'], ['electrical-panel', 'typical']] },
  { id: 'new-ev', label: 'New EV at home', items: [['ev-charger', 'typical'], ['electrical-panel', 'typical'], ['home-battery', 'typical']] },
  { id: 'envelope', label: 'Envelope first', items: [['insulation', 'typical'], ['air-sealing', 'typical'], ['window-replacement', 'typical']] },
];

// Analytic triangular median (mode-skew 0.40) — per-instance "most likely" without a sim run.
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

const PROJECTS: Record<string, Project> = {};
const ORDER: string[] = [];
const CATS: { id: string; label: string; slugs: string[] }[] = [];
{
  const seen: Record<string, { id: string; label: string; slugs: string[] }> = {};
  DATA.projects.forEach(p => {
    PROJECTS[p.slug] = p;
    ORDER.push(p.slug);
    if (!seen[p.category]) { seen[p.category] = { id: p.category, label: p.categoryLabel || p.category, slugs: [] }; CATS.push(seen[p.category]); }
    seen[p.category].slugs.push(p.slug);
  });
}

// STRICT tier lookup — unknown names return null; callers fall back to typical
// deliberately (decode has already raised the visible notice by then).
function tierByName(p: Project, name: string): Tier | null {
  return p.tiers.find(t => t.name === name) ?? null;
}
function typicalTier(p: Project): Tier { return tierByName(p, 'typical') ?? p.tiers[0]; }
function tierOptionLabel(t: Tier): string {
  const nm = t.name === 'small' ? 'Smaller' : t.name === 'large' ? 'Larger' : 'Typical';
  return t.label ? `${nm} · ${t.label}` : `${nm} project`;
}

function snapToCfg(snap: SnapLike): { band: { low: number; high: number }; spec: string; qs: string; brk: SimBrk | null; locLabel: string } {
  return {
    band: { low: Math.round(snap.low), high: Math.round(snap.high) },
    spec: composeSpec(snap),
    qs: sanitizeQs(snap.qs),
    brk: cleanBrk(snap.brk),
    locLabel: String(snap.loc || '').slice(0, 60),
  };
}

export default function ProjectSimulator() {
  const [instances, setInstances] = useState<Inst[]>([]);
  const [zip, setZip] = useState('');
  const [includeSurprises, setIncludeSurprises] = useState(false);
  const [query, setQuery] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [saved, setSaved] = useState<Record<string, SnapLike>>({});
  const [modal, setModal] = useState<{ instId: number | null; slug: string; openTs: number } | null>(null);
  const [status, setStatus] = useState('');
  const [shareLabel, setShareLabel] = useState('Copy shareable link');

  // Simulation run state lives here so the plan cards, the report, and the
  // share/CSV actions all see the same result + seed.
  const [res, setRes] = useState<McResult | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastSeed, setLastSeed] = useState<number | null>(null);

  const seqRef = useRef(0);
  const restoredRef = useRef(false);
  const pinnedSeedRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const runTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Modal focus lifecycle: the panel (for focus trapping), the Done button (the
  // initial focus target), and the element focused before the modal opened
  // (restored on close).
  const modalPanelRef = useRef<HTMLDivElement | null>(null);
  const modalCloseRef = useRef<HTMLButtonElement | null>(null);
  const modalReturnFocusRef = useRef<HTMLElement | null>(null);

  const nextId = () => ++seqRef.current;
  const announce = (msg: string) => setStatus(msg);

  // ---- region ----
  const stateCode = zip.length === 5 ? (findStateForZip(zip) || '') : '';
  const stateName = stateCode ? (ALL_STATES.find(s => s.code === stateCode)?.name || '') : '';
  const laborIdx = stateLaborIndex(stateCode);
  const regionLabel = stateName || 'National average';

  const regionIndex = useCallback((p: Project) => {
    return p.mix.material * 1 + p.mix.labor * laborIdx + p.mix.equipment * 1;
  }, [laborIdx]);

  const tierBand = useCallback((p: Project, t: Tier) => {
    const idx = regionIndex(p);
    return { low: Math.round(t.low * idx), high: Math.round(t.high * idx) };
  }, [regionIndex]);

  // A custom band is used AS-IS: the calculator already priced it for its own
  // region, so the page ZIP never re-multiplies it.
  const instBand = useCallback((inst: Inst) => {
    if (inst.kind === 'custom' && inst.band) return inst.band;
    const p = PROJECTS[inst.slug];
    const t = tierByName(p, inst.tier) ?? typicalTier(p);
    return tierBand(p, t);
  }, [tierBand]);

  const instSpec = (inst: Inst): string => {
    if (inst.kind === 'custom') return inst.spec || 'Your configuration';
    const p = PROJECTS[inst.slug];
    const t = tierByName(p, inst.tier) ?? typicalTier(p);
    return tierOptionLabel(t);
  };
  const hasCustomCfg = (inst: Inst) => !!(inst.band && inst.band.high > inst.band.low);

  // ---- restore (URL wins over storage) ----
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (typeof window === 'undefined') return;

    const savedNow: Record<string, SnapLike> = {};
    ORDER.forEach(slug => {
      const snap = readEstimateSnapshot(slug);
      if (snap) savedNow[slug] = snap as SnapLike;
    });
    if (Object.keys(savedNow).length) setSaved(savedNow);

    const ctx: DecodeCtx = {
      hasProject: slug => !!PROJECTS[slug],
      tierNames: slug => PROJECTS[slug].tiers.map(t => t.name),
      savedSnap: slug => savedNow[slug] ?? null,
    };

    const q = new URLSearchParams(window.location.search);
    const z = (q.get('z') || '').replace(/\D/g, '').slice(0, 5);
    let surprises = q.get('s') === '1';
    let zipNow = z;
    const notices: string[] = [];
    let decoded: SimInstance[] = [];

    const p = q.get('p');
    if (p) {
      const d = decodeParam(p, ctx);
      decoded = d.instances;
      notices.push(...d.notices);
    } else {
      // No plan in the URL — restore the visitor's own saved plan.
      try {
        const raw = localStorage.getItem(PLAN_KEY);
        if (raw) {
          const o = JSON.parse(raw);
          if (o && o.v === 1 && o.p) {
            const d = decodeParam(o.p, ctx);
            decoded = d.instances;
            notices.push(...d.notices);
            if (!z && o.z) zipNow = String(o.z).replace(/\D/g, '').slice(0, 5);
            if (q.get('s') == null && o.s) surprises = true;
          }
        }
      } catch { /* corrupt plan — start fresh */ }
    }

    if (zipNow) setZip(zipNow);
    setIncludeSurprises(surprises);
    if (decoded.length) {
      setInstances(decoded.map(d => ({ id: nextId(), tier: 'typical', ...d } as Inst)));
      // On small screens with a plan already loaded, tuck the catalog away so
      // the plan and its result lead; desktop keeps it beside the result.
      if (window.matchMedia && window.matchMedia('(max-width: 1100px)').matches) setCatalogOpen(false);
    }
    if (notices.length) announce(notices.join(' '));

    const seed = q.get('seed');
    if (seed && /^\d+$/.test(seed)) pinnedSeedRef.current = (+seed) >>> 0;
  }, []);

  // ---- persist (URL + localStorage) ----
  const encodeState = useCallback(() => {
    const parts: string[] = [];
    const pstr = encodeInstances(instances as unknown as SimInstance[]);
    if (pstr) parts.push('p=' + encodeURIComponent(pstr));
    if (zip) parts.push('z=' + zip);
    if (includeSurprises) parts.push('s=1');
    return parts.join('&');
  }, [instances, zip, includeSurprises]);

  useEffect(() => {
    if (!restoredRef.current || typeof window === 'undefined' || !window.history?.replaceState) return;
    const qs = encodeState();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    try {
      if (!instances.length) localStorage.removeItem(PLAN_KEY);
      else localStorage.setItem(PLAN_KEY, JSON.stringify({
        v: 1, p: encodeInstances(instances as unknown as SimInstance[]), z: zip, s: includeSurprises ? 1 : 0,
      }));
    } catch { /* localStorage unavailable */ }
  }, [instances, zip, includeSurprises, encodeState]);

  // ---- instance mutations ----
  const addInstance = (slug: string, tier: string) => {
    setInstances(prev => [...prev, { id: nextId(), slug, kind: 'preset', tier }]);
    announce(PROJECTS[slug].label + ' added to your plan.');
  };
  const addSavedInstance = (slug: string) => {
    const snap = saved[slug];
    if (!snap) return;
    const cfg = snapToCfg(snap);
    setInstances(prev => [...prev, { id: nextId(), slug, kind: 'custom', tier: 'typical', ...cfg }]);
    announce(PROJECTS[slug].label + ' added with your saved configuration' + (cfg.spec ? ': ' + cfg.spec : '') + '.');
  };
  const duplicateInst = (id: number) => {
    setInstances(prev => {
      const i = prev.findIndex(x => x.id === id);
      if (i === -1) return prev;
      const copy: Inst = { ...prev[i], id: nextId() };
      announce(PROJECTS[prev[i].slug].label + ' duplicated.');
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  };
  const removeInst = (id: number) => {
    setInstances(prev => {
      const inst = prev.find(x => x.id === id);
      if (inst) announce(PROJECTS[inst.slug].label + ' removed from your plan.');
      return prev.filter(x => x.id !== id);
    });
  };
  const setInstTier = (id: number, value: string) => {
    setInstances(prev => prev.map(inst => {
      if (inst.id !== id) return inst;
      if (value === '__custom__') return hasCustomCfg(inst) ? { ...inst, kind: 'custom' } : inst;
      if (tierByName(PROJECTS[inst.slug], value)) return { ...inst, kind: 'preset', tier: value }; // custom cfg retained for switching back
      return inst;
    }));
  };
  const applyBundle = (b: typeof BUNDLES[number]) => {
    const next: Inst[] = [];
    b.items.forEach(([slug, tier]) => {
      if (PROJECTS[slug] && tierByName(PROJECTS[slug], tier)) next.push({ id: nextId(), slug, kind: 'preset', tier });
    });
    setInstances(next);
    announce('"' + b.label + '" bundle applied — ' + next.length + ' projects. It replaced your previous plan.');
  };
  // Clears THIS PLAN only. Saved calculator configurations (ec:est:*) are the
  // visitor's own work from the calculator pages — never bulk-delete them.
  const clearPlan = () => {
    setInstances([]);
    announce('Plan cleared. Configurations you saved in the calculators were kept.');
  };
  const removeSaved = (slug: string) => {
    try { localStorage.removeItem('ec:est:' + slug); } catch { /* ignore */ }
    setSaved(prev => { const n = { ...prev }; delete n[slug]; return n; });
  };

  // ---- embedded-calculator popup (same-origin iframe) ----
  // For a custom instance the instance's own qs restores its exact inputs; the
  // simulator's ZIP rides along so preset and custom bands share one regional
  // basis. On Done we apply a FRESH snapshot (written during this popup) to
  // the target instance only — closing without changes changes nothing.
  const openCalc = (instId: number | null, slug: string) => {
    if (!PROJECTS[slug]) return;
    // Remember the trigger so focus can return to it when the modal closes.
    if (typeof document !== 'undefined') modalReturnFocusRef.current = document.activeElement as HTMLElement | null;
    const inst = instId != null ? instances.find(x => x.id === instId) : null;
    let hash = inst && inst.kind === 'custom' && inst.qs ? inst.qs : '';
    if (zip.length === 5 && !/(^|&)zip=/.test(hash)) hash += (hash ? '&' : '') + 'zip=' + zip;
    setModal({ instId, slug, openTs: Date.now(), });
    modalSrcRef.current = `${PROJECTS[slug].calcUrl}?embed=1${zip.length === 5 ? `&zip=${zip}` : ''}${hash ? '#' + hash : ''}`;
  };
  const modalSrcRef = useRef<string>('about:blank');
  const closeModal = () => {
    const t = modal;
    setModal(null);
    if (!t) return;
    const snap = readEstimateSnapshot(t.slug) as SnapLike & { ts?: number } | null;
    if (snap) setSaved(prev => ({ ...prev, [t.slug]: snap }));
    if (snap && (snap.ts ?? 0) >= t.openTs) {
      const cfg = snapToCfg(snap);
      setInstances(prev => {
        const i = t.instId != null ? prev.findIndex(x => x.id === t.instId) : -1;
        if (i === -1) return [...prev, { id: nextId(), slug: t.slug, kind: 'custom', tier: 'typical', ...cfg }];
        const next = [...prev];
        next[i] = { ...next[i], kind: 'custom', ...cfg };
        return next;
      });
      announce(PROJECTS[t.slug].label + ' updated: ' + (cfg.spec ? cfg.spec + ' — ' : '') + money(cfg.band.low) + '–' + money(cfg.band.high) + '.');
    }
  };
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('sim-modal-open', !!modal);
    if (!modal) return;
    // Move focus into the dialog (the Done button) once the panel has mounted.
    modalCloseRef.current?.focus();
    // Escape closes; Tab is trapped within the panel so focus can't escape to
    // the page behind the modal. The same-origin iframe is one focusable stop.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key !== 'Tab') return;
      const panel = modalPanelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])')
      ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('sim-modal-open');
      document.removeEventListener('keydown', onKey);
      // Restore focus to whatever triggered the modal.
      const returnTo = modalReturnFocusRef.current;
      modalReturnFocusRef.current = null;
      if (returnTo && typeof returnTo.focus === 'function') returnTo.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  // ---- model ----
  const model = useMemo<Model | null>(() => {
    if (!instances.length) return null;
    const items: { low: number; high: number }[] = [];
    const events: RiskEvent[] = [];
    const naive = { low: 0, high: 0 };
    const contrib: ContribRow[] = [];
    const slugCount: Record<string, number> = {};
    const slugSeen: Record<string, number> = {};
    instances.forEach(inst => { slugCount[inst.slug] = (slugCount[inst.slug] || 0) + 1; });
    instances.forEach(inst => {
      const p = PROJECTS[inst.slug];
      if (!p) return;
      const b = instBand(inst);
      items.push({ low: b.low, high: b.high });
      naive.low += b.low; naive.high += b.high;
      const evs = RISK_EVENTS[inst.slug];
      if (evs) evs.forEach(ev => events.push(ev));
      slugSeen[inst.slug] = (slugSeen[inst.slug] || 0) + 1;
      const label = p.label + (slugCount[inst.slug] > 1 ? ' (' + slugSeen[inst.slug] + ')' : '');
      contrib.push({ id: inst.id, label, spec: instSpec(inst), band: b, custom: inst.kind === 'custom', brk: inst.kind === 'custom' ? inst.brk : null, median: triMedian(b.low, b.high) });
    });
    if (!items.length) return null;
    return { items, events, band: naive, contrib, count: instances.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, instBand]);

  // ---- run (seeded; input changes auto-re-run; the button reseeds) ----
  const stopRaf = () => { if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  const run = useCallback((seed: number) => {
    if (!model) return;
    stopRaf();
    setRunning(true);
    setProgress(0);
    setLastSeed(seed);
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
  }, [model]);

  const sig = model ? model.items.map(it => `${it.low}-${it.high}`).join('|') + '::' + model.events.length : '';
  useEffect(() => {
    if (!model) { setRes(null); return; }
    if (runTimerRef.current) clearTimeout(runTimerRef.current);
    runTimerRef.current = setTimeout(() => {
      const pinned = pinnedSeedRef.current;
      pinnedSeedRef.current = null;
      run(pinned != null ? pinned : randSeed());
    }, 240);
    return () => { if (runTimerRef.current) clearTimeout(runTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  useEffect(() => () => stopRaf(), []);

  // The printed report must show every cost breakdown, not just the open ones.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBeforePrint = () => document.querySelectorAll('.sim-rep-det').forEach(d => d.setAttribute('open', ''));
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, []);

  // ---- share / CSV ----
  const shareLink = () => {
    if (typeof window === 'undefined') return;
    let qs = encodeState();
    if (lastSeed != null) qs += (qs ? '&' : '') + 'seed=' + lastSeed;
    const url = window.location.origin + window.location.pathname + (qs ? '?' + qs : '');
    const done = () => { setShareLabel('Link copied'); setTimeout(() => setShareLabel('Copy shareable link'), 1800); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link:', url));
    else window.prompt('Copy this link:', url);
  };

  const dist: McDist | null = res ? ((includeSurprises && res.events) ? res.events : res.base) : null;

  const downloadCsv = () => {
    if (!model || typeof document === 'undefined') return;
    const total = model.contrib.reduce((s, c) => s + c.median, 0) || 1;
    const q = (s: unknown) => { const v = String(s == null ? '' : s); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const rows: (string | number)[][] = [['Project', 'Scope', 'Band low (USD)', 'Band high (USD)', 'Most likely (USD)', 'Share of total']];
    model.contrib.forEach(c => {
      rows.push([c.label + (c.custom ? ' (custom)' : ''), c.spec || '', c.band.low, c.band.high, Math.round(c.median), Math.round(100 * c.median / total) + '%']);
    });
    rows.push([]);
    rows.push(['Total (' + model.count + (model.count === 1 ? ' project)' : ' projects)'), 'naive low-high sum', model.band.low, model.band.high, dist ? Math.round(dist.p50) : '', '100%']);
    if (dist) rows.push(['Simulated', 'P10 / median / P90', Math.round(dist.p10), Math.round(dist.p90), Math.round(dist.p50), '']);
    rows.push(['Notes', regionLabel + ' pricing · ' + TRIALS + ' trials' + (lastSeed != null ? ' · seed ' + lastSeed : '') + ' · surprises ' + (includeSurprises ? 'on' : 'off') + ' · planning ranges, not contractor quotes · electrifycost.com/project-simulator/', '', '', '', '']);
    const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'electrifycost-plan.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { URL.revokeObjectURL(a.href); a.remove(); } catch { /* ignore */ } }, 500);
  };

  // ---- render helpers ----
  const matches = (p: Project) => !query.trim() || p.label.toLowerCase().includes(query.trim().toLowerCase());
  const inPlanCount: Record<string, number> = {};
  instances.forEach(i => { inPlanCount[i.slug] = (inPlanCount[i.slug] || 0) + 1; });
  const contribTotal = model ? (model.contrib.reduce((s, c) => s + c.median, 0) || 1) : 1;
  const contribById: Record<number, ContribRow> = {};
  if (model) model.contrib.forEach(c => { contribById[c.id] = c; });
  const sortedContrib = model ? model.contrib.slice().sort((a, b) => b.median - a.median) : [];
  const dom = model ? domainFor(model.band, includeSurprises) : null;
  const chartHtml = dist && model && dom ? buildChart(dist, model.band, dom, { W: 660, ariaLabel: 'Combined cost probability distribution', midMarker: 'p50' }) : '';
  const counter = running
    ? `simulating ${progress.toLocaleString('en-US')} / ${TRIALS.toLocaleString('en-US')} scenarios`
    : res ? `${TRIALS.toLocaleString('en-US')} scenarios simulated` : '';
  const cushion = dist ? dist.p90 - dist.p50 : 0;
  const metaLine = 'Generated ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    + ' · ' + regionLabel + ' pricing · ' + TRIALS.toLocaleString('en-US') + ' simulations'
    + (lastSeed != null ? ' · seed ' + lastSeed : '')
    + ' · surprise events ' + (includeSurprises ? 'included' : 'off');
  const BRK_LABELS: Record<string, string> = { m: 'Materials', l: 'Labor', e: 'Equipment', p: 'Permits', k: 'Other & adjustments' };

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
          ? (stateCode ? `Pricing for ${stateName} — applied to every preset` : 'Not a recognized US ZIP — using national pricing')
          : 'National average — add a ZIP for local labor pricing'}
      </span>
    </div>

    {/* ============ YOUR PROJECT PLAN (the workspace) ============ */}
    <section className="sim-plan" aria-label="Your project plan">
      <div className="sim-plan-head">
        <h2 className="sim-plan-title">Your project plan {instances.length > 0 && <span className="sim-plan-count">{instances.length}</span>}</h2>
        <div className="sim-plan-actions">
          <button type="button" className="sim-add-btn" aria-expanded={catalogOpen} aria-controls="sim-picker" onClick={() => setCatalogOpen(v => !v)}>
            {catalogOpen ? 'Hide the catalog' : '+ Add projects'}
          </button>
          <button type="button" className="sim-clear" onClick={clearPlan}>Clear plan</button>
        </div>
      </div>
      <p className="sim-plan-status" role="status" aria-live="polite">{status}</p>
      {!instances.length && (
        <p className="sim-plan-empty">Nothing here yet — add projects from the catalog below, start from a quick bundle, or configure one in its calculator first.</p>
      )}
      {instances.length > 0 && (
        <div className="sim-plan-cards">
          {instances.map(inst => {
            const p = PROJECTS[inst.slug];
            const b = instBand(inst);
            const isC = inst.kind === 'custom';
            const c = contribById[inst.id];
            return (
              <div key={inst.id} className={`sim-card${isC ? ' is-custom' : ''}`}>
                <div className="sim-card-top">
                  <span className="sim-card-name">{p.label}</span>
                  <span className={`sim-card-badge${isC ? ' is-custom' : ''}`}>{isC ? 'Custom' : 'Preset'}</span>
                  {isC && inst.locLabel && inst.locLabel !== regionLabel && (
                    <span className="sim-card-loc" title="This custom estimate was priced in its calculator for this region">{inst.locLabel}</span>
                  )}
                  <span className="sim-card-band">{money(b.low)}–{money(b.high)}</span>
                </div>
                {isC && <p className="sim-card-spec">{inst.spec || 'Your configuration'}</p>}
                <div className="sim-card-ctl">
                  <select
                    className="sim-card-scenario" value={isC ? '__custom__' : inst.tier}
                    onChange={e => setInstTier(inst.id, e.target.value)}
                    aria-label={`Scenario for ${p.label}`}
                  >
                    {p.tiers.map(t => <option key={t.name} value={t.name}>{tierOptionLabel(t)}</option>)}
                    {hasCustomCfg(inst) && <option value="__custom__">Custom — {(inst.spec || 'your configuration').slice(0, 46)}</option>}
                  </select>
                  <div className="sim-card-btns">
                    <button type="button" className="sim-card-btn" onClick={() => openCalc(inst.id, inst.slug)} title={`Open the full ${p.label} calculator — your changes apply when you press Done`}>
                      {isC ? 'Edit' : 'Customize'}
                    </button>
                    <button type="button" className="sim-card-btn" onClick={() => duplicateInst(inst.id)}>Duplicate</button>
                    <button type="button" className="sim-card-btn sim-card-rm" onClick={() => removeInst(inst.id)} aria-label={`Remove ${p.label} from your plan`}>Remove</button>
                  </div>
                </div>
                {c && res && (
                  <p className="sim-card-foot">Most likely ≈ {money(c.median)} · {Math.round(100 * c.median / contribTotal)}% of the plan total</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>

    <div className="sim-layout">
      {/* ============ RESULT + REPORT ============ */}
      <section className="sim-result" aria-label="Combined cost estimate">
        <div className="sim-result-inner">
          <div className="sim-print-head" aria-hidden="true"><strong>ElectrifyCost</strong> — Project budget report · electrifycost.com/project-simulator/</div>
          {!model ? (
            <div className="sim-empty">
              <span className="sim-empty-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3 3v18h18" /><path d="M7 14l3-4 3 3 4-6" /></svg>
              </span>
              <p>Add one or more projects to roll the simulation.</p>
            </div>
          ) : (
            <div className="sim-output">
              <div className="sim-selcount">{model.count} {model.count === 1 ? 'project in your plan' : 'projects in your plan'}</div>
              <div className="mc-cards">
                <div className="mc-card"><span className="mc-card-label">Optimistic</span><span className="mc-card-val">{dist ? money(dist.p10) : '—'}</span><span className="mc-card-sub">10% chance under</span></div>
                <div className="mc-card mc-card-mid"><span className="mc-card-label">Most likely</span><span className="mc-card-val">{dist ? money(dist.p50) : '—'}</span><span className="mc-card-sub">median — half of outcomes land under this</span></div>
                <div className="mc-card"><span className="mc-card-label">Safer budget</span><span className="mc-card-val">{dist ? money(dist.p90) : '—'}</span><span className="mc-card-sub">90% chance under</span></div>
              </div>

              <p className="mc-summary">
                {dist ? (
                  <>
                    Across {model.count} {model.count === 1 ? 'project' : 'projects'}, the most-likely (median) combined total is about <b>{money(dist.p50)}</b>.
                    The simulation puts roughly 8 in 10 outcomes between <b>{money(dist.p10)}</b> and <b>{money(dist.p90)}</b> — tighter than the simple
                    {' '}{money(model.band.low)}–{money(model.band.high)} sum, because the projects rarely all land at their extremes at once.
                  </>
                ) : <>Rolling 10,000 combined scenarios…</>}
              </p>
              {dist && cushion > 0 && dist.p50 > 0 && (
                <p className="sim-contingency">Planning cushion: <b>{money(cushion)}</b> (+{Math.round(100 * cushion / dist.p50)}%) between the median and the safer budget.</p>
              )}

              <div className="mc-chart">{dist ? <div dangerouslySetInnerHTML={{ __html: chartHtml }} /> : <div className="mc-chart-empty"><span>Rolling 10,000 scenarios…</span></div>}</div>
              <p className="mc-refnote">{dist ? `Faint lines mark the naive low–high sum (${money(model.band.low)}–${money(model.band.high)}) — the full theoretical spread if everything peaked together.` : ''}</p>

              <div className="sim-contrib">
                <p className="sim-contrib-lbl">What&apos;s driving the total (by most-likely share)</p>
                <div className="sim-cbar">
                  {sortedContrib.map((c, i) => (
                    <span key={c.id} className={`sim-cbar-seg sim-cseg-${i % 6}`} style={{ width: `${(100 * c.median / contribTotal).toFixed(1)}%` }} title={`${c.label} — ${money(c.median)}`} />
                  ))}
                </div>
                <ul className="sim-clegend">
                  {sortedContrib.map((c, i) => (
                    <li key={c.id}><span className={`sim-cdot sim-cseg-${i % 6}`} />{c.label} <b>{money(c.median)}</b></li>
                  ))}
                </ul>
              </div>

              {/* ---- Plan summary (the report) ---- */}
              <div className="sim-report">
                <h2 className="sim-report-title">Plan summary</h2>
                <p className="sim-report-meta">{metaLine}</p>
                <div className="sim-rep-scroll">
                  <table className="sim-report-table">
                    <thead>
                      <tr><th scope="col">Project</th><th scope="col">Scope</th><th scope="col" className="sim-rep-fold">Planning band</th><th scope="col">Most likely</th><th scope="col" className="sim-rep-fold">Share</th></tr>
                    </thead>
                    <tbody>
                      {model.contrib.map(c => (
                        <tr key={c.id}>
                          <td>{c.label}{c.custom && <span className="sim-rep-badge">Custom</span>}</td>
                          <td className="sim-rep-spec">{c.spec || '—'}</td>
                          <td className="sim-rep-num sim-rep-fold">{money(c.band.low)}–{money(c.band.high)}</td>
                          <td className="sim-rep-num">{money(c.median)}</td>
                          <td className="sim-rep-num sim-rep-fold">{Math.round(100 * c.median / contribTotal)}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total · {model.count} {model.count === 1 ? 'project' : 'projects'}</td>
                        <td></td>
                        <td className="sim-rep-num sim-rep-fold">{money(model.band.low)}–{money(model.band.high)}</td>
                        <td className="sim-rep-num">{dist ? money(dist.p50) : '—'}</td>
                        <td className="sim-rep-num sim-rep-fold">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {model.contrib.filter(c => c.custom && c.brk).map(c => (
                  <details key={c.id} className="sim-rep-det">
                    <summary>{c.label} — cost breakdown{c.spec ? ` (${c.spec.slice(0, 60)})` : ''}</summary>
                    <table className="sim-report-table sim-rep-brk"><tbody>
                      {(['m', 'l', 'e', 'p', 'k'] as const).map(k => {
                        const v = c.brk?.[k];
                        if (!v || (v[0] === 0 && v[1] === 0)) return null;
                        return <tr key={k}><td>{BRK_LABELS[k]}</td><td className="sim-rep-num">{money(v[0])}–{money(v[1])}</td></tr>;
                      })}
                    </tbody></table>
                  </details>
                ))}
                <p className="sim-report-note">Planning ranges, not contractor quotes. The simulation states the probability of a cost, not a promised price — it doesn&apos;t replace your contractor, permit, or inspector.</p>
              </div>

              <div className="sim-controls">
                <label className="mc-switch">
                  <input type="checkbox" checked={includeSurprises} onChange={e => setIncludeSurprises(e.target.checked)} />
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
                <button type="button" className="mc-run" onClick={() => run(randSeed())} disabled={running}>{running ? 'Running…' : 'Re-run simulation'}</button>
                <button type="button" className="sim-btn-ghost" onClick={shareLink}>{shareLabel}</button>
                <button type="button" className="sim-btn-ghost" onClick={() => typeof window !== 'undefined' && window.print()}>Save as PDF</button>
                <button type="button" className="sim-btn-ghost" onClick={downloadCsv}>Download CSV</button>
                <span className="mc-counter">{counter}</span>
              </div>

              <p className="mc-method">
                Each project is drawn from a triangular distribution and the projects move together through a shared market factor
                (correlation ≈ 0.5), so the median total and the range <em>emerge</em> from the simulation rather than being the sum
                of the published bands. A planning simulation, not a quote. <a href="/methodology/">How this works</a>.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ============ ADD PROJECTS (catalog) ============ */}
      <section className={`sim-picker${catalogOpen ? '' : ' is-collapsed'}`} id="sim-picker" aria-label="Add projects"
        onClick={() => { if (!catalogOpen) setCatalogOpen(true); }}>
        <div className="sim-picker-head">
          <h2 className="sim-picker-title">Add projects</h2>
          <span className="sim-picker-sub">{ORDER.length} calculators · {CATS.length} categories{catalogOpen ? '' : ' — tap to expand'}</span>
        </div>
        <div className="sim-picker-body">
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
            </div>
          </div>

          <div className="sim-groups">
            {CATS.map(cat => {
              const rows = cat.slugs.filter(s => matches(PROJECTS[s]));
              if (!rows.length) return null;
              return (
                <details key={cat.id} className="sim-group" open>
                  <summary>
                    <span className="sim-group-name">{cat.label}</span>
                    <span className="sim-group-count">{rows.length}</span>
                  </summary>
                  <div className="sim-group-body">
                    {rows.map(slug => {
                      const p = PROJECTS[slug];
                      const b = tierBand(p, typicalTier(p));
                      const n = inPlanCount[slug] || 0;
                      return (
                        <div key={slug} className={`sim-row${n ? ' is-on' : ''}`}>
                          <div className="sim-row-main">
                            <span className="sim-row-name">{p.label}</span>
                            {n > 0 && <span className="sim-row-in">{n > 1 ? `In plan ×${n}` : 'In plan'}</span>}
                          </div>
                          <div className="sim-row-ctl">
                            <span className="sim-row-band">{money(b.low)}–{money(b.high)}</span>
                            <button type="button" className="sim-row-add" onClick={() => addInstance(slug, 'typical')} aria-label={`Add ${p.label} to your plan`}>+ Add</button>
                            {saved[slug] && (
                              <span className="sim-saved-tag" title={(composeSpec(saved[slug]) || 'your saved configuration') + ' — saved when you used this calculator'}>
                                <button type="button" className="sim-row-addsaved" onClick={() => addSavedInstance(slug)}>Add saved setup</button>
                                <button type="button" className="sim-saved-x" onClick={() => removeSaved(slug)} aria-label={`Forget your saved estimate for ${p.label}`}>×</button>
                              </span>
                            )}
                            <a className="sim-row-link" href={p.calcUrl} onClick={e => { e.preventDefault(); openCalc(null, slug); }} title={`Configure the ${p.label} calculator, then add it to your plan`} aria-label={`Open the ${p.label} calculator to configure it, then add it to your plan`}>
                              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </section>
    </div>

    {modal && (
      <div className="sim-modal" role="dialog" aria-modal="true" aria-label={`${PROJECTS[modal.slug].label} calculator`}>
        <div className="sim-modal-backdrop" onClick={closeModal} />
        <div className="sim-modal-panel" ref={modalPanelRef}>
          <div className="sim-modal-head">
            <div className="sim-modal-titlewrap">
              <span className="sim-modal-title">{PROJECTS[modal.slug].label} calculator</span>
              <span className="sim-modal-hint">Adjust the inputs — press Done to apply them to your plan.</span>
            </div>
            <button type="button" className="sim-modal-close" ref={modalCloseRef} onClick={closeModal}>Done</button>
          </div>
          <iframe
            className="sim-modal-frame" title={`${PROJECTS[modal.slug].label} calculator`}
            src={modalSrcRef.current} loading="lazy"
            onLoad={e => {
              // Escape from inside the iframe: its keydown doesn't bubble to the
              // parent document, so attach a listener to the same-origin frame.
              try {
                const doc = (e.currentTarget as HTMLIFrameElement).contentDocument;
                doc?.addEventListener('keydown', (ev: KeyboardEvent) => { if (ev.key === 'Escape') closeModal(); });
              } catch { /* cross-origin or unavailable — Escape from the frame won't fire */ }
            }}
          />
        </div>
      </div>
    )}
    </>
  );
}
