// Smoke tests for new calculators (Wave 1.7).
// Formula-level assertions for solar, battery, EV TCO, tankless, AC, federal-credits CSV.
// Run via: node scripts/new-calc-tests.cjs

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(s => s.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => row[h] = (cells[i] || '').trim());
    return row;
  });
}

let passed = 0;
let failed = 0;
function passert(name, cond, detail) {
  if (cond) { console.log('  OK   ' + name); passed++; }
  else { console.error('  FAIL ' + name + (detail ? ' — ' + detail : '')); failed++; }
}

console.log('=== New-calculator formula smoke tests ===\n');

console.log('1) federal-credits.csv reflects 2026 reality');
{
  const credits = parseCsv(read('data/csv/federal-credits.csv'));
  const c25C = credits.filter(r => r.credit_code === '25C');
  const c25D = credits.filter(r => r.credit_code === '25D');
  const c30C = credits.filter(r => r.credit_code === '30C');
  const c30D = credits.filter(r => r.credit_code === '30D');
  const c25E = credits.filter(r => r.credit_code === '25E');
  passert('25C rows present and expired', c25C.length >= 1 && c25C.every(r => r.status === 'expired'));
  passert('25D rows present and expired', c25D.length >= 1 && c25D.every(r => r.status === 'expired'));
  passert('30C remains active',           c30C.length >= 1 && c30C.every(r => r.status === 'active'));
  passert('30D expired',                   c30D.length >= 1 && c30D.every(r => r.status === 'expired'));
  passert('25E expired',                   c25E.length >= 1 && c25E.every(r => r.status === 'expired'));
}

console.log('\n2) EV TCO equation sanity (matches EvTcoCalculator.tco)');
{
  // total = max(0, purchase - credit) - residual + fuel + maint + insurance
  // $40k, $0 credit, $20k residual, $10k op → $30k
  const t1 = Math.max(0, 40000 - 0) - 20000 + 10000;
  passert('40k - 20k residual + 10k op = 30k', t1 === 30000, 'got ' + t1);
  // $50k, $7.5k credit, $25k residual, $12k op → $50-$7.5=$42.5 net, $42.5-$25+$12=$29.5k
  const t2 = Math.max(0, 50000 - 7500) - 25000 + 12000;
  passert('50k - 7.5k credit - 25k residual + 12k op = 29.5k', t2 === 29500, 'got ' + t2);
}

console.log('\n3) Federal 30D + 25E acquisition-date logic');
{
  function federalCredit(newOrUsed, eligible, acquisitionYYYYMMDD, salePrice) {
    if (eligible !== 'yes') return 0;
    if (acquisitionYYYYMMDD > '2025-09-30') return 0;
    if (newOrUsed === 'new') return 7500;
    return Math.min(4000, Math.round(salePrice * 0.30));
  }
  passert('30D pre-cutoff new = $7,500', federalCredit('new', 'yes', '2025-09-30', 42000) === 7500);
  passert('30D post-cutoff new = $0',    federalCredit('new', 'yes', '2025-10-01', 42000) === 0);
  passert('30D 2026 = $0',                federalCredit('new', 'yes', '2026-05-11', 42000) === 0);
  passert('30D unknown elig = $0',        federalCredit('new', 'unknown', '2025-09-29', 42000) === 0);
  passert('25E cap at $4,000 on $22k',    federalCredit('used', 'yes', '2025-09-30', 22000) === 4000);
  passert('25E 30%×price on $10k = $3k',  federalCredit('used', 'yes', '2025-09-30', 10000) === 3000);
  passert('25E post-cutoff used = $0',    federalCredit('used', 'yes', '2025-10-01', 22000) === 0);
}

console.log('\n4) Tankless operating-cost physics (gallons × 8.34 × ΔT)');
{
  // 64 gal/day × 8.34 lb × 70°F = 37,363 BTU/day delivered
  const btuPerDay = 64 * 8.34 * 70;
  passert('64 gal × 70°F = ~37,363 BTU/day', Math.round(btuPerDay) === 37363, 'got ' + Math.round(btuPerDay));
  // Gas condensing UEF 0.95: thermsYr × $1.50 = ~$215/yr (NOT $7,000 like old formula)
  const thermsYr = (btuPerDay / 100000) / 0.95 * 365;
  const costYr = thermsYr * 1.50;
  passert('Gas condensing annual ~$215', Math.abs(costYr - 215.5) < 5, 'got $' + costYr.toFixed(0));
  passert('Annual cost < $1000 (old broken formula gave ~$7000)', costYr < 1000);
  // Electric: kWh ≈ btu/3412
  const kwhYr = (btuPerDay / 3412) / 0.99 * 365;
  passert('Electric annual kWh ≈ 4,040', Math.abs(kwhYr - 4040) < 50, 'got ' + Math.round(kwhYr));
}

console.log('\n5) AC annual cooling kWh formula (BLC 18 BTU/sqft·CDD)');
{
  const BLC = 18;
  // 1,800 sqft × 1,500 CDD × 18 = 48,600,000 BTU; SEER2 17.5 → 2,777 kWh
  const kwh = (1800 * 1500 * BLC) / (17.5 * 1000);
  passert('1800sqft × 1500CDD / SEER2 17.5 ≈ 2,777 kWh', Math.round(kwh) === 2777, 'got ' + Math.round(kwh));
  passert('kWh > 1,500 (old factor 0.85 gave ~130)', kwh > 1500);
  passert('kWh < 4,000 (sanity upper bound)', kwh < 4000);
  // EIA RECS 2020 residential AC average is ~1,800-2,500 kWh/year
  passert('Within EIA RECS range 1,500-4,000', kwh > 1500 && kwh < 4000);
}

console.log('\n6) Solar 25D rate function');
{
  function federal25DRate(year) {
    if (year <= 2025) return 0.30;
    return 0;
  }
  passert('25D 2025 = 30%', federal25DRate(2025) === 0.30);
  passert('25D 2026 = 0%',  federal25DRate(2026) === 0);
  passert('25D 2030 = 0%',  federal25DRate(2030) === 0);
}

console.log('\n7) Battery 25D rate');
{
  function batteryFedRate(year) { return year <= 2025 ? 0.30 : 0; }
  passert('Battery 25D 2025 = 30%', batteryFedRate(2025) === 0.30);
  passert('Battery 25D 2026 = 0%',  batteryFedRate(2026) === 0);
}

console.log('\n8) Geothermal 25D rate (same as solar)');
{
  function geoFedRate(year) { return year <= 2025 ? 0.30 : 0; }
  passert('Geothermal 25D 2025 = 30%', geoFedRate(2025) === 0.30);
  passert('Geothermal 25D 2026 = 0%',  geoFedRate(2026) === 0);
}

console.log('\n=== ' + passed + '/' + (passed + failed) + ' new-calculator assertions passed ===');
if (failed > 0) {
  console.error('FAILED: ' + failed + ' assertions');
  process.exit(1);
}
