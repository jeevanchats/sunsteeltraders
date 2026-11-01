import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiError } from '../../../core/models/api.model';
import { AdminApiService, Paged, QuoteRow } from '../../../core/services/admin-api.service';
import { inr } from '../../../core/quote/quote-math';
import { SeoService } from '../../../core/services/seo.service';
import { QUOTE_TYPES, quoteTypeLabel } from '../../../core/quote/quote-types';
import { IconComponent } from '../../../shared/icon.component';

const STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected'];

/** Quotations list. New ones start blank here, or from a request in the Requests inbox. */
@Component({
  selector: 'ss-quotes',
  imports: [FormsModule, RouterLink, DatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 class="text-[22px] font-medium">Quotations</h1><p class="text-[13.5px] text-[#6B7485]">Priced per kg, with GST. Start one from a request, or blank for phone and walk-in customers.</p></div>
      <div class="flex gap-2">
        <input class="ainput !w-[240px]" placeholder="Search name, phone, reference" [(ngModel)]="q" (keyup.enter)="load(1)" />
        <a routerLink="/admin/quotes/new" class="abtn abtn-pri"><ss-icon name="plus" [size]="14" />New quotation</a>
      </div>
    </header>
    <div class="mb-4 flex flex-wrap gap-2">
      <button type="button" class="abtn abtn-sm" [class.abtn-pri]="!status()" (click)="status.set(''); load(1)">All</button>
      @for (s of statuses; track s) { <button type="button" class="abtn abtn-sm" [class.abtn-pri]="status() === s" (click)="status.set(s); load(1)">{{ s }}</button> }
      <span class="mx-2 w-px bg-[#E3E6EB]"></span>
      <select class="ainput !h-[30px] !w-auto !text-[12.5px]" aria-label="Type" (change)="type.set($any($event.target).value); load(1)">
        <option value="">All types</option>@for (t of types; track t.key) { <option [value]="t.key">{{ t.label }}</option> }
      </select>
    </div>
    @if (error()) { <p class="alert mb-4">{{ error() }}</p> }
    <div class="card overflow-x-auto !p-0">
      <table class="tbl">
        <thead><tr><th>Reference</th><th>Type</th><th>Customer</th><th>Lines</th><th class="text-right">Total (₹)</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          @for (r of page()?.items ?? []; track r.quoteId) {
            <tr class="cursor-pointer hover:bg-[#F8F9FB]" [routerLink]="['/admin/quotes', r.quoteId]">
              <td><b class="font-medium">{{ r.reference }}</b>@if (r.leadReference) { <small class="block text-[#8A93A3]">for {{ r.leadReference }}</small> }</td>
              <td>{{ typeLabel(r.quoteType) }}</td>
              <td>{{ r.customerName }}<small class="block text-[#8A93A3]">{{ r.company || r.phone }}</small></td>
              <td>{{ r.itemCount }}</td>
              <td class="text-right tabular-nums">{{ inr(r.grandTotal) }}</td>
              <td><span class="pill" [class.pill-warn]="r.status === 'Draft'" [class.pill-ok]="r.status === 'Accepted'">{{ r.status }}</span></td>
              <td class="whitespace-nowrap text-[#6B7485]">{{ r.quoteDate | date: 'd MMM y' }}</td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="py-10 text-center text-[#8A93A3]">{{ loading() ? 'Loading…' : 'No quotations yet.' }}</td></tr>
          }
        </tbody>
      </table>
      @if ((page()?.totalPages ?? 0) > 1) {
        <div class="flex items-center justify-between border-t border-[#EEF0F3] px-4 py-3 text-[13px]">
          <span>Page {{ page()!.page }} of {{ page()!.totalPages }} · {{ page()!.totalCount }} quotations</span>
          <span class="flex gap-2"><button class="abtn abtn-sm" [disabled]="page()!.page <= 1" (click)="load(page()!.page - 1)">Previous</button>
            <button class="abtn abtn-sm" [disabled]="page()!.page >= page()!.totalPages" (click)="load(page()!.page + 1)">Next</button></span>
        </div>
      }
    </div>`,
})
export class QuotesComponent {
  private readonly api = inject(AdminApiService);
  protected readonly statuses = STATUSES;
  protected readonly types = QUOTE_TYPES;
  protected readonly typeLabel = quoteTypeLabel;
  protected readonly type = signal('');
  protected readonly inr = inr;
  protected readonly page = signal<Paged<QuoteRow> | null>(null);
  protected readonly status = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected q = '';

  constructor() {
    inject(SeoService).set({ title: 'Quotations | Sun Steel Traders admin', path: '/admin/quotes', noindex: true });
    this.load(1);
  }

  protected load(page: number): void {
    this.loading.set(true);
    this.api.quotes({ status: this.status(), type: this.type(), q: this.q.trim(), page }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.error.set(apiError(e)); },
    });
  }
}
