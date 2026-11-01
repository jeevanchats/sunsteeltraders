using System.Globalization;
using Microsoft.EntityFrameworkCore;
using sunsteel.api.Common.Exceptions;
using sunsteel.api.Data;
using sunsteel.api.Data.Entities;
using sunsteel.api.Features.Audit;

namespace sunsteel.api.Features.Quotes;

public interface IQuoteDataService
{
    Task<IReadOnlyList<QuoteProductDto>> ProductsAsync(string? q, CancellationToken ct = default);
    Task<QuoteProductDto> SaveProductAsync(long actorId, long? id, QuoteProductDto p, CancellationToken ct = default);
    Task DeleteProductAsync(long actorId, long id, CancellationToken ct = default);
    Task<IReadOnlyList<HsnDto>> HsnAsync(CancellationToken ct = default);
    Task<IReadOnlyList<HsnDto>> ReplaceHsnAsync(long actorId, IReadOnlyList<HsnDto> rows, CancellationToken ct = default);
    Task<IReadOnlyList<MsPipeDto>> PipesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<MsPipeDto>> ReplacePipesAsync(long actorId, IReadOnlyList<MsPipeDto> rows, CancellationToken ct = default);
    Task<QuoteSettingsDto> SettingsAsync(CancellationToken ct = default);
    Task<QuoteSettingsDto> SaveSettingsAsync(long actorId, QuoteSettingsDto s, CancellationToken ct = default);
}

/// <summary>The tables behind quotations: product list, HSN codes, MS pipe schedule, and the Quote* site settings.</summary>
public sealed class QuoteDataService : IQuoteDataService
{
    private readonly SunSteelDbContext _db;
    private readonly IAuditService _audit;

