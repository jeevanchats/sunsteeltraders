# CLAUDE.md — Sun Steel Traders (sunsteeltraders.com)

Build guide. Full design: the "Sun Steel Traders — Website Design Document" (Claude Doc) and the
sketches v1–v4 (v3 "Metal atelier" chosen). Codebase forked from Queens Inn; same conventions.

## Working rules
1. Ask, don't assume; flag low-risk assumptions explicitly.
2. Simplest solution first. 3. Don't touch unrelated code. 4. Flag uncertainty.

## Stack
| Layer | Tech |
|---|---|
| API | ASP.NET Core .NET 10 — `sunsteel.api` (vertical slices under `Features/`) |
| Web | Angular 21 (standalone, zoneless, SSR) + Tailwind CSS 4 — `sunsteel.web` |
| DB | MySQL 8 `sunsteel`, EF Core 9 + Pomelo (no EF 10 Pomelo release yet), **hand-written entities**, SQL migrations are the source of truth |
| Auth | BCrypt + JWT (15 min) + rotating refresh tokens (14 days); Google sign-in for existing staff only |

## Commands
```bash
# Database (forward-only, idempotent; safe to re-run)
mysql -e "CREATE DATABASE sunsteel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
for f in database/migrations/0*.sql; do mysql -u root -p sunsteel < "$f"; done
# Regenerate the catalogue seed (010) after editing database/seed/catalog.json
node database/seed/build-seed.mjs
# API  → http://localhost:5090/api/health   (set Jwt:Key, ConnectionStrings:Default, Admin:DefaultPassword via user-secrets)
dotnet run --project sunsteel.api
# Web  → http://localhost:4200
cd sunsteel.web && npm install && npm start
# Web without .NET/MySQL: mock of the public API from the seed JSON
cd sunsteel.web && npm run mock-api
# Production SSR build
cd sunsteel.web && npx ng build && node dist/sunsteel-web/server/server.mjs
# Weight formula check (spec example EN24 Ø80 × 500 × 4 = 78.9 kg)
cd sunsteel.web && npx esbuild src/app/core/weight/weight.ts --format=esm --outfile=/tmp/w.mjs && node src/app/core/weight/weight.check.mjs /tmp/w.mjs
```

## Conventions
- Responses: `ApiResponse<T>`; lists: `PagedResult<T>`; handled errors: `throw new AppException(msg, status)`.
- Permissions: `Common/Security/Perm.cs` ⇄ `core/models/auth.model.ts` ⇄ migration 003 — keep all three in sync.
- Admin endpoints live under `/api/admin/*` with `[Authorize(Policy = Perm.X)]`.
- Public GETs use `[OutputCache(PolicyName = "public")]`; admin saves call `EvictByTagAsync("public")`.
- No hard-coded brand colours: use `primary / accent / surface` and derived tokens
  (`deep, ink, muted, faint, line, paper, tint, gold-ink, gold-soft, gold-light, on-primary`).
- **URLs are the specification's, with trailing slashes** (`/products/{silo}/{slug}/`, `/steel-suppliers-{city}/`).
  `TrailingSlashUrlSerializer` writes them; `server.ts` 301s slash-less requests. Never change a slug.
- Weight formulas exist twice: `Features/Weight/WeightCalculator.cs` and `core/weight/weight.ts`. Change both.
- Quote totals exist twice: `Features/Quotes/QuoteMath.cs` and `core/quote/quote-math.ts` (live preview); line weights twice too:
  `Features/Quotes/QuoteLineCalc.cs` and `core/quote/quote-lines.ts` (both reuse the weight formulas). Change both; the server's figures win.
- RFQs are **saved before WhatsApp opens**; the server recomputes kg from catalogue densities.
- JSON-LD: Organization/Store, Product (no Offer/rating until real prices/reviews exist), BreadcrumbList, FAQPage.
- New migrations get the next number (011…); never edit one that has been applied anywhere.

