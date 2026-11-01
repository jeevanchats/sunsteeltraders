using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using sunsteel.api.Common.Exceptions;
using sunsteel.api.Common.Models;
using sunsteel.api.Data;
using sunsteel.api.Data.Entities;
using sunsteel.api.Features.Audit;
using sunsteel.api.Features.Media;

namespace sunsteel.api.Features.Catalog;

public interface ICatalogService
{
    Task<CatalogIndexDto> GetIndexAsync(CancellationToken ct = default);
    Task<SiloDto> GetSiloAsync(string key, CancellationToken ct = default);
    Task<IReadOnlyList<ProductCardDto>> ListProductsAsync(CancellationToken ct = default);
    Task<ProductDto> GetProductAsync(string siloKey, string slug, CancellationToken ct = default);
    Task<IReadOnlyList<SearchHitDto>> SearchAsync(string q, int limit, CancellationToken ct = default);
    Task<CityDto> GetCityAsync(string slug, CancellationToken ct = default);
    Task<PageDto> GetPageAsync(string slug, CancellationToken ct = default);
    Task<PolicyDto> GetPolicyAsync(string slug, CancellationToken ct = default);

    Task<PagedResult<AdminProductRowDto>> AdminListAsync(string? silo, string? q, int page, int pageSize, CancellationToken ct = default);
    Task<ProductDto> AdminGetAsync(long id, CancellationToken ct = default);
    Task<ProductDto> UpdateAsync(long actorId, long id, UpdateProductRequest r, CancellationToken ct = default);
    Task UpdateStockAsync(long actorId, long id, string status, CancellationToken ct = default);
    Task UpdateDensityAsync(long actorId, string materialKey, decimal density, CancellationToken ct = default);
}

/// <summary>
/// Public catalogue reads and admin edits. Meta titles and descriptions follow the
/// formulas in specification §5.3 unless an admin has written an override.
/// </summary>
public sealed class CatalogService : ICatalogService
{
    public static readonly string[] StockStatuses = ["In stock", "Limited", "On order"];
    private const string Brand = "Sun Steel Traders";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly SunSteelDbContext _db;
    private readonly IAuditService _audit;

    private Dictionary<long, string>? _hero;

    /// <summary>Photo URL (about 960 px wide) for every product / category that has one; loaded once per request.</summary>
    private async Task EnsureHeroAsync(CancellationToken ct)
    {
        if (_hero is not null) return;
        var ids = await _db.Products.AsNoTracking().Where(p => p.HeroMediaId != null).Select(p => p.HeroMediaId!.Value)
            .Concat(_db.Silos.AsNoTracking().Where(x => x.HeroMediaId != null).Select(x => x.HeroMediaId!.Value)).Distinct().ToListAsync(ct);
        var rows = ids.Count == 0 ? [] : await _db.MediaAssets.AsNoTracking().Where(m => ids.Contains(m.MediaId) && m.Kind == "image").ToListAsync(ct);
        _hero = rows.ToDictionary(m => m.MediaId, m =>
        {
            var v = MediaService.ParseVariants(m.VariantsJson);
            var widths = v.Keys.OrderBy(k => k).ToList();
            var pick = widths.FirstOrDefault(w => w >= 960);
            return pick != 0 ? v[pick] : widths.Count > 0 ? v[widths[^1]] : m.OriginalUrl;
        });
    }

    private string? HeroOf(long? id) => id is { } i && _hero is not null && _hero.TryGetValue(i, out var u) ? u : null;

