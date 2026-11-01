import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiError } from '../../../core/models/api.model';
import { inr, isInterState, lineAmount, quoteTotals } from '../../../core/quote/quote-math';
import { AdminApiService, QuoteDetail, SaveQuote } from '../../../core/services/admin-api.service';
import { IconComponent } from '../../../shared/icon.component';

const CHARGES: [keyof SaveQuote, string][] = [
  ['cuttingCharge', 'Cutting'], ['loadingCharge', 'Loading'], ['unloadingCharge', 'Unloading'], ['transportCharge', 'Transport'], ['discount', 'Discount (less)'],
];

/**
 * One quotation: customer, lines priced per kg, whole-quote charges and GST, with live totals.
 * The server recomputes totals on save. To send: download the PDF, then WhatsApp opens a chat
 * with the customer to attach it, and the quote (and its request) are marked as sent / quoted.
 */
@Component({
  selector: 'ss-quote-edit',
  imports: [FormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/admin/quotes" class="mb-3 inline-block text-[13px] text-[#6B7485] hover:underline">← All quotations</a>
    @if (loading()) {
      <div class="card text-[#6B7485]">Loading…</div>
    } @else {
      <header class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-[22px] font-medium">{{ saved()?.reference ?? 'New quotation' }}</h1>
          <p class="mt-0.5 text-[13.5px] text-[#6B7485]">
            @if (saved(); as s) { {{ s.status }} · valid until {{ s.validUntil }}@if (s.leadReference) { · for request <a routerLink="/admin/leads" class="underline">{{ s.leadReference }}</a> } }
            @else { Fill in the customer and lines, then save. }
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          @if (dirty()) { <span class="pill pill-warn">Unsaved changes</span> }
          <button type="button" class="abtn abtn-pri" [disabled]="busy() || !dirty()" (click)="save()">{{ busy() ? 'Saving…' : 'Save' }}</button>
          @if (saved(); as s) {
            <button type="button" class="abtn" [disabled]="busy() || dirty()" (click)="pdf()"><ss-icon name="file" [size]="14" />PDF</button>
            <button type="button" class="abtn" [disabled]="busy() || dirty()" (click)="send()"><ss-icon name="wa" [size]="14" />Send on WhatsApp</button>
            <select class="ainput !h-[34px] !w-auto" [ngModel]="s.status" (ngModelChange)="setStatus($event)" [disabled]="busy() || dirty()" aria-label="Status">
              @for (st of statuses; track st) { <option [value]="st">{{ st }}</option> }
            </select>
          }
        </div>
      </header>

      @if (message(); as m) { <p class="alert mb-4" [class.alert-ok]="m.ok" role="status">{{ m.text }}</p> }
      @if (dirty() && saved()) { <p class="ahint mb-3">Save first; the PDF and WhatsApp use the saved version.</p> }

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div class="grid content-start gap-5">
          <fieldset class="card grid gap-4">
            <legend class="sr-only">Customer</legend>
            <b class="font-medium">Customer</b>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="alabel">Name<input class="ainput" maxlength="150" name="cn" [(ngModel)]="f.customerName" (ngModelChange)="touch()" /></label>
              <label class="alabel">Company<input class="ainput" maxlength="150" name="co" [(ngModel)]="f.company" (ngModelChange)="touch()" /></label>
              <label class="alabel">Phone<input class="ainput" maxlength="30" name="ph" [(ngModel)]="f.phone" (ngModelChange)="touch()" placeholder="10-digit mobile" /></label>
              <label class="alabel">Email<input class="ainput" maxlength="256" name="em" [(ngModel)]="f.email" (ngModelChange)="touch()" /></label>
              <label class="alabel">GSTIN<input class="ainput uppercase" maxlength="15" name="gst" [(ngModel)]="f.gstin" (ngModelChange)="gstinChanged()" placeholder="Optional" /></label>
              <label class="alabel">City<input class="ainput" maxlength="80" name="city" [(ngModel)]="f.city" (ngModelChange)="touch()" /></label>
            </div>
            <label class="alabel">Address<textarea class="ainput" maxlength="400" name="addr" [(ngModel)]="f.address" (ngModelChange)="touch()" rows="2"></textarea></label>
          </fieldset>

          <fieldset class="card grid gap-3 overflow-x-auto">
            <legend class="sr-only">Lines</legend>
            <b class="font-medium">Lines <span class="font-normal text-[#6B7485]">· priced per kg</span></b>
            <div class="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_64px_90px_90px_100px_34px] gap-2 text-[12px] text-[#6B7485] md:grid">
              <span>Description</span><span>Size</span><span>Qty</span><span>Kg</span><span>Rate / kg</span><span class="text-right">Amount</span><span></span>
            </div>
            @for (l of f.items; track $index; let i = $index) {
              <div class="grid grid-cols-2 items-center gap-2 border-b border-[#EEF0F3] pb-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_64px_90px_90px_100px_34px] md:border-0 md:pb-0">
                <input class="ainput col-span-2 md:col-span-1" maxlength="200" placeholder="e.g. EN24 round bar" [name]="'d' + i" [(ngModel)]="l.description" (ngModelChange)="touch()" />
                <input class="ainput col-span-2 md:col-span-1" maxlength="120" placeholder="e.g. Ø80 × 500 mm, cut" [name]="'s' + i" [(ngModel)]="l.size" (ngModelChange)="touch()" />
                <input class="ainput" type="number" min="1" aria-label="Quantity" [name]="'q' + i" [(ngModel)]="l.quantity" (ngModelChange)="touch()" />
                <input class="ainput" type="number" min="0" step="0.01" aria-label="Kg" [name]="'k' + i" [(ngModel)]="l.kg" (ngModelChange)="touch()" />
                <input class="ainput" [class.!border-[#C2410C]]="!l.ratePerKg" type="number" min="0" step="0.01" aria-label="Rate per kg" [name]="'r' + i" [(ngModel)]="l.ratePerKg" (ngModelChange)="touch()" />
                <span class="text-right tabular-nums">{{ amount(l.kg, l.ratePerKg) }}</span>
                <button type="button" class="abtn abtn-sm abtn-danger justify-self-end" [disabled]="f.items.length === 1" (click)="removeLine(i)" aria-label="Remove line"><ss-icon name="trash" [size]="13" /></button>
              </div>
            }
            <div><button type="button" class="abtn abtn-sm" (click)="addLine()"><ss-icon name="plus" [size]="13" />Add line</button>
              <span class="ahint ml-2">Weights for steel shapes: use the <a href="/metal-weight-calculator/" target="_blank" class="underline">weight calculator</a>.</span></div>
          </fieldset>

          <fieldset class="card grid gap-4">
            <legend class="sr-only">Notes and terms</legend>
            <label class="alabel">Notes on the quotation<textarea class="ainput" maxlength="2000" name="notes" [(ngModel)]="f.notes" (ngModelChange)="touch()" rows="2" placeholder="e.g. Delivery within 2 working days of payment."></textarea></label>
            <label class="alabel">Terms & conditions<textarea class="ainput" maxlength="4000" name="terms" [(ngModel)]="f.terms" (ngModelChange)="touch()" rows="6"></textarea>
              <span class="ahint">New quotations start with the terms from Site settings.</span></label>
          </fieldset>
        </div>

        <aside class="grid content-start gap-5">
          <fieldset class="card grid gap-3">
            <legend class="sr-only">Charges</legend>
            <b class="font-medium">Charges, discount & GST</b>
            @for (c of charges; track c[0]) {
              <label class="alabel grid-cols-[1fr_120px] items-center !grid">{{ c[1] }} (₹)
                <input class="ainput text-right" type="number" min="0" step="0.01" [name]="c[0]" [ngModel]="num(c[0])" (ngModelChange)="setNum(c[0], $event)" /></label>
            }
            <div class="grid grid-cols-2 gap-3">
              <label class="alabel">GST %<input class="ainput" type="number" min="0" max="28" step="0.01" name="gstRate" [(ngModel)]="f.gstRate" (ngModelChange)="touch()" /></label>
              <label class="alabel">Valid (days)<input class="ainput" type="number" min="1" max="90" name="valid" [(ngModel)]="f.validDays" (ngModelChange)="touch()" /></label>
            </div>
            <label class="flex items-center gap-2 text-[13.5px]"><input type="checkbox" name="igst" [(ngModel)]="f.interState" (ngModelChange)="touch()" />Outside Tamil Nadu (IGST)</label>
            <label class="alabel">Quote date<input class="ainput" type="date" name="qd" [(ngModel)]="f.quoteDate" (ngModelChange)="touch()" /></label>
          </fieldset>

          <div class="card grid gap-1.5 text-[13.5px] tabular-nums">
            <b class="mb-1 font-medium">Totals</b>
            <div class="flex justify-between"><span class="text-[#6B7485]">Material ({{ t().totalKg }} kg)</span><span>{{ inr(t().materialTotal) }}</span></div>
            @if (t().charges) { <div class="flex justify-between"><span class="text-[#6B7485]">Charges</span><span>{{ inr(t().charges) }}</span></div> }
            @if (t().discount) { <div class="flex justify-between"><span class="text-[#6B7485]">Discount</span><span>−{{ inr(t().discount) }}</span></div> }
            <div class="flex justify-between font-medium"><span>Taxable</span><span>{{ inr(t().taxable) }}</span></div>
            @if (f.interState) { <div class="flex justify-between"><span class="text-[#6B7485]">IGST {{ f.gstRate }}%</span><span>{{ inr(t().igst) }}</span></div> }
            @else {
              <div class="flex justify-between"><span class="text-[#6B7485]">CGST {{ f.gstRate / 2 }}%</span><span>{{ inr(t().cgst) }}</span></div>
              <div class="flex justify-between"><span class="text-[#6B7485]">SGST {{ f.gstRate / 2 }}%</span><span>{{ inr(t().sgst) }}</span></div>
            }
            @if (t().roundOff) { <div class="flex justify-between"><span class="text-[#6B7485]">Round off</span><span>{{ inr(t().roundOff) }}</span></div> }
            <div class="mt-1 flex justify-between border-t border-[#EEF0F3] pt-2 text-[16px] font-medium"><span>Grand total</span><span>₹ {{ inr(t().grandTotal) }}</span></div>
          </div>
        </aside>
      </div>
    }`,
})
export class QuoteEditComponent {
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);
  private readonly idParam = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly statuses = ['Draft', 'Sent', 'Accepted', 'Rejected'];
  protected readonly charges = CHARGES;
  protected readonly inr = inr;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly dirty = signal(false);
  protected readonly saved = signal<QuoteDetail | null>(null);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);
  private readonly rev = signal(0);
  protected f: SaveQuote = blank();

  /** Live preview; the server's totals win on save. */
  protected readonly t = computed(() => { this.rev(); return quoteTotals(this.f.items, this.f); });

  constructor() {
    if (this.idParam === 'new') {
      this.api.quoteDefaults().subscribe({
        next: (d) => { this.f = { ...blank(), validDays: d.validDays, gstRate: d.gstRate, terms: d.terms }; this.loading.set(false); this.touch(true); },
        error: (e) => { this.loading.set(false); this.fail(e); },
      });
    } else {
      this.api.quote(Number(this.idParam)).subscribe({ next: (q) => { this.load(q); this.loading.set(false); }, error: (e) => { this.loading.set(false); this.fail(e); } });
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onUnload(e: BeforeUnloadEvent): void {
    if (this.dirty()) e.preventDefault();
  }

  protected touch(fresh = false): void { this.rev.update((v) => v + 1); if (!fresh) this.dirty.set(true); }
  protected amount(kg: number, rate: number): string { return inr(lineAmount(kg, rate)); }
  protected num(k: keyof SaveQuote): number { return this.f[k] as number; }
  protected setNum(k: keyof SaveQuote, v: number): void { (this.f as unknown as Record<string, number>)[k] = Number(v) || 0; this.touch(); }
  protected gstinChanged(): void { this.f.interState = isInterState(this.f.gstin); this.touch(); }
  protected addLine(): void { this.f.items = [...this.f.items, { description: '', size: '', quantity: 1, kg: 0, ratePerKg: 0 }]; this.touch(); }
  protected removeLine(i: number): void { this.f.items = this.f.items.filter((_, j) => j !== i); this.touch(); }

  protected save(): void {
    this.busy.set(true);
    this.message.set(null);
    const id = this.saved()?.quoteId;
    (id ? this.api.updateQuote(id, this.f) : this.api.createQuote(this.f)).subscribe({
      next: (q) => {
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
    this.busy.set(true);
    this.api.quotePdf(q.quoteId).subscribe({
      next: (blob) => { this.busy.set(false); download(blob, `${q.reference}.pdf`); },
      error: (e) => { this.busy.set(false); this.fail(e); },
    });
  }

  /** WhatsApp can't attach files from a link: download the PDF, open the chat, staff attach it. */
  protected send(): void {
    const q = this.saved()!;
    if (q.items.some((i) => !i.ratePerKg)) { this.message.set({ ok: false, text: 'Every line needs a rate per kg before sending.' }); return; }
    window.open(q.whatsAppUrl, '_blank', 'noopener'); // opened inside the click so it isn't blocked
    this.pdf();
    if (q.status === 'Draft') this.setStatus('Sent');
    this.message.set({ ok: true, text: 'PDF downloaded. Attach it in the WhatsApp chat that just opened, then press Send.' });
  }

  protected setStatus(status: string): void {
    const q = this.saved()!;
    this.api.setQuoteStatus(q.quoteId, status).subscribe({ next: (d) => this.load(d), error: (e) => { this.fail(e); this.load(q); } });
  }

  private load(q: QuoteDetail): void {
    this.saved.set(q);
    this.f = {
      customerName: q.customerName, company: q.company, gstin: q.gstin, phone: q.phone, email: q.email, city: q.city, address: q.address,
      quoteDate: q.quoteDate, validDays: q.validDays, cuttingCharge: q.cuttingCharge, loadingCharge: q.loadingCharge,
      unloadingCharge: q.unloadingCharge, transportCharge: q.transportCharge, discount: q.discount, gstRate: q.gstRate,
      interState: q.interState, notes: q.notes, terms: q.terms, items: q.items.map((i) => ({ ...i })),
    };
    this.dirty.set(false);
    this.touch(true);
  }

  private fail(e: unknown): void { this.message.set({ ok: false, text: apiError(e) }); }
}

function blank(): SaveQuote {
  return {
    customerName: '', company: null, gstin: null, phone: '', email: null, city: null, address: null, quoteDate: null, validDays: 7,
    cuttingCharge: 0, loadingCharge: 0, unloadingCharge: 0, transportCharge: 0, discount: 0, gstRate: 18, interState: false,
    notes: null, terms: null, items: [{ description: '', size: '', quantity: 1, kg: 0, ratePerKg: 0 }],
  };
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
