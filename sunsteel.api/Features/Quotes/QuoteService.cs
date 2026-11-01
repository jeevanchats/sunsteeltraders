using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using sunsteel.api.Common.Exceptions;
using sunsteel.api.Common.Models;
using sunsteel.api.Data;
using sunsteel.api.Data.Entities;
using sunsteel.api.Features.Audit;
using sunsteel.api.Features.Leads;

namespace sunsteel.api.Features.Quotes;

public interface IQuoteService
{
    Task<PagedResult<QuoteRowDto>> ListAsync(string? status, string? q, int page, int pageSize, CancellationToken ct = default);
    Task<QuoteDetailDto> GetAsync(long id, CancellationToken ct = default);
    Task<QuoteDefaultsDto> DefaultsAsync(CancellationToken ct = default);
    Task<QuoteDetailDto> CreateAsync(long actorId, SaveQuoteRequest r, CancellationToken ct = default);
    Task<QuoteDetailDto> CreateFromLeadAsync(long actorId, long leadId, CancellationToken ct = default);
    Task<QuoteDetailDto> UpdateAsync(long actorId, long id, SaveQuoteRequest r, CancellationToken ct = default);
    Task<QuoteDetailDto> SetStatusAsync(long actorId, long id, string status, CancellationToken ct = default);
    Task<(byte[] Pdf, string FileName)> PdfAsync(long id, CancellationToken ct = default);
}

/// <summary>
/// Quotations: priced per kg by staff, with whole-quote charges, discount and GST. A quote can
/// start from a web request (its lines and customer are copied in) or blank for phone and walk-in
/// customers. Marking a quote Sent / Accepted / Rejected moves its request to Quoted / Won / Lost.
/// </summary>
public sealed partial class QuoteService : IQuoteService
{
    public static readonly string[] Statuses = ["Draft", "Sent", "Accepted", "Rejected"];
    private const string HomeState = "33"; // Tamil Nadu: first two digits of a GSTIN

    private readonly SunSteelDbContext _db;
    private readonly IAuditService _audit;

    public QuoteService(SunSteelDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<PagedResult<QuoteRowDto>> ListAsync(string? status, string? q, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = _db.Quotes.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(x => x.CustomerName.Contains(q) || x.Phone.Contains(q) || x.Reference.Contains(q) || (x.Company != null && x.Company.Contains(q)));
        var total = await query.LongCountAsync(ct);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new QuoteRowDto(x.QuoteId, x.Reference, x.Status, x.CustomerName, x.Company, x.Phone, x.Items.Count, x.GrandTotal, x.QuoteDate,
                _db.Leads.Where(l => l.LeadId == x.LeadId).Select(l => l.Reference).FirstOrDefault()))
            .ToListAsync(ct);
        return new PagedResult<QuoteRowDto> { Items = rows, Page = page, PageSize = pageSize, TotalCount = total };
    }

    public async Task<QuoteDetailDto> GetAsync(long id, CancellationToken ct = default)
    {
        var x = await _db.Quotes.AsNoTracking().Include(q => q.Items).FirstOrDefaultAsync(q => q.QuoteId == id, ct)
            ?? throw new AppException("Quotation not found.", StatusCodes.Status404NotFound);
        var leadRef = x.LeadId is { } lid ? await _db.Leads.AsNoTracking().Where(l => l.LeadId == lid).Select(l => l.Reference).FirstOrDefaultAsync(ct) : null;
        var items = x.Items.OrderBy(i => i.DisplayOrder).ToList();
        var settings = await SettingsAsync(ct);
        return new QuoteDetailDto(x.QuoteId, x.Reference, x.Status, x.LeadId, leadRef,
            x.QuoteDate, x.ValidDays, x.QuoteDate.AddDays(x.ValidDays),
            x.CustomerName, x.Company, x.Gstin, x.Phone, x.Email, x.City, x.Address,
            x.CuttingCharge, x.LoadingCharge, x.UnloadingCharge, x.TransportCharge, x.Discount, x.GstRate, x.InterState, x.Notes, x.Terms,
            items.Select(i => new QuoteItemDto(i.Description, i.Size, i.Quantity, i.Kg, i.RatePerKg, QuoteMath.LineAmount(i.Kg, i.RatePerKg))).ToList(),
            TotalsOf(x), WhatsAppUrl(x, settings), x.CreatedAt);
    }

