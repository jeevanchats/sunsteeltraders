namespace sunsteel.api.Data.Entities;

/// <summary>One of the seven product families (migration 006). SiloKey is the URL segment.</summary>
public sealed class Silo
{
    public long SiloId { get; set; }
    public string SiloKey { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public string Glyph { get; set; } = "round";
    public string? Intro { get; set; }
    public string? TopGrades { get; set; }
    public long? HeroMediaId { get; set; }
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<Product> Products { get; set; } = [];
}

/// <summary>Material and its density in g/cm³, used by the weight calculator.</summary>
public sealed class Material
{
    public string MaterialKey { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Density { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>A catalogue SKU. JSON columns are kept as raw strings and parsed in the service.</summary>
public sealed class Product
{
    public long ProductId { get; set; }
    public long SiloId { get; set; }
    public Silo Silo { get; set; } = null!;
    public string Slug { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Grade { get; set; } = string.Empty;
    public string? MaterialKey { get; set; }
    public Material? Material { get; set; }
    public string Forms { get; set; } = string.Empty;
    public string? SizeRange { get; set; }
    public string? Applications { get; set; }
    /// <summary>Trade names customers search for ("MS polish rod"), comma separated. Shown as "Also called".</summary>
    public string? Aliases { get; set; }
    public string? Summary { get; set; }
    public string? Condition { get; set; }
    public string? Machinability { get; set; }
    public string? ChemistryJson { get; set; }
    public string? MechanicalJson { get; set; }
    public string? EquivalentsJson { get; set; }
    public string StockStatus { get; set; } = "In stock";
    public string? PriceNote { get; set; }
    public long? HeroMediaId { get; set; }
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public bool IsPublished { get; set; } = true;
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>IS 808 rolled section weight (kg/m) for beams and channels.</summary>
public sealed class SectionWeight
{
    public string Designation { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public decimal KgPerMetre { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>Regional landing page /steel-suppliers-{Slug}/.</summary>
public sealed class City
{
    public long CityId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int DistanceKm { get; set; }
    public string? LeadTime { get; set; }
    public string? Zones { get; set; }
    public string? Intro { get; set; }
    public string? IndustriesJson { get; set; }
    public string? PopularSlugsJson { get; set; }
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public bool IsPublished { get; set; } = true;
    public int DisplayOrder { get; set; }
}

public sealed class DeliveryLeadTime
{
    public string City { get; set; } = string.Empty;
    public string LeadTime { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}

/// <summary>Public page row: SEO for each fixed route (migration 007).</summary>
public sealed class Page
{
    public long PageId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public long? OgMediaId { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>FAQ for a page, silo or product. Scope: page | silo | product.</summary>
public sealed class Faq
{
    public long FaqId { get; set; }
    public string Scope { get; set; } = string.Empty;
    public string ScopeKey { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsVisible { get; set; } = true;
}

public sealed class PolicyPage
{
    public string Slug { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string BodyHtml { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}
