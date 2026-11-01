/**
 * Quote totals for the editor's live preview. Mirrors Features/Quotes/QuoteMath.cs (the server
 * recomputes on every save and is the source of truth). Change both.
 *
 * Order: line amounts → subtotal → discount spread over the lines in proportion to their amounts →
 * cutting / loading / unloading / freight added at their own GST rate → GST per rate (CGST + SGST inside
 * Tamil Nadu, IGST outside), listed once per rate → round off to the rupee.
 * A line without a price has no amount and stays out of the totals.
 */
export type ItemType = 'Calculated' | 'ManualWeight' | 'ManualUnit';

export interface PricedLine { kg: number; amount: number | null; gstRate: number }
export interface Charges { cuttingCharge: number; loadingCharge: number; unloadingCharge: number; transportCharge: number; discount: number }
export interface TaxGroup { rate: number; taxable: number; cgst: number; sgst: number; igst: number }
export interface QuoteTotals {
  totalKg: number; subtotal: number; charges: number; discount: number; taxable: number;
  cgst: number; sgst: number; igst: number; roundOff: number; grandTotal: number; taxGroups: TaxGroup[];
}

/** Round half away from zero to 2 places (all amounts here are positive). */
const r2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;
const n = (v: unknown): number => Number(v) || 0;

/** Calculated and by-weight lines: kg × rate. By-unit lines: quantity × unit price. Null while the price is missing. */
export function lineAmount(itemType: ItemType, kg: number, ratePerKg: number, quantity: number, unitPrice: number | null): number | null {
  if (itemType === 'ManualUnit') return n(quantity) > 0 && n(unitPrice) > 0 ? r2(n(quantity) * n(unitPrice)) : null;
  return n(kg) > 0 && n(ratePerKg) > 0 ? r2(n(kg) * n(ratePerKg)) : null;
}

export function quoteTotals(lines: PricedLine[], c: Charges, chargeGstRate: number, interState: boolean): QuoteTotals {
  const priced = lines.filter((l) => (l.amount ?? 0) > 0);
  const subtotal = r2(priced.reduce((s, l) => s + (l.amount ?? 0), 0));
  const charges = r2(n(c.cuttingCharge) + n(c.loadingCharge) + n(c.unloadingCharge) + n(c.transportCharge));
  const discount = n(c.discount);

  // Amount per GST rate, in the order the rates first appear.
  const groups: { rate: number; amount: number }[] = [];
  const add = (rate: number, amount: number) => {
    const g = groups.find((x) => x.rate === rate);
    if (g) g.amount += amount; else groups.push({ rate, amount });
  };
  for (const l of priced) add(l.gstRate, l.amount ?? 0);

  // The discount goes over the lines in proportion; any rounding remainder lands on the largest group.
  const spread = Math.min(discount, subtotal > 0 ? subtotal : 0);
  if (subtotal > 0 && spread > 0) {
    const shares = groups.map((g) => r2((spread * g.amount) / subtotal));
    let big = 0;
    groups.forEach((g, i) => { if (g.amount > groups[big].amount) big = i; });
    shares[big] = r2(shares[big] + spread - shares.reduce((s, x) => s + x, 0));
    groups.forEach((g, i) => { g.amount = r2(g.amount - shares[i]); });
  }
  // With no priced line there is nothing to spread over: the discount comes off the charges instead.
  const chargesLeft = Math.max(0, charges - (subtotal > 0 ? 0 : discount));
  if (chargesLeft > 0) add(n(chargeGstRate), chargesLeft);

  const taxGroups: TaxGroup[] = groups.filter((g) => g.amount > 0).sort((a, b) => a.rate - b.rate).map((g) => {
    const taxable = r2(g.amount);
    let cgst = 0, sgst = 0, igst = 0;
    if (interState) igst = r2((taxable * g.rate) / 100);
    else { cgst = r2((taxable * g.rate) / 200); sgst = cgst; }
    return { rate: g.rate, taxable, cgst, sgst, igst };
  });

  const sum = (k: 'taxable' | 'cgst' | 'sgst' | 'igst') => r2(taxGroups.reduce((s, g) => s + g[k], 0));
  const taxable = sum('taxable'), cgst = sum('cgst'), sgst = sum('sgst'), igst = sum('igst');
  const beforeRound = r2(taxable + cgst + sgst + igst);
  const grandTotal = Math.round(beforeRound);
  return {
    totalKg: r2(lines.reduce((s, l) => s + n(l.kg), 0)), subtotal, charges, discount: Math.min(discount, subtotal + charges),
    taxable, cgst, sgst, igst, roundOff: r2(grandTotal - beforeRound), grandTotal, taxGroups,
  };
}

/** Outside Tamil Nadu (GSTIN state code 33) means IGST. No GSTIN: assume a local sale. */
export const isInterState = (gstin: string | null | undefined): boolean => !!gstin && gstin.trim().length >= 2 && !gstin.trim().startsWith('33');

const INR = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 255622.5 → "2,55,622.50" (Indian grouping, no locale registration needed). */
export const inr = (v: number | null | undefined): string => INR.format(Number(v) || 0);

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (v: number): string => (v < 20 ? ONES[v] : `${TENS[Math.floor(v / 10)]}${v % 10 ? ' ' + ONES[v % 10] : ''}`);
const below1000 = (v: number): string => (v < 100 ? below100(v) : `${ONES[Math.floor(v / 100)]} Hundred${v % 100 ? ' ' + below100(v % 100) : ''}`);

function indian(v: number): string {
  const parts: string[] = [];
  const take = (unit: number, name: string) => {
    if (v < unit) return;
    parts.push(`${name === 'Crore' ? indian(Math.floor(v / unit)) : below100(Math.floor(v / unit))} ${name}`);
    v %= unit;
  };
  take(10_000_000, 'Crore'); take(100_000, 'Lakh'); take(1_000, 'Thousand');
  if (v > 0) parts.push(below1000(v));
  return parts.join(' ');
}

/** "Rupees Six Thousand Five Hundred Seventeen Only": Indian numbering, as printed on the quotation. */
export function inWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  return `Rupees ${rupees === 0 ? 'Zero' : indian(rupees)}${paise > 0 ? ` and ${below100(paise)} Paise` : ''} Only`;
}
