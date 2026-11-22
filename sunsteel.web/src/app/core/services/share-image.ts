/**
 * Link-preview pictures (WhatsApp, Facebook, X, Google Discover): 1200x630 JPEG in public/og/, made from the family banners.
 * JPEG, not WebP, and about 190 KB each: WhatsApp drops previews whose picture is large or in a format it can't read.
 */
const BY_SILO: Record<string, string> = {
  'non-ferrous-metals': 'non-ferrous',
  'cast-iron': 'non-ferrous',
  'engineering-plastics': 'plastics',
  'cutting-workshop-tools': 'cutting',
};

export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;

/** The card for a family (silo key); the bars card for the home page, cities and everything else. */
export const shareImage = (siloKey?: string | null): string => `/og/${(siloKey && BY_SILO[siloKey]) || 'bars'}.jpg`;
