import { Form } from '../weight/weight';

/** Mirrors sunsteel.api Features/Catalog/CatalogDtos.cs (camelCase JSON). */
export interface Faq { question: string; answer: string }
export interface ChemistryRow { el: string; min?: string | null; max?: string | null }
export interface PropertyRow { k: string; v: string }

export interface SiloSummary {
  key: string; name: string; shortName: string; glyph: string; intro?: string | null; topGrades?: string | null;
  productCount: number; heroUrl?: string | null;
}

export interface ProductCard {
  slug: string; siloKey: string; name: string; grade: string; materialKey?: string | null; forms: Form[];
  sizeRange?: string | null; stockStatus: StockStatus; equivalents: string[]; heroUrl?: string | null; path: string;
}

export type StockStatus = 'In stock' | 'Limited' | 'On order';

export interface Product {
  slug: string; sku: string; siloKey: string; siloName: string; name: string; grade: string;
  materialKey?: string | null; materialName?: string | null; density?: number | null; forms: Form[];
  sizeRange?: string | null; applications?: string | null; summary: string; condition?: string | null; machinability?: string | null;
  chemistry: ChemistryRow[]; mechanical: PropertyRow[]; equivalents: string[];
  stockStatus: StockStatus; priceNote?: string | null; heroUrl?: string | null; metaTitle: string; metaDescription: string;
  faqs: Faq[]; related: ProductCard[]; path: string;
}

export interface Silo { silo: SiloSummary; metaTitle: string; metaDescription: string; products: ProductCard[]; faqs: Faq[] }
export interface Material { key: string; name: string; density: number }
export interface Section { designation: string; kind: 'beam' | 'channel'; kgPerMetre: number }
export interface LeadTime { city: string; leadTime: string }
export interface CityCard { slug: string; name: string; distanceKm: number; leadTime?: string | null; path: string }

/** One row of the MS pipe schedule (ASME B36.10M): outside diameter and wall for a nominal size at a schedule. */
export interface PipeSchedule { nominalSize: string; odMm: number; schedule: string; wallMm: number }

export interface CatalogIndex { silos: SiloSummary[]; materials: Material[]; sections: Section[]; leadTimes: LeadTime[]; cities: CityCard[]; msPipes?: PipeSchedule[] }

export interface SearchHit { slug: string; siloKey: string; name: string; grade: string; siloName: string; stockStatus: StockStatus; match?: string | null; path: string }

export interface City {
  slug: string; name: string; distanceKm: number; leadTime?: string | null; zones?: string | null; intro?: string | null;
  industries: string[]; popular: ProductCard[]; metaTitle: string; metaDescription: string;
}

export interface PageInfo { slug: string; title: string; metaTitle?: string | null; metaDescription?: string | null; faqs: Faq[] }
export interface Policy { slug: string; title: string; bodyHtml: string; updatedAt: string }

/** Which brushed-metal placeholder to show for a material until real photographs are uploaded. */
export function metalClass(materialKey?: string | null, siloKey?: string): string {
  const k = materialKey ?? '';
  if (k.startsWith('ss') || k === 'ph') return 'metal-ss';
  if (k === 'brass') return 'metal-brass';
  if (k === 'cu') return 'metal-copper';
  if (['gm', 'pb', 'ab', 'mnb'].includes(k)) return 'metal-bronze';
  if (k.startsWith('al')) return 'metal-alu';
  if (k === 'ci' || k === 'sg') return 'metal-ci';
  if (['ny', 'cny', 'pom', 'ptfe', 'pp', 'uhmw', 'bake', 'acr'].includes(k)) return 'metal-plastic';
  if (k === 'alloy' || k === 'hss') return 'metal-alloy';
  if (k === 'ms') return 'metal-steel';
  return siloKey === 'cutting-workshop-tools' ? 'metal-tools' : 'metal-steel';
}

export const SILO_METAL: Record<string, string> = {
  'mild-steel-structural': 'metal-steel',
  'alloy-engineering-steels': 'metal-alloy',
  'stainless-steel': 'metal-ss',
  'non-ferrous-metals': 'metal-brass',
  'cast-iron': 'metal-ci',
  'engineering-plastics': 'metal-plastic',
  'cutting-workshop-tools': 'metal-tools',
};

export const stockClass = (s: StockStatus) => (s === 'Limited' ? 'stock stock-limited' : s === 'On order' ? 'stock stock-order' : 'stock');
