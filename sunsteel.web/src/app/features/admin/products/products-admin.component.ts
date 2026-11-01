import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiError } from '../../../core/models/api.model';
import { AdminApiService, ProductRow } from '../../../core/services/admin-api.service';
import { CatalogService } from '../../../core/services/catalog.service';

/** All products with search and a family filter; each row opens the full editor. Stock has its own one-click board. */
@Component({
  selector: 'ss-products-admin',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-[22px] font-medium">Products</h1>
        <p class="text-[13.5px] text-[#6B7485]">Edit the details, photo and search text of each grade. For a quick stock change use the <a routerLink="/admin/stock" class="underline">Stock board</a>.</p>
      </div>
      <div class="flex w-full flex-wrap gap-2 sm:w-auto">
        <select class="ainput !w-auto" [ngModel]="silo()" (ngModelChange)="silo.set($event)" aria-label="Family">
          <option value="">All families</option>@for (s of catalog.index().silos; track s.key) { <option [value]="s.key">{{ s.shortName }}</option> }
        </select>
        <input class="ainput min-w-0 flex-1 sm:!w-[210px] sm:flex-none" placeholder="Search name, grade or SKU" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      </div>
    </header>
    @if (error()) { <p class="alert mb-3">{{ error() }}</p> }
    <div class="card overflow-x-auto !p-0">
      <table class="tbl">
        <thead><tr><th>SKU</th><th>Product</th><th>Grade</th><th>Stock</th><th>Status</th><th></th></tr></thead>
        <tbody>
          @for (p of rows(); track p.productId) {
            <tr>
              <td class="text-[#6B7485]">{{ p.sku }}</td>
              <td><a [routerLink]="['/admin/products', p.productId]" class="font-medium hover:text-accent">{{ p.name }}</a></td>
              <td>{{ p.grade }}</td>
              <td>{{ p.stockStatus }}</td>
              <td>@if (p.isPublished) { <span class="pill pill-ok">Published</span> } @else { <span class="pill">Hidden</span> }</td>
              <td class="text-right"><a [routerLink]="['/admin/products', p.productId]" class="abtn abtn-sm">Edit</a></td>
            </tr>
          } @empty { <tr><td colspan="6" class="py-10 text-center text-[#8A93A3]">{{ loading() ? 'Loading…' : 'No products match.' }}</td></tr> }
        </tbody>
      </table>
    </div>
    <p class="ahint mt-3">{{ rows().length }} of {{ all().length }} products shown.</p>`,
})
export class ProductsAdminComponent {
  private readonly api = inject(AdminApiService);
  protected readonly catalog = inject(CatalogService);
  protected readonly all = signal<ProductRow[]>([]);
  protected readonly silo = signal('');
  protected readonly q = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.all().filter((p) => (!this.silo() || p.siloKey === this.silo()) && (!q || `${p.name} ${p.grade} ${p.sku}`.toLowerCase().includes(q)));
  });

  constructor() {
    this.catalog.loadIndex().subscribe();
    this.api.products().subscribe({
      next: (p) => { this.all.set(p.items); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.error.set(apiError(e)); },
    });
  }
}
