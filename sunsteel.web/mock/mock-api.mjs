// Front-end development mock of sunsteel.api's public endpoints, so the Angular site can be
// run and reviewed without .NET or MySQL. Reads the same seed as migration 010
// (database/seed/catalog.json). NOT for production: no auth, no persistence.
// Usage: npm run mock-api   (listens on http://localhost:5090/api)
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const c = JSON.parse(readFileSync(join(here, '../../database/seed/catalog.json'), 'utf8'));
// MS pipe schedule (ASME B36.10M), the same rows migration 024 seeds, for the weight calculator.
const msPipes = [
  ['1/2 in.', 21.30, 'SCH 10', 2.11, 10],
  ['1/2 in.', 21.30, 'SCH 40', 2.77, 10],
  ['1/2 in.', 21.30, 'SCH 80', 3.73, 10],
  ['1/2 in.', 21.30, 'SCH 160', 4.78, 10],
  ['1/2 in.', 21.30, 'XXS', 7.47, 10],
  ['3/4 in.', 26.70, 'SCH 10', 2.11, 20],
  ['3/4 in.', 26.70, 'SCH 40', 2.87, 20],
  ['3/4 in.', 26.70, 'SCH 80', 3.91, 20],
  ['3/4 in.', 26.70, 'SCH 160', 5.56, 20],
  ['3/4 in.', 26.70, 'XXS', 7.82, 20],
  ['1 in.', 33.40, 'SCH 10', 2.77, 30],
  ['1 in.', 33.40, 'SCH 40', 3.38, 30],
  ['1 in.', 33.40, 'SCH 80', 4.55, 30],
  ['1 in.', 33.40, 'SCH 160', 6.35, 30],
  ['1 in.', 33.40, 'XXS', 9.09, 30],
  ['1 1/4 in.', 42.20, 'SCH 10', 2.77, 40],
  ['1 1/4 in.', 42.20, 'SCH 40', 3.56, 40],
  ['1 1/4 in.', 42.20, 'SCH 80', 4.85, 40],
  ['1 1/4 in.', 42.20, 'SCH 160', 6.35, 40],
  ['1 1/4 in.', 42.20, 'XXS', 9.70, 40],
  ['1 1/2 in.', 48.30, 'SCH 10', 2.77, 50],
  ['1 1/2 in.', 48.30, 'SCH 40', 3.68, 50],
  ['1 1/2 in.', 48.30, 'SCH 80', 5.08, 50],
  ['1 1/2 in.', 48.30, 'SCH 160', 7.14, 50],
  ['1 1/2 in.', 48.30, 'XXS', 10.15, 50],
  ['2 in.', 60.30, 'SCH 10', 2.77, 60],
  ['2 in.', 60.30, 'SCH 40', 3.91, 60],
  ['2 in.', 60.30, 'SCH 80', 5.54, 60],
  ['2 in.', 60.30, 'SCH 160', 8.74, 60],
  ['2 in.', 60.30, 'XXS', 11.07, 60],
  ['2 1/2 in.', 73.00, 'SCH 10', 3.05, 70],
  ['2 1/2 in.', 73.00, 'SCH 40', 5.16, 70],
  ['2 1/2 in.', 73.00, 'SCH 80', 7.01, 70],
  ['2 1/2 in.', 73.00, 'SCH 160', 9.53, 70],
  ['2 1/2 in.', 73.00, 'XXS', 14.02, 70],
  ['3 in.', 88.90, 'SCH 10', 3.05, 80],
  ['3 in.', 88.90, 'SCH 40', 5.49, 80],
  ['3 in.', 88.90, 'SCH 80', 7.62, 80],
  ['3 in.', 88.90, 'SCH 160', 11.13, 80],
  ['3 in.', 88.90, 'XXS', 15.24, 80],
  ['4 in.', 114.30, 'SCH 10', 3.05, 90],
  ['4 in.', 114.30, 'SCH 40', 6.02, 90],
  ['4 in.', 114.30, 'SCH 80', 8.56, 90],
  ['4 in.', 114.30, 'SCH 120', 11.13, 90],
  ['4 in.', 114.30, 'SCH 160', 13.49, 90],
  ['4 in.', 114.30, 'XXS', 17.12, 90],
  ['5 in.', 141.30, 'SCH 10', 3.40, 100],
  ['5 in.', 141.30, 'SCH 40', 6.55, 100],
  ['5 in.', 141.30, 'SCH 80', 9.53, 100],
  ['5 in.', 141.30, 'SCH 120', 12.70, 100],
  ['5 in.', 141.30, 'SCH 160', 15.88, 100],
  ['5 in.', 141.30, 'XXS', 19.05, 100],
  ['6 in.', 168.30, 'SCH 10', 3.40, 110],
  ['6 in.', 168.30, 'SCH 40', 7.11, 110],
  ['6 in.', 168.30, 'SCH 80', 10.97, 110],
  ['6 in.', 168.30, 'SCH 120', 14.27, 110],
  ['6 in.', 168.30, 'SCH 160', 18.26, 110],
  ['6 in.', 168.30, 'XXS', 21.95, 110],
  ['8 in.', 219.10, 'SCH 10', 3.76, 120],
  ['8 in.', 219.10, 'SCH 20', 6.35, 120],
  ['8 in.', 219.10, 'SCH 30', 7.04, 120],
  ['8 in.', 219.10, 'SCH 40', 8.18, 120],
  ['8 in.', 219.10, 'SCH 60', 10.31, 120],
  ['8 in.', 219.10, 'SCH 80', 12.70, 120],
  ['8 in.', 219.10, 'SCH 100', 15.09, 120],
  ['8 in.', 219.10, 'SCH 120', 18.26, 120],
  ['8 in.', 219.10, 'SCH 140', 20.62, 120],
  ['8 in.', 219.10, 'SCH 160', 23.01, 120],
  ['8 in.', 219.10, 'XXS', 22.23, 120],
  ['10 in.', 273.10, 'SCH 10', 4.19, 130],
  ['10 in.', 273.10, 'SCH 20', 6.35, 130],
  ['10 in.', 273.10, 'SCH 30', 7.80, 130],
  ['10 in.', 273.10, 'SCH 40', 9.27, 130],
  ['10 in.', 273.10, 'SCH 60', 12.70, 130],
  ['10 in.', 273.10, 'SCH 80', 15.09, 130],
  ['10 in.', 273.10, 'SCH 100', 18.26, 130],
  ['10 in.', 273.10, 'SCH 120', 21.44, 130],
  ['10 in.', 273.10, 'SCH 140', 25.40, 130],
  ['10 in.', 273.10, 'SCH 160', 28.58, 130],
  ['12 in.', 323.90, 'SCH 10', 4.57, 140],
  ['12 in.', 323.90, 'SCH 20', 6.35, 140],
  ['12 in.', 323.90, 'SCH 30', 8.38, 140],
  ['12 in.', 323.90, 'STD', 9.53, 140],
  ['12 in.', 323.90, 'SCH 40', 10.31, 140],
  ['12 in.', 323.90, 'XS', 12.70, 140],
  ['12 in.', 323.90, 'SCH 60', 14.27, 140],
  ['12 in.', 323.90, 'SCH 80', 17.48, 140],
  ['12 in.', 323.90, 'SCH 100', 21.44, 140],
  ['12 in.', 323.90, 'SCH 120', 25.40, 140],
  ['12 in.', 323.90, 'SCH 140', 28.58, 140],
  ['12 in.', 323.90, 'SCH 160', 33.32, 140],
].map(([nominalSize, odMm, schedule, wallMm]) => ({ nominalSize, odMm, schedule, wallMm }));
const BRAND = 'Sun Steel Traders';
const silo = (k) => c.silos.find((s) => s.key === k);
const density = (k) => c.materials.find((m) => m.key === k)?.density;
const sections = [...c.sections.beam.map(([d, w], i) => ({ designation: d, kind: 'beam', kgPerMetre: w, i })), ...c.sections.channel.map(([d, w], i) => ({ designation: d, kind: 'channel', kgPerMetre: w, i }))];

