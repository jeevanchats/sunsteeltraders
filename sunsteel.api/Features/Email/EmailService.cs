using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using sunsteel.api.Common.Exceptions;
using sunsteel.api.Data;
using sunsteel.api.Data.Entities;
using sunsteel.api.Features.Audit;

namespace sunsteel.api.Features.Email;

/// <summary>What the admin screen shows. The SMTP key is never sent back: only whether one is saved.</summary>
public sealed record EmailSettingsDto(string Mode, string Host, int Port, string? Login, bool HasKey, string? FromAddress, string? FromName, IReadOnlyList<string> AlertTo);

/// <summary>What the admin screen saves. A blank <see cref="Key"/> keeps the saved key.</summary>
public sealed record SaveEmailSettingsRequest(string Mode, string Host, int Port, string? Login, string? Key, string? FromAddress, string? FromName, IReadOnlyList<string>? AlertTo);

public sealed record TestEmailRequest(string To);
public sealed record EmailResultDto(bool Sent, string Message);

public interface IEmailService
{
    Task<EmailSettingsDto> GetAsync(CancellationToken ct = default);
    Task<EmailSettingsDto> SaveAsync(long actorId, SaveEmailSettingsRequest r, CancellationToken ct = default);
    Task<EmailResultDto> SendTestAsync(string to, CancellationToken ct = default);
    /// <summary>Emails the alert addresses about a new request. Never throws: a mail problem must not lose or delay a request.</summary>
    Task NotifyNewRequestAsync(long leadId, CancellationToken ct = default);
}

/// <summary>
/// Outgoing email through an SMTP relay (Brevo). In Mock mode nothing is sent; the message is written to the server log, so the
/// screen can be set up and tried safely. The SMTP key is stored encrypted with a key derived from the server's own secret (Jwt:Key),
/// so the database alone does not reveal it.
/// </summary>
public sealed partial class EmailService : IEmailService
{
    private const string Prefix = "gcm1:";
    private static readonly string[] Keys = ["EmailMode", "SmtpHost", "SmtpPort", "SmtpLogin", "SmtpKey", "EmailFromAddress", "EmailFromName", "EmailAlertTo"];

    private readonly SunSteelDbContext _db;
    private readonly IAuditService _audit;
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _log;

    public EmailService(SunSteelDbContext db, IAuditService audit, IConfiguration config, ILogger<EmailService> log)
    {
        _db = db;
        _audit = audit;
        _config = config;
        _log = log;
    }

    public async Task<EmailSettingsDto> GetAsync(CancellationToken ct = default)
    {
        var s = await LoadAsync(ct);
        return ToDto(s);
    }

