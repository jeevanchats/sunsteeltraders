import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiError } from '../../../core/models/api.model';
import { lineFigures } from '../../../core/quote/quote-lines';
import { inr, inWords, isInterState, quoteTotals } from '../../../core/quote/quote-math';
import { rememberRates, rememberText } from '../../../core/quote/quote-memory';
import { AdminApiService, QuoteDetail, QuoteItemDto, QuoteItemInput, QuoteLookups, SaveQuote } from '../../../core/services/admin-api.service';
import { SeoService } from '../../../core/services/seo.service';
import { QUOTE_TYPES, QuoteType, quoteTypeLabel, tonnes } from '../../../core/quote/quote-types';
import { IconComponent } from '../../../shared/icon.component';
import { QuoteLineComponent } from './quote-line.component';

const PAYMENT_OPTIONS = [
  '100% advance with order', '50% advance, balance before dispatch', 'Payment on delivery', 'Credit: 15 days from invoice',
];
const CUSTOM = 'Custom';

/**
 * One quotation: customer, lines (calculated, by weight, by unit), charges, GST per line, payment terms, bank details,
 * with live totals. The server recomputes every weight and total on save and is the source of truth.
 * To send: where the browser can share files (phones) the share sheet opens with the PDF; elsewhere the PDF downloads
 * and WhatsApp opens to the customer's number for the salesperson to attach it. Nothing is ever sent automatically.
 */
