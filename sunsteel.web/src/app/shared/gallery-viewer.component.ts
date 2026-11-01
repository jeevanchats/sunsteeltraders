import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GalleryCard } from '../core/models/media.model';
import { parseLink } from './link';
import { variantSet, variantUrl } from './media-urls';

/**
 * The full-screen photo viewer for the gallery: one large photo with its title and caption, left and right to move on
 * (arrow keys, buttons, or a swipe on a phone), a strip of small pictures to jump anywhere, and a grid of all the photos.
 * Esc or the close button leaves, focus stays inside while it is open and goes back to where it came from afterwards.
 */
@Component({
  selector: 'ss-gallery-viewer',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Photo viewer', '(keydown)': 'key($event)' },
  template: `
    <div class="vw-top">
      <span class="vw-count" aria-live="polite">@if (grid()) { All {{ items().length }} photos } @else { {{ index() + 1 }} <i>/</i> {{ items().length }} }</span>
      <span class="flex-1"></span>
      <button type="button" class="vw-btn vw-text" (click)="grid.set(!grid())" [attr.aria-pressed]="grid()">{{ grid() ? 'Back to photo' : 'All photos' }}</button>
      <button #closeBtn type="button" class="vw-btn" (click)="close()" aria-label="Close the viewer">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16"/></svg>
      </button>
    </div>

    @if (!grid()) {
      <div class="vw-stage" (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="cancel()">
        @for (it of current(); track it.id) {
          <figure class="vw-fig" [class.vw-next]="dir() > 0" [class.vw-prev]="dir() < 0" [style.transform]="dx() ? 'translate3d(' + dx() + 'px,0,0)' : null" [style.transition]="dragging() ? 'none' : null">
            <span class="vw-ph" [style.background-image]="it.media?.placeholder ? 'url(' + it.media!.placeholder + ')' : null" aria-hidden="true"></span>
            <img [src]="large(it)" [attr.srcset]="set(it)" sizes="100vw" [alt]="it.title || it.media?.altText || ''" draggable="false" />
            @if (it.title || it.caption || it.linkUrl) {
              <figcaption>
                @if (it.title) { <b>{{ it.title }}</b> }
                @if (it.caption) { <span>{{ it.caption }}</span> }
                @if (it.linkUrl; as u) {
                  @let l = parse(u);
                  @if (l.external) { <a [href]="l.path" target="_blank" rel="noopener" class="vw-link">Open page →</a> }
                  @else { <a [routerLink]="l.path" [fragment]="l.fragment" class="vw-link" (click)="close()">Open page →</a> }
                }
              </figcaption>
            }
          </figure>
        }
        @if (items().length > 1) {
          <button type="button" class="vw-nav vw-nav-prev" (click)="step(-1)" aria-label="Previous photo"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4l-7 7 7 7"/></svg></button>
          <button type="button" class="vw-nav vw-nav-next" (click)="step(1)" aria-label="Next photo"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4l7 7-7 7"/></svg></button>
        }
      </div>
      <div #strip class="vw-strip" role="group" aria-label="All photos">
        @for (it of items(); track it.id; let i = $index) {
          <button type="button" class="vw-thumb" [class.on]="i === index()" [attr.aria-label]="'Photo ' + (i + 1) + (it.title ? ': ' + it.title : '')" [attr.aria-current]="i === index() ? 'true' : null" (click)="go(i)">
            <img [src]="thumb(it)" alt="" loading="lazy" decoding="async" draggable="false" />
          </button>
        }
      </div>
    } @else {
      <div class="vw-grid">
        @for (it of items(); track it.id; let i = $index) {
          <button type="button" class="vw-cell" [attr.aria-label]="'Open photo ' + (i + 1) + (it.title ? ': ' + it.title : '')" (click)="pick(i)">
            <img [src]="thumb(it)" alt="" loading="lazy" decoding="async" draggable="false" />
            @if (it.title) { <span>{{ it.title }}</span> }
          </button>
        }
      </div>
    }`,
  styles: `
    :host { position: fixed; inset: 0; z-index: 90; display: flex; flex-direction: column; background: rgb(8 10 14 / .95); color: #fff; backdrop-filter: blur(6px); animation: vw-fade .25s ease both; overscroll-behavior: contain; }
    .vw-top { display: flex; align-items: center; gap: 10px; padding: max(12px, env(safe-area-inset-top)) 14px 8px; }
    .vw-count { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
    .vw-count i { opacity: .5; font-style: normal; margin: 0 2px; }
    .vw-btn { display: grid; place-items: center; min-width: 44px; height: 44px; padding: 0 12px; border-radius: 999px; background: rgb(255 255 255 / .12); color: #fff; font-size: 14px; font-weight: 600; transition: background .15s; }
    .vw-btn:hover { background: rgb(255 255 255 / .24); }
    .vw-btn:focus-visible, .vw-nav:focus-visible, .vw-thumb:focus-visible, .vw-cell:focus-visible, .vw-link:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    .vw-stage { position: relative; flex: 1; min-height: 0; overflow: hidden; touch-action: pan-y; user-select: none; }
    .vw-fig { position: absolute; inset: 0; margin: 0; display: grid; place-items: center; padding: 6px 12px 0; transition: transform .25s cubic-bezier(.2, .8, .2, 1); }
    .vw-fig.vw-next { animation: vw-in-next .38s cubic-bezier(.2, .8, .2, 1) both; }
    .vw-fig.vw-prev { animation: vw-in-prev .38s cubic-bezier(.2, .8, .2, 1) both; }
    .vw-fig img { max-width: 100%; max-height: 100%; min-height: 0; width: auto; height: auto; object-fit: contain; border-radius: 8px; position: relative; z-index: 1; box-shadow: 0 20px 60px rgb(0 0 0 / .5); }
    .vw-ph { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: .25; }
    .vw-fig figcaption { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; display: grid; gap: 4px; padding: 56px 20px 16px; background: linear-gradient(transparent, rgb(0 0 0 / .78)); text-align: left; }
    .vw-fig figcaption b { font-family: var(--font-serif, serif); font-size: clamp(20px, 2.4vw, 28px); font-weight: 500; line-height: 1.15; }
    .vw-fig figcaption span { max-width: 70ch; font-size: 14.5px; line-height: 1.45; opacity: .85; }
    .vw-link { justify-self: start; margin-top: 6px; padding: 9px 16px; border-radius: 999px; background: #fff; color: #111; font-size: 14px; font-weight: 700; }
    .vw-nav { position: absolute; top: 50%; z-index: 3; display: none; place-items: center; width: 52px; height: 52px; margin-top: -26px; border-radius: 50%; background: rgb(255 255 255 / .14); color: #fff; transition: background .15s; }
    .vw-nav:hover { background: rgb(255 255 255 / .3); }
    .vw-nav-prev { left: 16px; } .vw-nav-next { right: 16px; }
    @media (min-width: 768px) { .vw-nav { display: grid; } .vw-fig { padding: 6px 84px 0; } }
    .vw-strip { display: flex; gap: 8px; overflow-x: auto; padding: 10px 14px max(14px, env(safe-area-inset-bottom)); scrollbar-width: none; }
    .vw-strip::-webkit-scrollbar { display: none; }
    .vw-thumb { flex: none; width: 54px; height: 68px; overflow: hidden; border-radius: 8px; opacity: .55; transition: opacity .2s, transform .2s; }
    .vw-thumb img, .vw-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .vw-thumb.on { opacity: 1; transform: translateY(-3px); box-shadow: 0 0 0 2px #fff; }
    .vw-grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 8px 14px max(18px, env(safe-area-inset-bottom)); align-content: start; }
    @media (min-width: 640px) { .vw-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (min-width: 1024px) { .vw-grid { grid-template-columns: repeat(5, 1fr); gap: 12px; padding-inline: 28px; } }
    .vw-cell { position: relative; aspect-ratio: 4 / 5; overflow: hidden; border-radius: 10px; background: #1b2029; }
    .vw-cell span { position: absolute; inset: auto 0 0 0; padding: 22px 10px 8px; background: linear-gradient(transparent, rgb(0 0 0 / .72)); font-size: 13px; text-align: left; }
    @keyframes vw-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes vw-in-next { from { opacity: 0; transform: translate3d(48px, 0, 0) scale(.98); } to { opacity: 1; transform: none; } }
    @keyframes vw-in-prev { from { opacity: 0; transform: translate3d(-48px, 0, 0) scale(.98); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { :host, .vw-fig, .vw-fig.vw-next, .vw-fig.vw-prev { animation: none !important; transition: none !important; } }
  `,
})
export class GalleryViewerComponent {
  readonly items = input.required<GalleryCard[]>();
  readonly start = input(0);
  /** Open on the grid of all photos instead of one photo. */
  readonly startGrid = input(false);
  readonly closed = output<void>();

