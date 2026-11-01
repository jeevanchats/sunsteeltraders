import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { absUrl } from '../core/api.config';

/**
 * A material photograph. Until the macro photo shoot (design doc §9) it shows a brushed-metal
 * gradient in the right colour for the material; pass `src` once a real image exists.
 */
@Component({
  selector: 'ss-metal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="metal m-0 h-full w-full" [class]="kind()" [class.photo]="!!src()">
      @if (src()) { <img [src]="url()" [alt]="alt()" class="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" /> }
      @if (caption() && !src()) {
        <figcaption class="absolute bottom-3 left-3 z-[1] rounded-sm bg-black/35 px-2 py-0.5 text-[10px] font-medium tracking-[.04em] text-white">{{ caption() }}</figcaption>
      }
    </figure>`,
  styles: `:host { display: block; position: relative; overflow: hidden; }`,
})
export class MetalComponent {
  readonly kind = input('metal-steel');
  readonly src = input<string | null | undefined>(null);
  readonly alt = input('');
  readonly caption = input<string | null>(null);
  protected readonly url = computed(() => absUrl(this.src() ?? ''));
}
