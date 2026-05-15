// Smoke test for the calculator engine. Mirrors src/lib/calc.ts in plain Node.
// Cases live in smoke-cases.json so we never have to inline long arrays.
//
// All numeric/tabular data lives in /data/csv at the project root so a
// non-engineer can edit it in a spreadsheet. The runtime calculator (Astro
// + Vite) reads the same files via ?raw imports — see src/lib/data.ts.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map(s => s.trim());
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => row[h] = (cells[i] || '').trim());
    return row;
  });
}
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

const numericFields = new Set([
  'base_low','base_mid','base_high',
  'material_low','material_mid','material_high',
  'labor_hours_low','labor_hours_mid','labor_hours_high',
  'permit_low','permit_mid','permit_high',
  'electrician_multiplier','hvac_multiplier','plumber_multiplier','permit_avg',
  'electricity_cents_per_kwh','natural_gas_dollars_per_therm',
  'propane_dollars_per_gallon','heating_oil_dollars_per_gallon',
  'amount_low','amount_mid','amount_high','percent','cap',
  'heating_degree_days','cooling_degree_days',
  'low','mid','high','hourly_rate_usd',
  'factor','low_spread','high_spread','value',
]);
const coerce = rows => rows.map(r => {
  const o = {};
  for (const k of Object.keys(r)) {
    if (numericFields.has(k)) {
      const n = parseFloat(r[k]);
      o[k] = Number.isFinite(n) ? n : 0;
    } else { o[k] = r[k]; }
  }
  return o;
});

const costRanges  = coerce(parseCsv(read('data/csv/project-cost-ranges.csv')));
const stateLabor  = coerce(parseCsv(read('data/csv/state-labor-multipliers.csv')));
const stateEnergy = coerce(parseCsv(read('data/csv/state-energy-prices.csv')));
const rebates     = coerce(parseCsv(read('data/csv/rebate-programs.csv')));
const climates    = coerce(parseCsv(read('data/csv/climate-zones.csv')));
const panelRules  = coerce(parseCsv(read('data/csv/panel-upgrade-risk-rules.csv')));
const costMul     = coerce(parseCsv(read('data/csv/cost-multipliers.csv')));
const moduleRates = coerce(parseCsv(read('data/csv/module-labor-rates.csv')));
const panelFac    = coerce(parseCsv(read('data/csv/panel-risk-factors.csv')));
const opConst     = coerce(parseCsv(read('data/csv/operating-cost-constants.csv')));
const heehraSt    = coerce(parseCsv(read('data/csv/home-energy-rebate-status.csv')));

const failures = [];
function require1(rows, name) {
  if (!rows || rows.length === 0) failures.push('CSV table ' + name + ' has zero rows');
}
require1(costRanges, 'project-cost-ranges');
require1(stateLabor, 'state-labor-multipliers');
require1(stateEnergy, 'state-energy-prices');
require1(rebates, 'rebate-programs');
require1(climates, 'climate-zones');
require1(panelRules, 'panel-upgrade-risk-rules');
require1(costMul, 'cost-multipliers');
require1(moduleRates, 'module-labor-rates');
require1(panelFac, 'panel-risk-factors');
require1(opConst, 'operating-cost-constants');
require1(heehraSt, 'home-energy-rebate-status');

function findMul(t, k) {
  const r = costMul.find(r => r.factor_type === t && r.factor_key === k);
  if (!r) throw new Error('cost-multipliers missing ' + t + '/' + k);
  return [r.low, r.mid, r.high];
}
function findRate(m) {
  const r = moduleRates.find(r => r.module === m);
  if (!r) throw new Error('module-labor-rates missing ' + m);
  return r.hourly_rate_usd;
}
function findFac(level) {
  const r = panelFac.find(r => r.risk_level === level);
  if (!r) throw new Error('panel-risk-factors missing ' + level);
  return r;
}
function findConst(id) {
  const r = opConst.find(r => r.constant_id === id);
  if (!r) throw new Error('operating-cost-constants missing ' + id);
  return r.value;
}
function findHeehra(state) {
  return heehraSt.find(r => r.state === state);
}

