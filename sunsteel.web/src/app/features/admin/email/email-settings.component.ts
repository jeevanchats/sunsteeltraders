import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../../../core/models/api.model';
import { AdminApiService, EmailSettings } from '../../../core/services/admin-api.service';
import { SeoService } from '../../../core/services/seo.service';

const VALID = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;

/**
 * Email (Brevo SMTP) for new-request alerts: every request saved from the website is emailed to the addresses listed here.
 * In Mock mode nothing is sent; messages are written to the server log, so it can be set up and tried safely.
 * The key is saved encrypted and never shown again: leave the box blank to keep the saved one.
 */
@Component({
  selector: 'ss-email-settings',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-5"><h1 class="text-[22px] font-medium">Email alerts</h1>
      <p class="text-[13.5px] text-[#6B7485]">When someone sends a request from the website, it is saved here in the admin and also emailed to the addresses below.</p></header>

    @if (message(); as m) { <p class="alert mb-4" [class.alert-ok]="m.ok" role="status">{{ m.text }}</p> }

    @if (s(); as s) {
      <form class="card grid gap-5" (ngSubmit)="save()" #f="ngForm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><b class="font-medium">Email (Brevo SMTP)</b>
            <p class="mt-0.5 text-[13px] text-[#6B7485]">In <b>Mock</b> nothing is sent; messages are written to the server log. Switch to <b>Live</b> once the details below are correct.</p></div>
          <div class="inline-flex rounded-lg border border-[#E3E6EB] p-0.5" role="group" aria-label="Mode">
            @for (m of modes; track m) {
              <button type="button" class="rounded-md px-4 py-1.5 text-[13.5px] font-medium" [class.bg-[#0F8A5F]]="s.mode === m && m === 'Live'" [class.bg-[#E3E6EB]]="s.mode === m && m === 'Mock'"
                [class.text-white]="s.mode === m && m === 'Live'" [attr.aria-pressed]="s.mode === m" (click)="s.mode = m">{{ m }}</button>
            }
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="alabel">SMTP host<input class="ainput font-mono" name="host" [(ngModel)]="s.host" maxlength="200" required /></label>
          <label class="alabel">Port<input class="ainput" type="number" name="port" [(ngModel)]="s.port" min="1" max="65535" required /></label>
          <label class="alabel">SMTP login<input class="ainput font-mono" name="login" [(ngModel)]="s.login" maxlength="200" autocomplete="off" /></label>
          <label class="alabel">SMTP key @if (s.hasKey) { <span class="font-normal text-[#0F8A5F]">· one is saved</span> }
            <input class="ainput" type="password" name="key" [(ngModel)]="key" autocomplete="new-password" [placeholder]="s.hasKey ? 'Leave blank to keep the saved key' : 'Paste the key from Brevo'" /></label>
          <label class="alabel">From address<input class="ainput" type="email" name="from" [(ngModel)]="s.fromAddress" maxlength="200" />
            <small class="text-[#8A93A3]">Must be a sender you have verified in Brevo.</small></label>
          <label class="alabel">From name<input class="ainput" name="fromName" [(ngModel)]="s.fromName" maxlength="100" /></label>
        </div>

        <div class="alabel">
          <span>Send new-request alerts to</span>
          <div class="ainput flex min-h-[44px] flex-wrap items-center gap-1.5 !h-auto py-1.5" (click)="addBox.focus()">
            @for (a of s.alertTo; track a) {
              <span class="inline-flex items-center gap-1 rounded-md bg-[#EEF0F3] px-2 py-1 text-[13.5px]">{{ a }}
                <button type="button" class="text-[#6B7485] hover:text-[#A33A2B]" [attr.aria-label]="'Remove ' + a" (click)="remove(a); $event.stopPropagation()">×</button></span>
            }
            <input #addBox class="min-w-[180px] flex-1 border-0 bg-transparent p-1 text-[14px] outline-none" name="add" [(ngModel)]="adding" placeholder="Add another…" aria-label="Add an address"
              (keydown.enter)="commit($event)" (keydown.tab)="commit($event, true)" (keydown)="comma($event)" (blur)="commit()" />
          </div>
          <small class="text-[#8A93A3]">Press Enter, comma or Tab to add each address. Several people can be alerted.</small>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="submit" class="abtn abtn-pri" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save' }}</button>
        </div>

        <div class="grid gap-2 border-t border-[#EEF0F3] pt-4">
          <div class="flex flex-wrap gap-2">
            <input class="ainput !w-auto min-w-[240px] flex-1" type="email" name="testTo" [(ngModel)]="testTo" placeholder="Send a test email to…" aria-label="Send a test email to" />
            <button type="button" class="abtn" [disabled]="busy() || !testTo.trim()" (click)="test()">Send test email</button>
          </div>
          <small class="text-[#8A93A3]">Save your changes first. The test uses the saved settings.</small>
        </div>
      </form>
    } @else if (!message()) { <p class="text-[13px] text-[#8A93A3]">Loading…</p> }`,
})
export class EmailSettingsComponent {
  private readonly api = inject(AdminApiService);
  protected readonly modes: ('Mock' | 'Live')[] = ['Mock', 'Live'];
  protected readonly s = signal<EmailSettings | null>(null);
  protected readonly busy = signal(false);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);
  protected key = '';
  protected adding = '';
  protected testTo = '';

  constructor() {
    inject(SeoService).set({ title: 'Email alerts | Sun Steel Traders admin', path: '/admin/email', noindex: true });
    this.api.emailSettings().subscribe({ next: (s) => this.s.set(s), error: (e) => this.fail(e) });
  }

  protected comma(e: KeyboardEvent): void { if (e.key === ',' || e.key === ';' || e.key === ' ') this.commit(e); }

  protected commit(e?: Event, tab = false): void {
    const s = this.s();
    const v = this.adding.trim().replace(/[,;]$/, '');
    if (!s || !v) return;
    if (!VALID.test(v)) { if (e && !tab) e.preventDefault(); this.message.set({ ok: false, text: `"${v}" is not a valid email address.` }); return; }
    if (e && !tab) e.preventDefault();
    if (tab) e?.preventDefault();
    if (!s.alertTo.some((a) => a.toLowerCase() === v.toLowerCase())) s.alertTo = [...s.alertTo, v];
    this.adding = '';
    this.message.set(null);
  }

  protected remove(a: string): void { const s = this.s(); if (s) s.alertTo = s.alertTo.filter((x) => x !== a); }

  protected save(): void {
    const s = this.s();
    if (!s) return;
    this.commit();
    this.busy.set(true);
    this.message.set(null);
    this.api.saveEmailSettings({ mode: s.mode, host: s.host, port: s.port, login: s.login, key: this.key || null, fromAddress: s.fromAddress, fromName: s.fromName, alertTo: s.alertTo }).subscribe({
      next: (r) => { this.s.set(r); this.key = ''; this.busy.set(false); this.message.set({ ok: true, text: 'Email settings saved.' }); },
      error: (e) => { this.busy.set(false); this.fail(e); },
    });
  }

  protected test(): void {
    this.busy.set(true);
    this.message.set(null);
    this.api.sendTestEmail(this.testTo.trim()).subscribe({
      next: (r) => { this.busy.set(false); this.message.set({ ok: r.sent, text: r.message }); },
      error: (e) => { this.busy.set(false); this.fail(e); },
    });
  }

  private fail(e: unknown): void { this.message.set({ ok: false, text: apiError(e) }); }
}
