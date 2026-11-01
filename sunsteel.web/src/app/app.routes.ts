import { Routes } from '@angular/router';
import { Perm } from './core/models/auth.model';
import { adminGuard, guestGuard, permissionGuard, signedInGuard } from './core/guards/admin.guards';
import { cityMatcher, cityResolver, policyResolver, productResolver, siloResolver } from './core/routing/resolvers';
import { PublicLayoutComponent } from './layout/public-layout.component';

/**
 * Public URLs follow the specification exactly (§2.1, §2.2, §5.2), all with a trailing slash
 * (added by TrailingSlashUrlSerializer). Never change a slug: it is the page's ranking.
 * Unknown paths render a real 404.
 */
export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/public/home.component').then((m) => m.HomeComponent) },
      { path: 'products', pathMatch: 'full', loadComponent: () => import('./features/public/products.component').then((m) => m.ProductsComponent) },
      {
        path: 'products/:silo',
        pathMatch: 'full',
        resolve: { silo: siloResolver },
        loadComponent: () => import('./features/public/silo.component').then((m) => m.SiloComponent),
      },
      {
        path: 'products/:silo/:slug',
        resolve: { product: productResolver },
        loadComponent: () => import('./features/public/product.component').then((m) => m.ProductComponent),
      },
      { path: 'metal-weight-calculator', loadComponent: () => import('./features/public/calculator.component').then((m) => m.CalculatorComponent) },
      { path: 'catalogue-download', loadComponent: () => import('./features/public/catalogue.component').then((m) => m.CatalogueComponent) },
      { path: 'contact-us', loadComponent: () => import('./features/public/contact.component').then((m) => m.ContactComponent) },
      { path: 'about-us', loadComponent: () => import('./features/public/about.component').then((m) => m.AboutComponent) },
      {
        matcher: cityMatcher,
        resolve: { city: cityResolver },
        loadComponent: () => import('./features/public/city.component').then((m) => m.CityComponent),
      },
      {
        path: 'terms-conditions',
        data: { policy: 'terms-conditions' },
        resolve: { doc: policyResolver },
        loadComponent: () => import('./features/public/policy.component').then((m) => m.PolicyComponent),
      },
      {
        path: 'privacy-policy',
        data: { policy: 'privacy-policy' },
        resolve: { doc: policyResolver },
        loadComponent: () => import('./features/public/policy.component').then((m) => m.PolicyComponent),
      },
    ],
  },

  // ---------------- admin ----------------
  {
    path: 'admin/login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/admin/auth/admin-login.component').then((m) => m.AdminLoginComponent),
  },
  {
    path: 'admin/change-password',
    canActivate: [signedInGuard],
    loadComponent: () => import('./features/admin/auth/change-password.component').then((m) => m.ChangePasswordComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/admin/dashboard.component').then((m) => m.DashboardComponent) },
      {
        path: 'leads',
        canActivate: [permissionGuard(Perm.LeadManage)],
        loadComponent: () => import('./features/admin/leads/leads.component').then((m) => m.LeadsComponent),
      },
      {
        path: 'quotes',
        canActivate: [permissionGuard(Perm.LeadManage)],
        loadComponent: () => import('./features/admin/quotes/quotes.component').then((m) => m.QuotesComponent),
      },
      {
        path: 'customers',
        canActivate: [permissionGuard(Perm.LeadManage)],
        loadComponent: () => import('./features/admin/quotes/customers.component').then((m) => m.CustomersComponent),
      },
      {
        path: 'quote-data',
        canActivate: [permissionGuard(Perm.LeadManage)],
        loadComponent: () => import('./features/admin/quotes/quote-data.component').then((m) => m.QuoteDataComponent),
      },
      {
        path: 'quotes/:id',
        canActivate: [permissionGuard(Perm.LeadManage)],
        loadComponent: () => import('./features/admin/quotes/quote-edit.component').then((m) => m.QuoteEditComponent),
      },
      {
        path: 'stock',
        canActivate: [permissionGuard(Perm.StockManage)],
        loadComponent: () => import('./features/admin/stock/stock.component').then((m) => m.StockComponent),
      },
      {
        path: 'products',
        canActivate: [permissionGuard(Perm.CatalogManage)],
        loadComponent: () => import('./features/admin/products/products-admin.component').then((m) => m.ProductsAdminComponent),
      },
      {
        path: 'products/:id',
        canActivate: [permissionGuard(Perm.CatalogManage)],
        loadComponent: () => import('./features/admin/products/product-edit.component').then((m) => m.ProductEditComponent),
      },
      {
        path: 'pages',
        canActivate: [permissionGuard(Perm.CmsManage)],
        loadComponent: () => import('./features/admin/content/content-admin.component').then((m) => m.ContentAdminComponent),
      },
      {
        path: 'media',
        canActivate: [permissionGuard(Perm.MediaManage)],
        loadComponent: () => import('./features/admin/media/media.component').then((m) => m.MediaComponent),
      },
      {
        path: 'slides',
        canActivate: [permissionGuard(Perm.MediaManage)],
        loadComponent: () => import('./features/admin/slides/slides-admin.component').then((m) => m.SlidesAdminComponent),
      },
      {
        path: 'gallery',
        canActivate: [permissionGuard(Perm.MediaManage)],
        loadComponent: () => import('./features/admin/gallery/gallery-admin.component').then((m) => m.GalleryAdminComponent),
      },
      {
        path: 'theme',
        canActivate: [permissionGuard(Perm.ThemeManage)],
        loadComponent: () => import('./features/admin/theme/theme.component').then((m) => m.ThemeComponent),
      },
      {
        path: 'settings',
        canActivate: [permissionGuard(Perm.SettingsManage)],
        loadComponent: () => import('./features/admin/settings/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'users',
        canActivate: [permissionGuard(Perm.UserManage)],
        loadComponent: () => import('./features/admin/users/users.component').then((m) => m.UsersComponent),
      },
    ],
  },

  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '**', loadComponent: () => import('./features/public/not-found.component').then((m) => m.NotFoundComponent) },
    ],
  },
];
