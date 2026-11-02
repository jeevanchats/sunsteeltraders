/**
 * Theoretical metal weight (specification §3.1). Dimensions in mm, density ρ in g/cm³,
 * result in kg. Mirrors sunsteel.api Features/Weight/WeightCalculator.cs; keep both in step.
 * The server recomputes every RFQ line, so this copy is for instant feedback only.
 */
export type Form = 'round' | 'square' | 'hex' | 'flat' | 'plate' | 'tube' | 'sqpipe' | 'rect' | 'angle' | 'beam' | 'channel';
export type Dims = Record<string, number>;

export const FORM_NAMES: Record<Form, string> = {
  round: 'Round', square: 'Square', hex: 'Hex', flat: 'Flat', plate: 'Plate / sheet', tube: 'Tube / pipe',
  sqpipe: 'Square pipe', rect: 'Rectangular pipe', angle: 'Angle', beam: 'Beam (ISMB)', channel: 'Channel (ISMC)',
};

export const CALC_FORMS: Form[] = ['round', 'square', 'hex', 'flat', 'plate', 'tube', 'sqpipe', 'rect', 'angle', 'beam', 'channel'];

/** The inputs each shape needs: [key, label, default]. Beams and channels pick an IS 808 section instead. */
export const DIMS: Partial<Record<Form, [string, string, number][]>> = {
  round: [['D', 'Diameter', 80]],
  square: [['W', 'Side', 50]],
  hex: [['AF', 'Across flats', 32]],
  flat: [['W', 'Width', 75], ['T', 'Thickness', 12]],
  plate: [['T', 'Thickness', 10], ['W', 'Width', 1250]],
  tube: [['OD', 'Outside dia.', 60.3], ['WT', 'Wall', 3.9]],
  sqpipe: [['A', 'Side', 50], ['WT', 'Wall', 3]],
  rect: [['A', 'Side A', 100], ['B', 'Side B', 50], ['WT', 'Wall', 4]],
  angle: [['A', 'Leg A', 50], ['B', 'Leg B', 50], ['T', 'Thickness', 6]],
};

export const DEFAULT_LENGTH: Partial<Record<Form, number>> = { plate: 2500, beam: 6000, channel: 6000, angle: 6000, sqpipe: 6000, rect: 6000, tube: 6000 };

export const FORMULA_TEXT: Record<Form, string> = {
  round: 'W = π × D² × L × ρ ÷ 4,000,000',
  square: 'W = S² × L × ρ ÷ 1,000,000',
  hex: 'W = 0.866025 × A/F² × L × ρ ÷ 1,000,000',
  flat: 'W = T × W × L × ρ ÷ 1,000,000',
  plate: 'W = T × W × L × ρ ÷ 1,000,000',
  tube: 'W = π × (OD − WT) × WT × L × ρ ÷ 1,000,000   (with an inside diameter, WT = (OD − ID) ÷ 2)',
  sqpipe: 'W = 4 × (A − WT) × WT × L × ρ ÷ 1,000,000   (with an inside size, WT = (A − a) ÷ 2)',
  rect: 'W = (2(A + B) − 4·WT) × WT × L × ρ ÷ 1,000,000   (with inside sizes, WT = (A − a) ÷ 2 = (B − b) ÷ 2)',
  angle: 'W = (A + B − T) × T × L × ρ ÷ 1,000,000',
  beam: 'W = IS 808 kg/m × L ÷ 1,000',
  channel: 'W = IS 808 kg/m × L ÷ 1,000',
};

const v = (d: Dims, k: string) => (d[k] > 0 ? d[k] : 0);

/** Wall thickness from the outside and inside diameters; 0 unless the inside is smaller than the outside. */
export function wallFromId(od: number, id: number): number {
  return od > 0 && id > 0 && id < od ? Math.round(((od - id) / 2) * 1000) / 1000 : 0;
}

/** Wall of a rectangular or square hollow section from its outside sizes (A, B) and inside sizes (a, b); 0 unless both directions leave the same wall. */
export function rectWallFromInside(A: number, B: number, a: number, b: number): number {
  if (!(A > 0 && B > 0 && a > 0 && b > 0 && a < A && b < B)) return 0;
  const w1 = (A - a) / 2, w2 = (B - b) / 2;
  return Math.abs(w1 - w2) <= 0.01 ? Math.round(w1 * 1000) / 1000 : 0;
}

