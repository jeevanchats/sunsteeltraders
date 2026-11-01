import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { apiError } from '../../../core/models/api.model';
import { AdminApiService, LeadDetail, LeadRow, Paged } from '../../../core/services/admin-api.service';
import { IconComponent } from '../../../shared/icon.component';

const STATUSES = ['New', 'Contacted', 'Quoted', 'Won', 'Lost'];
const TYPES = ['RFQ', 'Catalogue', 'Contact', 'Callback'];

/** Requests inbox: every RFQ, catalogue download and call-back, with line items, files and notes. */
@Component({
  selector: 'ss-leads',
  imports: [FormsModule, DatePipe, DecimalPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 class="text-[22px] font-medium">Requests</h1><p class="text-[13.5px] text-[#6B7485]">Saved before WhatsApp opens, so nothing is lost if a customer never presses Send.</p></div>
      <input class="ainput !w-[260px]" placeholder="Search name, phone, reference" [(ngModel)]="q" (keyup.enter)="load(1)" />
    </header>
    <div class="mb-4 flex flex-wrap gap-2">
      <button type="button" class="abtn abtn-sm" [class.abtn-pri]="!status()" (click)="status.set(''); load(1)">All</button>
      @for (s of statuses; track s) { <button type="button" class="abtn abtn-sm" [class.abtn-pri]="status() === s" (click)="status.set(s); load(1)">{{ s }}</button> }
      <span class="mx-2 w-px bg-[#E3E6EB]"></span>
      <select class="ainput !h-[30px] !w-auto !text-[12.5px]" [ngModel]="type()" (ngModelChange)="type.set($event); load(1)">
        <option value="">All types</option>@for (t of types; track t) { <option [value]="t">{{ t }}</option> }
      </select>
    </div>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div class="card overflow-x-auto !p-0">
        <table class="tbl">
          <thead><tr><th>Reference</th><th>Customer</th><th>Items</th><th class="text-right">kg</th><th>Status</th><th>Received</th></tr></thead>
          <tbody>
            @for (l of page()?.items ?? []; track l.leadId) {
              <tr class="cursor-pointer hover:bg-[#F8F9FB]" [class]="sel()?.leadId === l.leadId ? 'bg-[#FBF7F1]' : ''" (click)="open(l)">
                <td><b class="font-medium">{{ l.reference }}</b><small class="block text-[#8A93A3]">{{ l.type }} · {{ l.channel }}</small></td>
                <td>{{ l.name }}<small class="block text-[#8A93A3]">{{ l.company || l.city || l.phone }}</small></td>
                <td>{{ l.itemCount }}@if (l.fileCount) { · <ss-icon name="file" [size]="13" /> {{ l.fileCount }} }</td>
                <td class="text-right tabular-nums">{{ l.totalKg ? (l.totalKg | number: '1.0-1') : '—' }}</td>
                <td><span class="pill" [class.pill-warn]="l.status === 'New'" [class.pill-ok]="l.status === 'Won'">{{ l.status }}</span></td>
                <td class="whitespace-nowrap text-[#6B7485]">{{ l.createdAt | date: 'd MMM, HH:mm' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="py-10 text-center text-[#8A93A3]">{{ loading() ? 'Loading…' : 'No requests yet.' }}</td></tr>
            }
          </tbody>
        </table>
        @if ((page()?.totalPages ?? 0) > 1) {
          <div class="flex items-center justify-between border-t border-[#EEF0F3] px-4 py-3 text-[13px]">
            <span>Page {{ page()!.page }} of {{ page()!.totalPages }} · {{ page()!.totalCount }} requests</span>
            <span class="flex gap-2"><button class="abtn abtn-sm" [disabled]="page()!.page <= 1" (click)="load(page()!.page - 1)">Previous</button>
              <button class="abtn abtn-sm" [disabled]="page()!.page >= page()!.totalPages" (click)="load(page()!.page + 1)">Next</button></span>
          </div>
        }
      </div>

      @if (sel(); as d) {
        <aside class="card self-start">
          <div class="flex items-start justify-between gap-3">
            <div><b class="text-[17px] font-medium">{{ d.reference }}</b><p class="text-[13px] text-[#6B7485]">{{ d.createdAt | date: 'EEE d MMM y, HH:mm' }} · {{ d.sourcePage }}</p></div>
            <button type="button" class="abtn abtn-sm" (click)="sel.set(null)" aria-label="Close"><ss-icon name="x" [size]="14" /></button>
          </div>
          <dl class="mt-4 grid grid-cols-[110px_1fr] gap-y-1.5 text-[13.5px]">
            <dt class="text-[#6B7485]">Name</dt><dd>{{ d.name }}</dd>
            @if (d.company) { <dt class="text-[#6B7485]">Company</dt><dd>{{ d.company }}</dd> }
            <dt class="text-[#6B7485]">Phone</dt><dd><a class="text-accent" [href]="'tel:' + digits(d.phone)">{{ d.phone }}</a> · <a class="text-accent" target="_blank" rel="noopener" [href]="'https://wa.me/' + digits(d.phone)">WhatsApp</a></dd>
            @if (d.email) { <dt class="text-[#6B7485]">Email</dt><dd>{{ d.email }}</dd> }
            @if (d.gstin) { <dt class="text-[#6B7485]">GSTIN</dt><dd>{{ d.gstin }}</dd> }
            @if (d.city) { <dt class="text-[#6B7485]">City</dt><dd>{{ d.city }}</dd> }
            @if (d.industry) { <dt class="text-[#6B7485]">Industry</dt><dd>{{ d.industry }}</dd> }
            @if (d.callbackAt) { <dt class="text-[#6B7485]">Call back</dt><dd>{{ d.callbackAt | date: 'EEE d MMM, HH:mm' }}</dd> }
          </dl>
          @if (d.items.length) {
            <table class="tbl mt-4">
              <thead><tr><th>Item</th><th>Qty</th><th class="text-right">kg</th></tr></thead>
              <tbody>
                @for (i of d.items; track $index) {
                  <tr><td>{{ i.gradeText }}<small class="block text-[#8A93A3]">{{ i.form }} {{ i.dimsText }}@if (i.lengthMm) { × {{ i.lengthMm }} mm }@if (i.cutToSize) { · cut }</small></td>
                    <td>{{ i.quantity }}</td><td class="text-right tabular-nums">{{ i.kg ? (i.kg | number: '1.0-1') : '—' }}</td></tr>
                }
                <tr><td colspan="2" class="font-medium">Total</td><td class="text-right font-medium tabular-nums">{{ d.totalKg ? (d.totalKg | number: '1.0-1') : '—' }}</td></tr>
              </tbody>
            </table>
          }
          @if (d.message) { <p class="mt-4 whitespace-pre-line rounded-md bg-[#F8F9FB] p-3 text-[13.5px]">{{ d.message }}</p> }
          @if (d.files.length) {
            <div class="mt-4 grid gap-1.5">
              @for (f of d.files; track f.leadFileId) { <button type="button" class="abtn abtn-sm justify-start" (click)="download(f.leadFileId, f.fileName)"><ss-icon name="file" [size]="14" />{{ f.fileName }} · {{ f.sizeBytes / 1024 | number: '1.0-0' }} KB</button> }
            </div>
          }
          @if (d.type === 'RFQ' || d.items.length) {
            <button type="button" class="abtn abtn-pri mt-5 w-full justify-center" [disabled]="quoting()" (click)="quote(d.leadId)">
              <ss-icon name="doc" [size]="14" />{{ quoting() ? 'Creating…' : 'Create quotation' }}</button>
          }
          <label class="alabel mt-5">Status
            <select class="ainput" [ngModel]="d.status" (ngModelChange)="setStatus(d.leadId, $event)">@for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }</select>
          </label>
          <label class="alabel mt-4">Add a note
            <textarea class="ainput" [(ngModel)]="note" placeholder="e.g. Quoted ₹ per kg + GST, delivery Monday."></textarea>
          </label>
          <button type="button" class="abtn abtn-pri mt-2" [disabled]="!note.trim()" (click)="addNote(d.leadId)">Save note</button>
          @if (error()) { <p class="alert mt-3">{{ error() }}</p> }
          <ul class="mt-4 grid gap-2">
            @for (n of d.notes; track n.leadNoteId) { <li class="rounded-md border border-[#EEF0F3] p-2.5 text-[13px]">{{ n.note }}<small class="mt-1 block text-[#8A93A3]">{{ n.by || 'Staff' }} · {{ n.createdAt | date: 'd MMM, HH:mm' }}</small></li> }
          </ul>
        </aside>
      }
    </div>`,
})
export class LeadsComponent {
  private readonly api = inject(AdminApiService);
  protected readonly statuses = STATUSES;
  protected readonly types = TYPES;
  protected readonly page = signal<Paged<LeadRow> | null>(null);
  protected readonly sel = signal<LeadDetail | null>(null);
  protected readonly status = signal('');
  protected readonly type = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly quoting = signal(false);
  private readonly router = inject(Router);
  protected q = '';
  protected note = '';

  /** Draft quotation with this request's customer and lines; staff add today's rates. */
  protected quote(leadId: number): void {
    this.quoting.set(true);
    this.api.quoteFromLead(leadId).subscribe({
      next: (q) => this.router.navigate(['/admin/quotes', q.quoteId]),
      error: (e) => { this.quoting.set(false); this.error.set(apiError(e)); },
    });
  }

  constructor() { this.load(1); }

  protected digits(phone: string): string { return phone.replace(/\D/g, ''); }

  protected load(page: number): void {
    this.loading.set(true);
    this.api.leads({ status: this.status(), type: this.type(), q: this.q.trim(), page }).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.error.set(apiError(e)); },
    });
  }

  protected open(l: LeadRow): void {
    this.error.set('');
    this.api.lead(l.leadId).subscribe({ next: (d) => this.sel.set(d), error: (e) => this.error.set(apiError(e)) });
  }

  protected setStatus(id: number, status: string): void {
    this.api.setLeadStatus(id, status).subscribe({
      next: (d) => { this.sel.set(d); this.patchRow(d); },
      error: (e) => this.error.set(apiError(e)),
    });
  }

  protected addNote(id: number): void {
    this.api.addLeadNote(id, this.note.trim()).subscribe({
      next: (d) => { this.sel.set(d); this.note = ''; },
      error: (e) => this.error.set(apiError(e)),
    });
  }

  protected download(fileId: number, name: string): void {
    this.api.leadFile(fileId).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
  }

  private patchRow(d: LeadDetail): void {
    const p = this.page();
    if (p) this.page.set({ ...p, items: p.items.map((r) => (r.leadId === d.leadId ? { ...r, status: d.status } : r)) });
  }
}
