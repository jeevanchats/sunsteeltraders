import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Perm } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { BrandComponent } from '../../shared/brand.component';
import { IconComponent } from '../../shared/icon.component';

interface AdminNav {
  link: string;
  label: string;
  icon: string;
  perm?: string;
  /** Screens that arrive in later stages are listed (so staff see the plan) but disabled. */
  stage?: number;
}

@Component({
  selector: 'ss-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm md:grid md:grid-cols-[248px_1fr]">
      <aside class="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-primary px-4 py-6 text-on-primary transition-transform duration-300 md:sticky md:top-0 md:h-svh md:w-auto md:translate-x-0"
             [class.-translate-x-full]="!navOpen()">
        <div class="px-2 pb-7"><ss-brand link="/admin" [showPlace]="false" /></div>
        <nav class="grid gap-0.5" aria-label="Admin">
          @for (item of nav(); track item.link) {
            @if (item.stage) {
              <span class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-on-primary-muted/60" [title]="'Arrives in stage ' + item.stage">
                <ss-icon [name]="item.icon" [size]="18" />{{ item.label }}
                <span class="ml-auto text-[10px] uppercase tracking-wider opacity-70">Soon</span>
              </span>
            } @else {
              <a [routerLink]="item.link" routerLinkActive="!bg-accent !text-primary" [routerLinkActiveOptions]="{ exact: item.link === '/admin' }"
                 class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-on-primary-muted hover:bg-white/5 hover:text-on-primary">
                <ss-icon [name]="item.icon" [size]="18" />{{ item.label }}
              </a>
            }
          }
        </nav>
        <div class="mt-auto grid gap-0.5 border-t border-white/10 pt-4 text-sm">
          <span class="px-3 pb-2 text-xs text-on-primary-muted">Signed in as<br /><b class="font-medium text-on-primary">{{ auth.displayName() }}</b></span>
          <a routerLink="/admin/change-password" class="flex items-center gap-3 rounded-md px-3 py-2.5 text-on-primary-muted hover:bg-white/5 hover:text-on-primary"><ss-icon name="key" [size]="18" />Change password</a>
          <a href="/" class="flex items-center gap-3 rounded-md px-3 py-2.5 text-on-primary-muted hover:bg-white/5 hover:text-on-primary"><ss-icon name="ext" [size]="18" />View website</a>
          <button type="button" (click)="signOut()" class="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-on-primary-muted hover:bg-white/5 hover:text-on-primary"><ss-icon name="out" [size]="18" />Sign out</button>
        </div>
      </aside>
      @if (navOpen()) { <button type="button" class="fixed inset-0 z-40 bg-black/40 md:hidden" aria-label="Close menu" (click)="navOpen.set(false)"></button> }

      <main class="min-w-0 px-[clamp(16px,3vw,40px)] pb-16 pt-7">
        <div class="mb-4 flex items-center md:hidden">
          <button type="button" class="abtn" (click)="navOpen.set(true)"><ss-icon name="menu" [size]="16" />Menu</button>
        </div>
        <router-outlet />
      </main>
    </div>`,
})
export class AdminLayoutComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly navOpen = signal(false);

  private readonly all: AdminNav[] = [
    { link: '/admin', label: 'Dashboard', icon: 'dash' },
    { link: '/admin/leads', label: 'Requests', icon: 'inbox', perm: Perm.LeadManage },
    { link: '/admin/quotes', label: 'Quotations', icon: 'doc', perm: Perm.LeadManage },
    { link: '/admin/quote-data', label: 'Quote data', icon: 'list', perm: Perm.LeadManage },
    { link: '/admin/stock', label: 'Stock board', icon: 'box', perm: Perm.StockManage },
    { link: '/admin/products', label: 'Products', icon: 'list', perm: Perm.CatalogManage },
    { link: '/admin/media', label: 'Photographs', icon: 'image', perm: Perm.MediaManage },
    { link: '/admin/slides', label: 'Home slideshow', icon: 'image', perm: Perm.MediaManage },
    { link: '/admin/gallery', label: 'Home gallery', icon: 'image', perm: Perm.MediaManage },
    { link: '/admin/pages', label: 'Pages & content', icon: 'doc', perm: Perm.CmsManage },
    { link: '/admin/theme', label: 'Theme', icon: 'palette', perm: Perm.ThemeManage },
    { link: '/admin/settings', label: 'Site settings', icon: 'cog', perm: Perm.SettingsManage },
    { link: '/admin/users', label: 'Staff users', icon: 'users', perm: Perm.UserManage },
  ];

  protected readonly nav = computed(() => this.all.filter((n) => !n.perm || this.auth.can(n.perm)));

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.navOpen.set(false));
    // Pick up role changes made by another admin since this session started.
    this.auth.me().subscribe({ error: () => {} });
  }

  protected signOut(): void {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
