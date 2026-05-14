// Contrast verification for Palette A (May-2026 refinement audit applied).
function hexToRgb(h){h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function lum(rgb){const a=rgb.map(c=>{c=c/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)});return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2]}
function contrast(h1,h2){const l1=lum(hexToRgb(h1)),l2=lum(hexToRgb(h2));const[hi,lo]=l1>l2?[l1,l2]:[l2,l1];return(hi+0.05)/(lo+0.05)}
function pass(r,large=false){const aa=large?3:4.5,aaa=large?4.5:7;return r>=aaa?'AAA':r>=aa?'AA':'FAIL'}
const c={white:'#ffffff',brand50:'#ecfdf5',brand100:'#d1fae5',brand200:'#a7f3d0',brand300:'#6ee7b7',brand500:'#10b981',brand600:'#059669',brand700:'#047857',brand800:'#065f46',ink50:'#f8fafc',ink100:'#f1f5f9',ink400:'#94a3b8',ink500:'#64748b',ink600:'#475569',ink700:'#334155',ink800:'#1e293b',ink900:'#0f172a',amber50:'#fffbeb',amber100:'#fef3c7',amber700:'#b45309',amber800:'#92400e',amber900:'#78350f',rose50:'#fff1f2',rose100:'#ffe4e6',rose700:'#be123c',rose800:'#9f1239'};
const pairs=[
  ['ink-900 on white (h1)',c.ink900,c.white],
  ['ink-700 on white (body)',c.ink700,c.white],
  ['ink-600 on white (helper)',c.ink600,c.white],
  ['ink-500 on white (subtle / nav)',c.ink500,c.white],
  ['ink-400 on white (decorative only)',c.ink400,c.white],
  ['brand-600 on white',c.brand600,c.white],
  ['brand-700 on white (link/eyebrow)',c.brand700,c.white],
  ['brand-800 on white',c.brand800,c.white],
  ['white on brand-600',c.white,c.brand600],
  ['white on brand-700 (primary btn)',c.white,c.brand700],
  ['white on brand-800',c.white,c.brand800],
  ['brand-800 on brand-50 (result amount)',c.brand800,c.brand50],
  ['brand-700 on brand-50 (eyebrow)',c.brand700,c.brand50],
  ['brand-800 on brand-100 (badge-green)',c.brand800,c.brand100],
  ['amber-800 on amber-50',c.amber800,c.amber50],
  ['amber-900 on amber-50 (caveats)',c.amber900,c.amber50],
  ['amber-800 on amber-100 (badge-amber)',c.amber800,c.amber100],
  ['rose-700 on white (error text)',c.rose700,c.white],
  ['rose-800 on rose-100 (badge-rose)',c.rose800,c.rose100],
  ['ink-700 on ink-50 (footer)',c.ink700,c.ink50],
  ['ink-600 on ink-50 (helper bg)',c.ink600,c.ink50],
];
console.log('=== Palette A (Daylight) — applied 2026-05-13 ===\n');
console.log('Pair'.padEnd(38),'Ratio'.padStart(8),'Normal'.padStart(7),'Large'.padStart(8));
console.log('-'.repeat(70));
let fails = 0;
for(const[n,fg,bg]of pairs){const r=contrast(fg,bg);const pn=pass(r,false);const pl=pass(r,true);if(pn==='FAIL'&&pl==='FAIL')fails++;console.log(n.padEnd(38),r.toFixed(2).padStart(8),pn.padStart(7),pl.padStart(8))}
console.log('\nTotal pairs:',pairs.length,'· FAIL:',fails);
process.exit(fails > 0 ? 1 : 0);
