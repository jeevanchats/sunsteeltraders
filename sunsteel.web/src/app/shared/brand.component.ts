import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteService } from '../core/services/site.service';

/** Logo lockup: the SST logo (public/brand) + serif name + small-caps place line. Text comes from site settings. */
@Component({
  selector: 'ss-brand',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="link()" class="flex items-center gap-3 leading-none" [attr.aria-label]="site.businessName() + ' home'">
      <img src="/brand/sst-logo-160.webp" srcset="/brand/sst-logo-160.webp 160w, /brand/sst-logo-320.webp 320w" sizes="44px"
           width="44" height="38" alt="" class="h-[38px] w-auto flex-none" />
      <span>
        <span class="block font-serif text-[23px] font-semibold tracking-[.02em]">{{ site.businessName() }}</span>
        @if (showPlace()) {
          <small class="mt-[5px] block text-[8.5px] font-semibold uppercase tracking-[.32em] opacity-60">{{ site.get('LocationLine') }}<span class="hidden sm:inline"> · {{ site.get('Tagline') }}</span></small>
        }
      </span>
    </a>`,
})
export class BrandComponent {
  protected readonly site = inject(SiteService);
  readonly link = input('/');
  readonly showPlace = input(true);
}
