import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { ApiResponse } from '../models/api.model';
import { MediaItem } from '../models/media.model';
import { Theme } from '../models/site.model';
import { HsnRef, MaterialRef, MsPipeRef, SectionRef } from '../quote/quote-lines';
import { ItemType, QuoteTotals } from '../quote/quote-math';
import { QuoteType } from '../quote/quote-types';

export interface StaffUser {
  userId: number;
  email: string;
  fullName?: string | null;
  phoneNumber?: string | null;
  roleId?: number | null;
  roleName?: string | null;
  isActive: boolean;
  allowGoogleSignIn: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface Role {
  roleId: number;
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface LeadRow {
  leadId: number; reference: string; type: string; status: string; channel: string; name: string; company?: string | null;
  phone: string; city?: string | null; itemCount: number; totalKg?: number | null; fileCount: number; createdAt: string;
}
export interface LeadItem { gradeText: string; form: string; dimsText: string; lengthMm?: number | null; quantity: number; kg?: number | null; cutToSize: boolean }
export interface LeadDetail extends Omit<LeadRow, 'itemCount' | 'fileCount'> {
  gstin?: string | null; email?: string | null; industry?: string | null; message?: string | null; callbackAt?: string | null; sourcePage?: string | null;
  items: LeadItem[]; files: { leadFileId: number; fileName: string; contentType: string; sizeBytes: number }[];
  notes: { leadNoteId: number; note: string; by?: string | null; createdAt: string }[];
}
/** One quotation line as saved. Calculated lines send material, shape, size and length; the server works out weight. */
export interface QuoteItemInput {
  itemType: ItemType; brand: string | null; description: string | null; size: string | null; model: string | null;
  quantity: number; unit: string; hsn: string | null; gstCategory: 'Raw' | 'Finished'; gstRate: number | null; remarks: string | null;
  materialKey: string | null; form: string | null; dims: Record<string, number>; section: string | null; schedule: string | null; lengthMm: number;
  weightPerUnit: number; ratePerKg: number; unitPrice: number | null;
}
export interface QuoteItemDto extends QuoteItemInput {
  description: string; kg: number; pieceKg: number | null; kgPerMetre: number | null; amount: number | null;
}
export interface QuoteDefaults { validDays: number; gstRaw: number | null; gstFinished: number | null; weightDecimals: number; terms: string | null; paymentTerms: string | null; bankDetails: string | null }
export interface QuoteProduct {
  id: number; itemType: 'ManualWeight' | 'ManualUnit'; gstCategory: 'Raw' | 'Finished'; brand: string | null; description: string; size: string | null;
  model: string | null; unit: string; weightPerUnit: number | null; hsn: string | null; gstRate: number | null; referenceRate: number | null; isActive: boolean;
}
export interface QuoteLookups {
  materials: MaterialRef[]; sections: SectionRef[]; msPipes: MsPipeRef[]; hsn: HsnRef[]; products: QuoteProduct[]; defaults: QuoteDefaults;
}
export interface QuoteSettings { gstRaw: number | null; gstFinished: number | null; validDays: number; weightDecimals: number; paymentTerms: string | null; bankDetails: string | null; terms: string | null; branchAddress: string | null }
export interface Customer { id: number; name: string; company: string | null; gstin: string | null; phone: string; email: string | null; city: string | null; address: string | null; notes: string | null; quotes: number; createdAt: string }
export type SaveCustomer = Omit<Customer, 'id' | 'quotes' | 'createdAt'>;
export interface CustomerImportResult { created: number; updated: number; skipped: number; errors: string[] }
export interface QuoteRow { quoteId: number; reference: string; status: string; quoteType: string; customerName: string; company: string | null; phone: string; itemCount: number; grandTotal: number; quoteDate: string; leadReference: string | null }
export interface SaveQuote {
  quoteType: QuoteType | '';
  customerName: string; company: string | null; gstin: string | null; phone: string; email: string | null; city: string | null; address: string | null;
  buyerRef: string | null; dispatchedThrough: string | null;
  quoteDate: string | null; validDays: number;
  cuttingCharge: number; loadingCharge: number; unloadingCharge: number; transportCharge: number; discount: number;
  gstRate: number; interState: boolean; notes: string | null; paymentTerms: string | null; bankDetails: string | null; terms: string | null; items: QuoteItemInput[];
}
export interface QuoteDetail extends Omit<SaveQuote, 'items'> {
  items: QuoteItemDto[]; quoteId: number; reference: string; status: string; leadId: number | null; leadReference: string | null; validUntil: string;
  totals: QuoteTotals; whatsAppUrl: string; createdAt: string;
}
export interface Paged<T> { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number }
export interface ProductRow { productId: number; slug: string; sku: string; siloKey: string; name: string; grade: string; stockStatus: string; priceNote?: string | null; isPublished: boolean; updatedAt?: string | null }
export interface Dashboard {
  newLeads: number; leadsThisWeek: number; quotedOpen: number; kgRequestedThisWeek: number; whatsAppClicks7d: number; callClicks7d: number;
  limitedOrOnOrder: number; recent: { leadId: number; reference: string; type: string; status: string; name: string; city?: string | null; totalKg?: number | null; createdAt: string }[];
}

export interface Traffic {
  from: string; to: string; totals: { views: number; visits: number }; previous: { views: number; visits: number };
  daily: { date: string; views: number; visits: number }[];
  topPages: { name: string; count: number }[]; sources: { name: string; count: number }[];
  referrers: { name: string; count: number }[]; devices: { name: string; count: number }[];
}

export interface GallerySettings { show: boolean; kicker: string; heading: string; speed: number }
export interface GalleryItemAdmin { id: number; mediaId: number; media: MediaItem | null; title: string | null; caption: string | null; linkUrl: string | null; visible: boolean }
export interface SaveGalleryItem { id?: number; mediaId: number; title: string; caption: string; linkUrl: string; visible: boolean }
export interface SlideAdmin { id: number; mediaId: number; media: MediaItem | null; title: string | null; caption: string | null; ctaText: string | null; linkUrl: string | null; visible: boolean }
export interface SaveSlide { id?: number; mediaId: number; title: string; caption: string; ctaText: string; linkUrl: string; visible: boolean }
export interface GalleryAdmin { settings: GallerySettings; items: GalleryItemAdmin[] }

export interface ProductFull {
  slug: string; sku: string; siloKey: string; siloName: string; name: string; grade: string;
  materialKey: string | null; materialName: string | null; density: number | null; forms: string[];
  sizeRange: string | null; applications: string | null; summary: string; condition: string | null; machinability: string | null;
  chemistry: { el: string; min: string | null; max: string | null }[]; mechanical: { k: string; v: string }[]; equivalents: string[];
  stockStatus: string; priceNote: string | null; heroUrl: string | null; metaTitle: string; metaDescription: string;
  heroMediaId: number | null; isPublished: boolean;
}
export interface SaveProduct {
  name: string; sizeRange: string | null; applications: string | null; summary: string | null; condition: string | null; machinability: string | null;
  chemistry: { el: string; min: string | null; max: string | null }[]; mechanical: { k: string; v: string }[]; equivalents: string[];
  stockStatus: string; priceNote: string | null; metaTitle: string | null; metaDescription: string | null; isPublished: boolean; heroMediaId: number | null;
}
export interface AdminPage { id: number; slug: string; title: string; metaTitle: string | null; metaDescription: string | null }
export interface AdminFaq { question: string; answer: string; visible: boolean }
export interface AdminPolicy { slug: string; title: string; bodyHtml: string; updatedAt: string }
export interface AdminSilo { id: number; key: string; name: string; intro: string | null; topGrades: string | null; metaTitle: string | null; metaDescription: string | null; heroMediaId: number | null; heroUrl: string | null }
export interface AdminCity { id: number; slug: string; name: string; leadTime: string | null; zones: string | null; intro: string | null; industries: string[]; metaTitle: string | null; metaDescription: string | null; isPublished: boolean }

/** Admin endpoints: settings, theme, staff users, leads, stock, dashboard. */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin`;

  getSettings(): Observable<Record<string, string | null>> {
    return this.http.get<ApiResponse<Record<string, string | null>>>(`${this.base}/settings`).pipe(map((r) => r.data!));
  }

  saveSettings(settings: Record<string, string | null>): Observable<Record<string, string | null>> {
    return this.http.put<ApiResponse<Record<string, string | null>>>(`${this.base}/settings`, { settings }).pipe(map((r) => r.data!));
  }

  saveTheme(theme: Theme): Observable<Theme> {
    return this.http.put<ApiResponse<Theme>>(`${this.base}/theme`, theme).pipe(map((r) => r.data!));
  }

  users(): Observable<StaffUser[]> {
    return this.http.get<ApiResponse<StaffUser[]>>(`${this.base}/users`).pipe(map((r) => r.data ?? []));
  }

  roles(): Observable<Role[]> {
    return this.http.get<ApiResponse<Role[]>>(`${this.base}/roles`).pipe(map((r) => r.data ?? []));
  }

  createUser(body: { email: string; fullName: string; phoneNumber: string; roleId: number; temporaryPassword: string; allowGoogleSignIn: boolean }): Observable<StaffUser> {
    return this.http.post<ApiResponse<StaffUser>>(`${this.base}/users`, body).pipe(map((r) => r.data!));
  }

  updateUser(id: number, body: { fullName: string; phoneNumber: string; roleId: number; isActive: boolean; allowGoogleSignIn: boolean }): Observable<StaffUser> {
    return this.http.put<ApiResponse<StaffUser>>(`${this.base}/users/${id}`, body).pipe(map((r) => r.data!));
  }

  traffic(from: string, to: string): Observable<Traffic> {
    return this.http.get<ApiResponse<Traffic>>(`${this.base}/analytics`, { params: { from, to } }).pipe(map((r) => r.data!));
  }

  dashboard(): Observable<Dashboard> {
    return this.http.get<ApiResponse<Dashboard>>(`${this.base}/dashboard`).pipe(map((r) => r.data!));
  }

  leads(q: { type?: string; status?: string; q?: string; page?: number }): Observable<Paged<LeadRow>> {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params[k] = String(v);
    return this.http.get<ApiResponse<Paged<LeadRow>>>(`${this.base}/leads`, { params }).pipe(map((r) => r.data!));
  }

  lead(id: number): Observable<LeadDetail> {
    return this.http.get<ApiResponse<LeadDetail>>(`${this.base}/leads/${id}`).pipe(map((r) => r.data!));
  }

  setLeadStatus(id: number, status: string): Observable<LeadDetail> {
    return this.http.put<ApiResponse<LeadDetail>>(`${this.base}/leads/${id}/status`, { status }).pipe(map((r) => r.data!));
  }

  addLeadNote(id: number, note: string): Observable<LeadDetail> {
    return this.http.post<ApiResponse<LeadDetail>>(`${this.base}/leads/${id}/notes`, { note }).pipe(map((r) => r.data!));
  }

  leadFile(fileId: number): Observable<Blob> {
    return this.http.get(`${this.base}/lead-files/${fileId}`, { responseType: 'blob' });
  }

  quotes(q: { status?: string; type?: string; q?: string; page?: number }): Observable<Paged<QuoteRow>> {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params[k] = String(v);
    return this.http.get<ApiResponse<Paged<QuoteRow>>>(`${this.base}/quotes`, { params }).pipe(map((r) => r.data!));
  }

  quote(id: number): Observable<QuoteDetail> {
    return this.http.get<ApiResponse<QuoteDetail>>(`${this.base}/quotes/${id}`).pipe(map((r) => r.data!));
  }

  quoteLookups(): Observable<QuoteLookups> {
    return this.http.get<ApiResponse<QuoteLookups>>(`${this.base}/quotes/lookups`).pipe(map((r) => r.data!));
  }

  quoteProducts(q?: string): Observable<QuoteProduct[]> {
    return this.http.get<ApiResponse<QuoteProduct[]>>(`${this.base}/quotes/data/products`, { params: q ? { q } : {} }).pipe(map((r) => r.data ?? []));
  }

  saveQuoteProduct(p: QuoteProduct): Observable<QuoteProduct> {
    const url = `${this.base}/quotes/data/products`;
    return (p.id ? this.http.put<ApiResponse<QuoteProduct>>(`${url}/${p.id}`, p) : this.http.post<ApiResponse<QuoteProduct>>(url, p)).pipe(map((r) => r.data!));
  }

  deleteQuoteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/quotes/data/products/${id}`);
  }

  quoteHsn(): Observable<HsnRef[]> {
    return this.http.get<ApiResponse<HsnRef[]>>(`${this.base}/quotes/data/hsn`).pipe(map((r) => r.data ?? []));
  }

  saveQuoteHsn(rows: HsnRef[]): Observable<HsnRef[]> {
    return this.http.put<ApiResponse<HsnRef[]>>(`${this.base}/quotes/data/hsn`, rows).pipe(map((r) => r.data ?? []));
  }

  quotePipes(): Observable<MsPipeRef[]> {
    return this.http.get<ApiResponse<MsPipeRef[]>>(`${this.base}/quotes/data/pipes`).pipe(map((r) => r.data ?? []));
  }

  saveQuotePipes(rows: MsPipeRef[]): Observable<MsPipeRef[]> {
    return this.http.put<ApiResponse<MsPipeRef[]>>(`${this.base}/quotes/data/pipes`, rows).pipe(map((r) => r.data ?? []));
  }

  quoteSettings(): Observable<QuoteSettings> {
    return this.http.get<ApiResponse<QuoteSettings>>(`${this.base}/quotes/data/settings`).pipe(map((r) => r.data!));
  }

  saveQuoteSettings(s: QuoteSettings): Observable<QuoteSettings> {
    return this.http.put<ApiResponse<QuoteSettings>>(`${this.base}/quotes/data/settings`, s).pipe(map((r) => r.data!));
  }

  createQuote(body: SaveQuote): Observable<QuoteDetail> {
    return this.http.post<ApiResponse<QuoteDetail>>(`${this.base}/quotes`, body).pipe(map((r) => r.data!));
  }

  quoteFromLead(leadId: number): Observable<QuoteDetail> {
    return this.http.post<ApiResponse<QuoteDetail>>(`${this.base}/quotes/from-lead/${leadId}`, {}).pipe(map((r) => r.data!));
  }

  updateQuote(id: number, body: SaveQuote): Observable<QuoteDetail> {
    return this.http.put<ApiResponse<QuoteDetail>>(`${this.base}/quotes/${id}`, body).pipe(map((r) => r.data!));
  }

  setQuoteStatus(id: number, status: string): Observable<QuoteDetail> {
    return this.http.put<ApiResponse<QuoteDetail>>(`${this.base}/quotes/${id}/status`, { status }).pipe(map((r) => r.data!));
  }

  customers(q: { q?: string; page?: number }): Observable<Paged<Customer>> {
    const params: Record<string, string> = {};
    if (q.q) params['q'] = q.q;
    if (q.page) params['page'] = String(q.page);
    return this.http.get<ApiResponse<Paged<Customer>>>(`${this.base}/customers`, { params }).pipe(map((r) => r.data!));
  }

  searchCustomers(q: string): Observable<Customer[]> {
    return this.http.get<ApiResponse<Customer[]>>(`${this.base}/customers/search`, { params: { q } }).pipe(map((r) => r.data ?? []));
  }

  saveCustomer(id: number | null, c: SaveCustomer): Observable<Customer> {
    const url = `${this.base}/customers`;
    return (id ? this.http.put<ApiResponse<Customer>>(`${url}/${id}`, c) : this.http.post<ApiResponse<Customer>>(url, c)).pipe(map((r) => r.data!));
  }

  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/customers/${id}`);
  }

  exportCustomers(): Observable<Blob> {
    return this.http.get(`${this.base}/customers/export`, { responseType: 'blob' });
  }

  importCustomers(file: File): Observable<CustomerImportResult> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<ApiResponse<CustomerImportResult>>(`${this.base}/customers/import`, body).pipe(map((r) => r.data!));
  }

  quotePdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/quotes/${id}/pdf`, { responseType: 'blob' });
  }

  products(silo?: string, q?: string): Observable<Paged<ProductRow>> {
    const params: Record<string, string> = { pageSize: '100' };
    if (silo) params['silo'] = silo;
    if (q) params['q'] = q;
    return this.http.get<ApiResponse<Paged<ProductRow>>>(`${this.base}/products`, { params }).pipe(map((r) => r.data!));
  }

  setStock(id: number, stockStatus: string): Observable<void> {
    return this.http.put(`${this.base}/products/${id}/stock`, { stockStatus }).pipe(map(() => void 0));
  }

  resetPassword(id: number, temporaryPassword: string): Observable<void> {
    return this.http.post(`${this.base}/users/${id}/reset-password`, { temporaryPassword }).pipe(map(() => void 0));
  }

  // --- media library ---

  mediaList(p: { kind?: string; category?: string; q?: string; page?: number; pageSize?: number }): Observable<{ items: MediaItem[]; totalCount: number; page: number; pageSize: number }> {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') params[k] = String(v);
    return this.http.get<ApiResponse<{ items: MediaItem[]; totalCount: number; page: number; pageSize: number }>>(`${this.base}/media`, { params }).pipe(map((r) => r.data!));
  }

  mediaCategories(): Observable<string[]> {
    return this.http.get<ApiResponse<string[]>>(`${this.base}/media/categories`).pipe(map((r) => r.data ?? []));
  }

  /** Photos go through the WebP pipeline; MP4/WebM videos are stored as uploaded. */
  uploadMedia(file: File, opts: { category?: string; altText?: string } = {}): Observable<MediaItem> {
    const body = new FormData();
    body.append('file', file);
    if (opts.category) body.append('category', opts.category);
    if (opts.altText) body.append('altText', opts.altText);
    const path = file.type.startsWith('video/') ? 'media/video' : 'media';
    return this.http.post<ApiResponse<MediaItem>>(`${this.base}/${path}`, body).pipe(map((r) => r.data!));
  }

  updateMedia(id: number, body: { altText: string; caption: string; category: string }): Observable<MediaItem> {
    return this.http.put<ApiResponse<MediaItem>>(`${this.base}/media/${id}`, body).pipe(map((r) => r.data!));
  }

  deleteMedia(id: number): Observable<void> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/media/${id}`).pipe(map(() => void 0));
  }

  // --- home slideshow ---

  slides(): Observable<SlideAdmin[]> {
    return this.http.get<ApiResponse<SlideAdmin[]>>(`${this.base}/slides`).pipe(map((r) => r.data!));
  }

  saveSlides(items: SaveSlide[]): Observable<SlideAdmin[]> {
    return this.http.put<ApiResponse<SlideAdmin[]>>(`${this.base}/slides`, { items }).pipe(map((r) => r.data!));
  }

  // --- home gallery ---

  gallery(): Observable<GalleryAdmin> {
    return this.http.get<ApiResponse<GalleryAdmin>>(`${this.base}/gallery`).pipe(map((r) => r.data!));
  }

  saveGallery(settings: GallerySettings, items: SaveGalleryItem[]): Observable<GalleryAdmin> {
    return this.http.put<ApiResponse<GalleryAdmin>>(`${this.base}/gallery`, { settings, items }).pipe(map((r) => r.data!));
  }

  // --- product editor ---

  product(id: number): Observable<ProductFull> {
    return this.http.get<ApiResponse<ProductFull>>(`${this.base}/products/${id}`).pipe(map((r) => r.data!));
  }

  saveProduct(id: number, body: SaveProduct): Observable<ProductFull> {
    return this.http.put<ApiResponse<ProductFull>>(`${this.base}/products/${id}`, body).pipe(map((r) => r.data!));
  }

  // --- pages & content ---

  pages(): Observable<AdminPage[]> {
    return this.http.get<ApiResponse<AdminPage[]>>(`${this.base}/pages`).pipe(map((r) => r.data ?? []));
  }

  savePage(id: number, body: { metaTitle: string | null; metaDescription: string | null }): Observable<AdminPage> {
    return this.http.put<ApiResponse<AdminPage>>(`${this.base}/pages/${id}`, body).pipe(map((r) => r.data!));
  }

  faqs(scope: string, key: string): Observable<AdminFaq[]> {
    return this.http.get<ApiResponse<AdminFaq[]>>(`${this.base}/faqs`, { params: { scope, key } }).pipe(map((r) => r.data ?? []));
  }

  saveFaqs(scope: string, key: string, items: AdminFaq[]): Observable<AdminFaq[]> {
    return this.http.put<ApiResponse<AdminFaq[]>>(`${this.base}/faqs`, items, { params: { scope, key } }).pipe(map((r) => r.data ?? []));
  }

  policies(): Observable<AdminPolicy[]> {
    return this.http.get<ApiResponse<AdminPolicy[]>>(`${this.base}/policies`).pipe(map((r) => r.data ?? []));
  }

  savePolicy(slug: string, body: { title: string; bodyHtml: string }): Observable<AdminPolicy> {
    return this.http.put<ApiResponse<AdminPolicy>>(`${this.base}/policies/${slug}`, body).pipe(map((r) => r.data!));
  }

  silos(): Observable<AdminSilo[]> {
    return this.http.get<ApiResponse<AdminSilo[]>>(`${this.base}/silos`).pipe(map((r) => r.data ?? []));
  }

  saveSilo(id: number, body: Omit<AdminSilo, 'id' | 'key' | 'name' | 'heroUrl'>): Observable<AdminSilo> {
    return this.http.put<ApiResponse<AdminSilo>>(`${this.base}/silos/${id}`, body).pipe(map((r) => r.data!));
  }

  cities(): Observable<AdminCity[]> {
    return this.http.get<ApiResponse<AdminCity[]>>(`${this.base}/cities`).pipe(map((r) => r.data ?? []));
  }

  saveCity(id: number, body: Omit<AdminCity, 'id' | 'slug' | 'name'>): Observable<AdminCity> {
    return this.http.put<ApiResponse<AdminCity>>(`${this.base}/cities/${id}`, body).pipe(map((r) => r.data!));
  }
}
