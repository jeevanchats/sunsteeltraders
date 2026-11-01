import { QuoteItemInput } from '../services/admin-api.service';
import { dimFieldsFor } from './quote-lines';

/** One thing a quotation needs before it can go out. `id` is the page id of the field to jump to. */
export interface Check { key: string; id: string; label: string; done: boolean }

/** What lineFigures() worked out for the line; only these two are needed to judge it. */
export interface LineState { kg: number; gstRate: number | null }

const pos = (v: number | null | undefined): boolean => v != null && v > 0;

/** The page id of a field on a quotation line, e.g. q-l0-rate. */
export const lineFieldId = (index: number, key: string): string => `q-l${index}-${key}`;

/**
 * Everything a line needs to be priced, in the order the fields appear, each marked done or not.
 * Optional fields (brand, model, remarks, HSN) are not listed: a quotation can go out without them.
 */
export function lineChecks(l: QuoteItemInput, index: number, fig: LineState): Check[] {
  const out: Check[] = [];
  const add = (key: string, label: string, done: boolean) => out.push({ key, id: lineFieldId(index, key), label, done });

  if (l.itemType === 'Calculated') {
    add('form', 'Shape', !!l.form);
    add('material', 'Material', !!l.materialKey);
    add('length', 'Cut length', pos(l.lengthMm));
    for (const [k, label] of dimFieldsFor(l)) add(`dim-${k}`, label, pos(l.dims[k]));
    if (l.form === 'beam' || l.form === 'channel') add('section', 'Section', !!l.section);
    if (l.form === 'sspipe') {
      add('dim-OD', 'Outside diameter', pos(l.dims['OD']));
      add('dim-WT', 'Wall thickness or inside diameter', pos(l.dims['WT']) || pos(l.dims['ID']));
    }
    if (l.form === 'mspipe') {
      add('size', 'Nominal size', !!l.section || l.schedule === 'Custom');
      if (l.schedule === 'Custom') {
        add('dim-OD', 'Outside diameter', pos(l.dims['OD']));
        add('dim-WT', 'Wall thickness', pos(l.dims['WT']));
      } else add('schedule', 'Schedule', !!l.schedule);
    }
    add('pieces', 'Pieces', pos(l.quantity));
  } else {
    add('description', 'Description', !!l.description?.trim());
    add('pieces', 'Quantity', pos(l.quantity));
    if (l.itemType === 'ManualWeight') add('weight', 'Weight', fig.kg > 0);
  }
  add('rate', l.itemType === 'ManualUnit' ? 'Price' : 'Price per kg', l.itemType === 'ManualUnit' ? pos(l.unitPrice) : pos(l.ratePerKg));
  add('gst', 'GST rate', fig.gstRate !== null);
  return out;
}

/** Customer name, WhatsApp number and quotation type, which every quotation needs. */
export function headChecks(f: { quoteType: string; customerName: string; phone: string }): Check[] {
  return [
    { key: 'type', id: 'q-type', label: 'Choose the type of quotation', done: !!f.quoteType },
    { key: 'name', id: 'q-name', label: "Customer's name", done: (f.customerName ?? '').trim().length >= 2 },
    { key: 'phone', id: 'q-phone', label: 'WhatsApp number', done: (f.phone ?? '').replace(/\D/g, '').length >= 10 },
  ];
}