const card = (p) => ({ slug: p.slug, siloKey: p.silo, name: p.name, grade: p.grade, materialKey: p.material, forms: p.forms, sizeRange: p.sizeRange, stockStatus: p.stock, equivalents: p.equivalents, heroUrl: null, path: `/products/${p.silo}/${p.slug}/` });
const summary = (s) => ({ key: s.key, name: s.name, shortName: s.short, glyph: s.glyph, intro: s.intro, topGrades: s.top, productCount: c.products.filter((p) => p.silo === s.key).length, heroUrl: null });

function productDto(p) {
  const s = silo(p.silo);
  const eq = p.equivalents;
  const faqs = p.material ? [
    { question: `Can you cut ${p.grade} to my sizes?`, answer: `Yes. ${p.grade} is band-saw cut to ±1 mm. Send piece sizes and quantities with your request; cutting is quoted with the material.` },
    { question: `Is a mill test certificate provided with ${p.grade}?`, answer: 'An MTC is supplied with mill material on request, traceable to the heat number.' },
    { question: 'What sizes are in stock?', answer: `${p.sizeRange}. For large tonnage, message us to reserve material.` },
    { question: `What are the equivalents of ${p.grade}?`, answer: eq.length ? `${eq.join(', ')}. Equivalents are close matches; confirm against your drawing's specification.` : 'Ask our sales team for the nearest equivalent.' },
  ] : [{ question: `Which sizes of ${p.name.toLowerCase()} do you stock?`, answer: `${p.sizeRange}. Ask on WhatsApp for brands and current stock.` }];
  const related = c.products.filter((x) => x.silo === p.silo && x.slug !== p.slug).sort((a, b) => Math.abs(a.sort - p.sort) - Math.abs(b.sort - p.sort)).slice(0, 4).map(card);
  return {
    slug: p.slug, sku: p.sku, siloKey: p.silo, siloName: s.name, name: p.name, grade: p.grade, materialKey: p.material,
    materialName: c.materials.find((m) => m.key === p.material)?.name ?? null, density: density(p.material) ?? null, forms: p.forms,
    sizeRange: p.sizeRange, applications: p.applications,
    summary: p.silo === 'cutting-workshop-tools' ? `${p.name} stocked in Madurai for lathe, milling and fabrication shops. Counter pickup or same-day dispatch with your steel order.`
      : p.silo === 'engineering-plastics' ? `${p.name} in ready stock: ${p.sizeRange}. Cut to length or sheet size on request.`
      : `${p.name} in ready stock at our Madurai godowns, ${(p.condition || 'as rolled').toLowerCase()}, ${p.sizeRange}. Band-saw cut to your sizes with mill test certificates on request.`,
    condition: p.condition, machinability: p.machinability, chemistry: p.chemistry, mechanical: p.mechanical, equivalents: eq,
    stockStatus: p.stock, priceNote: null, heroUrl: null,
    metaTitle: `${p.name} Stockist & Supplier in Madurai | ${BRAND}`,
    metaDescription: `Buy cut-to-size ${p.name}${eq[0] ? ` (${eq[0]})` : ''} from ${BRAND} Madurai. MTC provided, overhead crane loading, fast dispatch across Tamil Nadu.`,
    faqs, related, path: `/products/${p.silo}/${p.slug}/`,
  };
}

