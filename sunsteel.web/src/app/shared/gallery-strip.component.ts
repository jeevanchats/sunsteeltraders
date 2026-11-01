import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, computed, effect, inject, input, signal, viewChild, viewChildren } from '@angular/core';
import { GalleryCard } from '../core/models/media.model';
import { GalleryViewerComponent } from './gallery-viewer.component';
import { variantSet, variantUrl } from './media-urls';

/** The narrowest a card can be (phones): used to work out how many copies fill a wide screen. */
const CARD_MIN_PX = 170;
const FILL_PX = 2600;
/** With fewer photos than this one row is enough. */
const TWO_ROWS_FROM = 8;
const FRICTION = 3.1;

interface CardState { el: HTMLElement; img: HTMLElement; baseX: number; s: number; a: number; p: number }
interface RowState {
  vp: HTMLElement; track: HTMLElement; cards: CardState[]; setSize: number;
  /** How far the row has moved to the left, always within one repeat of the photos. */
  o: number; v: number; dir: 1 | -1; w: number;
  down: boolean; moved: boolean; sx: number; so: number; lx: number; lt: number; vt: number; pid: number | null;
}

/**
 * The home-page gallery: two rows of photo cards drifting in opposite directions (one row when there are only a few photos).
 * Hovering eases the drift to a stop and releasing eases it back; a row can be grabbed and flung and keeps gliding before it drifts
 * again; the card nearest the middle is the largest and brightest, and each photo shifts a little against the slide for depth.
 * Click or tap a photo to see it large in the viewer, which also has a grid of every photo.
 *
 * One animation loop moves both rows with transforms only, runs only while the gallery is on screen and the tab is visible, and keeps
 * the same speed on every screen. Visitors who prefer reduced motion get still rows they scroll by hand.
 */
