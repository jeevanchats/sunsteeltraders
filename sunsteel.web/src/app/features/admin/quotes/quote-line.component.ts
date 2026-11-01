import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { QuoteItemInput, QuoteLookups, QuoteProduct } from '../../../core/services/admin-api.service';
import { SHAPES, dimFields, lineFigures, materialsFor, resolveHsn } from '../../../core/quote/quote-lines';
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
    <div class="rounded-lg border border-[#E3E6EB] p-3 sm:p-4">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <b class="w-6 text-[#6B7485]">{{ index() + 1 }}</b>
        <div class="flex rounded-md border border-[#E3E6EB] p-0.5" role="group" aria-label="Line type">
          @for (t of types; track t.key) {
            <button type="button" class="rounded px-2.5 py-1 text-[12.5px]" [class.bg-primary]="l.itemType === t.key" [class.text-on-primary]="l.itemType === t.key"
              [attr.aria-pressed]="l.itemType === t.key" (click)="setType(t.key)">{{ t.label }}</button>
          }
        </div>
        <span class="flex-1"></span>
        <button type="button" class="abtn abtn-sm" (click)="duplicated.emit()">Duplicate</button>
        <button type="button" class="abtn abtn-sm abtn-danger" [disabled]="!canRemove()" (click)="removed.emit()" aria-label="Remove line">Remove</button>
      </div>

      @if (l.itemType === 'Calculated') {
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="alabel">Shape
            <select class="ainput" (change)="setShape($any($event.target).value)">
              <option value="" [selected]="!l.form" disabled>Choose…</option>
              @for (s of shapes; track s.key) { <option [value]="s.key" [selected]="s.key === l.form">{{ s.label }}</option> }
            </select></label>
          <label class="alabel sm:col-span-1 lg:col-span-2">Material
            <select class="ainput" (change)="setText('materialKey', $event, true)">
              <option value="" [selected]="!l.materialKey" disabled>Choose…</option>
              @for (m of materials(); track m.key) { <option [value]="m.key" [selected]="m.key === l.materialKey">{{ m.name }} ({{ m.density }})</option> }
            </select></label>
          <label class="alabel">Cut length (mm)
            <input class="ainput" type="number" min="0" step="any" inputmode="decimal" [value]="l.lengthMm || ''" (input)="setNum('lengthMm', $event)" /></label>

          @for (f of dims(); track f[0]) {
            <label class="alabel">{{ f[1] }} (mm)
              <input class="ainput" type="number" min="0" step="any" inputmode="decimal" [value]="dv(f[0])" (input)="setDim(f[0], $event)" /></label>
          }

          @if (l.form === 'beam' || l.form === 'channel') {
            <label class="alabel sm:col-span-2">Section (IS 808)
              <select class="ainput" (change)="setText('section', $event, true)">
                <option value="" [selected]="!l.section" disabled>Choose…</option>
                @for (s of sections(); track s.designation) { <option [value]="s.designation" [selected]="s.designation === l.section">{{ s.designation }} · {{ s.kgPerMetre }} kg/m</option> }
              </select></label>
          }

          @if (l.form === 'sspipe') {
            <label class="alabel">OD (mm)<input class="ainput" type="number" min="0" step="any" inputmode="decimal" [value]="dv('OD')" (input)="setDim('OD', $event)" /></label>
            <label class="alabel">ID (mm)
              <input class="ainput" type="number" min="0" step="any" inputmode="decimal" [value]="dv('ID')" [placeholder]="derived('id')" (input)="setPipeDim('ID', 'WT', $event)" /></label>
            <label class="alabel">or wall (mm)
              <input class="ainput" type="number" min="0" step="any" inputmode="decimal" [value]="dv('WT')" [placeholder]="derived('wt')" (input)="setPipeDim('WT', 'ID', $event)" /></label>
          }

          @if (l.form === 'mspipe') {
            <label class="alabel">Nominal size
              <select class="ainput" (change)="setPipeSize($any($event.target).value)">
                <option value="" [selected]="!l.section && l.schedule !== 'Custom'" disabled>Choose…</option>
                @for (s of pipeSizes(); track s) { <option [value]="s" [selected]="s === l.section">{{ s }}</option> }
                <option value="Custom" [selected]="l.schedule === 'Custom'">Custom size</option>
              </select></label>
            @if (l.schedule === 'Custom') {
              <label class="alabel">OD (mm)<input class="ainput" type="number" min="0" step="any" inputmode="decimal" [value]="dv('OD')" (input)="setDim('OD', $event)" /></label>
              <label class="alabel">Wall (mm)<input class="ainput" type="number" min="0" step="any" inputmode="decimal" [value]="dv('WT')" (input)="setDim('WT', $event)" /></label>
            } @else {
              <label class="alabel">Schedule
                <select class="ainput" [disabled]="!l.section" (change)="setText('schedule', $event, true)">
                  <option value="" [selected]="!l.schedule" disabled>Choose…</option>
                  @for (s of schedules(); track s) { <option [value]="s" [selected]="s === l.schedule">{{ s }}</option> }
                </select></label>
              <div class="alabel">OD · wall (from table)
                <div class="ainput flex items-center bg-[#F8F9FB] text-[#6B7485]">{{ fig.calc?.derived?.od ? fig.calc!.derived.od + ' · ' + fig.calc!.derived.wt : '—' }}</div></div>
            }
          }

          <label class="alabel">Pieces
            <input class="ainput" type="number" min="1" step="1" inputmode="numeric" [value]="l.quantity" (input)="setNum('quantity', $event, 1)" /></label>
        </div>

        @if (fig.calc?.error; as e) { <p class="alert mt-3" role="alert">{{ e }}</p> }
        @else if (fig.calc && fig.calc.kg > 0) {
          <p class="mt-3 text-[13px] text-[#6B7485]">
            {{ fmt(fig.calc.pieceKg) }} kg each · {{ fmt(fig.calc.kgPerM) }} kg/m · <b class="font-medium text-ink">{{ fmt(fig.kg) }} kg total</b>
            <span class="ml-1">(theoretical)</span></p>
        }
      } @else {
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @if (products().length) {
            <label class="alabel sm:col-span-2 lg:col-span-4">Pick from product list
              <input class="ainput" [attr.list]="'qp-' + index()" placeholder="Search brand or description…" (change)="pick($any($event.target))" />
              <datalist id="qp-{{ index() }}">@for (p of products(); track p.id) { <option [value]="label(p)"></option> }</datalist></label>
          }
          <label class="alabel">Brand<input class="ainput" maxlength="100" list="qb" [value]="l.brand ?? ''" (input)="setText('brand', $event, true)" /></label>
          <label class="alabel sm:col-span-1 lg:col-span-3">Description<input class="ainput" maxlength="200" list="qd" [value]="l.description ?? ''" (input)="setText('description', $event, true)" placeholder="e.g. GI roofing sheet, corrugated" /></label>
          <label class="alabel sm:col-span-1 lg:col-span-2">Size or specification<input class="ainput" maxlength="120" [value]="l.size ?? ''" (input)="setText('size', $event, true)" /></label>
          <label class="alabel">Model / part no.<input class="ainput" maxlength="80" [value]="l.model ?? ''" (input)="setText('model', $event, true)" /></label>
          <label class="alabel">Quantity
            <span class="flex gap-2">
              <input class="ainput" type="number" min="1" step="1" inputmode="numeric" [value]="l.quantity" (input)="setNum('quantity', $event, 1)" />
              <select class="ainput !w-[88px]" aria-label="Unit" (change)="setText('unit', $event)">@for (u of units; track u) { <option [value]="u" [selected]="u === l.unit">{{ u }}</option> }</select>
            </span></label>
          @if (l.itemType === 'ManualWeight') {
            <label class="alabel">Weight per unit (kg)<input class="ainput" type="number" min="0" step="any" inputmode="decimal" [value]="l.weightPerUnit || ''" (input)="setNum('weightPerUnit', $event)" /></label>
            <label class="alabel">or total weight (kg)<input class="ainput" type="number" min="0" step="any" inputmode="decimal" [value]="fig.kg || ''" (change)="setTotalKg($event)" /></label>
          }
        </div>
        <datalist id="qb">@for (b of recent.brands; track b) { <option [value]="b"></option> }</datalist>
        <datalist id="qd">@for (d of recent.descriptions; track d) { <option [value]="d"></option> }</datalist>
      }

      <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        @if (l.itemType === 'ManualUnit') {
          <label class="alabel">Price per {{ l.unit }} (₹)
            <input class="ainput" [class.!border-[#C2410C]]="!l.unitPrice" type="number" min="0" step="0.01" inputmode="decimal" [value]="l.unitPrice ?? ''" (input)="setNum('unitPrice', $event, 0, true)" />
            @if (reference()) { <button type="button" class="ahint text-left underline" (click)="useReference()">Reference rate ₹{{ reference() }} · use it</button> }</label>
        } @else {
          <label class="alabel">Price per kg (₹)
            <input class="ainput" [class.!border-[#C2410C]]="!l.ratePerKg" type="number" min="0" step="0.01" inputmode="decimal" [value]="l.ratePerKg || ''" (input)="setNum('ratePerKg', $event)" />
            @if (!l.ratePerKg && lastRate()) { <button type="button" class="ahint text-left underline" (click)="useLast()">Last used ₹{{ lastRate() }}/kg · use it</button> }
            @if (!l.ratePerKg && reference()) { <button type="button" class="ahint text-left underline" (click)="useReference()">Reference rate ₹{{ reference() }} · use it</button> }</label>
        }
        <label class="alabel">GST
          <span class="flex gap-2">
            <select class="ainput" aria-label="GST category" (change)="setCategory($any($event.target).value)">
              <option value="Raw" [selected]="l.gstCategory === 'Raw'">Raw material</option>
              <option value="Finished" [selected]="l.gstCategory === 'Finished'">Finished product</option>
            </select>
            <input class="ainput !w-[78px]" type="number" min="0" max="28" step="0.01" aria-label="GST rate %" [value]="l.gstRate ?? ''" [placeholder]="defaultRate() ?? 'set'" (input)="setNum('gstRate', $event, 0, true)" />
          </span>
          @if (fig.gstRate === null) { <span class="ahint text-[#C2410C]">Set this rate in Quote data, or type it here.</span> }</label>
        <label class="alabel">HSN code
          <input class="ainput" maxlength="12" [value]="l.hsn ?? ''" (input)="setHsn($event)" />
          @if (!l.hsn) { <span class="ahint text-[#C2410C]">No HSN code. It prints blank.</span> }</label>
        <div class="alabel">Amount
          <div class="ainput flex items-center justify-end bg-[#F8F9FB] font-medium tabular-nums">{{ fig.amount === null ? '—' : '₹ ' + inr(fig.amount) }}</div></div>
        <label class="alabel sm:col-span-2 lg:col-span-4">Remarks (printed under the item)
          <input class="ainput" maxlength="300" [value]="l.remarks ?? ''" (input)="setText('remarks', $event, true)" /></label>
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
  protected readonly dims = computed(() => { this.rev(); return dimFields(this.line().form); });
  protected readonly sections = computed(() => { this.rev(); return this.lookups().sections.filter((s) => s.kind === this.line().form); });
  protected readonly pipeSizes = computed(() => [...new Set(this.lookups().msPipes.map((p) => p.nominalSize))]);
  protected readonly schedules = computed(() => { this.rev(); return this.lookups().msPipes.filter((p) => p.nominalSize === this.line().section).map((p) => p.schedule); });
  protected readonly products = computed(() => this.lookups().products);
  protected readonly lastRate = computed(() => { this.rev(); return this.rates[this.line().materialKey ?? ''] ?? null; });
  protected readonly reference = computed(() => { this.rev(); return this.picked()?.referenceRate ?? null; });

  protected fmt = formatKg;

  /** The typed size, or blank while unset. */
  protected dv(k: string): number | string {
    return this.line().dims[k] ?? '';
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
    if (raw === '') delete l.dims[k]; else l.dims[k] = +raw;
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