function isExpired(expirationDate, today) {
  if (!expirationDate) return false;
  if (expirationDate === 'unspecified' || expirationDate === 'none') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)) return false;
  return expirationDate < today;
}

const findStateLabor  = s => stateLabor.find(r => r.state === s);
const findStateEnergy = s => stateEnergy.find(r => r.state === s);
const findClimate     = s => climates.find(r => r.state === s);
const findScenario    = (m, sc) => costRanges.find(r => r.module === m && r.scenario === sc);

function laborMul(state, module) {
  const sl = findStateLabor(state); if (!sl) return 1;
  if (module === 'heat_pump') return sl.hvac_multiplier;
  if (module === 'hpwh') return (sl.hvac_multiplier + sl.plumber_multiplier) / 2;
  return sl.electrician_multiplier;
}
const laborRate = findRate;
const diff = d => findMul('difficulty', d || 'average');
const home = t => findMul('home_type', t || 'single_family');

function multiplyBand(b, m) { return [b[0]*m[0], b[1]*m[1], b[2]*m[2]]; }
function addBand(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function subtractBand(a, b) {
  return [Math.max(0, a[0]-b[2]), Math.max(0, a[1]-b[1]), Math.max(0, a[2]-b[0])];
}
function round25(b) { return b.map(n => Math.round(n/25)*25); }

function applyRebate(p, gross, income) {
  if (p.income_rule === 'income_qualified' &&
      (income === 'unknown' || income === 'standard')) return [0, 0, 0];
  if (p.percent && p.percent > 0) {
    const cap = p.cap || Infinity;
    const pct = p.percent / 100;
    return [
      Math.min(gross[0]*pct, cap),
      Math.min(gross[1]*pct, cap),
      Math.min(gross[2]*pct, cap),
    ];
  }
  return [p.amount_low, p.amount_mid, p.amount_high];
}

function compute(input) {
  const today = input.asOf || new Date().toISOString().slice(0, 10);
  const sc = findScenario(input.module, input.scenario);
  if (!sc) throw new Error('no scenario');
  const lm = laborMul(input.state, input.module);
  const rate = laborRate(input.module);
  const labor = [
    sc.labor_hours_low * rate * lm,
    sc.labor_hours_mid * rate * lm,
    sc.labor_hours_high * rate * lm,
  ];
  const material = [sc.material_low, sc.material_mid, sc.material_high];
  const permit = [sc.permit_low, sc.permit_mid, sc.permit_high];

  let gross = addBand(addBand(material, labor), permit);
  gross = multiplyBand(gross, diff(input.difficulty));
  gross = multiplyBand(gross, home(input.homeType));

  let panelLevel = null;
  const risk = panelRules.find(r =>
    r.trigger_module === input.module && r.current_panel === input.panel);
  if (risk && (risk.risk_level === 'medium' || risk.risk_level === 'high' ||
               risk.risk_level === 'critical')) {
    panelLevel = risk.risk_level;
    const ps = findScenario('panel',
      input.panel === '150A' ? 'upgrade_150_to_200' : 'upgrade_100_to_200');
    if (ps) {
      const pl = laborMul(input.state, 'panel');
      const pH = findRate('panel');
      const pBand = addBand(
        [ps.material_low, ps.material_mid, ps.material_high],
        addBand(
          [ps.labor_hours_low*pH*pl, ps.labor_hours_mid*pH*pl, ps.labor_hours_high*pH*pl],
          [ps.permit_low, ps.permit_mid, ps.permit_high]));
      const fr = findFac(risk.risk_level);
      gross = addBand(gross, [pBand[0]*fr.factor*fr.low_spread, pBand[1]*fr.factor, pBand[2]*fr.factor*fr.high_spread]);
    }
  }
  gross = round25(gross);

  const censusTract = input.censusTract || 'unknown';
  const programs = rebates.filter(r =>
    (r.module === input.module || r.module === '') &&
    (r.scope === 'federal' || r.state === input.state || r.state === 'US'));

  const applied = [];
  const potential = [];

  for (const p of programs) {
    if (p.status === 'placeholder') continue;
    if (isExpired(p.expiration_date, today)) continue;
    if (p.program_id === 'FED_30C_EVSE' && censusTract === 'no') continue;

    const a = applyRebate(p, gross, input.income);
    if (a[0]===0 && a[1]===0 && a[2]===0) continue;

    if (p.program_id === 'FED_30C_EVSE' && censusTract === 'unknown') {
      potential.push({ name: p.program_name, amount: a, programId: p.program_id });
      continue;
    }
    if (p.program_id.startsWith('DOE_HOMES')) {
      const heehra = findHeehra(input.state);
      if (!heehra || heehra.status !== 'open') {
        potential.push({ name: p.program_name, amount: a, programId: p.program_id });
        continue;
      }
    }
    applied.push({ name: p.program_name, amount: a, programId: p.program_id });
  }

  let totalRebate = [0, 0, 0];
  for (const i of applied) totalRebate = addBand(totalRebate, i.amount);
  const net = round25(subtractBand(gross, totalRebate));

  let monthlyImpact = null, monthlyBand = null, direction = null;
  if (input.module === 'heat_pump') {
    const e = findStateEnergy(input.state);
    const c = findClimate(input.state);
    if (e && c) {
      const elec = e.electricity_cents_per_kwh / 100;
      const ua = (input.sqft || 1800) * findConst('hp_ua_per_sqft');
      const heatingBtu = c.heating_degree_days * 24 * ua;
      const heatingKwh = heatingBtu / findConst('hp_btu_per_kwh');
      const cop = c.heat_pump_class === 'coldclimate'
        ? findConst('hp_cop_coldclimate') : findConst('hp_cop_standard');
      const newElec = (heatingKwh / cop) * elec;
      const oC = findConst('hp_oversize_factor_combustion');
      const oO = findConst('hp_oversize_factor_oil');
      let oldFuel = 0;
      if (input.fuelHeating === 'natural_gas')
        oldFuel = (heatingBtu * oC) / findConst('hp_btu_per_therm') * e.natural_gas_dollars_per_therm;
      else if (input.fuelHeating === 'propane')
        oldFuel = (heatingBtu * oC) / findConst('hp_btu_per_gallon_propane') * e.propane_dollars_per_gallon;
      else if (input.fuelHeating === 'oil')
        oldFuel = (heatingBtu * oO) / findConst('hp_btu_per_gallon_oil') * e.heating_oil_dollars_per_gallon;
      else if (input.fuelHeating === 'electric_resistance')
        oldFuel = heatingKwh * elec;
      const change = newElec - oldFuel;
      const sp = Math.max(Math.abs(change) * findConst('spread_default_frac'), findConst('spread_floor_heat_pump'));
      const annualBand = [change - sp, change, change + sp];
      monthlyBand = annualBand.map(v => v / 12);
      monthlyImpact = monthlyBand[1];
      const straddles = annualBand[0] < 0 && annualBand[2] > 0;
      direction = (Math.abs(change) < findConst('neutral_threshold_usd_per_year') && straddles) ? 'neutral'
                : change < 0 ? 'savings' : 'increase';
    }
  }
  return { gross, net, applied, potential, monthlyImpact, monthlyBand, direction, panelLevel };
}

function fmt(n) { return '$' + Math.round(n).toLocaleString(); }
function fmtBand(b) { return fmt(b[0]) + ' / ' + fmt(b[1]) + ' / ' + fmt(b[2]); }

const rawCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'smoke-cases.json'), 'utf8'));
const cases = rawCases.map(c => ({
  label: c[0],
  args: {
    module: c[1], scenario: c[2], state: c[3], panel: c[4],
    difficulty: c[5], homeType: c[6], income: c[7],
    fuelHeating: c[8] || undefined, sqft: c[9] || undefined,
    censusTract: c[10] || undefined,
    asOf: c[11] || undefined,
  },
}));

