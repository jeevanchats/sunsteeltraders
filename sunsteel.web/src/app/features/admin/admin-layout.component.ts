import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Perm } from '../../core/models/auth.model';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { SiteService } from '../../core/services/site.service';
import { IconComponent } from '../../shared/icon.component';

interface AdminNav {
  link: string;
  label: string;
  icon: string;
  perm?: string;
}

/** The menu is grouped by what staff are doing; a group with nothing the person may open is not shown. */
interface AdminGroup {
  title: string;
  items: AdminNav[];
}

const GROUPS: AdminGroup[] = [
  {
    title: 'Sales desk',
    items: [
      { link: '/admin', label: 'Dashboard', icon: 'dash' },
      { link: '/admin/leads', label: 'Requests', icon: 'inbox', perm: Perm.LeadManage },
      { link: '/admin/quotes', label: 'Quotations', icon: 'doc', perm: Perm.LeadManage },
      { link: '/admin/customers', label: 'Customers', icon: 'users', perm: Perm.LeadManage },
      { link: '/admin/quote-data', label: 'Quote data', icon: 'list', perm: Perm.LeadManage },
    ],
  },
  {
    title: 'Materials',
    items: [
      { link: '/admin/stock', label: 'Stock board', icon: 'box', perm: Perm.StockManage },
      { link: '/admin/products', label: 'Products', icon: 'list', perm: Perm.CatalogManage },
      { link: '/admin/media', label: 'Photographs', icon: 'image', perm: Perm.MediaManage },
    ],
  },
  {
    title: 'Website',
    items: [
      { link: '/admin/slides', label: 'Home slideshow', icon: 'image', perm: Perm.MediaManage },
      { link: '/admin/gallery', label: 'Home gallery', icon: 'image', perm: Perm.MediaManage },
      { link: '/admin/pages', label: 'Pages & content', icon: 'doc', perm: Perm.CmsManage },
      { link: '/admin/theme', label: 'Theme', icon: 'palette', perm: Perm.ThemeManage },
      { link: '/admin/settings', label: 'Site settings', icon: 'cog', perm: Perm.SettingsManage },
      { link: '/admin/email', label: 'Email alerts', icon: 'mail', perm: Perm.SettingsManage },
    ],
  },
  {
    title: 'Team',
    items: [{ link: '/admin/users', label: 'Staff users', icon: 'users', perm: Perm.UserManage }],
  },
];

/**
 * The admin shell: a grouped side menu (a drawer on phones) with a bar across the top on phones, the signed-in person's card, and the page.
 * Items the person's role cannot open are left out, and so are groups that end up empty.
 */
