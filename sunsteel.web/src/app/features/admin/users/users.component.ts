import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiError } from '../../../core/models/api.model';
import { AdminApiService, Role, StaffUser } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../../../shared/icon.component';

interface Draft {
  userId?: number;
  email: string;
  fullName: string;
  phoneNumber: string;
  roleId: number;
  isActive: boolean;
  allowGoogleSignIn: boolean;
  temporaryPassword: string;
}

/** Staff users: create, change role, disable, reset to a temporary password. */
@Component({
  selector: 'ss-users',
  imports: [FormsModule, DatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users.component.html',
})
export class UsersComponent {
  private readonly api = inject(AdminApiService);
  protected readonly auth = inject(AuthService);

  protected readonly users = signal<StaffUser[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  protected readonly draft = signal<Draft | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');
  protected readonly resetFor = signal<StaffUser | null>(null);
  protected resetPassword = '';

  protected readonly isNew = computed(() => !this.draft()?.userId);

  constructor() {
    this.reload();
    this.api.roles().subscribe({ next: (r) => this.roles.set(r), error: () => {} });
  }

  protected reload(): void {
    this.api.users().subscribe({
      next: (u) => {
        this.users.set(u);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(apiError(e));
      },
    });
  }

  protected add(): void {
    const frontDesk = this.roles().find((r) => r.name === 'Staff') ?? this.roles()[0];
    this.formError.set('');
    this.draft.set({ email: '', fullName: '', phoneNumber: '', roleId: frontDesk?.roleId ?? 0, isActive: true, allowGoogleSignIn: true, temporaryPassword: suggestPassword() });
  }

  protected edit(u: StaffUser): void {
    this.formError.set('');
    this.draft.set({ userId: u.userId, email: u.email, fullName: u.fullName ?? '', phoneNumber: u.phoneNumber ?? '', roleId: u.roleId ?? 0, isActive: u.isActive, allowGoogleSignIn: u.allowGoogleSignIn, temporaryPassword: '' });
  }

  protected patch(p: Partial<Draft>): void {
    this.draft.update((d) => (d ? { ...d, ...p } : d));
  }

  protected save(): void {
    const d = this.draft();
    if (!d) return;
    this.saving.set(true);
    this.formError.set('');
    const done = (msg: string) => ({
      next: () => {
        this.saving.set(false);
        this.draft.set(null);
        this.notice.set(msg);
        this.reload();
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.formError.set(apiError(e));
      },
    });
    if (d.userId) {
      this.api.updateUser(d.userId, { fullName: d.fullName, phoneNumber: d.phoneNumber, roleId: d.roleId, isActive: d.isActive, allowGoogleSignIn: d.allowGoogleSignIn })
        .subscribe(done(`Saved ${d.email}.`));
    } else {
      this.api.createUser({ email: d.email, fullName: d.fullName, phoneNumber: d.phoneNumber, roleId: d.roleId, temporaryPassword: d.temporaryPassword, allowGoogleSignIn: d.allowGoogleSignIn })
        .subscribe(done(`Created ${d.email}. Share the temporary password with them privately; they'll choose their own at first sign-in.`));
    }
  }

  protected openReset(u: StaffUser): void {
    this.resetPassword = suggestPassword();
    this.formError.set('');
    this.resetFor.set(u);
  }

  protected confirmReset(): void {
    const u = this.resetFor();
    if (!u) return;
    this.saving.set(true);
    this.api.resetPassword(u.userId, this.resetPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.resetFor.set(null);
        this.notice.set(`Temporary password set for ${u.email}. They're signed out everywhere.`);
        this.reload();
      },
      error: (e) => {
        this.saving.set(false);
        this.formError.set(apiError(e));
      },
    });
  }

  protected roleDescription(id: number): string {
    return this.roles().find((r) => r.roleId === id)?.description ?? '';
  }
}

/** Readable temporary password: two words-ish chunks plus digits, 12+ chars. */
function suggestPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return 'Ss-' + Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
