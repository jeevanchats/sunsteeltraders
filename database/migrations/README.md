# Database migrations

Forward-only, numbered SQL scripts. **SQL is the source of truth**; EF Core entities are hand-written to match.

- Apply in order: `for f in database/migrations/0*.sql; do mysql --default-character-set=utf8mb4 -u root -p sunsteel < "$f"; done`
- **Always pass `--default-character-set=utf8mb4`.** Without it the Windows mysql client reads scripts in the console code page and garbles
  characters such as plus-or-minus, en dash and the diameter sign. Keep new scripts plain ASCII where you can.
- Each script is idempotent (`IF NOT EXISTS` / `INSERT IGNORE`) and records itself in `__schema_migrations`.
- **Never edit a script that has been applied anywhere.** Add `011_*.sql`, `012_*.sql`, …

| Script | Creates |
| --- | --- |
| 001 | `__schema_migrations` |
| 002 | Users, Roles, Permissions, UserRoles, RolePermissions, UserExternalLogins, RefreshTokens, OtpVerifications |
| 003 | 8 permissions, Super Admin / Manager / Sales roles, first admin (password set by API on first start) |
| 004 | SiteSettings, ThemeSettings (+ Sun Steel defaults, v3 palette) |
| 005 | MediaAssets |
| 006 | Silos, Materials, Products, ProductImages, SectionWeights, Cities, DeliveryLeadTimes |
| 007 | Pages, PageSections, HeroSlides, Faqs, Testimonials, PolicyPages (+ seeds) |
| 008 | Leads, LeadItems, LeadFiles, LeadNotes, ClickEvents |
| 009 | AuditLog |
| 010 | Catalogue seed: 7 silos, 27 materials, 93 products, IS 808 sections, 6 cities. **Generated** by `node database/seed/build-seed.mjs` from `seed/catalog.json` |
| 014 | HomeSlides (home-page slideshow banners) |
| 015 | Quotes, QuoteItems; SiteSettings QuoteValidDays, QuoteGstRate, QuoteTerms (TO CONFIRM) |
| 016 | Quotation lines (type, brand, HSN, GST rate, weight inputs), payment terms and bank details on quotes; QuoteProducts, QuoteHsn, MsPipeSchedule (sample rows); Quote* settings |
| 017 | Quotes.QuoteType (Project, Wholesale, Retail, CutPieces; existing quotes become Retail) |
| 018 | Repairs the default quotation terms garbled by 016 when applied without utf8mb4 |
