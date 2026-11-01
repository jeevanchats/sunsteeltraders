/**
 * The four kinds of quotation the customer sells by (migration 017). A tag with defaults: Cut Pieces opens the cutting
 * extra, Project hides loading and unloading, Wholesale also shows the weight in tonnes. All are priced per kg.
 */
export type QuoteType = 'Project' | 'Wholesale' | 'Retail' | 'CutPieces';

export const QUOTE_TYPES: { key: QuoteType; label: string; hint: string }[] = [
  { key: 'Project', label: 'Project', hint: 'Pure trading: bought from a supplier and sent straight to the customer in bulk, never put into stock.' },
  { key: 'Wholesale', label: 'Wholesale', hint: 'Bulk purchases, in tonnes.' },
  { key: 'Retail', label: 'Retail', hint: 'Small purchases, in kg.' },
  { key: 'CutPieces', label: 'Cut pieces', hint: 'Items that include a cutting operation at Sun Steel Traders.' },
];

export const quoteTypeLabel = (t: string | null | undefined): string => QUOTE_TYPES.find((x) => x.key === t)?.label ?? '';

const TONNES = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
/** 12450 kg → "12.45" */
export const tonnes = (kg: number): string => TONNES.format((Number(kg) || 0) / 1000);