## Guardrails
- Seeded Super Admin: `admin@sunsteeltraders.com` / `Admin:DefaultPassword` (forced change at first sign-in).
- Secrets (Jwt:Key, DB password, Google client id) via user-secrets or env vars in production.
- Customer drawings (`Leads:FilePath`) live outside `/uploads` and are only downloadable by staff.

## Reused from Queens Inn (unchanged or renamed)
API: ApiResponse/PagedResult/AppException, exception middleware, JWT + refresh tokens, Google allowlist,
password hashing, Super Admin seeder, staff users/roles, Perm policies, SiteService (settings + theme with
contrast guard), audit log, output cache, rate limits, health checks, Serilog. Web: api.config runtime
config, auth service/interceptor/guards, token storage, SiteService theme engine, SeoService (+ JSON-LD),
admin shell, login, change password, theme (presets + contrast warning), settings, staff users, icon set,
SSR server with host allowlist. Deploy: deploy.sh, systemd units, Nginx.

## Status
- ✅ Stage 1 — design doc, sketches v1–v4 (v3 chosen); the HTML prototype was superseded by building the real site
- ✅ Stage 2 — solution forked from Queens Inn; schema 001–010 (93 products seeded); catalogue, weight, leads, stock and
  dashboard API; v3 public site: home, material library, 7 silo pages, 93 product dossiers, the scale, concierge RFQ with
  basket + file upload, catalogue gate, atelier, 6 city pages, policies, real 404s; admin: dashboard, requests inbox,
  stock board, theme, settings, staff users
- ✅ Stage 3 — media library (SkiaSharp → WebP, `Features/Media`, admin Photographs), home sliding gallery (`Features/Gallery`, admin Home gallery, migration 013),
  product / family photos wired to the public cards and product pages
- ✅ Stage 4 — admin Products editor, Pages & content (page SEO, FAQs, terms/privacy, families, city pages; `Features/Content/ContentAdmin.cs`)
- ✅ Quotations — `Features/Quotes`, migrations 015 + 016, admin Quotations list/editor, "Create quotation" on a request, admin Quote data
  (product list, HSN codes, MS pipe schedule, GST/terms/bank). Each line is Calculated (material, shape, size, length, pieces → weight from the
  catalogue densities and IS 808 sections, plus SS pipe and MS pipe shapes), By weight (qty × kg × rate) or By unit (qty × price). GST is per line
  (raw material / finished product default, or typed), frozen on save; discount spread over lines; cutting, loading, unloading and freight at the
  raw-material rate; CGST+SGST, or IGST when the customer's GSTIN is outside Tamil Nadu (33). PDF drawn with SkiaSharp (`QuotePdf.cs`, "Rs." not ₹),
  A4 with HSN, tax once per rate, payment terms, bank details (omitted when empty). Send: share sheet with the PDF on phones, else PDF download +
  wa.me. Sent/Accepted/Rejected moves the request to Quoted/Won/Lost. Customer must supply: finished-product GST rate, bank details, HSN codes,
  full MS pipe schedule (only 5 sample sizes seeded). Browser checks: `npx esbuild src/app/core/quote/quote-lines.ts --bundle --format=esm --outfile=/tmp/ql.mjs`
  and `quote-math.ts` → `/tmp/qm.mjs`, then `node src/app/core/quote/quote.check.mjs /tmp/ql.mjs`.
- Stage 5 — email notification on new RFQ, sitemap.xml + robots.txt, GA4/Search Console
- Stage 6 — performance pass against CWV targets, content review by sales, go-live

## Open questions for the owner
WhatsApp number to receive RFQs · GSTIN and Udyam · godown map pins · founding year · extra grades
(EN36, EN41B, OHNS, SS 210, Hylam, PU rod) · permission to show mill logos · whether to publish prices · quotation terms, validity and raw-material GST rate (seeded, TO CONFIRM) · finished-product GST rate · seller GSTIN · bank details · HSN codes · full MS pipe schedule ·
catalogue PDF · photography shoot.