    public CatalogService(SunSteelDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<CatalogIndexDto> GetIndexAsync(CancellationToken ct = default)
    {
        await EnsureHeroAsync(ct);
        var silos = await SiloSummariesAsync(ct);
        var materials = await _db.Materials.AsNoTracking().OrderBy(m => m.DisplayOrder)
            .Select(m => new MaterialDto(m.MaterialKey, m.Name, m.Density)).ToListAsync(ct);
        var sections = await _db.SectionWeights.AsNoTracking().OrderBy(s => s.Kind).ThenBy(s => s.DisplayOrder)
            .Select(s => new SectionDto(s.Designation, s.Kind, s.KgPerMetre)).ToListAsync(ct);
        var leads = await _db.DeliveryLeadTimes.AsNoTracking().OrderBy(l => l.DisplayOrder)
            .Select(l => new LeadTimeDto(l.City, l.LeadTime)).ToListAsync(ct);
        var cities = await _db.Cities.AsNoTracking().Where(c => c.IsPublished).OrderBy(c => c.DisplayOrder)
            .Select(c => new CityCardDto(c.Slug, c.Name, c.DistanceKm, c.LeadTime)).ToListAsync(ct);
        var pipes = (await _db.MsPipeSchedule.AsNoTracking().ToListAsync(ct))
            .OrderBy(p => p.DisplayOrder).ThenBy(p => ScheduleRank(p.Schedule))
            .Select(p => new PipeScheduleDto(p.NominalSize, p.OdMm, p.Schedule, p.WallMm)).ToList();
        return new CatalogIndexDto(silos, materials, sections, leads, cities, pipes);
    }

    /// <summary>Schedules in their usual order: SCH 10, 20, 30, 40 (STD), 60, 80 (XS), 100, 120, 140, 160, XXS; anything else last.</summary>
    private static double ScheduleRank(string schedule)
    {
        var s = schedule.Trim().ToUpperInvariant();
        if (s == "STD") return 40.5;
        if (s == "XS") return 80.5;
        if (s == "XXS") return 170;
        var digits = new string(s.Where(char.IsDigit).ToArray());
        return double.TryParse(digits, out var n) ? n : 1000;
    }

    public async Task<SiloDto> GetSiloAsync(string key, CancellationToken ct = default)
    {
        await EnsureHeroAsync(ct);
        var silo = await _db.Silos.AsNoTracking().FirstOrDefaultAsync(s => s.SiloKey == key, ct)
            ?? throw new AppException("Category not found.", StatusCodes.Status404NotFound);
        var products = await _db.Products.AsNoTracking().Where(p => p.SiloId == silo.SiloId && p.IsPublished)
            .OrderBy(p => p.DisplayOrder).ToListAsync(ct);
        var summary = ToSummary(silo, products.Count);
        var faqs = await FaqsAsync("silo", key, ct);
        if (faqs.Count == 0) faqs = DefaultSiloFaqs(silo, products);
        return new SiloDto(summary,
            silo.MetaTitle ?? $"{silo.Name} Wholesale Stockist & Dealers | {Brand}",
            silo.MetaDescription ?? $"Leading supplier of {silo.TopGrades} in Madurai. Ready stock with cut-to-size service, MTC provided and fast dispatch across Tamil Nadu.",
            products.Select(p => ToCard(p, key)).ToList(), faqs);
    }

    /// <summary>Every published product as a card, in silo order, for the material library.</summary>
    public async Task<IReadOnlyList<ProductCardDto>> ListProductsAsync(CancellationToken ct = default)
    {
        await EnsureHeroAsync(ct);
        var rows = await _db.Products.AsNoTracking().Include(p => p.Silo).Where(p => p.IsPublished)
            .OrderBy(p => p.Silo.DisplayOrder).ThenBy(p => p.DisplayOrder).ToListAsync(ct);
        return rows.Select(p => ToCard(p, p.Silo.SiloKey)).ToList();
    }

    public async Task<ProductDto> GetProductAsync(string siloKey, string slug, CancellationToken ct = default)
    {
        var p = await _db.Products.AsNoTracking().Include(x => x.Silo).Include(x => x.Material)
            .FirstOrDefaultAsync(x => x.Slug == slug && x.IsPublished, ct);
        // The silo segment must match too, so /products/wrong-silo/en24.../ is a 404 rather than duplicate content.
        if (p is null || p.Silo.SiloKey != siloKey) throw new AppException("Product not found.", StatusCodes.Status404NotFound);
        return await ToProductAsync(p, ct);
    }

    public async Task<IReadOnlyList<SearchHitDto>> SearchAsync(string q, int limit, CancellationToken ct = default)
    {
        q = (q ?? "").Trim();
        if (q.Length < 2) return [];
        limit = Math.Clamp(limit, 1, 20);
        // 93 rows: rank in memory, so equivalents (JSON) and partial grades ("en2") both match.
        var rows = await _db.Products.AsNoTracking().Include(p => p.Silo).Where(p => p.IsPublished).ToListAsync(ct);
        var terms = q.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return rows.Select<Product, (int score, SearchHitDto? hit)>(p =>
            {
                var eq = Parse<List<string>>(p.EquivalentsJson) ?? [];
                var hay = $"{p.Name} {p.Grade} {p.Applications} {string.Join(' ', eq)}".ToLowerInvariant();
                if (!terms.All(hay.Contains)) return (0, null);
                var score = (p.Grade.Equals(q, StringComparison.OrdinalIgnoreCase) ? 100 : 0)
                    + (p.Grade.StartsWith(q, StringComparison.OrdinalIgnoreCase) ? 50 : 0)
                    + (p.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ? 20 : 0) + 1;
                var match = eq.FirstOrDefault(e => e.Contains(q, StringComparison.OrdinalIgnoreCase));
                return (score, new SearchHitDto(p.Slug, p.Silo.SiloKey, p.Name, p.Grade, p.Silo.ShortName, p.StockStatus, match));
            })
            .Where(x => x.hit is not null).OrderByDescending(x => x.score).Take(limit).Select(x => x.hit!).ToList();
    }

    public async Task<CityDto> GetCityAsync(string slug, CancellationToken ct = default)
    {
        await EnsureHeroAsync(ct);
        var c = await _db.Cities.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == slug.ToLower() && x.IsPublished, ct)
            ?? throw new AppException("City not found.", StatusCodes.Status404NotFound);
        var popularSlugs = Parse<List<string>>(c.PopularSlugsJson) ?? [];
        var popular = await _db.Products.AsNoTracking().Include(p => p.Silo)
            .Where(p => popularSlugs.Contains(p.Slug) && p.IsPublished).ToListAsync(ct);
        return new CityDto(c.Slug, c.Name, c.DistanceKm, c.LeadTime, c.Zones, c.Intro,
            Parse<List<string>>(c.IndustriesJson) ?? [],
            popular.OrderBy(p => popularSlugs.IndexOf(p.Slug)).Select(p => ToCard(p, p.Silo.SiloKey)).ToList(),
            c.MetaTitle ?? $"Industrial Steel & Metal Suppliers in {c.Name} | {Brand}",
            c.MetaDescription ?? $"Direct factory supply of Mild Steel, Alloy Steel, Stainless Steel, Brass & Copper to {c.Name} industrial zones. Fast dispatch from Madurai godowns.");
    }