    public async Task<QuoteDefaultsDto> DefaultsAsync(CancellationToken ct = default)
    {
        var s = await SettingsAsync(ct);
        return new QuoteDefaultsDto(
            int.TryParse(s.GetValueOrDefault("QuoteValidDays"), out var d) && d > 0 ? d : 7,
            decimal.TryParse(s.GetValueOrDefault("QuoteGstRate"), NumberStyles.Number, CultureInfo.InvariantCulture, out var g) ? g : 18m,
            s.GetValueOrDefault("QuoteTerms"));
    }

    public async Task<QuoteDetailDto> CreateAsync(long actorId, SaveQuoteRequest r, CancellationToken ct = default)
    {
        var quote = new Quote { CreatedBy = actorId, CreatedAt = DateTime.UtcNow, Reference = "pending" };
        Apply(quote, r);
        return await InsertAsync(actorId, quote, ct);
    }

    public async Task<QuoteDetailDto> CreateFromLeadAsync(long actorId, long leadId, CancellationToken ct = default)
    {
        var lead = await _db.Leads.AsNoTracking().Include(l => l.Items).FirstOrDefaultAsync(l => l.LeadId == leadId, ct)
            ?? throw new AppException("Request not found.", StatusCodes.Status404NotFound);
        var defaults = await DefaultsAsync(ct);
        var quote = new Quote
        {
            LeadId = lead.LeadId,
            QuoteDate = Today(),
            ValidDays = defaults.ValidDays,
            GstRate = defaults.GstRate,
            Terms = defaults.Terms,
            CustomerName = lead.Name,
            Company = lead.Company,
            Gstin = lead.Gstin,
            Phone = lead.Phone,
            Email = lead.Email,
            City = lead.City,
            InterState = IsInterState(lead.Gstin),
            CreatedBy = actorId,
            CreatedAt = DateTime.UtcNow,
            Reference = "pending",
        };
        var order = 0;
        foreach (var i in lead.Items.OrderBy(i => i.DisplayOrder))
        {
            var size = $"{i.Form} {i.DimsText}{(i.LengthMm is { } mm ? $" × {mm:0.#} mm" : "")}{(i.CutToSize ? ", cut to size" : "")}";
            // Rate starts at 0: staff type today's price before sending.
            quote.Items.Add(new QuoteItem { Description = Cut(i.GradeText, 200)!, Size = Cut(size, 120), Quantity = i.Quantity, Kg = i.Kg ?? 0, DisplayOrder = ++order });
        }
        return await InsertAsync(actorId, quote, ct);
    }

    public async Task<QuoteDetailDto> UpdateAsync(long actorId, long id, SaveQuoteRequest r, CancellationToken ct = default)
    {
        var quote = await _db.Quotes.Include(q => q.Items).FirstOrDefaultAsync(q => q.QuoteId == id, ct)
            ?? throw new AppException("Quotation not found.", StatusCodes.Status404NotFound);
        if (quote.Status == "Accepted") throw new AppException("This quotation was accepted. Make a new one for changes.");
        _db.QuoteItems.RemoveRange(quote.Items);
        quote.Items.Clear();
        Apply(quote, r);
        _audit.Record(actorId, "Update", "Quote", quote.Reference, $"₹{quote.GrandTotal:0}");
        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<QuoteDetailDto> SetStatusAsync(long actorId, long id, string status, CancellationToken ct = default)
    {
        if (!Statuses.Contains(status)) throw new AppException($"Status must be one of: {string.Join(", ", Statuses)}.");
        var quote = await _db.Quotes.Include(q => q.Items).FirstOrDefaultAsync(q => q.QuoteId == id, ct)
            ?? throw new AppException("Quotation not found.", StatusCodes.Status404NotFound);
        if (status != "Draft" && quote.Items.Any(i => i.RatePerKg <= 0))
            throw new AppException("Every line needs a rate per kg before the quotation goes out.");
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
        return (QuotePdf.Render(quote, settings, theme), $"{quote.Reference}.pdf");
    }

    // --- helpers ---------------------------------------------------------------

    private async Task<QuoteDetailDto> InsertAsync(long actorId, Quote quote, CancellationToken ct)
    {
        quote.GrandTotal = TotalsOf(quote).GrandTotal;
        _db.Quotes.Add(quote);
        await _db.SaveChangesAsync(ct);
        // Same pattern as requests: short, unique, readable over the phone.
        quote.Reference = $"SST-QT-{quote.QuoteId:0000}";
        _audit.Record(actorId, "Create", "Quote", quote.Reference, quote.LeadId is null ? "blank" : $"from request {quote.LeadId}");
        await _db.SaveChangesAsync(ct);
        return await GetAsync(quote.QuoteId, ct);
    }

    private static void Apply(Quote q, SaveQuoteRequest r)
    {
        var name = (r.CustomerName ?? "").Trim();
        if (name.Length is < 2 or > 150) throw new AppException("Enter the customer's name.");
        q.Phone = LeadService.NormalisePhone(r.Phone) ?? throw new AppException("Enter a valid 10-digit phone number.");
        var gstin = string.IsNullOrWhiteSpace(r.Gstin) ? null : r.Gstin.Trim().ToUpperInvariant();
        if (gstin is not null && !Gstin().IsMatch(gstin)) throw new AppException("GSTIN should be 15 characters, e.g. 33ABCDE1234F1Z5.");
        if (r.ValidDays is < 1 or > 90) throw new AppException("Validity must be 1–90 days.");
        if (r.GstRate is < 0 or > 28) throw new AppException("GST rate must be 0–28%.");
        var money = new[] { r.CuttingCharge, r.LoadingCharge, r.UnloadingCharge, r.TransportCharge, r.Discount };
        if (money.Any(m => m is < 0 or > 99_99_99_999)) throw new AppException("Charges and discount must be positive amounts.");
        var items = r.Items ?? [];
        if (items.Count == 0) throw new AppException("Add at least one line.");
        if (items.Count > 100) throw new AppException("Up to 100 lines per quotation.");

        q.CustomerName = name;
        q.Company = Cut(r.Company, 150);
        q.Gstin = gstin;
        q.Email = Cut(r.Email, 256);
        q.City = Cut(r.City, 80);
        q.Address = Cut(r.Address, 400);
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
        q.Terms = Cut(r.Terms, 4000);

        var order = 0;
        foreach (var i in items)
        {
            var desc = Cut(i.Description, 200) ?? throw new AppException($"Line {order + 1}: enter a description.");
            if (i.Kg is <= 0 or > 10_000_000) throw new AppException($"Line {order + 1}: enter the weight in kg.");
            if (i.RatePerKg is < 0 or > 100_000) throw new AppException($"Line {order + 1}: rate per kg looks wrong.");
            q.Items.Add(new QuoteItem
            {
                Description = desc, Size = Cut(i.Size, 120), Quantity = Math.Clamp(i.Quantity, 1, 100_000),
                Kg = Math.Round(i.Kg, 2), RatePerKg = Math.Round(i.RatePerKg, 2), DisplayOrder = ++order,
            });
        }
        q.GrandTotal = TotalsOf(q).GrandTotal;
    }

    private static QuoteTotalsDto TotalsOf(Quote q) => QuoteMath.Totals(q.Items.Select(i => (i.Kg, i.RatePerKg)),
        q.CuttingCharge, q.LoadingCharge, q.UnloadingCharge, q.TransportCharge, q.Discount, q.GstRate, q.InterState);

    /// <summary>Outside Tamil Nadu means IGST. Without a GSTIN we assume a local sale.</summary>
    private static bool IsInterState(string? gstin) => gstin is { Length: >= 2 } && !gstin.StartsWith(HomeState);

    private static DateOnly Today() => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5.5)); // IST

