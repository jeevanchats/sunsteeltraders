import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { City, Faq, ProductCard, metalClass } from '../../core/models/catalog.model';
import { CatalogService } from '../../core/services/catalog.service';
import { SeoService } from '../../core/services/seo.service';
import { SiteService } from '../../core/services/site.service';
import { breadcrumbLd, compact, faqLd, organizationLd } from '../../core/services/structured-data';
import { FaqListComponent } from '../../shared/faq-list.component';
import { MetalComponent } from '../../shared/metal.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { NotFoundComponent } from './not-found.component';

/** /steel-suppliers-{city}/ — regional landing page (spec §5.2, meta formula §5.3). */
@Component({
  selector: 'ss-city',
  imports: [RouterLink, PageHeaderComponent, MetalComponent, NotFoundComponent, FaqListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (c(); as c) {
      <ss-page-header [label]="'Steel suppliers · ' + c.name" [title]="'Steel &amp; metals for <em>' + c.name + '.</em>'" [lede]="c.intro"
        [crumbs]="[['/', 'Home'], ['', 'Steel suppliers in ' + c.name]]">
        <div class="mt-10 grid gap-6 sm:grid-cols-3">
          <div class="card-rule"><span class="label">Dispatch</span><b class="mt-1 block font-serif text-[28px] font-medium">{{ c.leadTime }}</b></div>
          <div class="card-rule"><span class="label">From our godowns</span><b class="mt-1 block font-serif text-[28px] font-medium">{{ c.distanceKm ? c.distanceKm + ' km' : 'In the city' }}</b></div>
          <div class="card-rule"><span class="label">Industrial zones</span><b class="mt-1 block text-[14.5px] font-medium leading-snug">{{ c.zones }}</b></div>
        </div>
      </ss-page-header>

      <section class="wrap grid gap-12 pb-[var(--sec)] lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <div>
          <span class="label label-accent mb-4">Who we supply in {{ c.name }}</span>
          <ul class="border-t border-ink">@for (i of c.industries; track i) { <li class="border-b border-line py-3.5 font-serif text-[20px]">{{ i }}</li> }</ul>
          <div class="mt-8 flex flex-wrap gap-3">
            <a routerLink="/contact-us/" class="btn">Request a quote</a>
            <a [href]="site.whatsapp('Hello Sun Steel Traders, I need material delivered to ' + c.name + '.')" target="_blank" rel="noopener" class="btn btn-ghost">WhatsApp</a>
          </div>
        </div>
        <div>
          <span class="label label-accent mb-4">Most requested from {{ c.name }}</span>
          <div class="grid grid-cols-2 gap-5">
            @for (p of c.popular; track p.slug) {
              <a [routerLink]="p.path" class="group min-w-0">
                <ss-metal [kind]="metal(p)" [src]="p.heroUrl" [alt]="p.name" [caption]="p.grade" class="aspect-[4/3]" />
                <b class="mt-3 block font-serif text-[18px] font-medium leading-snug">{{ p.name }}</b>
              </a>
            }
          </div>
        </div>
      </section>

      <section class="wrap grid gap-12 pb-[var(--sec)] lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <div><span class="label label-accent mb-4">Questions</span><h2 class="h-l">Delivery to <em>{{ c.name }}.</em></h2></div>
        <ss-faq-list [faqs]="faqs()" />
      </section>

      @if (catalog.index().silos.length) {
        <section class="wrap pb-[var(--sec)]">
          <span class="label label-accent mb-4">Everything we stock for {{ c.name }}</span>
          <ul class="grid border-t border-ink sm:grid-cols-2 sm:gap-x-10">
            @for (s of catalog.index().silos; track s.key) {
              <li class="border-b border-line"><a [routerLink]="'/products/' + s.key + '/'" class="flex items-baseline justify-between gap-4 py-3.5 font-serif text-[20px] hover:text-accent">{{ s.name }}<span class="label">{{ s.productCount }} grades</span></a></li>
            }
          </ul>
        </section>
      }
    } @else {
      <ss-not-found />
    }`,
})
export class CityComponent {
  protected readonly site = inject(SiteService);
  protected readonly catalog = inject(CatalogService);
  private readonly seo = inject(SeoService);
  protected readonly c = toSignal(inject(ActivatedRoute).data.pipe(map((d) => d['city'] as City | null)), { initialValue: null });

  /** Questions a buyer in the city would ask, answered only from this city's own record and the catalogue. */
  protected readonly faqs = computed<Faq[]>(() => {
    const c = this.c();
    if (!c) return [];
    const total = this.catalog.index().silos.reduce((n, s) => n + s.productCount, 0);
    const lead = (c.leadTime ?? '').trim();
    const zones = c.zones ? `, including ${c.zones}` : '';
    const out: Faq[] = [
      {
        question: `Do you deliver steel and metals to ${c.name}?`,
        answer: c.distanceKm > 0
          ? `Yes. We dispatch from our three Madurai godowns to ${c.name}${zones}. It is about ${c.distanceKm} km from our godowns.${lead ? ` Dispatch time: ${lead}.` : ''}`
          : `Yes. Our three godowns are in Madurai: collect from our shop or have cut pieces delivered the same day.${lead ? ` Dispatch time: ${lead}.` : ''}`,
      },
    ];
    if (lead) out.push({ question: `How long does delivery to ${c.name} take?`, answer: `Dispatch time to ${c.name} is ${lead.toLowerCase()}. For large tonnage or long lengths, give the quantity when you ask for a quote and we will confirm the date.` });
    out.push({
      question: `Which materials can I order for ${c.name}?`,
      answer: `All seven families: mild and structural steel, alloy and engineering steels, stainless steel, non-ferrous metals (brass, copper, aluminium, gunmetal and bronze), cast iron, engineering plastics, and cutting and workshop tools${total ? `, ${total} grades in all` : ''}.`,
    });
    if (c.industries.length) out.push({ question: `Which industries do you supply in ${c.name}?`, answer: `${c.industries.join(', ')}. Send your list and we will quote.` });
    out.push({ question: 'Can the material be cut to size before it ships?', answer: 'Yes. Bars, plates and sections are band-saw cut to ±1 mm in our godowns, and a mill test certificate is supplied on request. Send piece sizes and quantities with your request.' });
    return out;
  });

  constructor() {
    this.catalog.loadIndex().subscribe();
    effect(() => {
      const c = this.c();
      if (!c) return;
      const path = `/steel-suppliers-${c.slug}/`;
      this.seo.set({
        title: c.metaTitle, description: c.metaDescription, path,
        jsonLd: compact([{ ...organizationLd((k) => this.site.get(k)), areaServed: c.name }, breadcrumbLd([['/', 'Home'], [path, `Steel suppliers in ${c.name}`]]), faqLd(this.faqs())]),
      });
    });
  }

  protected metal(p: ProductCard): string { return metalClass(p.materialKey, p.siloKey); }
}
