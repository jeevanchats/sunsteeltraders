import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../../core/models/api.model';
import { AdminApiService, Traffic } from '../../core/services/admin-api.service';

type Preset = '7' | '30' | '90' | 'month' | 'custom';

const W = 800, H = 260, PAD = { l: 44, r: 14, t: 14, b: 28 };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

/** A round upper limit for the vertical scale (10, 20, 50, 100, 200 …). */
function niceMax(v: number): number {
  if (v <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].map((m) => m * mag).find((m) => m >= v) ?? v);
}

/** Visits per day for a chosen period, drawn as a graph, with where visitors came from and what they read. */
@Component({
  selector: 'ss-traffic',
  imports: [FormsModule, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card mt-4" aria-labelledby="traffic-h">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="traffic-h" class="text-[16px] font-medium">Website visitors</h2>
          <p class="text-[12.5px] text-[#6B7485]">A visit is one visitor on one day. Page views count every page they open.</p></div>
        <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Period">
          @for (p of presets; track p[0]) {
            <button type="button" class="abtn abtn-sm" [class.abtn-pri]="preset() === p[0]" [attr.aria-pressed]="preset() === p[0]" (click)="choose(p[0])">{{ p[1] }}</button>
          }
        </div>
      </div>
      @if (preset() === 'custom') {
        <div class="mt-3 flex flex-wrap items-end gap-3">
          <label class="alabel">From<input class="ainput !w-[160px]" type="date" [max]="to" [(ngModel)]="from" /></label>
          <label class="alabel">To<input class="ainput !w-[160px]" type="date" [max]="today" [(ngModel)]="to" /></label>
          <button type="button" class="abtn abtn-pri" (click)="load()">Show</button>
        </div>
      }
      @if (error()) { <p class="alert mt-3">{{ error() }}</p> }

      @if (t(); as d) {
        <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div><span class="text-[12.5px] text-[#6B7485]">Visits</span><b class="block text-[28px] font-medium leading-tight">{{ d.totals.visits | number }}</b>
            <small [class]="changeClass(d.totals.visits, d.previous.visits)">{{ change(d.totals.visits, d.previous.visits) }}</small></div>
          <div><span class="text-[12.5px] text-[#6B7485]">Page views</span><b class="block text-[28px] font-medium leading-tight">{{ d.totals.views | number }}</b>
            <small [class]="changeClass(d.totals.views, d.previous.views)">{{ change(d.totals.views, d.previous.views) }}</small></div>
          <div class="col-span-2 sm:col-span-1"><span class="text-[12.5px] text-[#6B7485]">Average per day</span><b class="block text-[28px] font-medium leading-tight">{{ avg() | number: '1.0-1' }}</b>
            <small class="text-[#8A93A3]">visits</small></div>
        </div>

        <div class="relative mt-4">
          <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="block w-full" role="img" [attr.aria-label]="'Visits per day, ' + (d.from | date: 'd MMM') + ' to ' + (d.to | date: 'd MMM y')" (mouseleave)="hover.set(null)">
            @for (g of grid(); track g.v) {
              <line [attr.x1]="pad.l" [attr.x2]="w - pad.r" [attr.y1]="g.y" [attr.y2]="g.y" stroke="#E3E6EB" stroke-width="1" />
              <text [attr.x]="pad.l - 8" [attr.y]="g.y + 4" text-anchor="end" font-size="11" fill="#6B7485">{{ g.v }}</text>
            }
            <path [attr.d]="areaPath()" fill="var(--color-accent)" fill-opacity=".14" />
            <path [attr.d]="viewsLine()" fill="none" stroke="#8A93A3" stroke-width="1.5" stroke-dasharray="4 3" />
            <path [attr.d]="visitsLine()" fill="none" stroke="var(--color-accent)" stroke-width="2.5" stroke-linejoin="round" />
            @for (x of xLabels(); track x.i) {
              <text [attr.x]="x.x" [attr.y]="h - 8" text-anchor="middle" font-size="11" fill="#6B7485">{{ x.label }}</text>
            }
            @if (hover() !== null) {
              <line [attr.x1]="px(hover()!)" [attr.x2]="px(hover()!)" [attr.y1]="pad.t" [attr.y2]="h - pad.b" stroke="#6B7485" stroke-width="1" />
              <circle [attr.cx]="px(hover()!)" [attr.cy]="py(d.daily[hover()!].visits)" r="4.5" fill="var(--color-accent)" stroke="#fff" stroke-width="2" />
            }
            @for (p of d.daily; track p.date; let i = $index) {
              <rect [attr.x]="px(i) - step() / 2" [attr.y]="pad.t" [attr.width]="step()" [attr.height]="h - pad.t - pad.b" fill="transparent" (mouseenter)="hover.set(i)" (click)="hover.set(i)" />
            }
          </svg>
          @if (hover() !== null) {
            <div class="pointer-events-none absolute top-1 rounded-lg border border-[#E3E6EB] bg-white px-3 py-2 text-[12.5px] shadow-md" [style.left.%]="tipLeft()" [style.transform]="tipShift()">
              <b class="block font-medium">{{ d.daily[hover()!].date | date: 'EEE d MMM y' }}</b>
              <span class="block">{{ d.daily[hover()!].visits }} visits</span>
              <span class="block text-[#6B7485]">{{ d.daily[hover()!].views }} page views</span>
            </div>
          }
          <p class="mt-1 flex gap-4 text-[12px] text-[#6B7485]">
            <span class="inline-flex items-center gap-1.5"><i class="inline-block h-[3px] w-5 rounded bg-accent"></i>Visits</span>
            <span class="inline-flex items-center gap-1.5"><i class="inline-block h-0 w-5 border-t-2 border-dashed border-[#8A93A3]"></i>Page views</span>
          </p>
        </div>

        @if (d.totals.views === 0) {
          <p class="ahint mt-3">No visits recorded in this period yet. They appear a moment after someone opens a page of the website.</p>
        } @else {
          <div class="mt-5 grid gap-6 md:grid-cols-3">
            <div><b class="font-medium">Most read pages</b>
              <ul class="mt-2 grid gap-1.5 text-[13px]">@for (p of d.topPages; track p.name) { <li class="flex justify-between gap-3"><span class="min-w-0 truncate" [title]="p.name">{{ p.name }}</span><span class="tabular-nums text-[#6B7485]">{{ p.count | number }}</span></li> }</ul></div>
            <div><b class="font-medium">Where visitors came from</b>
              <ul class="mt-2 grid gap-1.5 text-[13px]">@for (s of d.sources; track s.name) { <li class="flex justify-between gap-3"><span>{{ s.name }}</span><span class="tabular-nums text-[#6B7485]">{{ s.count | number }}</span></li> }</ul>
              @if (d.referrers.length) {
                <small class="mt-3 block text-[#8A93A3]">Sites sending visitors</small>
                <ul class="mt-1 grid gap-1 text-[13px]">@for (r of d.referrers; track r.name) { <li class="flex justify-between gap-3"><span class="min-w-0 truncate">{{ r.name }}</span><span class="tabular-nums text-[#6B7485]">{{ r.count }}</span></li> }</ul>
              }</div>
            <div><b class="font-medium">Devices</b>
              <ul class="mt-2 grid gap-1.5 text-[13px]">@for (s of d.devices; track s.name) { <li class="flex justify-between gap-3"><span>{{ s.name }}</span><span class="tabular-nums text-[#6B7485]">{{ s.count | number }}</span></li> }</ul></div>
          </div>
        }
      } @else if (!error()) {
        <p class="mt-4 text-[13px] text-[#8A93A3]">Loading…</p>
      }
    </section>`,
})
export class TrafficComponent {
  private readonly api = inject(AdminApiService);
  protected readonly presets: [Preset, string][] = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['month', 'This month'], ['custom', 'Custom']];
  protected readonly preset = signal<Preset>('30');
  protected readonly t = signal<Traffic | null>(null);
  protected readonly error = signal('');
  protected readonly hover = signal<number | null>(null);
  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly today = iso(new Date());
  protected from = iso(daysAgo(29));
  protected to = this.today;

  constructor() { this.load(); }

  protected choose(p: Preset): void {
    this.preset.set(p);
    const now = new Date();
    if (p === '7' || p === '30' || p === '90') { this.from = iso(daysAgo(Number(p) - 1)); this.to = this.today; }
    if (p === 'month') { this.from = iso(new Date(now.getFullYear(), now.getMonth(), 1)); this.to = this.today; }
    if (p !== 'custom') this.load();
  }

  protected load(): void {
    if (!this.from || !this.to) return;
    this.error.set('');
    this.hover.set(null);
    this.api.traffic(this.from, this.to).subscribe({ next: (d) => this.t.set(d), error: (e) => this.error.set(apiError(e)) });
  }

  private readonly max = computed(() => niceMax(Math.max(1, ...(this.t()?.daily.flatMap((d) => [d.visits, d.views]) ?? [1]))));
  protected readonly avg = computed(() => { const d = this.t(); return d && d.daily.length ? d.totals.visits / d.daily.length : 0; });
  protected readonly step = computed(() => (W - PAD.l - PAD.r) / Math.max(1, this.t()?.daily.length ?? 1));

  protected px(i: number): number { return PAD.l + this.step() * (i + 0.5); }
  protected py(v: number): number { return PAD.t + (H - PAD.t - PAD.b) * (1 - v / this.max()); }

  protected readonly grid = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: Math.round(this.max() * f), y: this.py(this.max() * f) })));
  protected readonly visitsLine = computed(() => this.line((d) => d.visits));
  protected readonly viewsLine = computed(() => this.line((d) => d.views));
  protected readonly areaPath = computed(() => {
    const d = this.t()?.daily ?? [];
    if (!d.length) return '';
    return `${this.line((x) => x.visits)} L${this.px(d.length - 1)},${this.py(0)} L${this.px(0)},${this.py(0)} Z`;
  });
  protected readonly xLabels = computed(() => {
    const d = this.t()?.daily ?? [];
    const every = Math.max(1, Math.ceil(d.length / 8));
    return d.map((p, i) => ({ i, x: this.px(i), label: new Date(p.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) })).filter((_, i) => i % every === 0);
  });

  private line(pick: (d: { visits: number; views: number }) => number): string {
    const d = this.t()?.daily ?? [];
    return d.map((p, i) => `${i ? 'L' : 'M'}${this.px(i).toFixed(1)},${this.py(pick(p)).toFixed(1)}`).join(' ');
  }

  protected tipLeft(): number { return ((this.px(this.hover() ?? 0)) / W) * 100; }
  protected tipShift(): string { const i = this.hover() ?? 0, n = this.t()?.daily.length ?? 1; return i > n * 0.7 ? 'translateX(-105%)' : 'translateX(8px)'; }

  protected change(now: number, before: number): string {
    if (!before) return now ? 'new in this period' : 'no change';
    const pct = Math.round(((now - before) / before) * 100);
    return `${pct > 0 ? '▲' : pct < 0 ? '▼' : ''} ${Math.abs(pct)}% vs the period before`;
  }
  protected changeClass(now: number, before: number): string {
    return 'text-[12px] ' + (before && now > before ? 'text-[#2E7D4F]' : before && now < before ? 'text-[#A33A2B]' : 'text-[#8A93A3]');
  }
}