let assertionFailures = 0;
function assertOrdered(label, b) {
  if (!(b[0] <= b[1] && b[1] <= b[2])) {
    console.error('  ASSERTION FAILURE: ' + label + ' band not low<=mid<=high: ' + b.join(' / '));
    assertionFailures++;
  }
}
function assertContainsProgram(label, lines, idSubstring, present) {
  const has = lines.some(l => l.programId.startsWith(idSubstring));
  if (has !== present) {
    console.error('  ASSERTION FAILURE: ' + label + (present ? ' missing ' : ' unexpectedly contains ') + idSubstring);
    assertionFailures++;
  }
}

for (const c of cases) {
  let r;
  try { r = compute(c.args); }
  catch (err) {
    console.error('* ' + c.label + ' THREW: ' + (err && err.message ? err.message : err));
    assertionFailures++;
    continue;
  }
  console.log('* ' + c.label);
  assertOrdered('gross', r.gross);
  assertOrdered('net', r.net);
  // Default-today path: no 25C credit should appear in applied OR potential.
  if (!c.args.asOf) {
    assertContainsProgram(c.label, [...r.applied, ...r.potential], 'FED_25C', false);
  }
  console.log('  gross: ' + fmtBand(r.gross));
  console.log('  net:   ' + fmtBand(r.net));
  if (r.panelLevel) console.log('  panel risk: ' + r.panelLevel);
  if (r.monthlyImpact !== null) {
    const sign = r.monthlyImpact < 0 ? '-' : '+';
    console.log('  monthly impact: ' + sign + fmt(Math.abs(r.monthlyImpact)) + '/mo (' + r.direction + ')');
    if (r.monthlyBand) {
      console.log('    band: ' + r.monthlyBand.map(v => (v < 0 ? '-' : '+') + fmt(Math.abs(v))).join(' / '));
    }
  }
  if (r.applied.length) {
    console.log('  applied: ' + r.applied.map(i => i.name + ' (-' + fmt(i.amount[1]) + ')').join('; '));
  }
  if (r.potential.length) {
    console.log('  potential (not subtracted): ' + r.potential.map(i => i.name + ' (potential -' + fmt(i.amount[1]) + ')').join('; '));
  }
  console.log('');
}

