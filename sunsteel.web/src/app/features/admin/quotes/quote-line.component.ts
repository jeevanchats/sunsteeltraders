import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { QuoteItemInput, QuoteLookups, QuoteProduct } from '../../../core/services/admin-api.service';
import { SHAPES, dimFieldsFor, insideMode, lineFigures, materialsFor, resolveHsn } from '../../../core/quote/quote-lines';
import { lineChecks, lineFieldId } from '../../../core/quote/quote-progress';
import { ItemType, inr } from '../../../core/quote/quote-math';
import { lastRates, recentText } from '../../../core/quote/quote-memory';
import { formatKg } from '../../../core/weight/weight';

const UNITS = ['nos', 'pcs', 'set', 'sheet', 'metre', 'ft', 'kg'];
const TYPES: { key: ItemType; label: string }[] = [
  { key: 'Calculated', label: 'Calculated' }, { key: 'ManualWeight', label: 'By weight' }, { key: 'ManualUnit', label: 'By unit' },
];

/**
 * One quotation line. Calculated lines work out their weight from material, shape, size, length and pieces
 * (same formulas as the public calculator); manual lines are for branded pipes, roof sheets and tools.
 * The line object is edited in place and the parent re-totals when `changed` fires.
 */
@Component({
  selector: 'ss-quote-line',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let l = line();
    @let fig = figures();
    <div class="ql" [class.ql-ok]="complete()" [class.ql-need]="!complete()">
      <!-- header: number, what it is, collapse -->
      <div class="ql-head">
        <span class="ql-n" [class.ql-n-ok]="complete()">@if (complete()) { ✓ } @else { {{ index() + 1 }} }</span>
        <div class="min-w-0 flex-1">
          <b class="ql-title">Line {{ index() + 1 }}@if (summary()) { <span class="font-normal text-[#5B6678]"> · {{ summary() }}</span> }</b>
          <span class="ql-sub" [class.text-[#B45309]]="!complete()" [class.text-[#1E7A4F]]="complete()">
            @if (complete()) { <span class="whitespace-nowrap">{{ fmt(fig.kg) }} kg</span>@if (fig.amount !== null) { · <span class="whitespace-nowrap">₹ {{ inr(fig.amount) }}</span> } }
            @else { {{ needs().length }} to fill: {{ needs()[0].label }}@if (needs().length > 1) { +{{ needs().length - 1 }} more } }
          </span>
        </div>
        @if (complete()) {
          <button type="button" class="ql-toggle" [attr.aria-expanded]="open()" [attr.aria-label]="open() ? 'Collapse line' : 'Edit line'" (click)="open.set(!open())">{{ open() ? 'Hide' : 'Edit' }}</button>
        }
      </div>

      @if (open() || !complete()) {
        <!-- what kind of line -->
        <div class="ql-seg" role="group" aria-label="Line type">
          @for (t of types; track t.key) {
            <button type="button" [class.on]="l.itemType === t.key" [attr.aria-pressed]="l.itemType === t.key" (click)="setType(t.key)">{{ t.label }}</button>
          }
        </div>

        @if (l.itemType === 'Calculated') {
          <div class="ql-grid">
            <label class="fd" [class.fd-need]="need('form')" [class.fd-ok]="ok('form')"><span class="fl">Shape</span>
              <select class="ainput" [attr.id]="id('form')" (change)="setShape($any($event.target).value)">
                <option value="" [selected]="!l.form" disabled>Choose…</option>
                @for (s of shapes; track s.key) { <option [value]="s.key" [selected]="s.key === l.form">{{ s.label }}</option> }
              </select></label>
            <label class="fd" [class.fd-need]="need('material')" [class.fd-ok]="ok('material')"><span class="fl">Material</span>
              <select class="ainput" [attr.id]="id('material')" (change)="setText('materialKey', $event, true)">
                <option value="" [selected]="!l.materialKey" disabled>Choose…</option>
                @for (m of materials(); track m.key) { <option [value]="m.key" [selected]="m.key === l.materialKey">{{ m.name }} ({{ m.density }})</option> }
              </select></label>
            <label class="fd" [class.fd-need]="need('length')" [class.fd-ok]="ok('length')"><span class="fl">Cut length (mm)</span>
              <input class="ainput" [attr.id]="id('length')" type="number" min="0" step="any" inputmode="decimal" [value]="l.lengthMm || ''" (input)="setNum('lengthMm', $event)" /></label>

            @if (canInside()) {
              <div class="fd sm:col-span-2 lg:col-span-4"><span class="fl">The wall is given as</span>
                <div class="ql-seg !grid-cols-2" role="group" aria-label="How the wall is given">
                  <button type="button" [class.on]="!inside()" [attr.aria-pressed]="!inside()" (click)="setInside(false)">Wall thickness</button>
                  <button type="button" [class.on]="inside()" [attr.aria-pressed]="inside()" (click)="setInside(true)">{{ l.form === 'tube' ? 'Inside diameter' : 'Inside size' }}</button>
                </div></div>
            }
            @for (f of dims(); track f[0]) {
              <label class="fd" [class.fd-need]="need('dim-' + f[0])" [class.fd-ok]="ok('dim-' + f[0])"><span class="fl">{{ f[1] }} (mm)</span>
                <input class="ainput" [attr.id]="id('dim-' + f[0])" type="number" min="0" step="any" inputmode="decimal" [value]="dv(f[0])" (input)="setDim(f[0], $event)" /></label>
            }

            @if (l.form === 'beam' || l.form === 'channel') {
              <label class="fd sm:col-span-2" [class.fd-need]="need('section')" [class.fd-ok]="ok('section')"><span class="fl">Section (IS 808)</span>
                <select class="ainput" [attr.id]="id('section')" (change)="setText('section', $event, true)">
                  <option value="" [selected]="!l.section" disabled>Choose…</option>
                  @for (s of sections(); track s.designation) { <option [value]="s.designation" [selected]="s.designation === l.section">{{ s.designation }} · {{ s.kgPerMetre }} kg/m</option> }
                </select></label>
            }

            @if (l.form === 'sspipe') {
              <label class="fd" [class.fd-need]="need('dim-OD')" [class.fd-ok]="ok('dim-OD')"><span class="fl">OD (mm)</span><input class="ainput" [attr.id]="id('dim-OD')" type="number" min="0" step="any" inputmode="decimal" [value]="dv('OD')" (input)="setDim('OD', $event)" /></label>
              <label class="fd" [class.fd-need]="need('dim-WT')" [class.fd-ok]="ok('dim-WT')"><span class="fl">ID (mm)</span>
                <input class="ainput" [attr.id]="id('dim-WT')" type="number" min="0" step="any" inputmode="decimal" [value]="dv('ID')" [placeholder]="derived('id')" (input)="setPipeDim('ID', 'WT', $event)" /></label>
              <label class="fd" [class.fd-ok]="ok('dim-WT')"><span class="fl">or wall (mm)</span>
                <input class="ainput" type="number" min="0" step="any" inputmode="decimal" [value]="dv('WT')" [placeholder]="derived('wt')" (input)="setPipeDim('WT', 'ID', $event)" /></label>
            }

            @if (l.form === 'mspipe') {
              <label class="fd" [class.fd-need]="need('size')" [class.fd-ok]="ok('size')"><span class="fl">Nominal size</span>
                <select class="ainput" [attr.id]="id('size')" (change)="setPipeSize($any($event.target).value)">
                  <option value="" [selected]="!l.section && l.schedule !== 'Custom'" disabled>Choose…</option>
                  @for (s of pipeSizes(); track s) { <option [value]="s" [selected]="s === l.section">{{ s }}</option> }
                  <option value="Custom" [selected]="l.schedule === 'Custom'">Custom size</option>
                </select></label>
              @if (l.schedule === 'Custom') {
                <label class="fd" [class.fd-need]="need('dim-OD')" [class.fd-ok]="ok('dim-OD')"><span class="fl">OD (mm)</span><input class="ainput" [attr.id]="id('dim-OD')" type="number" min="0" step="any" inputmode="decimal" [value]="dv('OD')" (input)="setDim('OD', $event)" /></label>
                <label class="fd" [class.fd-need]="need('dim-WT')" [class.fd-ok]="ok('dim-WT')"><span class="fl">Wall (mm)</span><input class="ainput" [attr.id]="id('dim-WT')" type="number" min="0" step="any" inputmode="decimal" [value]="dv('WT')" (input)="setDim('WT', $event)" /></label>
              } @else {
                <label class="fd" [class.fd-need]="need('schedule')" [class.fd-ok]="ok('schedule')"><span class="fl">Schedule</span>
                  <select class="ainput" [attr.id]="id('schedule')" [disabled]="!l.section" (change)="setText('schedule', $event, true)">
                    <option value="" [selected]="!l.schedule" disabled>Choose…</option>
                    @for (s of schedules(); track s) { <option [value]="s" [selected]="s === l.schedule">{{ s }}</option> }
                  </select></label>
                <div class="fd"><span class="fl">OD · wall (from table)</span>
                  <div class="ainput ql-ro">{{ fig.calc?.derived?.od ? fig.calc!.derived.od + ' · ' + fig.calc!.derived.wt : '—' }}</div></div>
              }
            }

            <label class="fd" [class.fd-need]="need('pieces')" [class.fd-ok]="ok('pieces')"><span class="fl">Pieces</span>
              <input class="ainput" [attr.id]="id('pieces')" type="number" min="1" step="1" inputmode="numeric" [value]="l.quantity" (input)="setNum('quantity', $event, 1)" /></label>
          </div>

          @if (fig.calc?.error; as e) { <p class="alert mt-3" role="alert">{{ e }}</p> }
          @else if (fig.calc && fig.calc.kg > 0) {
            <p class="ql-result">
              <span>{{ fmt(fig.calc.pieceKg) }} kg each · {{ fmt(fig.calc.kgPerM) }} kg/m@if (inside() && fig.calc.derived.wt) { · wall {{ fig.calc.derived.wt }} mm }</span>
              <b>{{ fmt(fig.kg) }} kg total</b>
              <small>theoretical weight</small></p>
          }
        } @else {
          <div class="ql-grid">
            @if (products().length) {
              <label class="fd sm:col-span-2 lg:col-span-4"><span class="fl">Pick from product list</span>
                <input class="ainput" [attr.list]="'qp-' + index()" placeholder="Search brand or description…" (change)="pick($any($event.target))" />
                <datalist id="qp-{{ index() }}">@for (p of products(); track p.id) { <option [value]="label(p)"></option> }</datalist></label>
            }
            <label class="fd" [class.fd-ok]="!!l.brand"><span class="fl">Brand</span><input class="ainput" maxlength="100" list="qb" [value]="l.brand ?? ''" (input)="setText('brand', $event, true)" /></label>
            <label class="fd sm:col-span-1 lg:col-span-3" [class.fd-need]="need('description')" [class.fd-ok]="ok('description')"><span class="fl">Description</span>
              <input class="ainput" [attr.id]="id('description')" maxlength="200" list="qd" [value]="l.description ?? ''" (input)="setText('description', $event, true)" placeholder="e.g. GI roofing sheet, corrugated" /></label>
            <label class="fd sm:col-span-1 lg:col-span-2" [class.fd-ok]="!!l.size"><span class="fl">Size or specification</span><input class="ainput" maxlength="120" [value]="l.size ?? ''" (input)="setText('size', $event, true)" /></label>
            <label class="fd" [class.fd-ok]="!!l.model"><span class="fl">Model / part no.</span><input class="ainput" maxlength="80" [value]="l.model ?? ''" (input)="setText('model', $event, true)" /></label>
            <div class="fd" [class.fd-need]="need('pieces')" [class.fd-ok]="ok('pieces')"><span class="fl">Quantity</span>
              <span class="flex gap-2">
                <input class="ainput" [attr.id]="id('pieces')" type="number" min="1" step="1" inputmode="numeric" [value]="l.quantity" (input)="setNum('quantity', $event, 1)" aria-label="Quantity" />
                <select class="ainput !w-[104px] shrink-0" aria-label="Unit" (change)="setText('unit', $event)">@for (u of units; track u) { <option [value]="u" [selected]="u === l.unit">{{ u }}</option> }</select>
              </span></div>
            @if (l.itemType === 'ManualWeight') {
              <label class="fd" [class.fd-need]="need('weight')" [class.fd-ok]="ok('weight')"><span class="fl">Weight per unit (kg)</span><input class="ainput" [attr.id]="id('weight')" type="number" min="0" step="any" inputmode="decimal" [value]="l.weightPerUnit || ''" (input)="setNum('weightPerUnit', $event)" /></label>
              <label class="fd" [class.fd-ok]="ok('weight')"><span class="fl">or total weight (kg)</span><input class="ainput" type="number" min="0" step="any" inputmode="decimal" [value]="fig.kg || ''" (change)="setTotalKg($event)" /></label>
            }
          </div>
          <datalist id="qb">@for (b of recent.brands; track b) { <option [value]="b"></option> }</datalist>
          <datalist id="qd">@for (d of recent.descriptions; track d) { <option [value]="d"></option> }</datalist>
        }

        <!-- price, GST, HSN -->
        <div class="ql-grid ql-money">
          @if (l.itemType === 'ManualUnit') {
            <label class="fd" [class.fd-need]="need('rate')" [class.fd-ok]="ok('rate')"><span class="fl">Price per {{ l.unit }} (₹)</span>
              <input class="ainput" [attr.id]="id('rate')" type="number" min="0" step="0.01" inputmode="decimal" [value]="l.unitPrice ?? ''" (input)="setNum('unitPrice', $event, 0, true)" />
              @if (reference()) { <button type="button" class="ql-quick" (click)="useReference()">Use reference rate ₹{{ reference() }}</button> }</label>
          } @else {
            <label class="fd" [class.fd-need]="need('rate')" [class.fd-ok]="ok('rate')"><span class="fl">Price per kg (₹)</span>
              <input class="ainput" [attr.id]="id('rate')" type="number" min="0" step="0.01" inputmode="decimal" [value]="l.ratePerKg || ''" (input)="setNum('ratePerKg', $event)" />
              @if (!l.ratePerKg && lastRate()) { <button type="button" class="ql-quick" (click)="useLast()">Use last price ₹{{ lastRate() }}/kg</button> }
              @if (!l.ratePerKg && reference()) { <button type="button" class="ql-quick" (click)="useReference()">Use reference rate ₹{{ reference() }}</button> }</label>
          }
          <label class="fd" [class.fd-need]="need('gst')" [class.fd-ok]="ok('gst')"><span class="fl">GST</span>
            <span class="flex gap-2">
              <select class="ainput" [attr.id]="id('gst')" aria-label="GST category" (change)="setCategory($any($event.target).value)">
                <option value="Raw" [selected]="l.gstCategory === 'Raw'">Raw material</option>
                <option value="Finished" [selected]="l.gstCategory === 'Finished'">Finished product</option>
              </select>
              <input class="ainput !w-[92px] shrink-0" type="number" min="0" max="28" step="0.01" aria-label="GST rate %" [value]="l.gstRate ?? ''" [placeholder]="defaultRate() ?? 'rate %'" (input)="setNum('gstRate', $event, 0, true)" />
            </span>
            @if (fig.gstRate === null) { <span class="ql-warn">Set this rate in Quote data, or type it here.</span> }</label>
          <label class="fd" [class.fd-ok]="!!l.hsn"><span class="fl">HSN code</span>
            <input class="ainput" maxlength="12" inputmode="numeric" [value]="l.hsn ?? ''" (input)="setHsn($event)" />
            @if (!l.hsn) { <span class="ql-hint">Optional. Prints blank if empty.</span> }</label>
          <label class="fd sm:col-span-2 lg:col-span-4" [class.fd-ok]="!!l.remarks"><span class="fl">Remarks (printed under the item)</span>
            <input class="ainput" maxlength="300" [value]="l.remarks ?? ''" (input)="setText('remarks', $event, true)" /></label>
        </div>
      }

      <!-- the answer, always in view -->
      <div class="ql-foot">
        <div class="ql-amt">
          <small>Line amount</small>
          <b>{{ fig.amount === null ? '—' : '₹ ' + inr(fig.amount) }}</b>
          @if (fig.amount !== null && fig.gstRate !== null) { <span>+ GST {{ fig.gstRate }}%</span> }
        </div>
        <div class="flex gap-2">
          <button type="button" class="ql-act" (click)="duplicated.emit()">Duplicate</button>
          <button type="button" class="ql-act ql-act-del" [disabled]="!canRemove()" (click)="removed.emit()" aria-label="Remove line">Remove</button>
        </div>
      </div>
    </div>`,
})
export class QuoteLineComponent {
  readonly line = input.required<QuoteItemInput>();
  readonly index = input.required<number>();
  readonly lookups = input.required<QuoteLookups>();
  /** Bumped by the parent after any edit, so computed values refresh. */
  readonly rev = input(0);
  readonly canRemove = input(true);
  readonly changed = output<void>();
  readonly removed = output<void>();
  readonly duplicated = output<void>();

  protected readonly types = TYPES;
  /** A finished line can be folded away to one summary row; a line with something still to fill never is. */
  protected readonly open = signal(true);
  protected readonly shapes = SHAPES;
  protected readonly units = UNITS;
  protected readonly inr = inr;
  protected readonly recent = recentText();
  private readonly rates = lastRates();
  private readonly hsnEdited = signal(false);
  private readonly picked = signal<QuoteProduct | null>(null);

  protected readonly figures = computed(() => {
    this.rev();
    const lk = this.lookups();
    return lineFigures(this.line(), { materials: lk.materials, sections: lk.sections, msPipes: lk.msPipes },
      { weightDecimals: lk.defaults.weightDecimals, gstRaw: lk.defaults.gstRaw, gstFinished: lk.defaults.gstFinished });
  });
  protected readonly materials = computed(() => { this.rev(); return materialsFor(this.line().form, this.lookups().materials); });
  protected readonly dims = computed(() => { this.rev(); return dimFieldsFor(this.line()); });
  /** Tubes and hollow sections can be given by their inside size instead of the wall. */
  protected readonly canInside = computed(() => { this.rev(); const f = this.line().form; return f === 'tube' || f === 'rect'; });
  protected readonly inside = computed(() => { this.rev(); return insideMode(this.line()); });
  protected readonly sections = computed(() => { this.rev(); return this.lookups().sections.filter((s) => s.kind === this.line().form); });
  protected readonly pipeSizes = computed(() => [...new Set(this.lookups().msPipes.map((p) => p.nominalSize))]);
  protected readonly schedules = computed(() => { this.rev(); return this.lookups().msPipes.filter((p) => p.nominalSize === this.line().section).map((p) => p.schedule); });
  protected readonly products = computed(() => this.lookups().products);
  protected readonly lastRate = computed(() => { this.rev(); return this.rates[this.line().materialKey ?? ''] ?? null; });
  protected readonly reference = computed(() => { this.rev(); return this.picked()?.referenceRate ?? null; });

  protected fmt = formatKg;

  /** Everything this line needs, done or not; the editor shows the same list as its "next missing" guide. */
  private readonly checks = computed(() => { this.rev(); return lineChecks(this.line(), this.index(), this.figures()); });
  protected readonly needs = computed(() => this.checks().filter((c) => !c.done));
  protected readonly complete = computed(() => this.needs().length === 0);
  protected need(key: string): boolean { return this.checks().some((c) => c.key === key && !c.done); }
  protected ok(key: string): boolean { return this.checks().some((c) => c.key === key && c.done); }
  protected id(key: string): string { return lineFieldId(this.index(), key); }

  /** A short name for the line, shown in its header. */
  protected readonly summary = computed(() => {
    this.rev();
    const l = this.line();
    const text = l.itemType === 'Calculated' ? (this.figures().calc?.description ?? '') : [l.brand, l.description].filter(Boolean).join(' ');
    return text.length > 46 ? text.slice(0, 45) + '…' : text;
  });

  /** The typed size, or blank while unset. */
  protected dv(k: string): number | string {
    return this.line().dims[k] || '';
  }

  protected defaultRate(): string | null {
    const d = this.lookups().defaults;
    const v = this.line().gstCategory === 'Raw' ? d.gstRaw : d.gstFinished;
    return v === null ? null : String(v);
  }

  protected derived(k: 'id' | 'wt'): string {
    const v = this.figures().calc?.derived[k];
    return v ? String(Math.round(v * 100) / 100) : '';
  }

  protected label(p: QuoteProduct): string {
    return [p.brand, p.description, p.size].filter(Boolean).join(' · ');
  }

  // --- edits (the line is edited in place; the parent re-totals on `changed`) -------------------------------

  private touch(): void { this.changed.emit(); }

  private put(k: string, v: unknown): void { (this.line() as unknown as Record<string, unknown>)[k] = v; }

  protected setType(t: ItemType): void {
    const l = this.line();
    if (l.itemType === t) return;
    const wasCalc = l.itemType === 'Calculated';
    l.itemType = t;
    // Calculated lines default to raw material, manual lines to finished product, unless the rate was set by hand.
    if (l.gstRate === null) l.gstCategory = t === 'Calculated' ? 'Raw' : 'Finished';
    if (wasCalc && t !== 'Calculated') l.hsn = null;
    if (t === 'Calculated') this.autoHsn();
    this.touch();
  }

  /** Switch a tube or hollow section between wall thickness and inside size, carrying the size across so nothing is retyped. */
  protected setInside(on: boolean): void {
    const l = this.line();
    const d = l.dims;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    if (l.form === 'tube') {
      if (on) { d['ID'] = d['OD'] > 0 && d['WT'] > 0 ? r2(d['OD'] - 2 * d['WT']) : 0; delete d['WT']; }
      else { if (d['OD'] > 0 && d['ID'] > 0 && d['ID'] < d['OD']) d['WT'] = r2((d['OD'] - d['ID']) / 2); delete d['ID']; }
    } else if (l.form === 'rect') {
      if (on) { d['a'] = d['A'] > 0 && d['WT'] > 0 ? r2(d['A'] - 2 * d['WT']) : 0; d['b'] = d['B'] > 0 && d['WT'] > 0 ? r2(d['B'] - 2 * d['WT']) : 0; delete d['WT']; }
      else { if (d['A'] > 0 && d['a'] > 0 && d['a'] < d['A']) d['WT'] = r2((d['A'] - d['a']) / 2); delete d['a']; delete d['b']; }
    }
    this.touch();
  }

  protected setShape(form: string): void {
    const l = this.line();
    l.form = form; l.dims = {}; l.section = null; l.schedule = null;
    const allowed = materialsFor(form, this.lookups().materials);
    if (!allowed.some((m) => m.key === l.materialKey)) l.materialKey = allowed[0]?.key ?? null;
    this.autoHsn();
    this.touch();
  }

  protected setText(k: string, e: Event, nullable = false): void {
    const v = (e.target as HTMLInputElement | HTMLSelectElement).value;
    this.put(k, nullable && v === '' ? null : v);
    if (k === 'materialKey') this.autoHsn();
    this.touch();
  }

  protected setNum(k: string, e: Event, min = 0, nullable = false): void {
    const raw = (e.target as HTMLInputElement).value;
    const v = raw === '' ? (nullable ? null : min) : Math.max(min, +raw);
    this.put(k, Number.isFinite(v as number) || v === null ? v : min);
    this.touch();
  }

  protected setDim(k: string, e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    const l = this.line();
    // An emptied inside-size box stays at 0 (not removed), so the line does not drop back to "wall thickness" mid-edit.
    if (raw === '') { if (k === 'ID' || k === 'a' || k === 'b') l.dims[k] = 0; else delete l.dims[k]; } else l.dims[k] = +raw;
    this.touch();
  }

  /** Stainless pipe takes ID or wall: typing one clears the other, which is shown as a worked-out placeholder. */
  protected setPipeDim(k: 'ID' | 'WT', other: 'ID' | 'WT', e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    const l = this.line();
    if (raw === '') delete l.dims[k]; else { l.dims[k] = +raw; delete l.dims[other]; }
    this.touch();
  }

  protected setPipeSize(v: string): void {
    const l = this.line();
    if (v === 'Custom') { l.schedule = 'Custom'; l.section = null; }
    else { l.section = v; if (l.schedule === 'Custom' || !this.schedules().includes(l.schedule ?? '')) l.schedule = null; l.dims = {}; }
    this.touch();
  }

  protected setCategory(v: string): void {
    const l = this.line();
    l.gstCategory = v === 'Finished' ? 'Finished' : 'Raw';
    l.gstRate = null; // back to the category default
    this.touch();
  }

  protected setHsn(e: Event): void {
    this.hsnEdited.set(true);
    const v = (e.target as HTMLInputElement).value.trim();
    this.line().hsn = v === '' ? null : v;
    this.touch();
  }

  protected setTotalKg(e: Event): void {
    const l = this.line();
    const total = +(e.target as HTMLInputElement).value;
    l.weightPerUnit = total > 0 && l.quantity > 0 ? Math.round((total / l.quantity) * 1000) / 1000 : 0;
    this.touch();
  }

  protected useLast(): void {
    const v = this.lastRate();
    if (v) { this.line().ratePerKg = v; this.touch(); }
  }

  protected useReference(): void {
    const v = this.reference();
    const l = this.line();
    if (!v) return;
    if (l.itemType === 'ManualUnit') l.unitPrice = v; else l.ratePerKg = v;
    this.touch();
  }

  protected pick(input: HTMLInputElement): void {
    const p = this.products().find((x) => this.label(x) === input.value);
    if (!p) return;
    const l = this.line();
    l.itemType = p.itemType;
    l.brand = p.brand; l.description = p.description; l.size = p.size; l.model = p.model; l.unit = p.unit;
    l.weightPerUnit = p.weightPerUnit ?? 0;
    l.hsn = p.hsn; l.gstCategory = p.gstCategory; l.gstRate = p.gstRate;
    this.picked.set(p);
    this.hsnEdited.set(true);
    input.value = '';
    this.touch();
  }

  /** Calculated lines take their HSN code from the table (shape + material) until it is typed over. */
  private autoHsn(): void {
    const l = this.line();
    if (l.itemType !== 'Calculated' || this.hsnEdited()) return;
    l.hsn = resolveHsn(this.lookups().hsn, l.form, l.materialKey) || null;
  }
}