/** Plain-language problem with the dimensions, or '' when they are valid. */
export function validate(form: Form, d: Dims): string {
  if (form === 'tube' && v(d, 'WT') * 2 >= v(d, 'OD')) return 'Wall thickness must be less than half the outside diameter.';
  if (form === 'sqpipe' && v(d, 'WT') * 2 >= v(d, 'A')) return 'Wall thickness must be less than half the side.';
  if (form === 'rect' && v(d, 'WT') * 2 >= Math.min(v(d, 'A'), v(d, 'B'))) return 'Wall thickness must be less than half the smaller side.';
  if (form === 'angle' && v(d, 'T') >= Math.min(v(d, 'A'), v(d, 'B'))) return 'Thickness must be less than the shorter leg.';
  return '';
}

/** Weight of one piece in kg; 0 when dimensions are incomplete or impossible. */
export function pieceKg(form: Form, d: Dims, lengthMm: number, density: number, sectionKgPerM = 0): number {
  if (!(lengthMm > 0) || validate(form, d)) return 0;
  let kg = 0;
  switch (form) {
    case 'round': kg = (Math.PI * v(d, 'D') ** 2 * lengthMm * density) / 4e6; break;
    case 'square': kg = (v(d, 'W') ** 2 * lengthMm * density) / 1e6; break;
    case 'hex': kg = (0.866025 * v(d, 'AF') ** 2 * lengthMm * density) / 1e6; break;
    case 'flat':
    case 'plate': kg = (v(d, 'T') * v(d, 'W') * lengthMm * density) / 1e6; break;
    case 'tube': kg = (Math.PI * (v(d, 'OD') - v(d, 'WT')) * v(d, 'WT') * lengthMm * density) / 1e6; break;
    case 'sqpipe': kg = ((4 * v(d, 'A') - 4 * v(d, 'WT')) * v(d, 'WT') * lengthMm * density) / 1e6; break;
    case 'rect': kg = ((2 * (v(d, 'A') + v(d, 'B')) - 4 * v(d, 'WT')) * v(d, 'WT') * lengthMm * density) / 1e6; break;
    case 'angle': kg = ((v(d, 'A') + v(d, 'B') - v(d, 'T')) * v(d, 'T') * lengthMm * density) / 1e6; break;
    case 'beam':
    case 'channel': kg = (sectionKgPerM * lengthMm) / 1000; break;
  }
  return Number.isFinite(kg) && kg > 0 ? kg : 0;
}

/** Short size text, e.g. "Ø80", "75 × 12", "ISMB 300". */
export function dimText(form: Form, d: Dims, section?: string): string {
  const f = (k: string) => (d[k] ?? '?').toString();
  switch (form) {
    case 'round': return `Ø${f('D')}`;
    case 'square': return `${f('W')} sq`;
    case 'hex': return `${f('AF')} A/F hex`;
    case 'flat': return `${f('W')} × ${f('T')}`;
    case 'plate': return `${f('T')} × ${f('W')}`;
    case 'tube': return `OD ${f('OD')} × ${f('WT')} wall`;
    case 'sqpipe': return `${f('A')} sq × ${f('WT')} wall`;
    case 'rect': return `${f('A')} × ${f('B')} × ${f('WT')}`;
    case 'angle': return `${f('A')} × ${f('B')} × ${f('T')}`;
    default: return section ?? '';
  }
}

