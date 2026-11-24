import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { robotsTxt, sitemapXml } from './sitemap';

const browserDistFolder = join(import.meta.dirname, '../browser');

/**
 * Hostnames this server renders for. Angular rejects unknown hosts (SSRF guard), so the list
 * comes from SITE_URL + ALLOWED_HOSTS at runtime rather than angular.json, keeping one build
 * for every environment. Pattern from DailyCalendarShop.
 */
function allowedHosts(): string[] {
  const hosts = new Set(['localhost', '127.0.0.1']);
  for (const h of (process.env['ALLOWED_HOSTS'] ?? '').split(',')) if (h.trim()) hosts.add(h.trim());
  const site = process.env['SITE_URL'];
  if (site) {
    try {
      hosts.add(new URL(site).hostname);
    } catch {
      console.warn(`[ssr] SITE_URL is not a valid URL: "${site}"`);
    }
  }
  return [...hosts];
}

const app = express();
// trustProxyHeaders is safe only because this process binds to loopback behind Nginx.
const angularApp = new AngularNodeAppEngine({ allowedHosts: allowedHosts(), trustProxyHeaders: true });

// config.js differs per environment and is rewritten on deploy, so it must not be cached for a year
// like the hashed bundles. Registered before express.static so it wins.
app.get('/config.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(join(browserDistFolder, 'config.js'));
});

const siteUrl = (process.env['SITE_URL'] || 'http://localhost:4200').replace(/\/$/, '');
const apiBaseUrl = (process.env['API_BASE_URL'] || 'http://localhost:5090/api').replace(/\/$/, '');

app.get('/sitemap.xml', (_req, res) => {
  sitemapXml(apiBaseUrl, siteUrl)
    .then((xml) => res.type('application/xml').setHeader('Cache-Control', 'public, max-age=3600').send(xml))
    .catch((e) => {
      console.error('[sitemap]', e);
      res.status(503).setHeader('Retry-After', '600').send('Sitemap temporarily unavailable');
    });
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').setHeader('Cache-Control', 'public, max-age=3600').send(robotsTxt(siteUrl));
});

app.use(express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false }));

// Addresses from the earlier sites (WordPress 2018–22, then the 2024 site) that Google still lists.
// Each gets one permanent redirect straight to its new page, so no visitor lands on a 404 and the
// old listing's history moves to the new address. Found in the Wayback Machine; extend from Search
// Console's "Not found (404)" report. Keys are lowercase, without the trailing slash.
const LEGACY: Record<string, string> = {
  '/about': '/about-us/',
  '/contact': '/contact-us/',
  '/card': '/contact-us/',
  '/home': '/',
  '/members-area': '/',
  '/gallery': '/',
  '/bwg_gallery/coils': '/products/',
  '/bwg_gallery/products': '/products/',
  '/author/admin': '/about-us/',
  '/category/uncategorized': '/',
  '/feed': '/',
  '/comments/feed': '/',
};
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const [path, query] = req.originalUrl.split(/\?(.*)/s, 2);
  const key = path.toLowerCase().replace(/\/+$/, '');
  const to = LEGACY[key] ?? (key.startsWith('/members-area/') ? '/' : undefined)
    ?? (key === '' && /^p=\d+$/.test(query ?? '') ? '/' : undefined); // WordPress ?p=8 post links
  if (to) {
    res.redirect(301, to);
    return;
  }
  next();
});

// One URL per page: every public path in the specification ends with "/", so slash-less
// requests get a permanent redirect (query string kept). Files and the admin are left alone.
app.use((req, res, next) => {
  const [path, query] = req.originalUrl.split(/\?(.*)/s, 2);
  if ((req.method === 'GET' || req.method === 'HEAD') && path !== '/' && !path.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(path) && !path.startsWith('/admin')) {
    res.redirect(301, path + '/' + (query ? `?${query}` : ''));
    return;
  }
  next();
});

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
