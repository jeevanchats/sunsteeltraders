namespace sunsteel.api.Data.Entities;

/// <summary>An RFQ, catalogue download, contact message or call-back request (migration 008).</summary>
public sealed class Lead
{
    public long LeadId { get; set; }
    public string Reference { get; set; } = string.Empty;
    public string Type { get; set; } = "RFQ";
    public string Status { get; set; } = "New";
    public string Channel { get; set; } = "Web";
    public string Name { get; set; } = string.Empty;
    public string? Company { get; set; }
    public string? Gstin { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? City { get; set; }
    public string? Industry { get; set; }
    public string? Message { get; set; }
    public DateTime? CallbackAt { get; set; }
    public decimal? TotalKg { get; set; }
    public string? SourcePage { get; set; }
    public string? UtmSource { get; set; }
    public string? ClientIp { get; set; }
    public long? AssignedTo { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<LeadItem> Items { get; set; } = [];
    public List<LeadFile> Files { get; set; } = [];
    public List<LeadNote> Notes { get; set; } = [];
}

public sealed class LeadItem
{
    public long LeadItemId { get; set; }
    public long LeadId { get; set; }
    public long? ProductId { get; set; }
    public string GradeText { get; set; } = string.Empty;
    public string Form { get; set; } = string.Empty;
    public string? DimsJson { get; set; }
    public string DimsText { get; set; } = string.Empty;
    public decimal? LengthMm { get; set; }
    public int Quantity { get; set; } = 1;
    public decimal? Kg { get; set; }
    public bool CutToSize { get; set; }
    public int DisplayOrder { get; set; }
}

public sealed class LeadFile
{
    public long LeadFileId { get; set; }
    public long LeadId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredPath { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class LeadNote
{
    public long LeadNoteId { get; set; }
    public long LeadId { get; set; }
    public long? UserId { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

/// <summary>One public page seen (migration 022). No IP address or cookie: VisitorKey is a one-way hash that only holds within a day.</summary>
public sealed class PageView
{
    public long PageViewId { get; set; }
    public DateTime At { get; set; }
    /// <summary>The calendar day in India (UTC+5:30).</summary>
    public DateOnly Day { get; set; }
    public string Path { get; set; } = string.Empty;
    public string VisitorKey { get; set; } = string.Empty;
    /// <summary>Direct | Search | Social | Referral</summary>
    public string Source { get; set; } = "Direct";
    public string? Referrer { get; set; }
    /// <summary>Desktop | Mobile | Tablet</summary>
    public string Device { get; set; } = "Desktop";
}

/// <summary>Anonymous WhatsApp / call / email / map click, for the dashboard.</summary>
public sealed class ClickEvent
{
    public long ClickEventId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string? Page { get; set; }
    public DateTime At { get; set; }
}
