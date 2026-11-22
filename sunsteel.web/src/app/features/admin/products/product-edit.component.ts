import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { absUrl } from '../../../core/api.config';
import { apiError } from '../../../core/models/api.model';
import { MediaItem } from '../../../core/models/media.model';
import { AdminApiService, ProductFull, SaveProduct } from '../../../core/services/admin-api.service';
import { IconComponent } from '../../../shared/icon.component';
import { MediaPickerComponent } from '../media/media-picker.component';

const STATES = ['In stock', 'Limited', 'On order'];

/**
 * One product. The URL and family are fixed (they are the public address); everything a visitor reads can be
 * changed here: summary, sizes, chemistry, mechanical properties, equivalents, stock, price note, photo and search text.
 * Summary and search text left empty stay automatic.
 */
@Component({
  selector: 'ss-product-edit',
  imports: [FormsModule, RouterLink, IconComponent, MediaPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/admin/products" class="mb-3 inline-block text-[13px] text-[#6B7485] hover:underline">← All products</a>
    @if (loading()) {
      <div class="card text-[#6B7485]">Loading…</div>
    } @else if (p(); as p) {
      <header class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-[22px] font-medium">{{ p.name }}</h1>
          <p class="mt-0.5 text-[13.5px] text-[#6B7485]">{{ p.sku }} · {{ p.siloName }} · <a [href]="'/products/' + p.siloKey + '/' + p.slug + '/'" class="underline">View on website</a></p>
        </div>
        <div class="flex items-center gap-2">
          @if (dirty()) { <span class="pill pill-warn">Unsaved changes</span> }
          <button type="button" class="abtn abtn-pri" [disabled]="saving() || !dirty()" (click)="save()">{{ saving() ? 'Saving…' : 'Save product' }}</button>
        </div>
      </header>

      @if (message(); as m) { <p class="alert mb-4" [class.alert-ok]="m.ok" role="status">{{ m.text }}</p> }

      <div class="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div class="grid content-start gap-5">
          <fieldset class="card grid gap-4">
            <legend class="sr-only">Basics</legend>
            <b class="font-medium">Basics</b>
            <label class="alabel">Name<input class="ainput" maxlength="160" name="name" [(ngModel)]="f.name" (ngModelChange)="touch()" /></label>
            <label class="alabel">Summary<textarea class="ainput" maxlength="600" name="summary" [(ngModel)]="f.summary" (ngModelChange)="touch()"></textarea>
              <span class="ahint">One or two sentences under the name. Leave empty to use the automatic text.</span></label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="alabel">Sizes<input class="ainput" maxlength="200" name="sizeRange" [(ngModel)]="f.sizeRange" (ngModelChange)="touch()" placeholder="e.g. Ø10 – Ø300 mm" /></label>
              <label class="alabel">Condition<input class="ainput" maxlength="120" name="condition" [(ngModel)]="f.condition" (ngModelChange)="touch()" placeholder="e.g. Hardened and tempered" /></label>
              <label class="alabel">Machinability<input class="ainput" maxlength="20" name="mach" [(ngModel)]="f.machinability" (ngModelChange)="touch()" placeholder="e.g. Good" /></label>
              <label class="alabel">Price note<input class="ainput" maxlength="120" name="price" [(ngModel)]="f.priceNote" (ngModelChange)="touch()" placeholder="Shown only if filled, e.g. Price on request" /></label>
            </div>
            <label class="alabel">Applications<input class="ainput" maxlength="400" name="apps" [(ngModel)]="f.applications" (ngModelChange)="touch()" placeholder="Shafts, gears, bolts…" /></label>
            <label class="alabel">Equivalent grades (one per line)<textarea class="ainput" name="eq" [(ngModel)]="equivalents" (ngModelChange)="touch()"></textarea></label>
            <label class="alabel">Also called: trade names customers search for (one per line)<textarea class="ainput" name="aliases" [(ngModel)]="aliases" (ngModelChange)="touch()" placeholder="MS polish rod&#10;MS polish flat"></textarea>
              <span class="ahint">Shown on the product page, in its FAQ and in the site search. Use the words customers type, e.g. "I beam". Under 400 characters in total.</span></label>
          </fieldset>

          <fieldset class="card grid gap-3">
            <legend class="sr-only">Chemistry</legend>
            <b class="font-medium">Chemical composition (%)</b>
            @for (c of f.chemistry; track $index; let i = $index) {
              <div class="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                <input class="ainput" placeholder="Element e.g. C" [name]="'ce' + i" [(ngModel)]="c.el" (ngModelChange)="touch()" />
                <input class="ainput" placeholder="Min" [name]="'cmin' + i" [(ngModel)]="c.min" (ngModelChange)="touch()" />
                <input class="ainput" placeholder="Max" [name]="'cmax' + i" [(ngModel)]="c.max" (ngModelChange)="touch()" />
                <button type="button" class="abtn abtn-sm abtn-danger" (click)="removeChem(i)" aria-label="Remove element"><ss-icon name="trash" [size]="13" /></button>
              </div>
            }
            <div><button type="button" class="abtn abtn-sm" (click)="addChem()"><ss-icon name="plus" [size]="13" />Add element</button></div>
          </fieldset>

          <fieldset class="card grid gap-3">
            <legend class="sr-only">Mechanical</legend>
            <b class="font-medium">Mechanical properties</b>
            @for (m of f.mechanical; track $index; let i = $index) {
              <div class="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
                <input class="ainput" placeholder="Property e.g. Tensile" [name]="'mk' + i" [(ngModel)]="m.k" (ngModelChange)="touch()" />
                <input class="ainput" placeholder="Value e.g. 850–1000 MPa" [name]="'mv' + i" [(ngModel)]="m.v" (ngModelChange)="touch()" />
                <button type="button" class="abtn abtn-sm abtn-danger" (click)="removeMech(i)" aria-label="Remove property"><ss-icon name="trash" [size]="13" /></button>
              </div>
            }
            <div><button type="button" class="abtn abtn-sm" (click)="addMech()"><ss-icon name="plus" [size]="13" />Add property</button></div>
          </fieldset>
        </div>

        <div class="grid content-start gap-5">
          <fieldset class="card grid gap-3">
            <legend class="sr-only">Photo</legend>
            <b class="font-medium">Photograph</b>
            @if (photoUrl()) {
              <img class="aspect-[4/3] w-full rounded-md object-cover" [src]="photoUrl()" alt="" />
            } @else {
              <div class="grid aspect-[4/3] place-items-center rounded-md border border-dashed border-[#B8BFCC] text-[13px] text-[#8A93A3]">No photo yet: a metal-texture graphic is shown</div>
            }
            <div class="flex flex-wrap gap-2">
              <button type="button" class="abtn" (click)="choosing.set(true)">{{ photoUrl() ? 'Change photo' : 'Choose photo' }}</button>
              @if (photoUrl()) { <button type="button" class="abtn abtn-danger" (click)="clearPhoto()">Remove</button> }
            </div>
          </fieldset>

          <fieldset class="card grid gap-3">
            <legend class="sr-only">Visibility</legend>
            <b class="font-medium">Stock &amp; visibility</b>
            <div class="flex flex-wrap gap-1.5">
              @for (s of states; track s) {
                <button type="button" class="abtn abtn-sm" [class.abtn-pri]="f.stockStatus === s" (click)="f.stockStatus = s; touch()">{{ s }}</button>
              }
            </div>
            <label class="flex items-center gap-2 text-[13.5px]"><input type="checkbox" name="pub" [(ngModel)]="f.isPublished" (ngModelChange)="touch()" /> Show on the website</label>
          </fieldset>

          <fieldset class="card grid gap-3">
            <legend class="sr-only">Search text</legend>
            <b class="font-medium">Google search text</b>
            <label class="alabel">Page title<input class="ainput" maxlength="160" name="mt" [(ngModel)]="f.metaTitle" (ngModelChange)="touch()" placeholder="Automatic" />
              <span class="ahint">{{ (f.metaTitle || '').length }}/160. Leave empty for the automatic title.</span></label>
            <label class="alabel">Description<textarea class="ainput" maxlength="320" name="md" [(ngModel)]="f.metaDescription" (ngModelChange)="touch()" placeholder="Automatic"></textarea>
              <span class="ahint">{{ (f.metaDescription || '').length }}/320. Leave empty for the automatic description.</span></label>
          </fieldset>
        </div>
      </div>

      <div class="mt-6 flex justify-end"><button type="button" class="abtn abtn-pri" [disabled]="saving() || !dirty()" (click)="save()">{{ saving() ? 'Saving…' : 'Save product' }}</button></div>
    } @else if (message(); as m) {
      <p class="alert">{{ m.text }}</p>
    }

    @if (choosing()) {
      <ss-media-picker kind="image" title="Choose a photo for this product" (picked)="pick($event)" (closed)="choosing.set(false)" />
    }`,
})
export class ProductEditComponent {
  private readonly api = inject(AdminApiService);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly states = STATES;
  protected readonly p = signal<ProductFull | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly dirty = signal(false);
  protected readonly choosing = signal(false);
  protected readonly photoUrl = signal<string | null>(null);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);

  protected f!: SaveProduct;
  protected equivalents = '';
  protected aliases = '';

  constructor() {
    this.api.product(this.id).subscribe({
      next: (p) => { this.load(p); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.message.set({ ok: false, text: apiError(e) }); },
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onUnload(e: BeforeUnloadEvent): void {
    if (this.dirty()) e.preventDefault();
  }

  private load(p: ProductFull): void {
    this.p.set(p);
    this.f = {
      name: p.name, sizeRange: p.sizeRange, applications: p.applications, summary: p.summary, condition: p.condition, machinability: p.machinability,
      chemistry: p.chemistry.map((c) => ({ ...c })), mechanical: p.mechanical.map((m) => ({ ...m })), equivalents: p.equivalents, aliases: p.aliases,
      stockStatus: p.stockStatus, priceNote: p.priceNote, metaTitle: p.metaTitle, metaDescription: p.metaDescription, isPublished: p.isPublished, heroMediaId: p.heroMediaId,
    };
    this.equivalents = p.equivalents.join('\n');
    this.aliases = p.aliases.join('\n');
    this.photoUrl.set(p.heroUrl ? absUrl(p.heroUrl) : null);
    this.dirty.set(false);
  }

  protected touch(): void { this.dirty.set(true); this.message.set(null); }
  protected addChem(): void { this.f.chemistry = [...this.f.chemistry, { el: '', min: '', max: '' }]; this.touch(); }
  protected removeChem(i: number): void { this.f.chemistry = this.f.chemistry.filter((_, k) => k !== i); this.touch(); }
  protected addMech(): void { this.f.mechanical = [...this.f.mechanical, { k: '', v: '' }]; this.touch(); }
  protected removeMech(i: number): void { this.f.mechanical = this.f.mechanical.filter((_, k) => k !== i); this.touch(); }

  protected pick(m: MediaItem): void {
    this.choosing.set(false);
    this.f.heroMediaId = m.id;
    const widths = Object.keys(m.variants).map(Number).sort((a, b) => a - b);
    const w = widths.find((x) => x >= 480) ?? widths[widths.length - 1];
    this.photoUrl.set(absUrl(w ? m.variants[w] : m.url));
    this.touch();
  }

  protected clearPhoto(): void {
    this.f.heroMediaId = null;
    this.photoUrl.set(null);
    this.touch();
  }

  protected save(): void {
    this.saving.set(true);
    this.message.set(null);
    const body: SaveProduct = {
      ...this.f,
      equivalents: this.equivalents.split('\n').map((s) => s.trim()).filter(Boolean),
      aliases: this.aliases.split('\n').map((s) => s.trim()).filter(Boolean),
      chemistry: this.f.chemistry.filter((c) => c.el.trim()),
      mechanical: this.f.mechanical.filter((m) => m.k.trim()),
    };
    this.api.saveProduct(this.id, body).subscribe({
      next: (p) => { this.load(p); this.saving.set(false); this.message.set({ ok: true, text: 'Saved. The product page shows it now.' }); },
      error: (e) => { this.saving.set(false); this.message.set({ ok: false, text: apiError(e) }); },
    });
  }
}
