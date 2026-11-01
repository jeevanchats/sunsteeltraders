using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using sunsteel.api.Common.Exceptions;
using sunsteel.api.Common.Models;
using sunsteel.api.Data;
using sunsteel.api.Data.Entities;
using sunsteel.api.Features.Audit;
using sunsteel.api.Features.Weight;

namespace sunsteel.api.Features.Leads;

public interface ILeadService
{
    Task<LeadCreatedDto> CreateAsync(CreateLeadRequest r, string? clientIp, CancellationToken ct = default);
    Task<int> AttachFilesAsync(string reference, string phone, IFormFileCollection files, CancellationToken ct = default);
    Task RecordClickAsync(ClickRequest r, CancellationToken ct = default);

    Task<PagedResult<LeadRowDto>> ListAsync(string? type, string? status, string? q, int page, int pageSize, CancellationToken ct = default);
    Task<LeadDetailDto> GetAsync(long id, CancellationToken ct = default);
    Task<LeadDetailDto> SetStatusAsync(long actorId, long id, string status, CancellationToken ct = default);
    Task<LeadDetailDto> AddNoteAsync(long actorId, long id, string note, CancellationToken ct = default);
    Task<(Stream Stream, string ContentType, string FileName)> OpenFileAsync(long fileId, CancellationToken ct = default);
}

/// <summary>
/// The RFQ engine's server side. A lead is always saved before the browser opens WhatsApp,
/// so a request is never lost when the customer doesn't press Send. Weights are recomputed
/// here from the catalogue densities rather than trusted from the browser.
/// </summary>
public sealed partial class LeadService : ILeadService
{
    public static readonly string[] Types = ["RFQ", "Catalogue", "Contact", "Callback"];
    public static readonly string[] Statuses = ["New", "Contacted", "Quoted", "Won", "Lost"];
    private static readonly string[] Channels = ["Web", "WhatsApp", "Email", "Phone"];
    private static readonly HashSet<string> AllowedExt = new(StringComparer.OrdinalIgnoreCase)
        { ".pdf", ".dwg", ".dxf", ".xlsx", ".xls", ".csv", ".jpg", ".jpeg", ".png", ".webp", ".heic" };
    private const long MaxFileBytes = 15 * 1024 * 1024;
    private const int MaxFiles = 5;

    private readonly SunSteelDbContext _db;
    private readonly IAuditService _audit;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly sunsteel.api.Features.Email.INewRequestAlert _alert;

    public LeadService(SunSteelDbContext db, IAuditService audit, IConfiguration config, IWebHostEnvironment env, sunsteel.api.Features.Email.INewRequestAlert alert)
    {
        _alert = alert;
        _db = db;
        _audit = audit;
        _config = config;
        _env = env;
    }

