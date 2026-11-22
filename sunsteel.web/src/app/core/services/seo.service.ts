import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_URL } from '../api.config';
import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH, shareImage } from './share-image';

export interface SeoData {
  title: string;
  description?: string;
  /** Path such as '/products/stainless-steel/'. Canonical is always SITE_URL + path, never the request URL. */
  path: string;
  /** Link-preview picture: a path such as '/og/bars.jpg' or a full URL. Defaults to the site card. */
  image?: string;
  noindex?: boolean;
  /** Structured data blocks (Organization, Product, BreadcrumbList, FAQPage...). Replaced on every call. */
  jsonLd?: object[];
}

/** Title, description, canonical and Open Graph tags. Runs during SSR so crawlers see them. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  set(data: SeoData): void {
    const url = SITE_URL + (data.path === '/' ? '' : data.path);
    this.title.setTitle(data.title);
    this.tag('name', 'description', data.description);
    this.tag('name', 'robots', data.noindex ? 'noindex, nofollow' : 'index, follow');
    this.tag('property', 'og:title', data.title);
    this.tag('property', 'og:description', data.description);
    this.tag('property', 'og:url', url);
    this.tag('property', 'og:type', 'website');
    this.tag('property', 'og:site_name', 'Sun Steel Traders');
    this.tag('property', 'og:locale', 'en_IN');
    // WhatsApp and Facebook need an absolute https URL. Every page gets a picture: the site card unless the page names one.
    const picture = data.image ?? shareImage();
    const image = /^https?:\/\//.test(picture) ? picture : SITE_URL + picture;
    const ours = image.startsWith(SITE_URL + '/og/');
    this.tag('property', 'og:image', image);
    this.tag('property', 'og:image:alt', data.title);
    this.tag('property', 'og:image:width', ours ? String(SHARE_IMAGE_WIDTH) : undefined);
    this.tag('property', 'og:image:height', ours ? String(SHARE_IMAGE_HEIGHT) : undefined);
    this.tag('name', 'twitter:card', 'summary_large_image');
    this.tag('name', 'twitter:image', image);

    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);

    this.doc.head.querySelectorAll('script[data-ld]').forEach((n) => n.remove());
    for (const block of data.jsonLd ?? []) {
      const script = this.doc.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('data-ld', '');
      // "<" is escaped so text inside the JSON can never close the script tag.
      script.textContent = JSON.stringify(block).replace(/</g, '\\u003c');
      this.doc.head.appendChild(script);
    }
  }

  private tag(attr: 'name' | 'property', key: string, content?: string): void {
    const selector = `${attr}="${key}"`;
    if (content) this.meta.updateTag({ [attr]: key, content }, selector);
    else this.meta.removeTag(selector);
  }
}
