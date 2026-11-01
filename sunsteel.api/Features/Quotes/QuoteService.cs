using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using sunsteel.api.Common.Exceptions;
using sunsteel.api.Common.Models;
using sunsteel.api.Data;
using sunsteel.api.Data.Entities;
using sunsteel.api.Features.Audit;
using sunsteel.api.Features.Catalog;
using sunsteel.api.Features.Leads;

namespace sunsteel.api.Features.Quotes;

public interface IQuoteService
{
    Task<PagedResult<QuoteRowDto>> ListAsync(string? status, string? type, string? q, int page, int pageSize, CancellationToken ct = default);
    Task<QuoteDetailDto> GetAsync(long id, CancellationToken ct = default);
    Task<QuoteLookupsDto> LookupsAsync(CancellationToken ct = default);
    Task<QuoteDetailDto> CreateAsync(long actorId, SaveQuoteRequest r, CancellationToken ct = default);
    Task<QuoteDetailDto> CreateFromLeadAsync(long actorId, long leadId, CancellationToken ct = default);
    Task<QuoteDetailDto> UpdateAsync(long actorId, long id, SaveQuoteRequest r, CancellationToken ct = default);
    Task<QuoteDetailDto> SetStatusAsync(long actorId, long id, string status, CancellationToken ct = default);
    Task<(byte[] Pdf, string FileName)> PdfAsync(long id, CancellationToken ct = default);
}

/// <summary>
/// Quotations. Calculated lines get their weight here from the catalogue densities, IS 808 sections and the MS pipe
/// schedule (never trusted from the browser); manual lines are typed. GST is per line at a rate frozen on save.
/// A quote can start from a web request or blank. Marking it Sent / Accepted / Rejected moves its request to Quoted / Won / Lost.
/// </summary>
public sealed partial class QuoteService : IQuoteService
{
    public static readonly string[] Statuses = ["Draft", "Sent", "Accepted", "Rejected"];
    public static readonly string[] QuoteTypes = ["Project", "Wholesale", "Retail", "CutPieces"];
    public static readonly string[] ItemTypes = ["Calculated", "ManualWeight", "ManualUnit"];
    public static readonly string[] Units = ["nos", "pcs", "set", "sheet", "metre", "ft", "kg"];
    private const string HomeState = "33"; // Tamil Nadu: first two digits of a GSTIN

    private sealed record StoredDims(Dictionary<string, double>? Dims, string? Section, string? Schedule);
    private sealed record RefData(Dictionary<string, Material> Materials, Dictionary<string, decimal> Sections,
        List<MsPipeScheduleRow> Pipes, List<QuoteHsn> Hsn, QuoteDefaultsDto Defaults);

    private readonly SunSteelDbContext _db;
    private readonly IAuditService _audit;

