// Checks the browser copies of the quote engine against the blueprint's cases (the server has the same ones).
//   cd sunsteel.web && npx esbuild src/app/core/quote/quote-lines.ts --bundle --format=esm --outfile=/tmp/ql.mjs \
//     && node src/app/core/quote/quote.check.mjs /tmp/ql.mjs
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const file = process.argv[2];
if (!file) { console.error('usage: node quote.check.mjs <bundled quote-lines.mjs>'); process.exit(2); }
const { calcLine, lineFigures, resolveHsn, materialsFor } = await import(pathToFileURL(resolve(file)).href);
const math = await import(pathToFileURL(resolve(file.replace('ql.mjs', 'qm.mjs'))).href).catch(() => null);

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { (ok ? pass++ : fail++); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); };
const near = (a, b, t = 0.005) => Math.abs(a - b) <= t;

const materials = [
  { key: 'ms', name: 'Mild / structural steel', density: 7.85 }, { key: 'ss300', name: 'Stainless 304 / 316', density: 8.0 },
  { key: 'brass', name: 'Brass', density: 8.5 },
];
const sections = [{ designation: 'ISMB 300', kind: 'beam', kgPerMetre: 44.2 }];
const pipes = [{ nominalSize: '2 in.', odMm: 60.3, schedule: 'SCH 40', wallMm: 3.91 }];
const base = { form: null, materialKey: null, dims: {}, section: null, schedule: null, lengthMm: 0, quantity: 1 };
const calc = (o) => calcLine({ ...base, ...o }, materials, sections, pipes, 1);

const r1 = calc({ form: 'round', materialKey: 'ms', dims: { D: 80 }, lengthMm: 500, quantity: 4 });
check('Round 80x500 x4: 19.7 each, 78.9 total, 39.5 kg/m', near(r1.pieceKg, 19.7, 0.05) && r1.kg === 78.9 && near(r1.kgPerM, 39.5, 0.05));
check('Round 25x1000: 3.85 kg (engine)', near(calc({ form: 'round', materialKey: 'ms', dims: { D: 25 }, lengthMm: 1000 }).pieceKg, 3.85));
check('Flat 50x10x1000: 3.9 kg', calc({ form: 'flat', materialKey: 'ms', dims: { T: 10, W: 50 }, lengthMm: 1000 }).kg === 3.9);
const s1 = calc({ form: 'sspipe', materialKey: 'ss300', dims: { OD: 60, WT: 2 }, lengthMm: 6000 });
check('SS pipe OD60 wall2: 17.5 kg, 2.92 kg/m, ID 56', s1.kg === 17.5 && near(s1.kgPerM, 2.92) && s1.derived.id === 56);
const s2 = calc({ form: 'sspipe', materialKey: 'ss300', dims: { OD: 60, ID: 56 }, lengthMm: 6000 });
check('SS pipe by ID: 17.5 kg, wall 2', s2.kg === 17.5 && s2.derived.wt === 2);
check('SS pipe ID 60: error, no price', calc({ form: 'sspipe', materialKey: 'ss300', dims: { OD: 60, ID: 60 }, lengthMm: 6000 }).error !== '' && calc({ form: 'sspipe', materialKey: 'ss300', dims: { OD: 60, ID: 60 }, lengthMm: 6000 }).kg === 0);
const m1 = calc({ form: 'mspipe', materialKey: 'ms', section: '2 in.', schedule: 'SCH 40', lengthMm: 6000 });
check('MS pipe 2in SCH40: OD 60.3, wall 3.91, 32.6 kg, 5.44 kg/m', m1.derived.od === 60.3 && m1.derived.wt === 3.91 && m1.kg === 32.6 && near(m1.kgPerM, 5.44));
check('MS pipe missing from table: unavailable, no price', calc({ form: 'mspipe', materialKey: 'ms', section: '6 in.', schedule: 'SCH 160', lengthMm: 6000 }).error !== '');
const t1 = calc({ form: 'tube', materialKey: 'brass', dims: { OD: 100, ID: 60 }, lengthMm: 1000 });
check('Tube by inside diameter: brass OD 100 x ID 60 = wall 20, 42.73 kg', near(t1.pieceKg, 42.73, 0.01) && t1.derived.wt === 20 && t1.derived.id === 60);
check('Tube: inside diameter not smaller than the outside is refused', calc({ form: 'tube', materialKey: 'brass', dims: { OD: 60, ID: 60 }, lengthMm: 1000 }).error !== '');
check('Tube by wall still works: OD 100 x wall 20 = 42.73 kg', near(calc({ form: 'tube', materialKey: 'brass', dims: { OD: 100, WT: 20 }, lengthMm: 1000 }).pieceKg, 42.73, 0.01));
const h1 = calc({ form: 'rect', materialKey: 'ms', dims: { A: 100, B: 50, a: 92, b: 42 }, lengthMm: 1000 });
check('Hollow section by inside size: 100 x 50 outside, 92 x 42 inside = wall 4, 8.92 kg', near(h1.pieceKg, 8.92, 0.01) && h1.derived.wt === 4);
check('Hollow section: unequal walls are refused', calc({ form: 'rect', materialKey: 'ms', dims: { A: 100, B: 50, a: 92, b: 40 }, lengthMm: 1000 }).error !== '');
check('Switching mode with nothing typed yet gives no price and no error', (() => { const r = calc({ form: 'tube', materialKey: 'brass', dims: { OD: 100, ID: 0 }, lengthMm: 1000 }); return r.kg === 0 && r.error === ''; })());
check('Beam: kg/m from the IS 808 table', calc({ form: 'beam', materialKey: 'ms', section: 'ISMB 300', lengthMm: 6000, quantity: 2 }).kg === 530.4);
check('Empty inputs: no price, no error', (() => { const r = calc({ form: 'round', materialKey: 'ms', lengthMm: 500 }); return r.kg === 0 && r.error === ''; })());
check('Material list filtered by shape', materialsFor('sspipe', materials).length === 1 && materialsFor('mspipe', materials).every((m) => m.key === 'ms'));
check('HSN: exact shape + material, then catch-all, then tube for pipes',
  resolveHsn([{ form: 'round', materialKey: 'ms', hsn: '7228' }, { form: 'round', materialKey: '', hsn: '7214' }, { form: 'tube', materialKey: '', hsn: '7306' }], 'round', 'ms') === '7228'
  && resolveHsn([{ form: 'round', materialKey: '', hsn: '7214' }], 'round', 'brass') === '7214'
  && resolveHsn([{ form: 'tube', materialKey: '', hsn: '7306' }], 'sspipe', 'ss300') === '7306'
  && resolveHsn([], 'round', 'ms') === '');