/** Indian-style kg: 2 decimals under 10 kg, 1 decimal above. */
export function formatKg(n: number): string {
  if (!(n > 0)) return '—';
  const digits = n < 10 ? 2 : 1;
  return n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Standard stock sizes used for the size / weight charts on product pages. */
export const STD_SIZES = {
  round: [6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 300, 350, 400],
  hex: [8, 10, 13, 17, 19, 22, 24, 27, 32, 36, 41, 46, 50, 55, 60, 75],
  square: [10, 12, 16, 20, 25, 32, 40, 50, 63, 75, 100],
  flat: [[20, 3], [25, 5], [32, 6], [40, 6], [50, 8], [65, 10], [75, 12], [100, 12], [125, 16], [150, 20], [200, 25]] as [number, number][],
  plate: [0.8, 1, 1.6, 2, 3, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100],
  tube: [[21.3, 2.6, '½″'], [26.9, 2.6, '¾″'], [33.7, 3.2, '1″'], [48.3, 3.2, '1½″'], [60.3, 3.6, '2″'], [88.9, 4, '3″'], [114.3, 4.5, '4″'], [168.3, 5.4, '6″'], [219.1, 6.3, '8″']] as [number, number, string][],
  sqpipe: [[20, 1.6], [25, 2], [40, 2.6], [50, 2.9], [60, 3.2], [80, 4], [100, 4], [150, 5], [200, 6]] as [number, number][],
  rect: [[40, 40, 2.6], [50, 25, 2.9], [60, 60, 3.2], [80, 40, 3.2], [100, 50, 4], [100, 100, 4], [150, 100, 5], [200, 200, 6]] as [number, number, number][],
  angle: [[25, 25, 3], [40, 40, 5], [50, 50, 6], [65, 65, 6], [75, 75, 8], [90, 90, 8], [100, 100, 10]] as [number, number, number][],
};

/** "Ø 6–150 mm …" → [6, 150], so a chart only lists sizes the product range covers. */
export function rangeOf(size: string | null | undefined): [number, number] {
  const m = (size ?? '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(?:–|-|to)\s*(\d+(?:\.\d+)?)/);
  return m ? [+m[1], +m[2]] : [0, 1e9];
}

export interface ChartRow { size: string; kgPerM: number; kgPer: number; form: Form; dims: Dims; section?: string }

/** Nominal weights for a product's main form, for the "Sizes & weights" table. */
export function sizeChart(form: Form, density: number, sizeRange: string | null | undefined, sections: { designation: string; kind: string; kgPerMetre: number }[] = []): { head: [string, string, string]; rows: ChartRow[] } {
  const [lo, hi] = rangeOf(sizeRange);
  const per = (f: Form, d: Dims) => pieceKg(f, d, 1000, density);
  switch (form) {
    case 'round':
    case 'hex':
    case 'square': {
      const key = form === 'round' ? 'D' : form === 'hex' ? 'AF' : 'W';
      const rows = STD_SIZES[form].filter((x) => x >= lo && x <= hi).map((x) => {
        const d = { [key]: x }; const m = per(form, d);
        return { size: `${x}`, kgPerM: m, kgPer: m * 6, form, dims: d };
      });
      return { head: [form === 'round' ? 'Ø mm' : form === 'hex' ? 'A/F mm' : 'Side mm', 'kg / metre', 'kg / 6 m bar'], rows };
    }
    case 'flat':
      return { head: ['W × T mm', 'kg / metre', 'kg / 6 m'], rows: STD_SIZES.flat.map(([w, t]) => { const d = { W: w, T: t }; const m = per('flat', d); return { size: `${w} × ${t}`, kgPerM: m, kgPer: m * 6, form, dims: d }; }) };
    case 'plate':
      return { head: ['Thickness mm', 'kg / m²', 'kg / sheet 1250 × 2500'], rows: STD_SIZES.plate.filter((t) => t >= lo && t <= hi).map((t) => ({ size: `${t}`, kgPerM: t * density, kgPer: t * density * 3.125, form, dims: { T: t, W: 1250 } })) };
    case 'tube':
      return { head: ['NB · OD × WT mm', 'kg / metre', 'kg / 6 m'], rows: STD_SIZES.tube.map(([od, wt, nb]) => { const d = { OD: od, WT: wt }; const m = per('tube', d); return { size: `${nb} · ${od} × ${wt}`, kgPerM: m, kgPer: m * 6, form, dims: d }; }) };
    case 'sqpipe':
      return { head: ['Side × WT mm', 'kg / metre', 'kg / 6 m'], rows: STD_SIZES.sqpipe.map(([a, w]) => { const d = { A: a, WT: w }; const m = per('sqpipe', d); return { size: `${a} × ${a} × ${w}`, kgPerM: m, kgPer: m * 6, form, dims: d }; }) };
    case 'rect':
      return { head: ['A × B × WT mm', 'kg / metre', 'kg / 6 m'], rows: STD_SIZES.rect.map(([a, b, w]) => { const d = { A: a, B: b, WT: w }; const m = per('rect', d); return { size: `${a} × ${b} × ${w}`, kgPerM: m, kgPer: m * 6, form, dims: d }; }) };
    case 'angle':
      return { head: ['A × B × T mm', 'kg / metre', 'kg / 6 m'], rows: STD_SIZES.angle.map(([a, b, t]) => { const d = { A: a, B: b, T: t }; const m = per('angle', d); return { size: `${a} × ${b} × ${t}`, kgPerM: m, kgPer: m * 6, form, dims: d }; }) };
    case 'beam':
    case 'channel':
      return { head: ['Designation', 'kg / metre', 'kg / 12 m'], rows: sections.filter((s) => s.kind === form).map((s) => ({ size: s.designation, kgPerM: s.kgPerMetre, kgPer: s.kgPerMetre * 12, form, dims: {}, section: s.designation })) };
  }
}
