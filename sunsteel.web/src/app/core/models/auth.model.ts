export interface AuthUser {
  userId: number;
  email: string;
  fullName?: string | null;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAtUtc: string;
  user: AuthUser;
}

export interface AuthConfig {
  googleClientId?: string | null;
}

/** Permission codes — must match sunsteel.api Common/Security/Perm.cs and migration 003. */
export const Perm = {
  LeadManage: 'lead.manage',
  CatalogManage: 'catalog.manage',
  StockManage: 'stock.manage',
  MediaManage: 'media.manage',
  CmsManage: 'cms.manage',
  ThemeManage: 'theme.manage',
  SettingsManage: 'settings.manage',
  UserManage: 'user.manage',
  QuoteData: 'quote.data',
} as const;
