namespace sunsteel.api.Data.Entities;

/// <summary>A priced quotation for a customer, from a request or from scratch (migrations 015, 016).</summary>
public sealed class Quote
{
    public long QuoteId { get; set; }
    public string Reference { get; set; } = string.Empty;
    public long? LeadId { get; set; }
    /// <summary>The customer master row (migration 020).</summary>
    public long? CustomerId { get; set; }
    public string Status { get; set; } = "Draft";
    /// <summary>Project | Wholesale | Retail | CutPieces (migration 017).</summary>
    public string QuoteType { get; set; } = "Retail";
    public DateOnly QuoteDate { get; set; }
    public int ValidDays { get; set; } = 3;
    public string CustomerName { get; set; } = string.Empty;
    public string? Company { get; set; }
    public string? Gstin { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? City { get; set; }
    public string? Address { get; set; }
    /// <summary>The buyer's order or reference number.</summary>
    public string? BuyerRef { get; set; }
    /// <summary>Lorry or transport the goods go by.</summary>
    public string? DispatchedThrough { get; set; }
    public decimal CuttingCharge { get; set; }
    public decimal LoadingCharge { get; set; }
    public decimal UnloadingCharge { get; set; }
    /// <summary>Freight / transport.</summary>
    public decimal TransportCharge { get; set; }
    public decimal Discount { get; set; }
    /// <summary>GST rate on cutting, loading, unloading and freight.</summary>
    public decimal GstRate { get; set; } = 18m;
    public bool InterState { get; set; }
    public decimal GrandTotal { get; set; }
    public string? Notes { get; set; }
    public string? PaymentTerms { get; set; }
    public string? BankDetails { get; set; }
    public string? Terms { get; set; }
    public long? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<QuoteItem> Items { get; set; } = [];
}

/// <summary>One line. ItemType: Calculated | ManualWeight | ManualUnit (see migration 016).</summary>
public sealed class QuoteItem
{
    public long QuoteItemId { get; set; }
    public long QuoteId { get; set; }
    public string ItemType { get; set; } = "ManualWeight";
    public string? Brand { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? Size { get; set; }
    public string? Model { get; set; }
    public int Quantity { get; set; } = 1;
    public string Unit { get; set; } = "nos";
    public string? Hsn { get; set; }
    public string GstCategory { get; set; } = "Raw";
    public decimal GstRate { get; set; }
    public string? Remarks { get; set; }
    public string? MaterialKey { get; set; }
    public string? Form { get; set; }
    public string? DimsJson { get; set; }
    public decimal? LengthMm { get; set; }
    public decimal? PieceKg { get; set; }
    public decimal? WeightPerUnit { get; set; }
    /// <summary>Total weight of the line; 0 for by-unit lines.</summary>
    public decimal Kg { get; set; }
    public decimal RatePerKg { get; set; }
    public decimal? UnitPrice { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>Branded pipes, roof sheets, tools: picked on manual lines (migration 016).</summary>
public sealed class QuoteProduct
{
    public long QuoteProductId { get; set; }
    public string ItemType { get; set; } = "ManualUnit";
    public string GstCategory { get; set; } = "Finished";
    public string? Brand { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? Size { get; set; }
    public string? Model { get; set; }
    public string Unit { get; set; } = "nos";
    public decimal? WeightPerUnit { get; set; }
    public string? Hsn { get; set; }
    public decimal? GstRate { get; set; }
    public decimal? ReferenceRate { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class QuoteHsn
{
    public long QuoteHsnId { get; set; }
    public string Form { get; set; } = string.Empty;
    public string MaterialKey { get; set; } = string.Empty;
    public string Hsn { get; set; } = string.Empty;
}

public sealed class MsPipeScheduleRow
{
    public long MsPipeScheduleId { get; set; }
    public string NominalSize { get; set; } = string.Empty;
    public decimal OdMm { get; set; }
    public string Schedule { get; set; } = string.Empty;
    public decimal WallMm { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>Customer master (migration 020). Filled in from quotations, editable, importable and exportable.</summary>
public sealed class Customer
{
    public long CustomerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Company { get; set; }
    public string? Gstin { get; set; }
    /// <summary>Normalised "+91 XXXXX XXXXX"; one customer per phone number.</summary>
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? City { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