    private async Task<Dictionary<string, string?>> SettingsAsync(CancellationToken ct) =>
        await _db.SiteSettings.AsNoTracking().ToDictionaryAsync(s => s.SettingKey, s => s.SettingValue, ct);

    /// <summary>Opens a chat with the customer; staff attach the downloaded PDF before sending.</summary>
    private static string WhatsAppUrl(Quote q, Dictionary<string, string?> s)
    {
        var t = TotalsOf(q);
        var business = s.GetValueOrDefault("BusinessName") ?? "Sun Steel Traders";
        var sb = new StringBuilder();
        sb.AppendLine($"Dear {q.CustomerName},");
        sb.AppendLine($"Please find our quotation {q.Reference} dated {q.QuoteDate:dd-MM-yyyy} attached.");
        sb.AppendLine($"{q.Items.Count} item{(q.Items.Count == 1 ? "" : "s")}, about {t.TotalKg:0.#} kg. Total Rs. {t.GrandTotal.ToString("#,##0", new CultureInfo("en-IN"))} including GST.");
        sb.AppendLine($"Valid until {q.QuoteDate.AddDays(q.ValidDays):dd-MM-yyyy}.");
        sb.Append($"Thank you, {business}{(s.GetValueOrDefault("Phone1") is { } p ? ", " + p : "")}");
        var digits = new string(q.Phone.Where(char.IsDigit).ToArray());
        return $"https://wa.me/{digits}?text={Uri.EscapeDataString(sb.ToString())}";
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
