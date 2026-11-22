import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { SILO_METAL, Silo, metalClass, stockClass } from '../../core/models/catalog.model';
import { SeoService } from '../../core/services/seo.service';
import { shareImage } from '../../core/services/share-image';
import { breadcrumbLd, compact, faqLd } from '../../core/services/structured-data';
import { FORM_NAMES, Form } from '../../core/weight/weight';
import { FaqListComponent } from '../../shared/faq-list.component';
import { IconComponent } from '../../shared/icon.component';
import { MetalComponent } from '../../shared/metal.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { NotFoundComponent } from './not-found.component';

/** /products/{silo}/ — the family page: intro, shape filter, image cards, FAQs (spec §2, meta §5.3). */
@Component({
  selector: 'ss-silo',
  imports: [RouterLink, PageHeaderComponent, MetalComponent, FaqListComponent, IconComponent, NotFoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data(); as d) {
      <ss-page-header label="The material library" [title]="titleHtml(d)" [lede]="d.silo.intro"
        [crumbs]="[['/', 'Home'], ['/products/', 'Products'], ['', d.silo.name]]">
        <div class="mt-8 flex flex-wrap gap-2">
          <button type="button" class="chip" [class.chip-on]="!shape()" (click)="shape.set(null)">All {{ d.products.length }}</button>
          @for (f of shapes(); track f) {
            <button type="button" class="chip" [class.chip-on]="shape() === f" (click)="shape.set(f)">{{ formName(f) }}</button>
          }
        </div>
      </ss-page-header>

      <section class="wrap pb-[var(--sec)]">
        <div class="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          @for (p of visible(); track p.slug) {
            <a [routerLink]="p.path" class="group min-w-0">
              <ss-metal [kind]="metal(p.materialKey, p.siloKey)" [src]="p.heroUrl" [alt]="p.name" [caption]="p.grade" class="aspect-[4/3] transition-transform duration-700 ease-lux group-hover:scale-[1.015]" />
              <div class="mt-3 flex items-start justify-between gap-3">
                <b class="font-serif text-[19px] font-medium leading-snug">{{ p.name }}</b>
              </div>
              <span class="mt-1 block truncate text-[12px] text-muted">{{ p.equivalents.slice(0, 2).join(' · ') || p.sizeRange }}</span>
              <span class="mt-2 inline-flex" [class]="stock(p.stockStatus)">{{ p.stockStatus }}</span>
            </a>
          }
        </div>

        <div class="mt-[var(--sec)] grid gap-10 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
          <div>
            <span class="label label-accent mb-4">Questions</span>
            <h2 class="h-l">About our <em>{{ d.silo.shortName.toLowerCase() }}.</em></h2>
            <a routerLink="/contact-us/" class="lnk mt-6">Contact us <ss-icon name="arrow" [size]="14" /></a>
          </div>
          <ss-faq-list [faqs]="d.faqs" />
        </div>
      </section>
    } @else {
      <ss-not-found />
    }`,
})
export class SiloComponent {
  private readonly seo = inject(SeoService);
  protected readonly data = toSignal(inject(ActivatedRoute).data.pipe(map((d) => d['silo'] as Silo | null)), { initialValue: null });
  protected readonly shape = signal<Form | null>(null);
  protected readonly shapes = computed<Form[]>(() => {
    const set = new Set<Form>();
    for (const p of this.data()?.products ?? []) for (const f of p.forms) set.add(f);
    return [...set];
  });
  protected readonly visible = computed(() => {
    const s = this.shape();
    const ps = this.data()?.products ?? [];
    return s ? ps.filter((p) => p.forms.includes(s)) : ps;
  });

  constructor() {
    effect(() => {
      const d = this.data();
      if (!d) return;
      const path = `/products/${d.silo.key}/`;
      this.shape.set(null);
      this.seo.set({
        title: d.metaTitle, description: d.metaDescription, path, image: shareImage(d.silo.key),
        jsonLd: compact([breadcrumbLd([['/', 'Home'], ['/products/', 'Products'], [path, d.silo.name]]), faqLd(d.faqs)]),
      });
    });
  }

  protected titleHtml(d: Silo): string {
    const [first, ...rest] = d.silo.name.split(' ');
    return rest.length ? `${first} <em>${rest.join(' ')}</em>` : first;
  }

  protected formName(f: Form): string { return FORM_NAMES[f] ?? f; }
  protected metal(k: string | null | undefined, silo: string): string { return k ? metalClass(k, silo) : SILO_METAL[silo] ?? 'metal-steel'; }
  protected stock(s: Parameters<typeof stockClass>[0]): string { return stockClass(s); }
}
