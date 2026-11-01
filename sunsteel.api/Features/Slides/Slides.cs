using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using sunsteel.api.Common.Exceptions;
using sunsteel.api.Common.Models;
using sunsteel.api.Common.Security;
using sunsteel.api.Data;
using sunsteel.api.Data.Entities;
using sunsteel.api.Features.Audit;
using sunsteel.api.Features.Media;
using sunsteel.api.Features.Site;

namespace sunsteel.api.Features.Slides;

public sealed record SlideDto(long Id, long MediaId, MediaDto? Media, string? Title, string? Caption, string? CtaText, string? LinkUrl, bool Visible);
/// <summary>A slide as the editor sends it. A missing Id means a new slide.</summary>
public sealed record SaveSlide(long? Id, long MediaId, string? Title, string? Caption, string? CtaText, string? LinkUrl, bool Visible);
public sealed record SaveSlidesRequest(List<SaveSlide> Items);

public interface ISlideService
{
    Task<IReadOnlyList<SlideDto>> GetAsync(bool publicOnly, CancellationToken ct = default);
    Task<IReadOnlyList<SlideDto>> SaveAsync(long actorId, SaveSlidesRequest req, CancellationToken ct = default);
}

public sealed class SlideService : ISlideService
{
    private const int MaxItems = 12;
    private readonly SunSteelDbContext _db;
    private readonly IAuditService _audit;

    public SlideService(SunSteelDbContext db, IAuditService audit) { _db = db; _audit = audit; }

    public async Task<IReadOnlyList<SlideDto>> GetAsync(bool publicOnly, CancellationToken ct = default)
    {
        var q = _db.HomeSlides.AsNoTracking().AsQueryable();
        if (publicOnly) q = q.Where(s => s.IsVisible);
        var rows = await q.OrderBy(s => s.DisplayOrder).ThenBy(s => s.HomeSlideId).ToListAsync(ct);
        var ids = rows.Select(r => r.MediaId).Distinct().ToList();
        var media = (await _db.MediaAssets.AsNoTracking().Where(m => ids.Contains(m.MediaId)).ToListAsync(ct)).ToDictionary(m => m.MediaId, MediaService.ToDto);
        return rows.Where(r => !publicOnly || media.ContainsKey(r.MediaId))
            .Select(r => new SlideDto(r.HomeSlideId, r.MediaId, media.GetValueOrDefault(r.MediaId), r.Title, r.Caption, r.CtaText, r.LinkUrl, r.IsVisible)).ToList();
    }

    public async Task<IReadOnlyList<SlideDto>> SaveAsync(long actorId, SaveSlidesRequest req, CancellationToken ct = default)
    {
        var items = req.Items;
        if (items.Count > MaxItems) throw new AppException($"The slideshow can hold at most {MaxItems} slides.");

        var mediaIds = items.Select(i => i.MediaId).Distinct().ToList();
        var found = await _db.MediaAssets.Where(m => mediaIds.Contains(m.MediaId)).Select(m => new { m.MediaId, m.Kind }).ToListAsync(ct);
        if (found.Count != mediaIds.Count) throw new AppException("One of the chosen banners no longer exists. Please choose it again.");
        if (found.Any(m => m.Kind != "image")) throw new AppException("Slides can only use photos, not videos.");

        var existing = await _db.HomeSlides.ToListAsync(ct);
        var keep = new HashSet<long>();
        var order = 0;
        foreach (var item in items)
        {
            order++;
            var row = item.Id is { } id ? existing.FirstOrDefault(s => s.HomeSlideId == id) : null;
            if (row is null) { row = new HomeSlide(); _db.HomeSlides.Add(row); }
            row.MediaId = item.MediaId;
            row.Title = Clean(item.Title, 120);
            row.Caption = Clean(item.Caption, 300);
            row.CtaText = Clean(item.CtaText, 60);
            row.LinkUrl = CleanLink(item.LinkUrl);
            row.IsVisible = item.Visible;
            row.DisplayOrder = order;
            if (row.HomeSlideId != 0) keep.Add(row.HomeSlideId);
        }
        _db.HomeSlides.RemoveRange(existing.Where(s => !keep.Contains(s.HomeSlideId)));

        _audit.Record(actorId, "Update", "Slides", null, $"{items.Count} slides");
        await _db.SaveChangesAsync(ct);
        return await GetAsync(false, ct);
    }

    private static string? Clean(string? s, int max)
    {
        s = s?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        return s.Length <= max ? s : throw new AppException($"That text is too long (limit {max} characters).");
    }

    /// <summary>A page on this site (/contact-us/) or a full http(s) address; nothing else.</summary>
    private static string? CleanLink(string? s)
    {
        s = s?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        if (s.Length > 300) throw new AppException("That link is too long.");
        var internalLink = s.StartsWith('/') && !s.StartsWith("//") && !s.Contains(' ');
        var external = Uri.TryCreate(s, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttps || u.Scheme == Uri.UriSchemeHttp);
        if (!internalLink && !external) throw new AppException("A link must start with / (a page on this site) or be a full https:// address.");
        return s;
    }
}

[ApiController]
public sealed class SlidesController : ControllerBase
{
    private readonly ISlideService _slides;
    private readonly IOutputCacheStore _cache;
    public SlidesController(ISlideService slides, IOutputCacheStore cache) { _slides = slides; _cache = cache; }

    [HttpGet("api/slides")]
    [OutputCache(PolicyName = "public")]
    public async Task<IActionResult> Public(CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<SlideDto>>.Ok(await _slides.GetAsync(true, ct)));

    [HttpGet("api/admin/slides")]
    [Authorize(Policy = Perm.MediaManage)]
    public async Task<IActionResult> Admin(CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<SlideDto>>.Ok(await _slides.GetAsync(false, ct)));

    [HttpPut("api/admin/slides")]
    [Authorize(Policy = Perm.MediaManage)]
    public async Task<IActionResult> Save(SaveSlidesRequest req, CancellationToken ct)
    {
        var result = await _slides.SaveAsync(User.UserId(), req, ct);
        await _cache.EvictByTagAsync(SiteController.CacheTag, ct);
        return Ok(ApiResponse<IReadOnlyList<SlideDto>>.Ok(result, "Slides saved. The website shows them now."));
    }
}