  protected readonly index = signal(0);
  protected readonly grid = signal(false);
  protected readonly dir = signal(0);
  protected readonly dx = signal(0);
  protected readonly dragging = signal(false);
  protected readonly parse = parseLink;
  protected readonly current = computed(() => { const it = this.items()[this.index()]; return it ? [it] : []; });

  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');
  private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private opener: Element | null = null;
  private sx = 0;
  private pointerId: number | null = null;

  constructor() {
    // The inputs set the starting photo once.
    effect(() => { this.index.set(Math.min(Math.max(0, this.start()), Math.max(0, this.items().length - 1))); this.grid.set(this.startGrid()); });
    effect(() => { this.index(); this.grid(); if (this.browser) queueMicrotask(() => this.scrollThumb()); });
    afterNextRender(() => {
      if (!this.browser) return;
      this.opener = document.activeElement;
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.closeBtn()?.nativeElement.focus();
      this.destroyRef.onDestroy(() => {
        document.body.style.overflow = prev;
        (this.opener as HTMLElement | null)?.focus?.();
      });
    });
  }

  protected large(it: GalleryCard): string { return variantUrl(it.media, 1280); }
  protected set(it: GalleryCard): string | null { return variantSet(it.media); }
  protected thumb(it: GalleryCard): string { return variantUrl(it.media, 320); }

