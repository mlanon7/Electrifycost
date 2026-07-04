/*
 * sim-codec.ts — the Project Simulator's pure state codec.
 *
 * Ported nearly verbatim from ProjectCostPro's scenario-sim.js SimCodec
 * (commit 157d935): base64url JSON per custom instance so a share link
 * reproduces the whole plan — including custom-configured projects — on a
 * clean browser with no localStorage. Decoding FAILS CLOSED, VISIBLY: an
 * unknown scenario name, an unreadable custom blob, or a saved-in-another-
 * browser token falls back to the Typical preset WITH a notice — never
 * silently to another preset.
 *
 * Deliberately dependency-free (no imports) so scripts/test-sim-state.cjs can
 * transpile and exercise it under plain Node. Keep it that way.
 */

export interface SimBand { low: number; high: number }
export type SimBrk = Partial<Record<'m' | 'l' | 'e' | 'p' | 'k', [number, number]>>;

export interface PresetInstance { slug: string; kind: 'preset'; tier: string }
export interface CustomInstance {
  slug: string; kind: 'custom';
  band: SimBand;
  spec: string;
  qs: string;
  locLabel: string;
  brk: SimBrk | null;
}
export type SimInstance = PresetInstance | CustomInstance;

/** The shape of a persisted calculator estimate (ec:est:<slug>) the codec
 *  needs. v2 snapshots carry all fields; legacy v1 entries only low/high. */
export interface SnapLike {
  low: number; high: number;
  sub?: string; qs?: string; loc?: string;
  attrs?: [string, string][] | null;
  brk?: SimBrk | null;
}

export interface DecodeCtx {
  hasProject(slug: string): boolean;
  tierNames(slug: string): string[];
  savedSnap?(slug: string): SnapLike | null;
}

export interface DecodeResult { instances: SimInstance[]; notices: string[] }

declare const Buffer: { from(s: string, enc: string): { toString(enc: string): string } } | undefined;

export function b64uEnc(s: string): string {
  let b: string;
  if (typeof btoa === 'function') b = btoa(unescape(encodeURIComponent(s)));
  else b = (Buffer as NonNullable<typeof Buffer>).from(s, 'utf8').toString('base64');
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDec(s: string): string {
  let b = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(b)));
  return (Buffer as NonNullable<typeof Buffer>).from(b, 'base64').toString('utf8');
}

/** The qs string is replayed into a calculator URL — restrict it to the
 *  charset URLSearchParams.toString() emits so it can never break out. */
export function sanitizeQs(q: unknown): string {
  const s = String(q || '').slice(0, 400);
  return /^[\w.%~=&+*-]*$/.test(s) ? s : '';
}

export function cleanBrk(b: unknown): SimBrk | null {
  if (!b || typeof b !== 'object') return null;
  const keys: ('m' | 'l' | 'e' | 'p' | 'k')[] = ['m', 'l', 'e', 'p', 'k'];
  const out: SimBrk = {};
  let ok = false;
  for (const k of keys) {
    const v = (b as Record<string, unknown>)[k];
    if (Array.isArray(v) && v.length === 2 && isFinite(+v[0]) && isFinite(+v[1])) {
      out[k] = [Math.round(+v[0]), Math.round(+v[1])];
      ok = true;
    }
  }
  return ok ? out : null;
}

/** Human spec line from an estimate snapshot: select choices first (material,
 *  system type), then the calculator's own scope sentence (sizes, extras).
 *  Boolean-style options ("Yes - include stairs") are dropped — the scope
 *  sentence already carries that information. */
