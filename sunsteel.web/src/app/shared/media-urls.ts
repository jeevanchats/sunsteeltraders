import { absUrl } from '../core/api.config';
import { MediaItem } from '../core/models/media.model';

const widths = (m: MediaItem): number[] => Object.keys(m.variants ?? {}).map(Number).sort((a, b) => a - b);

/** The smallest stored size that is at least `minWidth` pixels wide (or the largest there is), as a full URL. */
export function variantUrl(m: MediaItem | null | undefined, minWidth: number): string {
  if (!m) return '';
  const w = widths(m);
  const pick = w.find((x) => x >= minWidth) ?? w[w.length - 1];
  return absUrl(pick ? m.variants[String(pick)] : m.url);
}

/** A `srcset` over every stored size, or null when there is only one. */
export function variantSet(m: MediaItem | null | undefined): string | null {
  if (!m) return null;
  const w = widths(m);
  return w.length > 1 ? w.map((x) => `${absUrl(m.variants[String(x)])} ${x}w`).join(', ') : null;
}