@Component({
  selector: 'ss-quote-edit',
  imports: [FormsModule, RouterLink, NgTemplateOutlet, IconComponent, QuoteLineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/admin/quotes" class="mb-3 inline-block text-[13px] text-[#6B7485] hover:underline">← All quotations</a>
    @if (loading()) {
      <div class="card text-[#6B7485]">Loading…</div>
    } @else if (lk(); as lookups) {
      <header class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-[22px] font-medium">{{ saved()?.reference ?? 'New quotation' }}</h1>
          <p class="mt-0.5 text-[13.5px] text-[#6B7485]">
            @if (saved(); as s) { {{ s.status }} · {{ typeLabel(s.quoteType) }} · valid until {{ s.validUntil }}@if (s.leadReference) { · for request <a routerLink="/admin/leads" class="underline">{{ s.leadReference }}</a> } }
            @else { Fill in the customer and lines, then save. }
          </p>
        </div>
        <div class="hidden flex-wrap items-center gap-2 lg:flex">
          <ng-container *ngTemplateOutlet="actions" />
          <ng-container *ngTemplateOutlet="statusSelect" />
        </div>
        <div class="w-full lg:hidden"><ng-container *ngTemplateOutlet="statusSelect" /></div>
      </header>

      @if (message(); as m) { <p class="alert mb-4" [class.alert-ok]="m.ok" role="status">{{ m.text }}</p> }
      @if (dirty() && saved()) { <p class="ahint mb-3">Save first; the PDF and WhatsApp use the saved version.</p> }
      @if (lookups.defaults.gstRaw === null || lookups.defaults.gstFinished === null) {
        <p class="alert mb-4">GST rates are not set yet ({{ lookups.defaults.gstRaw === null ? 'raw material' : '' }}{{ lookups.defaults.gstRaw === null && lookups.defaults.gstFinished === null ? ' and ' : '' }}{{ lookups.defaults.gstFinished === null ? 'finished product' : '' }}). Set them in <a routerLink="/admin/quote-data" class="underline">Quote data</a>, or type a rate on each line.</p>
      }

      <div class="grid gap-5 pb-24 xl:grid-cols-[minmax(0,1fr)_340px] lg:pb-0">
        <div class="grid content-start gap-5">
          <fieldset class="card grid gap-3">
            <legend class="sr-only">Quotation type</legend>
            <b class="font-medium">Type of quotation *</b>
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Quotation type">
              @for (qt of types; track qt.key) {
                <button type="button" class="rounded-lg border p-3 text-left text-[13px]" [class.border-primary]="f.quoteType === qt.key" [class.bg-primary]="f.quoteType === qt.key" [class.text-on-primary]="f.quoteType === qt.key"
                  [class.border-[#E3E6EB]]="f.quoteType !== qt.key" [attr.aria-pressed]="f.quoteType === qt.key" (click)="setQuoteType(qt.key)">
                  <b class="block text-[14px] font-medium">{{ qt.label }}</b><span class="mt-0.5 block opacity-80">{{ qt.hint }}</span></button>
              }
            </div>
          </fieldset>

          <fieldset class="card grid gap-4">
            <legend class="sr-only">Customer</legend>
            <b class="font-medium">Customer</b>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="alabel">Name *<input class="ainput" maxlength="150" name="cn" [(ngModel)]="f.customerName" (ngModelChange)="touch()" /></label>
              <label class="alabel">Company<input class="ainput" maxlength="150" name="co" [(ngModel)]="f.company" (ngModelChange)="touch()" /></label>
              <label class="alabel">WhatsApp number *<input class="ainput" maxlength="30" name="ph" inputmode="tel" [(ngModel)]="f.phone" (ngModelChange)="touch()" placeholder="10-digit mobile" /></label>
              <label class="alabel">Email<input class="ainput" maxlength="256" name="em" [(ngModel)]="f.email" (ngModelChange)="touch()" /></label>
              <label class="alabel">GSTIN<input class="ainput uppercase" maxlength="15" name="gst" [(ngModel)]="f.gstin" (ngModelChange)="gstinChanged()" placeholder="Optional" /></label>
              <label class="alabel">Delivery city<input class="ainput" maxlength="80" name="city" [(ngModel)]="f.city" (ngModelChange)="touch()" /></label>
            </div>
            <label class="alabel">Address<textarea class="ainput" maxlength="400" name="addr" [(ngModel)]="f.address" (ngModelChange)="touch()" rows="2"></textarea></label>
          </fieldset>

          <section class="card grid gap-3" aria-labelledby="lines-h">
            <b id="lines-h" class="font-medium">Lines</b>
            @for (l of f.items; track l) {
              <ss-quote-line [line]="l" [index]="$index" [lookups]="lookups" [rev]="rev()" [canRemove]="f.items.length > 1"
                (changed)="touch()" (removed)="removeLine($index)" (duplicated)="duplicateLine($index)" />
            }
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="abtn" (click)="addLine()"><ss-icon name="plus" [size]="14" />Add line</button>
              <button type="button" class="abtn abtn-danger" (click)="clear()">Clear quotation</button>
              <span class="ahint">Prices are ex-godown plus GST. Weights are theoretical.</span>
            </div>
            @if (missing() > 0) { <p class="ahint text-[#C2410C]">{{ missing() }} line{{ missing() === 1 ? '' : 's' }} without a price or GST rate {{ missing() === 1 ? 'is' : 'are' }} left out of the totals.</p> }
          </section>

          <fieldset class="card grid gap-4">
            <legend class="sr-only">Terms</legend>
            <label class="alabel">Notes on the quotation<textarea class="ainput" maxlength="2000" name="notes" [(ngModel)]="f.notes" (ngModelChange)="touch()" rows="2" placeholder="e.g. Delivery within 2 working days of payment."></textarea></label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="alabel">Payment terms
                <select class="ainput" (change)="setPayment($any($event.target).value)">
                  @for (o of paymentOptions; track o) { <option [value]="o" [selected]="paymentChoice() === o">{{ o }}</option> }
                  <option value="Custom" [selected]="paymentChoice() === 'Custom'">Custom text</option>
                </select></label>
              @if (paymentChoice() === 'Custom') {
                <label class="alabel">Custom payment terms<input class="ainput" maxlength="200" name="pay" [(ngModel)]="f.paymentTerms" (ngModelChange)="touch()" /></label>
              }
            </div>
            <label class="alabel">Bank details<textarea class="ainput" maxlength="600" name="bank" [(ngModel)]="f.bankDetails" (ngModelChange)="touch()" rows="3" placeholder="Account name, bank, account number, IFSC"></textarea>
              <span class="ahint">Set once in Quote data. Left empty, the bank block is not printed.</span></label>
            <label class="alabel">Terms & conditions<textarea class="ainput" maxlength="4000" name="terms" [(ngModel)]="f.terms" (ngModelChange)="touch()" rows="7"></textarea>
              <span class="ahint">Starts from the terms in Quote data. Edit freely for this quotation.</span></label>
          </fieldset>
        </div>

        <aside class="grid content-start gap-5">
          <fieldset class="card grid gap-3">
            <legend class="sr-only">Extras</legend>
            <b class="font-medium">Extras & GST</b>
            @for (c of visibleCharges(); track c[0]) {
              <label class="alabel grid-cols-[1fr_120px] items-center !grid">{{ c[1] }} (₹)
                <input class="ainput text-right" type="number" min="0" step="0.01" inputmode="decimal" [name]="c[0]" [ngModel]="num(c[0])" (ngModelChange)="setNum(c[0], $event)" /></label>
            }
            @if (!allExtras()) { <button type="button" class="ahint text-left underline" (click)="allExtras.set(true)">Show all extras</button> }
            <div class="grid grid-cols-2 gap-3">
              <label class="alabel">GST on extras %<input class="ainput" type="number" min="0" max="28" step="0.01" name="gstRate" [(ngModel)]="f.gstRate" (ngModelChange)="touch()" /></label>
              <label class="alabel">Valid (days)<input class="ainput" type="number" min="1" max="90" name="valid" [(ngModel)]="f.validDays" (ngModelChange)="touch()" /></label>
            </div>
            <label class="flex items-center gap-2 text-[13.5px]"><input type="checkbox" name="igst" [(ngModel)]="f.interState" (ngModelChange)="touch()" />Other state (IGST instead of CGST + SGST)</label>
            <label class="alabel">Quote date<input class="ainput" type="date" name="qd" [(ngModel)]="f.quoteDate" (ngModelChange)="touch()" /></label>
          </fieldset>

          <div class="card grid gap-1.5 text-[13.5px] tabular-nums" aria-live="polite">
            <b class="mb-1 font-medium">Totals</b>
            <div class="flex justify-between"><span class="text-[#6B7485]">Subtotal ({{ t().totalKg }} kg{{ f.quoteType === 'Wholesale' ? ' · ' + tonnes(t().totalKg) + ' t' : '' }})</span><span>{{ inr(t().subtotal) }}</span></div>
            @if (t().discount) { <div class="flex justify-between"><span class="text-[#6B7485]">Discount</span><span>−{{ inr(t().discount) }}</span></div> }
            @if (f.cuttingCharge) { <div class="flex justify-between"><span class="text-[#6B7485]">Cutting</span><span>{{ inr(f.cuttingCharge) }}</span></div> }
            @if (f.loadingCharge) { <div class="flex justify-between"><span class="text-[#6B7485]">Loading</span><span>{{ inr(f.loadingCharge) }}</span></div> }
            @if (f.unloadingCharge) { <div class="flex justify-between"><span class="text-[#6B7485]">Unloading</span><span>{{ inr(f.unloadingCharge) }}</span></div> }
            @if (f.transportCharge) { <div class="flex justify-between"><span class="text-[#6B7485]">Freight</span><span>{{ inr(f.transportCharge) }}</span></div> }
            <div class="flex justify-between font-medium"><span>Taxable</span><span>{{ inr(t().taxable) }}</span></div>
            @for (g of t().taxGroups; track g.rate) {
              @if (f.interState) { <div class="flex justify-between"><span class="text-[#6B7485]">IGST {{ g.rate }}%</span><span>{{ inr(g.igst) }}</span></div> }
              @else {
                <div class="flex justify-between"><span class="text-[#6B7485]">CGST {{ g.rate / 2 }}%</span><span>{{ inr(g.cgst) }}</span></div>
                <div class="flex justify-between"><span class="text-[#6B7485]">SGST {{ g.rate / 2 }}%</span><span>{{ inr(g.sgst) }}</span></div>
              }
            }
            @if (t().roundOff) { <div class="flex justify-between"><span class="text-[#6B7485]">Round off</span><span>{{ inr(t().roundOff) }}</span></div> }
            <div class="mt-1 flex justify-between border-t border-[#EEF0F3] pt-2 text-[16px] font-medium"><span>Grand total</span><span>₹ {{ inr(t().grandTotal) }}</span></div>
            <p class="text-[12.5px] text-[#6B7485]">{{ words() }}</p>
          </div>
        </aside>
      </div>

      <!-- Phones: the total and the actions stay in view while editing. -->
      <div class="fixed inset-x-0 bottom-0 z-30 grid gap-2 border-t border-[#E3E6EB] bg-white px-4 pb-3 pt-2 shadow-[0_-4px_12px_rgba(0,0,0,.06)] lg:hidden">
        <div class="flex items-baseline justify-between gap-3">
          <small class="text-[12px] text-[#6B7485]">{{ f.items.length }} line{{ f.items.length === 1 ? '' : 's' }} · {{ t().totalKg }} kg</small>
          <b class="whitespace-nowrap text-[18px] font-medium tabular-nums">₹ {{ inr(t().grandTotal) }}</b>
        </div>
        <div class="flex gap-2"><ng-container *ngTemplateOutlet="actions" /></div>
      </div>

      <ng-template #actions>
        @if (dirty()) { <span class="pill pill-warn hidden sm:inline-block">Unsaved</span> }
        <button type="button" class="abtn abtn-pri flex-1 justify-center lg:flex-none" [disabled]="busy() || !dirty()" (click)="save()">{{ busy() ? 'Saving…' : 'Save' }}</button>
        @if (saved()) {
          <button type="button" class="abtn flex-1 justify-center lg:flex-none" [disabled]="busy() || dirty()" (click)="pdf()"><ss-icon name="file" [size]="14" />PDF</button>
          <button type="button" class="abtn flex-1 justify-center lg:flex-none" [disabled]="busy() || dirty()" (click)="send()"><ss-icon name="wa" [size]="14" />Send</button>
        }
      </ng-template>

      <ng-template #statusSelect>
        @if (saved(); as s) {
          <select class="ainput !h-[34px] !w-auto" [ngModel]="s.status" (ngModelChange)="setStatus($event)" [disabled]="busy() || dirty()" aria-label="Status">
            @for (st of statuses; track st) { <option [value]="st">{{ st }}</option> }
          </select>
        }
      </ng-template>
    }`,
})
export class QuoteEditComponent {
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);
  private readonly idParam = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly statuses = ['Draft', 'Sent', 'Accepted', 'Rejected'];
  protected readonly paymentOptions = PAYMENT_OPTIONS;
  protected readonly charges: [string, string][] = [
    ['cuttingCharge', 'Cutting'], ['loadingCharge', 'Loading'], ['unloadingCharge', 'Unloading'], ['transportCharge', 'Freight'], ['discount', 'Discount (less)'],
  ];
  protected readonly inr = inr;
  protected readonly types = QUOTE_TYPES;
  protected readonly typeLabel = quoteTypeLabel;
  protected readonly tonnes = tonnes;
  protected readonly allExtras = signal(false);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly dirty = signal(false);
  protected readonly saved = signal<QuoteDetail | null>(null);
  protected readonly lk = signal<QuoteLookups | null>(null);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly rev = signal(0);
  protected f: SaveQuote = blank();
  private pdfBlob: Blob | null = null;

  /** Live figures for every line; the server's totals win on save. */
  private readonly figs = computed(() => {
    this.rev();
    const lk = this.lk();
    if (!lk) return [];
    const ref = { materials: lk.materials, sections: lk.sections, msPipes: lk.msPipes };
    const d = { weightDecimals: lk.defaults.weightDecimals, gstRaw: lk.defaults.gstRaw, gstFinished: lk.defaults.gstFinished };
    return this.f.items.map((l) => lineFigures(l, ref, d));
  });
  protected readonly t = computed(() => {
    this.rev();
    // A line with no GST rate can't be taxed, so it stays out of the totals rather than being taxed at a guess.
    const lines = this.figs().map((x) => ({ kg: x.kg, amount: x.gstRate === null ? null : x.amount, gstRate: x.gstRate ?? 0 }));
    return quoteTotals(lines, this.f, this.f.gstRate, this.f.interState);
  });
  protected readonly missing = computed(() => this.figs().filter((x) => x.amount === null || x.gstRate === null).length);
  protected readonly words = computed(() => (this.t().grandTotal > 0 ? inWords(this.t().grandTotal) : ''));
  protected readonly paymentChoice = computed(() => {
    this.rev();
    const v = this.f.paymentTerms;
    return !v ? PAYMENT_OPTIONS[0] : PAYMENT_OPTIONS.includes(v) ? v : CUSTOM;
  });

  constructor() {
    inject(SeoService).set({ title: 'Quotation | Sun Steel Traders admin', path: '/admin/quotes', noindex: true });
    this.api.quoteLookups().subscribe({
      next: (lk) => {
        this.lk.set(lk);
        if (this.idParam === 'new') {
          const d = lk.defaults;
          this.f = {
            ...blank(), validDays: d.validDays, gstRate: d.gstRaw ?? 0, terms: (d.terms ?? '').replace('{days}', String(d.validDays)) || null,
            paymentTerms: d.paymentTerms ?? PAYMENT_OPTIONS[0], bankDetails: d.bankDetails,
          };
          this.loading.set(false);
          this.touch(true);
        } else {
          this.api.quote(Number(this.idParam)).subscribe({ next: (q) => { this.load(q); this.loading.set(false); }, error: (e) => { this.loading.set(false); this.fail(e); } });
        }
      },
      error: (e) => { this.loading.set(false); this.fail(e); },
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onUnload(e: BeforeUnloadEvent): void {
    if (this.dirty()) e.preventDefault();
  }

  protected setQuoteType(t: QuoteType): void { this.f.quoteType = t; this.touch(); }

  /**
   * Extras that apply to this type of quotation: cutting for cut pieces, loading and unloading unless it is a project
   * (supplied direct, never handled here). Anything with a value, or after "Show all extras", is always shown.
   */
  protected visibleCharges(): [string, string][] {
    const t = this.f.quoteType;
    return this.charges.filter((c) => this.allExtras() || this.num(c[0]) !== 0 || c[0] === 'transportCharge' || c[0] === 'discount'
      || (c[0] === 'cuttingCharge' && t === 'CutPieces') || ((c[0] === 'loadingCharge' || c[0] === 'unloadingCharge') && t !== 'Project'));
  }

  protected touch(fresh = false): void { this.rev.update((v) => v + 1); if (!fresh) this.dirty.set(true); }
  protected num(k: string): number { return (this.f as unknown as Record<string, number>)[k]; }
  protected setNum(k: string, v: number): void { (this.f as unknown as Record<string, number>)[k] = Number(v) || 0; this.touch(); }
  protected gstinChanged(): void { this.f.interState = isInterState(this.f.gstin); this.touch(); }
  protected addLine(): void { this.f.items = [...this.f.items, blankLine()]; this.touch(); }
  protected removeLine(i: number): void { this.f.items = this.f.items.filter((_, j) => j !== i); this.touch(); }
  protected duplicateLine(i: number): void {
    const copy = structuredClone(this.f.items[i]);
    this.f.items = [...this.f.items.slice(0, i + 1), copy, ...this.f.items.slice(i + 1)];
    this.touch();
  }

  protected clear(): void {
    if (!confirm('Clear all lines and extras on this quotation?')) return;
    this.f = { ...this.f, items: [blankLine()], cuttingCharge: 0, loadingCharge: 0, unloadingCharge: 0, transportCharge: 0, discount: 0, notes: null };
    this.touch();
  }

  protected setPayment(v: string): void {
    // A blank space keeps the dropdown on "Custom text" until something is typed; it is trimmed away on save.
    this.f.paymentTerms = v === CUSTOM ? ' ' : v;
    this.touch();
  }

  protected save(): void {
    if (!this.f.quoteType) { this.message.set({ ok: false, text: 'Choose the type of quotation first: project, wholesale, retail or cut pieces.' }); return; }
    this.busy.set(true);
    this.message.set(null);
    const id = this.saved()?.quoteId;
    const body: SaveQuote = { ...this.f, paymentTerms: this.f.paymentTerms?.trim() || null, items: this.f.items.map(toInput) };
    (id ? this.api.updateQuote(id, body) : this.api.createQuote(body)).subscribe({
      next: (q) => {
        rememberRates(q.items);
        rememberText(q.items);
        this.load(q);
        this.busy.set(false);
        this.message.set({ ok: true, text: 'Quotation saved.' });
        if (!id) this.router.navigate(['/admin/quotes', q.quoteId], { replaceUrl: true });
      },
      error: (e) => { this.busy.set(false); this.fail(e); },
    });
  }

  protected pdf(): void {
    const q = this.saved()!;
    const done = (blob: Blob) => { this.busy.set(false); download(blob, fileName(q)); };
    if (this.pdfBlob) return done(this.pdfBlob);
    this.busy.set(true);
    this.api.quotePdf(q.quoteId).subscribe({ next: (b) => { this.pdfBlob = b; done(b); }, error: (e) => { this.busy.set(false); this.fail(e); } });
  }

  /**
   * Phones: the share sheet opens with the PDF and the message, and the salesperson picks WhatsApp and the customer.
   * Elsewhere: the PDF downloads and WhatsApp opens to the customer's number with the message ready; they attach the file.
   * The PDF is fetched ahead of time, because browsers only open the share sheet straight from a tap.
   */
  protected send(): void {
    const q = this.saved()!;
    if (q.items.some((i) => (i.itemType === 'ManualUnit' ? !i.unitPrice : !i.ratePerKg))) {
      this.message.set({ ok: false, text: 'Every line needs a price before sending.' });
      return;
    }
    const text = new URL(q.whatsAppUrl).searchParams.get('text') ?? '';
    const file = this.pdfBlob ? new File([this.pdfBlob], fileName(q), { type: 'application/pdf' }) : null;
    if (file && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], text }).then(
        () => { this.message.set({ ok: true, text: 'Shared from the share sheet. Check the chat to confirm it went.' }); this.markSent(); },
        (e: unknown) => { if ((e as { name?: string })?.name !== 'AbortError') this.message.set({ ok: false, text: 'The share sheet could not open. Use PDF, then send it in WhatsApp.' }); },
      );
      return;
    }
    window.open(q.whatsAppUrl, '_blank', 'noopener'); // opened inside the tap so it isn't blocked
    this.pdf();
    this.markSent();
    this.message.set({ ok: true, text: 'PDF downloaded and WhatsApp opened to the customer. Attach the downloaded PDF in the chat and press Send. Nothing was sent automatically.' });
  }

  private markSent(): void { if (this.saved()?.status === 'Draft') this.setStatus('Sent'); }

  protected setStatus(status: string): void {
    const q = this.saved()!;
    this.api.setQuoteStatus(q.quoteId, status).subscribe({ next: (d) => this.load(d), error: (e) => { this.fail(e); this.load(q); } });
  }

  private load(q: QuoteDetail): void {
    this.saved.set(q);
    this.f = {
      quoteType: q.quoteType as QuoteType, customerName: q.customerName, company: q.company, gstin: q.gstin, phone: q.phone, email: q.email, city: q.city, address: q.address,
      quoteDate: q.quoteDate, validDays: q.validDays, cuttingCharge: q.cuttingCharge, loadingCharge: q.loadingCharge,
      unloadingCharge: q.unloadingCharge, transportCharge: q.transportCharge, discount: q.discount, gstRate: q.gstRate,
      interState: q.interState, notes: q.notes, paymentTerms: q.paymentTerms, bankDetails: q.bankDetails, terms: q.terms,
      items: q.items.map(fromDto),
    };
    this.dirty.set(false);
    this.touch(true);
    this.prefetchPdf(q);
  }

  private prefetchPdf(q: QuoteDetail): void {
    this.pdfBlob = null;
    this.api.quotePdf(q.quoteId).subscribe({ next: (b) => { if (this.saved()?.quoteId === q.quoteId && !this.dirty()) this.pdfBlob = b; }, error: () => undefined });
  }

  private fail(e: unknown): void { this.message.set({ ok: false, text: apiError(e) }); }
}

function blankLine(): QuoteItemInput {
  return {
    itemType: 'Calculated', brand: null, description: null, size: null, model: null, quantity: 1, unit: 'pcs', hsn: null,
    gstCategory: 'Raw', gstRate: null, remarks: null, materialKey: null, form: null, dims: {}, section: null, schedule: null,
    lengthMm: 0, weightPerUnit: 0, ratePerKg: 0, unitPrice: null,
  };
}

function blank(): SaveQuote {
  return {
    quoteType: '', customerName: '', company: null, gstin: null, phone: '', email: null, city: null, address: null, quoteDate: null, validDays: 3,
    cuttingCharge: 0, loadingCharge: 0, unloadingCharge: 0, transportCharge: 0, discount: 0, gstRate: 18, interState: false,
    notes: null, paymentTerms: null, bankDetails: null, terms: null, items: [blankLine()],
  };
}

/** Only the fields the server reads: it recomputes the rest. */
function toInput(l: QuoteItemInput): QuoteItemInput {
  return {
    itemType: l.itemType, brand: l.brand, description: l.description, size: l.size, model: l.model, quantity: l.quantity, unit: l.unit, hsn: l.hsn,
    gstCategory: l.gstCategory, gstRate: l.gstRate, remarks: l.remarks, materialKey: l.materialKey, form: l.form, dims: l.dims, section: l.section,
    schedule: l.schedule, lengthMm: l.lengthMm, weightPerUnit: l.weightPerUnit, ratePerKg: l.ratePerKg, unitPrice: l.unitPrice,
  };
}

function fromDto(d: QuoteItemDto): QuoteItemInput {
  return { ...toInput(d), dims: { ...(d.dims ?? {}) }, lengthMm: Number(d.lengthMm ?? 0) };
}

const fileName = (q: QuoteDetail): string =>
  `Quotation_${q.reference}_${(q.company ?? q.customerName).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`;

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
