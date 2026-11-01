using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using sunsteel.api.Common.Exceptions;
using sunsteel.api.Data;
using sunsteel.api.Data.Entities;

namespace sunsteel.api.Features.Analytics;

public sealed record ViewRequest(string? Path, string? Referrer);

public sealed record DayPoint(DateOnly Date, int Views, int Visits);
public sealed record NamedCount(string Name, int Count);
public sealed record PeriodTotals(int Views, int Visits);
public sealed record TrafficDto(DateOnly From, DateOnly To, PeriodTotals Totals, PeriodTotals Previous, IReadOnlyList<DayPoint> Daily,
    IReadOnlyList<NamedCount> TopPages, IReadOnlyList<NamedCount> Sources, IReadOnlyList<NamedCount> Referrers, IReadOnlyList<NamedCount> Devices);

public interface IAnalyticsService
{
    Task RecordViewAsync(ViewRequest r, string? ip, string? userAgent, string? siteHost, CancellationToken ct = default);
    Task<TrafficDto> TrafficAsync(DateOnly from, DateOnly to, CancellationToken ct = default);
}

/// <summary>
/// Site traffic, kept by us: no cookies, no stored IP addresses, no third party. A "visit" is one visitor on one day
/// (the same person on two days is two visits); a "page view" is every page they open.
/// </summary>
public sealed class AnalyticsService : IAnalyticsService
{
    private static readonly string[] BotWords = ["bot", "crawl", "spider", "slurp", "headless", "lighthouse", "pagespeed", "preview", "monitor", "curl", "wget", "python", "httpclient", "facebookexternalhit"];
    private static readonly string[] SearchHosts = ["google.", "bing.", "duckduckgo.", "yahoo.", "ecosia.", "baidu.", "yandex."];
    private static readonly string[] SocialHosts = ["facebook.", "fb.com", "instagram.", "t.co", "twitter.", "x.com", "linkedin.", "lnkd.in", "youtube.", "youtu.be", "wa.me", "whatsapp.", "pinterest."];
    private const int MaxDays = 366;

    private readonly SunSteelDbContext _db;
    private readonly string _salt;

    public AnalyticsService(SunSteelDbContext db, IConfiguration config)
    {
        _db = db;
        _salt = config["Analytics:Salt"] ?? config["Jwt:Key"] ?? "sunsteel";
    }

    /// <summary>The calendar day in India, whatever the server's own time zone.</summary>
    public static DateOnly IndiaToday() => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5.5));

    public async Task RecordViewAsync(ViewRequest r, string? ip, string? userAgent, string? siteHost, CancellationToken ct = default)
    {
        var path = CleanPath(r.Path);
        if (path is null) return;
        var ua = userAgent ?? "";
        if (ua.Length == 0 || BotWords.Any(w => ua.Contains(w, StringComparison.OrdinalIgnoreCase))) return;

        var day = IndiaToday();
        var key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{_salt}|{day:yyyy-MM-dd}|{ip}|{ua}")))[..16];
        var (source, host) = Classify(r.Referrer, siteHost);
        _db.PageViews.Add(new PageView
        {
            At = DateTime.UtcNow, Day = day, Path = path, VisitorKey = key, Source = source, Referrer = host,
            Device = ua.Contains("iPad", StringComparison.OrdinalIgnoreCase) || ua.Contains("Tablet", StringComparison.OrdinalIgnoreCase) ? "Tablet"
                : ua.Contains("Mobi", StringComparison.OrdinalIgnoreCase) ? "Mobile" : "Desktop",
        });
        await _db.SaveChangesAsync(ct);
    }

    public async Task<TrafficDto> TrafficAsync(DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        if (to < from) (from, to) = (to, from);
        var days = to.DayNumber - from.DayNumber + 1;
        if (days > MaxDays) throw new AppException($"Choose a period of up to {MaxDays} days.");

        var inRange = _db.PageViews.AsNoTracking().Where(v => v.Day >= from && v.Day <= to);
        var perDay = await inRange.GroupBy(v => v.Day)
            .Select(g => new { Day = g.Key, Views = g.Count(), Visits = g.Select(x => x.VisitorKey).Distinct().Count() }).ToListAsync(ct);
        var daily = Enumerable.Range(0, days).Select(i =>
        {
            var d = from.AddDays(i);
            var row = perDay.FirstOrDefault(x => x.Day == d);
            return new DayPoint(d, row?.Views ?? 0, row?.Visits ?? 0);
        }).ToList();

        // The period just before, the same length, so the cards can say "up 12%".
        var prevTo = from.AddDays(-1);
        var prevFrom = prevTo.AddDays(-(days - 1));
        var prev = await _db.PageViews.AsNoTracking().Where(v => v.Day >= prevFrom && v.Day <= prevTo).GroupBy(v => v.Day)
            .Select(g => new { Views = g.Count(), Visits = g.Select(x => x.VisitorKey).Distinct().Count() }).ToListAsync(ct);

        async Task<List<NamedCount>> Top(IQueryable<string?> names, int take) =>
            (await names.Where(n => n != null).GroupBy(n => n!).Select(g => new { Name = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count).Take(take).ToListAsync(ct)).Select(x => new NamedCount(x.Name, x.Count)).ToList();

        return new TrafficDto(from, to,
            new PeriodTotals(daily.Sum(d => d.Views), daily.Sum(d => d.Visits)),
            new PeriodTotals(prev.Sum(d => d.Views), prev.Sum(d => d.Visits)),
            daily,
            await Top(inRange.Select(v => (string?)v.Path), 10),
            await Top(inRange.Select(v => (string?)v.Source), 6),
            await Top(inRange.Where(v => v.Referrer != null).Select(v => v.Referrer), 8),
            await Top(inRange.Select(v => (string?)v.Device), 3));
    }

    // --- helpers ---------------------------------------------------------------

    /// <summary>The path only (no query or fragment), or null for anything we don't count: staff screens, odd input.</summary>
    private static string? CleanPath(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var p = raw.Trim();
        var cut = p.IndexOfAny(['?', '#']);
        if (cut >= 0) p = p[..cut];
        if (!p.StartsWith('/') || p.StartsWith("//") || p.StartsWith("/admin", StringComparison.OrdinalIgnoreCase)) return null;
        if (p.Any(char.IsControl)) return null;
        return p.Length > 200 ? p[..200] : p;
    }

    /// <summary>Where the visit came from: a category and the referring site's name. Our own site is not a source.</summary>
    private static (string Source, string? Host) Classify(string? referrer, string? siteHost)
    {
        if (string.IsNullOrWhiteSpace(referrer) || !Uri.TryCreate(referrer, UriKind.Absolute, out var u) || u.Scheme is not ("http" or "https"))
            return ("Direct", null);
        var host = u.Host.ToLowerInvariant();
        if (host.StartsWith("www.")) host = host[4..];
        if (siteHost is not null && host.Equals(siteHost.Replace("www.", ""), StringComparison.OrdinalIgnoreCase)) return ("Direct", null);
        host = host.Length > 100 ? host[..100] : host;
        if (SearchHosts.Any(h => host.Contains(h))) return ("Search", host);
        if (SocialHosts.Any(h => host.Contains(h))) return ("Social", host);
        return ("Referral", host);
    }
}
