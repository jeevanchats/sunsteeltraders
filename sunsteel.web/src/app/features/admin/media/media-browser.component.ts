import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { absUrl } from '../../../core/api.config';
import { apiError } from '../../../core/models/api.model';
import { MediaItem } from '../../../core/models/media.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { IconComponent } from '../../../shared/icon.component';

type KindFilter = 'all' | 'image' | 'video';
interface UploadJob { id: number; name: string; state: 'uploading' | 'done' | 'error'; message?: string }

const MAX_IMAGE = 25 * 1024 * 1024;
const MAX_VIDEO = 80 * 1024 * 1024;

/**
 * The media library. In `manage` mode a click opens a detail panel (alt text, caption,
 * category, delete). In `pick` mode a click hands the item to the parent, which is how the
 * page editor chooses a hero photo or video.
 */
@Component({
  selector: 'ss-media-browser',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4" [class.lg:grid-cols-[1fr_340px]]="mode() === 'manage' && selected()">
      <div class="min-w-0">
        <!-- upload -->
        <label class="mb-4 flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-[#B8BFCC] bg-white px-4 py-4 text-[13.5px] transition-colors"
               [class.!border-accent]="dragging()" [class.bg-[#FBFBF9]]="dragging()"
               (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
          <span class="flex items-center gap-3 text-[#4A5465]"><ss-icon name="plus" [size]="20" />
            <span><b class="font-medium text-[#1D2430]">Upload</b> by dropping files here or choosing them.
              <span class="ahint block">{{ kind() === 'video' ? 'MP4 or WebM, up to 80 MB.' : kind() === 'image' ? 'JPG, PNG or WebP, up to 25 MB. Converted to fast WebP automatically.' : 'Photos (JPG, PNG, WebP, up to 25 MB) and videos (MP4 or WebM, up to 80 MB).' }}</span></span></span>
          <span class="abtn">Choose files</span>
          <input type="file" class="sr-only" multiple [accept]="accept()" (change)="onPick($event)" />
        </label>

        @for (j of uploads(); track j.id) {
          <p class="alert mb-2 flex items-center justify-between gap-3" [class.alert-ok]="j.state === 'done'" [class.alert-warn]="j.state === 'uploading'">
            <span class="min-w-0 truncate"><b class="font-medium">{{ j.name }}</b> — {{ j.state === 'uploading' ? 'uploading…' : j.state === 'done' ? 'uploaded' : j.message }}</span>
            @if (j.state !== 'uploading') { <button type="button" class="abtn abtn-sm" (click)="dismiss(j.id)">Dismiss</button> }
          </p>
        }

        <!-- filters -->
        <div class="mb-4 flex flex-wrap items-center gap-2">
          @if (kind() === 'any') {
            @for (k of kinds; track k.v) {
              <button type="button" class="abtn abtn-sm" [class.abtn-pri]="kindFilter() === k.v" (click)="setKind(k.v)">{{ k.label }}</button>
            }
          }
          <select class="ainput !h-[30px] !w-auto !py-0 text-[12.5px]" [ngModel]="category()" (ngModelChange)="setCategory($event)" aria-label="Category">
            <option value="">All categories</option>
            @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
          </select>
          <input class="ainput !h-[30px] !w-[200px] !py-0 text-[12.5px] max-sm:!w-full" type="search" placeholder="Search name or caption" [ngModel]="query()" (ngModelChange)="setQuery($event)" aria-label="Search" />
          <span class="ml-auto text-[12.5px] text-[#6B7485]">{{ total() }} item{{ total() === 1 ? '' : 's' }}</span>
        </div>

        <!-- grid -->
        @if (loading() && !items().length) {
          <div class="card text-[#6B7485]">Loading…</div>
        } @else if (!items().length) {
          <div class="card text-[#6B7485]">Nothing here yet. Upload a {{ kind() === 'video' ? 'video' : 'photo' }} above to get started.</div>
        } @else {
          <ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-0">
            @for (m of items(); track m.id) {
              <li>
                <button type="button" class="block w-full overflow-hidden rounded-lg border border-[#E3E6EB] bg-white p-0 text-left transition-shadow hover:shadow-md"
                        [class.outline]="isChosen(m)" [class.outline-2]="isChosen(m)" [class.outline-accent]="isChosen(m)"
                        (click)="choose(m)">
                  <span class="relative block aspect-[4/3] bg-[#0F243E]">
                    @if (multi() && isChosen(m)) {
                      <span class="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-[var(--color-accent)] text-[13px] font-bold text-[#0F243E]">✓</span>
                    }
                    @if (m.kind === 'video') {
                      <video class="h-full w-full object-cover" [src]="url(m) + '#t=0.1'" preload="metadata" muted playsinline></video>
                      <span class="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10.5px] uppercase tracking-wider text-white">Video</span>
                    } @else {
                      <img class="h-full w-full object-cover" [src]="thumb(m)" [alt]="m.altText || m.fileName" loading="lazy" />
                    }
                  </span>
                  <span class="block px-2.5 pb-2.5 pt-2">
                    <span class="block truncate text-[12.5px] font-medium">{{ m.caption || m.altText || m.fileName }}</span>
                    <span class="block text-[11.5px] text-[#6B7485]">{{ m.category || 'No category' }} · {{ size(m.sizeBytes) }}</span>
                  </span>
                </button>
              </li>
            }
          </ul>
          @if (mode() === 'pick' && multi() && chosen().length) {
            <div class="sticky bottom-0 mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#E3E6EB] bg-white p-3 shadow-lg">
              <span class="text-[13.5px]">{{ chosen().length }} selected</span>
              <span class="flex gap-2">
                <button type="button" class="abtn" (click)="chosen.set([])">Clear</button>
                <button type="button" class="abtn abtn-pri" (click)="addChosen()">Add {{ chosen().length }} photo{{ chosen().length === 1 ? '' : 's' }}</button>
              </span>
            </div>
          }
          @if (items().length < total()) {
            <div class="mt-4 text-center"><button type="button" class="abtn" [disabled]="loading()" (click)="more()">{{ loading() ? 'Loading…' : 'Load more' }}</button></div>
          }
        }
      </div>

      <!-- detail panel -->
      @if (mode() === 'manage' && selected(); as s) {
        <aside class="card h-fit lg:sticky lg:top-6" aria-label="Details">
          <div class="mb-3 flex items-center justify-between">
            <b class="font-medium">{{ s.kind === 'video' ? 'Video' : 'Photo' }} details</b>
            <button type="button" class="abtn abtn-sm" (click)="selected.set(null)" aria-label="Close"><ss-icon name="x" [size]="14" /></button>
          </div>
          <div class="mb-3 overflow-hidden rounded-lg bg-[#0F243E]">
            @if (s.kind === 'video') { <video class="w-full" [src]="url(s)" controls preload="metadata" playsinline></video> }
            @else { <img class="w-full" [src]="thumb(s, 960)" [alt]="s.altText || s.fileName" /> }
          </div>
          <p class="mb-3 break-all text-[12px] text-[#6B7485]">{{ s.fileName }}@if (s.width) { · {{ s.width }} × {{ s.height }} px } · {{ size(s.sizeBytes) }}</p>
          <div class="grid gap-3">
            <label class="alabel">Description (alt text)
              <input class="ainput" [(ngModel)]="edit.altText" maxlength="300" name="alt" />
              <span class="ahint">Read aloud by screen readers and used by search engines. Describe what the picture shows.</span>
            </label>
            <label class="alabel">Caption
              <input class="ainput" [(ngModel)]="edit.caption" maxlength="300" name="cap" />
            </label>
            <label class="alabel">Category
              <select class="ainput" [(ngModel)]="edit.category" name="cat">
                <option value="">No category</option>
                @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
              </select>
            </label>
          </div>
          @if (panelMessage(); as m) { <p class="alert mt-3" [class.alert-ok]="m.ok" role="status">{{ m.text }}</p> }
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="abtn abtn-pri" [disabled]="busy()" (click)="saveDetails()">{{ busy() ? 'Saving…' : 'Save' }}</button>
            <button type="button" class="abtn" (click)="copyUrl(s)">Copy link</button>
            <button type="button" class="abtn abtn-danger ml-auto" [disabled]="busy()" (click)="remove(s)">Delete</button>
          </div>
        </aside>
      }
    </div>`,
})
export class MediaBrowserComponent {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = input<'manage' | 'pick'>('manage');
  /** Limit what is shown and uploaded; 'any' shows photos and videos. */
  readonly kind = input<'image' | 'video' | 'any'>('any');
  /** In pick mode, let several items be ticked and added together (used by the galleries). */
  readonly multi = input(false);
  readonly picked = output<MediaItem>();
  readonly pickedMany = output<MediaItem[]>();

  protected readonly kinds: { v: KindFilter; label: string }[] = [
    { v: 'all', label: 'All' }, { v: 'image', label: 'Photos' }, { v: 'video', label: 'Videos' },
  ];
  protected readonly items = signal<MediaItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly categories = signal<string[]>([]);
  protected readonly kindFilter = signal<KindFilter>('all');
  protected readonly category = signal('');
  protected readonly query = signal('');
  protected readonly selected = signal<MediaItem | null>(null);
  protected readonly chosen = signal<MediaItem[]>([]);
  protected readonly uploads = signal<UploadJob[]>([]);
  protected readonly dragging = signal(false);
  protected readonly busy = signal(false);
  protected readonly panelMessage = signal<{ ok: boolean; text: string } | null>(null);
  protected edit = { altText: '', caption: '', category: '' };

  private page = 1;
  private jobId = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;

  protected readonly accept = computed(() =>
    this.kind() === 'image' ? 'image/jpeg,image/png,image/webp,image/gif'
      : this.kind() === 'video' ? 'video/mp4,video/webm'
      : 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm');

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
    this.api.mediaCategories().subscribe((c) => this.categories.set(c));
    queueMicrotask(() => this.reload());
  }

  // --- listing ---

  private effectiveKind(): string | undefined {
    const k = this.kind();
    if (k !== 'any') return k;
    return this.kindFilter() === 'all' ? undefined : this.kindFilter();
  }

  private reload(): void {
    this.page = 1;
    this.fetch(true);
  }

  private fetch(replace: boolean): void {
    this.loading.set(true);
    this.api.mediaList({ kind: this.effectiveKind(), category: this.category() || undefined, q: this.query() || undefined, page: this.page, pageSize: 24 }).subscribe({
      next: (r) => {
        this.items.update((cur) => (replace ? r.items : [...cur, ...r.items]));
        this.total.set(r.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected more(): void {
    this.page++;
    this.fetch(false);
  }

  protected setKind(k: KindFilter): void { this.kindFilter.set(k); this.reload(); }
  protected setCategory(c: string): void { this.category.set(c); this.reload(); }
  protected setQuery(q: string): void {
    this.query.set(q);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reload(), 350);
  }

  // --- selection / details ---

  protected choose(m: MediaItem): void {
    if (this.mode() === 'pick') {
      if (this.multi()) this.chosen.update((l) => (l.some((c) => c.id === m.id) ? l.filter((c) => c.id !== m.id) : [...l, m]));
      else this.picked.emit(m);
      return;
    }
    this.selected.set(m);
    this.edit = { altText: m.altText ?? '', caption: m.caption ?? '', category: m.category ?? '' };
    this.panelMessage.set(null);
  }

  protected isChosen(m: MediaItem): boolean {
    return this.selected()?.id === m.id || this.chosen().some((c) => c.id === m.id);
  }

  protected addChosen(): void {
    this.pickedMany.emit(this.chosen());
    this.chosen.set([]);
  }

  protected saveDetails(): void {
    const s = this.selected();
    if (!s) return;
    this.busy.set(true);
    this.api.updateMedia(s.id, { altText: this.edit.altText, caption: this.edit.caption, category: this.edit.category }).subscribe({
      next: (m) => {
        this.items.update((l) => l.map((x) => (x.id === m.id ? m : x)));
        this.selected.set(m);
        this.busy.set(false);
        this.panelMessage.set({ ok: true, text: 'Saved.' });
      },
      error: (e) => { this.busy.set(false); this.panelMessage.set({ ok: false, text: apiError(e) }); },
    });
  }

  protected remove(m: MediaItem): void {
    if (!confirm(`Delete "${m.fileName}"? Any page using it will show the default picture instead. This can't be undone.`)) return;
    this.busy.set(true);
    this.api.deleteMedia(m.id).subscribe({
      next: () => {
        this.items.update((l) => l.filter((x) => x.id !== m.id));
        this.total.update((t) => Math.max(0, t - 1));
        this.selected.set(null);
        this.busy.set(false);
      },
      error: (e) => { this.busy.set(false); this.panelMessage.set({ ok: false, text: apiError(e) }); },
    });
  }

  protected copyUrl(m: MediaItem): void {
    const full = typeof location === 'undefined' ? m.url : new URL(absUrl(m.url), location.origin).href;
    navigator.clipboard?.writeText(full).then(() => this.panelMessage.set({ ok: true, text: 'Link copied.' }), () => this.panelMessage.set({ ok: false, text: full }));
  }

  // --- upload ---

  protected onPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.upload(files);
  }

  protected onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.dragging.set(false);
    this.upload(Array.from(ev.dataTransfer?.files ?? []));
  }

  protected dismiss(id: number): void {
    this.uploads.update((l) => l.filter((j) => j.id !== id));
  }

  private upload(files: File[]): void {
    const queue = files.filter((f) => {
      const isVideo = f.type.startsWith('video/');
      const isImage = f.type.startsWith('image/');
      const job: UploadJob = { id: ++this.jobId, name: f.name, state: 'error' };
      const reject = (message: string) => this.uploads.update((l) => [...l, { ...job, message }]);
      if (this.kind() === 'image' && !isImage) { reject('Only photos can be added here.'); return false; }
      if (this.kind() === 'video' && !isVideo) { reject('Only videos can be added here.'); return false; }
      if (!isVideo && !isImage) { reject('Not a photo or video.'); return false; }
      if (isVideo && f.size > MAX_VIDEO) { reject('Video is over 80 MB. Compress it first (1080p, 10–20 seconds, no sound is plenty).'); return false; }
      if (isImage && f.size > MAX_IMAGE) { reject('Photo is over 25 MB.'); return false; }
      return true;
    });
    this.runQueue(queue);
  }

  /** One at a time, so a big video doesn't starve the others and the server stays responsive. */
  private runQueue(queue: File[]): void {
    const file = queue.shift();
    if (!file) return;
    const job: UploadJob = { id: ++this.jobId, name: file.name, state: 'uploading' };
    this.uploads.update((l) => [...l, job]);
    const set = (patch: Partial<UploadJob>) => this.uploads.update((l) => l.map((j) => (j.id === job.id ? { ...j, ...patch } : j)));
    this.api.uploadMedia(file, { category: this.category() || undefined }).subscribe({
      next: (m) => {
        set({ state: 'done' });
        this.items.update((l) => [m, ...l]);
        this.total.update((t) => t + 1);
        this.runQueue(queue);
      },
      error: (e) => { set({ state: 'error', message: apiError(e) }); this.runQueue(queue); },
    });
  }

  // --- display helpers ---

  protected url(m: MediaItem): string { return absUrl(m.url); }

  protected thumb(m: MediaItem, want = 480): string {
    const widths = Object.keys(m.variants).map(Number).sort((a, b) => a - b);
    const pick = widths.find((w) => w >= want) ?? widths[widths.length - 1];
    return absUrl(pick ? m.variants[pick] : m.url);
  }

  protected size(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
}
