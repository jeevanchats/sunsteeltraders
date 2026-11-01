using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using sunsteel.api.Common.Models;
using sunsteel.api.Common.Security;

namespace sunsteel.api.Features.Quotes;

/// <summary>
/// Staff-only quotations. Uses the sales permission (lead.manage): whoever answers requests quotes them
/// and keeps the product list. Changing the tax and terms tables (GST rates, HSN, pipe schedule, bank details) needs quote.data.
/// </summary>
[ApiController]
[Route("api/admin/quotes")]
public sealed class QuotesController : ControllerBase
{
    private readonly IQuoteService _quotes;
    private readonly IQuoteDataService _data;

    private readonly IOutputCacheStore _cache;

    public QuotesController(IQuoteService quotes, IQuoteDataService data, IOutputCacheStore cache)
    {
        _quotes = quotes;
        _data = data;
        _cache = cache;
    }

    [HttpGet]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? type, [FromQuery] string? q,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
        => Ok(ApiResponse<PagedResult<QuoteRowDto>>.Ok(await _quotes.ListAsync(status, type, q, page, pageSize, ct)));

    /// <summary>Materials, sections, pipe schedule, HSN codes, product list and defaults, for the editor.</summary>
    [HttpGet("lookups")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> Lookups(CancellationToken ct)
        => Ok(ApiResponse<QuoteLookupsDto>.Ok(await _quotes.LookupsAsync(ct)));

    [HttpGet("{id:long}")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> Get(long id, CancellationToken ct)
        => Ok(ApiResponse<QuoteDetailDto>.Ok(await _quotes.GetAsync(id, ct)));

    [HttpPost]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> Create(SaveQuoteRequest request, CancellationToken ct)
        => Ok(ApiResponse<QuoteDetailDto>.Ok(await _quotes.CreateAsync(User.UserId(), request, ct), "Quotation saved."));

    /// <summary>Start a draft from a web request: customer and lines copied in, rates left for staff.</summary>
    [HttpPost("from-lead/{leadId:long}")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> FromLead(long leadId, CancellationToken ct)
        => Ok(ApiResponse<QuoteDetailDto>.Ok(await _quotes.CreateFromLeadAsync(User.UserId(), leadId, ct), "Draft created. Add today's rates."));

    [HttpPut("{id:long}")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> Update(long id, SaveQuoteRequest request, CancellationToken ct)
        => Ok(ApiResponse<QuoteDetailDto>.Ok(await _quotes.UpdateAsync(User.UserId(), id, request, ct), "Quotation saved."));

    [HttpPut("{id:long}/status")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> Status(long id, UpdateQuoteStatusRequest request, CancellationToken ct)
        => Ok(ApiResponse<QuoteDetailDto>.Ok(await _quotes.SetStatusAsync(User.UserId(), id, request.Status, ct), "Status updated."));

    [HttpGet("{id:long}/pdf")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> Pdf(long id, CancellationToken ct)
    {
        var (pdf, name) = await _quotes.PdfAsync(id, ct);
        return File(pdf, "application/pdf", name);
    }

    // --- product list ----------------------------------------------------------

    [HttpGet("data/products")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> Products([FromQuery] string? q, CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<QuoteProductDto>>.Ok(await _data.ProductsAsync(q, ct)));

    [HttpPost("data/products")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> CreateProduct(QuoteProductDto body, CancellationToken ct)
        => Ok(ApiResponse<QuoteProductDto>.Ok(await _data.SaveProductAsync(User.UserId(), null, body, ct), "Product saved."));

    [HttpPut("data/products/{id:long}")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> UpdateProduct(long id, QuoteProductDto body, CancellationToken ct)
        => Ok(ApiResponse<QuoteProductDto>.Ok(await _data.SaveProductAsync(User.UserId(), id, body, ct), "Product saved."));

    [HttpDelete("data/products/{id:long}")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> DeleteProduct(long id, CancellationToken ct)
    {
        await _data.DeleteProductAsync(User.UserId(), id, ct);
        return NoContent();
    }

    // --- tax and terms tables --------------------------------------------------

    [HttpGet("data/hsn")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> Hsn(CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<HsnDto>>.Ok(await _data.HsnAsync(ct)));

    [HttpPut("data/hsn")]
    [Authorize(Policy = Perm.QuoteData)]
    public async Task<IActionResult> SaveHsn(IReadOnlyList<HsnDto> rows, CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<HsnDto>>.Ok(await _data.ReplaceHsnAsync(User.UserId(), rows, ct), "HSN codes saved."));

    [HttpGet("data/pipes")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> Pipes(CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<MsPipeDto>>.Ok(await _data.PipesAsync(ct)));

    [HttpPut("data/pipes")]
    [Authorize(Policy = Perm.QuoteData)]
    public async Task<IActionResult> SavePipes(IReadOnlyList<MsPipeDto> rows, CancellationToken ct)
    {
        var saved = await _data.ReplacePipesAsync(User.UserId(), rows, ct);
        await _cache.EvictByTagAsync(Site.SiteController.CacheTag, ct); // the public weight calculator reads this table
        return Ok(ApiResponse<IReadOnlyList<MsPipeDto>>.Ok(saved, "Pipe schedule saved."));
    }

    [HttpGet("data/settings")]
    [Authorize(Policy = Perm.LeadManage)]
    public async Task<IActionResult> Settings(CancellationToken ct)
        => Ok(ApiResponse<QuoteSettingsDto>.Ok(await _data.SettingsAsync(ct)));

    [HttpPut("data/settings")]
    [Authorize(Policy = Perm.QuoteData)]
    public async Task<IActionResult> SaveSettings(QuoteSettingsDto body, CancellationToken ct)
        => Ok(ApiResponse<QuoteSettingsDto>.Ok(await _data.SaveSettingsAsync(User.UserId(), body, ct), "Quote settings saved."));
}