@Component({
  selector: 'ss-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm md:grid md:grid-cols-[272px_1fr]">
      <!-- phones: a bar across the top -->
      <header class="sticky top-0 z-30 flex items-center gap-3 bg-primary px-3 py-2.5 text-on-primary shadow-[0_2px_10px_rgb(0_0_0/.18)] md:hidden">
        <button type="button" class="grid h-11 w-11 place-items-center rounded-xl bg-white/10 active:bg-white/20" aria-label="Open menu" [attr.aria-expanded]="navOpen()" (click)="navOpen.set(true)">
          <ss-icon name="menu" [size]="22" />
        </button>
        <span class="grid h-10 w-10 flex-none place-items-center rounded-xl bg-white/95"><img src="/brand/sst-logo-160.webp" width="40" height="34" alt="" class="h-[26px] w-auto" /></span>
        <span class="min-w-0 flex-1 leading-tight">
          <b class="block truncate font-serif text-[18px] font-semibold">{{ site.businessName() }}</b>
          <small class="block text-[11px] font-semibold uppercase tracking-[.18em] opacity-70">Admin</small>
        </span>
        @if (newLeads() > 0) {
          <a routerLink="/admin/leads" class="grid h-9 min-w-9 place-items-center rounded-full bg-accent px-2.5 text-[13px] font-bold text-primary" [attr.aria-label]="newLeads() + ' new requests'">{{ newLeads() }}</a>
        }
      </header>

      <!-- the menu: fixed beside the page on a computer, a drawer on phones -->
      <aside class="nav-shell fixed left-0 top-0 z-50 flex h-dvh w-[min(304px,88vw)] flex-col text-on-primary transition-transform duration-300 ease-out md:sticky md:h-svh md:w-auto md:translate-x-0"
             [class.-translate-x-full]="!navOpen()" [class.shadow-2xl]="navOpen()" aria-label="Admin menu">
        <div class="flex items-center gap-3 px-5 pb-4 pt-6">
          <a routerLink="/admin" class="flex min-w-0 flex-1 items-center gap-3 leading-none" [attr.aria-label]="site.businessName() + ' admin home'">
            <span class="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white/95 shadow-md">
              <img src="/brand/sst-logo-160.webp" width="40" height="34" alt="" class="h-[30px] w-auto" />
            </span>
            <span class="min-w-0">
              <b class="block truncate font-serif text-[21px] font-semibold leading-[1.1]">{{ site.businessName() }}</b>
              <small class="mt-1 block text-[11px] font-semibold uppercase tracking-[.2em] text-accent">Admin console</small>
            </span>
          </a>
          <button type="button" class="grid h-10 w-10 flex-none place-items-center rounded-xl bg-white/10 hover:bg-white/20 md:hidden" aria-label="Close menu" (click)="navOpen.set(false)">
            <ss-icon name="x" [size]="20" />
          </button>
        </div>

        <nav class="nav-scroll flex-1 overflow-y-auto overscroll-contain px-3 pb-3" aria-label="Admin">
          @for (g of groups(); track g.title) {
            <p class="mb-1.5 mt-5 px-3 text-[11px] font-bold uppercase tracking-[.18em] text-on-primary/50">{{ g.title }}</p>
            <div class="grid gap-1">
              @for (item of g.items; track item.link) {
                <a [routerLink]="item.link" routerLinkActive="nav-on" [routerLinkActiveOptions]="{ exact: item.link === '/admin' }" class="nav-item group">
                  <span class="nav-ico"><ss-icon [name]="item.icon" [size]="18" /></span>
                  <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                  @if (item.link === '/admin/leads' && newLeads() > 0) {
                    <span class="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-[12px] font-bold text-primary">{{ newLeads() }}</span>
                  }
                </a>
              }
            </div>
          }
        </nav>

        <!-- who is signed in -->
        <div class="border-t border-white/10 bg-black/15 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <div class="mb-3 flex items-center gap-3">
            <span class="grid h-11 w-11 flex-none place-items-center rounded-full bg-accent text-[16px] font-bold text-primary" aria-hidden="true">{{ initials() }}</span>
            <span class="min-w-0 leading-tight">
              <b class="block truncate text-[15px] font-semibold">{{ auth.displayName() }}</b>
              <small class="block truncate text-[12.5px] text-on-primary/65">{{ role() }}</small>
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-[11.5px] font-semibold">
            <a routerLink="/admin/change-password" class="nav-mini"><ss-icon name="key" [size]="18" />Password</a>
            <a href="/" class="nav-mini"><ss-icon name="ext" [size]="18" />Website</a>
            <button type="button" (click)="signOut()" class="nav-mini nav-mini-out"><ss-icon name="out" [size]="18" />Sign out</button>
          </div>
        </div>
      </aside>
      @if (navOpen()) { <button type="button" class="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden" aria-label="Close menu" (click)="navOpen.set(false)"></button> }

      <main class="min-w-0 px-[clamp(16px,3vw,40px)] pb-16 pt-5 md:pt-7">
        <router-outlet />
      </main>
    </div>`,
  styles: `
    .nav-shell { background: linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 100%, #fff 0%) 0%, color-mix(in srgb, var(--color-primary) 84%, #000) 100%); }
    .nav-scroll { scrollbar-width: thin; scrollbar-color: rgb(255 255 255 / .25) transparent; }
    .nav-item {
      position: relative; display: flex; align-items: center; gap: 12px; min-height: 46px; padding: 5px 10px 5px 8px; border-radius: 14px;
      color: color-mix(in srgb, var(--color-on-primary, #fff) 82%, transparent); font-size: 15px; font-weight: 500; transition: background .15s, color .15s;
    }
    .nav-ico { display: grid; flex: none; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: rgb(255 255 255 / .09); transition: background .15s, color .15s; }
    .nav-item:hover { background: rgb(255 255 255 / .08); color: var(--color-on-primary, #fff); }
    .nav-item:hover .nav-ico { background: rgb(255 255 255 / .16); }
    .nav-item.nav-on { background: rgb(255 255 255 / .14); color: var(--color-on-primary, #fff); font-weight: 650; box-shadow: inset 0 0 0 1px rgb(255 255 255 / .08); }
    .nav-item.nav-on::before { content: ""; position: absolute; left: -12px; top: 9px; bottom: 9px; width: 4px; border-radius: 0 4px 4px 0; background: var(--color-accent); }
    .nav-item.nav-on .nav-ico { background: var(--color-accent); color: var(--color-primary); }
    .nav-mini { display: grid; justify-items: center; gap: 4px; padding: 10px 4px; border-radius: 12px; background: rgb(255 255 255 / .08); color: color-mix(in srgb, var(--color-on-primary, #fff) 85%, transparent); text-align: center; transition: background .15s; }
    .nav-mini:hover { background: rgb(255 255 255 / .16); color: var(--color-on-primary, #fff); }
    .nav-mini-out:hover { background: rgb(220 70 60 / .35); }
  `,
})
export class AdminLayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly site = inject(SiteService);
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);
  protected readonly navOpen = signal(false);
  /** Requests nobody has looked at yet, shown on the menu so the sales desk notices them. */
  protected readonly newLeads = signal(0);

  protected readonly groups = computed(() =>
    GROUPS.map((g) => ({ title: g.title, items: g.items.filter((n) => !n.perm || this.auth.can(n.perm)) })).filter((g) => g.items.length > 0));

  protected readonly initials = computed(() => {
    const parts = this.auth.displayName().split(/[\s@.]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[1][0] : '')).toUpperCase();
  });
  protected readonly role = computed(() => this.auth.currentUser()?.roles?.[0] ?? 'Staff');

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.navOpen.set(false);
      // The count changes when a request is opened or answered, so refresh it as staff move around.
      this.refreshCount();
    });
    this.refreshCount();
    // Pick up role changes made by another admin since this session started.
    this.auth.me().subscribe({ error: () => {} });
  }

  private refreshCount(): void {
    if (!this.auth.can(Perm.LeadManage)) return;
    this.api.dashboard().subscribe({ next: (d) => this.newLeads.set(d.newLeads), error: () => {} });
  }

  protected signOut(): void {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
