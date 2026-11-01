import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { ApiResponse } from '../models/api.model';
import { GalleryPublic, SlideCard } from '../models/media.model';
import { CatalogIndex, City, PageInfo, Policy, Product, ProductCard, SearchHit, Silo } from '../models/catalog.model';

const EMPTY_INDEX: CatalogIndex = { silos: [], materials: [], sections: [], leadTimes: [], cities: [] };

/**
 * Public catalogue reads. GETs made during SSR are replayed in the browser by Angular's
 * HTTP transfer cache, so hydration doesn't refetch. The index (silos, densities, IS 808
 * sections) is loaded once and shared by the header, calculator and request basket.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}`;
  private index$?: Observable<CatalogIndex>;

  readonly index = signal<CatalogIndex>(EMPTY_INDEX);

  loadIndex(): Observable<CatalogIndex> {
    this.index$ ??= this.http.get<ApiResponse<CatalogIndex>>(`${this.base}/catalog`).pipe(
      map((r) => r.data ?? EMPTY_INDEX),
      catchError(() => of(EMPTY_INDEX)),
      tap((i) => this.index.set(i)),
      shareReplay(1),
    );
    return this.index$;
  }

  silo(key: string): Observable<Silo> {
    return this.http.get<ApiResponse<Silo>>(`${this.base}/catalog/silos/${encodeURIComponent(key)}`).pipe(map((r) => r.data!));
  }

  products(): Observable<ProductCard[]> {
    return this.http.get<ApiResponse<ProductCard[]>>(`${this.base}/catalog/products`).pipe(map((r) => r.data ?? []), catchError(() => of([])));
  }

  product(siloKey: string, slug: string): Observable<Product> {
    return this.http.get<ApiResponse<Product>>(`${this.base}/catalog/products/${encodeURIComponent(siloKey)}/${encodeURIComponent(slug)}`).pipe(map((r) => r.data!));
  }

  search(q: string, limit = 8): Observable<SearchHit[]> {
    return this.http.get<ApiResponse<SearchHit[]>>(`${this.base}/catalog/search`, { params: { q, limit } }).pipe(
      map((r) => r.data ?? []),
      catchError(() => of([])),
    );
  }

  city(slug: string): Observable<City> {
    return this.http.get<ApiResponse<City>>(`${this.base}/catalog/cities/${encodeURIComponent(slug)}`).pipe(map((r) => r.data!));
  }

  /** Visible home-page slides; empty (or null on error) means the site shows its built-in banners. */
  slides(): Observable<SlideCard[] | null> {
    return this.http.get<ApiResponse<SlideCard[]>>(`${this.base}/slides`).pipe(map((r) => r.data ?? null), catchError(() => of(null)));
  }

  gallery(): Observable<GalleryPublic | null> {
    return this.http.get<ApiResponse<GalleryPublic>>(`${this.base}/gallery`).pipe(map((r) => r.data ?? null), catchError(() => of(null)));
  }

  page(slug: string): Observable<PageInfo | null> {
    return this.http.get<ApiResponse<PageInfo>>(`${this.base}/pages/${slug}`).pipe(map((r) => r.data ?? null), catchError(() => of(null)));
  }

  policy(slug: string): Observable<Policy> {
    return this.http.get<ApiResponse<Policy>>(`${this.base}/policies/${slug}`).pipe(map((r) => r.data!));
  }

  density(materialKey?: string | null): number {
    return this.index().materials.find((m) => m.key === materialKey)?.density ?? 7.85;
  }
}