  protected close(): void { this.closed.emit(); }
  protected go(i: number): void { this.dir.set(i >= this.index() ? 1 : -1); this.index.set(i); }
  protected pick(i: number): void { this.dir.set(0); this.index.set(i); this.grid.set(false); }

  protected step(d: number): void {
    const n = this.items().length;
    if (n < 2) return;
    this.dir.set(d);
    this.index.set((this.index() + d + n) % n);
  }

  protected key(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    else if (e.key === 'ArrowRight' && !this.grid()) { e.preventDefault(); this.step(1); }
    else if (e.key === 'ArrowLeft' && !this.grid()) { e.preventDefault(); this.step(-1); }
    else if (e.key === 'Home' && !this.grid()) { e.preventDefault(); this.go(0); }
    else if (e.key === 'End' && !this.grid()) { e.preventDefault(); this.go(this.items().length - 1); }
    else if (e.key === 'Tab') this.trap(e);
  }

  /** Keeps Tab inside the viewer while it is open. */
  private trap(e: KeyboardEvent): void {
    const f = [...this.host.nativeElement.querySelectorAll<HTMLElement>('button, a[href]')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // --- swipe -----------------------------------------------------------------

  protected down(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('button, a')) return;
    this.pointerId = e.pointerId; this.sx = e.clientX; this.dragging.set(true); this.dx.set(0);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  protected move(e: PointerEvent): void { if (e.pointerId === this.pointerId) this.dx.set(e.clientX - this.sx); }
  protected up(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    const d = this.dx();
    this.pointerId = null; this.dragging.set(false); this.dx.set(0);
    if (Math.abs(d) > 60) this.step(d < 0 ? 1 : -1);
  }
  protected cancel(): void { this.pointerId = null; this.dragging.set(false); this.dx.set(0); }

  private scrollThumb(): void {
    const el = this.strip()?.nativeElement.querySelector<HTMLElement>('.vw-thumb.on');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
}
