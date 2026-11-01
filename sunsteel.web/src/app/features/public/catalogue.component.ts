import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../../core/models/api.model';
import { RequestService } from '../../core/services/request.service';
import { SeoService } from '../../core/services/seo.service';
import { SiteService } from '../../core/services/site.service';
import { breadcrumbLd } from '../../core/services/structured-data';
import { IconComponent } from '../../shared/icon.component';

const INDUSTRIES = ['Machine shop / CNC', 'Fabrication & structural', 'Pumps & valves', 'Textile & spinning', 'Printing & converting', 'Food & pharma', 'Wind & power', 'General maintenance', 'Trader / reseller', 'Other'];

/**
 * /catalogue-download/ — the download gate (spec §4.4). A short form records a Catalogue lead,
 * then the PDF link appears. The PDF URL is a site setting (CatalogueUrl) so sales can replace it.
 */
@Component({
  selector: 'ss-catalogue',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="grid pt-[84px] lg:min-h-[min(92svh,820px)] lg:grid-cols-2">
      <div class="relative grid min-h-[360px] place-items-center overflow-hidden bg-primary p-[clamp(24px,5vw,64px)]">
        <img src="/hero/cutting-1280.webp" alt="" class="absolute inset-0 h-full w-full scale-110 object-cover blur-[6px]" fetchpriority="high" />
        <div class="absolute inset-0 bg-primary/72"></div>
        <img src="/about/catalogue-cover.webp" width="827" height="1169" alt="Cover of the Sun Steel Traders product catalogue and weight chart" class="relative w-[min(300px,62%)] rounded-[2px] shadow-[0_28px_60px_-12px_rgba(0,0,0,.65)] lg:-rotate-2" />
      </div>
      <div class="flex flex-col justify-center px-[var(--pad)] py-[clamp(40px,5vw,80px)] lg:pl-[clamp(32px,5vw,80px)]">
        <span class="label label-accent mb-4">Catalogue</span>
        <h1 class="h-xl">The printed <em>library.</em></h1>
        <p class="lede mt-5">Every grade with equivalents, chemistry and size ranges, plus kg/m weight tables for rounds, flats, plates, pipes and sections. A PDF to keep at the machine.</p>

        @if (ready()) {
          <div class="mt-9 grid gap-4" role="status">
            <p class="font-serif text-[22px]">Thank you, {{ f.name.split(' ')[0] }}.</p>
            @if (site.get('CatalogueUrl')) {
              <a [href]="site.get('CatalogueUrl')" target="_blank" rel="noopener" class="btn justify-self-start"><ss-icon name="file" [size]="16" />Download the catalogue (PDF)</a>
            } @else {
              <p class="text-muted">We'll send the PDF to you on WhatsApp shortly.</p>
            }
          </div>
        } @else {
          <form class="mt-9 grid gap-6 sm:grid-cols-2" (ngSubmit)="submit()" novalidate>
            <label class="fld"><span>Name *</span><input name="name" [(ngModel)]="f.name" autocomplete="name" /></label>
            <label class="fld"><span>Mobile *</span><input name="phone" [(ngModel)]="f.phone" type="tel" inputmode="tel" autocomplete="tel" /></label>
            <label class="fld"><span>Company</span><input name="company" [(ngModel)]="f.company" autocomplete="organization" /></label>
            <label class="fld"><span>City</span><input name="city" [(ngModel)]="f.city" autocomplete="address-level2" /></label>
            <label class="fld sm:col-span-2"><span>Industry</span>
              <select name="industry" [(ngModel)]="f.industry"><option value="">Choose…</option>@for (i of industries; track i) { <option>{{ i }}</option> }</select></label>
            <input type="text" name="website" [(ngModel)]="f.website" class="hidden" tabindex="-1" autocomplete="off" aria-hidden="true" />
            @if (error()) { <p class="text-[14px] text-[#A33A2B] sm:col-span-2" role="alert">{{ error() }}</p> }
            <div class="sm:col-span-2"><button type="submit" class="btn" [disabled]="busy()">Get the catalogue</button></div>
          </form>
        }
      </div>
    </section>`,
})
export class CatalogueComponent {
  protected readonly site = inject(SiteService);
  private readonly req = inject(RequestService);
  protected readonly industries = INDUSTRIES;
  protected readonly busy = signal(false);
  protected readonly ready = signal(false);
  protected readonly error = signal('');
  protected f = { name: '', phone: '', company: '', city: '', industry: '', website: '' };

  constructor() {
    inject(SeoService).set({
      title: 'Download Steel Catalogue & Weight Chart (PDF) | Sun Steel Traders',
      description: 'Download the Sun Steel Traders product catalogue and metal weight chart: 93 grades with equivalents, chemistry, size ranges and kg/m tables.',
      path: '/catalogue-download/',
      jsonLd: [breadcrumbLd([['/', 'Home'], ['/catalogue-download/', 'Catalogue']])],
    });
  }

  protected submit(): void {
    this.error.set('');
    if (this.f.name.trim().length < 2) return this.error.set('Please enter your name.');
    if (this.f.phone.replace(/\D/g, '').length < 10) return this.error.set('Please enter a 10-digit mobile number.');
    this.busy.set(true);
    this.req.submit({ type: 'Catalogue', name: this.f.name, phone: this.f.phone, company: this.f.company || undefined, city: this.f.city || undefined,
      industry: this.f.industry || undefined, sourcePage: '/catalogue-download/', website: this.f.website })
      .subscribe({ next: () => { this.busy.set(false); this.ready.set(true); }, error: (e) => { this.busy.set(false); this.error.set(apiError(e)); } });
  }
}
