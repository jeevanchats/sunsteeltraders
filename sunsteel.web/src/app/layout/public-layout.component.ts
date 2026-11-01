import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { CatalogService } from '../core/services/catalog.service';
import { RequestService } from '../core/services/request.service';
import { SiteService } from '../core/services/site.service';
import { BrandComponent } from '../shared/brand.component';
import { IconComponent } from '../shared/icon.component';
import { RequestDrawerComponent } from './request-drawer.component';

interface NavItem { label: string; link: string }

/**
 * v3 shell: ivory header (transparent over the home hero, solid on scroll), full-screen
 * mobile menu, navy footer with every silo and city page, the request drawer, and the
 * mobile Call / WhatsApp / Contact bar. Pages with a full-bleed hero set `data: { heroHeader: true }`.
 */
@Component({
  selector: 'ss-public-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandComponent, IconComponent, RequestDrawerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-layout.component.html',
  host: { '(window:scroll)': 'onScroll()' },
})
export class PublicLayoutComponent {
  protected readonly site = inject(SiteService);
  protected readonly catalog = inject(CatalogService);
  protected readonly req = inject(RequestService);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly scrolled = signal(false);
  protected readonly overHero = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();

  protected readonly nav: NavItem[] = [
    { label: 'Materials', link: '/products/' },
    { label: 'Weight Calculator', link: '/metal-weight-calculator/' },
    { label: 'Catalogue', link: '/catalogue-download/' },
    { label: 'About Us', link: '/about-us/' },
    { label: 'Contact', link: '/contact-us/' },
  ];

  constructor() {
    this.catalog.loadIndex().subscribe();
    this.readRouteData();
    const sub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.readRouteData();
      this.menuOpen.set(false);
      this.req.open.set(false);
      this.onScroll();
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  protected onScroll(): void {
    if (this.isBrowser) this.scrolled.set(window.scrollY > 40);
  }

  protected track(kind: 'wa' | 'call'): void {
    this.req.click(kind, this.router.url);
  }

  private readRouteData(): void {
    let r = this.router.routerState.snapshot.root;
    while (r.firstChild) r = r.firstChild;
    this.overHero.set(r.data?.['heroHeader'] === true);
  }
}