    public async Task<EmailSettingsDto> SaveAsync(long actorId, SaveEmailSettingsRequest r, CancellationToken ct = default)
    {
        if (r.Mode is not ("Mock" or "Live")) throw new AppException("Mode must be Mock or Live.");
        var host = (r.Host ?? "").Trim();
        if (host.Length is 0 or > 200 || host.Any(c => char.IsWhiteSpace(c))) throw new AppException("Enter the SMTP host, for example smtp-relay.brevo.com.");
        if (r.Port is < 1 or > 65535) throw new AppException("Enter the SMTP port, for example 587.");
        var alerts = (r.AlertTo ?? []).Select(a => a.Trim()).Where(a => a.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var bad = alerts.FirstOrDefault(a => !Address().IsMatch(a));
        if (bad is not null) throw new AppException($"'{bad}' is not a valid email address.");
        if (alerts.Count > 10) throw new AppException("Up to 10 alert addresses.");
        var from = string.IsNullOrWhiteSpace(r.FromAddress) ? null : r.FromAddress.Trim();
        if (from is not null && !Address().IsMatch(from)) throw new AppException("The From address is not a valid email address.");

        var current = await LoadAsync(ct);
        var newKey = string.IsNullOrWhiteSpace(r.Key) ? null : r.Key.Trim();
        var hasKey = newKey is not null || !string.IsNullOrEmpty(current.GetValueOrDefault("SmtpKey"));
        if (r.Mode == "Live")
        {
            if (string.IsNullOrWhiteSpace(r.Login)) throw new AppException("Live needs the SMTP login.");
            if (!hasKey) throw new AppException("Live needs the SMTP key.");
            if (from is null) throw new AppException("Live needs a From address (a sender you have verified in Brevo).");
            if (alerts.Count == 0) throw new AppException("Live needs at least one address to send alerts to.");
        }

        var values = new Dictionary<string, string?>
        {
            ["EmailMode"] = r.Mode, ["SmtpHost"] = host, ["SmtpPort"] = r.Port.ToString(), ["SmtpLogin"] = Clean(r.Login, 200),
            ["EmailFromAddress"] = from, ["EmailFromName"] = Clean(r.FromName, 100), ["EmailAlertTo"] = alerts.Count == 0 ? null : string.Join(",", alerts),
        };
        if (newKey is not null) values["SmtpKey"] = Protect(newKey);
        var rows = await _db.SiteSettings.Where(x => Keys.Contains(x.SettingKey)).ToListAsync(ct);
        foreach (var (k, v) in values)
        {
            var row = rows.FirstOrDefault(x => x.SettingKey == k);
            if (row is null) _db.SiteSettings.Add(new SiteSetting { SettingKey = k, SettingValue = v });
            else row.SettingValue = v;
        }
        _audit.Record(actorId, "Update", "EmailSettings", null, $"{r.Mode}, {alerts.Count} alert address(es){(newKey is null ? "" : ", key replaced")}");
        await _db.SaveChangesAsync(ct);
        return await GetAsync(ct);
    }

    public async Task<EmailResultDto> SendTestAsync(string to, CancellationToken ct = default)
    {
        to = (to ?? "").Trim();
        if (!Address().IsMatch(to)) throw new AppException("Enter the address to send the test to.");
        var s = await LoadAsync(ct);
        var body = $"This is a test email from the Sun Steel Traders website, sent {DateTime.UtcNow.AddHours(5.5):d MMM yyyy, h:mm tt} (India time).\n\nIf you can read this, new requests will reach you.";
        return await SendAsync(s, [to], "Test email from Sun Steel Traders", body, null, null, ct);
    }

    public async Task NotifyNewRequestAsync(long leadId, CancellationToken ct = default)
    {
        try
        {
            var s = await LoadAsync(ct);
            var to = Split(s.GetValueOrDefault("EmailAlertTo"));
            if (to.Count == 0) return;
            var lead = await _db.Leads.AsNoTracking().Include(l => l.Items).FirstOrDefaultAsync(l => l.LeadId == leadId, ct);
            if (lead is null) return;

            var sb = new StringBuilder();
            sb.AppendLine($"New {(lead.Type == "RFQ" ? "material request" : lead.Type.ToLowerInvariant() + " enquiry")} {lead.Reference}");
            sb.AppendLine();
            sb.AppendLine($"Name:     {lead.Name}");
            if (lead.Company is not null) sb.AppendLine($"Company:  {lead.Company}");
            sb.AppendLine($"Phone:    {lead.Phone}");
            if (lead.Email is not null) sb.AppendLine($"Email:    {lead.Email}");
            if (lead.City is not null) sb.AppendLine($"City:     {lead.City}");
            if (lead.Gstin is not null) sb.AppendLine($"GSTIN:    {lead.Gstin}");
            sb.AppendLine($"Reply by: {lead.Channel}");
            if (lead.CallbackAt is { } cb) sb.AppendLine($"Call back: {cb:d MMM yyyy, h:mm tt}");
            if (lead.Items.Count > 0)
            {
                sb.AppendLine().AppendLine("Items:");
                foreach (var i in lead.Items.OrderBy(x => x.DisplayOrder))
                    sb.AppendLine($"  - {i.GradeText}: {i.Form} {i.DimsText}{(i.LengthMm is { } l ? $" x {l:0.##} mm" : "")}, {i.Quantity} pcs{(i.Kg is { } kg ? $", about {kg:0.##} kg" : "")}{(i.CutToSize ? ", cut to size" : "")}");
                if (lead.TotalKg is { } t) sb.AppendLine($"  Total about {t:0.##} kg");
            }
            if (!string.IsNullOrWhiteSpace(lead.Message)) sb.AppendLine().AppendLine("Message:").AppendLine(lead.Message);
            sb.AppendLine().AppendLine("Open it in the admin under Requests to reply or make a quotation. Any drawings sent with it are there too.");
            await SendAsync(s, to, $"New request {lead.Reference} from {lead.Name}", sb.ToString(), lead.Email, lead.Name, ct);
        }
        catch (Exception e)
        {
            _log.LogError(e, "Could not send the new-request alert for lead {LeadId}", leadId);
        }
    }

    // --- sending ---------------------------------------------------------------

    private async Task<EmailResultDto> SendAsync(Dictionary<string, string?> s, IReadOnlyList<string> to, string subject, string body, string? replyTo, string? replyName, CancellationToken ct)
    {
        var mode = s.GetValueOrDefault("EmailMode") ?? "Mock";
        if (mode != "Live")
        {
            _log.LogInformation("EMAIL (mock, not sent) to {To}: {Subject}\n{Body}", string.Join(", ", to), subject, body);
            return new EmailResultDto(false, "Mock mode: nothing was sent. The message was written to the server log.");
        }

        var host = s.GetValueOrDefault("SmtpHost");
        var login = s.GetValueOrDefault("SmtpLogin");
        var key = Unprotect(s.GetValueOrDefault("SmtpKey"));
        var from = s.GetValueOrDefault("EmailFromAddress");
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(login) || string.IsNullOrEmpty(key) || string.IsNullOrWhiteSpace(from))
            throw new AppException("The email settings are incomplete. Fill in the host, login, key and From address, then save.");
        _ = int.TryParse(s.GetValueOrDefault("SmtpPort"), out var port);

        using var msg = new MailMessage { From = new MailAddress(from, s.GetValueOrDefault("EmailFromName") ?? ""), Subject = subject, Body = body, IsBodyHtml = false, BodyEncoding = Encoding.UTF8, SubjectEncoding = Encoding.UTF8 };
        foreach (var t in to) msg.To.Add(t);
        if (!string.IsNullOrWhiteSpace(replyTo) && Address().IsMatch(replyTo)) msg.ReplyToList.Add(new MailAddress(replyTo, replyName ?? ""));

        using var smtp = new SmtpClient(host, port == 0 ? 587 : port) { EnableSsl = true, Credentials = new NetworkCredential(login, key), Timeout = 20_000 };
        try
        {
            await smtp.SendMailAsync(msg, ct);
        }
        catch (SmtpException e)
        {
            _log.LogError(e, "SMTP send failed: {Status}", e.StatusCode);
            throw new AppException($"The mail server refused it ({e.StatusCode}). Check the login, key and that the From address is verified in Brevo.");
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            _log.LogError(e, "SMTP send failed");
            throw new AppException("Could not reach the mail server. Check the host and port.");
        }
        return new EmailResultDto(true, $"Sent to {string.Join(", ", to)}.");
    }

    // --- settings and secret ---------------------------------------------------

    private async Task<Dictionary<string, string?>> LoadAsync(CancellationToken ct)
        => (await _db.SiteSettings.AsNoTracking().ToListAsync(ct)).Where(x => Keys.Contains(x.SettingKey)).ToDictionary(x => x.SettingKey, x => x.SettingValue);

    private static EmailSettingsDto ToDto(Dictionary<string, string?> s) => new(
        s.GetValueOrDefault("EmailMode") is "Live" ? "Live" : "Mock",
        s.GetValueOrDefault("SmtpHost") ?? "smtp-relay.brevo.com",
        int.TryParse(s.GetValueOrDefault("SmtpPort"), out var p) ? p : 587,
        s.GetValueOrDefault("SmtpLogin"), !string.IsNullOrEmpty(s.GetValueOrDefault("SmtpKey")),
        s.GetValueOrDefault("EmailFromAddress"), s.GetValueOrDefault("EmailFromName") ?? "Sun Steel Traders", Split(s.GetValueOrDefault("EmailAlertTo")));

    private static List<string> Split(string? v) => (v ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    private static string? Clean(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        s = s.Trim();
        return s.Length > max ? s[..max] : s;
    }

    private byte[] SecretKey() => SHA256.HashData(Encoding.UTF8.GetBytes("sst-smtp|" + (_config["Jwt:Key"] ?? "sunsteel")));

    private string Protect(string plain)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var data = Encoding.UTF8.GetBytes(plain);
        var cipher = new byte[data.Length];
        var tag = new byte[16];
        using var gcm = new AesGcm(SecretKey(), 16);
        gcm.Encrypt(nonce, data, cipher, tag);
        return Prefix + Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }

    private string? Unprotect(string? stored)
    {
        if (string.IsNullOrEmpty(stored) || !stored.StartsWith(Prefix)) return null;
        try
        {
            var all = Convert.FromBase64String(stored[Prefix.Length..]);
            var plain = new byte[all.Length - 28];
            using var gcm = new AesGcm(SecretKey(), 16);
            gcm.Decrypt(all.AsSpan(0, 12), all.AsSpan(28), all.AsSpan(12, 16), plain);
            return Encoding.UTF8.GetString(plain);
        }
        catch (CryptographicException)
        {
            _log.LogError("The saved SMTP key cannot be read (the server secret changed?). Enter it again in Email settings.");
            return null;
        }
    }

    [GeneratedRegex(@"^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$")]
    private static partial Regex Address();
}

/// <summary>Runs the new-request email after the response has gone, in its own scope, so the customer never waits on the mail server.</summary>
public interface INewRequestAlert
{
    void Queue(long leadId);
}

public sealed class NewRequestAlert : INewRequestAlert
{
    private readonly IServiceScopeFactory _scopes;

    public NewRequestAlert(IServiceScopeFactory scopes) => _scopes = scopes;

    public void Queue(long leadId)
    {
        _ = Task.Run(async () =>
        {
            using var scope = _scopes.CreateScope();
            await scope.ServiceProvider.GetRequiredService<IEmailService>().NotifyNewRequestAsync(leadId);
        });
    }
}
