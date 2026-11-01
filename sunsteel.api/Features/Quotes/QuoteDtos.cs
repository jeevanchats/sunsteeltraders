namespace sunsteel.api.Features.Quotes;

public sealed record QuoteItemInput(string Description, string? Size, int Quantity, decimal Kg, decimal RatePerKg);

/// <summary>Create or replace a quote. Totals are always recomputed on the server.</summary>
public sealed record SaveQuoteRequest(
    string CustomerName, string? Company, string? Gstin, string Phone, string? Email, string? City, string? Address,
    DateOnly? QuoteDate, int ValidDays,
    decimal CuttingCharge, decimal LoadingCharge, decimal UnloadingCharge, decimal TransportCharge, decimal Discount,
    decimal GstRate, bool InterState, string? Notes, string? Terms,
    IReadOnlyList<QuoteItemInput> Items);

public sealed record QuoteItemDto(string Description, string? Size, int Quantity, decimal Kg, decimal RatePerKg, decimal Amount);

public sealed record QuoteTotalsDto(
    decimal TotalKg, decimal MaterialTotal, decimal Charges, decimal Discount, decimal Taxable,
    decimal Cgst, decimal Sgst, decimal Igst, decimal RoundOff, decimal GrandTotal);

public sealed record QuoteRowDto(long QuoteId, string Reference, string Status, string CustomerName, string? Company, string Phone,
    int ItemCount, decimal GrandTotal, DateOnly QuoteDate, string? LeadReference);

public sealed record QuoteDetailDto(
    long QuoteId, string Reference, string Status, long? LeadId, string? LeadReference,
    DateOnly QuoteDate, int ValidDays, DateOnly ValidUntil,
    string CustomerName, string? Company, string? Gstin, string Phone, string? Email, string? City, string? Address,
    decimal CuttingCharge, decimal LoadingCharge, decimal UnloadingCharge, decimal TransportCharge, decimal Discount,
    decimal GstRate, bool InterState, string? Notes, string? Terms,
    IReadOnlyList<QuoteItemDto> Items, QuoteTotalsDto Totals, string WhatsAppUrl, DateTime CreatedAt);

/// <summary>Values a blank quote starts with (from Site settings).</summary>
public sealed record QuoteDefaultsDto(int ValidDays, decimal GstRate, string? Terms);

public sealed record UpdateQuoteStatusRequest(string Status);
