import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiError } from '../../../core/models/api.model';
import { lineFigures } from '../../../core/quote/quote-lines';
import { inr, inWords, isInterState, quoteTotals } from '../../../core/quote/quote-math';
import { clearDraft, loadDraft, rememberRates, rememberText, saveDraft } from '../../../core/quote/quote-memory';
import { headChecks, lineChecks } from '../../../core/quote/quote-progress';
import { AdminApiService, Customer, QuoteDetail, QuoteItemDto, QuoteItemInput, QuoteLookups, SaveQuote } from '../../../core/services/admin-api.service';
import { SeoService } from '../../../core/services/seo.service';
import { QUOTE_TYPES, QuoteType, quoteTypeLabel, tonnes } from '../../../core/quote/quote-types';
import { IconComponent } from '../../../shared/icon.component';
import { QuoteLineComponent } from './quote-line.component';

const PAYMENT_OPTIONS = [
  'Immediate payment', '100% advance with order', '50% advance, balance before dispatch', 'Payment on delivery', 'Credit: 15 days from invoice',
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
    <div class="qf">
    <a routerLink="/admin/quotes" class="mb-3 inline-flex items-center gap-1 py-1 text-[14.5px] font-medium text-[#5B6678] hover:underline">← All quotations</a>
    @if (loading()) {
      <div class="card text-[#6B7485]">Loading…</div>
    } @else if (lk(); as lookups) {
      <header class="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <h1 class="text-[24px] font-semibold leading-tight">{{ saved()?.reference ?? 'New quotation' }}</h1>
          <p class="mt-1 text-[14.5px] text-[#5B6678]">
            @if (saved(); as s) { <span class="pill" [class.pill-warn]="s.status === 'Draft'" [class.pill-ok]="s.status === 'Accepted'">{{ s.status }}</span> {{ typeLabel(s.quoteType) }} · valid until {{ s.validUntil }}@if (s.leadReference) { · for request <a routerLink="/admin/leads" class="underline">{{ s.leadReference }}</a> } }
            @else { Fill in the three steps below. Fields turn green as you complete them. }
          </p>
        </div>
        <div class="hidden flex-wrap items-center gap-2 lg:flex">
          <ng-container *ngTemplateOutlet="actions" />
          <ng-container *ngTemplateOutlet="statusSelect" />
        </div>
        <div class="w-full lg:hidden"><ng-container *ngTemplateOutlet="statusSelect" /></div>
      </header>

      @if (restored(); as r) {
        <p class="alert alert-warn mb-4 flex flex-wrap items-center justify-between gap-2 !text-[14.5px]" role="status">
          <span>Restored your unsaved changes from {{ r }}. Save to keep them.</span>
          <button type="button" class="abtn" (click)="discardDraft()">Discard them</button>
        </p>
      }
      @if (message(); as m) { <p class="alert mb-4 !text-[14.5px]" [class.alert-ok]="m.ok" role="status">{{ m.text }}</p> }
      @if (dirty() && saved()) { <p class="ahint mb-3">Save first; the PDF and WhatsApp use the saved version.</p> }
      @if (lookups.defaults.gstRaw === null || lookups.defaults.gstFinished === null) {
        <p class="alert mb-4">GST rates are not set yet ({{ lookups.defaults.gstRaw === null ? 'raw material' : '' }}{{ lookups.defaults.gstRaw === null && lookups.defaults.gstFinished === null ? ' and ' : '' }}{{ lookups.defaults.gstFinished === null ? 'finished product' : '' }}). Set them in <a routerLink="/admin/quote-data" class="underline">Quote data</a>, or type a rate on each line.</p>
      }

      <!-- where am I, what is missing, take me there -->
      <div class="qprog" role="status" aria-live="polite">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <b class="block text-[15.5px] font-bold">{{ prog().done }} of {{ prog().total }} required fields done</b>
            <span class="block truncate text-[13.5px] text-[#5B6678]">{{ prog().todo.length ? 'Next: ' + prog().todo[0].label : 'Everything required is filled in.' }}</span>
          </div>
          @if (prog().todo.length) { <button type="button" class="qnext" (click)="jump(prog().todo[0].id)">Next ›</button> }
          @else { <span class="qchip qchip-ok">✓ Ready</span> }
        </div>
        <div class="qbar" aria-hidden="true"><i [style.width.%]="prog().pct"></i></div>
        @if (prog().todo.length > 1) {
          <details class="qlist"><summary>Show all {{ prog().todo.length }} still needed</summary>
            @for (c of prog().todo; track c.id) { <button type="button" (click)="jump(c.id)">{{ c.label }}</button> }
          </details>
        }
      </div>

      <div class="grid gap-5 pb-48 xl:grid-cols-[minmax(0,1fr)_360px] lg:pb-0">
        <div class="grid content-start gap-5">
          <section class="qs" id="sec-type" aria-labelledby="type-h">
            <div class="qs-head">
              <span class="qs-n" [class.qs-done]="!!f.quoteType">@if (f.quoteType) { ✓ } @else { 1 }</span>
              <div><h2 id="type-h">Type of quotation</h2><small [class.need]="!f.quoteType">{{ f.quoteType ? typeLabel(f.quoteType) + ' selected' : 'Choose one to continue' }}</small></div>
            </div>
            <div class="qt fd" [class.fd-need]="!f.quoteType" role="group" aria-label="Quotation type">
              @for (qt of types; track qt.key; let first = $first) {
                <button type="button" [attr.id]="first ? 'q-type' : null" [class.on]="f.quoteType === qt.key" [attr.aria-pressed]="f.quoteType === qt.key" (click)="setQuoteType(qt.key)">
                  <b>{{ qt.label }}@if (f.quoteType === qt.key) { <span class="ml-1">✓</span> }</b><span class="block text-[13.5px] opacity-85">{{ qt.hint }}</span></button>
              }
            </div>
          </section>

          <section class="qs" id="sec-customer" aria-labelledby="cust-h">
            <div class="qs-head">
              <span class="qs-n" [class.qs-done]="custDone()">@if (custDone()) { ✓ } @else { 2 }</span>
              <div><h2 id="cust-h">Customer</h2><small [class.need]="!custDone()">{{ custDone() ? 'Name and WhatsApp number filled in' : 'Name and WhatsApp number are required' }}</small></div>
            </div>
            <div class="relative">
              <label class="fd" [class.fd-ok]="false"><span class="fl">Find a saved customer</span>
                <input class="ainput" name="find" autocomplete="off" placeholder="Type a name, company or phone number" [ngModel]="find()" (ngModelChange)="findCustomer($event)" /></label>
              @if (matches().length) {
                <ul class="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-[#D5DBE4] bg-white shadow-lg" role="listbox">
                  @for (c of matches(); track c.id) {
                    <li><button type="button" role="option" class="block w-full px-4 py-3 text-left text-[15.5px] hover:bg-[#F3F6FA]" (click)="useCustomer(c)">
                      <b class="font-semibold">{{ c.name }}</b><small class="block text-[13.5px] text-[#6B7485]">{{ c.company || c.city || '' }} {{ c.phone }}</small></button></li>
                  }
                </ul>
              }
              <p class="ahint mt-2">New customers are added to the <a routerLink="/admin/customers" class="underline">Customers</a> list when you save.</p>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="fd" [class.fd-need]="!nameOk()" [class.fd-ok]="nameOk()"><span class="fl">Name</span><input class="ainput" id="q-name" maxlength="150" name="cn" autocomplete="off" [(ngModel)]="f.customerName" (ngModelChange)="touch()" /></label>
              <label class="fd" [class.fd-ok]="has(f.company)"><span class="fl">Company</span><input class="ainput" maxlength="150" name="co" [(ngModel)]="f.company" (ngModelChange)="touch()" /></label>
              <label class="fd" [class.fd-need]="!phoneOk()" [class.fd-ok]="phoneOk()"><span class="fl">WhatsApp number</span><input class="ainput" id="q-phone" maxlength="30" name="ph" inputmode="tel" [(ngModel)]="f.phone" (ngModelChange)="touch()" placeholder="10-digit mobile" /></label>
              <label class="fd" [class.fd-ok]="has(f.email)"><span class="fl">Email</span><input class="ainput" maxlength="256" name="em" inputmode="email" [(ngModel)]="f.email" (ngModelChange)="touch()" /></label>
              <label class="fd" [class.fd-ok]="has(f.gstin)"><span class="fl">GSTIN</span><input class="ainput uppercase" maxlength="15" name="gst" [(ngModel)]="f.gstin" (ngModelChange)="gstinChanged()" placeholder="Optional" /></label>
              <label class="fd" [class.fd-ok]="has(f.city)"><span class="fl">Delivery city</span><input class="ainput" maxlength="80" name="city" [(ngModel)]="f.city" (ngModelChange)="touch()" /></label>
              <label class="fd" [class.fd-ok]="has(f.buyerRef)"><span class="fl">Buyer's order / reference no.</span><input class="ainput" maxlength="60" name="bref" [(ngModel)]="f.buyerRef" (ngModelChange)="touch()" /></label>
              <label class="fd" [class.fd-ok]="has(f.dispatchedThrough)"><span class="fl">Dispatched through</span><input class="ainput" maxlength="80" name="disp" [(ngModel)]="f.dispatchedThrough" (ngModelChange)="touch()" placeholder="Lorry or transport" /></label>
            </div>
            <label class="fd" [class.fd-ok]="has(f.address)"><span class="fl">Address</span><textarea class="ainput" maxlength="400" name="addr" [(ngModel)]="f.address" (ngModelChange)="touch()" rows="2"></textarea></label>
          </section>

          <section class="qs" id="sec-lines" aria-labelledby="lines-h">
            <div class="qs-head">
              <span class="qs-n" [class.qs-done]="linesDone()">@if (linesDone()) { ✓ } @else { 3 }</span>
              <div><h2 id="lines-h">Lines</h2><small [class.need]="!linesDone()">{{ prog().linesDone }} of {{ f.items.length }} line{{ f.items.length === 1 ? '' : 's' }} complete</small></div>
            </div>
            @for (l of f.items; track l) {
              <ss-quote-line [line]="l" [index]="$index" [lookups]="lookups" [rev]="rev()" [canRemove]="f.items.length > 1"
                (changed)="touch()" (removed)="removeLine($index)" (duplicated)="duplicateLine($index)" />
            }
            <div class="flex flex-wrap items-center gap-3">
              <button type="button" class="qadd" (click)="addLine()"><ss-icon name="plus" [size]="16" />Add another line</button>
              <button type="button" class="ql-act ql-act-del" (click)="clear()">Clear quotation</button>
            </div>
            <p class="ahint">Prices are ex-godown plus GST. Weights are theoretical.</p>
            @if (missing() > 0) { <p class="alert alert-warn !text-[14px]">{{ missing() }} line{{ missing() === 1 ? '' : 's' }} without a price or GST rate {{ missing() === 1 ? 'is' : 'are' }} left out of the totals.</p> }
          </section>

          <section class="qs" id="sec-terms" aria-labelledby="terms-h">
            <div class="qs-head">
              <span class="qs-n">4</span>
              <div><h2 id="terms-h">Terms</h2><small>Optional: defaults come from Quote data</small></div>
            </div>
            <label class="fd" [class.fd-ok]="has(f.notes)"><span class="fl">Notes on the quotation</span><textarea class="ainput" maxlength="2000" name="notes" [(ngModel)]="f.notes" (ngModelChange)="touch()" rows="2" placeholder="e.g. Delivery within 2 working days of payment."></textarea></label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="fd fd-ok"><span class="fl">Payment terms</span>
                <select class="ainput" (change)="setPayment($any($event.target).value)">
                  @for (o of paymentOptions; track o) { <option [value]="o" [selected]="paymentChoice() === o">{{ o }}</option> }
                  <option value="Custom" [selected]="paymentChoice() === 'Custom'">Custom text</option>
                </select></label>
              @if (paymentChoice() === 'Custom') {
                <label class="fd" [class.fd-ok]="has(f.paymentTerms)"><span class="fl">Custom payment terms</span><input class="ainput" maxlength="200" name="pay" [(ngModel)]="f.paymentTerms" (ngModelChange)="touch()" /></label>
              }
            </div>
            <label class="fd" [class.fd-ok]="has(f.bankDetails)"><span class="fl">Bank details</span><textarea class="ainput" maxlength="600" name="bank" [(ngModel)]="f.bankDetails" (ngModelChange)="touch()" rows="3" placeholder="Account name, bank, account number, IFSC"></textarea>
              <span class="ahint">Set once in Quote data. Left empty, the bank block is not printed.</span></label>
            <label class="fd" [class.fd-ok]="has(f.terms)"><span class="fl">Terms & conditions</span><textarea class="ainput" maxlength="4000" name="terms" [(ngModel)]="f.terms" (ngModelChange)="touch()" rows="7"></textarea>
              <span class="ahint">Starts from the terms in Quote data. Edit freely for this quotation.</span></label>
          </section>
        </div>

        <aside class="grid content-start gap-5">
          <div class="qtotal" aria-live="polite">
            <small>Grand total</small>
            <b>₹ {{ inr(t().grandTotal) }}</b>
            <span>{{ words() || 'Add a price to a line to see the total' }}</span>
          </div>

          <section class="qs" aria-labelledby="extras-h">
            <div class="qs-head"><span class="qs-n">+</span><div><h2 id="extras-h">Extras &amp; GST</h2><small>Charges added to the goods</small></div></div>
            @for (c of visibleCharges(); track c[0]) {
              <label class="fd" [class.fd-ok]="num(c[0]) !== 0"><span class="fl">{{ c[1] }} (₹)</span>
                <input class="ainput text-right" type="number" min="0" step="0.01" inputmode="decimal" [name]="c[0]" [ngModel]="num(c[0])" (ngModelChange)="setNum(c[0], $event)" /></label>
            }
            @if (!allExtras()) { <button type="button" class="ql-quick" (click)="allExtras.set(true)">Show all extras</button> }
            <div class="grid grid-cols-2 gap-3">
              <label class="fd fd-ok"><span class="fl">GST on extras %</span><input class="ainput" type="number" min="0" max="28" step="0.01" inputmode="decimal" name="gstRate" [(ngModel)]="f.gstRate" (ngModelChange)="touch()" /></label>
              <label class="fd fd-ok"><span class="fl">Valid (days)</span><input class="ainput" type="number" min="1" max="90" inputmode="numeric" name="valid" [(ngModel)]="f.validDays" (ngModelChange)="touch()" /></label>
            </div>
            <label class="qcheck"><input type="checkbox" name="igst" [(ngModel)]="f.interState" (ngModelChange)="touch()" /><span>Other state: IGST instead of CGST + SGST</span></label>
            <label class="fd fd-ok"><span class="fl">Quote date</span><input class="ainput" type="date" name="qd" [(ngModel)]="f.quoteDate" (ngModelChange)="touch()" /></label>
          </section>

          <section class="qs !gap-2 text-[15px] tabular-nums" aria-label="Totals breakdown">
            <b class="mb-1 text-[16px] font-semibold">Breakdown</b>
            <div class="flex justify-between"><span class="text-[#5B6678]">Subtotal ({{ t().totalKg }} kg{{ f.quoteType === 'Wholesale' ? ' · ' + tonnes(t().totalKg) + ' t' : '' }})</span><span>{{ inr(t().subtotal) }}</span></div>
            @if (t().discount) { <div class="flex justify-between"><span class="text-[#5B6678]">Discount</span><span>−{{ inr(t().discount) }}</span></div> }
            @if (f.cuttingCharge) { <div class="flex justify-between"><span class="text-[#5B6678]">Cutting</span><span>{{ inr(f.cuttingCharge) }}</span></div> }
            @if (f.loadingCharge) { <div class="flex justify-between"><span class="text-[#5B6678]">Loading</span><span>{{ inr(f.loadingCharge) }}</span></div> }
            @if (f.unloadingCharge) { <div class="flex justify-between"><span class="text-[#5B6678]">Unloading</span><span>{{ inr(f.unloadingCharge) }}</span></div> }
            @if (f.transportCharge) { <div class="flex justify-between"><span class="text-[#5B6678]">Cartage / freight</span><span>{{ inr(f.transportCharge) }}</span></div> }
            <div class="flex justify-between font-semibold"><span>Taxable</span><span>{{ inr(t().taxable) }}</span></div>
            @for (g of t().taxGroups; track g.rate) {
              @if (f.interState) { <div class="flex justify-between"><span class="text-[#5B6678]">IGST {{ g.rate }}%</span><span>{{ inr(g.igst) }}</span></div> }
              @else {
                <div class="flex justify-between"><span class="text-[#5B6678]">CGST {{ g.rate / 2 }}%</span><span>{{ inr(g.cgst) }}</span></div>
                <div class="flex justify-between"><span class="text-[#5B6678]">SGST {{ g.rate / 2 }}%</span><span>{{ inr(g.sgst) }}</span></div>
              }
            }
            @if (t().roundOff) { <div class="flex justify-between"><span class="text-[#5B6678]">Round off</span><span>{{ inr(t().roundOff) }}</span></div> }
            <div class="mt-1 flex justify-between border-t border-[#E3E7EE] pt-3 text-[17px] font-bold"><span>Grand total</span><span>₹ {{ inr(t().grandTotal) }}</span></div>
          </section>
        </aside>
      </div>

      <!-- Phones: what is missing, the total and the actions stay in view while editing. -->
      <div class="qbottom lg:hidden">
        <div class="flex items-center justify-between gap-3">
          @if (prog().todo.length) { <button type="button" class="qchip qchip-need" (click)="jump(prog().todo[0].id)">{{ prog().todo.length }} to fill · next ›</button> }
          @else { <span class="qchip qchip-ok">✓ Ready to save</span> }
          <span class="text-right leading-tight"><b class="block whitespace-nowrap text-[22px] font-bold tabular-nums text-primary">₹ {{ inr(t().grandTotal) }}</b>
            <small class="text-[12.5px] text-[#5B6678]">{{ f.items.length }} line{{ f.items.length === 1 ? '' : 's' }} · {{ t().totalKg }} kg</small></span>
        </div>
        <div class="flex gap-2"><ng-container *ngTemplateOutlet="actions" /></div>
      </div>

      <ng-template #actions>
        @if (dirty()) { <span class="pill pill-warn hidden sm:inline-block">Unsaved</span> }
        <button type="button" class="qbtn qbtn-pri flex-1 lg:flex-none" [disabled]="busy() || !dirty()" (click)="save()">{{ busy() ? 'Saving…' : 'Save' }}</button>
        @if (saved()) {
          <button type="button" class="qbtn flex-1 lg:flex-none" [disabled]="busy() || dirty()" (click)="pdf()"><ss-icon name="file" [size]="16" />PDF</button>
          <button type="button" class="qbtn flex-1 lg:flex-none" [disabled]="busy() || dirty()" (click)="send()"><ss-icon name="wa" [size]="16" />Send</button>
        }
      </ng-template>

      <ng-template #statusSelect>
        @if (saved(); as s) {
          <select class="ainput !min-h-[42px] !w-auto" [ngModel]="s.status" (ngModelChange)="setStatus($event)" [disabled]="busy() || dirty()" aria-label="Status">
            @for (st of statuses; track st) { <option [value]="st">{{ st }}</option> }
          </select>
        }
      </ng-template>
    }
    </div>`,
})
export class QuoteEditComponent {
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);
  private readonly idParam = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly statuses = ['Draft', 'Sent', 'Accepted', 'Rejected'];
  protected readonly paymentOptions = PAYMENT_OPTIONS;
  protected readonly charges: [string, string][] = [
    ['cuttingCharge', 'Cutting'], ['loadingCharge', 'Loading'], ['unloadingCharge', 'Unloading'], ['transportCharge', 'Cartage / freight'], ['discount', 'Discount (less)'],
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
  protected readonly restored = signal<string | null>(null);
  protected readonly find = signal('');
  protected readonly matches = signal<Customer[]>([]);
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
  /** What the quotation still needs, in page order: type, customer, then every line's unfilled fields. */
  protected readonly prog = computed(() => {
    this.rev();
    const figs = this.figs();
    const lineList = figs.map((fig, i) => lineChecks(this.f.items[i], i, fig));
    const all = [
      ...headChecks(this.f),
      ...lineList.flatMap((cs, i) => cs.map((c) => ({ ...c, label: `Line ${i + 1}: ${c.label}` }))),
    ];
    const done = all.filter((c) => c.done).length;
    return {
      total: all.length, done, pct: all.length ? Math.round((done / all.length) * 100) : 0, todo: all.filter((c) => !c.done),
      linesDone: lineList.filter((cs) => cs.every((c) => c.done)).length,
    };
  });
  protected readonly custDone = computed(() => { this.rev(); const h = headChecks(this.f); return h[1].done && h[2].done; });
  protected readonly linesDone = computed(() => this.f.items.length > 0 && this.prog().linesDone === this.f.items.length);
  protected nameOk(): boolean { return headChecks(this.f)[1].done; }
  protected phoneOk(): boolean { return headChecks(this.f)[2].done; }
  protected has(v: string | null | undefined): boolean { return !!v && v.trim().length > 0; }

  /** Scrolls to a field and puts the cursor in it. */
  protected jump(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.focus({ preventScroll: true }), 450);
  }

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
          this.restoreDraft();
        } else {
          this.api.quote(Number(this.idParam)).subscribe({ next: (q) => { this.load(q); this.restoreDraft(); this.loading.set(false); }, error: (e) => { this.loading.set(false); this.fail(e); } });
        }
      },
      error: (e) => { this.loading.set(false); this.fail(e); },
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onUnload(e: BeforeUnloadEvent): void {
    if (this.dirty()) e.preventDefault();
  }

  private findTimer: ReturnType<typeof setTimeout> | undefined;

  protected findCustomer(text: string): void {
    this.find.set(text);
    clearTimeout(this.findTimer);
    if (text.trim().length < 2) { this.matches.set([]); return; }
    this.findTimer = setTimeout(() => this.api.searchCustomers(text.trim()).subscribe({ next: (r) => this.matches.set(r), error: () => this.matches.set([]) }), 250);
  }

  /** Fills the customer fields from the master; the quotation's own order reference and dispatch stay as they are. */
  protected useCustomer(c: Customer): void {
    Object.assign(this.f, { customerName: c.name, company: c.company, gstin: c.gstin, phone: c.phone, email: c.email, city: c.city, address: c.address });
    this.f.interState = isInterState(c.gstin);
    this.find.set('');
    this.matches.set([]);
    this.touch();
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

  protected touch(fresh = false): void {
    this.rev.update((v) => v + 1);
    if (fresh) return;
    this.dirty.set(true);
    saveDraft(this.draftId(), this.f);
  }

  /** A draft belongs to the quotation being edited, or to "new" until it is first saved. */
  private draftId(): string | number { return this.saved()?.quoteId ?? 'new'; }

  private restoreDraft(): void {
    const d = loadDraft<SaveQuote>(this.draftId());
    if (!d?.form?.items?.length) return;
    this.f = { ...blank(), ...d.form, items: d.form.items.map((l) => ({ ...blankLine(), ...l, dims: { ...(l.dims ?? {}) } })) };
    this.restored.set(new Date(d.savedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }));
    this.dirty.set(true);
    this.rev.update((v) => v + 1);
  }

  protected discardDraft(): void {
    if (!confirm('Throw away the changes you had not saved?')) return;
    clearDraft(this.draftId());
    this.restored.set(null);
    const q = this.saved();
    if (q) this.load(q);
    else {
      const d = this.lk()!.defaults;
      this.f = { ...blank(), validDays: d.validDays, gstRate: d.gstRaw ?? 0, terms: (d.terms ?? '').replace('{days}', String(d.validDays)) || null, paymentTerms: d.paymentTerms ?? PAYMENT_OPTIONS[0], bankDetails: d.bankDetails };
      this.dirty.set(false);
      this.touch(true);
    }
  }
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
    const draftId = this.draftId();
    const body: SaveQuote = { ...this.f, paymentTerms: this.f.paymentTerms?.trim() || null, items: this.f.items.map(toInput) };
    (id ? this.api.updateQuote(id, body) : this.api.createQuote(body)).subscribe({
      next: (q) => {
        rememberRates(q.items);
        rememberText(q.items);
        clearDraft(draftId);
        this.restored.set(null);
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
      quoteType: q.quoteType as QuoteType, customerName: q.customerName, company: q.company, gstin: q.gstin, phone: q.phone, email: q.email, city: q.city, address: q.address, buyerRef: q.buyerRef, dispatchedThrough: q.dispatchedThrough,
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
    quoteType: '', customerName: '', company: null, gstin: null, phone: '', email: null, city: null, address: null, buyerRef: null, dispatchedThrough: null, quoteDate: null, validDays: 3,
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
