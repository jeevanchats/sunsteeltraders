import { SITE_URL } from '../api.config';
import { Faq, Product } from '../models/catalog.model';

/**
 * JSON-LD builders (specification §3.2, §5.2). Deliberately conservative: no ratings,
 * reviews or prices are emitted unless they are real, because invented ones break Google's
 * structured-data policies (design doc §4).
 */
export function organizationLd(s: (k: string) => string): object {
  const sameAs = ['FacebookUrl', 'InstagramUrl', 'YouTubeUrl', 'LinkedInUrl'].map(s).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': ['Store', 'LocalBusiness'],
    '@id': `${SITE_URL}/#business`,
    name: s('BusinessName'),
    description: 'Multi-metal stockist: mild, alloy and stainless steel, non-ferrous metals, cast iron and engineering plastics, cut to size.',
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/brand/sst-logo-320.webp`,
    telephone: s('Phone1'),
    email: s('SalesEmail') || undefined,
    address: { '@type': 'PostalAddress', streetAddress: '57, Tamil Sangam Road, near Bell Hotel, Simmakkal', addressLocality: 'Madurai', postalCode: '625001', addressRegion: 'Tamil Nadu', addressCountry: 'IN' },
    geo: s('Latitude') ? { '@type': 'GeoCoordinates', latitude: +s('Latitude'), longitude: +s('Longitude') } : undefined,
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '09:00', closes: '19:30' }],
    areaServed: ['Madurai', 'Tirunelveli', 'Virudhunagar', 'Sivakasi', 'Kovilpatti', 'Tuticorin', 'Tamil Nadu'],
    taxID: s('Gstin') || undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
}

export function breadcrumbLd(items: [string, string][]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([path, name], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + path })),
  };
}

export function faqLd(faqs: Faq[]): object | null {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  };
}

export function productLd(p: Product): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku,
    mpn: p.grade,
    category: p.siloName,
    description: p.summary,
    url: SITE_URL + p.path,
    brand: { '@type': 'Brand', name: 'Sun Steel Traders' },
    additionalProperty: [
      ...p.equivalents.map((e) => ({ '@type': 'PropertyValue', name: 'Equivalent grade', value: e })),
      ...p.mechanical.map((m) => ({ '@type': 'PropertyValue', name: m.k, value: m.v })),
    ],
    // No Offer, rating or review: Google requires a real price for an Offer, and prices are
    // quoted per request. Add an Offer here once sales publishes real list prices.
  };
}

export const compact = (blocks: (object | null)[]): object[] => blocks.filter((b): b is object => !!b);