    public QuoteDataService(SunSteelDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    // --- product list ----------------------------------------------------------

    public async Task<IReadOnlyList<QuoteProductDto>> ProductsAsync(string? q, CancellationToken ct = default)
    {
        var query = _db.QuoteProducts.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(p => p.Description.Contains(q) || (p.Brand != null && p.Brand.Contains(q)) || (p.Model != null && p.Model.Contains(q)));
        return (await query.OrderBy(p => p.Brand).ThenBy(p => p.Description).Take(500).ToListAsync(ct)).Select(ToDto).ToList();
    }

    public async Task<QuoteProductDto> SaveProductAsync(long actorId, long? id, QuoteProductDto p, CancellationToken ct = default)
    {
        var desc = (p.Description ?? "").Trim();
        if (desc.Length is 0 or > 200) throw new AppException("Enter a description (up to 200 characters).");
        if (p.ItemType is not ("ManualWeight" or "ManualUnit")) throw new AppException("Choose by weight or by unit.");
        if (p.GstCategory is not ("Raw" or "Finished")) throw new AppException("Choose raw material or finished product.");
        if (p.ItemType == "ManualWeight" && p.WeightPerUnit is null or <= 0) throw new AppException("A by-weight product needs its weight per unit.");
        if (p.GstRate is < 0 or > 28) throw new AppException("GST rate must be 0–28%.");
        if (!QuoteService.Units.Contains(p.Unit)) throw new AppException($"Unit must be one of: {string.Join(", ", QuoteService.Units)}.");

        var e = id is { } existing
            ? await _db.QuoteProducts.FirstOrDefaultAsync(x => x.QuoteProductId == existing, ct) ?? throw new AppException("Product not found.", 404)
            : _db.QuoteProducts.Add(new QuoteProduct()).Entity;
        e.ItemType = p.ItemType;
        e.GstCategory = p.GstCategory;
        e.Brand = Cut(p.Brand, 100);
        e.Description = desc;
        e.Size = Cut(p.Size, 120);
        e.Model = Cut(p.Model, 80);
        e.Unit = p.Unit;
        e.WeightPerUnit = p.ItemType == "ManualWeight" ? p.WeightPerUnit : null;
        e.Hsn = Cut(p.Hsn, 12);
        e.GstRate = p.GstRate;
        e.ReferenceRate = p.ReferenceRate;
        e.IsActive = p.IsActive;
        _audit.Record(actorId, id is null ? "Create" : "Update", "QuoteProduct", id?.ToString(), desc);
        await _db.SaveChangesAsync(ct);
        return ToDto(e);
    }

    public async Task DeleteProductAsync(long actorId, long id, CancellationToken ct = default)
    {
        var e = await _db.QuoteProducts.FirstOrDefaultAsync(x => x.QuoteProductId == id, ct) ?? throw new AppException("Product not found.", 404);
        _db.QuoteProducts.Remove(e); // quotes keep their own copy of every line, so nothing else changes
        _audit.Record(actorId, "Delete", "QuoteProduct", id.ToString(), e.Description);
        await _db.SaveChangesAsync(ct);
    }

    // --- HSN codes for calculated lines ----------------------------------------

    public async Task<IReadOnlyList<HsnDto>> HsnAsync(CancellationToken ct = default) =>
        await _db.QuoteHsnCodes.AsNoTracking().OrderBy(h => h.Form).ThenBy(h => h.MaterialKey).Select(h => new HsnDto(h.Form, h.MaterialKey, h.Hsn)).ToListAsync(ct);

    public async Task<IReadOnlyList<HsnDto>> ReplaceHsnAsync(long actorId, IReadOnlyList<HsnDto> rows, CancellationToken ct = default)
    {
        var materials = await _db.Materials.AsNoTracking().Select(m => m.MaterialKey).ToListAsync(ct);
        var clean = new List<QuoteHsn>();
        foreach (var r in rows)
        {
            var hsn = new string((r.Hsn ?? "").Where(char.IsLetterOrDigit).ToArray());
            if (hsn.Length is < 4 or > 12) throw new AppException($"HSN code '{r.Hsn}' should be 4–12 characters.");
            if (!QuoteLineCalc.Forms.Contains(r.Form)) throw new AppException($"Unknown shape '{r.Form}'.");
            var mat = r.MaterialKey ?? "";
            if (mat != "" && !materials.Contains(mat)) throw new AppException($"Unknown material '{mat}'.");
            if (clean.Any(c => c.Form == r.Form && c.MaterialKey == mat)) throw new AppException($"Two rows for {r.Form} / {(mat == "" ? "all materials" : mat)}.");
            clean.Add(new QuoteHsn { Form = r.Form, MaterialKey = mat, Hsn = hsn });
        }
        _db.QuoteHsnCodes.RemoveRange(await _db.QuoteHsnCodes.ToListAsync(ct));
        await _db.SaveChangesAsync(ct); // delete first: the unique key would reject an in-place swap
        _db.QuoteHsnCodes.AddRange(clean);
        _audit.Record(actorId, "Update", "QuoteHsn", null, $"{clean.Count} rows");
        await _db.SaveChangesAsync(ct);
        return await HsnAsync(ct);
    }

    // --- MS pipe schedule -------------------------------------------------------

    public async Task<IReadOnlyList<MsPipeDto>> PipesAsync(CancellationToken ct = default) =>
        await _db.MsPipeSchedule.AsNoTracking().OrderBy(p => p.DisplayOrder).ThenBy(p => p.Schedule)
            .Select(p => new MsPipeDto(p.NominalSize, p.OdMm, p.Schedule, p.WallMm)).ToListAsync(ct);

    public async Task<IReadOnlyList<MsPipeDto>> ReplacePipesAsync(long actorId, IReadOnlyList<MsPipeDto> rows, CancellationToken ct = default)
    {
        var clean = new List<MsPipeScheduleRow>();
        var order = new Dictionary<string, int>();
        foreach (var r in rows)
        {
            var size = (r.NominalSize ?? "").Trim();
            var sch = (r.Schedule ?? "").Trim();
            if (size.Length is 0 or > 20 || sch.Length is 0 or > 12) throw new AppException("Every row needs a nominal size and a schedule.");
            if (string.Equals(sch, "Custom", StringComparison.OrdinalIgnoreCase)) throw new AppException("'Custom' is reserved for typed sizes.");
            if (r.OdMm <= 0 || r.WallMm <= 0 || r.WallMm * 2 >= r.OdMm) throw new AppException($"{size} {sch}: wall must be positive and under half the outside diameter.");
            if (clean.Any(c => c.NominalSize == size && c.Schedule == sch)) throw new AppException($"{size} {sch} appears twice.");
            if (!order.ContainsKey(size)) order[size] = (order.Count + 1) * 10;
            clean.Add(new MsPipeScheduleRow { NominalSize = size, OdMm = r.OdMm, Schedule = sch, WallMm = r.WallMm, DisplayOrder = order[size] });
        }
        _db.MsPipeSchedule.RemoveRange(await _db.MsPipeSchedule.ToListAsync(ct));
        await _db.SaveChangesAsync(ct);
        _db.MsPipeSchedule.AddRange(clean);
        _audit.Record(actorId, "Update", "MsPipeSchedule", null, $"{clean.Count} rows");
        await _db.SaveChangesAsync(ct);
        return await PipesAsync(ct);
    }

    // --- quote settings --------------------------------------------------------

    public async Task<QuoteSettingsDto> SettingsAsync(CancellationToken ct = default)
    {
        var s = await _db.SiteSettings.AsNoTracking().ToDictionaryAsync(x => x.SettingKey, x => x.SettingValue, ct);
        var d = QuoteService.DefaultsFrom(s);
        return new QuoteSettingsDto(d.GstRaw, d.GstFinished, d.ValidDays, d.WeightDecimals, d.PaymentTerms, d.BankDetails, d.Terms);
    }

    public async Task<QuoteSettingsDto> SaveSettingsAsync(long actorId, QuoteSettingsDto s, CancellationToken ct = default)
    {
        if (s.GstRaw is < 0 or > 28 || s.GstFinished is < 0 or > 28) throw new AppException("GST rates must be 0–28%.");
        if (s.ValidDays is < 1 or > 90) throw new AppException("Validity must be 1–90 days.");
        if (s.WeightDecimals is < 0 or > 3) throw new AppException("Weight decimals must be 0–3.");
        var values = new Dictionary<string, string?>
        {
            ["QuoteGstRate"] = s.GstRaw?.ToString(CultureInfo.InvariantCulture),
            ["QuoteGstFinished"] = s.GstFinished?.ToString(CultureInfo.InvariantCulture),
            ["QuoteValidDays"] = s.ValidDays.ToString(CultureInfo.InvariantCulture),
            ["QuoteWeightDecimals"] = s.WeightDecimals.ToString(CultureInfo.InvariantCulture),
            ["QuotePaymentTerms"] = Cut(s.PaymentTerms, 200),
            ["QuoteBankDetails"] = Cut(s.BankDetails, 600),
            ["QuoteTerms"] = Cut(s.Terms, 4000),
        };
        var keys = values.Keys.ToList();
        var rows = await _db.SiteSettings.Where(x => keys.Contains(x.SettingKey)).ToListAsync(ct);
        foreach (var (k, v) in values)
        {
            var row = rows.FirstOrDefault(x => x.SettingKey == k);
            if (row is null) _db.SiteSettings.Add(new SiteSetting { SettingKey = k, SettingValue = v });
            else row.SettingValue = v;
        }
        _audit.Record(actorId, "Update", "QuoteSettings", null, string.Join(", ", keys));
        await _db.SaveChangesAsync(ct);
        return await SettingsAsync(ct);
    }

    private static QuoteProductDto ToDto(QuoteProduct p) => new(p.QuoteProductId, p.ItemType, p.GstCategory, p.Brand, p.Description, p.Size,
        p.Model, p.Unit, p.WeightPerUnit, p.Hsn, p.GstRate, p.ReferenceRate, p.IsActive);

    private static string? Cut(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        s = s.Trim();
        return s.Length > max ? s[..max] : s;
    }
}