@Component({
  selector: 'ss-gallery-strip',
  imports: [GalleryViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #root class="gs" [class.gs-still]="reduced()" role="region" aria-label="Photo gallery">
      @for (row of rows(); track $index; let r = $index) {
        <div #vp class="gs-row" tabindex="-1" (pointerdown)="down($event, r)" (pointermove)="move($event, r)" (pointerup)="up($event, r)" (pointercancel)="up($event, r)"
             (pointerenter)="enter($event)" (pointerleave)="leave($event)" (keydown)="keyNudge($event)">
          <ul #track class="gs-track">
            @for (c of row; track $index) {
              <li class="gs-card" [attr.aria-hidden]="c.copy ? 'true' : null">
                <button type="button" class="gs-btn" [attr.tabindex]="c.copy ? -1 : 0" [attr.aria-label]="c.item.title || 'Open photo ' + (c.index + 1)" (click)="open(c.index, $event)">
                  <span class="gs-ph" [style.background-image]="c.item.media?.placeholder ? 'url(' + c.item.media!.placeholder + ')' : null" aria-hidden="true"></span>
                  <img class="gs-img" [src]="card(c.item)" [attr.srcset]="set(c.item)" sizes="(min-width: 1100px) 250px, (min-width: 640px) 200px, 170px"
                       [alt]="c.item.title || ''" width="250" height="312" draggable="false" [attr.loading]="warm() || $index < 8 ? 'eager' : 'lazy'" decoding="async" />
                  @if (c.item.title) { <span class="gs-cap">{{ c.item.title }}</span> }
                </button>
              </li>
            }
          </ul>
        </div>
      }
      <button type="button" class="gs-arrow gs-arrow-prev" (click)="nudge(-1)" aria-label="Slide the photos back">
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4l-7 7 7 7"/></svg>
      </button>
      <button type="button" class="gs-arrow gs-arrow-next" (click)="nudge(1)" aria-label="Slide the photos forward">
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4l7 7-7 7"/></svg>
      </button>
    </div>
    <div class="mt-7 pb-[clamp(40px,6vw,80px)] text-center">
      <button type="button" class="btn btn-ghost" (click)="openAll()">View all {{ items().length }} photos</button>
    </div>

    @if (viewer(); as v) {
      <ss-gallery-viewer [items]="items()" [start]="v.index" [startGrid]="v.grid" (closed)="closeViewer()" />
    }`,
  styles: `
    :host { display: block; }
    .gs { --cw: 158px; --gap: 12px; position: relative; display: grid; gap: var(--gap); }
    @media (min-width: 640px) { .gs { --cw: 200px; --gap: 16px; } }
    @media (min-width: 1100px) { .gs { --cw: 250px; --gap: 18px; } }
    .gs-row { overflow: hidden; touch-action: pan-y; cursor: grab; user-select: none; -webkit-user-select: none; padding-block: 14px; margin-block: -14px; -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
    .gs-row:active { cursor: grabbing; }
    .gs-track { position: relative; display: flex; width: max-content; margin: 0; padding: 0; list-style: none; will-change: transform; }
    .gs-card { flex: none; width: var(--cw); margin-right: var(--gap); will-change: transform, opacity; }
    .gs-btn { position: relative; display: block; width: 100%; aspect-ratio: 4 / 5; overflow: hidden; border-radius: 14px; background: var(--color-primary); text-align: left; transition: transform .35s cubic-bezier(.2, .8, .2, 1), box-shadow .35s; }
    .gs-ph { position: absolute; inset: 0; background-size: cover; background-position: center; }
    .gs-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scale(1.16); will-change: transform; }
    .gs-cap { position: absolute; inset: auto 0 0 0; padding: 34px 14px 12px; background: linear-gradient(transparent, rgb(0 0 0 / .72)); color: #fff; font-family: var(--font-serif, serif); font-size: 17px; line-height: 1.2; opacity: 0; transform: translateY(8px); transition: opacity .3s, transform .3s; }
    @media (hover: hover) {
      .gs-btn:hover { transform: translateY(-6px); box-shadow: 0 18px 36px rgb(0 0 0 / .28); }
      .gs-btn:hover .gs-cap, .gs-btn:focus-visible .gs-cap { opacity: 1; transform: none; }
    }
    .gs-btn:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 3px; }
    .gs-arrow { position: absolute; top: 50%; z-index: 2; display: none; place-items: center; width: 48px; height: 48px; margin-top: -24px; border-radius: 50%; background: rgb(255 255 255 / .92); color: #111; box-shadow: 0 6px 20px rgb(0 0 0 / .22); transition: transform .2s, background .2s; }
    .gs-arrow:hover { background: #fff; transform: scale(1.06); }
    .gs-arrow-prev { left: 18px; } .gs-arrow-next { right: 18px; }
    @media (min-width: 900px) and (hover: hover) { .gs-arrow { display: grid; } }
    /* reduced motion: still rows, moved by hand */
    .gs-still .gs-row { overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none; cursor: auto; }
    .gs-still .gs-card { scroll-snap-align: start; }
    .gs-still .gs-card[aria-hidden='true'], .gs-still .gs-arrow { display: none; }
    .gs-still .gs-img { transform: none; }
  `,
})
export class GalleryStripComponent {
  readonly items = input.required<GalleryCard[]>();
  /** Pixels per second the rows drift. */
  readonly speed = input(50);

  protected readonly reduced = signal(false);
  protected readonly warm = signal(false);
  protected readonly viewer = signal<{ index: number; grid: boolean } | null>(null);

  /** The photos for each row, repeated until one repeat is wider than any screen, then twice so the loop has no seam. */
  protected readonly rows = computed(() => {
    const list = this.items();
    if (!list.length) return [];
    const all = list.map((item, index) => ({ item, index }));
    const lanes = list.length >= TWO_ROWS_FROM ? [all.filter((_, i) => i % 2 === 0), all.filter((_, i) => i % 2 === 1)] : [all];
    return lanes.map((lane) => {
      const repeats = Math.max(1, Math.ceil(FILL_PX / (lane.length * CARD_MIN_PX)));
      const one = Array.from({ length: lane.length * repeats }, (_, i) => lane[i % lane.length]);
      return this.reduced() ? one.map((x) => ({ ...x, copy: 0 })) : [...one.map((x) => ({ ...x, copy: 0 })), ...one.map((x) => ({ ...x, copy: 1 }))];
    });
  });

  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly vps = viewChildren<ElementRef<HTMLElement>>('vp');
  private readonly tracks = viewChildren<ElementRef<HTMLElement>>('track');
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  private state: RowState[] = [];
  private raf = 0;
  private last = 0;
  private visible = false;
  private tabVisible = true;
  private hovering = false;
  private holdUntil = 0;
  private drift = 1;
  private dragged = false;
  private vw = 0;

  constructor() {
    afterNextRender(() => {
      if (!this.browser) return;
      this.reduced.set(matchMedia('(prefers-reduced-motion: reduce)').matches);
      const destroy = this.destroyRef;

      const io = new IntersectionObserver(([e]) => {
        this.visible = e.isIntersecting;
        if (e.isIntersecting) this.warm.set(true);
        this.kick();
      }, { rootMargin: '200px 0px' });
      io.observe(this.root().nativeElement);
      setTimeout(() => this.measure(), 80);

      const ro = new ResizeObserver(() => this.measure());
      ro.observe(this.root().nativeElement);
      const onVis = () => { this.tabVisible = !document.hidden; this.kick(); };
      document.addEventListener('visibilitychange', onVis);
      destroy.onDestroy(() => { io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); cancelAnimationFrame(this.raf); });
    });
    // Whenever the photos or the number of rows change, find the new elements again.
    effect(() => { this.rows(); this.reduced(); if (this.browser) setTimeout(() => this.measure(), 80); });
  }

  protected card(it: GalleryCard): string { return variantUrl(it.media, 520); }
  protected set(it: GalleryCard): string | null { return variantSet(it.media); }

  // --- the viewer ------------------------------------------------------------

  protected open(index: number, e: Event): void {
    if (this.dragged) { e.preventDefault(); return; }
    this.viewer.set({ index, grid: false });
  }
  protected openAll(): void { this.viewer.set({ index: 0, grid: true }); }
  protected closeViewer(): void { this.viewer.set(null); }

  // --- measuring -------------------------------------------------------------

  private measure(): void {
    if (!this.browser || this.reduced()) { this.state = []; return; }
    const vps = this.vps().map((x) => x.nativeElement);
    const tracks = this.tracks().map((x) => x.nativeElement);
    const old = this.state;
    this.state = vps.map((vp, r) => {
      const track = tracks[r];
      const lis = [...track.children] as HTMLElement[];
      const half = lis.length / 2;
      const setSize = lis.length ? lis[half].offsetLeft - lis[0].offsetLeft : 0;
      const prev = old[r];
      return {
        vp, track, setSize, w: vp.clientWidth,
        cards: lis.map((el) => ({ el, img: el.querySelector('.gs-img') as HTMLElement, baseX: el.offsetLeft + el.offsetWidth / 2, s: 1, a: 1, p: 0 })),
        o: prev?.o ?? 0, v: prev?.v ?? 0, dir: r % 2 === 0 ? 1 : -1,
        down: false, moved: false, sx: 0, so: 0, lx: 0, lt: 0, vt: 0, pid: null,
      } as RowState;
    });
    this.vw = this.root().nativeElement.clientWidth;
    this.kick();
  }

  // --- the loop --------------------------------------------------------------

  private kick(): void {
    const should = this.visible && this.tabVisible && this.state.length > 0 && !this.reduced();
    if (should && !this.raf) { this.last = 0; this.raf = requestAnimationFrame((t) => this.frame(t)); }
    else if (!should && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  }

  private frame(t: number): void {
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0.016;
    this.last = t;
    const hold = this.hovering || this.viewer() !== null || t < this.holdUntil || this.state.some((s) => s.down);
    this.drift += ((hold ? 0 : 1) - this.drift) * (1 - Math.exp(-dt / (hold ? 0.22 : 0.45)));
    const speed = this.speed();
    for (const s of this.state) {
      if (!s.setSize) continue;
      if (!s.down) {
        s.o += (s.dir * speed * this.drift + s.v) * dt;
        s.v *= Math.exp(-dt * FRICTION);
        if (Math.abs(s.v) < 2) s.v = 0;
      }
      s.o = ((s.o % s.setSize) + s.setSize) % s.setSize;
      s.track.style.transform = `translate3d(${(-s.o).toFixed(2)}px,0,0)`;
      this.depth(s);
    }
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  /** Larger and brighter toward the middle, smaller and dimmer toward the edges, with the photo shifting against the slide. */
  private depth(s: RowState): void {
    const half = this.vw / 2 || 1;
    for (const c of s.cards) {
      const x = c.baseX - s.o;
      if (x < -300 || x > this.vw + 300) continue;
      const d = (x - half) / half;
      const ad = Math.min(1, Math.abs(d));
      const scale = 1 - 0.09 * ad ** 1.5;
      const alpha = 1 - 0.5 * ad ** 1.7;
      const shift = -d * 13;
      if (Math.abs(scale - c.s) > 0.002 || Math.abs(alpha - c.a) > 0.01) { c.el.style.transform = `scale(${scale.toFixed(3)})`; c.el.style.opacity = alpha.toFixed(2); c.s = scale; c.a = alpha; }
      if (Math.abs(shift - c.p) > 0.3) { c.img.style.transform = `translate3d(${shift.toFixed(1)}px,0,0) scale(1.16)`; c.p = shift; }
    }
  }

  // --- pointer ---------------------------------------------------------------

  protected enter(e: PointerEvent): void { if (e.pointerType === 'mouse') this.hovering = true; }
  protected leave(e: PointerEvent): void { if (e.pointerType === 'mouse') this.hovering = false; }

  protected down(e: PointerEvent, r: number): void {
    const s = this.state[r];
    if (!s || (e.pointerType === 'mouse' && e.button !== 0)) return;
    s.down = true; s.moved = false; s.pid = e.pointerId; s.sx = e.clientX; s.so = s.o; s.lx = e.clientX; s.lt = e.timeStamp; s.vt = 0; s.v = 0;
    this.dragged = false;
  }

  protected move(e: PointerEvent, r: number): void {
    const s = this.state[r];
    if (!s || !s.down || e.pointerId !== s.pid) return;
    const dx = e.clientX - s.sx;
    if (!s.moved && Math.abs(dx) > 6) { s.moved = true; try { s.vp.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ } }
    if (!s.moved) return;
    s.o = s.so - dx;
    const dt = (e.timeStamp - s.lt) / 1000;
    if (dt > 0.001) { s.vt = s.vt * 0.6 + ((s.lx - e.clientX) / dt) * 0.4; s.lx = e.clientX; s.lt = e.timeStamp; }
  }

  protected up(e: PointerEvent, r: number): void {
    const s = this.state[r];
    if (!s || !s.down || e.pointerId !== s.pid) return;
    s.down = false; s.pid = null;
    if (s.moved) {
      this.dragged = true;
      setTimeout(() => { this.dragged = false; }, 0);
      // a flick keeps gliding; a stop (no recent movement) does not
      s.v = e.timeStamp - s.lt > 90 ? 0 : Math.max(-3200, Math.min(3200, s.vt));
    }
    if (e.pointerType !== 'mouse') this.holdUntil = performance.now() + 1600;
  }

  // --- buttons and keys ------------------------------------------------------

  protected nudge(d: number): void {
    const cardW = this.state[0]?.cards[0]?.el.offsetWidth ?? 220;
    for (const s of this.state) s.v += d * s.dir * FRICTION * cardW * 2.2;
    this.kick();
  }

  protected keyNudge(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight') { e.preventDefault(); this.nudge(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.nudge(-1); }
  }
}
