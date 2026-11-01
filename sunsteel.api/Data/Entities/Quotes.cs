namespace sunsteel.api.Data.Entities;

/// <summary>A priced quotation for a customer, from a request or from scratch (migration 015).</summary>
public sealed class Quote
{
    public long QuoteId { get; set; }
    public string Reference { get; set; } = string.Empty;
    public long? LeadId { get; set; }
    public string Status { get; set; } = "Draft";
    public DateOnly QuoteDate { get; set; }
    public int ValidDays { get; set; } = 7;
    public string CustomerName { get; set; } = string.Empty;
    public string? Company { get; set; }
    public string? Gstin { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? City { get; set; }
    public string? Address { get; set; }
    public decimal CuttingCharge { get; set; }
    public decimal LoadingCharge { get; set; }
    public decimal UnloadingCharge { get; set; }
    public decimal TransportCharge { get; set; }
    public decimal Discount { get; set; }
    public decimal GstRate { get; set; } = 18m;
    public bool InterState { get; set; }
    public decimal GrandTotal { get; set; }
    public string? Notes { get; set; }
    public string? Terms { get; set; }
    public long? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<QuoteItem> Items { get; set; } = [];
}

public sealed class QuoteItem
{
    public long QuoteItemId { get; set; }
    public long QuoteId { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? Size { get; set; }
    public int Quantity { get; set; } = 1;
    public decimal Kg { get; set; }
    public decimal RatePerKg { get; set; }
    public int DisplayOrder { get; set; }
}
