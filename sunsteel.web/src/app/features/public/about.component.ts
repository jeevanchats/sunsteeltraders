import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { SeoService } from '../../core/services/seo.service';
import { SiteService } from '../../core/services/site.service';
import { breadcrumbLd, organizationLd } from '../../core/services/structured-data';
import { MetalComponent } from '../../shared/metal.component';
import { RevealDirective } from '../../shared/reveal.directive';

/** /about-us/ — the atelier (v3 sheet 07): the story told through the three godowns. */
@Component({
  selector: 'ss-about',
  imports: [RouterLink, MetalComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wrap grid items-end gap-[clamp(32px,6vw,96px)] pb-[clamp(56px,7vw,96px)] pt-[clamp(120px,14vw,168px)] lg:grid-cols-2">
      <div>
        <span class="label label-accent mb-4">About us</span>
        <h1 class="h-xxl">Three godowns in <em>Madurai.</em></h1>
        <p class="lede mt-6">Sun Steel Traders is a multi-metal stockist on Tamil Sangam Road in Madurai's old trading quarter. We keep the grades South India's machine shops, fabricators and maintenance teams use every day, and we cut them to size before they leave.</p>
      </div>
      <ss-metal kind="metal-steel" class="aspect-[4/3]" caption="Photograph to come: godown interior, crane and bar racks" />
    </section>

    <section class="wrap grid gap-8 pb-[var(--sec)] md:grid-cols-3" ssReveal>
      @for (g of godowns; track g.n) {
        <div class="card-rule"><span class="chapter">{{ g.n }}</span><b class="mt-3 block font-serif text-[24px] font-medium">{{ g.t }}</b><p class="mt-2 text-[14.5px] text-muted">{{ g.d }}</p></div>
      }
    </section>

    <section class="on-dark bg-primary py-[var(--sec)] text-on-primary" ssReveal>
      <div class="wrap grid gap-12 lg:grid-cols-2">
        <h2 class="h-xl">What we <em>promise.</em></h2>
        <dl class="grid gap-6">
          @for (p of promises; track p.t) { <div class="card-rule"><dt class="font-serif text-[22px] font-medium">{{ p.t }}</dt><dd class="mt-1 text-on-primary-muted">{{ p.d }}</dd></div> }
        </dl>
      </div>
    </section>

    <section class="wrap grid gap-10 py-[var(--sec)] lg:grid-cols-2" ssReveal>
      <div>
        <span class="label label-accent mb-4">We deliver to</span>
        <p class="font-serif text-[clamp(24px,2.6vw,34px)] font-medium leading-snug">
          @for (c of catalog.index().cities; track c.slug; let last = $last) { <a [routerLink]="c.path" class="hover:text-accent">{{ c.name }}</a>@if (!last) { · } }
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-3 lg:justify-end">
        <a routerLink="/contact-us/" class="btn">Plan a visit</a>
        <a [href]="site.get('MapUrl')" target="_blank" rel="noopener" class="btn btn-ghost">Directions</a>
      </div>
    </section>`,
})
export class AboutComponent {
  protected readonly site = inject(SiteService);
  protected readonly catalog = inject(CatalogService);
  protected readonly godowns = [
    { n: 'I', t: 'Aarapalayam', d: 'Godown with built-in cutting and material-handling facilities, apart from our shop in Simmakkal.' },
    { n: 'II', t: 'New Jail Road', d: 'Godown with built-in cutting and material-handling facilities.' },
    { n: 'III', t: 'Vilangudi', d: 'Godown with built-in cutting and material-handling facilities.' },
  ];
  protected readonly promises = [
    { t: 'The grade on the tag', d: 'Mill material with test certificates on request, traceable to the heat number.' },
    { t: 'Cut the way you drew it', d: 'Pieces cut to your lengths and counted before they leave.' },
    { t: 'A price the same day', d: 'Per kg with GST, cutting and delivery shown, valid while metal prices hold.' },
    { t: 'Loaded, not dropped', d: 'Overhead crane loading for plates, beams and heavy rounds.' },
  ];

  constructor() {
    this.catalog.loadIndex().subscribe();
    inject(SeoService).set({
      title: 'About Us | Sun Steel Traders, Madurai',
      description: "Three godowns in Madurai (Aarapalayam, New Jail Road, Vilangudi), with band-saw cutting and overhead crane loading. Steel and metals for South India's workshops.",
      path: '/about-us/',
      jsonLd: [organizationLd((k) => this.site.get(k)), breadcrumbLd([['/', 'Home'], ['/about-us/', 'About us']])],
    });
  }
}
