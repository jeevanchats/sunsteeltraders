import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { thumbUrl } from '../../../core/media-url';
import { apiError } from '../../../core/models/api.model';
import { MediaItem } from '../../../core/models/media.model';
import { AdminApiService, SlideAdmin } from '../../../core/services/admin-api.service';
import { IconComponent } from '../../../shared/icon.component';
import { MediaPickerComponent } from '../media/media-picker.component';

interface Row {
  id?: number;
  media: MediaItem;
  title: string;
  caption: string;
  ctaText: string;
  linkUrl: string;
  visible: boolean;
}

const BANNER_RATIO = 3840 / 1400;

/**
 * The slideshow at the top of the home page. Banners are chosen from the media library, put in order, shown or
 * hidden, and each carries the title, description, button text and link shown in the bar under the banner.
 * With no slides saved here the website shows its four built-in banners.
 */
@Component({
  selector: 'ss-slides-admin',
  imports: [FormsModule, IconComponent, MediaPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-[22px] font-medium">Home slideshow</h1>
        <p class="mt-0.5 max-w-[70ch] text-[13.5px] text-[#6B7485]">The banners at the very top of the home page. Upload each banner under Photographs first, then add it here, put the slides in order with the arrows, and save.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        @if (dirty()) { <span class="pill pill-warn">Unsaved changes</span> }
        <a href="/" class="abtn"><ss-icon name="ext" [size]="15" />View site</a>
        <button type="button" class="abtn abtn-pri" [disabled]="saving() || loading() || !dirty()" (click)="save()">{{ saving() ? 'Saving…' : 'Save slides' }}</button>
      </div>
    </header>

    @if (message(); as m) { <p class="alert mb-4" [class.alert-ok]="m.ok" role="status">{{ m.text }}</p> }

    @if (loading()) {
      <div class="card text-[#6B7485]">Loading…</div>
    } @else {
      <p class="card mb-4 !p-3 text-[13px] text-[#6B7485]">
        <b class="font-medium text-[#2B3445]">Banner size:</b> about 3840 × 1400 pixels (wide, 2.74 : 1). Lettering inside the picture is shown whole on computers but small on phones, which is why the title, description and button below are typed separately. A picture of a different shape is cropped to fit.
      </p>

      <div class="mb-4"><button type="button" class="abtn abtn-pri" (click)="adding.set(true)"><ss-icon name="plus" [size]="15" />Add banners</button>
        <span class="ml-3 text-[13px] text-[#6B7485]">{{ rows().length }} slide{{ rows().length === 1 ? '' : 's' }} · {{ visibleCount() }} shown on the site</span></div>

      @if (!rows().length) {
        <div class="card text-center text-[#6B7485]">No slides saved yet, so the website shows its four built-in banners. Add banners here to replace them.</div>
      } @else {
        @if (!visibleCount()) { <p class="alert mb-4">Every slide is hidden, so the website falls back to its built-in banners.</p> }
        <ul class="m-0 grid list-none gap-3 p-0">
          @for (r of rows(); track $index; let i = $index) {
            <li class="card grid gap-4 !p-3 lg:grid-cols-[280px_1fr_auto]" [class.opacity-60]="!r.visible">
              <div>
                <img class="aspect-[2.743/1] w-full rounded-md object-cover" [src]="thumb(r.media)" [alt]="r.media.altText || r.media.fileName" />
                @if (!wide(r.media)) { <p class="ahint mt-1.5 !text-[#9A5B00]">Not a wide banner: it will be cropped.</p> }
              </div>
              <div class="grid content-start gap-2.5">
                <label class="alabel">Title<input class="ainput" maxlength="120" [(ngModel)]="r.title" (ngModelChange)="touch()" [name]="'t' + i" placeholder="e.g. Bars: round, flat, square and hex" /></label>
                <label class="alabel">Short description<input class="ainput" maxlength="300" [(ngModel)]="r.caption" (ngModelChange)="touch()" [name]="'c' + i" placeholder="One line under the title" /></label>
                <div class="grid gap-2.5 sm:grid-cols-[1fr_1.4fr]">
                  <label class="alabel">Button text<input class="ainput" maxlength="60" [(ngModel)]="r.ctaText" (ngModelChange)="touch()" [name]="'b' + i" placeholder="e.g. Browse steel bars" /></label>
                  <label class="alabel">Button link<input class="ainput" maxlength="300" [(ngModel)]="r.linkUrl" (ngModelChange)="touch()" [name]="'l' + i" placeholder="/products/, /contact-us/ or https://…" /></label>
                </div>
              </div>
              <div class="flex flex-row items-start gap-1.5 lg:flex-col">
                <button type="button" class="abtn abtn-sm" [disabled]="i === 0" (click)="move(i, -1)" aria-label="Move earlier"><ss-icon name="up" [size]="13" /></button>
                <button type="button" class="abtn abtn-sm" [disabled]="i === rows().length - 1" (click)="move(i, 1)" aria-label="Move later"><ss-icon name="down" [size]="13" /></button>
                <button type="button" class="abtn abtn-sm" (click)="toggle(i)" [attr.aria-pressed]="r.visible" [title]="r.visible ? 'Shown on the website' : 'Hidden'">{{ r.visible ? 'Shown' : 'Hidden' }}</button>
                <button type="button" class="abtn abtn-sm abtn-danger" (click)="remove(i)" aria-label="Remove"><ss-icon name="trash" [size]="13" /></button>
              </div>
            </li>
          }
        </ul>
        <p class="ahint mt-3">The picture's description for screen readers comes from its Alt text under Photographs (the title is used if that is empty).</p>
      }

      <div class="mt-6 flex justify-end">
        <button type="button" class="abtn abtn-pri" [disabled]="saving() || !dirty()" (click)="save()">{{ saving() ? 'Saving…' : 'Save slides' }}</button>
      </div>
    }

    @if (adding()) {
      <ss-media-picker kind="image" title="Add banners: tick as many as you like" [multi]="true" (pickedMany)="addMany($event)" (closed)="adding.set(false)" />
    }`,
})
export class SlidesAdminComponent {
  private readonly api = inject(AdminApiService);

  protected readonly rows = signal<Row[]>([]);
  protected readonly dirty = signal(false);
  protected readonly visibleCount = computed(() => this.rows().filter((r) => r.visible).length);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly adding = signal(false);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);

  constructor() {
    this.api.slides().subscribe({
      next: (items) => { this.apply(items); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.message.set({ ok: false, text: apiError(e) }); },
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onUnload(e: BeforeUnloadEvent): void {
    if (this.dirty()) e.preventDefault();
  }

  private apply(items: SlideAdmin[]): void {
    this.rows.set(items.filter((i) => i.media).map((i) => ({
      id: i.id, media: i.media!, title: i.title ?? '', caption: i.caption ?? '', ctaText: i.ctaText ?? '', linkUrl: i.linkUrl ?? '', visible: i.visible,
    })));
    this.dirty.set(false);
  }

  protected touch(): void {
    this.dirty.set(true);
    this.message.set(null);
  }

  private mutate(fn: (rows: Row[]) => Row[]): void {
    this.rows.update(fn);
    this.touch();
  }

  protected addMany(items: MediaItem[]): void {
    this.adding.set(false);
    this.mutate((rows) => [...rows, ...items.map((m): Row => ({ media: m, title: '', caption: '', ctaText: '', linkUrl: '', visible: true }))]);
  }

  protected move(i: number, d: -1 | 1): void {
    this.mutate((rows) => {
      const j = i + d;
      if (j < 0 || j >= rows.length) return rows;
      const c = [...rows];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  }

  protected toggle(i: number): void {
    this.mutate((rows) => rows.map((r, k) => (k === i ? { ...r, visible: !r.visible } : r)));
  }

  protected remove(i: number): void {
    this.mutate((rows) => rows.filter((_, k) => k !== i));
  }

  protected save(): void {
    this.saving.set(true);
    this.message.set(null);
    this.api.saveSlides(this.rows().map((r) => ({
      id: r.id, mediaId: r.media.id, title: r.title, caption: r.caption, ctaText: r.ctaText, linkUrl: r.linkUrl, visible: r.visible,
    }))).subscribe({
      next: (items) => {
        this.apply(items);
        this.saving.set(false);
        this.message.set({ ok: true, text: 'Saved. The website shows the slideshow now.' });
      },
      error: (e) => { this.saving.set(false); this.message.set({ ok: false, text: apiError(e) }); },
    });
  }

  protected thumb(m: MediaItem): string {
    return thumbUrl(m, 960);
  }

  /** True when the picture is close to the slideshow's 2.74 : 1 frame. */
  protected wide(m: MediaItem): boolean {
    return !!m.width && !!m.height && Math.abs(m.width / m.height - BANNER_RATIO) < 0.2;
  }
}
