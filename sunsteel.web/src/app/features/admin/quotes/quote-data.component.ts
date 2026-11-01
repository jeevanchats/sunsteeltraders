import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../../../core/models/api.model';
import { Perm } from '../../../core/models/auth.model';
import { HsnRef, MsPipeRef, MaterialRef } from '../../../core/quote/quote-lines';
import { AdminApiService, QuoteProduct, QuoteSettings } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';
import { IconComponent } from '../../../shared/icon.component';

type Tab = 'settings' | 'products' | 'hsn' | 'pipes';
const UNITS = ['nos', 'pcs', 'set', 'sheet', 'metre', 'ft', 'kg'];
const SHAPES = ['round', 'square', 'hex', 'flat', 'plate', 'rect', 'angle', 'beam', 'channel', 'sspipe', 'mspipe', 'tube'];

const blankProduct = (): QuoteProduct => ({
  id: 0, itemType: 'ManualUnit', gstCategory: 'Finished', brand: null, description: '', size: null, model: null, unit: 'nos',
  weightPerUnit: null, hsn: null, gstRate: null, referenceRate: null, isActive: true,
});

/**
 * The tables behind quotations, kept by the owner: GST rates, validity, bank details and terms; the product list for
 * branded pipes, roof sheets and tools; HSN codes for calculated lines; and the MS pipe schedule (wall thickness per size).
 * The editor reads all of this, so nothing is typed into code.
 */
