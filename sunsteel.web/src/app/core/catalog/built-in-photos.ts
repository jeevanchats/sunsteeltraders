import { ProductCard, Silo, SiloSummary } from '../models/catalog.model';

/**
 * Photographs that ship with the site (public/materials/{name}-1200.webp), used for a product or family that has no photo
 * chosen in the admin. A photo picked in the admin (Products, Home) always wins; this only fills the gaps, so the library
 * never shows a bare gradient where we have a picture of the material. Several products share a picture when it shows the
 * same material and shape (all stainless round bars, for instance). Every product has one; a product added later without a photo keeps the
 * coloured placeholder until one is chosen in the admin.
 */
const PRODUCTS: Record<string, string> = {
  // Mild steel and structural
  'ms-bright-bars': 'steel-bars-round', 'ms-hexagonal-bars': 'hex-bar', 'ms-equal-angles': 'ms-angle', 'ms-unequal-angles': 'ms-angle-unequal',
  'ms-channels-ismc': 'ms-channel', 'ms-beams-ismb': 'ms-beam', 'chequered-plates': 'chequered-plate', 'ms-seamless-pipes': 'seamless-pipes', 'ms-erw-black-pipes': 'gi-pipes',
  // Alloy and engineering steels
  'en8-steel-round-bars': 'en8-bar', 'en8d-carbon-steel-bars': 'en8-bar', 'en24-chrome-moly-steel-bars': 'en24-bar',
  'en9-carbon-steel-bars': 'steel-bars-round', 'en19-alloy-steel-rounds': 'steel-bars-round', 'en31-bearing-steel-rounds': 'steel-bars-round',
  'en353-case-hardening-steel': 'steel-bars-round', 'en1a-free-cutting-steel': 'steel-bars-round', 'en1a-leadened-steel': 'steel-bars-round',
  'sae-1018-carbon-steel': 'steel-bars-round', 'sae-1045-steel-bars': 'steel-bars-round', '8620-alloy-steel': 'steel-bars-round',
  '42crmo4-high-tensile-steel': 'steel-bars-round', 'c45-carbon-steel-rounds': 'steel-bars-round', 'silver-steel-st52-bars': 'steel-bars-round', 'hss-m2-rods': 'steel-bars-round',
  'hchcr-d2-tool-steel': 'tool-steel-block', 'hchcr-d3-tool-steel': 'tool-steel-block', 'db6-2714-die-blocks': 'tool-steel-block', 'h13-hot-work-tool-steel': 'tool-steel-flat',
  // Stainless steel
  'ss-304-round-bars': 'ss-round-bar', 'ss-316-round-bars': 'ss-round-bar', 'ss-202-round-hex-bars': 'ss-round-bar', 'ss-410-martensitic-bars': 'ss-round-bar',
  'ss-420-high-carbon-bars': 'ss-round-bar', 'ss-431-round-bars': 'ss-round-bar', 'ss-17-4ph-bars': 'ss-round-bar',
  'ss-304-flat-square-bars': 'ss-flats', 'ss-hexagonal-angle-bars': 'hex-bar',
  'ss-304-sheets-plates': 'sheet-stack', 'ss-202-sheets-plates': 'sheet-stack', 'ss-316-plates-sheets': 'plate-disc',
  'ss-304-pipes': 'seamless-pipes', 'ss-316-seamless-pipes': 'seamless-pipes',
  // Non-ferrous
  'brass-round-bars': 'brass-bars', 'free-cutting-brass-rods': 'brass-bars', 'brass-hex-flat-bars': 'brass-bars',
  'copper-round-bars': 'copper-flat', 'copper-busbars-flats': 'copper-flat', 'copper-plates-sheets': 'copper-flat',
  'gunmetal-lg2-rods': 'gunmetal-bush', 'gunmetal-hollow-bushes': 'gunmetal-bush', 'phosphor-bronze-pb1-rods': 'gunmetal-bush',
  'aluminium-bronze-ab2-rods': 'gunmetal-bush', 'manganese-bronze-rods': 'gunmetal-bush',
  'aluminium-6061-t6-bars': 'aluminium-bars', 'aluminium-6063-shapes': 'aluminium-bars', 'aluminium-7075-bars': 'aluminium-bars',
  'aluminium-5083-plates': 'plate-disc', 'aluminium-chequered-sheets': 'chequered-plate',
  // Cast iron
  'fg-200-cast-iron-rounds': 'cast-iron-bar', 'fg-250-continuous-cast-bars': 'cast-iron-bar', 'fg-300-cast-iron-bars': 'cast-iron-bar',
  'sg-iron-ggg40-rods': 'cast-iron-bar', 'sg-iron-ggg50-bars': 'cast-iron-bar', 'continuous-cast-ci-bars': 'cast-iron-bar',
  // Engineering plastics
  'nylon-6-rods': 'nylon-white', 'nylon-6-sheets': 'nylon-white', 'cast-nylon-oil-filled-rods': 'nylon-white', 'delrin-acetal-white-rods': 'nylon-white',
  'polypropylene-sheets-rods': 'nylon-white', 'uhmwpe-sheets-rods': 'nylon-white', 'delrin-black-sheets-rods': 'pom-black',
  'ptfe-teflon-rods-tubes': 'ptfe-rod-sheet', 'ptfe-teflon-sheets': 'ptfe-rod-sheet',
  // Cutting and workshop tools
  'bimetal-bandsaw-blades': 'cutting-bandsaw',
  'hss-tool-bits': 'hss-tool-bits', 'm42-cobalt-tool-bits': 'hss-tool-bits', 'carbide-turning-inserts': 'carbide-inserts',
  'abrasive-cutoff-wheels': 'cutoff-wheels', 'solid-carbide-end-mills': 'end-mills', 'hss-taps-die-sets': 'taps-dies',
  'lathe-chuck-accessories': 'chuck-accessories', 'magnetic-v-blocks-clamps': 'v-blocks-clamps',
  // The rest of mild steel, brass, copper and the plastics
  'ms-black-rounds': 'ms-black-round', 'ms-square-bars': 'ms-square-bar', 'ms-flat-bars': 'ms-flat-bar', 'ms-plates-sheets': 'ms-plate-stack',
  'ms-hollow-sections': 'ms-hollow-section', 'brass-sheets-coils': 'brass-sheet-coil', 'copper-hollow-tubes': 'copper-tube',
  'bakelite-fabric-sheets': 'bakelite-sheets', 'bakelite-paper-sheets': 'bakelite-sheets', 'acrylic-transparent-sheets': 'acrylic-sheet',
};

/** The cover for each of the seven families (the cards on the home page and the library). */
const SILOS: Record<string, string> = {
  'mild-steel-structural': 'ms-beam', 'alloy-engineering-steels': 'en24-bar', 'stainless-steel': 'ss-round-bar', 'non-ferrous-metals': 'brass-bars',
  'cast-iron': 'cast-iron-bar', 'engineering-plastics': 'nylon-white', 'cutting-workshop-tools': 'cutting-bandsaw',
};

const url = (stem: string | undefined): string | null => (stem ? `/materials/${stem}-1200.webp` : null);

export const productPhoto = (slug: string): string | null => url(PRODUCTS[slug]);
export const siloPhoto = (key: string): string | null => url(SILOS[key]);

export const withProductPhoto = <T extends Pick<ProductCard, 'slug' | 'heroUrl'>>(p: T): T => (p.heroUrl ? p : { ...p, heroUrl: productPhoto(p.slug) });
export const withSiloPhoto = (s: SiloSummary): SiloSummary => (s.heroUrl ? s : { ...s, heroUrl: siloPhoto(s.key) });
export const withSiloPhotos = (s: Silo): Silo => ({ ...s, silo: withSiloPhoto(s.silo), products: s.products.map(withProductPhoto) });
