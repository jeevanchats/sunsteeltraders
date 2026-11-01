import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../core/services/catalog.service';
import { RequestService } from '../core/services/request.service';
import { CALC_FORMS, DEFAULT_LENGTH, DIMS, Dims, FORMULA_TEXT, FORM_NAMES, Form, dimText, formatKg, pieceKg, rectWallFromInside, validate, wallFromId } from '../core/weight/weight';
import { IconComponent } from './icon.component';
import { XsectionComponent } from './xsection.component';

/** What a product page passes in to lock the calculator to that grade. */
export interface ScaleProduct {
  slug: string;
  name: string;
  grade: string;
  materialKey?: string | null;
  forms: Form[];
}

/**
 * "The scale": the weight calculator as a calm navy instrument panel (v3 sheet 04).
 * Used on its own page and inside every product dossier. Results update as you type and
 * "Add to my request" drops the line into the concierge basket.
 */
@Component({
  selector: 'ss-scale',
  imports: [FormsModule, IconComponent, XsectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="on-dark grid gap-10 bg-primary p-[clamp(22px,4vw,48px)] text-on-primary lg:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)] lg:items-center">
      <div class="grid content-start gap-6">
        <div>
          <span class="label mb-3">Shape</span>
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Shape">
            @for (f of forms(); track f) {
              <button type="button" role="radio" [attr.aria-checked]="isShape(f)" (click)="setForm(f)"
                class="chip !text-on-primary" [class]="isShape(f) ? '!border-gold-light !bg-gold-light/15' : '!border-white/20'">{{ formName(f) }}</button>
              @if (f === 'tube' && hasSchedule()) {
                <button type="button" role="radio" [attr.aria-checked]="form() === 'tube' && pipeMode() === 'sch'" (click)="setSchedule()"
                  class="chip !text-on-primary" [class]="form() === 'tube' && pipeMode() === 'sch' ? '!border-gold-light !bg-gold-light/15' : '!border-white/20'">MS pipe (SCH)</button>
              }
            }
          </div>
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          @if (!product()) {
            <label class="fld sm:col-span-2"><span>Material</span>
              <select [ngModel]="materialKey()" (ngModelChange)="materialKey.set($event)" name="mat">
                @for (m of catalog.index().materials; track m.key) { <option [value]="m.key">{{ m.name }} · {{ m.density }} g/cm³</option> }
              </select>
            </label>
          } @else {
            <div class="fld sm:col-span-2"><span>Material</span>
              <p class="border-b border-white/25 py-2 text-[16px]">{{ product()!.grade }} · {{ density() }} g/cm³</p>
            </div>
          }

          @if (form() === 'beam' || form() === 'channel') {
            <label class="fld"><span>Section (IS 808)</span>
              <select [ngModel]="section()" (ngModelChange)="section.set($event)" name="sec">
                @for (s of sections(); track s.designation) { <option [value]="s.designation">{{ s.designation }} · {{ s.kgPerMetre }} kg/m</option> }
              </select>
            </label>
          } @else if (form() === 'tube' && pipeMode() === 'sch') {
            <label class="fld"><span>Nominal size (NPS)</span>
              <select [ngModel]="nps()" (ngModelChange)="setNps($event)" name="nps">
                @for (n of npsList(); track n) { <option [value]="n">{{ n }}</option> }
              </select>
            </label>
            <label class="fld"><span>Schedule</span>
              <select [ngModel]="sch()" (ngModelChange)="setSch($event)" name="sch">
                @for (x of schedules(); track x) { <option [value]="x">{{ x }}</option> }
              </select>
            </label>
            <p class="border-b border-white/25 py-2 text-[15px] sm:col-span-2">@if (pipeRow(); as r) { OD {{ r.odMm }} mm · wall {{ r.wallMm }} mm <span class="opacity-70">(ASME B36.10M)</span> } @else { Choose a size and schedule. }</p>
          } @else {
            @if (form() === 'tube' || form() === 'rect') {
              <div class="flex flex-wrap items-center gap-2 sm:col-span-2" role="radiogroup" aria-label="How the wall is given">
                <span class="label mr-1">Wall given as</span>
                @for (m of wallModes(); track m[0]) {
                  <button type="button" role="radio" [attr.aria-checked]="wallMode() === m[0]" (click)="setWallMode(m[0])"
                    class="chip !text-on-primary" [class]="wallMode() === m[0] ? '!border-gold-light !bg-gold-light/15' : '!border-white/20'">{{ m[1] }}</button>
                }
              </div>
            }
            @for (f of shownFields(); track f[0]) {
              <label class="fld"><span>{{ f[1] }} (mm)</span>
                <input type="number" inputmode="decimal" min="0" step="any" [ngModel]="dims()[f[0]]" (ngModelChange)="setDim(f[0], $event)" [name]="'d' + f[0]" />
              </label>
            }
            @if (form() === 'tube' && pipeMode() === 'id') {
              <label class="fld"><span>Inside dia. (mm)</span>
                <input type="number" inputmode="decimal" min="0" step="any" [ngModel]="inner()['ID']" (ngModelChange)="setInner('ID', $event)" name="dID" />
              </label>
            }
            @if (form() === 'rect' && rectMode() === 'inside') {
              <label class="fld"><span>Inside A (mm)</span>
                <input type="number" inputmode="decimal" min="0" step="any" [ngModel]="inner()['a']" (ngModelChange)="setInner('a', $event)" name="da" />
              </label>
              <label class="fld"><span>Inside B (mm)</span>
                <input type="number" inputmode="decimal" min="0" step="any" [ngModel]="inner()['b']" (ngModelChange)="setInner('b', $event)" name="db" />
              </label>
            }
            @if (wallShown() > 0) {
              <p class="border-b border-white/25 py-2 text-[15px] sm:col-span-2">Wall thickness {{ wallShown() }} mm</p>
            }
          }
          <label class="fld"><span>{{ form() === 'plate' ? 'Length (mm)' : 'Cut length (mm)' }}</span>
            <input type="number" inputmode="decimal" min="0" step="any" [ngModel]="length()" (ngModelChange)="length.set(+$event)" name="len" />
          </label>
          <label class="fld"><span>Pieces</span>
            <input type="number" inputmode="numeric" min="1" step="1" [ngModel]="qty()" (ngModelChange)="qty.set(+$event)" name="qty" />
          </label>
        </div>
        @if (problem()) { <p class="text-[13px] text-[#F2B8A8]" role="alert">{{ problem() }}</p> }
      </div>

      <div class="grid justify-items-center gap-2 text-center">
        <ss-xsection class="aspect-[200/125] w-full max-w-[300px]" [form]="form()" [dims]="eff()" [section]="section()" />
        <output class="mt-2 block font-serif text-[clamp(56px,7vw,84px)] font-medium leading-none" aria-live="polite">
          {{ total() > 0 ? fmt(total()) : '—' }} <em class="text-[0.36em] not-italic text-gold-light">kg</em>
        </output>
        <span class="label">{{ fmt(each()) }} kg each · {{ fmt(perMetre()) }} kg / m</span>
        <div class="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" class="btn" [disabled]="!(total() > 0)" (click)="add()">
            @if (added()) { <ss-icon name="check" [size]="16" />Added } @else { Add to my request }
          </button>
          @if (added()) { <button type="button" class="btn btn-ghost" (click)="requests.open.set(true)">View request · {{ requests.count() }}</button> }
        </div>
      </div>
    </div>
    <p class="mt-4 text-[12.5px] text-muted">{{ formula() }} · ρ = {{ density() }} g/cm³ · rounded to 0.1 kg. Theoretical weight; actual mill weight can vary by ±2–3%.</p>`,
})
export class ScaleComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly requests = inject(RequestService);

  readonly product = input<ScaleProduct | null>(null);
  /** Starting values, e.g. from a size-chart row ("Use in calculator"). */
  readonly preset = input<{ form: Form; dims: Dims; section?: string } | null>(null);

  protected readonly form = signal<Form>('round');
  protected readonly materialKey = signal('alloy');
  protected readonly dims = signal<Dims>({ D: 80 });
  protected readonly section = signal<string | undefined>(undefined);
  protected readonly length = signal(500);
  protected readonly qty = signal(4);
  protected readonly added = signal(false);
  /** Tube / pipe: the wall is typed, worked out from the inside diameter, or taken from the MS pipe schedule. */
  protected readonly pipeMode = signal<'wall' | 'id' | 'sch'>('wall');
  /** Hollow section: the wall is typed, or worked out from the inside sizes. */
  protected readonly rectMode = signal<'wall' | 'inside'>('wall');
  /** Inside diameter (ID) and inside sizes (a, b) when those are what the person knows. */
  protected readonly inner = signal<Record<string, number>>({ ID: 52.5, a: 92, b: 42 });
  protected readonly nps = signal('2 in.');
  protected readonly sch = signal('SCH 40');

  protected readonly forms = computed<Form[]>(() => {
    const p = this.product();
    const allowed = p ? p.forms.filter((f) => CALC_FORMS.includes(f)) : CALC_FORMS;
    return allowed.length ? allowed : CALC_FORMS;
  });
  protected readonly fields = computed(() => DIMS[this.form()] ?? []);
  /** The inputs on show: outside size only when the wall comes from an inside size. */
  protected readonly shownFields = computed(() => {
    const f = this.fields();
    if (this.form() === 'tube' && this.pipeMode() === 'id') return f.filter((x) => x[0] === 'OD');
    if (this.form() === 'rect' && this.rectMode() === 'inside') return f.filter((x) => x[0] !== 'WT');
    return f;
  });
  protected readonly wallMode = computed<'wall' | 'id' | 'inside'>(() => (this.form() === 'tube' ? (this.pipeMode() === 'id' ? 'id' : 'wall') : this.rectMode() === 'inside' ? 'inside' : 'wall'));
  protected readonly wallModes = computed<[string, string][]>(() => [['wall', 'Wall thickness'], [this.form() === 'tube' ? 'id' : 'inside', this.form() === 'tube' ? 'Inside diameter' : 'Inside size']]);

  // --- MS pipe schedule -----------------------------------------------------
  private readonly pipes = computed(() => this.catalog.index().msPipes ?? []);
  protected readonly hasSchedule = computed(() => this.pipes().length > 0 && this.forms().includes('tube'));
  protected readonly npsList = computed(() => [...new Set(this.pipes().map((p) => p.nominalSize))]);
  protected readonly schedules = computed(() => this.pipes().filter((p) => p.nominalSize === this.nps()).map((p) => p.schedule));
  protected readonly pipeRow = computed(() => this.pipes().find((p) => p.nominalSize === this.nps() && p.schedule === this.sch()) ?? null);

  /** The dimensions the weight is worked out from: typed values, or the wall derived from an inside size or the schedule. */
  protected readonly eff = computed<Dims>(() => {
    const d = this.dims();
    if (this.form() === 'tube' && this.pipeMode() === 'id') return { OD: d['OD'], WT: wallFromId(d['OD'], this.inner()['ID']) };
    if (this.form() === 'tube' && this.pipeMode() === 'sch') { const r = this.pipeRow(); return r ? { OD: r.odMm, WT: r.wallMm } : { OD: 0, WT: 0 }; }
    if (this.form() === 'rect' && this.rectMode() === 'inside') return { A: d['A'], B: d['B'], WT: rectWallFromInside(d['A'], d['B'], this.inner()['a'], this.inner()['b']) };
    return d;
  });
  /** The wall to show under the inputs when it was worked out rather than typed. */
  protected readonly wallShown = computed(() => (this.pipeMode() === 'id' && this.form() === 'tube') || (this.rectMode() === 'inside' && this.form() === 'rect') ? this.eff()['WT'] ?? 0 : 0);
  protected readonly sections = computed(() => this.catalog.index().sections.filter((s) => s.kind === this.form()));
  protected readonly density = computed(() => this.catalog.density(this.product()?.materialKey ?? this.materialKey()));
  protected readonly sectionKgM = computed(() => this.catalog.index().sections.find((s) => s.designation === this.section())?.kgPerMetre ?? 0);
  protected readonly problem = computed(() => {
    const d = this.dims(), i = this.inner();
    if (this.form() === 'tube' && this.pipeMode() === 'id' && !(i['ID'] > 0 && i['ID'] < d['OD'])) return 'The inside diameter must be smaller than the outside diameter.';
    if (this.form() === 'tube' && this.pipeMode() === 'sch' && !this.pipeRow()) return 'Choose a nominal size and a schedule.';
    if (this.form() === 'rect' && this.rectMode() === 'inside' && !(this.eff()['WT'] > 0)) return 'The inside sizes must be smaller than the outside sizes and leave the same wall all round: (A − a) ÷ 2 must equal (B − b) ÷ 2.';
    return validate(this.form(), this.eff());
  });
  protected readonly each = computed(() => pieceKg(this.form(), this.eff(), this.length(), this.density(), this.sectionKgM()));
  protected readonly perMetre = computed(() => pieceKg(this.form(), this.eff(), 1000, this.density(), this.sectionKgM()));
  protected readonly total = computed(() => this.each() * Math.max(1, Math.floor(this.qty() || 1)));
  protected readonly formula = computed(() => FORMULA_TEXT[this.form()]);

  constructor() {
    // A product page starts on that product's first shape.
    effect(() => {
      const p = this.product();
      if (p) untracked(() => this.setForm(this.forms()[0]));
    });
    effect(() => {
      const pre = this.preset();
      if (!pre) return;
      untracked(() => {
        this.form.set(pre.form);
        this.pipeMode.set('wall');
        this.rectMode.set('wall');
        this.dims.set({ ...pre.dims });
        this.section.set(pre.section);
        this.length.set(DEFAULT_LENGTH[pre.form] ?? 1000);
        this.qty.set(1);
      });
    });
  }

  /** The Tube / pipe chip is lit for a typed or ID-based tube, not while the schedule chip is. */
  protected isShape(f: Form): boolean {
    return this.form() === f && !(f === 'tube' && this.pipeMode() === 'sch');
  }

  protected setSchedule(): void {
    this.setForm('tube');
    this.pipeMode.set('sch');
    const first = this.pipes().find((p) => p.nominalSize === '2 in.' && p.schedule === 'SCH 40') ?? this.pipes()[0];
    if (first) { this.nps.set(first.nominalSize); this.sch.set(first.schedule); }
    this.length.set(6000);
  }

  protected setWallMode(m: string): void {
    if (this.form() === 'tube') {
      const d = this.dims();
      // Start the inside diameter from the pipe on screen, so switching does not lose the size.
      if (m === 'id' && d['OD'] > 0 && d['WT'] > 0) this.inner.set({ ...this.inner(), ID: Math.round((d['OD'] - 2 * d['WT']) * 100) / 100 });
      this.pipeMode.set(m === 'id' ? 'id' : 'wall');
    } else {
      const d = this.dims();
      if (m === 'inside' && d['A'] > 0 && d['B'] > 0 && d['WT'] > 0) this.inner.set({ ...this.inner(), a: d['A'] - 2 * d['WT'], b: d['B'] - 2 * d['WT'] });
      this.rectMode.set(m === 'inside' ? 'inside' : 'wall');
    }
    this.added.set(false);
  }

  protected setNps(v: string): void {
    this.nps.set(v);
    const list = this.pipes().filter((p) => p.nominalSize === v).map((p) => p.schedule);
    if (!list.includes(this.sch())) this.sch.set(list.includes('SCH 40') ? 'SCH 40' : list[0] ?? '');
    this.added.set(false);
  }

  protected setSch(v: string): void { this.sch.set(v); this.added.set(false); }

  protected setInner(key: string, value: number | string): void {
    this.inner.set({ ...this.inner(), [key]: +value });
    this.added.set(false);
  }

  protected formName(f: Form): string {
    return FORM_NAMES[f].replace(/ \(.*\)/, '');
  }

  protected fmt(n: number): string {
    return formatKg(n);
  }

  protected setForm(f: Form): void {
    this.form.set(f);
    this.pipeMode.set('wall');
    this.rectMode.set('wall');
    const d: Dims = {};
    for (const [k, , def] of DIMS[f] ?? []) d[k] = def;
    this.dims.set(d);
    this.section.set(f === 'beam' ? 'ISMB 300' : f === 'channel' ? 'ISMC 200' : undefined);
    this.length.set(DEFAULT_LENGTH[f] ?? 500);
    this.added.set(false);
  }

  protected setDim(key: string, value: number | string): void {
    this.dims.set({ ...this.dims(), [key]: +value });
    this.added.set(false);
  }

  protected add(): void {
    const p = this.product();
    const mat = this.catalog.index().materials.find((m) => m.key === this.materialKey());
    this.requests.add({
      productSlug: p?.slug,
      gradeText: p ? (p.name.includes(p.grade) ? p.name : `${p.name} (${p.grade})`) : `${mat?.name ?? 'Steel'}${this.form() === 'tube' && this.pipeMode() === 'sch' ? ` · NPS ${this.nps()} ${this.sch()} pipe` : ''}`,
      form: this.form(),
      dims: this.eff(),
      section: this.section(),
      dimText: dimText(this.form(), this.eff(), this.section()),
      lengthMm: this.length(),
      quantity: Math.max(1, Math.floor(this.qty() || 1)),
      cutToSize: true,
      kg: this.total(),
    });
    this.added.set(true);
  }
}
