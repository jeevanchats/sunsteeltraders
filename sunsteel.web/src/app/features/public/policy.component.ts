import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { Policy } from '../../core/models/catalog.model';
import { SeoService } from '../../core/services/seo.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { NotFoundComponent } from './not-found.component';

/** Google shows these when a policy page has no description of its own. */
const DESCRIPTIONS: Record<string, string> = {
  'terms-conditions': 'Terms and conditions for orders, quotations, cutting and delivery from Sun Steel Traders, steel and metal dealers in Madurai.',
  'privacy-policy': 'How Sun Steel Traders, Madurai, collects and uses your details when you request a quote, send a drawing or contact us.',
};

/** /terms-conditions/ and /privacy-policy/: HTML from the PolicyPages table (sanitised by Angular). */
@Component({
  selector: 'ss-policy',
  imports: [PageHeaderComponent, NotFoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (p(); as p) {
      <ss-page-header label="Sun Steel Traders" [title]="p.title" [crumbs]="[['/', 'Home'], ['', p.title]]" />
      <article class="wrap max-w-[860px] pb-[var(--sec)] [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-[28px] [&_p]:text-muted" [innerHTML]="p.bodyHtml"></article>
    } @else {
      <ss-not-found />
    }`,
})
export class PolicyComponent {
  private readonly seo = inject(SeoService);
  private readonly route = inject(ActivatedRoute);
  protected readonly p = toSignal(this.route.data.pipe(map((d) => d['doc'] as Policy | null)), { initialValue: null });

  constructor() {
    effect(() => {
      const p = this.p();
      if (p) this.seo.set({ title: `${p.title} | Sun Steel Traders`, description: DESCRIPTIONS[p.slug] ?? `${p.title} of Sun Steel Traders, steel and metal dealers in Madurai.`, path: `/${p.slug}/` });
    });
  }
}
