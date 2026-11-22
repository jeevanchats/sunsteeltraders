import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Product, metalClass, stockClass } from '../../core/models/catalog.model';
import { CatalogService } from '../../core/services/catalog.service';
import { SeoService } from '../../core/services/seo.service';
import { shareImage } from '../../core/services/share-image';
import { SiteService } from '../../core/services/site.service';
import { breadcrumbLd, compact, faqLd, productLd } from '../../core/services/structured-data';
import { ChartRow, Dims, Form, formatKg, sizeChart } from '../../core/weight/weight';
import { FaqListComponent } from '../../shared/faq-list.component';
import { IconComponent } from '../../shared/icon.component';
import { MetalComponent } from '../../shared/metal.component';
import { ScaleComponent, ScaleProduct } from '../../shared/scale.component';
import { NotFoundComponent } from './not-found.component';

/**
 * /products/{silo}/{slug}/ — the material dossier (v3 sheet 03, spec §3 blueprint):
 * macro image + headline numbers, chaptered detail (all content in the HTML, no hidden tabs),
 * the scale locked to this grade, FAQs and related grades.
 */
@Component({
  selector: 'ss-product',
  imports: [RouterLink, MetalComponent, ScaleComponent, FaqListComponent, IconComponent, NotFoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (p(); as p) {
      <section class="grid pt-[84px] lg:min-h-[min(92svh,860px)] lg:grid-cols-2">
        <ss-metal [kind]="metal(p)" [src]="p.heroUrl" [alt]="p.name" caption="Photograph to come: bar end and mill stamp" class="min-h-[320px] lg:min-h-0" />
        <div class="flex flex-col justify-center px-[var(--pad)] py-[clamp(36px,5vw,72px)] lg:pl-[clamp(32px,5vw,80px)]">
          <nav aria-label="Breadcrumb" class="mb-7 flex flex-wrap items-center gap-2 text-[12px] text-faint">
            <a routerLink="/" class="hover:text-ink">Home</a><span>/</span>
            <a routerLink="/products/" class="hover:text-ink">Products</a><span>/</span>
            <a [routerLink]="'/products/' + p.siloKey + '/'" class="hover:text-ink">{{ p.siloName }}</a>
          </nav>
          <span class="label label-accent mb-4">{{ p.siloName }} · Dossier</span>
          <h1 class="h-xxl">{{ p.grade }} <em>{{ restOfName(p) }}</em></h1>
          @if (p.equivalents.length) { <p class="mt-4 text-[13.5px] text-muted">{{ p.equivalents.join(' · ') }}</p> }
          @if (p.aliases.length) { <p class="mt-2 text-[13.5px] text-muted">Also called: {{ p.aliases.join(' · ') }}</p> }
          <p class="lede mt-5">{{ p.summary }}</p>

          <div class="mt-8 grid grid-cols-3 gap-5">
            @for (h of headline(); track h.k) {
              <div class="card-rule"><span class="label">{{ h.k }}</span><b class="mt-1 block font-serif text-[clamp(20px,2vw,28px)] font-medium leading-tight">{{ h.v }}</b></div>
            }
          </div>

          <div class="mt-8 flex flex-wrap items-center gap-4">
            <span [class]="stock(p)">{{ p.stockStatus }}</span>
            @if (p.priceNote) { <span class="text-[13px] text-muted">{{ p.priceNote }}</span> }
          </div>
          <div class="mt-5 flex flex-wrap gap-3">
            <a class="btn" href="#weigh" (click)="go($event, 'weigh')">Request this grade</a>
            <a [href]="site.whatsapp('Hello Sun Steel Traders, please share price and stock for ' + p.name + '.')" target="_blank" rel="noopener" class="btn btn-ghost"><ss-icon name="wa" [size]="16" />Ask on WhatsApp</a>
          </div>
        </div>
      </section>

      <!-- chapter index -->
      <nav class="sticky top-[70px] z-30 border-y border-line bg-surface/95 backdrop-blur" aria-label="On this page">
        <div class="wrap flex gap-7 overflow-x-auto py-3.5 text-[11px] font-semibold uppercase tracking-[.14em] [scrollbar-width:none]">
          @for (c of chapters(); track c.id) {
            <a [href]="'#' + c.id" (click)="go($event, c.id)" class="whitespace-nowrap border-b-2 border-transparent pb-1 hover:border-accent">{{ c.n }} · {{ c.t }}</a>
          }
        </div>
      </nav>

      <div class="wrap grid gap-[clamp(56px,7vw,104px)] py-[clamp(56px,7vw,104px)]">
        @if (chart().rows.length) {
          <section id="sizes" class="scroll-mt-32">
            <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
              <h2 class="h-l"><span class="text-accent">I.</span> Sizes &amp; weights</h2>
              <span class="label">Nominal weights at {{ p.density }} g/cm³ · {{ p.sizeRange }}</span>
            </div>
            <div class="scroll-x">
              <table class="dtable">
                <thead><tr>@for (h of chart().head; track h) { <th>{{ h }}</th> }<th></th></tr></thead>
                <tbody>
                  @for (r of chart().rows; track r.size) {
                    <tr><td class="font-medium">{{ r.size }}</td><td>{{ kg(r.kgPerM) }}</td><td>{{ kg(r.kgPer) }}</td>
                      <td class="text-right"><button type="button" class="lnk" (click)="useRow(r)">Use in the scale</button></td></tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        } @else if (p.sizeRange) {
          <section id="sizes" class="scroll-mt-32"><h2 class="h-l"><span class="text-accent">I.</span> Sizes</h2><p class="lede mt-4">{{ p.sizeRange }}</p></section>
        }

        @if (p.chemistry.length) {
          <section id="chemistry" class="scroll-mt-32">
            <h2 class="h-l mb-6"><span class="text-accent">II.</span> Chemical composition <small class="text-[15px] text-muted">(% by weight)</small></h2>
            <div class="scroll-x">
              <table class="dtable">
                <thead><tr><th>Element</th>@for (c of p.chemistry; track c.el) { <th>{{ c.el }}</th> }</tr></thead>
                <tbody>
                  <tr><td class="text-muted">Min</td>@for (c of p.chemistry; track c.el) { <td>{{ c.min || '–' }}</td> }</tr>
                  <tr><td class="text-muted">Max</td>@for (c of p.chemistry; track c.el) { <td>{{ c.max || '–' }}</td> }</tr>
                </tbody>
              </table>
            </div>
            <p class="mt-3 text-[12.5px] text-muted">Typical standard ranges. Every mill lot ships with its own test certificate on request.</p>
          </section>
        }

        <section id="properties" class="grid gap-10 scroll-mt-32 lg:grid-cols-2">
          @if (p.mechanical.length) {
            <div>
              <h2 class="h-l mb-6"><span class="text-accent">III.</span> Mechanical properties</h2>
              <dl class="border-t border-ink">
                @for (m of p.mechanical; track m.k) { <div class="flex justify-between gap-6 border-b border-line py-3.5"><dt class="text-muted">{{ m.k }}</dt><dd class="text-right font-medium">{{ m.v }}</dd></div> }
              </dl>
            </div>
          }
          <div>
            <h2 class="h-l mb-6"><span class="text-accent">IV.</span> Supply condition</h2>
            <dl class="border-t border-ink">
              @if (p.condition) { <div class="flex justify-between gap-6 border-b border-line py-3.5"><dt class="text-muted">Condition</dt><dd class="text-right font-medium">{{ p.condition }}</dd></div> }
              @if (p.machinability) { <div class="flex justify-between gap-6 border-b border-line py-3.5"><dt class="text-muted">Machinability</dt><dd class="text-right font-medium">{{ p.machinability }}</dd></div> }
              <div class="flex justify-between gap-6 border-b border-line py-3.5"><dt class="text-muted">Forms</dt><dd class="text-right font-medium capitalize">{{ p.forms.join(', ') }}</dd></div>
              <div class="flex justify-between gap-6 border-b border-line py-3.5"><dt class="text-muted">Cutting</dt><dd class="text-right font-medium">Band saw ±1 mm</dd></div>
              <div class="flex justify-between gap-6 border-b border-line py-3.5"><dt class="text-muted">SKU</dt><dd class="text-right font-medium">{{ p.sku }}</dd></div>
            </dl>
          </div>
        </section>

        @if (p.materialKey) {
          <section id="weigh" class="scroll-mt-32">
            <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
              <h2 class="h-l"><span class="text-accent">V.</span> Weigh it, <em>then request it.</em></h2>
              <span class="label">Locked to {{ p.grade }}</span>
            </div>
            <ss-scale [product]="scaleProduct()" [preset]="preset()" />
          </section>
        }
      </div>

      @if (p.applications) {
        <section class="on-dark bg-primary py-[clamp(56px,7vw,96px)] text-on-primary">
          <div class="wrap grid items-end gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
            <div><span class="label mb-4">Applications</span><p class="font-serif text-[clamp(26px,3vw,40px)] font-medium leading-[1.15]">{{ p.applications }}</p></div>
            <div class="flex flex-wrap gap-6 lg:justify-end">
              <a routerLink="/catalogue-download/" class="lnk">Download data sheet</a>
              <a routerLink="/contact-us/" class="lnk">Ask for an equivalent</a>
            </div>
          </div>
        </section>
      }

      <section class="wrap grid gap-10 py-[var(--sec)] lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <div><span class="label label-accent mb-4">Questions</span><h2 class="h-l">About {{ p.grade }}</h2></div>
        <ss-faq-list [faqs]="p.faqs" />
      </section>

      @if (p.related.length) {
        <section class="wrap pb-[var(--sec)]">
          <div class="mb-8 flex items-end justify-between gap-4"><h2 class="h-l">Also in <em>{{ p.siloName }}</em></h2><a [routerLink]="'/products/' + p.siloKey + '/'" class="lnk">All grades</a></div>
          <div class="grid grid-cols-2 gap-5 md:grid-cols-4">
            @for (r of p.related; track r.slug) {
              <a [routerLink]="r.path" class="group min-w-0">
                <ss-metal [kind]="metalOf(r.materialKey, r.siloKey)" [src]="r.heroUrl" [caption]="r.grade" class="aspect-[4/3]" />
                <b class="mt-3 block font-serif text-[18px] font-medium leading-snug">{{ r.name }}</b>
              </a>
            }
          </div>
        </section>
      }
    } @else {
      <ss-not-found />
    }`,
})
export class ProductComponent {
  protected readonly site = inject(SiteService);
  private readonly catalog = inject(CatalogService);
  private readonly seo = inject(SeoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly p = toSignal(inject(ActivatedRoute).data.pipe(map((d) => d['product'] as Product | null)), { initialValue: null });
  protected readonly preset = signal<{ form: Form; dims: Dims; section?: string } | null>(null);

  protected readonly scaleProduct = computed<ScaleProduct | null>(() => {
    const p = this.p();
    return p ? { slug: p.slug, name: p.name, grade: p.grade, materialKey: p.materialKey, forms: p.forms } : null;
  });

  protected readonly chart = computed(() => {
    const p = this.p();
    if (!p?.materialKey || !p.forms.length) return { head: ['', '', ''] as [string, string, string], rows: [] as ChartRow[] };
    return sizeChart(p.forms[0], p.density ?? 7.85, p.sizeRange, this.catalog.index().sections);
  });

  protected readonly headline = computed(() => {
    const p = this.p();
    if (!p) return [];
    const pick = (k: string) => p.mechanical.find((m) => m.k.toLowerCase().startsWith(k));
    const out = [pick('tensile'), pick('hardness') ?? pick('yield')].filter((x): x is { k: string; v: string } => !!x);
    const range = p.sizeRange?.match(/[Ø]?\s*\d[\d.,\s]*(?:–|-)\s*\d[\d.,]*\s*mm/)?.[0];
    out.push({ k: 'Range', v: range ?? (p.forms.length ? p.forms.slice(0, 2).join(' · ') : '—') });
    return out.slice(0, 3);
  });

  protected readonly chapters = computed(() => {
    const p = this.p();
    if (!p) return [];
    return [
      { id: 'sizes', n: 'I', t: 'Sizes' },
      ...(p.chemistry.length ? [{ id: 'chemistry', n: 'II', t: 'Chemistry' }] : []),
      { id: 'properties', n: 'III', t: 'Properties' },
      ...(p.materialKey ? [{ id: 'weigh', n: 'V', t: 'Weigh & request' }] : []),
    ];
  });

  constructor() {
    this.catalog.loadIndex().subscribe();
    effect(() => {
      const p = this.p();
      if (!p) return;
      this.preset.set(null);
      this.seo.set({
        title: p.metaTitle,
        description: p.metaDescription,
        path: p.path,
        image: shareImage(p.siloKey),
        jsonLd: compact([
          productLd(p),
          breadcrumbLd([['/', 'Home'], ['/products/', 'Products'], [`/products/${p.siloKey}/`, p.siloName], [p.path, p.name]]),
          faqLd(p.faqs),
        ]),
      });
    });
  }

  protected restOfName(p: Product): string {
    const rest = p.name.replace(new RegExp('^' + p.grade.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '');
    return rest === p.name ? p.name : rest;
  }

  protected metal(p: Product): string { return metalClass(p.materialKey, p.siloKey); }
  protected metalOf(k: string | null | undefined, silo: string): string { return metalClass(k, silo); }
  protected stock(p: Product): string { return stockClass(p.stockStatus); }
  protected kg(n: number): string { return formatKg(n); }

  protected useRow(r: ChartRow): void {
    this.preset.set({ form: r.form, dims: r.dims, section: r.section });
    this.scrollTo('weigh');
  }

  protected go(e: Event, id: string): void {
    e.preventDefault();
    this.scrollTo(id);
  }

  private scrollTo(id: string): void {
    if (this.isBrowser) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
