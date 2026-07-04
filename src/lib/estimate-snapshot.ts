/*
 * estimate-snapshot.ts — the calculator → Project Simulator snapshot contract.
 *
 * Every catalog calculator publishes a structured estimate snapshot to
 * localStorage (`ec:est:<slug>`) so the simulator can offer it back as a
 * "Custom" instance — band, human spec, the share-param string that reproduces
 * the exact inputs, the labeled select choices, the category cost breakdown,
 * and the resolved pricing region. Ported from ProjectCostPro's boot.js v2
 * snapshot (commit 157d935).
 *
 * Two rules that came from real bugs (do not relax):
 *  1. GATE ON GENUINE INTERACTION. Only a trusted event (pointerdown/keydown/
 *     input/change with Event.isTrusted) arms the touch flag; hash-restore and
 *     ZIP prefill are programmatic and never do. Without this, opening a
 *     shared link created phantom "Custom" entries in the simulator.
 *  2. Second guard: the snapshot is only written once the inputs actually
 *     differ from the first render. Merely viewing a calculator never creates
 *     a saved config.
 *
 * `window.__EC_TOUCH()` is a deliberate test seam: automation can arm the same
 * flag a real tap would (synthetic events can't). It writes nothing itself.
 */

import { useEffect, useRef } from 'react';

export type SnapshotBrk = Partial<Record<'m' | 'l' | 'e' | 'p' | 'k', [number, number]>>;

export interface EstimateSnapshot {
  v: 2;
  /** Gross installed band, rounded to whole dollars. */
  low: number;
  high: number;
  /** The calculator's own scope sentence ("1,800 sqft · single-family"). */
  sub: string;
  /** Share-param string (URL-hash form) that reproduces these exact inputs. */
  qs: string;
  /** Labeled SELECT choices (equipment/system/finish) for the spec line. */
  attrs: [string, string][];
  /** Category cost breakdown: m=materials/equipment cost, l=labor,
   *  e=equipment rental, p=permits, k=adjustments & add-ons. [low, high]. */
  brk: SnapshotBrk;
  /** Resolved pricing-region label ("New Jersey"). */
  loc: string;
  mode: 'installed';
  ts: number;
  int: true;
}

let touched = false;
let armed = false;

declare global {
  interface Window { __EC_TOUCH?: () => void }
}

function armTouchTracking(): void {
  if (armed || typeof document === 'undefined') return;
  armed = true;
  const mark = (e: Event) => { if (e.isTrusted) touched = true; };
  document.addEventListener('pointerdown', mark, true);
  document.addEventListener('keydown', mark, true);
  document.addEventListener('input', mark, true);
  document.addEventListener('change', mark, true);
  window.__EC_TOUCH = () => { touched = true; };
}

/** Storage key for a calculator's published estimate. */
export function estimateKey(slug: string): string { return 'ec:est:' + slug; }

/** Fold a flagship CalculatorResult's itemized lines into the snapshot's
 *  category breakdown: Equipment → m, Labor → l, Permit* → p, everything else
 *  (complexity adjustment, add-ons, penalties) → k. */
export function brkFromItemized(items: { label: string; amount: { low: number; high: number } }[]): SnapshotBrk {
  const acc: Record<'m' | 'l' | 'p' | 'k', [number, number]> = { m: [0, 0], l: [0, 0], p: [0, 0], k: [0, 0] };
  for (const it of items || []) {
    const key = it.label === 'Equipment' ? 'm' : it.label === 'Labor' ? 'l' : /^permit/i.test(it.label) ? 'p' : 'k';
    acc[key][0] += it.amount.low;
    acc[key][1] += it.amount.high;
  }
  const out: SnapshotBrk = {};
  (['m', 'l', 'p', 'k'] as const).forEach(k => {
    if (acc[k][1] > 0) out[k] = [Math.round(acc[k][0]), Math.round(acc[k][1])];
  });
  return out;
}

/** Read + validate a published snapshot. Accepts v2 snapshots and tolerates
 *  legacy v1 entries ({low, high, ts, int}) so pre-upgrade saves still work. */
export function readEstimateSnapshot(slug: string): (Partial<EstimateSnapshot> & { low: number; high: number; ts?: number }) | null {
  try {
    const raw = localStorage.getItem(estimateKey(slug));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && o.int === true && typeof o.low === 'number' && typeof o.high === 'number' && o.high > o.low && o.low > 0) return o;
  } catch { /* localStorage unavailable or corrupt entry */ }
  return null;
}

/**
 * Publish the calculator's current estimate as a snapshot once the user has
 * genuinely interacted AND the inputs moved off their first-render values.
 * Call once per calculator with a `make` that assembles the snapshot from the
 * live result; pass null while the result is invalid.
 */
export function usePublishEstimate(slug: string, make: () => EstimateSnapshot | null): void {
  const firstSigRef = useRef<string | null>(null);

  useEffect(() => { armTouchTracking(); }, []);

  useEffect(() => {
    const snap = make();
    if (!snap) return;
    const sig = snap.qs + '|' + snap.low + '|' + snap.high;
    // First valid render (defaults, or a hash-restored share link) sets the
    // baseline and never writes.
    if (firstSigRef.current === null) { firstSigRef.current = sig; return; }
    if (!touched || sig === firstSigRef.current) return;
    try {
      localStorage.setItem(estimateKey(slug), JSON.stringify(snap));
    } catch { /* localStorage unavailable */ }
  });
}
