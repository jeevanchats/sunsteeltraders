import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, inject, input, signal, viewChild } from '@angular/core';

/**
 * A short silent film that loops, for a page section. It starts only once enough of it is on screen and stops when it
 * scrolls away, so it costs nothing until it is seen (the file is not even fetched before then). The poster picture shows
 * until it plays, and stays for visitors who prefer reduced motion. There is always a play/pause button, so the motion can be stopped.
 */
@Component({
  selector: 'ss-loop-video',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="relative m-0 aspect-video w-full overflow-hidden bg-primary">
      <video #v class="absolute inset-0 h-full w-full object-cover" [attr.poster]="poster()" muted loop playsinline preload="none"
             [attr.aria-label]="label()" (play)="playing.set(true)" (pause)="playing.set(false)">
        <source [src]="src()" type="video/mp4" />
      </video>
      <button type="button" (click)="toggle()" [attr.aria-label]="playing() ? 'Pause the video' : 'Play the video'"
              class="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-offset-2">
        @if (playing()) {
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>
        } @else {
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5z"/></svg>
        }
      </button>
    </figure>`,
  styles: `:host { display: block; }`,
})
export class LoopVideoComponent {
  readonly src = input.required<string>();
  readonly poster = input<string | null>(null);
  /** What the film shows, for people who cannot see it. */
  readonly label = input('');

  protected readonly playing = signal(false);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('v');
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  /** Set once the visitor pauses it themselves: scrolling back then does not restart it. */
  private pausedByUser = false;
  private reduced = false;

  constructor() {
    afterNextRender(() => {
      if (!this.browser) return;
      const el = this.video().nativeElement;
      el.muted = true; // browsers only autoplay silent video
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (this.reduced) return;
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !this.pausedByUser) void el.play().catch(() => undefined);
        else if (!e.isIntersecting) el.pause();
      }, { threshold: 0.35 });
      io.observe(el);
      inject(DestroyRef).onDestroy(() => io.disconnect());
    });
  }

  protected toggle(): void {
    const el = this.video().nativeElement;
    if (el.paused) { this.pausedByUser = false; void el.play().catch(() => undefined); }
    else { this.pausedByUser = true; el.pause(); }
  }
}