    public QuoteService(SunSteelDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    // --- reads -----------------------------------------------------------------

    public async Task<PagedResult<QuoteRowDto>> ListAsync(string? status, string? type, string? q, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = _db.Quotes.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(type)) query = query.Where(x => x.QuoteType == type);
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(x => x.CustomerName.Contains(q) || x.Phone.Contains(q) || x.Reference.Contains(q) || (x.Company != null && x.Company.Contains(q)));
        var total = await query.LongCountAsync(ct);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new QuoteRowDto(x.QuoteId, x.Reference, x.Status, x.QuoteType, x.CustomerName, x.Company, x.Phone, x.Items.Count, x.GrandTotal, x.QuoteDate,
                _db.Leads.Where(l => l.LeadId == x.LeadId).Select(l => l.Reference).FirstOrDefault()))
            .ToListAsync(ct);
        return new PagedResult<QuoteRowDto> { Items = rows, Page = page, PageSize = pageSize, TotalCount = total };
    }

    public async Task<QuoteDetailDto> GetAsync(long id, CancellationToken ct = default)
    {
        var x = await _db.Quotes.AsNoTracking().Include(q => q.Items).FirstOrDefaultAsync(q => q.QuoteId == id, ct)
            ?? throw new AppException("Quotation not found.", StatusCodes.Status404NotFound);
        var leadRef = x.LeadId is { } lid ? await _db.Leads.AsNoTracking().Where(l => l.LeadId == lid).Select(l => l.Reference).FirstOrDefaultAsync(ct) : null;
        var settings = await SettingsAsync(ct);
        return new QuoteDetailDto(x.QuoteId, x.Reference, x.Status, x.QuoteType, x.LeadId, leadRef,
            x.QuoteDate, x.ValidDays, x.QuoteDate.AddDays(x.ValidDays),
            x.CustomerName, x.Company, x.Gstin, x.Phone, x.Email, x.City, x.Address, x.BuyerRef, x.DispatchedThrough,
            x.CuttingCharge, x.LoadingCharge, x.UnloadingCharge, x.TransportCharge, x.Discount, x.GstRate, x.InterState,
            x.Notes, x.PaymentTerms, x.BankDetails, x.Terms,
            x.Items.OrderBy(i => i.DisplayOrder).Select(ToDto).ToList(), TotalsOf(x), WhatsAppUrl(x, settings), x.CreatedAt);
    }

    public async Task<QuoteLookupsDto> LookupsAsync(CancellationToken ct = default)
    {
        var rd = await LoadRefAsync(ct);
        var materials = await _db.Materials.AsNoTracking().OrderBy(m => m.DisplayOrder).Select(m => new MaterialDto(m.MaterialKey, m.Name, m.Density)).ToListAsync(ct);
        var sections = await _db.SectionWeights.AsNoTracking().OrderBy(s => s.DisplayOrder).Select(s => new SectionDto(s.Designation, s.Kind, s.KgPerMetre)).ToListAsync(ct);
        var pipes = rd.Pipes.OrderBy(p => p.DisplayOrder).ThenBy(p => p.NominalSize).Select(p => new MsPipeDto(p.NominalSize, p.OdMm, p.Schedule, p.WallMm)).ToList();
        var hsn = rd.Hsn.Select(h => new HsnDto(h.Form, h.MaterialKey, h.Hsn)).ToList();
        var products = await _db.QuoteProducts.AsNoTracking().Where(p => p.IsActive).OrderBy(p => p.Brand).ThenBy(p => p.Description)
            .Select(p => new QuoteProductDto(p.QuoteProductId, p.ItemType, p.GstCategory, p.Brand, p.Description, p.Size, p.Model, p.Unit,
                p.WeightPerUnit, p.Hsn, p.GstRate, p.ReferenceRate, p.IsActive)).ToListAsync(ct);
        return new QuoteLookupsDto(materials, sections, pipes, hsn, products, rd.Defaults);
    }

    // --- writes ----------------------------------------------------------------

    public async Task<QuoteDetailDto> CreateAsync(long actorId, SaveQuoteRequest r, CancellationToken ct = default)
    {
        var rd = await LoadRefAsync(ct);
        var quote = new Quote { CreatedBy = actorId, CreatedAt = DateTime.UtcNow, Reference = "pending" };
        Apply(quote, r, rd);
        return await InsertAsync(actorId, quote, ct);
    }

    public async Task<QuoteDetailDto> CreateFromLeadAsync(long actorId, long leadId, CancellationToken ct = default)
    {
        var lead = await _db.Leads.AsNoTracking().Include(l => l.Items).FirstOrDefaultAsync(l => l.LeadId == leadId, ct)
            ?? throw new AppException("Request not found.", StatusCodes.Status404NotFound);
        var rd = await LoadRefAsync(ct);
        var d = rd.Defaults;
        var productIds = lead.Items.Where(i => i.ProductId != null).Select(i => i.ProductId!.Value).Distinct().ToList();
        var materialOf = await _db.Products.AsNoTracking().Where(p => productIds.Contains(p.ProductId)).ToDictionaryAsync(p => p.ProductId, p => p.MaterialKey, ct);

        var quote = new Quote
        {
            LeadId = lead.LeadId, QuoteType = lead.Items.Any(i => i.CutToSize) ? "CutPieces" : "Retail", QuoteDate = Today(), ValidDays = d.ValidDays,
            GstRate = d.GstRaw ?? 0, Terms = WithDays(d.Terms, d.ValidDays), PaymentTerms = d.PaymentTerms, BankDetails = d.BankDetails,
            CustomerName = lead.Name, Company = lead.Company, Gstin = lead.Gstin, Phone = lead.Phone, Email = lead.Email, City = lead.City,
            InterState = IsInterState(lead.Gstin), CreatedBy = actorId, CreatedAt = DateTime.UtcNow, Reference = "pending",
        };
        var inputs = new List<QuoteItemInput>();
        foreach (var i in lead.Items.OrderBy(i => i.DisplayOrder))
        {
            var (dims, section) = ParseLeadDims(i.DimsJson);
            string? material = i.ProductId is { } pid ? materialOf.GetValueOrDefault(pid) : null;
            // Rates stay empty: staff type today's price before sending.
            if (material is not null && rd.Materials.ContainsKey(material) && QuoteLineCalc.Forms.Contains(i.Form))
                inputs.Add(new QuoteItemInput("Calculated", null, null, null, null, i.Quantity, "pcs", null, "Raw", null, null,
                    material, i.Form, dims, section, null, (double)(i.LengthMm ?? 0), 0, 0, null));
            else
                inputs.Add(new QuoteItemInput("ManualWeight", null, i.GradeText, $"{i.Form} {i.DimsText}{(i.LengthMm is { } mm ? $" × {mm:0.#} mm" : "")}", null,
                    i.Quantity, "pcs", null, "Raw", null, null, null, null, null, null, null, 0,
                    i.Kg is { } kg && i.Quantity > 0 ? Math.Round(kg / i.Quantity, 3) : 0, 0, null));
        }
        // A request item the engine can't price (missing size) becomes a manual line rather than blocking the draft.
        var order = 0;
        foreach (var input in inputs)
        {
            QuoteItem item;
            try { item = BuildItem(input, ++order, rd); }
            catch (AppException) when (input.ItemType == "Calculated")
            {
                var src = lead.Items.OrderBy(i => i.DisplayOrder).ElementAt(order - 1);
                item = BuildItem(new QuoteItemInput("ManualWeight", null, src.GradeText, $"{src.Form} {src.DimsText}", null, src.Quantity, "pcs",
                    null, "Raw", null, null, null, null, null, null, null, 0, src.Kg is { } k && src.Quantity > 0 ? Math.Round(k / src.Quantity, 3) : 0, 0, null), order, rd);
            }
            quote.Items.Add(item);
        }
        return await InsertAsync(actorId, quote, ct);
    }

    public async Task<QuoteDetailDto> UpdateAsync(long actorId, long id, SaveQuoteRequest r, CancellationToken ct = default)
    {
        var quote = await _db.Quotes.Include(q => q.Items).FirstOrDefaultAsync(q => q.QuoteId == id, ct)
            ?? throw new AppException("Quotation not found.", StatusCodes.Status404NotFound);
        if (quote.Status == "Accepted") throw new AppException("This quotation was accepted. Make a new one for changes.");
        var rd = await LoadRefAsync(ct);
        _db.QuoteItems.RemoveRange(quote.Items);
        quote.Items.Clear();
        Apply(quote, r, rd);
        await CustomerService.SyncFromQuoteAsync(_db, quote, ct);
        _audit.Record(actorId, "Update", "Quote", quote.Reference, $"₹{quote.GrandTotal:0}");
        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<QuoteDetailDto> SetStatusAsync(long actorId, long id, string status, CancellationToken ct = default)
    {
        if (!Statuses.Contains(status)) throw new AppException($"Status must be one of: {string.Join(", ", Statuses)}.");
        var quote = await _db.Quotes.Include(q => q.Items).FirstOrDefaultAsync(q => q.QuoteId == id, ct)
            ?? throw new AppException("Quotation not found.", StatusCodes.Status404NotFound);
        if (status != "Draft" && quote.Items.Any(i => AmountOf(i) is null))
            throw new AppException("Every line needs a price before the quotation goes out.");
        quote.Status = status;

        // Keep the request inbox in step with the quote.
        var leadStatus = status switch { "Sent" => "Quoted", "Accepted" => "Won", "Rejected" => "Lost", _ => null };
        if (leadStatus is not null && quote.LeadId is { } lid && await _db.Leads.FirstOrDefaultAsync(l => l.LeadId == lid, ct) is { } lead
            && lead.Status is not ("Won" or "Lost"))
            lead.Status = leadStatus;

        _audit.Record(actorId, "Status", "Quote", quote.Reference, status);
        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<(byte[] Pdf, string FileName)> PdfAsync(long id, CancellationToken ct = default)
    {
        var quote = await GetAsync(id, ct);
        var settings = await SettingsAsync(ct);
        var theme = await _db.ThemeSettings.AsNoTracking().ToDictionaryAsync(t => t.SettingKey, t => t.SettingValue, ct);
        var who = Regex.Replace(quote.Company ?? quote.CustomerName, "[^A-Za-z0-9]+", "-").Trim('-');
        return (QuotePdf.Render(quote, settings, theme), $"Quotation_{quote.Reference}_{who}.pdf");
    }

    // --- building lines --------------------------------------------------------

    private async Task<QuoteDetailDto> InsertAsync(long actorId, Quote quote, CancellationToken ct)
    {
        quote.GrandTotal = TotalsOf(quote).GrandTotal;
        await CustomerService.SyncFromQuoteAsync(_db, quote, ct);
        _db.Quotes.Add(quote);
        await _db.SaveChangesAsync(ct);
        // Same pattern as requests: short, unique, readable over the phone.
        quote.Reference = $"SST-QT-{quote.QuoteId:0000}";
        _audit.Record(actorId, "Create", "Quote", quote.Reference, quote.LeadId is null ? "blank" : $"from request {quote.LeadId}");
        await _db.SaveChangesAsync(ct);
        return await GetAsync(quote.QuoteId, ct);
    }

    private static void Apply(Quote q, SaveQuoteRequest r, RefData rd)
    {
        var name = (r.CustomerName ?? "").Trim();
        if (name.Length is < 2 or > 150) throw new AppException("Enter the customer's name.");
        q.Phone = LeadService.NormalisePhone(r.Phone) ?? throw new AppException("Enter a valid 10-digit phone number.");
        var gstin = string.IsNullOrWhiteSpace(r.Gstin) ? null : r.Gstin.Trim().ToUpperInvariant();
        if (gstin is not null && !Gstin().IsMatch(gstin)) throw new AppException("GSTIN should be 15 characters, e.g. 33ABCDE1234F1Z5.");
        if (r.ValidDays is < 1 or > 90) throw new AppException("Validity must be 1–90 days.");
        if (r.GstRate is < 0 or > 28) throw new AppException("GST rate on charges must be 0–28%.");
        var money = new[] { r.CuttingCharge, r.LoadingCharge, r.UnloadingCharge, r.TransportCharge, r.Discount };
        if (money.Any(m => m is < 0 or > 99_99_99_999)) throw new AppException("Charges and discount must be positive amounts.");
        var items = r.Items ?? [];
        if (items.Count == 0) throw new AppException("Add at least one line.");
        if (items.Count > 100) throw new AppException("Up to 100 lines per quotation.");

        if (!QuoteTypes.Contains(r.QuoteType ?? "")) throw new AppException("Choose the quotation type: project, wholesale, retail or cut pieces.");
        q.QuoteType = r.QuoteType;
        q.CustomerName = name;
        q.Company = Cut(r.Company, 150);
        q.Gstin = gstin;
        q.Email = Cut(r.Email, 256);
        q.City = Cut(r.City, 80);
        q.Address = Cut(r.Address, 400);
        q.BuyerRef = Cut(r.BuyerRef, 60);
        q.DispatchedThrough = Cut(r.DispatchedThrough, 80);
        q.QuoteDate = r.QuoteDate ?? Today();
        q.ValidDays = r.ValidDays;
        q.CuttingCharge = r.CuttingCharge;
        q.LoadingCharge = r.LoadingCharge;
        q.UnloadingCharge = r.UnloadingCharge;
        q.TransportCharge = r.TransportCharge;
        q.Discount = r.Discount;
        q.GstRate = r.GstRate;
        q.InterState = r.InterState;
        q.Notes = Cut(r.Notes, 2000);
        q.PaymentTerms = Cut(r.PaymentTerms, 200);
        q.BankDetails = Cut(r.BankDetails, 600);
        q.Terms = Cut(r.Terms, 4000);

        var order = 0;
        foreach (var i in items) q.Items.Add(BuildItem(i, ++order, rd));
        q.GrandTotal = TotalsOf(q).GrandTotal;
    }

    /// <summary>One validated, fully worked-out line. Errors are prefixed with the line number.</summary>
    private static QuoteItem BuildItem(QuoteItemInput i, int n, RefData rd)
    {
        try
        {
            if (!ItemTypes.Contains(i.ItemType)) throw new AppException("Unknown line type.");
            var calc = i.ItemType == "Calculated";
            var category = i.GstCategory is "Raw" or "Finished" ? i.GstCategory : calc ? "Raw" : "Finished";
            var rate = i.GstRate ?? (category == "Raw" ? rd.Defaults.GstRaw : rd.Defaults.GstFinished)
                ?? throw new AppException($"Set the GST rate for {(category == "Raw" ? "raw materials" : "finished products")} in Quote data, or type a rate on this line.");
            if (rate is < 0 or > 28) throw new AppException("GST rate must be 0–28%.");
            var unit = Units.Contains(i.Unit ?? "") ? i.Unit! : (calc ? "pcs" : "nos");
            var qty = Math.Clamp(i.Quantity, 1, 100_000);
            if (i.RatePerKg is < 0 or > 100_000 || i.UnitPrice is < 0 or > 10_000_000) throw new AppException("Price looks wrong.");

            var item = new QuoteItem
            {
                ItemType = i.ItemType, Brand = Cut(i.Brand, 100), Model = Cut(i.Model, 80), Quantity = qty, Unit = unit,
                GstCategory = category, GstRate = rate, Remarks = Cut(i.Remarks, 300), DisplayOrder = n,
                RatePerKg = Math.Round(i.RatePerKg, 2), UnitPrice = i.UnitPrice is { } up ? Math.Round(up, 2) : null,
            };

            if (calc)
            {
                var key = i.MaterialKey ?? throw new AppException("Pick a material.");
                var m = rd.Materials.GetValueOrDefault(key) ?? throw new AppException("Unknown material.");
                var form = i.Form ?? throw new AppException("Pick a shape.");
                decimal? kgm = form is "beam" or "channel" && i.Section is not null ? rd.Sections.GetValueOrDefault(i.Section) : null;
                if (form is "beam" or "channel" && kgm is null) throw new AppException("Pick a section.");
                var res = QuoteLineCalc.Calculate(form, key, m.Name, m.Density, i.Dims, i.Section, i.Schedule, i.LengthMm, qty,
                    rd.Defaults.WeightDecimals, kgm,
                    (size, sch) => rd.Pipes.FirstOrDefault(p => p.NominalSize == size && p.Schedule == sch) is { } p ? (p.OdMm, p.WallMm) : null);
                item.Description = res.Description;
                item.Size = Cut($"{m.Name} · cut {i.LengthMm.ToString("0.##", CultureInfo.InvariantCulture)} mm", 120);
                item.MaterialKey = key;
                item.Form = form;
                item.LengthMm = (decimal)i.LengthMm;
                item.PieceKg = res.PieceKg;
                item.Kg = res.Kg;
                item.DimsJson = JsonSerializer.Serialize(new StoredDims(res.Dims, res.Section, res.Schedule));
                item.Hsn = Cut(i.Hsn, 12) ?? HsnFor(rd, form, key);
            }
            else
            {
                item.Description = Cut(i.Description, 200) ?? throw new AppException("Enter a description.");
                item.Size = Cut(i.Size, 120);
                item.Hsn = Cut(i.Hsn, 12);
                if (i.ItemType == "ManualWeight")
                {
                    if (i.WeightPerUnit <= 0) throw new AppException("Enter the weight per unit in kg.");
                    item.WeightPerUnit = Math.Round(i.WeightPerUnit, 3);
                    item.Kg = Math.Round(qty * item.WeightPerUnit.Value, rd.Defaults.WeightDecimals, MidpointRounding.AwayFromZero);
                }
            }
            return item;
        }
        catch (AppException e)
        {
            throw new AppException($"Line {n}: {e.Message}", e.StatusCode);
        }
    }

    /// <summary>Exact shape + material first, then the shape's catch-all (blank material); pipes may also use the tube row.</summary>
    private static string? HsnFor(RefData rd, string form, string materialKey)
    {
        string? Find(string f) =>
            rd.Hsn.FirstOrDefault(h => h.Form == f && h.MaterialKey == materialKey)?.Hsn ?? rd.Hsn.FirstOrDefault(h => h.Form == f && h.MaterialKey == "")?.Hsn;
        return Find(form) ?? (form is "sspipe" or "mspipe" ? Find("tube") : null);
    }

    // --- reference data and settings -------------------------------------------

    private async Task<RefData> LoadRefAsync(CancellationToken ct)
    {
        var s = await SettingsAsync(ct);
        var materials = await _db.Materials.AsNoTracking().ToDictionaryAsync(m => m.MaterialKey, ct);
        var sections = await _db.SectionWeights.AsNoTracking().ToDictionaryAsync(x => x.Designation, x => x.KgPerMetre, ct);
        var pipes = await _db.MsPipeSchedule.AsNoTracking().ToListAsync(ct);
        var hsn = await _db.QuoteHsnCodes.AsNoTracking().ToListAsync(ct);
        return new RefData(materials, sections, pipes, hsn, DefaultsFrom(s));
    }

    public static QuoteDefaultsDto DefaultsFrom(IReadOnlyDictionary<string, string?> s)
    {
        decimal? Rate(string k) => decimal.TryParse(s.GetValueOrDefault(k), NumberStyles.Number, CultureInfo.InvariantCulture, out var v) ? v : null;
        return new QuoteDefaultsDto(
            int.TryParse(s.GetValueOrDefault("QuoteValidDays"), out var days) && days > 0 ? days : 3,
            Rate("QuoteGstRate"), Rate("QuoteGstFinished"),
            int.TryParse(s.GetValueOrDefault("QuoteWeightDecimals"), out var wd) ? Math.Clamp(wd, 0, 3) : 1,
            s.GetValueOrDefault("QuoteTerms"), s.GetValueOrDefault("QuotePaymentTerms"), s.GetValueOrDefault("QuoteBankDetails"));
    }

    private async Task<Dictionary<string, string?>> SettingsAsync(CancellationToken ct) =>
        await _db.SiteSettings.AsNoTracking().ToDictionaryAsync(s => s.SettingKey, s => s.SettingValue, ct);

    // --- helpers ---------------------------------------------------------------

    private static decimal? AmountOf(QuoteItem i) => QuoteMath.LineAmount(i.ItemType, i.Kg, i.RatePerKg, i.Quantity, i.UnitPrice);

    private static QuoteTotalsDto TotalsOf(Quote q) => QuoteMath.Totals(
        q.Items.Select(i => new PricedLine(i.Kg, AmountOf(i), i.GstRate)),
        q.CuttingCharge, q.LoadingCharge, q.UnloadingCharge, q.TransportCharge, q.Discount, q.GstRate, q.InterState);

    private static QuoteItemDto ToDto(QuoteItem i)
    {
        var stored = string.IsNullOrEmpty(i.DimsJson) ? null : JsonSerializer.Deserialize<StoredDims>(i.DimsJson);
        var perMetre = i.PieceKg is > 0 && i.LengthMm is > 0 ? i.PieceKg / (i.LengthMm / 1000) : null;
        return new QuoteItemDto(i.ItemType, i.Brand, i.Description, i.Size, i.Model, i.Quantity, i.Unit, i.Hsn, i.GstCategory, i.GstRate, i.Remarks,
            i.MaterialKey, i.Form, stored?.Dims, stored?.Section, stored?.Schedule, i.LengthMm, i.PieceKg, perMetre,
            i.WeightPerUnit ?? 0, i.Kg, i.RatePerKg, i.UnitPrice, AmountOf(i));
    }

    /// <summary>Request items store {"D":80} or {"SEC":"ISMB 300"}.</summary>
    private static (Dictionary<string, double>? Dims, string? Section) ParseLeadDims(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return (null, null);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var dims = new Dictionary<string, double>();
            string? section = null;
            foreach (var p in doc.RootElement.EnumerateObject())
            {
                if (p.Value.ValueKind == JsonValueKind.Number) dims[p.Name] = p.Value.GetDouble();
                else if (p.Name == "SEC") section = p.Value.GetString();
            }
            return (dims, section);
        }
        catch (JsonException) { return (null, null); }
    }

    private static string? WithDays(string? terms, int days) => terms?.Replace("{days}", days.ToString(CultureInfo.InvariantCulture));

    /// <summary>Outside Tamil Nadu means IGST. Without a GSTIN we assume a local sale.</summary>
    private static bool IsInterState(string? gstin) => gstin is { Length: >= 2 } && !gstin.StartsWith(HomeState);

    private static DateOnly Today() => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5.5)); // IST

    /// <summary>Opens a chat with the customer; where the browser can share files the editor sends the PDF itself instead.</summary>
    private static string WhatsAppUrl(Quote q, Dictionary<string, string?> s)
    {
        var inr = new CultureInfo("en-IN");
        var business = s.GetValueOrDefault("BusinessName") ?? "Sun Steel Traders";
        var place = s.GetValueOrDefault("LocationLine") ?? "Madurai";
        var message = $"Hello {q.CustomerName}, please find our quotation {q.Reference} dated {q.QuoteDate:dd-MM-yyyy}, " +
                      $"total ₹{TotalsOf(q).GrandTotal.ToString("#,##0", inr)}, valid for {q.ValidDays} days. {business}, {place}.";
        var digits = new string(q.Phone.Where(char.IsDigit).ToArray());
        return $"https://wa.me/{digits}?text={Uri.EscapeDataString(message)}";
    }

    private static string? Cut(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        s = s.Trim();
        return s.Length > max ? s[..max] : s;
    }

    [GeneratedRegex("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$")]
    private static partial Regex Gstin();
}
