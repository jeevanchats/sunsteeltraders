using sunsteel.api.Features.Catalog;

namespace sunsteel.api.Features.Quotes;

/// <summary>
/// One line as sent by the editor. ItemType: Calculated (material + shape + size + length + pieces, weight worked out here),
/// ManualWeight (quantity × weight per unit × rate per kg) or ManualUnit (quantity × unit price).
/// Form for calculated lines: the catalogue shapes plus "sspipe" and "mspipe".
/// </summary>
public sealed record QuoteItemInput(
    string ItemType, string? Brand, string? Description, string? Size, string? Model,
    int Quantity, string? Unit, string? Hsn, string? GstCategory, decimal? GstRate, string? Remarks,
    string? MaterialKey, string? Form, Dictionary<string, double>? Dims, string? Section, string? Schedule, double LengthMm,
    decimal WeightPerUnit, decimal RatePerKg, decimal? UnitPrice);

/// <summary>Create or replace a quote. Weights, amounts and totals are always recomputed on the server.</summary>
public sealed record SaveQuoteRequest(
    string CustomerName, string? Company, string? Gstin, string Phone, string? Email, string? City, string? Address,
    string QuoteType, DateOnly? QuoteDate, int ValidDays,
    decimal CuttingCharge, decimal LoadingCharge, decimal UnloadingCharge, decimal TransportCharge, decimal Discount,
    decimal GstRate, bool InterState, string? Notes, string? PaymentTerms, string? BankDetails, string? Terms,
    IReadOnlyList<QuoteItemInput> Items);

public sealed record QuoteItemDto(
    string ItemType, string? Brand, string Description, string? Size, string? Model,
    int Quantity, string Unit, string? Hsn, string GstCategory, decimal GstRate, string? Remarks,
    string? MaterialKey, string? Form, Dictionary<string, double>? Dims, string? Section, string? Schedule, decimal? LengthMm,
    decimal? PieceKg, decimal? KgPerMetre, decimal WeightPerUnit, decimal Kg, decimal RatePerKg, decimal? UnitPrice, decimal? Amount);

public sealed record TaxGroupDto(decimal Rate, decimal Taxable, decimal Cgst, decimal Sgst, decimal Igst);

public sealed record QuoteTotalsDto(
    decimal TotalKg, decimal Subtotal, decimal Charges, decimal Discount, decimal Taxable,
    decimal Cgst, decimal Sgst, decimal Igst, decimal RoundOff, decimal GrandTotal, IReadOnlyList<TaxGroupDto> TaxGroups);

public sealed record QuoteRowDto(long QuoteId, string Reference, string Status, string QuoteType, string CustomerName, string? Company, string Phone,
    int ItemCount, decimal GrandTotal, DateOnly QuoteDate, string? LeadReference);

public sealed record QuoteDetailDto(
    long QuoteId, string Reference, string Status, string QuoteType, long? LeadId, string? LeadReference,
    DateOnly QuoteDate, int ValidDays, DateOnly ValidUntil,
    string CustomerName, string? Company, string? Gstin, string Phone, string? Email, string? City, string? Address,
    decimal CuttingCharge, decimal LoadingCharge, decimal UnloadingCharge, decimal TransportCharge, decimal Discount,
    decimal GstRate, bool InterState, string? Notes, string? PaymentTerms, string? BankDetails, string? Terms,
    IReadOnlyList<QuoteItemDto> Items, QuoteTotalsDto Totals, string WhatsAppUrl, DateTime CreatedAt);

/// <summary>Values a blank quote starts with. A null GST rate means the customer has not supplied it yet.</summary>
public sealed record QuoteDefaultsDto(
    int ValidDays, decimal? GstRaw, decimal? GstFinished, int WeightDecimals, string? Terms, string? PaymentTerms, string? BankDetails);

public sealed record MsPipeDto(string NominalSize, decimal OdMm, string Schedule, decimal WallMm);
public sealed record HsnDto(string Form, string MaterialKey, string Hsn);
public sealed record QuoteProductDto(
    long Id, string ItemType, string GstCategory, string? Brand, string Description, string? Size, string? Model, string Unit,
    decimal? WeightPerUnit, string? Hsn, decimal? GstRate, decimal? ReferenceRate, bool IsActive);

/// <summary>Everything the editor needs in one call.</summary>
public sealed record QuoteLookupsDto(
    IReadOnlyList<MaterialDto> Materials, IReadOnlyList<SectionDto> Sections, IReadOnlyList<MsPipeDto> MsPipes,
    IReadOnlyList<HsnDto> Hsn, IReadOnlyList<QuoteProductDto> Products, QuoteDefaultsDto Defaults);

/// <summary>The quote settings the owner maintains (Site settings keys Quote*).</summary>
public sealed record QuoteSettingsDto(
    decimal? GstRaw, decimal? GstFinished, int ValidDays, int WeightDecimals, string? PaymentTerms, string? BankDetails, string? Terms);

public sealed record UpdateQuoteStatusRequest(string Status);
