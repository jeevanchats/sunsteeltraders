import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Dims, Form } from '../core/weight/weight';

/**
 * A dimensioned cross-section drawing for the calculator ("The scale"). Built as an SVG
 * string from numbers only (labels are escaped), then trusted, because Angular's sanitizer
 * strips SVG from innerHTML. Colours come from the theme tokens.
 */
@Component({
  selector: 'ss-xsection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="h-full w-full" [innerHTML]="svg()"></div>`,
  styles: `:host { display: block; } :host ::ng-deep svg { width: 100%; height: 100%; display: block; }`,
})
export class XsectionComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly form = input.required<Form>();
  readonly dims = input<Dims>({});
  readonly section = input<string | undefined>();

  protected readonly svg = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(drawSection(this.form(), this.dims(), this.section())));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function drawSection(form: Form, d: Dims, sec?: string): string {
  const A = 'var(--color-gold-light)';
  const L = 'color-mix(in srgb, var(--color-on-primary) 75%, transparent)';
  const M = 'color-mix(in srgb, var(--color-on-primary) 28%, transparent)';
  const BG = 'var(--color-primary)';
  const cx = 100, cy = 58, box = 80;
  const n = (k: string) => (d[k] > 0 ? d[k] : 0);
  const t = (x: number, y: number, s: string, anchor = 'middle') =>
    `<text x="${x}" y="${y}" fill="${A}" font-family="Manrope, sans-serif" font-size="7" font-weight="600" text-anchor="${anchor}">${esc(s)}</text>`;
  const dimH = (x1: number, x2: number, y: number, s: string) =>
    `<path d="M${x1} ${y}H${x2}M${x1} ${y - 3}v6M${x2} ${y - 3}v6" stroke="${A}" stroke-width=".6"/>${t((x1 + x2) / 2, y + 9, s)}`;
  const dimV = (y1: number, y2: number, x: number, s: string) =>
    `<path d="M${x} ${y1}V${y2}M${x - 3} ${y1}h6M${x - 3} ${y2}h6" stroke="${A}" stroke-width=".6"/>${t(x + 5, (y1 + y2) / 2 + 2.5, s, 'start')}`;
  const sh = `fill="color-mix(in srgb, var(--color-on-primary) 6%, transparent)" stroke="${L}" stroke-width="1.1"`;
  const hatch = `<defs><pattern id="ssx" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v4" stroke="${M}" stroke-width=".5"/></pattern></defs>`;
  const sc = (vals: number[]) => box / Math.max(...vals, 1);
  let g = '';
  switch (form) {
    case 'round': {
      const r = box / 2;
      g = `<circle cx="${cx}" cy="${cy}" r="${r}" ${sh}/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#ssx)"/>` +
        `<path d="M${cx - r - 6} ${cy}H${cx + r + 6}M${cx} ${cy - r - 6}V${cy + r + 6}" stroke="${M}" stroke-width=".4" stroke-dasharray="4 2 1 2"/>` +
        dimH(cx - r, cx + r, cy + r + 9, `Ø ${n('D')}`);
      break;
    }
    case 'square': {
      const s = box;
      g = `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" ${sh}/><rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" fill="url(#ssx)"/>` +
        dimH(cx - s / 2, cx + s / 2, cy + s / 2 + 9, `${n('W')}`);
      break;
    }
    case 'hex': {
      const r = box / 2 / 0.866;
      const pts = [0, 1, 2, 3, 4, 5].map((i) => `${cx + r * Math.cos((Math.PI / 3) * i)},${cy + r * Math.sin((Math.PI / 3) * i)}`).join(' ');
      g = `<polygon points="${pts}" ${sh}/><polygon points="${pts}" fill="url(#ssx)"/>` + dimV(cy - box / 2, cy + box / 2, cx + r + 8, `A/F ${n('AF')}`);
      break;
    }
    case 'flat':
    case 'plate': {
      const w = n('W') || 1, th = n('T') || 1;
      const k = Math.min(150 / w, 70 / th);
      const W = Math.max(w * k, 20), H = Math.max(th * k, 3);
      g = `<rect x="${cx - W / 2}" y="${cy - H / 2}" width="${W}" height="${H}" ${sh}/><rect x="${cx - W / 2}" y="${cy - H / 2}" width="${W}" height="${H}" fill="url(#ssx)"/>` +
        dimH(cx - W / 2, cx + W / 2, cy + H / 2 + 10, `${w}`) + dimV(cy - H / 2, cy + H / 2, cx + W / 2 + 6, `${th}`);
      break;
    }
    case 'tube': {
      const r = box / 2, ri = Math.max(r * (1 - (2 * n('WT')) / (n('OD') || 1)), 1);
      g = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#ssx)" stroke="${L}" stroke-width="1.1"/><circle cx="${cx}" cy="${cy}" r="${ri}" fill="${BG}" stroke="${L}" stroke-width="1.1"/>` +
        dimH(cx - r, cx + r, cy + r + 9, `OD ${n('OD')}`) + t(cx, cy + 2.5, `WT ${n('WT')}`);
      break;
    }
    case 'sqpipe':
    case 'rect': {
      const bb = form === 'sqpipe' ? n('A') : n('B');
      const k = sc([n('A'), bb]) * 1.2;
      const W = n('A') * k, H = bb * k, w = Math.max(n('WT') * k, 1.5);
      g = `<rect x="${cx - W / 2}" y="${cy - H / 2}" width="${W}" height="${H}" fill="url(#ssx)" stroke="${L}" stroke-width="1.1"/>` +
        `<rect x="${cx - W / 2 + w}" y="${cy - H / 2 + w}" width="${Math.max(W - 2 * w, 1)}" height="${Math.max(H - 2 * w, 1)}" fill="${BG}" stroke="${L}" stroke-width="1.1"/>` +
        dimH(cx - W / 2, cx + W / 2, cy + H / 2 + 9, `${n('A')}`) + dimV(cy - H / 2, cy + H / 2, cx + W / 2 + 6, `${bb} × ${n('WT')}`);
      break;
    }
    case 'angle': {
      const k = sc([n('A'), n('B')]);
      const W = n('A') * k, H = n('B') * k, T = Math.max(n('T') * k, 2);
      const x = cx - W / 2, y = cy - H / 2, xl = x - 10;
      const p = `M${x} ${y}V${y + H}H${x + W}V${y + H - T}H${x + T}V${y}Z`;
      g = `<path d="${p}" ${sh}/><path d="${p}" fill="url(#ssx)"/>` + dimH(x, x + W, y + H + 9, `${n('A')}`) +
        `<path d="M${xl} ${y}V${y + H}M${xl - 3} ${y}h6M${xl - 3} ${y + H}h6" stroke="${A}" stroke-width=".6"/>` +
        t(xl - 4, y + H / 2 + 2.5, `${n('B')}`, 'end') + t(x + T + 4, y + 10, `t ${n('T')}`, 'start');
      break;
    }
    case 'beam':
    case 'channel': {
      const s = sec || '';
      const depth = +((s.match(/\d+/) || ['200'])[0]);
      const H = 82, W = form === 'beam' ? Math.min(60, Math.max(36, depth * 0.18 + 22)) : Math.min(42, Math.max(26, depth * 0.12 + 18));
      const tf = 8, tw = 5, x = cx - W / 2, y = cy - H / 2;
      const p = form === 'beam'
        ? `M${x} ${y}h${W}v${tf}h${-(W - tw) / 2}v${H - 2 * tf}h${(W - tw) / 2}v${tf}h${-W}v${-tf}h${(W - tw) / 2}v${-(H - 2 * tf)}h${-(W - tw) / 2}z`
        : `M${x} ${y}h${W}v${tf}h${-(W - tw)}v${H - 2 * tf}h${W - tw}v${tf}h${-W}z`;
      g = `<path d="${p}" ${sh}/><path d="${p}" fill="url(#ssx)"/>` + dimV(y, y + H, x + W + 8, s);
      break;
    }
  }
  return `<svg viewBox="0 0 200 125" role="img" aria-label="Cross-section of a ${form}">${hatch}${g}</svg>`;
}
