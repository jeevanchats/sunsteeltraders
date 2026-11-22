import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ProductCard, metalClass, stockClass } from '../../core/models/catalog.model';
import { CatalogService } from '../../core/services/catalog.service';
import { SeoService } from '../../core/services/seo.service';
import { breadcrumbLd } from '../../core/services/structured-data';
import { IconComponent } from '../../shared/icon.component';
import { MetalComponent } from '../../shared/metal.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { SearchBoxComponent } from '../../shared/search-box.component';

/** /products/ — the material library (v3 sheet 02): family chips, quiet search, image cards. */
@Component({
  selector: 'ss-products',
  imports: [RouterLink, PageHeaderComponent, MetalComponent, SearchBoxComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-page-header label="The material library" title="Choose by <em>material,</em> or by what you make."
      lede="Ninety-three grades in seven families. Every page carries chemistry, equivalents, sizes and live stock."
      [crumbs]="[['/', 'Home'], ['', 'Products']]">
      <div class="mt-9 grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="chip" [class.chip-on]="!silo()" (click)="silo.set(null)">All {{ all().length || 93 }}</button>
          @for (s of catalog.index().silos; track s.key) {
            <button type="button" class="chip" [class.chip-on]="silo() === s.key" (click)="silo.set(s.key)">{{ s.shortName }}</button>
          }
        </div>
        <ss-search-box placeholder="Search grades…" />
      </div>
    </ss-page-header>

    <section class="wrap pb-[var(--sec)]">
      @for (g of groups(); track g.key) {
        <div class="mb-[clamp(56px,7vw,96px)]">
          <div class="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
            <h2 class="h-l">{{ g.name }}</h2>
            <a [routerLink]="'/products/' + g.key + '/'" class="lnk">{{ g.items.length }} grades · family page <ss-icon name="arrow" [size]="14" /></a>
          </div>
          <div class="grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
            @for (p of g.items; track p.slug) {
              <a [routerLink]="p.path" class="group min-w-0">
                <ss-metal [kind]="metal(p)" [src]="p.heroUrl" [alt]="p.name" [caption]="p.grade" class="aspect-[4/3] transition-transform duration-700 ease-lux group-hover:scale-[1.015]" />
                <b class="mt-3 block font-serif text-[19px] font-medium leading-snug">{{ p.name }}</b>
                <span class="mt-1 block truncate text-[12px] text-muted">{{ p.equivalents.slice(0, 2).join(' · ') || p.sizeRange }}</span>
                <span class="mt-2 inline-flex" [class]="stock(p)">{{ p.stockStatus }}</span>
              </a>
            }
          </div>
        </div>
      }
    </section>`,
})
export class ProductsComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly all = toSignal(this.catalog.products(), { initialValue: [] as ProductCard[] });
  protected readonly silo = signal<string | null>(null);

  protected readonly groups = computed(() =>
    this.catalog.index().silos
      .filter((s) => !this.silo() || s.key === this.silo())
      .map((s) => ({ key: s.key, name: s.name, items: this.all().filter((p) => p.siloKey === s.key) }))
      .filter((g) => g.items.length),
  );

  constructor() {
    this.catalog.loadIndex().subscribe();
    inject(SeoService).set({
      title: 'Steel & Metal Products: 93 Grades | Sun Steel Traders',
      description: 'Browse 93 grades in seven families: mild and structural steel, alloy and tool steel, stainless, non-ferrous, cast iron, plastics and workshop tools.',
      path: '/products/',
      jsonLd: [breadcrumbLd([['/', 'Home'], ['/products/', 'Products']])],
    });
  }

  protected metal(p: ProductCard): string { return metalClass(p.materialKey, p.siloKey); }
  protected stock(p: ProductCard): string { return stockClass(p.stockStatus); }
}
