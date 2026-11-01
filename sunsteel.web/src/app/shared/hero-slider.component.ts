import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaItem, SlideCard } from '../core/models/media.model';
import { IconComponent } from './icon.component';
import { ImageComponent } from './image.component';
import { parseLink } from './link';

/** What one slide needs to draw: either library media (admin-managed) or a built-in file under /hero/. */
interface HeroView {
  key: string | number;
  title: string;
  blurb: string;
  alt: string;
  cta: string;
  link: string | null;
  media: MediaItem | null;
  /** Built-in banners: file stem, {stem}-640.webp, -1280.webp, -1920.webp. */
  stem?: string;
}

/** Shown until slides are saved in the admin (Home slideshow). */
const DEFAULT_SLIDES: HeroView[] = [
  { key: 'bars', stem: 'bars', media: null, title: 'Bars: round, flat, square and hex',
    blurb: 'M.S. polished and black, EN-8 to EN-41B, HCHCR, OHNS and stainless steel.',
    alt: 'Round, flat, square and hex steel bars in EN-8, EN-19, EN-24, EN-31, EN-36, EN-353, EN-41B, HCHCR, OHNS and stainless steel',
    cta: 'Browse steel bars', link: '/products/alloy-engineering-steels/' },
  { key: 'plastics', stem: 'plastics', media: null, title: 'Teflon, nylon, Hylam and cast nylon',
    blurb: 'Rods, rectangles, squares and bushes, plus Teflon sheets.',
    alt: 'Teflon, nylon, Hylam and cast nylon rods, rectangles, squares, bushes and Teflon sheets',
    cta: 'Browse plastics', link: '/products/engineering-plastics/' },
  { key: 'non-ferrous', stem: 'non-ferrous', media: null, title: 'Brass, gun-metal, copper, aluminium and cast iron',
    blurb: 'Rods, flats, squares, bushes, hex and pipes, plus aluminium sheets.',
    alt: 'Brass, gun-metal, copper, aluminium and cast-iron rods, flats, squares, bushes, hex bars and pipes, and aluminium sheets',
    cta: 'Browse non-ferrous', link: '/products/non-ferrous-metals/' },
  { key: 'cutting', stem: 'cutting', media: null, title: 'In-house cutting: our speciality',
    blurb: 'Every material is cut to your size, whatever the quantity or size.',
    alt: "In-house cutting: all materials are cut to size as per the customer's requirement, irrespective of quantity and size",
    cta: 'Ask for a cut quote', link: '/contact-us/' },
];

const WIDTHS = [640, 1280, 1920];
const INTERVAL_MS = 6000;
const SWIPE_PX = 40;

/**
 * The slideshow at the top of the home page. The banners carry their own lettering, so they are shown whole
 * (never cropped) in a fixed 2.74:1 frame; the real text, button and controls sit in a bar underneath, which
 * keeps the message readable on phones where the lettering in the picture gets small.
 *
 * Slides come from the admin (Home slideshow); until some are saved the four built-in banners show.
 * Fades between slides, advances every 6 s, pauses while the pointer is over it or focus is inside it, and
 * does not advance on its own for visitors who prefer reduced motion. Swipe, arrows and dots all work.
 * Only the first picture loads eagerly (it is the page's largest paint); the rest lazy-load.
 */
