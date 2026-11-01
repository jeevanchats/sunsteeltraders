import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../../../core/models/api.model';
import { isInterState } from '../../../core/quote/quote-math';
import { AdminApiService, Customer, CustomerImportResult, Paged, SaveCustomer } from '../../../core/services/admin-api.service';
import { SeoService } from '../../../core/services/seo.service';
import { IconComponent } from '../../../shared/icon.component';

const blank = (): SaveCustomer => ({ name: '', company: null, gstin: null, phone: '', email: null, city: null, address: null, notes: null });

/**
 * The customer master. Quotations add and update customers by themselves (matched on phone number); here staff can
 * correct them, add others, export the list to a CSV file for Excel and import one back (rows matched on phone number).
 */
@Component({
  selector: 'ss-customers',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 class="text-[22px] font-medium">Customers</h1>
        <p class="text-[13.5px] text-[#6B7485]">Filled in automatically when you save a quotation. Edit them here, or import and export the list as a CSV file.</p></div>
      <div class="flex w-full flex-wrap gap-2 sm:w-auto">
        <input class="ainput w-full sm:!w-[220px]" placeholder="Search name, phone, GSTIN" [(ngModel)]="q" (keyup.enter)="load(1)" aria-label="Search customers" />
        <button type="button" class="abtn" (click)="edit(null)"><ss-icon name="plus" [size]="14" />Add</button>
        <button type="button" class="abtn" [disabled]="busy()" (click)="export()"><ss-icon name="file" [size]="14" />Export</button>
        <label class="abtn cursor-pointer"><ss-icon name="upload" [size]="14" />Import
          <input type="file" accept=".csv,text/csv" class="sr-only" (change)="import($event)" /></label>
      </div>
    </header>

    @if (message(); as m) { <p class="alert mb-4" [class.alert-ok]="m.ok" role="status">{{ m.text }}</p> }
    @if (result(); as r) {
      <div class="alert alert-ok mb-4" role="status">
        <b class="font-medium">Import finished:</b> {{ r.created }} added, {{ r.updated }} updated, {{ r.skipped }} skipped.
        @if (r.errors.length) { <ul class="mt-1 list-disc pl-5 text-[13px]">@for (e of r.errors; track e) { <li>{{ e }}</li> }</ul> }
      </div>
    }

    @if (form(); as c) {
      <form class="card mb-5 grid gap-4" (ngSubmit)="save()" #cf="ngForm">
        <b class="font-medium">{{ editing() ? 'Edit customer' : 'New customer' }}</b>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label class="alabel">Name *<input class="ainput" maxlength="150" name="name" [(ngModel)]="c.name" required /></label>
          <label class="alabel">Company<input class="ainput" maxlength="150" name="company" [(ngModel)]="c.company" /></label>
          <label class="alabel">WhatsApp number *<input class="ainput" maxlength="30" name="phone" inputmode="tel" [(ngModel)]="c.phone" required /></label>
          <label class="alabel">GSTIN<input class="ainput uppercase" maxlength="15" name="gstin" [(ngModel)]="c.gstin" />
            @if (c.gstin && c.gstin.length >= 2) { <small class="text-[#8A93A3]">{{ interState(c.gstin) ? 'Outside Tamil Nadu: IGST' : 'Tamil Nadu: CGST + SGST' }}</small> }</label>
          <label class="alabel">Email<input class="ainput" maxlength="256" name="email" [(ngModel)]="c.email" /></label>
          <label class="alabel">City<input class="ainput" maxlength="80" name="city" [(ngModel)]="c.city" /></label>
        </div>
        <label class="alabel">Address<textarea class="ainput" rows="2" maxlength="400" name="address" [(ngModel)]="c.address"></textarea></label>
        <label class="alabel">Notes<textarea class="ainput" rows="2" maxlength="1000" name="notes" [(ngModel)]="c.notes" placeholder="Only visible here, never printed on a quotation"></textarea></label>
        <div class="flex gap-2">
          <button type="submit" class="abtn abtn-pri" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save' }}</button>
          <button type="button" class="abtn" (click)="form.set(null)">Cancel</button>
        </div>
      </form>
    }

    <div class="card overflow-x-auto !p-0">
      <table class="tbl">
        <thead><tr><th>Customer</th><th>Phone</th><th>GSTIN</th><th>City</th><th>Quotes</th><th></th></tr></thead>
        <tbody>
          @for (c of page()?.items ?? []; track c.id) {
            <tr>
              <td>{{ c.name }}@if (c.company) { <small class="block text-[#8A93A3]">{{ c.company }}</small> }</td>
              <td class="whitespace-nowrap">{{ c.phone }}</td>
              <td class="whitespace-nowrap">{{ c.gstin || '' }}</td>
              <td>{{ c.city || '' }}</td>
              <td>{{ c.quotes }}</td>
              <td class="whitespace-nowrap text-right">
                <button type="button" class="abtn abtn-sm" (click)="edit(c)" [attr.aria-label]="'Edit ' + c.name"><ss-icon name="edit" [size]="13" />Edit</button>
                <button type="button" class="abtn abtn-sm abtn-danger" [disabled]="c.quotes > 0" [title]="c.quotes > 0 ? 'Has quotations' : 'Delete'" (click)="remove(c)" [attr.aria-label]="'Delete ' + c.name"><ss-icon name="trash" [size]="13" /></button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="py-10 text-center text-[#8A93A3]">{{ loading() ? 'Loading…' : 'No customers yet. They appear here when you save a quotation, or import a CSV file.' }}</td></tr>
          }
        </tbody>
      </table>
      @if ((page()?.totalPages ?? 0) > 1) {
        <div class="flex items-center justify-between border-t border-[#EEF0F3] px-4 py-3 text-[13px]">
          <span>Page {{ page()!.page }} of {{ page()!.totalPages }} · {{ page()!.totalCount }} customers</span>
          <span class="flex gap-2"><button class="abtn abtn-sm" [disabled]="page()!.page <= 1" (click)="load(page()!.page - 1)">Previous</button>
            <button class="abtn abtn-sm" [disabled]="page()!.page >= page()!.totalPages" (click)="load(page()!.page + 1)">Next</button></span>
        </div>
      }
    </div>
    <p class="ahint mt-3">CSV columns: Name, Company, GSTIN, Phone, Email, City, Address, Notes. Phone is required, and a row whose phone number is already here updates that customer (blank cells keep what is stored). Save an Excel sheet as "CSV UTF-8" first.</p>`,
})
export class CustomersComponent {
  private readonly api = inject(AdminApiService);
  protected readonly page = signal<Paged<Customer> | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly form = signal<SaveCustomer | null>(null);
  protected readonly editing = signal<Customer | null>(null);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly result = signal<CustomerImportResult | null>(null);
  protected readonly interState = isInterState;
  protected q = '';

  constructor() {
    inject(SeoService).set({ title: 'Customers | Sun Steel Traders admin', path: '/admin/customers', noindex: true });
    this.load(1);
  }

  protected load(page: number): void {
    this.loading.set(true);
    this.api.customers({ q: this.q.trim(), page }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.fail(e); },
    });
  }

  protected edit(c: Customer | null): void {
    this.editing.set(c);
    this.form.set(c ? { name: c.name, company: c.company, gstin: c.gstin, phone: c.phone, email: c.email, city: c.city, address: c.address, notes: c.notes } : blank());
    this.message.set(null);
  }

  protected save(): void {
    const body = this.form();
    if (!body) return;
    this.busy.set(true);
    this.api.saveCustomer(this.editing()?.id ?? null, body).subscribe({
      next: () => { this.busy.set(false); this.form.set(null); this.message.set({ ok: true, text: 'Customer saved.' }); this.load(this.page()?.page ?? 1); },
      error: (e) => { this.busy.set(false); this.fail(e); },
    });
  }

  protected remove(c: Customer): void {
    if (!confirm(`Delete ${c.name}?`)) return;
    this.api.deleteCustomer(c.id).subscribe({ next: () => this.load(this.page()?.page ?? 1), error: (e) => this.fail(e) });
  }

  protected export(): void {
    this.busy.set(true);
    this.api.exportCustomers().subscribe({
      next: (blob) => {
        this.busy.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
      error: (e) => { this.busy.set(false); this.fail(e); },
    });
  }

  protected import(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    this.message.set(null);
    this.result.set(null);
    this.api.importCustomers(file).subscribe({
      next: (r) => { this.busy.set(false); this.result.set(r); this.load(1); },
      error: (e) => { this.busy.set(false); this.fail(e); },
    });
  }

  private fail(e: unknown): void { this.message.set({ ok: false, text: apiError(e) }); }
}
