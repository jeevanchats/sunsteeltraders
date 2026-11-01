/**
 * Runtime configuration, resolved once and synchronously at module load (pattern from
 * DailyCalendarShop):
 *   Browser — window.__APP_CONFIG__, set by /config.js before the bundle runs.
 *   SSR     — process.env (API_BASE_URL, SITE_URL).
 *   Neither — localhost defaults for `ng serve`.
 */
export interface RuntimeConfig {
  apiBaseUrl?: string;
  siteUrl?: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfig;
  }
}

function readConfig(): RuntimeConfig {
  if (typeof window !== 'undefined' && window.__APP_CONFIG__) return window.__APP_CONFIG__;
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (proc?.env) return { apiBaseUrl: proc.env['API_BASE_URL'], siteUrl: proc.env['SITE_URL'] };
  return {};
}

const cfg = readConfig();

/** Base URL of sunsteel.api, ending in /api. */
export const API_BASE_URL = cfg.apiBaseUrl || 'http://localhost:5090/api';

/** API origin, for building absolute URLs to /uploads. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

/** Public site origin, for canonical and Open Graph URLs. */
export const SITE_URL = (cfg.siteUrl || 'http://localhost:4200').replace(/\/$/, '');

/** Upload URLs are stored site-relative (/uploads/...). Behind Nginx that is the same origin; in development the API is elsewhere.
 *  Pictures that ship with the site (/materials/...) are served by the website itself, never by the API. */
export const absUrl = (u: string): string => (u.startsWith('/') && !u.startsWith('/materials/') ? API_ORIGIN + u : u);
