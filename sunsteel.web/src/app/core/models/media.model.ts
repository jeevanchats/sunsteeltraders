/** An uploaded image or video. `variants` maps pixel width to a WebP URL (keys arrive as strings). */
export interface MediaItem {
  id: number;
  kind: string;
  fileName: string;
  url: string;
  variants: Record<string, string>;
  placeholder: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  altText: string | null;
  caption: string | null;
  category: string | null;
  createdAt: string;
}

export interface GalleryCard {
  id: number;
  title: string | null;
  caption: string | null;
  linkUrl: string | null;
  media: MediaItem | null;
}

export interface GalleryPublic {
  settings: { show: boolean; kicker: string; heading: string; speed: number };
  items: GalleryCard[];
}

/** One banner of the home-page slideshow. */
export interface SlideCard {
  id: number;
  title: string | null;
  caption: string | null;
  ctaText: string | null;
  linkUrl: string | null;
  media: MediaItem | null;
}
