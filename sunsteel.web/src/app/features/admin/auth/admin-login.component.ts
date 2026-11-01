import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, NgZone, PLATFORM_ID, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { apiError } from '../../../core/models/api.model';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';
import { SiteService } from '../../../core/services/site.service';
import { BrandComponent } from '../../../shared/brand.component';
import { loadGoogleIdentity, renderGoogleButton } from './google-sign-in';

@Component({
  selector: 'ss-admin-login',
  imports: [FormsModule, BrandComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-login.component.html',
})
export class AdminLoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);
  protected readonly site = inject(SiteService);
  /** Only the address and phone numbers are shown here; nothing about what the admin does. */
  protected readonly phones = computed(() => ['Phone1', 'Phone2', 'Landline'].map((k) => this.site.get(k)).filter(Boolean));

  private readonly googleHost = viewChild<ElementRef<HTMLElement>>('googleBtn');

  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly googleReady = signal(false);

  constructor() {
    inject(SeoService).set({ title: "Sign in | Sun Steel Traders admin", path: '/admin/login', noindex: true });
    if (isPlatformBrowser(inject(PLATFORM_ID))) this.setUpGoogle();
  }

  protected submit(): void {
    if (!this.email.trim() || !this.password) {
      this.error.set('Enter your email and password.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => this.afterSignIn(),
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiError(e, 'Sign-in failed. Please try again.'));
      },
    });
  }

  private setUpGoogle(): void {
    this.auth.getConfig().subscribe({
      next: async (cfg) => {
        if (!cfg.googleClientId) return;
        try {
          await loadGoogleIdentity();
          this.googleReady.set(true);
          // Wait a tick for the @if block holding the button host to render.
          setTimeout(() => {
            const el = this.googleHost()?.nativeElement;
            if (el) renderGoogleButton(el, cfg.googleClientId!, (token) => this.zone.run(() => this.google(token)));
          });
        } catch {
          /* script blocked: email sign-in still works */
        }
      },
      error: () => {},
    });
  }

  private google(idToken: string): void {
    this.busy.set(true);
    this.error.set('');
    this.auth.googleLogin(idToken).subscribe({
      next: () => this.afterSignIn(),
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiError(e, 'Google sign-in failed.'));
      },
    });
  }

  private afterSignIn(): void {
    if (this.auth.mustChangePassword()) {
      this.router.navigate(['/admin/change-password']);
      return;
    }
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.router.navigateByUrl(returnUrl?.startsWith('/admin') ? returnUrl : '/admin');
  }
}
