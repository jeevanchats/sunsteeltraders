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
const TRANSITION_MS = 1000;
const SWIPE_PX = 40;

/**
 * The slideshow at the top of the home page. The banners carry their own lettering, so they are shown whole
 * (never cropped beyond a hair of drift) in a fixed 2.74:1 frame; the real text, button and controls sit in a bar
 * underneath, which keeps the message readable on phones where the lettering in the picture gets small.
 *
 * Slides come from the admin (Home slideshow); until some are saved the four built-in banners show.
 * Motion: the next banner is revealed by a wipe in the direction of travel, over an old banner that stays put (no fades, no gaps),
 * a band of light rides the leading edge like light on polished steel, the picture settles in with a slow push, the heading
 * rises word by word, and each progress bar fills over the slide's 6 s. The bar's CSS animation is the timer, so
 * pausing (pointer over it, focus inside it, tab hidden) pauses the clock. Visitors who prefer reduced motion get
 * plain, instant changes and no automatic advance. Swipe, arrows, keys and the progress bars all work.
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
          <div class="hero-slide absolute inset-0"
               [class.hero-active]="i === position()" [class.hero-in]="i === position() && prev() !== null" [class.hero-leaving]="i === prev()"
               [class.hero-back]="dir() < 0"
               role="group" aria-roledescription="slide" [attr.aria-label]="(i + 1) + ' of ' + slides().length"
               [attr.aria-hidden]="i === position() ? null : 'true'">
            <div class="hero-inner absolute inset-0">
              @if (s.media) {
                <ss-image class="hero-pic block h-full w-full" [media]="s.media" [alt]="s.alt" sizes="100vw" [priority]="i === 0" />
              } @else {
                <img class="hero-pic h-full w-full object-cover" draggable="false"
                     [src]="src(s, 1280)" [attr.srcset]="srcset(s)" sizes="100vw"
                     width="3840" height="1400" [alt]="s.alt"
                     [attr.loading]="i === 0 ? 'eager' : 'lazy'" [attr.fetchpriority]="i === 0 ? 'high' : null" decoding="async" />
              }
            </div>
          </div>
        }
        @if (prev() !== null) {
          @for (t of [tick()]; track t) { <span class="hero-glint pointer-events-none absolute inset-y-0 z-[3]" [class.hero-glint-back]="dir() < 0" aria-hidden="true"></span> }
        }
        @if (slides().length > 1) {
          <button type="button" class="absolute top-1/2 z-[4] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-[0_2px_10px_rgb(0_0_0/.2)] transition-colors hover:bg-white max-sm:hidden left-[var(--pad)]" aria-label="Previous slide" (click)="step(-1)">
            <ss-icon name="arrow" [size]="16" class="inline-block rotate-180" />
          </button>
          <button type="button" class="absolute top-1/2 z-[4] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow-[0_2px_10px_rgb(0_0_0/.2)] transition-colors hover:bg-white max-sm:hidden right-[var(--pad)]" aria-label="Next slide" (click)="step(1)">
            <ss-icon name="arrow" [size]="16" />
          </button>
        }
      </div>

      <div class="wrap flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-4 sm:py-5">
        <div class="min-w-0 flex-1 basis-[260px]" aria-live="polite">
          @for (c of [current()]; track c.key) {
            <div>
              @if (c.title) {
                <span class="block font-serif text-[clamp(20px,2vw,26px)] leading-tight" [attr.aria-label]="c.title">
                  @for (w of words(c.title); track $index) {
                    <span class="hero-word-mask" aria-hidden="true"><span class="hero-word" [style.animation-delay.ms]="120 + $index * 55">{{ w }}</span></span>{{ ' ' }}
                  }
                </span>
              }
              @if (c.blurb) { <span class="hero-blurb mt-0.5 block text-[14px] leading-snug text-muted">{{ c.blurb }}</span> }
            </div>
          }
        </div>
        <div class="flex w-full flex-wrap items-center justify-between gap-x-5 gap-y-3 sm:w-auto sm:justify-end">
          @if (slides().length > 1) {
            <span class="hidden tabular-nums text-[13px] font-medium sm:block" aria-hidden="true">{{ pad(position() + 1) }}<span class="text-faint"> / {{ pad(slides().length) }}</span></span>
            <div class="flex items-center gap-1.5" role="group" aria-label="Choose a slide">
              @for (s of slides(); track s.key; let i = $index) {
                <button type="button" class="grid h-8 place-items-center px-0.5" [attr.aria-label]="'Show slide ' + (i + 1) + (s.title ? ': ' + s.title : '')"
                        [attr.aria-current]="i === position() ? 'true' : null" (click)="go(i)">
                  <span class="relative block h-[3px] w-7 overflow-hidden rounded-full bg-line sm:w-10">
                    @if (i === position()) {
                      <span class="hero-fill absolute inset-y-0 left-0 block w-full rounded-full bg-accent" [class.hero-fill-run]="auto()"
                            [style.animation-duration.ms]="interval" [style.animation-play-state]="paused() ? 'paused' : 'running'" (animationend)="step(1)"></span>
                    }
                  </span>
                </button>
              }
            </div>
          }
          @if (link(); as l) {
            @if (l.external) { <a [href]="l.path" target="_blank" rel="noopener" class="btn hero-cta">{{ current().cta }}</a> }
            @else { <a [routerLink]="l.path" [fragment]="l.fragment" class="btn hero-cta">{{ current().cta }}</a> }
          }
        </div>
      </div>
    </section>`,
  styles: `
    /* Slides stack; only the shown one (and the one it is covering) is visible. Nothing is faded or dimmed: the new banner slides
       over the old one, which stays exactly as it was, so there is never a gap or a flash of the background behind them. */
    .hero-slide { visibility: hidden; z-index: 0; overflow: hidden; }
    .hero-slide.hero-active, .hero-slide.hero-leaving { visibility: visible; }
    .hero-slide.hero-active { z-index: 2; }
    .hero-slide.hero-leaving { z-index: 1; pointer-events: none; }
    .hero-slide.hero-in, .hero-slide.hero-in .hero-inner { will-change: transform; }

    /* The reveal: the window slides in from one side while the picture inside slides the opposite way by the same amount and
       on the same curve, so the picture itself holds still and is uncovered. Transforms only, so it runs on the GPU. */
    .hero-slide.hero-in { animation: hero-win 1000ms cubic-bezier(.65, 0, .25, 1) both; }
    .hero-slide.hero-in .hero-inner { animation: hero-pic 1000ms cubic-bezier(.65, 0, .25, 1) both; }
    .hero-slide.hero-in.hero-back { animation-name: hero-win-back; }
    .hero-slide.hero-in.hero-back .hero-inner { animation-name: hero-pic-back; }

    /* The slow push. The same animation list is on the shown and the leaving slide, so when a slide starts to leave its animation
       carries on instead of snapping back to its starting size. */
    .hero-slide.hero-active .hero-pic, .hero-slide.hero-leaving .hero-pic {
      animation: hero-settle 1400ms cubic-bezier(.2, .7, .2, 1) both, hero-push 7200ms 1400ms cubic-bezier(.2, 0, .2, 1) both;
    }

    /* A band of light on the leading edge of the wipe: same length, same curve, so it travels with the edge. */
    .hero-glint { left: 0; width: 30%; background: linear-gradient(90deg, transparent, rgb(255 255 255 / .28) 55%, rgb(255 255 255 / .05) 85%, transparent);
      animation: hero-glint 1000ms cubic-bezier(.65, 0, .25, 1) both; will-change: transform; }
    .hero-glint.hero-glint-back { left: auto; right: 0; animation-name: hero-glint-back; transform: scaleX(-1); }

    /* Heading: each word rises out of a mask; then the line under it and the button. */
    .hero-word-mask { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: .12em; margin-bottom: -.12em; }
    .hero-word { display: inline-block; transform: translateY(110%); animation: hero-rise 700ms cubic-bezier(.2, .8, .2, 1) both; }
    .hero-blurb { animation: hero-fade 800ms 420ms cubic-bezier(.2, .8, .2, 1) both; }
    .hero-cta { animation: hero-fade 700ms 520ms cubic-bezier(.2, .8, .2, 1) both; }

    /* Progress: the fill is the timer. */
    .hero-fill { transform: scaleX(0); transform-origin: left; }
    .hero-fill-run { animation-name: hero-fill; animation-timing-function: linear; animation-fill-mode: forwards; }

    @keyframes hero-win { from { transform: translate3d(-100%, 0, 0); } to { transform: translate3d(0, 0, 0); } }
    @keyframes hero-pic { from { transform: translate3d(100%, 0, 0); } to { transform: translate3d(0, 0, 0); } }
    @keyframes hero-win-back { from { transform: translate3d(100%, 0, 0); } to { transform: translate3d(0, 0, 0); } }
    @keyframes hero-pic-back { from { transform: translate3d(-100%, 0, 0); } to { transform: translate3d(0, 0, 0); } }
    @keyframes hero-settle { from { transform: scale(1.06); } to { transform: scale(1); } }
    @keyframes hero-push { from { transform: scale(1); } to { transform: scale(1.02); } }
    @keyframes hero-glint { from { transform: translate3d(-50%, 0, 0); } to { transform: translate3d(283.3%, 0, 0); } }
    @keyframes hero-glint-back { from { transform: scaleX(-1) translate3d(-50%, 0, 0); } to { transform: scaleX(-1) translate3d(283.3%, 0, 0); } }
    @keyframes hero-rise { from { transform: translateY(110%); } to { transform: translateY(0); } }
    @keyframes hero-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes hero-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }

    @media (prefers-reduced-motion: reduce) {
      .hero-slide, .hero-slide *, .hero-glint, .hero-word, .hero-blurb, .hero-cta { animation: none !important; }
      .hero-word { transform: none; }
      .hero-fill { transform: scaleX(1); }
    }
  `,
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

  protected readonly interval = INTERVAL_MS;
  private readonly index = signal(0);
  /** The slide on its way out, and the way we are travelling (1 forwards, -1 back); both settle once the transition is over. */
  protected readonly prev = signal<number | null>(null);
  protected readonly dir = signal(1);
  protected readonly tick = signal(0);
  /** The shown slide, kept in range if the list shrinks after slides load. */
  protected readonly position = computed(() => this.index() % this.slides().length);
  protected readonly current = computed(() => this.slides()[this.position()]);
  protected readonly link = computed(() => { const l = this.current().link; return l ? parseLink(l) : null; });
  protected readonly hover = signal(false);
  protected readonly focus = signal(false);
  protected startX: number | null = null;

  private readonly reduced = signal(false);
  private readonly hidden = signal(false);
  protected readonly paused = computed(() => this.hover() || this.focus() || this.hidden());
  /** Without reduced motion the progress bar is also the autoplay timer. */
  protected readonly auto = computed(() => !this.reduced());
  private settle: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;   // no timers while rendering on the server
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced.set(mq.matches);
    const onChange = (e: MediaQueryListEvent) => this.reduced.set(e.matches);
    mq.addEventListener('change', onChange);

    const onVisibility = () => this.hidden.set(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.settle);
      mq.removeEventListener('change', onChange);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  protected step(d: number): void {
    const n = this.slides().length;
    this.change((this.position() + d + n) % n, d);
  }
  protected go(i: number): void { if (i !== this.position()) this.change(i, i > this.position() ? 1 : -1); }

  private change(to: number, d: number): void {
    if (to === this.position()) return;
    this.prev.set(this.reduced() ? null : this.position());
    this.dir.set(d);
    this.index.set(to);
    this.tick.update((t) => t + 1);
    clearTimeout(this.settle);
    this.settle = setTimeout(() => this.prev.set(null), TRANSITION_MS + 150);
  }

  protected words(title: string): string[] { return title.split(' ').filter(Boolean); }
  protected pad(n: number): string { return String(n).padStart(2, '0'); }

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
