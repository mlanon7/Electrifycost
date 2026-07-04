// Validates every CSV in data/csv/:
//   - row width matches header width
//   - source_id (if column present) must resolve to source-notes.json
//   - last_reviewed (if column present) must be ISO YYYY-MM-DD
//   - effective_start / effective_end (if present) must be ISO or blank
//   - status columns must use their explicit enum (the engine routes pricing
//     and rebate eligibility on these values; a typo'd status would silently
//     change what gets subtracted — see calc.ts applied/potential routing)
// Fail fast on any mismatch. Run from npm test chain.

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const csvDir = path.join(root, 'data/csv');
const sourceNotesPath = path.join(root, 'src/data/source-notes.json');

function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i+1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === ',' && !q) { out.push(cur); cur = ''; }
    else { cur += c; }
  }
  out.push(cur);
  return out;
}

const sourceNotes = JSON.parse(fs.readFileSync(sourceNotesPath, 'utf8'));
const knownIds = new Set(Object.keys(sourceNotes));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Explicit status enums per file. Values the runtime actually branches on:
// calc.ts treats reserved/closed as potential-only, skips placeholder, and the
// date filter handles expired; home-energy-rebate-status gates HEEHRA by
// open/prelaunch/reserved/closed. Anything outside these lists is a data bug.
const STATUS_ENUMS = {
  'rebate-programs.csv': new Set(['active', 'expired', 'reserved', 'closed', 'placeholder', 'state_rolling_out', 'utility_specific']),
  'federal-credits.csv': new Set(['active', 'expired']),
  'home-energy-rebate-status.csv': new Set(['open', 'prelaunch', 'reserved', 'closed', 'unknown']),
};

let errs = 0;
const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv')).sort();
for (const file of files) {
  const text = fs.readFileSync(path.join(csvDir, file), 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (!lines.length) continue;
  const headers = splitCsvLine(lines[0]).map(s => s.trim());
  const statusEnum = STATUS_ENUMS[file] || null;
  const statusCol = statusEnum ? headers.indexOf('status') : -1;
  const sourceIdCol = headers.indexOf('source_id');
  const reviewCol = headers.indexOf('last_reviewed');
  const effStartCol = headers.indexOf('effective_start');
  const effEndCol = headers.indexOf('effective_end');
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length !== headers.length) {
      console.error('  WIDTH  ' + file + ':' + (i+1) + ' got ' + cells.length + ' cells vs ' + headers.length + ' headers');
      errs++;
    }
    if (sourceIdCol >= 0) {
      const id = (cells[sourceIdCol] || '').trim();
      if (id && !knownIds.has(id)) {
        console.error('  SOURCE ' + file + ':' + (i+1) + ' source_id "' + id + '" not in source-notes.json');
        errs++;
      }
    }
    if (statusCol >= 0) {
      const s = (cells[statusCol] || '').trim();
      if (s && !statusEnum.has(s)) {
        console.error('  STATUS ' + file + ':' + (i+1) + ' status "' + s + '" not in the explicit enum [' + [...statusEnum].join(', ') + ']');
        errs++;
      }
    }
    if (reviewCol >= 0) {
      const d = (cells[reviewCol] || '').trim();
      if (d && !ISO_DATE.test(d)) {
        console.error('  DATE   ' + file + ':' + (i+1) + ' last_reviewed "' + d + '" not ISO YYYY-MM-DD');
        errs++;
      }
    }
    if (effStartCol >= 0) {
      const d = (cells[effStartCol] || '').trim();
      if (d && !ISO_DATE.test(d)) {
        console.error('  DATE   ' + file + ':' + (i+1) + ' effective_start "' + d + '" not ISO');
        errs++;
      }
    }
    if (effEndCol >= 0) {
      const d = (cells[effEndCol] || '').trim();
      if (d && !ISO_DATE.test(d)) {
        console.error('  DATE   ' + file + ':' + (i+1) + ' effective_end "' + d + '" not ISO');
        errs++;
      }
    }
  }
}

if (errs === 0) {
  console.log('OK: validated ' + files.length + ' CSV files');
  process.exit(0);
}
console.error('FAILED: ' + errs + ' CSV issue(s)');
process.exit(1);