// =====================================================================
// New v3 targeted assertions: 30C unknown/yes/no, HEEHRA open/prelaunch
// =====================================================================
console.log('--- v3 targeted assertions ---');

function run(label, args, checks) {
  let r;
  try { r = compute(args); } catch (e) {
    console.error('  FAIL ' + label + ' threw: ' + e.message);
    assertionFailures++;
    return;
  }
  console.log('  ' + label);
  for (const [name, predicate, why] of checks) {
    if (!predicate(r)) {
      console.error('    FAIL ' + name + ': ' + why);
      assertionFailures++;
    } else {
      console.log('    OK   ' + name);
    }
  }
}

const evBase = {
  module: 'ev_charger', scenario: 'level2_hardwired', state: 'CA',
  panel: '200A', difficulty: 'average', homeType: 'single_family', income: 'unknown',
};

run('30C unknown → potential only', { ...evBase, censusTract: 'unknown' }, [
  ['30C not in applied', r => !r.applied.some(i => i.programId === 'FED_30C_EVSE'),
   '30C was in applied (it should be potential when census-tract is unknown)'],
  ['30C in potential', r => r.potential.some(i => i.programId === 'FED_30C_EVSE'),
   '30C missing from potential'],
]);

run('30C yes → applied', { ...evBase, censusTract: 'yes' }, [
  ['30C in applied', r => r.applied.some(i => i.programId === 'FED_30C_EVSE'),
   '30C missing from applied when confirmed eligible'],
  ['30C not in potential', r => !r.potential.some(i => i.programId === 'FED_30C_EVSE'),
   '30C unexpectedly in potential'],
]);

run('30C no → excluded entirely', { ...evBase, censusTract: 'no' }, [
  ['30C not in applied', r => !r.applied.some(i => i.programId === 'FED_30C_EVSE'),
   '30C in applied despite census-tract=no'],
  ['30C not in potential', r => !r.potential.some(i => i.programId === 'FED_30C_EVSE'),
   '30C in potential despite census-tract=no'],
]);