function pieceKg(form, d, L, rho, kgm) {
  const v = (k) => (d[k] > 0 ? d[k] : 0);
  switch (form) {
    case 'round': return (Math.PI * v('D') ** 2 * L * rho) / 4e6;
    case 'square': return (v('W') ** 2 * L * rho) / 1e6;
    case 'hex': return (0.866025 * v('AF') ** 2 * L * rho) / 1e6;
    case 'flat': case 'plate': return (v('T') * v('W') * L * rho) / 1e6;
    case 'tube': return (Math.PI * (v('OD') - v('WT')) * v('WT') * L * rho) / 1e6;
    case 'rect': return ((2 * (v('A') + v('B')) - 4 * v('WT')) * v('WT') * L * rho) / 1e6;
    case 'angle': return ((v('A') + v('B') - v('T')) * v('T') * L * rho) / 1e6;
    default: return ((kgm ?? 0) * L) / 1000;
  }
}

let leadId = 1043;
const pages = {
  '': { slug: '', title: 'Home', metaTitle: `Steel, Stainless, Brass & Copper Stockist in Madurai | ${BRAND}`, metaDescription: 'Multi-metal stockist in Simmakkal, Madurai: 93 grades of mild, alloy and stainless steel, non-ferrous metals, cast iron and plastics. Cut to size, MTC provided, same-day dispatch.',
    faqs: [{ question: 'Do you cut material to size?', answer: 'Yes. Rounds, flats and blocks are band-saw cut to your lengths (±1 mm); plates are cut to size on request.' }, { question: 'Do you provide mill test certificates?', answer: 'Yes. Mill Test Certificates (MTC) are available for every lot on request.' }, { question: 'How fast can you deliver?', answer: 'Same day within Madurai, Virudhunagar and Sivakasi; one day to Tirunelveli, Tuticorin and Trichy; two to three days to Chennai and Hosur.' }] },
};
const policies = {
  'terms-conditions': { slug: 'terms-conditions', title: 'Terms & conditions', bodyHtml: '<h2>Quotations</h2><p>Quotations are valid for 3 days unless stated, because metal prices move daily. Prices are ex-godown Madurai plus GST.</p><h2>Weights</h2><p>Calculated weights are theoretical; invoices use actual weighed or mill weights.</p>', updatedAt: new Date().toISOString() },
  'privacy-policy': { slug: 'privacy-policy', title: 'Privacy policy', bodyHtml: '<h2>What we collect</h2><p>Your name, phone, email, company, GSTIN and the items you ask about when you send a request.</p><h2>How we use it</h2><p>Only to reply to you with a quotation. We do not sell or share your details.</p>', updatedAt: new Date().toISOString() },
};