    public async Task<PageDto> GetPageAsync(string slug, CancellationToken ct = default)
    {
        var p = await _db.Pages.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == slug, ct)
            ?? throw new AppException("Page not found.", StatusCodes.Status404NotFound);
        return new PageDto(p.Slug, p.Title, p.MetaTitle, p.MetaDescription, await FaqsAsync("page", slug, ct));
    }

    public async Task<PolicyDto> GetPolicyAsync(string slug, CancellationToken ct = default)
    {
        var p = await _db.PolicyPages.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == slug, ct)
            ?? throw new AppException("Page not found.", StatusCodes.Status404NotFound);
        return new PolicyDto(p.Slug, p.Title, p.BodyHtml, p.UpdatedAt);
    }

    // --- admin ---------------------------------------------------------------

    public async Task<PagedResult<AdminProductRowDto>> AdminListAsync(string? silo, string? q, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = _db.Products.AsNoTracking().Include(p => p.Silo).AsQueryable();
        if (!string.IsNullOrWhiteSpace(silo)) query = query.Where(p => p.Silo.SiloKey == silo);
        if (!string.IsNullOrWhiteSpace(q)) query = query.Where(p => p.Name.Contains(q) || p.Grade.Contains(q) || p.Sku.Contains(q));
        var total = await query.LongCountAsync(ct);
        var items = await query.OrderBy(p => p.Silo.DisplayOrder).ThenBy(p => p.DisplayOrder)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(p => new AdminProductRowDto(p.ProductId, p.Slug, p.Sku, p.Silo.SiloKey, p.Name, p.Grade, p.StockStatus, p.PriceNote, p.IsPublished, p.UpdatedAt))
            .ToListAsync(ct);
        return new PagedResult<AdminProductRowDto> { Items = items, Page = page, PageSize = pageSize, TotalCount = total };
    }

    public async Task<ProductDto> AdminGetAsync(long id, CancellationToken ct = default)
    {
        var p = await _db.Products.AsNoTracking().Include(x => x.Silo).Include(x => x.Material).FirstOrDefaultAsync(x => x.ProductId == id, ct)
            ?? throw new AppException("Product not found.", StatusCodes.Status404NotFound);
        // The editor shows only what staff typed: the generated summary / SEO text stays automatic until overridden.
        var dto = await ToProductAsync(p, ct);
        return dto with { Summary = p.Summary ?? "", MetaTitle = p.MetaTitle ?? "", MetaDescription = p.MetaDescription ?? "" };
    }

    public async Task<ProductDto> UpdateAsync(long actorId, long id, UpdateProductRequest r, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) throw new AppException("Product name is required.");
        CheckStatus(r.StockStatus);
        var p = await _db.Products.FirstOrDefaultAsync(x => x.ProductId == id, ct)
            ?? throw new AppException("Product not found.", StatusCodes.Status404NotFound);
        // Slug and silo are deliberately not editable here: they are the public URL (SEO).
        p.Name = r.Name.Trim();
        p.SizeRange = Clean(r.SizeRange);
        p.Applications = Clean(r.Applications);
        p.Summary = Clean(r.Summary);
        p.Condition = Clean(r.Condition);
        p.Machinability = Clean(r.Machinability);
        if (r.Chemistry is not null) p.ChemistryJson = JsonSerializer.Serialize(r.Chemistry, Json);
        if (r.Mechanical is not null) p.MechanicalJson = JsonSerializer.Serialize(r.Mechanical, Json);
        if (r.Equivalents is not null) p.EquivalentsJson = JsonSerializer.Serialize(r.Equivalents.Where(e => !string.IsNullOrWhiteSpace(e)).Select(e => e.Trim()), Json);
        p.StockStatus = r.StockStatus;
        p.PriceNote = Clean(r.PriceNote);
        p.MetaTitle = Clean(r.MetaTitle);
        p.MetaDescription = Clean(r.MetaDescription);
        p.IsPublished = r.IsPublished;
        if (r.HeroMediaId is { } hm && !await _db.MediaAssets.AnyAsync(m => m.MediaId == hm && m.Kind == "image", ct))
            throw new AppException("The chosen photo no longer exists.");
        p.HeroMediaId = r.HeroMediaId;
        _audit.Record(actorId, "Update", "Product", p.Slug, p.Name);
        await _db.SaveChangesAsync(ct);
        return await AdminGetAsync(id, ct);
    }

    public async Task UpdateStockAsync(long actorId, long id, string status, CancellationToken ct = default)
    {
        CheckStatus(status);
        var p = await _db.Products.FirstOrDefaultAsync(x => x.ProductId == id, ct)
            ?? throw new AppException("Product not found.", StatusCodes.Status404NotFound);
        p.StockStatus = status;
        _audit.Record(actorId, "Stock", "Product", p.Slug, status);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateDensityAsync(long actorId, string materialKey, decimal density, CancellationToken ct = default)
    {
        if (density is < 0.5m or > 25m) throw new AppException("Density must be between 0.5 and 25 g/cm³.");
        var m = await _db.Materials.FirstOrDefaultAsync(x => x.MaterialKey == materialKey, ct)
            ?? throw new AppException("Material not found.", StatusCodes.Status404NotFound);
        m.Density = density;
        _audit.Record(actorId, "Update", "Material", materialKey, density.ToString("0.000"));
        await _db.SaveChangesAsync(ct);
    }

    // --- helpers -------------------------------------------------------------

    private async Task<List<SiloSummaryDto>> SiloSummariesAsync(CancellationToken ct)
    {
        var counts = await _db.Products.AsNoTracking().Where(p => p.IsPublished)
            .GroupBy(p => p.SiloId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var silos = await _db.Silos.AsNoTracking().OrderBy(s => s.DisplayOrder).ToListAsync(ct);
        return silos.Select(s => ToSummary(s, counts.GetValueOrDefault(s.SiloId))).ToList();
    }

    private async Task<ProductDto> ToProductAsync(Product p, CancellationToken ct)
    {
        await EnsureHeroAsync(ct);
        var key = p.Silo.SiloKey;
        var eq = Parse<List<string>>(p.EquivalentsJson) ?? [];
        var related = await _db.Products.AsNoTracking()
            .Where(x => x.SiloId == p.SiloId && x.ProductId != p.ProductId && x.IsPublished)
            .OrderBy(x => Math.Abs(x.DisplayOrder - p.DisplayOrder)).Take(4).ToListAsync(ct);
        var faqs = await FaqsAsync("product", p.Slug, ct);
        if (faqs.Count == 0) faqs = DefaultProductFaqs(p, eq);
        var firstEq = eq.FirstOrDefault();
        return new ProductDto(
            p.Slug, p.Sku, key, p.Silo.Name, p.Name, p.Grade, p.MaterialKey, p.Material?.Name, p.Material?.Density,
            SplitForms(p.Forms), p.SizeRange, p.Applications, p.Summary ?? DefaultSummary(p, key),
            p.Condition, p.Machinability,
            Parse<List<ChemistryRow>>(p.ChemistryJson) ?? [], Parse<List<PropertyRow>>(p.MechanicalJson) ?? [], eq,
            p.StockStatus, p.PriceNote, HeroOf(p.HeroMediaId),
            p.MetaTitle ?? $"{p.Name} Stockist & Supplier in Madurai | {Brand}",
            p.MetaDescription ?? $"Buy cut-to-size {p.Name}{(firstEq is null ? "" : $" ({firstEq})")} from {Brand} Madurai. MTC provided, overhead crane loading, fast dispatch across Tamil Nadu.",
            faqs, related.Select(x => ToCard(x, key)).ToList(), p.HeroMediaId, p.IsPublished);
    }

    private async Task<List<FaqDto>> FaqsAsync(string scope, string key, CancellationToken ct) =>
        await _db.Faqs.AsNoTracking().Where(f => f.Scope == scope && f.ScopeKey == key && f.IsVisible)
            .OrderBy(f => f.DisplayOrder).Select(f => new FaqDto(f.Question, f.Answer)).ToListAsync(ct);

    private static List<FaqDto> DefaultSiloFaqs(Silo s, List<Product> ps)
    {
        var shortName = s.ShortName.ToLowerInvariant();
        return
        [
            new($"Which {shortName} grades do you keep in stock?", $"{ps.Count} products, including {string.Join(", ", ps.Take(6).Select(p => p.Grade).Distinct())}, listed above with size ranges and stock status."),
            new($"Can you cut {shortName} material to size?", "Yes. Rounds, flats and blocks are band-saw cut to ±1 mm; pipes and sections are cut to length. Cutting is quoted with the material."),
            new("Do you supply mill test certificates?", "Mill material is supplied with an MTC on request, traceable to the heat number. Mention it on your request."),
            new("How quickly can you deliver?", "Same day in Madurai, 1 day to Tirunelveli, Tuticorin and Trichy, 1–2 days to Coimbatore and Salem, 2–3 days to Chennai."),
        ];
    }

    private static List<FaqDto> DefaultProductFaqs(Product p, List<string> eq)
    {
        if (p.MaterialKey is null)
            return
            [
                new($"Which sizes of {p.Name.ToLowerInvariant()} do you stock?", $"{p.SizeRange}. Ask on WhatsApp for brands and current stock."),
                new("Can I collect from the counter?", "Yes, from our Simmakkal godown, Monday to Saturday, or we send them with your steel order."),
            ];
        return
        [
            new($"Can you cut {p.Grade} to my sizes?", $"Yes. {p.Grade} is band-saw cut to ±1 mm. Send piece sizes and quantities with your request; cutting is quoted with the material."),
            new($"Is a mill test certificate provided with {p.Grade}?", "An MTC is supplied with mill material on request, traceable to the heat number."),
            new($"What sizes are in stock?", $"{p.SizeRange}. For large tonnage, message us to reserve material."),
            new($"What are the equivalents of {p.Grade}?", eq.Count > 0 ? $"{string.Join(", ", eq)}. Equivalents are close matches; confirm against your drawing's specification." : "Ask our sales team for the nearest equivalent to your specification."),
        ];
    }

    private static string DefaultSummary(Product p, string siloKey) => siloKey switch
    {
        "cutting-workshop-tools" => $"{p.Name} stocked in Madurai for lathe, milling and fabrication shops. Counter pickup or same-day dispatch with your steel order.",
        "engineering-plastics" => $"{p.Name} in ready stock: {p.SizeRange}. Cut to length or sheet size on request.",
        _ => $"{p.Name} in ready stock at our Simmakkal godowns, {(p.Condition ?? "as rolled").ToLowerInvariant()}, {p.SizeRange}. Band-saw cut to your sizes with mill test certificates on request.",
    };

    private SiloSummaryDto ToSummary(Silo s, int count) => new(s.SiloKey, s.Name, s.ShortName, s.Glyph, s.Intro, s.TopGrades, count, HeroOf(s.HeroMediaId));

    private ProductCardDto ToCard(Product p, string siloKey) =>
        new(p.Slug, siloKey, p.Name, p.Grade, p.MaterialKey, SplitForms(p.Forms), p.SizeRange, p.StockStatus, Parse<List<string>>(p.EquivalentsJson) ?? [], HeroOf(p.HeroMediaId));

    private static List<string> SplitForms(string forms) => forms.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    private static T? Parse<T>(string? json) where T : class
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<T>(json, Json); } catch (JsonException) { return null; }
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static void CheckStatus(string status)
    {
        if (!StockStatuses.Contains(status)) throw new AppException($"Stock status must be one of: {string.Join(", ", StockStatuses)}.");
    }
}