const heehraBase = {
  module: 'heat_pump', scenario: 'ducted_central_3ton',
  panel: '100A', difficulty: 'average', homeType: 'single_family',
  income: 'low_income', fuelHeating: 'natural_gas', sqft: 1800,
};

run('HEEHRA in prelaunch state (TX) → potential only', { ...heehraBase, state: 'TX' }, [
  ['DOE_HOMES not in applied', r => !r.applied.some(i => i.programId.startsWith('DOE_HOMES')),
   'DOE_HOMES applied despite TX status=prelaunch'],
  ['DOE_HOMES in potential', r => r.potential.some(i => i.programId.startsWith('DOE_HOMES')),
   'DOE_HOMES missing from potential'],
]);

run('HEEHRA in open state (NY) → applied', { ...heehraBase, state: 'NY' }, [
  ['DOE_HOMES in applied', r => r.applied.some(i => i.programId.startsWith('DOE_HOMES')),
   'DOE_HOMES missing from applied in NY (status=open)'],
]);

// Pass 3 audit §1.4: panel CA-difficult must stay within industry $7.5K cap.
// Previously the labor_hours_high=18 compounded with state×difficulty×home×timing
// multipliers and rendered ~$8,700 high for CA difficult — well above the $7,350
// industry hard-cap. Labor hours rebased to 7/10/14 in project-cost-ranges.csv.
run('Panel CA difficult stays in industry cap', {
  module: 'panel', scenario: 'upgrade_100_to_200', state: 'CA',
  panel: '100A', difficulty: 'difficult', homeType: 'single_family', income: 'unknown',
}, [
  ['Panel CA difficult high ≤ $8,000', r => r.gross[2] <= 8000,
   'Panel CA difficult high band exceeds industry $7.5K cap'],
  ['Panel CA difficult mid in range', r => r.gross[1] >= 3000 && r.gross[1] <= 5500,
   'Panel CA difficult mid out of industry $3K-$5.5K range'],
]);

// Verify low-cost state didn't regress below industry floor.
run('Panel WA average stays in industry range', {
  module: 'panel', scenario: 'upgrade_100_to_200', state: 'WA',
  panel: '100A', difficulty: 'average', homeType: 'single_family', income: 'unknown',
}, [
  ['Panel WA average mid in range', r => r.gross[1] >= 2200 && r.gross[1] <= 4000,
   'Panel WA average mid out of industry $2.2K-$4K typical range'],
]);

run('25C: with asOf=2025-06-01 it still applies (historical)', {
  ...heehraBase, state: 'OH', income: 'standard', asOf: '2025-06-01',
}, [
  ['25C applied historically', r => r.applied.some(i => i.programId === 'FED_25C_HP'),
   '25C was not applied for historical 2025 date'],
]);

run('25C: with asOf=2026-05-08 it does NOT apply', {
  ...heehraBase, state: 'OH', income: 'standard', asOf: '2026-05-08',
}, [
  ['25C not applied 2026', r => !r.applied.some(i => i.programId === 'FED_25C_HP'),
   '25C still applied in 2026 (engine date filter broken)'],
  ['25C not potential 2026', r => !r.potential.some(i => i.programId === 'FED_25C_HP'),
   '25C surfaced as potential in 2026 (should be excluded entirely)'],
]);

// Wave 1.7 formula tests for new calculators live in scripts/new-calc-tests.cjs.
// Run that file separately or via `npm test` (which now runs both).

if (failures.length) {
  console.error('\nDATA-LOAD FAILURES:');
  failures.forEach(f => console.error('  - ' + f));
}
if (assertionFailures > 0 || failures.length > 0) {
  console.error('FAILED: ' + assertionFailures + ' scenario assertion(s), ' + failures.length + ' data-load failure(s)');
  process.exit(1);
}
console.log('OK: ' + cases.length + ' scenarios + 9 targeted assertion groups passed.');
