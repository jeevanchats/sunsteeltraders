using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using sunsteel.api.Common.Models;
using sunsteel.api.Common.Security;

namespace sunsteel.api.Features.Quotes;

/// <summary>Staff-only customer master: list, edit, search for the quotation form, CSV export and import. Same permission as quotations.</summary>
[ApiController]
[Route("api/admin/customers")]
[Authorize(Policy = Perm.LeadManage)]
public sealed class CustomersController : ControllerBase
{
    private readonly ICustomerService _customers;

    public CustomersController(ICustomerService customers) => _customers = customers;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
        => Ok(ApiResponse<PagedResult<CustomerDto>>.Ok(await _customers.ListAsync(q, page, pageSize, ct)));

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<CustomerDto>>.Ok(await _customers.SearchAsync(q, ct)));

    [HttpPost]
    public async Task<IActionResult> Create(SaveCustomerRequest request, CancellationToken ct)
        => Ok(ApiResponse<CustomerDto>.Ok(await _customers.SaveAsync(User.UserId(), null, request, ct), "Customer saved."));

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, SaveCustomerRequest request, CancellationToken ct)
        => Ok(ApiResponse<CustomerDto>.Ok(await _customers.SaveAsync(User.UserId(), id, request, ct), "Customer saved."));

    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await _customers.DeleteAsync(User.UserId(), id, ct);
        return NoContent();
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export(CancellationToken ct)
        => File(await _customers.ExportCsvAsync(ct), "text/csv; charset=utf-8", $"customers-{DateTime.UtcNow:yyyy-MM-dd}.csv");

    [HttpPost("import")]
    [RequestSizeLimit(5_000_000)]
    public async Task<IActionResult> Import(IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        return Ok(ApiResponse<CustomerImportResult>.Ok(await _customers.ImportCsvAsync(User.UserId(), stream, ct), "Import finished."));
    }
}
