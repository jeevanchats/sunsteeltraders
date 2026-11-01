import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiError } from '../../core/models/api.model';
import { LeadCreated, RequestService } from '../../core/services/request.service';
import { SeoService } from '../../core/services/seo.service';
import { SiteService } from '../../core/services/site.service';
import { breadcrumbLd, organizationLd } from '../../core/services/structured-data';
import { formatKg } from '../../core/weight/weight';
import { IconComponent } from '../../shared/icon.component';

type Mode = 'list' | 'drawing' | 'call';
type Reply = 'WhatsApp' | 'Phone' | 'Email';

/**
 * /contact-us/ — the concierge (v3 sheet 05). Three ways to begin, the request carried over
 * from the site, a short form. The lead is saved first; WhatsApp opens only afterwards, with
 * the message the server built (so nothing is lost if WhatsApp is never sent).
 */
@Component({
  selector: 'ss-contact',
  imports: [FormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wrap grid gap-[clamp(40px,6vw,96px)] pb-[var(--sec)] pt-[clamp(120px,14vw,168px)] lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <div>
        <span class="label label-accent mb-4">Contact</span>
        <h1 class="h-xxl">Tell us what you're <em>making.</em></h1>
        <p class="lede mt-6">Send a cut list, a drawing or simply a question. Our sales desk replies on WhatsApp or by phone within working hours, usually with a price the same day.</p>

        <div class="mt-10">
          <span class="label mb-4">How would you like to begin?</span>
          <div class="grid gap-4 sm:grid-cols-3" role="radiogroup" aria-label="How would you like to begin?">
            @for (m of modes; track m.id) {
              <button type="button" role="radio" [attr.aria-checked]="mode() === m.id" (click)="mode.set(m.id)"
                class="card-rule text-left transition-colors" [class]="mode() === m.id ? '!border-accent' : 'opacity-75 hover:opacity-100'">
                <ss-icon [name]="m.icon" [size]="20" class="text-accent" />
                <b class="mt-2 block font-serif text-[20px] font-medium">{{ m.t }}</b>
                <span class="text-[13px] text-muted">{{ m.d }}</span>
              </button>
            }
          </div>
        </div>

        <div class="mt-12 grid gap-6 border-t border-line pt-8 sm:grid-cols-2">
          <div><span class="label mb-2">Call</span>
            <a [href]="site.tel('Phone1')" (click)="req.click('call', '/contact-us/')" class="block font-serif text-[22px]">{{ site.get('Phone1') }}</a>
            <a [href]="site.tel('Phone2')" (click)="req.click('call', '/contact-us/')" class="block font-serif text-[22px]">{{ site.get('Phone2') }}</a>
            <span class="block font-serif text-[22px]">{{ site.get('Landline') }}</span></div>
          <div><span class="label mb-2">Visit</span>
            <p class="text-[14.5px]">{{ site.get('Address') }}</p>
            <p class="mt-1 text-[14.5px] text-muted">{{ site.get('OpeningHours') }}</p>
            <a [href]="site.get('MapUrl')" target="_blank" rel="noopener" (click)="req.click('map', '/contact-us/')" class="lnk mt-3">Open in Maps</a></div>
          <div class="sm:col-span-2"><span class="label mb-2">Email</span>
            <a [href]="'mailto:' + site.get('SalesEmail')" class="break-all text-[15px]">{{ site.get('SalesEmail') }}</a></div>
        </div>
      </div>

      <div class="self-start bg-paper p-[clamp(20px,3vw,40px)]">
        @if (done(); as d) {
          <div class="py-6 text-center" role="status">
            <ss-icon name="check" [size]="34" class="text-sage" />
            <h2 class="h-l mt-4">Received. <em>Thank you.</em></h2>
            <p class="mt-3 text-muted">Your reference is <b class="text-ink">{{ d.reference }}</b>@if (d.totalKg) { · about {{ kg(d.totalKg) }} kg }.</p>
            <p class="mt-1 text-muted">Our sales desk will reply within working hours.</p>
            <div class="mt-7 flex flex-wrap justify-center gap-3">
              <a [href]="d.whatsAppUrl" target="_blank" rel="noopener" class="btn"><ss-icon name="wa" [size]="16" />Open WhatsApp with your list</a>
              <a routerLink="/products/" class="btn btn-ghost">Back to the library</a>
            </div>
          </div>
        } @else {
          <form (ngSubmit)="submit()" novalidate class="grid gap-7">
            <div>
              <div class="flex items-baseline justify-between"><span class="label">Your request · {{ req.count() }} {{ req.count() === 1 ? 'item' : 'items' }}</span>
                @if (req.count()) { <span class="text-[14.5px] font-medium tabular-nums text-ink">≈ {{ kg(req.totalKg()) }} kg</span> }</div>
              <ul class="mt-3 border-t border-ink">
                @for (l of req.lines(); track l.id) {
                  <li class="flex items-center gap-3 border-b border-line py-3.5 text-[15.5px]">
                    <span class="min-w-0 flex-1"><b class="font-medium">{{ l.gradeText }}</b><small class="mt-0.5 block text-[13.5px] text-muted"><span class="capitalize">{{ l.form }}</span> {{ l.dimText }} × {{ l.lengthMm }} mm · {{ l.quantity }} pcs</small></span>
                    <span class="tabular-nums">{{ kg(l.kg) }} kg</span>
                    <button type="button" class="p-1 text-muted hover:text-ink" (click)="req.remove(l.id)" [attr.aria-label]="'Remove ' + l.gradeText"><ss-icon name="trash" [size]="15" /></button>
                  </li>
                }
                <li class="py-3.5 text-[15px]"><a routerLink="/products/" class="font-medium text-accent underline underline-offset-4">+ Add an item from the library</a><span class="mx-1.5 text-muted">or</span><a routerLink="/metal-weight-calculator/" class="font-medium text-accent underline underline-offset-4">weigh one on the scale</a></li>
              </ul>
            </div>

            <label class="fld"><span>{{ mode() === 'list' ? 'Or type your list / question' : 'Anything we should know?' }}</span>
              <textarea name="message" [(ngModel)]="f.message" rows="3" placeholder="e.g. EN8 Ø50 × 300 mm, 20 pcs; SS 304 sheet 2 mm, 4 sheets"></textarea></label>

            @if (mode() === 'drawing') {
              <label class="flex cursor-pointer items-center gap-4 border border-dashed border-muted p-5 text-[15px] hover:border-accent">
                <ss-icon name="upload" [size]="22" class="text-accent" />
                <span class="min-w-0 flex-1">@if (files().length) { {{ fileNames() }} } @else { Drop or choose a drawing or cut list: PDF, DWG, DXF, Excel or photos, up to 5 files }</span>
                <input type="file" class="sr-only" multiple accept=".pdf,.dwg,.dxf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp,.heic" (change)="pick($event)" />
              </label>
            }
            @if (mode() === 'call') {
              <label class="fld"><span>Best time to call</span><input type="datetime-local" name="cb" [(ngModel)]="f.callbackAt" /></label>
            }

            <div class="grid gap-6 sm:grid-cols-2">
              <label class="fld"><span>Name *</span><input name="name" [(ngModel)]="f.name" autocomplete="name" required /></label>
              <label class="fld"><span>Mobile *</span><input name="phone" [(ngModel)]="f.phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+91" required /></label>
              <label class="fld"><span>Company</span><input name="company" [(ngModel)]="f.company" autocomplete="organization" /></label>
              <label class="fld"><span>City</span><input name="city" [(ngModel)]="f.city" autocomplete="address-level2" /></label>
              <label class="fld"><span>GSTIN (optional)</span><input name="gstin" [(ngModel)]="f.gstin" maxlength="15" class="uppercase" /></label>
              <label class="fld"><span>Email (optional)</span><input name="email" [(ngModel)]="f.email" type="email" autocomplete="email" /></label>
            </div>
            <input type="text" name="website" [(ngModel)]="f.website" class="hidden" tabindex="-1" autocomplete="off" aria-hidden="true" />

            <div>
              <span class="label mb-3">Reply by</span>
              <div class="flex flex-wrap gap-2">
                @for (r of replies; track r) { <button type="button" class="chip" [class.chip-on]="reply() === r" (click)="reply.set(r)">{{ r === 'Phone' ? 'Call' : r }}</button> }
              </div>
            </div>

            @if (error()) { <p class="text-[14px] text-[#A33A2B]" role="alert">{{ error() }}</p> }
            <div class="flex flex-wrap items-center gap-4">
              <button type="submit" class="btn" [disabled]="busy()">
                @if (reply() === 'WhatsApp') { <ss-icon name="wa" [size]="16" />Send on WhatsApp } @else { Send request }
              </button>
              <span class="text-[13.5px] text-muted">Saved with our sales desk first, then {{ reply() === 'WhatsApp' ? 'WhatsApp opens with your list' : 'we reply' }}.</span>
            </div>
          </form>
        }
      </div>
    </section>`,
})
export class ContactComponent {
  protected readonly site = inject(SiteService);
  protected readonly req = inject(RequestService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly modes: { id: Mode; t: string; d: string; icon: string }[] = [
    { id: 'list', t: 'Send a list', d: 'Line by line', icon: 'list' },
    { id: 'drawing', t: 'Upload a drawing', d: 'PDF, DWG, photo', icon: 'upload' },
    { id: 'call', t: 'Request a call', d: 'Pick a time', icon: 'phone' },
  ];
  protected readonly replies: Reply[] = ['WhatsApp', 'Phone', 'Email'];

  protected readonly mode = signal<Mode>('list');
  protected readonly reply = signal<Reply>('WhatsApp');
  protected readonly files = signal<File[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal<LeadCreated | null>(null);
  protected f = { name: '', phone: '', company: '', city: '', gstin: '', email: '', message: '', callbackAt: '', website: '' };

  constructor() {
    inject(SeoService).set({
      title: 'Contact & Request a Quote | Sun Steel Traders, Madurai',
      description: 'Send your cut list or drawing for a same-day quote. Call, WhatsApp or visit our godowns in Simmakkal, Madurai.',
      path: '/contact-us/',
      jsonLd: [organizationLd((k) => this.site.get(k)), breadcrumbLd([['/', 'Home'], ['/contact-us/', 'Contact']])],
    });
  }

  protected kg(n: number): string { return formatKg(n); }
  protected fileNames(): string { return this.files().map((f) => f.name).join(', '); }

  protected pick(e: Event): void {
    const list = Array.from((e.target as HTMLInputElement).files ?? []).slice(0, 5);
    this.files.set(list);
  }

  protected submit(): void {
    this.error.set('');
    if (this.f.name.trim().length < 2) return this.error.set('Please enter your name.');
    if (this.f.phone.replace(/\D/g, '').length < 10) return this.error.set('Please enter a 10-digit mobile number.');
    if (!this.req.count() && !this.f.message.trim() && !this.files().length && this.mode() !== 'call')
      return this.error.set('Add an item, type your list, or attach a drawing.');

    this.busy.set(true);
    const type = this.mode() === 'call' && !this.req.count() ? 'Callback' : 'RFQ';
    this.req.submit({
      type,
      name: this.f.name, phone: this.f.phone, company: this.f.company || undefined, city: this.f.city || undefined,
      gstin: this.f.gstin || undefined, email: this.f.email || undefined,
      message: this.f.message || (type === 'RFQ' && !this.req.count() ? 'Drawing attached.' : undefined),
      callbackAt: this.f.callbackAt ? new Date(this.f.callbackAt).toISOString() : undefined,
      channel: this.reply() === 'WhatsApp' ? 'WhatsApp' : this.reply() === 'Phone' ? 'Phone' : 'Email',
      sourcePage: '/contact-us/', website: this.f.website, items: this.req.toPayloadItems(),
    }).subscribe({
      next: (res) => {
        const finish = () => {
          this.busy.set(false);
          this.done.set(res);
          this.req.clear();
          if (this.reply() === 'WhatsApp' && this.isBrowser) {
            this.req.click('wa', '/contact-us/');
            window.open(res.whatsAppUrl, '_blank', 'noopener');
          }
        };
        if (this.files().length) this.req.uploadFiles(res.reference, this.f.phone, this.files()).subscribe({ next: finish, error: finish });
        else finish();
      },
      error: (err) => { this.busy.set(false); this.error.set(apiError(err)); },
    });
  }
}
