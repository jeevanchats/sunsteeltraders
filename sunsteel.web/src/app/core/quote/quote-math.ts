/**
 * Quote totals for the editor's live preview. Mirrors Features/Quotes/QuoteMath.cs (the server
 * recomputes on every save and is the source of truth). Change both.
 */
export interface QuoteLine { kg: number; ratePerKg: number }
export interface QuoteCharges { cuttingCharge: number; loadingCharge: number; unloadingCharge: number; transportCharge: number; discount: number; gstRate: number; interState: boolean }
export interface QuoteTotals {
  totalKg: number; materialTotal: number; charges: number; discount: number; taxable: number;
  cgst: number; sgst: number; igst: number; roundOff: number; grandTotal: number;
}

/** Round half away from zero to 2 places, like the server (all amounts here are positive). */
const r2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

export const lineAmount = (kg: number, rate: number): number => r2((kg || 0) * (rate || 0));

export function quoteTotals(lines: QuoteLine[], c: QuoteCharges): QuoteTotals {
  const n = (v: number) => Number(v) || 0;
  const materialTotal = r2(lines.reduce((s, l) => s + lineAmount(n(l.kg), n(l.ratePerKg)), 0));
  const charges = r2(n(c.cuttingCharge) + n(c.loadingCharge) + n(c.unloadingCharge) + n(c.transportCharge));
  const discount = n(c.discount);
  const taxable = Math.max(0, r2(materialTotal + charges - discount));
  let cgst = 0, sgst = 0, igst = 0;
  if (c.interState) igst = r2((taxable * n(c.gstRate)) / 100);
  else { cgst = r2((taxable * n(c.gstRate)) / 200); sgst = cgst; }
  const beforeRound = r2(taxable + cgst + sgst + igst);
  const grandTotal = Math.round(beforeRound);
  return { totalKg: r2(lines.reduce((s, l) => s + n(l.kg), 0)), materialTotal, charges, discount, taxable, cgst, sgst, igst, roundOff: r2(grandTotal - beforeRound), grandTotal };
}

/** Outside Tamil Nadu (GSTIN state code 33) means IGST. No GSTIN: assume a local sale. */
export const isInterState = (gstin: string | null | undefined): boolean => !!gstin && gstin.trim().length >= 2 && !gstin.trim().startsWith('33');

const INR = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 255622.5 → "2,55,622.50" (Indian grouping, no locale registration needed). */
export const inr = (v: number | null | undefined): string => INR.format(Number(v) || 0);
