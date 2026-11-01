using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using sunsteel.api.Common.Models;

namespace sunsteel.api.Features.Analytics;

/// <summary>The page-view beacon (public, anonymous) and the traffic figures for the admin dashboard (any signed-in staff).</summary>
[ApiController]
public sealed class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analytics;

    public AnalyticsController(IAnalyticsService analytics) => _analytics = analytics;

    /// <summary>Called by the site on each page. Browsers that ask not to be tracked (DNT / Sec-GPC) are not counted.</summary>
    [HttpPost("api/events/view")]
    [EnableRateLimiting("track")]
    public async Task<IActionResult> View(ViewRequest request, CancellationToken ct)
    {
        if (Request.Headers["DNT"] == "1" || Request.Headers["Sec-GPC"] == "1") return NoContent();
        await _analytics.RecordViewAsync(request, HttpContext.Connection.RemoteIpAddress?.ToString(), Request.Headers.UserAgent.ToString(), Request.Host.Host, ct);
        return NoContent();
    }

    /// <summary>Visits and page views per day between two dates (India days), with top pages, sources and devices. Defaults to the last 30 days.</summary>
    [HttpGet("api/admin/analytics")]
    [Authorize]
    public async Task<IActionResult> Traffic([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
    {
        var end = to ?? AnalyticsService.IndiaToday();
        var start = from ?? end.AddDays(-29);
        return Ok(ApiResponse<TrafficDto>.Ok(await _analytics.TrafficAsync(start, end, ct)));
    }
}
