import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { SeoService } from '../../core/services/seo.service';
import { breadcrumbLd, faqLd } from '../../core/services/structured-data';
import { FORMULA_TEXT, FORM_NAMES, Form } from '../../core/weight/weight';
import { FaqListComponent } from '../../shared/faq-list.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { ScaleComponent } from '../../shared/scale.component';

const FAQS = [
  { question: 'How is the weight of a steel round bar calculated?', answer: 'Weight (kg) = π × D² × L × density ÷ 4,000,000, with D and L in mm and density in g/cm³. For mild or alloy steel (7.85 g/cm³) a 25 mm round weighs 3.85 kg per metre.' },
  { question: 'What density do you use for stainless steel, brass and aluminium?', answer: 'Stainless 304/316 8.00, stainless 410/420 7.75, brass 8.50, copper 8.96, gunmetal 8.83, phosphor bronze 8.80, aluminium 6061/6063 2.70 and grey cast iron 7.20 g/cm³.' },
  { question: 'Is the calculated weight what I will be invoiced?', answer: 'No. It is the theoretical weight. Invoices use the actual weighed or mill weight, which can differ by ±2–3% because of rolling tolerances.' },
];

/** /metal-weight-calculator/ — "The scale" on its own page, with every formula written out (spec §3.1). */
@Component({
  selector: 'ss-calculator',
  imports: [RouterLink, PageHeaderComponent, ScaleComponent, FaqListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ss-page-header label="Weight calculator" title="How much will it <em>weigh?</em>"
      lede="Rounds, squares, hex, flats, plates, tubes and MS pipes by schedule, hollow sections, angles, beams and channels, in any of our 27 materials. Add the result to your request and the concierge quotes it."
      [crumbs]="[['/', 'Home'], ['', 'Metal weight calculator']]" />

    <section class="wrap pb-[clamp(56px,7vw,96px)]">
      <ss-scale />
    </section>

    <section class="wrap grid gap-12 pb-[var(--sec)] lg:grid-cols-2">
      <div>
        <span class="label label-accent mb-4">How it's calculated</span>
        <h2 class="h-l mb-6">The formulas</h2>
        <dl class="border-t border-ink">
          @for (f of forms; track f) {
            <div class="grid gap-1 border-b border-line py-3.5 sm:grid-cols-[150px_1fr]"><dt class="font-medium">{{ names[f] }}</dt><dd class="text-muted">{{ text[f] }}</dd></div>
          }
        </dl>
        <p class="mt-4 text-[13px] text-muted">Dimensions in millimetres, density ρ in g/cm³, weight in kilograms. Beams and channels use IS 808 nominal kg/m.</p>
        <p class="mt-2 text-[13px] text-muted">Tubes and hollow sections can be entered by wall thickness or by inside size. <b class="font-medium text-ink">MS pipe (SCH)</b> takes the outside diameter and wall thickness from the pipe schedule (ASME B36.10M, SCH 10 to SCH 160, STD, XS, XXS): pick the nominal size and the schedule.</p>
      </div>
      <div>
        <span class="label label-accent mb-4">Densities</span>
        <h2 class="h-l mb-6">By material</h2>
        <div class="scroll-x">
          <table class="dtable">
            <thead><tr><th>Material</th><th>g/cm³</th></tr></thead>
            <tbody>@for (m of catalog.index().materials; track m.key) { <tr><td>{{ m.name }}</td><td>{{ m.density }}</td></tr> }</tbody>
          </table>
        </div>
      </div>
      <div class="lg:col-span-2">
        <ss-faq-list [faqs]="faqs" />
        <p class="mt-8"><a routerLink="/catalogue-download/" class="lnk">Download the printed weight chart (PDF)</a></p>
      </div>
    </section>`,
})
export class CalculatorComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly forms: Form[] = ['round', 'square', 'hex', 'flat', 'plate', 'tube', 'rect', 'angle', 'beam'];
  protected readonly names = FORM_NAMES;
  protected readonly text = FORMULA_TEXT;
  protected readonly faqs = FAQS;

  constructor() {
    this.catalog.loadIndex().subscribe();
    inject(SeoService).set({
      title: 'Metal Weight Calculator (Round, Flat, Plate, Pipe) | Sun Steel Traders',
      description: 'Calculate the weight of steel, stainless, brass, copper and aluminium rounds, flats, plates, tubes and sections in kg. Free, instant, with formulas shown.',
      path: '/metal-weight-calculator/',
      jsonLd: [breadcrumbLd([['/', 'Home'], ['/metal-weight-calculator/', 'Metal weight calculator']]), faqLd(FAQS)!],
    });
  }
}