const ref = { materials, sections, msPipes: pipes };
const d = { weightDecimals: 1, gstRaw: 18, gstFinished: 12 };
const fig = (o) => lineFigures({ ...base, itemType: 'Calculated', weightPerUnit: 0, ratePerKg: 0, unitPrice: null, gstCategory: 'Raw', gstRate: null, ...o }, ref, d);
check('78.9 kg at 70/kg = 5,523.00 at the raw rate', (() => { const f = fig({ form: 'round', materialKey: 'ms', dims: { D: 80 }, lengthMm: 500, quantity: 4, ratePerKg: 70 }); return f.amount === 5523 && f.gstRate === 18; })());
check('Manual by weight: 10 x 3.2 kg at 68 = 32.0 kg, 2,176.00', (() => { const f = fig({ itemType: 'ManualWeight', quantity: 10, weightPerUnit: 3.2, ratePerKg: 68, gstCategory: 'Finished' }); return f.kg === 32 && f.amount === 2176 && f.gstRate === 12; })());
check('Manual by unit: 3 x 450 = 1,350.00, no weight', (() => { const f = fig({ itemType: 'ManualUnit', quantity: 3, unitPrice: 450, gstCategory: 'Finished' }); return f.kg === 0 && f.amount === 1350; })());
check('Missing price: no amount', fig({ itemType: 'ManualUnit', quantity: 3 }).amount === null && fig({ itemType: 'ManualWeight', quantity: 2, weightPerUnit: 1 }).amount === null);
check('A line rate overrides the category rate', fig({ itemType: 'ManualUnit', quantity: 1, unitPrice: 10, gstCategory: 'Finished', gstRate: 5 }).gstRate === 5);

if (math) {
  const { quoteTotals, inWords, lineAmount } = math;
  const none = { cuttingCharge: 0, loadingCharge: 0, unloadingCharge: 0, transportCharge: 0, discount: 0 };
  const t = quoteTotals([{ kg: 78.9, amount: lineAmount('Calculated', 78.9, 70, 4, null), gstRate: 18 }], none, 18, false);
  check('Totals: 5,523.00 + CGST 497.07 + SGST 497.07, round off -0.14, 6,517', t.cgst === 497.07 && t.sgst === 497.07 && t.roundOff === -0.14 && t.grandTotal === 6517);
  check('Words: Rupees Six Thousand Five Hundred Seventeen Only', inWords(6517) === 'Rupees Six Thousand Five Hundred Seventeen Only');
  const mixed = quoteTotals([{ kg: 0, amount: 1000, gstRate: 18 }, { kg: 0, amount: 1000, gstRate: 12 }], none, 18, false);
  check('Mixed rates: CGST 90 + SGST 90 at 18, 60 + 60 at 12, total 2,300', mixed.taxGroups.length === 2 && mixed.taxGroups.find((g) => g.rate === 18).cgst === 90 && mixed.taxGroups.find((g) => g.rate === 12).sgst === 60 && mixed.grandTotal === 2300);
  check('IGST outside Tamil Nadu', quoteTotals([{ kg: 0, amount: 5523, gstRate: 18 }], none, 18, true).igst === 994.14);
  check('Priceless line stays out of totals', quoteTotals([{ kg: 10, amount: null, gstRate: 18 }, { kg: 1, amount: 100, gstRate: 18 }], none, 18, false).subtotal === 100);
  const disc = quoteTotals([{ kg: 0, amount: 1000, gstRate: 18 }, { kg: 0, amount: 1000, gstRate: 12 }], { ...none, discount: 200 }, 18, false);
  check('Discount spread in proportion over the lines', disc.taxable === 1800 && disc.taxGroups.every((g) => g.taxable === 900));
  const ch = quoteTotals([{ kg: 0, amount: 1000, gstRate: 12 }], { ...none, cuttingCharge: 100 }, 18, false);
  check('Cutting and freight taxed at their own rate', ch.taxGroups.find((g) => g.rate === 18).taxable === 100);
  // The customer's own quotation (voucher 2123, 26-Oct-26): 21.500 KG at 175.00 plus 100.00 cartage, GST 18%.
  const real = quoteTotals([{ kg: 21.5, amount: lineAmount('ManualWeight', 21.5, 175, 1, null), gstRate: 18 }], { ...none, transportCharge: 100 }, 18, false);
  check('Their invoice 2123: 3,762.50 + cartage 100, CGST 347.63 + SGST 347.63, round off 0.24, total 4,558',
    real.subtotal === 3762.5 && real.taxable === 3862.5 && real.cgst === 347.63 && real.sgst === 347.63 && real.roundOff === 0.24 && real.grandTotal === 4558);
} else console.log('SKIP  totals (qm.mjs not found next to the bundle)');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