    public async Task<LeadCreatedDto> CreateAsync(CreateLeadRequest r, string? clientIp, CancellationToken ct = default)
    {
        if (!string.IsNullOrEmpty(r.Website)) throw new AppException("Request rejected.");
        if (!Types.Contains(r.Type)) throw new AppException("Unknown request type.");
        var name = (r.Name ?? "").Trim();
        if (name.Length is < 2 or > 150) throw new AppException("Please enter your name.");
        var phone = NormalisePhone(r.Phone);
        if (phone is null) throw new AppException("Please enter a valid 10-digit mobile number.");
        var gstin = string.IsNullOrWhiteSpace(r.Gstin) ? null : r.Gstin.Trim().ToUpperInvariant();
        if (gstin is not null && !Gstin().IsMatch(gstin)) throw new AppException("GSTIN should be 15 characters, e.g. 33ABCDE1234F1Z5.");
        if (!string.IsNullOrWhiteSpace(r.Email) && !r.Email.Contains('@')) throw new AppException("Please enter a valid email address.");
        var items = r.Items ?? [];
        if (r.Type == "RFQ" && items.Count == 0 && string.IsNullOrWhiteSpace(r.Message))
            throw new AppException("Add at least one item, a message or a drawing.");
        if (items.Count > 50) throw new AppException("Up to 50 lines per request. Attach a cut list for more.");

        var lead = new Lead
        {
            Type = r.Type,
            Channel = Channels.Contains(r.Channel ?? "") ? r.Channel! : "Web",
            Name = name,
            Company = Trim(r.Company, 150),
            Gstin = gstin,
            Phone = phone,
            Email = Trim(r.Email, 256),
            City = Trim(r.City, 80),
            Industry = Trim(r.Industry, 80),
            Message = Trim(r.Message, 4000),
            CallbackAt = r.CallbackAt,
            SourcePage = Trim(r.SourcePage, 200),
            UtmSource = Trim(r.UtmSource, 80),
            ClientIp = clientIp,
            CreatedAt = DateTime.UtcNow,
            Reference = "pending",
        };

        if (items.Count > 0)
        {
            var slugs = items.Select(i => i.ProductSlug).Where(s => s is not null).Distinct().ToList();
            var products = await _db.Products.AsNoTracking().Include(p => p.Material).Include(p => p.Silo)
                .Where(p => slugs.Contains(p.Slug)).ToDictionaryAsync(p => p.Slug, ct);
            var sections = await _db.SectionWeights.AsNoTracking().ToDictionaryAsync(s => s.Designation, s => (double)s.KgPerMetre, ct);
            var order = 0;
            foreach (var i in items)
            {
                if (!WeightCalculator.Forms.Contains(i.Form)) throw new AppException($"Unknown shape '{i.Form}'.");
                var qty = Math.Clamp(i.Quantity, 1, 100_000);
                var dims = i.Dims ?? new Dictionary<string, double>();
                var problem = WeightCalculator.Validate(i.Form, dims);
                if (problem is not null) throw new AppException(problem);
                Product? p = i.ProductSlug is not null && products.TryGetValue(i.ProductSlug, out var found) ? found : null;
                double? density = p?.Material is { } m ? (double)m.Density : null;
                double? kgm = i.Section is not null && sections.TryGetValue(i.Section, out var w) ? w : null;
                var piece = density is null && kgm is null ? 0 : WeightCalculator.PieceKg(i.Form, dims, i.LengthMm, density ?? 0, kgm);
                lead.Items.Add(new LeadItem
                {
                    ProductId = p?.ProductId,
                    GradeText = p is null ? (Trim(i.GradeText, 160) ?? "Unspecified grade") : p.Name.Contains(p.Grade) ? p.Name : $"{p.Name} ({p.Grade})",
                    Form = i.Form,
                    DimsJson = JsonSerializer.Serialize(i.Section is null ? (object)dims : new Dictionary<string, string> { ["SEC"] = i.Section }),
                    DimsText = WeightCalculator.DimText(i.Form, dims, i.Section),
                    LengthMm = i.LengthMm > 0 ? (decimal)i.LengthMm : null,
                    Quantity = qty,
                    Kg = piece > 0 ? Math.Round((decimal)(piece * qty), 2) : null,
                    CutToSize = i.CutToSize,
                    DisplayOrder = ++order,
                });
            }
            var total = lead.Items.Sum(x => x.Kg ?? 0);
            lead.TotalKg = total > 0 ? total : null;
        }

        _db.Leads.Add(lead);
        await _db.SaveChangesAsync(ct);
        // Reference uses the id so it's short, unique and readable over the phone.
        lead.Reference = $"SST-{(r.Type == "Catalogue" ? "CAT" : r.Type == "RFQ" ? "RFQ" : "ENQ")}-{lead.LeadId:0000}";
        await _db.SaveChangesAsync(ct);
        _alert.Queue(lead.LeadId); // email to the sales desk, after the customer has their answer

        var dtoItems = lead.Items.OrderBy(x => x.DisplayOrder).Select(ToItemDto).ToList();
        return new LeadCreatedDto(lead.Reference, lead.TotalKg, dtoItems, await WhatsAppUrlAsync(lead, dtoItems, ct));
    }