const ok = (res, data, message) => send(res, 200, { success: true, data, message });
const notFound = (res, message = 'Not found.') => send(res, 404, { success: false, message });
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '');
  if (req.method === 'OPTIONS') return send(res, 204);
  let m;
  if (p === '/api/site') return ok(res, { settings: c.settings && { BusinessName: 'Sun Steel Traders', LocationLine: 'Madurai', Tagline: 'Multi-metal stockist', Phone1: '+91 98421 50479', Phone2: '+91 98428 50479', Landline: '0452 235 0479', WhatsAppNumber: '919842150479', SalesEmail: 'managersunsteeltraders@gmail.com', Address: '57, Tamil Sangam Road, near Bell Hotel, Simmakkal, Madurai 625001, Tamil Nadu', OpeningHours: 'Mon–Sat · 09:00–19:30', IsoCertificate: 'ISO 9001:2015', Latitude: '9.9252', Longitude: '78.1198', MapUrl: 'https://maps.google.com/?q=Sun+Steel+Traders+Simmakkal+Madurai' }, theme: { primary: '#1E2430', accent: '#9C6B3C', surface: '#FAF6EF' } });
  if (p === '/api/catalog') return ok(res, { silos: c.silos.map(summary), materials: c.materials.map((x) => ({ key: x.key, name: x.name, density: x.density })), sections: sections.map(({ i, ...s }) => s), leadTimes: c.leadTimes.map((l) => ({ city: l.city, leadTime: l.lead })), cities: c.cities.map((x) => ({ slug: x.slug, name: x.name, distanceKm: x.km, leadTime: x.lead, path: `/steel-suppliers-${x.slug}/` })) , msPipes });
  if (p === '/api/catalog/products') return ok(res, c.products.map(card));
  if ((m = p.match(/^\/api\/catalog\/silos\/([^/]+)$/))) {
    const s = silo(m[1]); if (!s) return notFound(res, 'Category not found.');
    const ps = c.products.filter((x) => x.silo === s.key);
    const sh = s.short.toLowerCase();
    return ok(res, { silo: summary(s), metaTitle: `${s.name} Wholesale Stockist & Dealers | ${BRAND}`, metaDescription: `Leading supplier of ${s.top} in Madurai. Ready stock with cut-to-size service, MTC provided and fast dispatch across Tamil Nadu.`, products: ps.map(card),
      faqs: [{ question: `Which ${sh} grades do you keep in stock?`, answer: `${ps.length} products, including ${[...new Set(ps.slice(0, 6).map((x) => x.grade))].join(', ')}, listed above with size ranges and stock status.` }, { question: `Can you cut ${sh} material to size?`, answer: 'Yes. Rounds, flats and blocks are band-saw cut to ±1 mm; pipes and sections are cut to length. Cutting is quoted with the material.' }, { question: 'How quickly can you deliver?', answer: 'Same day in Madurai, 1 day to Tirunelveli, Tuticorin and Trichy, 1–2 days to Coimbatore and Salem, 2–3 days to Chennai.' }] });
  }
  if ((m = p.match(/^\/api\/catalog\/products\/([^/]+)\/([^/]+)$/))) {
    const x = c.products.find((y) => y.slug === m[2] && y.silo === m[1]);
    return x ? ok(res, productDto(x)) : notFound(res, 'Product not found.');
  }
  if (p === '/api/catalog/search') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase(); const terms = q.split(/\s+/).filter(Boolean);
    if (q.length < 2) return ok(res, []);
    const hits = c.products.map((x) => {
      const hay = `${x.name} ${x.grade} ${x.applications} ${x.equivalents.join(' ')}`.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return null;
      const score = (x.grade.toLowerCase() === q ? 100 : 0) + (x.grade.toLowerCase().startsWith(q) ? 50 : 0) + (x.name.toLowerCase().includes(q) ? 20 : 0) + 1;
      return { score, hit: { slug: x.slug, siloKey: x.silo, name: x.name, grade: x.grade, siloName: silo(x.silo).short, stockStatus: x.stock, match: x.equivalents.find((e) => e.toLowerCase().includes(q)) ?? null, path: `/products/${x.silo}/${x.slug}/` } };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, +(url.searchParams.get('limit') || 8)).map((h) => h.hit);
    return ok(res, hits);
  }
  if ((m = p.match(/^\/api\/catalog\/cities\/([^/]+)$/))) {
    const x = c.cities.find((y) => y.slug === m[1].toLowerCase()); if (!x) return notFound(res, 'City not found.');
    return ok(res, { slug: x.slug, name: x.name, distanceKm: x.km, leadTime: x.lead, zones: x.zones, intro: x.intro, industries: x.inds, popular: x.pop.map((s) => c.products.find((y) => y.slug === s)).filter(Boolean).map(card), metaTitle: `Industrial Steel & Metal Suppliers in ${x.name} | ${BRAND}`, metaDescription: `Direct factory supply of Mild Steel, Alloy Steel, Stainless Steel, Brass & Copper to ${x.name} industrial zones. Fast dispatch from Madurai godowns.` });
  }
  if ((m = p.match(/^\/api\/pages\/?(.*)$/))) return pages[m[1]] ? ok(res, pages[m[1]]) : notFound(res);
  if ((m = p.match(/^\/api\/policies\/([^/]+)$/))) return policies[m[1]] ? ok(res, policies[m[1]]) : notFound(res);
  if (p === '/api/gallery') {
    // Stand-in photos: the product pictures that ship with the site, as 39 gallery cards.
    const files = readdirSync(join(here, '../public/materials')).filter((f) => f.endsWith('-1200.webp')).slice(0, 39);
    const pretty = (f) => f.replace('-1200.webp', '').replace(/-/g, ' ').replace(/^./, (x) => x.toUpperCase());
    const items = files.map((f, i) => ({
      id: i + 1, title: pretty(f), caption: i % 3 === 0 ? 'Cut to your size in our Madurai godowns.' : null, linkUrl: i === 1 ? '/products/' : null,
      media: { id: i + 1, kind: 'image', fileName: f, url: `/materials/${f}`, variants: { '640': `/materials/${f}`, '1200': `/materials/${f}` }, placeholder: null, width: 1200, height: 900, sizeBytes: 0, altText: pretty(f), caption: null, category: null, createdAt: '' },
    }));
    return ok(res, { settings: { show: true, kicker: 'The gallery', heading: 'A look inside Sun Steel Traders', speed: 50 }, items });
  }
  if (p === '/api/events/click') return send(res, 204);
  if (req.method === 'POST' && p === '/api/leads') {
    let body = ''; for await (const chunk of req) body += chunk;
    const r = JSON.parse(body || '{}');
    if (!r.name || (r.phone || '').replace(/\D/g, '').length < 10) return send(res, 400, { success: false, message: 'Please enter your name and a 10-digit mobile number.' });
    const items = (r.items || []).map((i) => {
      const pr = c.products.find((x) => x.slug === i.productSlug);
      const kgm = sections.find((s) => s.designation === i.section)?.kgPerMetre;
      const kg = pieceKg(i.form, i.dims || {}, i.lengthMm, density(pr?.material) ?? 0, kgm) * i.quantity;
      return { gradeText: pr ? (pr.name.includes(pr.grade) ? pr.name : `${pr.name} (${pr.grade})`) : i.gradeText, form: i.form, lengthMm: i.lengthMm, quantity: i.quantity, kg: kg > 0 ? Math.round(kg * 100) / 100 : null };
    });
    const total = items.reduce((s, i) => s + (i.kg || 0), 0);
    const ref = `SST-${r.type === 'Catalogue' ? 'CAT' : r.type === 'RFQ' ? 'RFQ' : 'ENQ'}-${++leadId}`;
    const text = [`Hello Sun Steel Traders, please quote ${ref}:`, ...items.map((i, n) => `${n + 1}. ${i.gradeText}, ${i.form} × ${i.lengthMm} mm, ${i.quantity} pcs${i.kg ? ` (≈${i.kg.toFixed(1)} kg)` : ''}`), total ? `Total ≈ ${total.toFixed(1)} kg` : '', r.message || '', r.name].filter(Boolean).join('\n');
    return ok(res, { reference: ref, totalKg: total || null, items, whatsAppUrl: `https://wa.me/919842150479?text=${encodeURIComponent(text)}` }, 'Thank you.');
  }
  if (req.method === 'POST' && /^\/api\/leads\/[^/]+\/files$/.test(p)) return ok(res, { files: 1 });
  notFound(res);
}).listen(5090, () => console.log('mock sunsteel.api on http://localhost:5090/api'));