export function composeSpec(snap: { attrs?: [string, string][] | null; sub?: string }): string {
  const parts: string[] = [];
  (snap.attrs || []).forEach(a => {
    if (!a || !a[1] || parts.length >= 3) return;
    let v = String(a[1]).replace(/\s*\(.*?\)\s*$/, '').trim();
    if (!v || /^(yes|no)\b|^(include|exclude|skip|none|standard)\b/i.test(v)) return;
    const lbl = String(a[0] || '').replace(/\s*(type|options?|selection)\s*$/i, '').trim();
    // Disambiguate short generic values ("Composite" -> "Composite railing"),
    // but never for material labels — the material name stands alone.
    if (v.length <= 14 && lbl && lbl.length <= 12 && !/material/i.test(a[0] || '')
      && v.toLowerCase().indexOf(lbl.toLowerCase()) === -1) v += ' ' + lbl.toLowerCase();
    parts.push(v);
  });
  if (snap.sub) parts.push(String(snap.sub));
  return parts.filter(Boolean).join(' · ').slice(0, 160);
}

/** instances -> the `p=` value (NOT yet URI-encoded). */
export function encodeInstances(instances: SimInstance[]): string {
  return (instances || []).map(inst => {
    if (inst.kind === 'custom' && inst.band) {
      const payload: Record<string, unknown> = {
        l: inst.band.low, h: inst.band.high,
        s: inst.spec || '', q: inst.qs || '', g: inst.locLabel || '',
      };
      if (inst.brk) payload.b = inst.brk;
      return inst.slug + ':c:' + b64uEnc(JSON.stringify(payload));
    }
    return inst.slug + ':' + ((inst as PresetInstance).tier || 'typical');
  }).join(',');
}

/**
 * `p=` value -> { instances, notices }.
 * Understands: slug:tier · slug:tier:qty (legacy, expands) · slug:saved:qty
 * (legacy — local snapshot or fail-closed Typical) · slug:c:<b64url> (custom).
 */
export function decodeParam(pStr: string | null | undefined, ctx: DecodeCtx): DecodeResult {
  const out: DecodeResult = { instances: [], notices: [] };
  if (!pStr) return out;
  String(pStr).split(',').slice(0, 40).forEach(tok => {
    if (!tok) return;
    const bits = tok.split(':');
    const slug = bits[0];
    if (!ctx.hasProject(slug)) { out.notices.push('A project in this link no longer exists and was skipped.'); return; }
    if (bits[1] === 'c' && bits[2]) {
      try {
        const o = JSON.parse(b64uDec(bits[2]));
        const low = Math.round(+o.l), high = Math.round(+o.h);
        if (!(isFinite(low) && isFinite(high) && low > 0 && high > low && high < 5e7)) throw new Error('band');
        out.instances.push({
          slug, kind: 'custom',
          band: { low, high },
          spec: String(o.s || '').slice(0, 160),
          qs: sanitizeQs(o.q),
          locLabel: String(o.g || '').slice(0, 60),
          brk: cleanBrk(o.b),
        });
      } catch {
        out.notices.push('A custom configuration in this link could not be read — that project was set to Typical.');
        out.instances.push({ slug, kind: 'preset', tier: 'typical' });
      }
      return;
    }
    let tier = bits[1] || 'typical';
    const qty = Math.max(1, Math.min(9, parseInt(bits[2], 10) || 1));
    if (tier === 'saved') {
      const snap = ctx.savedSnap ? ctx.savedSnap(slug) : null;
      if (snap) {
        for (let i = 0; i < qty; i++) out.instances.push({
          slug, kind: 'custom',
          band: { low: snap.low, high: snap.high },
          spec: composeSpec(snap),
          qs: sanitizeQs(snap.qs),
          locLabel: String(snap.loc || '').slice(0, 60),
          brk: cleanBrk(snap.brk),
        });
        return;
      }
      out.notices.push('This link used a custom setup saved in another browser — that project was set to Typical.');
      tier = 'typical';
    }
    if (ctx.tierNames(slug).indexOf(tier) === -1) {
      out.notices.push('An unrecognized scenario in this link was set to Typical.');
      tier = 'typical';
    }
    for (let j = 0; j < qty; j++) out.instances.push({ slug, kind: 'preset', tier });
  });
  return out;
}