    public async Task<int> AttachFilesAsync(string reference, string phone, IFormFileCollection files, CancellationToken ct = default)
    {
        var normalised = NormalisePhone(phone);
        var lead = await _db.Leads.Include(l => l.Files).FirstOrDefaultAsync(l => l.Reference == reference, ct);
        // Only the person who just created the lead may attach: same phone, within 30 minutes.
        if (lead is null || lead.Phone != normalised || lead.CreatedAt < DateTime.UtcNow.AddMinutes(-30))
            throw new AppException("Request not found.", StatusCodes.Status404NotFound);
        if (lead.Files.Count + files.Count > MaxFiles) throw new AppException($"Up to {MaxFiles} files per request.");

        var root = LeadFileRoot();
        var dir = Path.Combine(root, DateTime.UtcNow.ToString("yyyy-MM"));
        Directory.CreateDirectory(dir);
        foreach (var f in files)
        {
            var ext = Path.GetExtension(f.FileName);
            if (!AllowedExt.Contains(ext)) throw new AppException($"{f.FileName}: send PDF, DWG, DXF, Excel, CSV or photos.");
            if (f.Length is 0 or > MaxFileBytes) throw new AppException($"{f.FileName}: files must be under 15 MB.");
            var stored = Path.Combine(dir, $"{Guid.NewGuid():N}{ext.ToLowerInvariant()}");
            await using (var s = File.Create(stored)) await f.CopyToAsync(s, ct);
            lead.Files.Add(new LeadFile
            {
                FileName = Path.GetFileName(f.FileName).Length > 255 ? Path.GetFileName(f.FileName)[..255] : Path.GetFileName(f.FileName),
                StoredPath = Path.GetRelativePath(root, stored),
                ContentType = string.IsNullOrEmpty(f.ContentType) ? "application/octet-stream" : f.ContentType,
                SizeBytes = f.Length,
                CreatedAt = DateTime.UtcNow,
            });
        }
        await _db.SaveChangesAsync(ct);
        return lead.Files.Count;
    }

    public async Task RecordClickAsync(ClickRequest r, CancellationToken ct = default)
    {
        if (r.Kind is not ("wa" or "call" or "email" or "map")) return;
        _db.ClickEvents.Add(new ClickEvent { Kind = r.Kind, Page = Trim(r.Page, 200), At = DateTime.UtcNow });
        await _db.SaveChangesAsync(ct);
    }

    // --- admin -----------------------------------------------------------------

    public async Task<PagedResult<LeadRowDto>> ListAsync(string? type, string? status, string? q, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = _db.Leads.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(type)) query = query.Where(l => l.Type == type);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(l => l.Status == status);
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(l => l.Name.Contains(q) || l.Phone.Contains(q) || l.Reference.Contains(q) || (l.Company != null && l.Company.Contains(q)));
        var total = await query.LongCountAsync(ct);
        var rows = await query.OrderByDescending(l => l.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(l => new LeadRowDto(l.LeadId, l.Reference, l.Type, l.Status, l.Channel, l.Name, l.Company, l.Phone, l.City,
                l.Items.Count, l.TotalKg, l.Files.Count, l.CreatedAt))
            .ToListAsync(ct);
        return new PagedResult<LeadRowDto> { Items = rows, Page = page, PageSize = pageSize, TotalCount = total };
    }

    public async Task<LeadDetailDto> GetAsync(long id, CancellationToken ct = default)
    {
        var l = await _db.Leads.AsNoTracking().Include(x => x.Items).Include(x => x.Files).Include(x => x.Notes)
            .FirstOrDefaultAsync(x => x.LeadId == id, ct) ?? throw new AppException("Request not found.", StatusCodes.Status404NotFound);
        var userIds = l.Notes.Where(n => n.UserId != null).Select(n => n.UserId!.Value).Distinct().ToList();
        var names = await _db.Users.AsNoTracking().Where(u => userIds.Contains(u.UserId)).ToDictionaryAsync(u => u.UserId, u => u.FullName, ct);
        return new LeadDetailDto(l.LeadId, l.Reference, l.Type, l.Status, l.Channel, l.Name, l.Company, l.Gstin, l.Phone, l.Email,
            l.City, l.Industry, l.Message, l.CallbackAt, l.TotalKg, l.SourcePage, l.CreatedAt,
            l.Items.OrderBy(i => i.DisplayOrder).Select(ToItemDto).ToList(),
            l.Files.Select(f => new LeadFileDto(f.LeadFileId, f.FileName, f.ContentType, f.SizeBytes)).ToList(),
            l.Notes.OrderByDescending(n => n.CreatedAt).Select(n => new LeadNoteDto(n.LeadNoteId, n.Note,
                n.UserId is { } u ? names.GetValueOrDefault(u) : null, n.CreatedAt)).ToList());
    }

