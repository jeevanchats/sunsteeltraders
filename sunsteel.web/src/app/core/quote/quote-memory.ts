/**
 * Small conveniences kept in this browser only (never sent anywhere): the last price per kg used for each material,
 * and recently typed brands and descriptions for suggestions. Storage can be blocked or empty (private window, cleared
 * site data), so every access is wrapped and the page works without it.
 */
const RATES = 'sst.quote.rates';
const RECENT = 'sst.quote.recent';
const MAX_RECENT = 40;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* blocked or full: the page works without it */
  }
}

export const lastRates = (): Record<string, number> => read<Record<string, number>>(RATES, {});

export function rememberRates(items: { materialKey: string | null; ratePerKg: number }[]): void {
  const rates = lastRates();
  for (const i of items) if (i.materialKey && i.ratePerKg > 0) rates[i.materialKey] = i.ratePerKg;
  write(RATES, rates);
}

export const recentText = (): { brands: string[]; descriptions: string[] } => read(RECENT, { brands: [], descriptions: [] });

export function rememberText(items: { brand: string | null; description: string | null; itemType: string }[]): void {
  const r = recentText();
  const push = (list: string[], v: string | null) => {
    const t = (v ?? '').trim();
    if (!t) return list;
    return [t, ...list.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
  };
  for (const i of items) {
    if (i.itemType === 'Calculated') continue;
    r.brands = push(r.brands, i.brand);
    r.descriptions = push(r.descriptions, i.description);
  }
  write(RECENT, r);
}