@Component({
  selector: 'ss-quote-data',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-5">
      <h1 class="text-[22px] font-medium">Quote data</h1>
      <p class="text-[13.5px] text-[#6B7485]">The rates, products and codes that quotations use. Existing quotations keep the values they were saved with.</p>
    </header>
    <div class="mb-4 flex flex-wrap gap-2" role="tablist">
      @for (t of tabs; track t[0]) {
        <button type="button" role="tab" class="abtn abtn-sm" [class.abtn-pri]="tab() === t[0]" [attr.aria-selected]="tab() === t[0]" (click)="open(t[0])">{{ t[1] }}</button>
      }
    </div>
    @if (message(); as m) { <p class="alert mb-4" [class.alert-ok]="m.ok" role="status">{{ m.text }}</p> }
    @if (!canEdit() && tab() !== 'products') { <p class="alert mb-4">You can view this. Changing it needs permission to manage settings.</p> }

    @switch (tab()) {
      @case ('settings') {
        @if (settings(); as s) {
          <form class="card grid max-w-[720px] gap-4" (ngSubmit)="saveSettings()">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="alabel">GST on raw materials %<input class="ainput" type="number" min="0" max="28" step="0.01" name="gr" [(ngModel)]="s.gstRaw" [disabled]="!canEdit()" />
                <span class="ahint">Default for calculated lines (bars, plates, sections, pipes) and for cutting, loading and freight.</span></label>
              <label class="alabel">GST on finished products %<input class="ainput" type="number" min="0" max="28" step="0.01" name="gf" [(ngModel)]="s.gstFinished" [disabled]="!canEdit()" />
                <span class="ahint">Default for manual lines (roof sheets, tools). Not assumed: until it is set, such lines need a rate typed on the line.</span></label>
              <label class="alabel">Quotation valid (days)<input class="ainput" type="number" min="1" max="90" name="vd" [(ngModel)]="s.validDays" [disabled]="!canEdit()" /></label>
              <label class="alabel">Weight decimals<input class="ainput" type="number" min="0" max="3" name="wd" [(ngModel)]="s.weightDecimals" [disabled]="!canEdit()" />
                <span class="ahint">Line weights are rounded to this many places (1 = 0.1 kg).</span></label>
            </div>
            <label class="alabel">Default payment terms<input class="ainput" maxlength="200" name="pt" [(ngModel)]="s.paymentTerms" [disabled]="!canEdit()" placeholder="e.g. 100% advance with order" /></label>
            <label class="alabel">Branch office address<input class="ainput" maxlength="300" name="ba" [(ngModel)]="s.branchAddress" [disabled]="!canEdit()" placeholder="e.g. 102, street, area, city - pin" />
              <span class="ahint">Printed under the main address in the quotation header. Leave empty to print none.</span></label>
            <label class="alabel">Bank details<textarea class="ainput" rows="4" maxlength="600" name="bd" [(ngModel)]="s.bankDetails" [disabled]="!canEdit()" placeholder="Account name, bank, account number, IFSC"></textarea>
              <span class="ahint">Printed on every quotation after the payment terms. Leave empty to print no bank block. Nothing is filled in for you.</span></label>
            <label class="alabel">Terms & conditions<textarea class="ainput" rows="9" maxlength="4000" name="tc" [(ngModel)]="s.terms" [disabled]="!canEdit()"></textarea>
              <span class="ahint">New quotations start with this text. <code>{{ '{days}' }}</code> becomes the validity in days. The seller GSTIN comes from Site settings.</span></label>
            <div><button class="abtn abtn-pri" [disabled]="busy() || !canEdit()">{{ busy() ? 'Saving…' : 'Save settings' }}</button></div>
          </form>
        }
      }

      @case ('products') {
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <input class="ainput !w-[260px]" placeholder="Search brand, description, model" [(ngModel)]="q" (keyup.enter)="loadProducts()" />
          <button type="button" class="abtn abtn-pri" (click)="editing.set(blank())"><ss-icon name="plus" [size]="14" />Add product</button>
          <span class="ahint">Branded pipes, roof sheets and tools. Prices are typed per quotation; a reference rate is only a suggestion.</span>
        </div>
        @if (editing(); as p) {
          <form class="card mb-4 grid gap-3" (ngSubmit)="saveProduct(p)">
            <b class="font-medium">{{ p.id ? 'Edit product' : 'New product' }}</b>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label class="alabel">Priced<select class="ainput" name="it" [(ngModel)]="p.itemType"><option value="ManualUnit">By unit (₹ each)</option><option value="ManualWeight">By weight (₹ per kg)</option></select></label>
              <label class="alabel">GST category<select class="ainput" name="gc" [(ngModel)]="p.gstCategory"><option value="Raw">Raw material</option><option value="Finished">Finished product</option></select></label>
              <label class="alabel">Brand<input class="ainput" maxlength="100" name="br" [(ngModel)]="p.brand" /></label>
              <label class="alabel">Model / part no.<input class="ainput" maxlength="80" name="mo" [(ngModel)]="p.model" /></label>
              <label class="alabel sm:col-span-2">Description *<input class="ainput" maxlength="200" name="de" [(ngModel)]="p.description" required /></label>
              <label class="alabel sm:col-span-2">Size or specification<input class="ainput" maxlength="120" name="sz" [(ngModel)]="p.size" /></label>
              <label class="alabel">Unit<select class="ainput" name="un" [(ngModel)]="p.unit">@for (u of units; track u) { <option [value]="u">{{ u }}</option> }</select></label>
              @if (p.itemType === 'ManualWeight') {
                <label class="alabel">Weight per unit (kg) *<input class="ainput" type="number" min="0" step="any" name="wu" [(ngModel)]="p.weightPerUnit" /></label>
              }
              <label class="alabel">HSN code<input class="ainput" maxlength="12" name="hs" [(ngModel)]="p.hsn" /></label>
              <label class="alabel">Own GST % <input class="ainput" type="number" min="0" max="28" step="0.01" name="gs" [(ngModel)]="p.gstRate" placeholder="blank = category rate" /></label>
              <label class="alabel">Reference rate (₹)<input class="ainput" type="number" min="0" step="0.01" name="rr" [(ngModel)]="p.referenceRate" /></label>
              <label class="flex items-center gap-2 self-end text-[13.5px]"><input type="checkbox" name="ac" [(ngModel)]="p.isActive" />Shown on quotations</label>
            </div>
            <div class="flex gap-2"><button class="abtn abtn-pri" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save product' }}</button>
              <button type="button" class="abtn" (click)="editing.set(null)">Cancel</button></div>
          </form>
        }
        <div class="card overflow-x-auto !p-0">
          <table class="tbl">
            <thead><tr><th>Product</th><th>Priced</th><th>HSN</th><th>GST</th><th class="text-right">Ref. ₹</th><th></th></tr></thead>
            <tbody>
              @for (p of products(); track p.id) {
                <tr [class.opacity-50]="!p.isActive">
                  <td>{{ p.brand }} {{ p.description }}<small class="block text-[#8A93A3]">{{ p.size }}{{ p.model ? ' · ' + p.model : '' }}</small></td>
                  <td>{{ p.itemType === 'ManualWeight' ? p.weightPerUnit + ' kg/' + p.unit : 'per ' + p.unit }}</td>
                  <td>{{ p.hsn || '—' }}</td>
                  <td>{{ p.gstRate ?? (p.gstCategory === 'Raw' ? 'raw rate' : 'finished rate') }}</td>
                  <td class="text-right tabular-nums">{{ p.referenceRate ?? '—' }}</td>
                  <td class="whitespace-nowrap text-right">
                    <button type="button" class="abtn abtn-sm" (click)="editing.set(copy(p))">Edit</button>
                    <button type="button" class="abtn abtn-sm abtn-danger ml-1" (click)="removeProduct(p)" aria-label="Delete product"><ss-icon name="trash" [size]="13" /></button></td>
                </tr>
              } @empty { <tr><td colspan="6" class="py-10 text-center text-[#8A93A3]">No products yet. Add the pipes, sheets and tools you quote by brand.</td></tr> }
            </tbody>
          </table>
        </div>
      }

      @case ('hsn') {
        <p class="mb-3 max-w-[720px] text-[13.5px] text-[#6B7485]">HSN code printed for calculated lines, by shape and material. A row with the material left blank covers every material of that shape. No code found: the line shows a warning and prints blank. The codes are not filled in for you.</p>
        <div class="card grid max-w-[720px] gap-2">
          @for (r of hsn(); track r; let i = $index) {
            <div class="grid grid-cols-[1fr_1.4fr_110px_auto] items-center gap-2">
              <select class="ainput" aria-label="Shape" [(ngModel)]="r.form" [name]="'hf' + i" [disabled]="!canEdit()">@for (s of shapes; track s) { <option [value]="s">{{ s }}</option> }</select>
              <select class="ainput" aria-label="Material" [(ngModel)]="r.materialKey" [name]="'hm' + i" [disabled]="!canEdit()"><option value="">All materials</option>@for (m of materials(); track m.key) { <option [value]="m.key">{{ m.name }}</option> }</select>
              <input class="ainput" aria-label="HSN code" maxlength="12" placeholder="HSN" [(ngModel)]="r.hsn" [name]="'hh' + i" [disabled]="!canEdit()" />
              <button type="button" class="abtn abtn-sm abtn-danger" [disabled]="!canEdit()" (click)="hsn.set(withoutRow(hsn(), i))" aria-label="Remove row"><ss-icon name="trash" [size]="13" /></button>
            </div>
          }
          <div class="flex gap-2"><button type="button" class="abtn abtn-sm" [disabled]="!canEdit()" (click)="hsn.set([...hsn(), { form: 'round', materialKey: '', hsn: '' }])"><ss-icon name="plus" [size]="13" />Add row</button>
            <button type="button" class="abtn abtn-pri abtn-sm" [disabled]="busy() || !canEdit()" (click)="saveHsn()">{{ busy() ? 'Saving…' : 'Save HSN codes' }}</button></div>
        </div>
      }

      @case ('pipes') {
        <p class="alert mb-3 max-w-[760px]">The rows below are a <b>sample</b> (five sizes, SCH 40 and SCH 80). Enter the full ASME B36.10M table and the IS 1239 Light, Medium and Heavy classes for the sizes you sell, and check them against the standard, before relying on the MS pipe calculator.</p>
        <div class="card grid max-w-[760px] gap-2">
          <div class="hidden grid-cols-[1fr_100px_1fr_100px_auto] gap-2 text-[12px] text-[#6B7485] sm:grid"><span>Nominal size</span><span>OD (mm)</span><span>Schedule</span><span>Wall (mm)</span><span></span></div>
          @for (r of pipes(); track r; let i = $index) {
            <div class="grid grid-cols-[1fr_100px_1fr_100px_auto] items-center gap-2">
              <input class="ainput" aria-label="Nominal size" maxlength="20" placeholder="2 in." [(ngModel)]="r.nominalSize" [name]="'ps' + i" [disabled]="!canEdit()" />
              <input class="ainput" aria-label="OD" type="number" min="0" step="any" [(ngModel)]="r.odMm" [name]="'po' + i" [disabled]="!canEdit()" />
              <input class="ainput" aria-label="Schedule" maxlength="12" placeholder="SCH 40" list="sch" [(ngModel)]="r.schedule" [name]="'pc' + i" [disabled]="!canEdit()" />
              <input class="ainput" aria-label="Wall" type="number" min="0" step="any" [(ngModel)]="r.wallMm" [name]="'pw' + i" [disabled]="!canEdit()" />
              <button type="button" class="abtn abtn-sm abtn-danger" [disabled]="!canEdit()" (click)="pipes.set(withoutRow(pipes(), i))" aria-label="Remove row"><ss-icon name="trash" [size]="13" /></button>
            </div>
          }
          <datalist id="sch">@for (s of scheduleNames; track s) { <option [value]="s"></option> }</datalist>
          <div class="flex gap-2"><button type="button" class="abtn abtn-sm" [disabled]="!canEdit()" (click)="pipes.set([...pipes(), { nominalSize: '', odMm: 0, schedule: '', wallMm: 0 }])"><ss-icon name="plus" [size]="13" />Add row</button>
            <button type="button" class="abtn abtn-pri abtn-sm" [disabled]="busy() || !canEdit()" (click)="savePipes()">{{ busy() ? 'Saving…' : 'Save pipe schedule' }}</button></div>
        </div>
      }
    }`,
})
export class QuoteDataComponent {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  protected readonly units = UNITS;
  protected readonly shapes = SHAPES;
  protected readonly scheduleNames = ['SCH 10', 'SCH 20', 'SCH 30', 'STD', 'SCH 40', 'SCH 60', 'XS', 'SCH 80', 'SCH 120', 'SCH 160', 'XXS', 'Light', 'Medium', 'Heavy'];
  protected readonly tabs: [Tab, string][] = [['products', 'Products'], ['settings', 'GST, terms & bank'], ['hsn', 'HSN codes'], ['pipes', 'MS pipe schedule']];
  protected readonly tab = signal<Tab>('products');
  protected readonly busy = signal(false);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly canEdit = computed(() => this.auth.can(Perm.SettingsManage));
  protected readonly settings = signal<QuoteSettings | null>(null);
  protected readonly products = signal<QuoteProduct[]>([]);
  protected readonly editing = signal<QuoteProduct | null>(null);
  protected readonly hsn = signal<HsnRef[]>([]);
  protected readonly pipes = signal<MsPipeRef[]>([]);
  protected readonly materials = signal<MaterialRef[]>([]);
  protected q = '';
  protected blank = blankProduct;

  constructor() {
    inject(SeoService).set({ title: 'Quote data | Sun Steel Traders admin', path: '/admin/quote-data', noindex: true });
    this.loadProducts();
    this.api.quoteSettings().subscribe({ next: (s) => this.settings.set(s), error: (e) => this.fail(e) });
    this.api.quoteHsn().subscribe({ next: (h) => this.hsn.set(h), error: (e) => this.fail(e) });
    this.api.quotePipes().subscribe({ next: (p) => this.pipes.set(p), error: (e) => this.fail(e) });
    this.api.quoteLookups().subscribe({ next: (l) => this.materials.set(l.materials), error: () => undefined });
  }

  protected open(t: Tab): void { this.tab.set(t); this.message.set(null); }
  protected copy(p: QuoteProduct): QuoteProduct { return { ...p }; }
  protected withoutRow<T>(rows: T[], i: number): T[] { return rows.filter((_, j) => j !== i); }

  protected loadProducts(): void {
    this.api.quoteProducts(this.q.trim()).subscribe({ next: (p) => this.products.set(p), error: (e) => this.fail(e) });
  }

  protected saveProduct(p: QuoteProduct): void {
    this.run(this.api.saveQuoteProduct(p), () => { this.editing.set(null); this.loadProducts(); }, 'Product saved.');
  }

  protected removeProduct(p: QuoteProduct): void {
    if (!confirm(`Delete ${p.description}? Quotations already made keep their own copy.`)) return;
    this.run(this.api.deleteQuoteProduct(p.id), () => this.loadProducts(), 'Product deleted.');
  }

  protected saveSettings(): void {
    this.run(this.api.saveQuoteSettings(this.settings()!), (s) => this.settings.set(s), 'Settings saved.');
  }

  protected saveHsn(): void {
    this.run(this.api.saveQuoteHsn(this.hsn().filter((r) => r.hsn.trim())), (h) => this.hsn.set(h), 'HSN codes saved.');
  }

  protected savePipes(): void {
    this.run(this.api.saveQuotePipes(this.pipes().filter((r) => r.nominalSize.trim() || r.schedule.trim())), (p) => this.pipes.set(p), 'Pipe schedule saved.');
  }

  private run<T>(call: import('rxjs').Observable<T>, then: (v: T) => void, ok: string): void {
    this.busy.set(true);
    this.message.set(null);
    call.subscribe({
      next: (v) => { this.busy.set(false); then(v); this.message.set({ ok: true, text: ok }); },
      error: (e) => { this.busy.set(false); this.fail(e); },
    });
  }

  private fail(e: unknown): void { this.message.set({ ok: false, text: apiError(e) }); }
}
