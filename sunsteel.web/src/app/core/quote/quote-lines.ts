import { DIMS, Form, FORM_NAMES, pieceKg, validate } from '../weight/weight';
import { ItemType, lineAmount } from './quote-math';

/**
 * Weight for a calculated quote line, for the editor's instant preview. Mirrors
 * sunsteel.api Features/Quotes/QuoteLineCalc.cs (the server recomputes on save and wins): every catalogue shape uses the
 * public calculator's formulas, and stainless / mild-steel pipes are two extra shapes that resolve to the same tube
 * formula, π × (OD − WT) × WT × L × ρ. Change both.
 */
export type QuoteShape = Form | 'sspipe' | 'mspipe';

export interface MaterialRef { key: string; name: string; density: number }
export interface SectionRef { designation: string; kind: string; kgPerMetre: number }
export interface MsPipeRef { nominalSize: string; odMm: number; schedule: string; wallMm: number }
export interface HsnRef { form: string; materialKey: string; hsn: string }
export interface LineInputs {
  form: string | null; materialKey: string | null; dims: Record<string, number>; section: string | null; schedule: string | null;
  lengthMm: number; quantity: number;
}
export interface LineCalc {
  /** Definitely wrong input (not merely unfinished): shown to the salesperson, and no price is given. */
  error: string;
  pieceKg: number; kg: number; kgPerM: number; description: string;
  /** Values worked out from the others: stainless pipe ID or wall, mild-steel pipe OD and wall. */
  derived: { id?: number; wt?: number; od?: number };
}

export const STAINLESS_KEYS = ['ss300', 'ss202', 'ss400', 'ss431', 'ph'];
export const MS_PIPE_KEYS = ['ms', 'alloy'];

export const SHAPES: { key: QuoteShape; label: string }[] = [
  { key: 'round', label: 'Round' }, { key: 'square', label: 'Square' }, { key: 'hex', label: 'Hex' },
  { key: 'flat', label: 'Flat' }, { key: 'plate', label: 'Plate / sheet' }, { key: 'sqpipe', label: 'Square pipe' }, { key: 'rect', label: 'Rectangular pipe' },
  { key: 'angle', label: 'Angle' }, { key: 'beam', label: 'Beam (ISMB)' }, { key: 'channel', label: 'Channel (ISMC)' },
  { key: 'sspipe', label: 'SS pipe' }, { key: 'mspipe', label: 'MS pipe' }, { key: 'tube', label: 'Tube (other metals)' },
];

/** Materials offered per shape: stainless only for SS pipe, mild and alloy steel for MS pipe. */
export function materialsFor(shape: string | null, materials: MaterialRef[]): MaterialRef[] {
  if (shape === 'sspipe') return materials.filter((m) => STAINLESS_KEYS.includes(m.key));
  if (shape === 'mspipe') return materials.filter((m) => MS_PIPE_KEYS.includes(m.key));
  return materials;
}

/** Size inputs per shape: [key, label]. Pipes, beams and channels have their own controls. */
/**
 * Whether a tube or hollow section is being given by its inside size instead of its wall. The keys are there once the person
 * switches (the value may still be empty), so the choice survives while nothing is typed yet. ID = inside diameter; a, b = inside sizes.
 */
export function insideMode(l: { form: string | null; dims: Record<string, number> }): boolean {
  return (l.form === 'tube' && 'ID' in l.dims) || (l.form === 'sqpipe' && 'a' in l.dims) || (l.form === 'rect' && ('a' in l.dims || 'b' in l.dims));
}

/** The size inputs for a line: as dimFields, with the inside-size inputs in place of the wall when that is how it is given. */
export function dimFieldsFor(l: { form: string | null; dims: Record<string, number> }): [string, string][] {
  if (l.form === 'tube' && insideMode(l)) return [['OD', 'Outside dia.'], ['ID', 'Inside dia.']];
  if (l.form === 'sqpipe' && insideMode(l)) return [['A', 'Side'], ['a', 'Inside size']];
  if (l.form === 'rect' && insideMode(l)) return [['A', 'Side A'], ['B', 'Side B'], ['a', 'Inside A'], ['b', 'Inside B']];
  return dimFields(l.form);
}

export function dimFields(shape: string | null): [string, string][] {
  if (!shape || shape === 'sspipe' || shape === 'mspipe' || shape === 'beam' || shape === 'channel') return [];
  return (DIMS[shape as Form] ?? []).map(([k, label]) => [k, label]);
}

const num = (v: number | null | undefined): number => (v != null && v > 0 ? v : 0);
const fmt = (v: number): string => String(Math.round(v * 100) / 100);
const EMPTY = (error = ''): LineCalc => ({ error, pieceKg: 0, kg: 0, kgPerM: 0, description: '', derived: {} });

