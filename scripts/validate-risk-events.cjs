#!/usr/bin/env node
/**
 * validate-risk-events.cjs
 * Sanity + sourcing guard for src/data/risk-events.json (Monte Carlo "real-world
 * surprise" events). Ported from ProjectCostPro; ElectrifyCost has no separate
 * calculators.json registry, so the orphan-key check is dropped.
 *
 * FAIL (exit 1):
 *   - p is not a number in (0, 1]
 *   - costLow/costHigh not numbers, costLow < 0, or costHigh < costLow
 *   - label missing/empty
 *   - confidence present but not one of low|medium|high
 *   - show_probability present but not a boolean
 * WARN (exit 0):
 *   - sourced:false AND show_probability:true  (an unsourced event still printing an exact percent)
 *   - source === "industry estimate"           (vague, non-primary source - candidate for backfill)
 *   - a shown event (show_probability:true) with no source string
 *
 * Probabilities here are deliberately reasoned planning priors, not measured
 * frequencies, so this guard does NOT require a source for the probability
 * itself - it enforces numeric sanity and the sourced/shown consistency the UI
 * relies on. See risk-events.json _meta.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'src', 'data', 'risk-events.json');

const errors = [];
const warnings = [];
const CONF = ['low', 'medium', 'high'];

let raw;
try {
  raw = fs.readFileSync(FILE, 'utf8');
} catch (e) {
  console.error('ERROR: cannot read ' + FILE + ': ' + e.message);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('ERROR: ' + FILE + ' is not valid JSON: ' + e.message);
  process.exit(1);
}

const isNum = function (v) { return typeof v === 'number' && isFinite(v); };

let eventCount = 0;
let projectCount = 0;

Object.keys(data).forEach(function (key) {
  if (key === '_meta') return;
  projectCount++;
  const events = data[key];
  if (!Array.isArray(events)) {
    errors.push(key + ': value must be an array of events');
    return;
  }
  events.forEach(function (e, i) {
    eventCount++;
    const where = key + '[' + i + ']' + (e && e.label ? ' "' + String(e.label).slice(0, 48) + '"' : '');

    if (!e || typeof e !== 'object') { errors.push(where + ': event is not an object'); return; }
    if (typeof e.label !== 'string' || !e.label.trim()) errors.push(where + ': label missing/empty');
    if (!isNum(e.p) || e.p <= 0 || e.p > 1) errors.push(where + ': p must be a number in (0, 1] (got ' + e.p + ')');
    if (!isNum(e.costLow) || e.costLow < 0) errors.push(where + ': costLow must be a number >= 0 (got ' + e.costLow + ')');
    if (!isNum(e.costHigh)) errors.push(where + ': costHigh must be a number (got ' + e.costHigh + ')');
    else if (isNum(e.costLow) && e.costHigh < e.costLow) errors.push(where + ': costHigh (' + e.costHigh + ') < costLow (' + e.costLow + ')');
    if (e.confidence !== undefined && CONF.indexOf(e.confidence) === -1) errors.push(where + ': confidence must be one of ' + CONF.join('|') + ' (got ' + e.confidence + ')');
    if (e.show_probability !== undefined && typeof e.show_probability !== 'boolean') errors.push(where + ': show_probability must be a boolean (got ' + e.show_probability + ')');

    // Warnings - sourcing hygiene / false-precision guard.
    if (e.sourced === false && e.show_probability === true) warnings.push(where + ': sourced:false but show_probability:true (unsourced event prints an exact percent)');
    if (e.source === 'industry estimate' && e.show_probability === true) warnings.push(where + ': source is the vague "industry estimate" but the percent is shown - backfill a primary source');
    if (e.show_probability === true && (typeof e.source !== 'string' || !e.source.trim())) warnings.push(where + ': shown event has no source string');
  });
});

warnings.forEach(function (w) { console.warn('WARN  ' + w); });
errors.forEach(function (er) { console.error('ERROR ' + er); });
console.log('---');
console.log(eventCount + ' events across ' + projectCount + ' calculators scanned, ' + errors.length + ' error(s), ' + warnings.length + ' warning(s).');

process.exit(errors.length ? 1 : 0);
