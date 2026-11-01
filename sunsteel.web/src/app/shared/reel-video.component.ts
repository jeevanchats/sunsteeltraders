import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, inject, input, signal, viewChild } from '@angular/core';

/**
 * A long film that plays by itself and keeps looping: it starts, silent, once enough of it is on screen, stops when scrolled away,
 * and carries on from where it stopped. The visitor can pause it, turn the sound on (browsers never allow sound to start by itself),
 * scrub through it and go full screen. The film is not downloaded until it is about to play, and phones, slow connections and
 * "data saver" get the smaller file. Visitors who prefer reduced motion see the poster picture and press play.
 */
@Component({
  selector: 'ss-reel-video',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #box class="reel group relative aspect-video w-full overflow-hidden rounded-[14px] bg-black shadow-[0_24px_60px_rgb(0_0_0/.45)] sm:rounded-[20px]">
      <video #v class="absolute inset-0 h-full w-full object-cover" [attr.poster]="poster()" muted loop playsinline preload="none" [attr.aria-label]="label()"
             (play)="playing.set(true)" (pause)="playing.set(false)" (timeupdate)="tick()" (loadedmetadata)="tick()" (waiting)="buffering.set(true)" (playing)="buffering.set(false)" (canplay)="buffering.set(false)"></video>

      <!-- a big button while it is not playing -->
      @if (!playing()) {
        <button type="button" (click)="toggle()" class="absolute inset-0 grid place-items-center bg-black/25 transition hover:bg-black/15" aria-label="Play the film">
          <span class="grid h-[72px] w-[72px] place-items-center rounded-full bg-white/95 text-primary shadow-xl sm:h-20 sm:w-20">
            <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5z"/></svg>
          </span>
        </button>
      }
      @if (buffering() && playing()) { <span class="absolute right-4 top-4 rounded-full bg-black/55 px-3 py-1 text-[12px] font-medium text-white">Loading…</span> }

      <!-- controls -->
      <div class="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pb-3 pt-10 text-white sm:gap-3 sm:px-5 sm:pb-4">
        <button type="button" class="reel-btn" (click)="toggle()" [attr.aria-label]="playing() ? 'Pause the film' : 'Play the film'">
          @if (playing()) {
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>
          } @else {
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5z"/></svg>
          }
        </button>
        <input type="range" class="reel-seek min-w-0 flex-1" min="0" max="1000" step="1" [value]="progress()" aria-label="Position in the film" (input)="seek($any($event.target).value)" />
        <span class="hidden min-w-[88px] text-right text-[12.5px] tabular-nums opacity-90 sm:block">{{ time(current()) }} / {{ time(total()) }}</span>
        <button type="button" class="reel-btn" (click)="toggleSound()" [attr.aria-label]="muted() ? 'Turn the sound on' : 'Turn the sound off'" [attr.aria-pressed]="!muted()">
          @if (muted()) {
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8v4h3l4 3.5v-11L6 8H3z" fill="currentColor"/><path d="M14 7.5l4 5M18 7.5l-4 5"/></svg>
          } @else {
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8v4h3l4 3.5v-11L6 8H3z" fill="currentColor"/><path d="M13.5 7.2a4 4 0 0 1 0 5.6M15.8 5a7 7 0 0 1 0 10"/></svg>
          }
        </button>
        <button type="button" class="reel-btn" (click)="fullscreen()" aria-label="Full screen">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6.5V2h4.5M11.5 2H16v4.5M16 11.5V16h-4.5M6.5 16H2v-4.5"/></svg>
        </button>
      </div>
    </div>`,
  styles: `
    :host { display: block; }
    .reel-btn { display: grid; flex: none; place-items: center; width: 40px; height: 40px; border-radius: 999px; background: rgb(255 255 255 / .14); transition: background .15s; }
    .reel-btn:hover { background: rgb(255 255 255 / .3); }
    .reel-seek { -webkit-appearance: none; appearance: none; height: 22px; background: transparent; cursor: pointer; }
    .reel-seek::-webkit-slider-runnable-track { height: 4px; border-radius: 4px; background: rgb(255 255 255 / .35); }
    .reel-seek::-moz-range-track { height: 4px; border-radius: 4px; background: rgb(255 255 255 / .35); }
    .reel-seek::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; margin-top: -5px; border-radius: 50%; background: #fff; }
    .reel-seek::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%; background: #fff; }
    .reel-seek:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
  `,
})
export class ReelVideoComponent {
  /** The large file for computers and a lighter one for phones and slow connections. */
  readonly src = input.required<string>();
  readonly srcSmall = input<string | null>(null);
  readonly poster = input<string | null>(null);
  /** What the film shows, for people who cannot see it. */
  readonly label = input('');

  protected readonly playing = signal(false);
  protected readonly muted = signal(true);
  protected readonly buffering = signal(false);
  protected readonly progress = signal(0);
  protected readonly current = signal(0);
  protected readonly total = signal(0);

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('v');
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private loaded = false;
  /** Set when the visitor pauses it themselves: scrolling back does not restart it. */
  private pausedByUser = false;

  constructor() {
    afterNextRender(() => {
      if (!this.browser) return;
      const el = this.video().nativeElement;
      el.muted = true;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !this.pausedByUser) this.play();
        else if (!e.isIntersecting && !document.fullscreenElement) el.pause();
      }, { threshold: 0.4 });
      io.observe(el);
      inject(DestroyRef).onDestroy(() => io.disconnect());
    });
  }

  /** The lighter file for small screens, "data saver" and slow networks. */
  private pickSource(): string {
    const small = this.srcSmall();
    if (!small) return this.src();
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = !!c && (c.saveData === true || ['slow-2g', '2g', '3g'].includes(c.effectiveType ?? ''));
    return slow || matchMedia('(max-width: 700px)').matches ? small : this.src();
  }

  private play(): void {
    const el = this.video().nativeElement;
    if (!this.loaded) { el.src = this.pickSource(); el.load(); this.loaded = true; }
    void el.play().catch(() => undefined);
  }

  protected toggle(): void {
    const el = this.video().nativeElement;
    if (el.paused) { this.pausedByUser = false; this.play(); } else { this.pausedByUser = true; el.pause(); }
  }

  protected toggleSound(): void {
    const el = this.video().nativeElement;
    el.muted = !el.muted;
    this.muted.set(el.muted);
    if (!el.muted && el.paused) { this.pausedByUser = false; this.play(); }
  }

  protected fullscreen(): void {
    const box = this.box().nativeElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void (box.requestFullscreen?.() ?? this.video().nativeElement.requestFullscreen?.());
  }

  protected seek(v: string): void {
    const el = this.video().nativeElement;
    if (!this.loaded) { el.src = this.pickSource(); el.load(); this.loaded = true; }
    if (el.duration) el.currentTime = (Number(v) / 1000) * el.duration;
  }

  protected tick(): void {
    const el = this.video().nativeElement;
    this.current.set(el.currentTime || 0);
    this.total.set(Number.isFinite(el.duration) ? el.duration : 0);
    this.progress.set(el.duration ? Math.round((el.currentTime / el.duration) * 1000) : 0);
  }

  protected time(s: number): string {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }
}