export function calcLine(l: LineInputs, materials: MaterialRef[], sections: SectionRef[], pipes: MsPipeRef[], decimals: number): LineCalc {
  const form = l.form as QuoteShape | null;
  const mat = materials.find((m) => m.key === l.materialKey);
  if (!form || !mat || !(l.lengthMm > 0)) return EMPTY();
  const d: Record<string, number> = { ...l.dims };
  let calcForm: Form;
  let description: string;
  const derived: LineCalc['derived'] = {};
  let kgm = 0;

  if (form === 'sspipe') {
    if (!STAINLESS_KEYS.includes(mat.key)) return EMPTY('Stainless pipe needs a stainless steel material.');
    const od = num(d['OD']);
    if (!od) return EMPTY();
    let wt = 0, id = 0;
    if (num(d['ID'])) {
      id = d['ID'];
      if (id >= od) return EMPTY('Inside diameter must be less than the outside diameter.');
      wt = (od - id) / 2;
    } else if (num(d['WT'])) {
      wt = d['WT'];
      if (wt * 2 >= od) return EMPTY('Wall thickness must be less than half the outside diameter.');
      id = od - 2 * wt;
    } else return EMPTY();
    d['WT'] = wt;
    derived.wt = wt; derived.id = id;
    calcForm = 'tube';
    description = `SS pipe ${fmt(od)} OD × ${fmt(id)} ID`;
  } else if (form === 'mspipe') {
    if (!MS_PIPE_KEYS.includes(mat.key)) return EMPTY('Mild steel pipe needs mild / structural or alloy steel.');
    if (l.schedule === 'Custom') {
      if (!num(d['OD']) || !num(d['WT'])) return EMPTY();
      description = `MS pipe ${fmt(d['OD'])} OD × ${fmt(d['WT'])} wall`;
    } else {
      if (!l.section || !l.schedule) return EMPTY();
      const row = pipes.find((p) => p.nominalSize === l.section && p.schedule === l.schedule);
      if (!row) return EMPTY(`MS pipe ${l.section} ${l.schedule} is not in the schedule table.`);
      d['OD'] = row.odMm; d['WT'] = row.wallMm;
      derived.od = row.odMm; derived.wt = row.wallMm;
      description = `MS pipe ${l.section} ${l.schedule}`;
    }
    calcForm = 'tube';
  } else {
    calcForm = form;
    if (form === 'tube' && num(d['ID'])) {
      const od = num(d['OD']);
      if (!od) return EMPTY();
      if (d['ID'] >= od) return EMPTY('Inside diameter must be less than the outside diameter.');
      d['WT'] = (od - d['ID']) / 2;
      derived.id = d['ID']; derived.wt = d['WT'];
    } else if (form === 'sqpipe' && num(d['a'])) {
      const A = num(d['A']), a = num(d['a']);
      if (!A) return EMPTY();
      if (a >= A) return EMPTY('The inside size must be smaller than the outside size.');
      d['WT'] = (A - a) / 2;
      derived.wt = d['WT'];
    } else if (form === 'rect' && (num(d['a']) || num(d['b']))) {
      const A = num(d['A']), B = num(d['B']), a = num(d['a']), b = num(d['b']);
      if (!(A && B && a && b)) return EMPTY();
      if (a >= A || b >= B) return EMPTY('The inside sizes must be smaller than the outside sizes.');
      if (Math.abs((A - a) / 2 - (B - b) / 2) > 0.01) return EMPTY('The inside sizes must leave the same wall all round: (A − a) ÷ 2 must equal (B − b) ÷ 2.');
      d['WT'] = (A - a) / 2;
      derived.wt = d['WT'];
    }
    if (form === 'beam' || form === 'channel') {
      kgm = sections.find((s) => s.designation === l.section)?.kgPerMetre ?? 0;
      if (!kgm) return EMPTY();
      description = `${FORM_NAMES[form].replace(/ \(.*\)/, '')} ${l.section}`;
    } else description = `${FORM_NAMES[form]}`;
  }

  const problem = validate(calcForm, d);
  if (problem) return EMPTY(problem);
  const piece = pieceKg(calcForm, d, l.lengthMm, mat.density, kgm);
  if (!(piece > 0)) return EMPTY();
  const scale = 10 ** decimals;
  const kg = Math.round(piece * Math.max(1, l.quantity || 1) * scale) / scale;
  return { error: '', pieceKg: piece, kg, kgPerM: piece / (l.lengthMm / 1000), description, derived };
}

export interface FigureInputs extends LineInputs {
  itemType: ItemType; weightPerUnit: number; ratePerKg: number; unitPrice: number | null; gstCategory: 'Raw' | 'Finished'; gstRate: number | null;
}
export interface RefData { materials: MaterialRef[]; sections: SectionRef[]; msPipes: MsPipeRef[] }
export interface RateDefaults { weightDecimals: number; gstRaw: number | null; gstFinished: number | null }

/** Weight, amount and GST rate of one line. Amount stays null until the line has what it needs, so nothing shows as zero. */
export function lineFigures(l: FigureInputs, ref: RefData, d: RateDefaults): { kg: number; amount: number | null; gstRate: number | null; calc: LineCalc | null } {
  let kg = 0;
  let calc: LineCalc | null = null;
  if (l.itemType === 'Calculated') {
    calc = calcLine(l, ref.materials, ref.sections, ref.msPipes, d.weightDecimals);
    kg = calc.kg;
  } else if (l.itemType === 'ManualWeight') {
    const scale = 10 ** d.weightDecimals;
    kg = Math.round(Math.max(1, l.quantity || 1) * (l.weightPerUnit || 0) * scale) / scale;
  }
  const gstRate = l.gstRate ?? (l.gstCategory === 'Raw' ? d.gstRaw : d.gstFinished);
  return { kg, amount: lineAmount(l.itemType, kg, l.ratePerKg, l.quantity, l.unitPrice), gstRate, calc };
}

/** Exact shape + material first, then the shape's catch-all (blank material); pipes may also use the tube row. */
export function resolveHsn(rows: HsnRef[], form: string | null, materialKey: string | null): string {
  if (!form) return '';
  const find = (f: string) => rows.find((h) => h.form === f && h.materialKey === (materialKey ?? ''))?.hsn ?? rows.find((h) => h.form === f && h.materialKey === '')?.hsn;
  return find(form) ?? (form === 'sspipe' || form === 'mspipe' ? find('tube') : form === 'sqpipe' ? find('rect') : undefined) ?? '';
}
