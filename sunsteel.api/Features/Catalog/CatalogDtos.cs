namespace sunsteel.api.Features.Catalog;

public sealed record ChemistryRow(string El, string? Min, string? Max);
public sealed record PropertyRow(string K, string V);
public sealed record FaqDto(string Question, string Answer);

public sealed record SiloSummaryDto(string Key, string Name, string ShortName, string Glyph, string? Intro, string? TopGrades, int ProductCount, string? HeroUrl);

public sealed record ProductCardDto(
    string Slug, string SiloKey, string Name, string Grade, string? MaterialKey, IReadOnlyList<string> Forms,
    string? SizeRange, string StockStatus, IReadOnlyList<string> Equivalents, string? HeroUrl)
{
    public string Path => $"/products/{SiloKey}/{Slug}/";
}

public sealed record ProductDto(
    string Slug, string Sku, string SiloKey, string SiloName, string Name, string Grade,
    string? MaterialKey, string? MaterialName, decimal? Density, IReadOnlyList<string> Forms,
    string? SizeRange, string? Applications, string Summary, string? Condition, string? Machinability,
    IReadOnlyList<ChemistryRow> Chemistry, IReadOnlyList<PropertyRow> Mechanical, IReadOnlyList<string> Equivalents,
    string StockStatus, string? PriceNote, string? HeroUrl, string MetaTitle, string MetaDescription,
    IReadOnlyList<FaqDto> Faqs, IReadOnlyList<ProductCardDto> Related, long? HeroMediaId = null, bool IsPublished = true)
{
    public string Path => $"/products/{SiloKey}/{Slug}/";
}

public sealed record SiloDto(SiloSummaryDto Silo, string MetaTitle, string MetaDescription, IReadOnlyList<ProductCardDto> Products, IReadOnlyList<FaqDto> Faqs);

public sealed record MaterialDto(string Key, string Name, decimal Density);
public sealed record SectionDto(string Designation, string Kind, decimal KgPerMetre);
public sealed record LeadTimeDto(string City, string LeadTime);
/// <summary>One row of the MS pipe schedule (ASME B36.10M): the outside diameter and wall thickness of a nominal size at a schedule.</summary>
public sealed record PipeScheduleDto(string NominalSize, decimal OdMm, string Schedule, decimal WallMm);

/// <summary>Everything the header, home page, calculator and RFQ need in one cached call.</summary>
public sealed record CatalogIndexDto(
    IReadOnlyList<SiloSummaryDto> Silos, IReadOnlyList<MaterialDto> Materials, IReadOnlyList<SectionDto> Sections,
    IReadOnlyList<LeadTimeDto> LeadTimes, IReadOnlyList<CityCardDto> Cities, IReadOnlyList<PipeScheduleDto> MsPipes);

public sealed record SearchHitDto(string Slug, string SiloKey, string Name, string Grade, string SiloName, string StockStatus, string? Match)
{
    public string Path => $"/products/{SiloKey}/{Slug}/";
}

public sealed record CityCardDto(string Slug, string Name, int DistanceKm, string? LeadTime)
{
    public string Path => $"/steel-suppliers-{Slug}/";
}

public sealed record CityDto(
    string Slug, string Name, int DistanceKm, string? LeadTime, string? Zones, string? Intro,
    IReadOnlyList<string> Industries, IReadOnlyList<ProductCardDto> Popular, string MetaTitle, string MetaDescription);

public sealed record PageDto(string Slug, string Title, string? MetaTitle, string? MetaDescription, IReadOnlyList<FaqDto> Faqs);
public sealed record PolicyDto(string Slug, string Title, string BodyHtml, DateTime UpdatedAt);

// --- admin ---
public sealed record AdminProductRowDto(long ProductId, string Slug, string Sku, string SiloKey, string Name, string Grade, string StockStatus, string? PriceNote, bool IsPublished, DateTime? UpdatedAt);

public sealed record UpdateProductRequest(
    string Name, string? SizeRange, string? Applications, string? Summary, string? Condition, string? Machinability,
    IReadOnlyList<ChemistryRow>? Chemistry, IReadOnlyList<PropertyRow>? Mechanical, IReadOnlyList<string>? Equivalents,
    string StockStatus, string? PriceNote, string? MetaTitle, string? MetaDescription, bool IsPublished, long? HeroMediaId = null);

public sealed record UpdateStockRequest(string StockStatus);
public sealed record UpdateDensityRequest(decimal Density);
