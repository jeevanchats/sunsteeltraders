using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using sunsteel.api.Common.Models;
using sunsteel.api.Common.Security;

namespace sunsteel.api.Features.Quotes;

/// <summary>Staff-only quotations. Uses the sales permission (lead.manage): whoever answers requests quotes them.</summary>
[ApiController]
[Authorize(Policy = Perm.LeadManage)]
[Route("api/admin/quotes")]
public sealed class QuotesController : ControllerBase
{
    private readonly IQuoteService _quotes;

    public QuotesController(IQuoteService quotes) => _quotes = quotes;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? q,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
        => Ok(ApiResponse<PagedResult<QuoteRowDto>>.Ok(await _quotes.ListAsync(status, q, page, pageSize, ct)));

    [HttpGet("defaults")]
    public async Task<IActionResult> Defaults(CancellationToken ct)
        => Ok(ApiResponse<QuoteDefaultsDto>.Ok(await _quotes.DefaultsAsync(ct)));

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Get(long id, CancellationToken ct)
        => Ok(ApiResponse<QuoteDetailDto>.Ok(await _quotes.GetAsync(id, ct)));

    [HttpPost]
    public async Task<IActionResult> Create(SaveQuoteRequest request, CancellationToken ct)
        => Ok(ApiResponse<QuoteDetailDto>.Ok(await _quotes.CreateAsync(User.UserId(), request, ct), "Quotation saved."));

    /// <summary>Start a draft from a web request: customer and lines copied in, rates left for staff.</summary>
    [HttpPost("from-lead/{leadId:long}")]
    public async Task<IActionResult> FromLead(long leadId, CancellationToken ct)
        => Ok(ApiResponse<QuoteDetailDto>.Ok(await _quotes.CreateFromLeadAsync(User.UserId(), leadId, ct), "Draft created. Add today's rates."));

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, SaveQuoteRequest request, CancellationToken ct)
        => Ok(ApiResponse<QuoteDetailDto>.Ok(await _quotes.UpdateAsync(User.UserId(), id, request, ct), "Quotation saved."));

    [HttpPut("{id:long}/status")]
    public async Task<IActionResult> Status(long id, UpdateQuoteStatusRequest request, CancellationToken ct)
        => Ok(ApiResponse<QuoteDetailDto>.Ok(await _quotes.SetStatusAsync(User.UserId(), id, request.Status, ct), "Status updated."));

    [HttpGet("{id:long}/pdf")]
    public async Task<IActionResult> Pdf(long id, CancellationToken ct)
    {
        var (pdf, name) = await _quotes.PdfAsync(id, ct);
        return File(pdf, "application/pdf", name);
    }
}
