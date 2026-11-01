import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../../../core/models/api.model';
import { AdminApiService, ProductRow } from '../../../core/services/admin-api.service';
import { CatalogService } from '../../../core/services/catalog.service';

const STATES = ['In stock', 'Limited', 'On order'];

/** Stock board: one click per SKU keeps the stock line on every product page honest. */
@Component({
  selector: 'ss-stock',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 class="text-[22px] font-medium">Stock board</h1><p class="text-[13.5px] text-[#6B7485]">Changes show on the website straight away.</p></div>
      <div class="flex w-full gap-2 sm:w-auto">
        <select class="ainput !w-auto" [ngModel]="silo()" (ngModelChange)="silo.set($event)">
          <option value="">All families</option>@for (s of catalog.index().silos; track s.key) { <option [value]="s.key">{{ s.shortName }}</option> }
        </select>
        <input class="ainput min-w-0 flex-1 sm:!w-[200px] sm:flex-none" placeholder="Filter grade or SKU" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      </div>
    </header>
    @if (error()) { <p class="alert mb-3">{{ error() }}</p> }
    <div class="card overflow-x-auto !p-0">
      <table class="tbl">
        <thead><tr><th>SKU</th><th>Product</th><th>Grade</th><th>Stock</th></tr></thead>
        <tbody>
          @for (p of rows(); track p.productId) {
            <tr>
              <td class="text-[#6B7485]">{{ p.sku }}</td>
              <td><a [href]="'/products/' + p.siloKey + '/' + p.slug + '/'" target="_blank" rel="noopener" class="hover:text-accent">{{ p.name }}</a></td>
              <td>{{ p.grade }}</td>
              <td class="whitespace-nowrap">
                @for (s of states; track s) {
                  <button type="button" class="abtn abtn-sm mr-1" [class.abtn-pri]="p.stockStatus === s" [disabled]="busy() === p.productId" (click)="set(p, s)">{{ s }}</button>
                }
              </td>
            </tr>
          } @empty { <tr><td colspan="4" class="py-10 text-center text-[#8A93A3]">Loading…</td></tr> }
        </tbody>
      </table>
    </div>`,
})
export class StockComponent {
  private readonly api = inject(AdminApiService);
  protected readonly catalog = inject(CatalogService);
  protected readonly states = STATES;
  protected readonly all = signal<ProductRow[]>([]);
  protected readonly silo = signal('');
  protected readonly q = signal('');
  protected readonly busy = signal<number | null>(null);
  protected readonly error = signal('');
  protected readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.all().filter((p) => (!this.silo() || p.siloKey === this.silo()) && (!q || `${p.name} ${p.grade} ${p.sku}`.toLowerCase().includes(q)));
  });

  constructor() {
    this.catalog.loadIndex().subscribe();
    this.api.products().subscribe({ next: (p) => this.all.set(p.items), error: (e) => this.error.set(apiError(e)) });
  }

  protected set(p: ProductRow, s: string): void {
    if (p.stockStatus === s) return;
    this.busy.set(p.productId);
    this.api.setStock(p.productId, s).subscribe({
      next: () => { this.all.set(this.all().map((x) => (x.productId === p.productId ? { ...x, stockStatus: s } : x))); this.busy.set(null); },
      error: (e) => { this.busy.set(null); this.error.set(apiError(e)); },
    });
  }
}