@Component({
  selector: 'ss-hero-slider',
  imports: [RouterLink, IconComponent, ImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(mouseenter)': 'hover.set(true)',
    '(mouseleave)': 'hover.set(false)',
    '(focusin)': 'focus.set(true)',
    '(focusout)': 'focus.set(false)',
    '(keydown.arrowLeft)': 'step(-1)',
    '(keydown.arrowRight)': 'step(1)',
  },
  template: `
    <section aria-roledescription="carousel" aria-label="Our products and services">
      <div class="relative aspect-[2.743/1] w-full touch-pan-y select-none overflow-hidden bg-primary"
           (pointerdown)="down($event)" (pointerup)="up($event)" (pointercancel)="startX = null">
        @for (s of slides(); track s.key; let i = $index) {
          <div class="absolute inset-0 transition-opacity duration-700 ease-lux motion-reduce:transition-none"
               [class]="i === position() ? 'opacity-100' : 'pointer-events-none opacity-0'"
               role="group" aria-roledescription="slide" [attr.aria-label]="(i + 1) + ' of ' + slides().length"
               [attr.aria-hidden]="i === position() ? null : 'true'">
            @if (s.media) {
              <ss-image class="h-full w-full" [media]="s.media" [alt]="s.alt" sizes="100vw" [priority]="i === 0" />
            } @else {
              <img class="h-full w-full object-cover" draggable="false"
                   [src]="src(s, 1280)" [attr.srcset]="srcset(s)" sizes="100vw"
                   width="3840" height="1400" [alt]="s.alt"
                   [attr.loading]="i === 0 ? 'eager' : 'lazy'" [attr.fetchpriority]="i === 0 ? 'high' : null" decoding="async" />
            }
          </div>
        }
        @if (slides().length > 1) {
          <button type="button" class="absolute top-1/2 z-[1] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-[0_2px_10px_rgb(0_0_0/.2)] transition-colors hover:bg-white max-sm:hidden left-[var(--pad)]" aria-label="Previous slide" (click)="step(-1)">
            <ss-icon name="arrow" [size]="16" class="inline-block rotate-180" />
          </button>
          <button type="button" class="absolute top-1/2 z-[1] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-[0_2px_10px_rgb(0_0_0/.2)] transition-colors hover:bg-white max-sm:hidden right-[var(--pad)]" aria-label="Next slide" (click)="step(1)">
            <ss-icon name="arrow" [size]="16" />
          </button>
        }
      </div>

      <div class="wrap flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-4 sm:py-5">
        <div class="min-w-0 flex-1 basis-[260px]" aria-live="polite">
          @if (current().title) { <span class="block font-serif text-[clamp(20px,2vw,26px)] leading-tight">{{ current().title }}</span> }
          @if (current().blurb) { <span class="mt-0.5 block text-[14px] leading-snug text-muted">{{ current().blurb }}</span> }
        </div>
        <div class="flex items-center gap-5">
          @if (slides().length > 1) {
            <div class="flex items-center gap-1" role="group" aria-label="Choose a slide">
              @for (s of slides(); track s.key; let i = $index) {
                <button type="button" class="grid h-6 w-6 place-items-center" [attr.aria-label]="'Show slide ' + (i + 1) + (s.title ? ': ' + s.title : '')"
                        [attr.aria-current]="i === position() ? 'true' : null" (click)="go(i)">
                  <span class="block h-2 rounded-full transition-all duration-300" [class]="i === position() ? 'w-6 bg-accent' : 'w-2 bg-line'"></span>
                </button>
              }
            </div>
          }
          @if (link(); as l) {
            @if (l.external) { <a [href]="l.path" target="_blank" rel="noopener" class="btn">{{ current().cta }}</a> }
            @else { <a [routerLink]="l.path" [fragment]="l.fragment" class="btn">{{ current().cta }}</a> }
          }
        </div>
      </div>
    </section>`,
})
export class HeroSliderComponent {
  /** Slides saved in the admin; empty or null shows the built-in banners. */
  readonly custom = input<SlideCard[] | null>(null);

  protected readonly slides = computed<HeroView[]>(() => {
    const c = (this.custom() ?? []).filter((x) => x.media);
    if (!c.length) return DEFAULT_SLIDES;
    return c.map((x) => ({
      key: x.id, media: x.media, title: x.title ?? '', blurb: x.caption ?? '',
      alt: x.media!.altText || x.title || '', cta: x.ctaText || 'Learn more', link: x.linkUrl,
    }));
  });

  private readonly index = signal(0);
  /** The shown slide, kept in range if the list shrinks after slides load. */
  protected readonly position = computed(() => this.index() % this.slides().length);
  protected readonly current = computed(() => this.slides()[this.position()]);
  protected readonly link = computed(() => { const l = this.current().link; return l ? parseLink(l) : null; });
  protected readonly hover = signal(false);
  protected readonly focus = signal(false);
  protected startX: number | null = null;

  private readonly reduced = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;   // no timers while rendering on the server
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced.set(mq.matches);
    const onChange = (e: MediaQueryListEvent) => this.reduced.set(e.matches);
    mq.addEventListener('change', onChange);

    const timer = setInterval(() => {
      if (!this.hover() && !this.focus() && !this.reduced() && !document.hidden) this.step(1);
    }, INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => { clearInterval(timer); mq.removeEventListener('change', onChange); });
  }

  protected step(d: number): void {
    const n = this.slides().length;
    this.index.set((this.position() + d + n) % n);
  }
  protected go(i: number): void { this.index.set(i); }

  protected src(s: HeroView, w: number): string { return `/hero/${s.stem}-${w}.webp`; }
  protected srcset(s: HeroView): string { return WIDTHS.map((w) => `${this.src(s, w)} ${w}w`).join(', '); }

  protected down(e: PointerEvent): void { this.startX = e.clientX; }
  protected up(e: PointerEvent): void {
    if (this.startX === null) return;
    const dx = e.clientX - this.startX;
    this.startX = null;
    if (Math.abs(dx) >= SWIPE_PX) this.step(dx < 0 ? 1 : -1);
  }
}
