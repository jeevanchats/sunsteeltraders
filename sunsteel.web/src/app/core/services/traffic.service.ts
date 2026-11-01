import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { API_BASE_URL } from '../api.config';

/**
 * Counts public page views for the admin dashboard. No cookies and nothing stored in the browser; the server keeps only the
 * page, where the visitor came from and a one-way daily hash. Staff screens are never counted, and a browser that asks
 * not to be tracked (Do Not Track / Global Privacy Control) is left alone.
 */
@Injectable({ providedIn: 'root' })
export class TrafficService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private first = true;
  private last = '';

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return;
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => this.view(e.urlAfterRedirects));
  }

  private view(url: string): void {
    const path = url.split(/[?#]/)[0];
    if (path.startsWith('/admin') || path === this.last) return;
    this.last = path;
    // Only the first page of a visit has an outside referrer; later pages are our own navigation.
    const referrer = this.first ? document.referrer : '';
    this.first = false;
    this.http.post(`${API_BASE_URL}/events/view`, { path, referrer }).subscribe({ error: () => {} });
  }
}
