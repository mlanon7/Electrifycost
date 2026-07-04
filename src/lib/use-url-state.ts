// Tiny helper for serializing a calculator's input state into the URL hash
// so refresh / share / browser-back preserves the result. Pattern from the
// 2026-05-13 UX refinement audit (§1.2 — "Share this estimate"). Keys are
// short and the encoding is intentionally human-readable so a shared link
// like #state=NJ&tons=3&panel=200 is legible in chat.
//
// SSR-safe: the hash is only ever read inside a useEffect (i.e. on the
// client). The hook accepts a `parse` function that converts the
// `Record<string, string>` from the hash into the calculator's state shape,
// and a `serialize` function that goes the other way.

import { useEffect, useRef } from 'react';

/** Read a `key=value&key=value` URL hash into an object. Returns `{}` when
 *  there's no hash, when we're on the server, or when parsing fails. */
export function readHashState(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return {};
  try {
    const params = new URLSearchParams(raw);
    const out: Record<string, string> = {};
    params.forEach((v, k) => { out[k] = v; });
    return out;
  } catch {
    return {};
  }
}

/** Serialize a flat key/value object to the `key=value&key=value` string used
 *  in the URL hash. Strips empty / undefined values so the hash stays short.
 *  Also the `qs` field of estimate snapshots — one serializer guarantees a
 *  snapshot's qs always matches what the shared URL would carry. */
export function serializeHashState(values: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    params.set(k, s);
  }
  return params.toString();
}

/** Write a flat key/value object back to the URL hash with `replaceState`
 *  (no history push). Pass `{}` to clear the hash. */
export function writeHashState(values: Record<string, string | number | undefined | null>): void {
  if (typeof window === 'undefined') return;
  const next = serializeHashState(values);
  const url = next
    ? `${window.location.pathname}${window.location.search}#${next}`
    : `${window.location.pathname}${window.location.search}`;
  // Use replaceState to avoid polluting browser history with every input change.
  window.history.replaceState(null, '', url);
}

/** React hook: keep the URL hash in sync with the given state object.
 *  Skips the first render so SSR snapshots stay clean. */
export function useHashStateSync(values: Record<string, string | number | undefined | null>): void {
  const ready = useRef(false);
  useEffect(() => {
    if (!ready.current) {
      ready.current = true;
      return;
    }
    writeHashState(values);
  // We re-run whenever any value changes; JSON.stringify gives us a cheap
  // dependency token for an arbitrary-shaped object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);
}

/** React hook: read the hash on mount and apply via the supplied setter.
 *  Pass it once per calculator with a small `apply` callback that maps
 *  the raw hash dict to your component's setState calls. */
export function useHashStateInit(apply: (hash: Record<string, string>) => void): void {
  useEffect(() => {
    const h = readHashState();
    if (Object.keys(h).length > 0) {
      apply(h);
    }
  // Run once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
