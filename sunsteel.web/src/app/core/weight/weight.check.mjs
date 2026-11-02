// Quick check of the weight formulas against the specification's worked example and a few
// hand calculations. Run: npx esbuild src/app/core/weight/weight.ts --format=esm --outfile=/tmp/w.mjs && node src/app/core/weight/weight.check.mjs /tmp/w.mjs
import assert from 'node:assert/strict';
const w = await import(process.argv[2]);
const near = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
near(w.pieceKg('round', { D: 80 }, 500, 7.85) * 4, 78.9);                  // spec §3.1: EN24 Ø80 × 500 × 4 = 78.9 kg
near(w.pieceKg('round', { D: 25 }, 1000, 7.85), 3.85, 0.01);               // 25 mm round = 3.85 kg/m
near(w.pieceKg('flat', { W: 50, T: 10 }, 6000, 8.0) * 2, 48.0, 0.01);      // SS flat 50×10×6 m ×2
near(w.pieceKg('tube', { OD: 60.3, WT: 3.6 }, 1000, 7.85), 5.03, 0.01);    // 2″ medium pipe ≈ 5.03 kg/m
near(w.pieceKg('hex', { AF: 32 }, 1000, 8.5), 7.54, 0.01);                 // brass hex 32 A/F
near(w.pieceKg('beam', {}, 6000, 0, 44.2), 265.2, 0.01);                    // ISMB 300 × 6 m
assert.equal(w.pieceKg('tube', { OD: 20, WT: 10 }, 1000, 7.85), 0);         // impossible wall
near(w.pieceKg('tube', { OD: 60.3, WT: 3.91 }, 1000, 7.85), 5.44, 0.01);   // 2 in. SCH 40 (ASME B36.10M) = 5.44 kg/m
near(w.pieceKg('tube', { OD: 60.3, WT: 5.54 }, 1000, 7.85), 7.48, 0.01);   // 2 in. SCH 80 = 7.48 kg/m
near(w.pieceKg('tube', { OD: 114.3, WT: 6.02 }, 1000, 7.85), 16.07, 0.01); // 4 in. SCH 40 = 16.07 kg/m
assert.equal(w.wallFromId(60, 50), 5);                                     // OD 60, ID 50 -> wall 5
near(w.pieceKg('tube', { OD: 60, WT: w.wallFromId(60, 50) }, 1000, 7.85), 6.78, 0.01);
assert.equal(w.wallFromId(50, 50), 0);                                     // inside not smaller than outside
assert.equal(w.rectWallFromInside(100, 50, 92, 42), 4);                    // 100 x 50 outside, 92 x 42 inside -> wall 4
near(w.pieceKg('rect', { A: 100, B: 50, WT: w.rectWallFromInside(100, 50, 92, 42) }, 1000, 7.85), 8.92, 0.01);
assert.equal(w.rectWallFromInside(100, 50, 92, 40), 0);                    // unequal walls are refused
near(w.pieceKg('sqpipe', { A: 50, WT: 3 }, 1000, 7.85), 4.43, 0.01);        // 50 x 50 x 3 square pipe = 4.43 kg/m
near(w.pieceKg('sqpipe', { A: 50, WT: 3 }, 1000, 7.85), w.pieceKg('rect', { A: 50, B: 50, WT: 3 }, 1000, 7.85), 1e-9); // square = rectangular with equal sides
near(w.pieceKg('sqpipe', { A: 50, WT: w.rectWallFromInside(50, 50, 44, 44) }, 1000, 7.85), 4.43, 0.01); // inside size 44 -> wall 3
assert.equal(w.validate('sqpipe', { A: 50, WT: 25 }), 'Wall thickness must be less than half the side.');
assert.equal(w.dimText('sqpipe', { A: 50, WT: 3 }), '50 sq × 3 wall');
assert.equal(w.validate('angle', { A: 50, B: 50, T: 60 }), 'Thickness must be less than the shorter leg.');
assert.equal(w.dimText('flat', { W: 75, T: 12 }), '75 × 12');
assert.deepEqual(w.rangeOf('Ø 6–150 mm, h9/h11'), [6, 150]);
console.log('weight formulas: all checks passed');
