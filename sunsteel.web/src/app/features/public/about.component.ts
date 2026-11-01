import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { SeoService } from '../../core/services/seo.service';
import { SiteService } from '../../core/services/site.service';
import { breadcrumbLd, organizationLd } from '../../core/services/structured-data';
import { MetalComponent } from '../../shared/metal.component';
import { RevealDirective } from '../../shared/reveal.directive';

/** /about-us/ — who we are, written from the owner's BNI presentation: speciality, range, brands, godowns, industries, service. */
@Component({
  selector: 'ss-about',
  imports: [RouterLink, MetalComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wrap grid items-end gap-[clamp(32px,6vw,96px)] pb-[clamp(56px,7vw,96px)] pt-[clamp(120px,14vw,168px)] lg:grid-cols-2">
      <div>
        <span class="label label-accent mb-4">About us</span>
        <h1 class="h-xxl">Certified steel stockists in the <em>Temple City.</em></h1>
        <p class="lede mt-6">Sun Steel Traders supplies the factories, workshops and builders of southern Tamil Nadu with the right material, in the right size, when it is needed. We are certified dealers and stockists in Madurai, and we serve every kind of manufacturing industry.</p>
      </div>
      <img src="/about/godown.webp" width="1200" height="675" alt="Inside a Sun Steel Traders godown: overhead cranes, racks of bars and a band saw cutting material" class="aspect-[4/3] w-full rounded-sm object-cover" fetchpriority="high" />
    </section>

    <section class="wrap grid grid-cols-2 gap-6 pb-[var(--sec)] md:grid-cols-4" ssReveal>
      @for (f of facts; track f.l) {
        <div class="card-rule"><b class="block font-serif text-[clamp(34px,4vw,48px)] font-light leading-none text-accent">{{ f.v }}</b><span class="mt-2 block text-[14px] text-muted">{{ f.l }}</span></div>
      }
    </section>

    <section class="wrap grid gap-12 pb-[var(--sec)] lg:grid-cols-[1fr_1.2fr]" ssReveal>
      <div>
        <span class="label label-accent mb-4">Our speciality</span>
        <h2 class="h-xl">Why customers <em>stay with us.</em></h2>
        <p class="lede mt-5">Most of our customers started with one urgent order. They stayed because we held the grade, cut it right and delivered it without fuss.</p>
      </div>
      <dl class="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        @for (s of specialities; track s.t) { <div class="card-rule"><dt class="font-serif text-[21px] font-medium">{{ s.t }}</dt><dd class="mt-1 text-[14.5px] text-muted">{{ s.d }}</dd></div> }
      </dl>
    </section>

    <section class="on-dark bg-primary py-[var(--sec)] text-on-primary" ssReveal>
      <div class="wrap grid items-center gap-12 lg:grid-cols-2">
        <img src="/about/yard.webp" width="1120" height="505" alt="A truck being loaded in the godown bay" class="w-full rounded-sm object-cover" loading="lazy" />
        <div>
          <span class="label mb-4">Cut to size</span>
          <h2 class="h-xl">Rods, pipes, plates and bars, <em>cut to your length.</em></h2>
          <p class="mt-5 text-on-primary-muted">Our godowns have built-in cutting and material-handling facilities, run by a dedicated handling team. Tell us the size; we cut it, count it and load it before it leaves.</p>
        </div>
      </div>
    </section>

    <section class="wrap py-[var(--sec)]" ssReveal>
      <span class="label label-accent mb-4">Three godowns, one shop</span>
      <h2 class="h-xl max-w-[22ch]">Stock where you <em>need it.</em></h2>
      <div class="mt-10 grid gap-8 md:grid-cols-3">
        @for (g of godowns; track g.n) {
          <div class="card-rule"><span class="chapter">{{ g.n }}</span><b class="mt-3 block font-serif text-[24px] font-medium">{{ g.t }}</b><p class="mt-2 text-[14.5px] text-muted">{{ g.d }}</p></div>
        }
      </div>
      <p class="mt-8 text-muted">Our shop and sales desk are on Tamil Sangam Road, Simmakkal. Big godowns with a wide range mean we can supply specific sizes and rare compositions, even in small quantities.</p>
    </section>

    <section class="wrap pb-[var(--sec)]" ssReveal>
      <span class="label label-accent mb-4">Brands we stock</span>
      <h2 class="h-xl max-w-[24ch]">Mill material from the <em>names you trust.</em></h2>
      <div class="mt-8 grid gap-6 rounded-sm border border-line bg-white p-[clamp(16px,3vw,40px)]">
        <img src="/about/brands-steel.webp" width="1955" height="134" alt="Steel brands we stock: SAIL, Vizag Steel (RINL), Tata Steel, JSW Steel, APL Apollo, Noble Steels, AM/NS India, MTC Group and Jindal Steel and Power" class="mx-auto h-auto w-full" loading="lazy" />
        <img src="/about/brands-metals.webp" width="847" height="100" alt="Aluminium and stainless brands we stock: Jindal Aluminium, Balco, Hindalco and Jindal Stainless" class="mx-auto h-auto w-full max-w-[560px]" loading="lazy" />
      </div>
      <p class="mt-4 max-w-[70ch] text-[13px] text-faint">Brand names and logos belong to their owners and are shown only to say which mills' material we stock. Availability varies by grade and size; ask for the brand you need.</p>
    </section>

    <section class="wrap grid gap-12 pb-[var(--sec)] lg:grid-cols-2" ssReveal>
      <div>
        <span class="label label-accent mb-4">What we stock</span>
        <h2 class="h-xl">A wide range, <em>including the rare.</em></h2>
        <p class="lede mt-5">Bars in EN-8, EN-19, EN-24, EN-31, EN-36, EN-353, EN-41B, HCHCR, OHNS and stainless steel, in round, flat, square and hex. M.S. angle, channel, R.S. joist and sheets. M.S. round and square pipes. Brass, gun metal, copper, aluminium and cast iron. Teflon, cast nylon and Hylam.</p>
        <a routerLink="/products/" class="btn mt-6">Browse the material library</a>
      </div>
      <div>
        <span class="label label-accent mb-4">Industries we serve</span>
        <div class="mt-3 flex flex-wrap gap-2">
          @for (i of industries; track i) { <span class="chip">{{ i }}</span> }
        </div>
      </div>
    </section>

    <section class="on-dark bg-primary py-[var(--sec)] text-on-primary" ssReveal>
      <div class="wrap grid gap-12 lg:grid-cols-2">
        <div>
          <h2 class="h-xl">What we <em>promise.</em></h2>
          <p class="mt-5 max-w-[44ch] text-on-primary-muted">We never say "No" to a customer because of stock availability. If it can be sourced, we find it, and a dedicated marketing team answers quickly.</p>
        </div>
        <dl class="grid gap-6">
          @for (p of promises; track p.t) { <div class="card-rule"><dt class="font-serif text-[22px] font-medium">{{ p.t }}</dt><dd class="mt-1 text-on-primary-muted">{{ p.d }}</dd></div> }
        </dl>
      </div>
    </section>

    <section class="wrap grid items-center gap-10 py-[var(--sec)] lg:grid-cols-2" ssReveal>
      <div>
        <span class="label label-accent mb-4">Your contact</span>
        <h2 class="h-xl">Mr. Selva Kumar, <em>Proprietor.</em></h2>
        <p class="mt-4 text-muted">Call or WhatsApp {{ site.get('Phone1') }} with your list. Visit us {{ site.get('OpeningHours') }}.</p>
        <div class="mt-6 flex flex-wrap gap-3">
          <a routerLink="/contact-us/" class="btn">Plan a visit</a>
          <a [href]="site.get('MapUrl')" target="_blank" rel="noopener" class="btn btn-ghost">Directions</a>
        </div>
      </div>
      <div>
        <span class="label label-accent mb-4">We deliver to</span>
        <p class="font-serif text-[clamp(24px,2.6vw,34px)] font-medium leading-snug">
          @for (c of catalog.index().cities; track c.slug; let last = $last) { <a [routerLink]="c.path" class="hover:text-accent">{{ c.name }}</a>@if (!last) { · } }
        </p>
      </div>
    </section>`,
})
export class AboutComponent {
  protected readonly site = inject(SiteService);
  protected readonly catalog = inject(CatalogService);
  protected readonly facts = [
    { v: '25+', l: 'years of hands-on experience' },
    { v: '93', l: 'products in stock, seven families' },
    { v: '3', l: 'godowns in Madurai' },
    { v: 'ISO 9001', l: ':2015 certified quality management' },
  ];
  protected readonly specialities = [
    { t: 'Your size, your quality', d: 'Material in the specific size and grade you ask for, even in small quantities.' },
    { t: 'Stock availability', d: 'Big warehouses holding a wide range, including rare compositions.' },
    { t: '25 years of experience', d: 'Hands-on knowledge of steel and metals, applied to every order.' },
    { t: 'Quick delivery', d: 'Without hassles, loaded by our own crane and handling team.' },
    { t: 'Market price', d: 'Material at the market price, with a clear quotation.' },
    { t: 'Timely response', d: 'A dedicated marketing team that answers when you call.' },
  ];
  protected readonly industries = ['Food processing', 'Textile', 'Cement', 'Construction', 'Machine tools', 'Power sector', 'Oil & petroleum', 'Automobile',
    'Machine building & fabrication', 'Fireworks & match', 'Material handling equipment', 'Furniture making', 'Paper & printing', 'Plastics & rubber', 'Blue metal', 'Coir'];
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
