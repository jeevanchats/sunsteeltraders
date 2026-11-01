import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Perm } from '../../core/models/auth.model';
import { AdminApiService, Dashboard } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { TrafficComponent } from './traffic.component';

@Component({
  selector: 'ss-dashboard',
  imports: [RouterLink, DatePipe, DecimalPipe, TrafficComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6">
      <h1 class="text-[22px] font-medium">Welcome, {{ auth.displayName() }}</h1>
      <p class="mt-0.5 text-[13.5px] text-[#6B7485]">{{ auth.currentUser()?.roles?.join(', ') }}</p>
    </header>

    @if (d(); as d) {
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <a routerLink="/admin/leads" class="card hover:border-accent"><span class="text-[12.5px] text-[#6B7485]">New requests</span><b class="mt-1 block text-[30px] font-medium">{{ d.newLeads }}</b></a>
        <div class="card"><span class="text-[12.5px] text-[#6B7485]">Requests this week</span><b class="mt-1 block text-[30px] font-medium">{{ d.leadsThisWeek }}</b><small class="text-[#8A93A3]">{{ d.kgRequestedThisWeek | number: '1.0-0' }} kg asked for</small></div>
        <div class="card"><span class="text-[12.5px] text-[#6B7485]">WhatsApp / call clicks (7 days)</span><b class="mt-1 block text-[30px] font-medium">{{ d.whatsAppClicks7d }} / {{ d.callClicks7d }}</b></div>
        <a routerLink="/admin/stock" class="card hover:border-accent"><span class="text-[12.5px] text-[#6B7485]">Limited or on order</span><b class="mt-1 block text-[30px] font-medium">{{ d.limitedOrOnOrder }}</b><small class="text-[#8A93A3]">SKUs</small></a>
      </div>
      <div class="card mt-4 overflow-x-auto !p-0">
        <div class="px-5 pt-4"><b class="font-medium">Latest requests</b></div>
        <table class="tbl mt-2">
          <thead><tr><th>Reference</th><th>Customer</th><th>Status</th><th class="text-right">kg</th><th>Received</th></tr></thead>
          <tbody>
            @for (r of d.recent; track r.leadId) {
              <tr><td>{{ r.reference }}</td><td>{{ r.name }}<small class="block text-[#8A93A3]">{{ r.city }}</small></td><td><span class="pill" [class.pill-warn]="r.status === 'New'">{{ r.status }}</span></td>
                <td class="text-right">{{ r.totalKg ? (r.totalKg | number: '1.0-1') : '—' }}</td><td class="text-[#6B7485]">{{ r.createdAt | date: 'd MMM, HH:mm' }}</td></tr>
            } @empty { <tr><td colspan="5" class="py-8 text-center text-[#8A93A3]">No requests yet.</td></tr> }
          </tbody>
        </table>
      </div>
    }

    <ss-traffic />

    <div class="mt-4 grid gap-4 md:grid-cols-3">
      @if (auth.can(perm.ThemeManage)) {
        <a routerLink="/admin/theme" class="card hover:border-accent"><b class="font-medium">Theme</b><p class="mt-1 text-[13px] text-[#6B7485]">Change the three website colours.</p></a>
      }
      @if (auth.can(perm.SettingsManage)) {
        <a routerLink="/admin/settings" class="card hover:border-accent"><b class="font-medium">Site settings</b><p class="mt-1 text-[13px] text-[#6B7485]">Phones, WhatsApp, address, GSTIN and catalogue link.</p></a>
      }
      @if (auth.can(perm.UserManage)) {
        <a routerLink="/admin/users" class="card hover:border-accent"><b class="font-medium">Staff users</b><p class="mt-1 text-[13px] text-[#6B7485]">Who can sign in, and what they can change.</p></a>
      }
    </div>`,
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
  protected readonly perm = Perm;
  protected readonly d = signal<Dashboard | null>(null);

  constructor() {
    inject(AdminApiService).dashboard().subscribe({ next: (d) => this.d.set(d), error: () => {} });
  }
}
