namespace sunsteel.api.Data.Entities;

/// <summary>An uploaded image (migration 005). VariantsJson maps pixel width to a WebP URL.</summary>
public sealed class MediaAsset
{
    public long MediaId { get; set; }
    public string Kind { get; set; } = "image";
    public string FileName { get; set; } = string.Empty;
    public string OriginalUrl { get; set; } = string.Empty;
    public string? VariantsJson { get; set; }
    public string? Placeholder { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public long SizeBytes { get; set; }
    public string? AltText { get; set; }
    public string? Caption { get; set; }
    public string? Category { get; set; }
    public long? UploadedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>A photo in the home-page sliding gallery (migration 013).</summary>
public sealed class GalleryItem
{
    public long GalleryItemId { get; set; }
    public long MediaId { get; set; }
    public string? Title { get; set; }
    public string? Caption { get; set; }
    public string? LinkUrl { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsVisible { get; set; } = true;
}

/// <summary>A banner in the home-page slideshow (migration 014).</summary>
public sealed class HomeSlide
{
    public long HomeSlideId { get; set; }
    public long MediaId { get; set; }
    public string? Title { get; set; }
    public string? Caption { get; set; }
    public string? CtaText { get; set; }
    public string? LinkUrl { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsVisible { get; set; } = true;
}
