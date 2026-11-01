using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using sunsteel.api.Common.Models;
using sunsteel.api.Common.Security;

namespace sunsteel.api.Features.Email;

/// <summary>Email settings (Brevo SMTP) for new-request alerts. Super Admin only, like the other site settings.</summary>
[ApiController]
[Route("api/admin/email")]
[Authorize(Policy = Perm.SettingsManage)]
public sealed class EmailController : ControllerBase
{
    private readonly IEmailService _email;

    public EmailController(IEmailService email) => _email = email;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(ApiResponse<EmailSettingsDto>.Ok(await _email.GetAsync(ct)));

    [HttpPut]
    public async Task<IActionResult> Save(SaveEmailSettingsRequest request, CancellationToken ct)
        => Ok(ApiResponse<EmailSettingsDto>.Ok(await _email.SaveAsync(User.UserId(), request, ct), "Email settings saved."));

    [HttpPost("test")]
    public async Task<IActionResult> Test(TestEmailRequest request, CancellationToken ct)
    {
        var result = await _email.SendTestAsync(request.To, ct);
        return Ok(ApiResponse<EmailResultDto>.Ok(result, result.Message));
    }
}