    public async Task<LeadDetailDto> SetStatusAsync(long actorId, long id, string status, CancellationToken ct = default)
    {
        if (!Statuses.Contains(status)) throw new AppException($"Status must be one of: {string.Join(", ", Statuses)}.");
        var l = await _db.Leads.FirstOrDefaultAsync(x => x.LeadId == id, ct) ?? throw new AppException("Request not found.", StatusCodes.Status404NotFound);
        l.Status = status;
        _audit.Record(actorId, "Status", "Lead", l.Reference, status);
        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<LeadDetailDto> AddNoteAsync(long actorId, long id, string note, CancellationToken ct = default)
    {
        note = (note ?? "").Trim();
        if (note.Length is 0 or > 2000) throw new AppException("Notes must be 1–2000 characters.");
        if (!await _db.Leads.AnyAsync(x => x.LeadId == id, ct)) throw new AppException("Request not found.", StatusCodes.Status404NotFound);
        _db.LeadNotes.Add(new LeadNote { LeadId = id, UserId = actorId, Note = note, CreatedAt = DateTime.UtcNow });
        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<(Stream Stream, string ContentType, string FileName)> OpenFileAsync(long fileId, CancellationToken ct = default)
    {
        var f = await _db.LeadFiles.AsNoTracking().FirstOrDefaultAsync(x => x.LeadFileId == fileId, ct)
            ?? throw new AppException("File not found.", StatusCodes.Status404NotFound);
        var root = Path.GetFullPath(LeadFileRoot());
        var full = Path.GetFullPath(Path.Combine(root, f.StoredPath));
        if (!full.StartsWith(root, StringComparison.Ordinal) || !File.Exists(full)) throw new AppException("File not found.", StatusCodes.Status404NotFound);
        return (File.OpenRead(full), f.ContentType, f.FileName);
    }

    // --- helpers ---------------------------------------------------------------

    /// <summary>Customer drawings live outside the public uploads folder; only staff can download them.</summary>
    private string LeadFileRoot()
    {
        var p = _config["Leads:FilePath"] ?? "lead-files";
        return Path.IsPathRooted(p) ? p : Path.Combine(_env.ContentRootPath, p);
    }

    private async Task<string> WhatsAppUrlAsync(Lead l, IReadOnlyList<LeadItemDto> items, CancellationToken ct)
    {
        var number = await _db.SiteSettings.AsNoTracking().Where(s => s.SettingKey == "WhatsAppNumber")
            .Select(s => s.SettingValue).FirstOrDefaultAsync(ct) ?? "";
        var sb = new StringBuilder();
        sb.AppendLine($"Hello Sun Steel Traders, {(l.Type == "RFQ" ? "please quote" : "enquiry")} {l.Reference}:");
        var n = 0;
        foreach (var i in items)
        {
            var len = i.LengthMm is { } mm ? $" × {mm:0.#} mm" : "";
            var kg = i.Kg is { } k ? $" (≈{k:0.#} kg)" : "";
            sb.AppendLine($"{++n}. {i.GradeText}, {i.Form} {i.DimsText}{len}, {i.Quantity} pcs{(i.CutToSize ? ", cut to size" : "")}{kg}");
        }
        if (l.TotalKg is { } total) sb.AppendLine($"Total ≈ {total:0.#} kg");
        if (!string.IsNullOrWhiteSpace(l.Message)) sb.AppendLine(l.Message);
        sb.Append($"{l.Name}{(l.Company is null ? "" : ", " + l.Company)}{(l.City is null ? "" : ", " + l.City)}");
        return $"https://wa.me/{number}?text={Uri.EscapeDataString(sb.ToString())}";
    }

    private static LeadItemDto ToItemDto(LeadItem i) =>
        new(i.GradeText, i.Form, i.DimsText, i.LengthMm, i.Quantity, i.Kg, i.CutToSize, null);

    /// <summary>Indian mobile or landline to "+91 XXXXX XXXXX" form; null when it isn't a phone number.</summary>
    public static string? NormalisePhone(string? raw)
    {
        var digits = new string((raw ?? "").Where(char.IsDigit).ToArray());
        if (digits.StartsWith("91") && digits.Length == 12) digits = digits[2..];
        if (digits.StartsWith('0') && digits.Length == 11) digits = digits[1..];
        if (digits.Length != 10) return null;
        return $"+91 {digits[..5]} {digits[5..]}";
    }

    private static string? Trim(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        s = s.Trim();
        return s.Length > max ? s[..max] : s;
    }

    [GeneratedRegex("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$")]
    private static partial Regex Gstin();
}
