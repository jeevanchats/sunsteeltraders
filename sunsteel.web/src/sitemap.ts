/**
 * /sitemap.xml and /robots.txt, built by the SSR server from the public catalogue API so that
 * products, silos and city pages added in the admin appear without a deploy.
 */

const PAGES = [
  '/',
  '/products/',
  '/metal-weight-calculator/',
  '/catalogue-download/',
  '/about-us/',
  '/contact-us/',
  '/terms-conditions/',
  '/privacy-policy/',
];

const TTL_MS = 60 * 60 * 1000;
let cached: { xml: string; at: number } | null = null;

interface Envelope<T> {
  data: T;
}

async function getData<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return ((await res.json()) as Envelope<T>).data;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function build(apiBaseUrl: string, siteUrl: string): Promise<string> {
  const [index, products] = await Promise.all([
    getData<{ silos: { key: string }[]; cities: { path: string }[] }>(`${apiBaseUrl}/catalog`),
    getData<{ path: string }[]>(`${apiBaseUrl}/catalog/products`),
  ]);
  const paths = [
    ...PAGES,
    ...index.silos.map((s) => `/products/${s.key}/`),
    ...products.map((p) => p.path),
    ...index.cities.map((c) => c.path),
  ];
  const urls = [...new Set(paths)].map((p) => `  <url><loc>${esc(siteUrl + p)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** Cached for an hour; if the API is down, the last good copy is served rather than an empty sitemap. */
export async function sitemapXml(apiBaseUrl: string, siteUrl: string): Promise<string> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.xml;
  try {
    cached = { xml: await build(apiBaseUrl, siteUrl), at: Date.now() };
  } catch (e) {
    if (!cached) throw e;
    console.warn('[sitemap] rebuild failed, serving the previous copy:', e);
  }
  return cached.xml;
}

export function robotsTxt(siteUrl: string): string {
  return `User-agent: *\nDisallow: /admin/\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}
