using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using sunsteel.api.Common.Exceptions;
using sunsteel.api.Common.Models;
using sunsteel.api.Data;
using sunsteel.api.Data.Entities;
using sunsteel.api.Features.Audit;
using sunsteel.api.Features.Leads;

namespace sunsteel.api.Features.Quotes;

public sealed record CustomerDto(long Id, string Name, string? Company, string? Gstin, string Phone, string? Email, string? City, string? Address,
    string? Notes, int Quotes, DateTime CreatedAt);
public sealed record SaveCustomerRequest(string Name, string? Company, string? Gstin, string Phone, string? Email, string? City, string? Address, string? Notes);
public sealed record CustomerImportResult(int Created, int Updated, int Skipped, IReadOnlyList<string> Errors);

public interface ICustomerService
{
    Task<PagedResult<CustomerDto>> ListAsync(string? q, int page, int pageSize, CancellationToken ct = default);
    Task<IReadOnlyList<CustomerDto>> SearchAsync(string q, CancellationToken ct = default);
    Task<CustomerDto> SaveAsync(long actorId, long? id, SaveCustomerRequest r, CancellationToken ct = default);
    Task DeleteAsync(long actorId, long id, CancellationToken ct = default);
    Task<byte[]> ExportCsvAsync(CancellationToken ct = default);
    Task<CustomerImportResult> ImportCsvAsync(long actorId, Stream csv, CancellationToken ct = default);
}

/// <summary>
/// The customer master. One row per phone number. Quotations keep it up to date (<see cref="SyncFromQuoteAsync"/>); staff can edit it,
/// export it to a CSV file and import a CSV file back (rows matched on phone number, so an import updates rather than duplicates).
/// </summary>
public sealed partial class CustomerService : ICustomerService
{
    private static readonly string[] CsvColumns = ["Name", "Company", "GSTIN", "Phone", "Email", "City", "Address", "Notes"];
    private readonly SunSteelDbContext _db;
    private readonly IAuditService _audit;

    public CustomerService(SunSteelDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<PagedResult<CustomerDto>> ListAsync(string? q, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = Filter(_db.Customers.AsNoTracking(), q);
        var total = await query.LongCountAsync(ct);
        var rows = await ToDto(query.OrderBy(c => c.Name)).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new PagedResult<CustomerDto> { Items = rows, Page = page, PageSize = pageSize, TotalCount = total };
    }

    /// <summary>The first few matches, for the picker on the quotation form.</summary>
    public async Task<IReadOnlyList<CustomerDto>> SearchAsync(string q, CancellationToken ct = default)
        => string.IsNullOrWhiteSpace(q) ? [] : await ToDto(Filter(_db.Customers.AsNoTracking(), q).OrderBy(c => c.Name)).Take(8).ToListAsync(ct);

    public async Task<CustomerDto> SaveAsync(long actorId, long? id, SaveCustomerRequest r, CancellationToken ct = default)
    {
        var c = id is null ? new Customer { CreatedAt = DateTime.UtcNow } : await _db.Customers.FirstOrDefaultAsync(x => x.CustomerId == id, ct)
            ?? throw new AppException("Customer not found.", StatusCodes.Status404NotFound);
        Fill(c, r);
        var clash = await _db.Customers.AnyAsync(x => x.Phone == c.Phone && x.CustomerId != c.CustomerId, ct);
        if (clash) throw new AppException("Another customer already has this phone number.");
        if (id is null) _db.Customers.Add(c); else c.UpdatedAt = DateTime.UtcNow;
        _audit.Record(actorId, id is null ? "Create" : "Update", "Customer", c.Name, c.Phone);
        await _db.SaveChangesAsync(ct);
        return await ToDto(_db.Customers.AsNoTracking().Where(x => x.CustomerId == c.CustomerId)).FirstAsync(ct);
    }

    public async Task DeleteAsync(long actorId, long id, CancellationToken ct = default)
    {
        var c = await _db.Customers.FirstOrDefaultAsync(x => x.CustomerId == id, ct) ?? throw new AppException("Customer not found.", StatusCodes.Status404NotFound);
        if (await _db.Quotes.AnyAsync(q => q.CustomerId == id, ct)) throw new AppException("This customer has quotations, so it can't be deleted.");
        _db.Customers.Remove(c);
        _audit.Record(actorId, "Delete", "Customer", c.Name, c.Phone);
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Called when a quotation is saved: finds the customer by phone number (or creates one) and brings it up to date with what was typed.
    /// Blank fields on the quotation never erase what the master already has. Sets <c>quote.CustomerId</c>.
    /// </summary>
    public static async Task SyncFromQuoteAsync(SunSteelDbContext db, Quote quote, CancellationToken ct = default)
    {
        var c = await db.Customers.FirstOrDefaultAsync(x => x.Phone == quote.Phone, ct);
        var isNew = c is null;
        c ??= new Customer { Phone = quote.Phone, CreatedAt = DateTime.UtcNow };
        c.Name = quote.CustomerName;
        c.Company = quote.Company ?? c.Company;
        c.Gstin = quote.Gstin ?? c.Gstin;
        c.Email = quote.Email ?? c.Email;
        c.City = quote.City ?? c.City;
        c.Address = quote.Address ?? c.Address;
        if (isNew) db.Customers.Add(c); else if (db.Entry(c).State == EntityState.Modified) c.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        quote.CustomerId = c.CustomerId;
    }

    // --- CSV -------------------------------------------------------------------

    public async Task<byte[]> ExportCsvAsync(CancellationToken ct = default)
    {
        var rows = await _db.Customers.AsNoTracking().OrderBy(c => c.Name).ToListAsync(ct);
        var sb = new StringBuilder();
        sb.Append('﻿'); // so Excel reads it as UTF-8
        sb.AppendLine(string.Join(',', CsvColumns));
        foreach (var c in rows)
            sb.AppendLine(string.Join(',', new[] { c.Name, c.Company, c.Gstin, c.Phone.Replace("+", ""), c.Email, c.City, c.Address, c.Notes }.Select(Cell)));
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public async Task<CustomerImportResult> ImportCsvAsync(long actorId, Stream csv, CancellationToken ct = default)
    {
        using var reader = new StreamReader(csv, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var table = ParseCsv(await reader.ReadToEndAsync(ct));
        if (table.Count == 0) throw new AppException("The file is empty.");
        if (table.Count > 5001) throw new AppException("Up to 5,000 customers per file.");

        var head = table[0].Select(h => Regex.Replace(h.ToLowerInvariant(), "[^a-z]", "")).ToList();
        int Col(params string[] names) => head.FindIndex(h => names.Contains(h));
        int name = Col("name", "customername", "customer"), phone = Col("phone", "mobile", "whatsapp", "mobileno", "phoneno", "contact");
        if (name < 0 || phone < 0) throw new AppException("The first row must have column names, including Name and Phone. Export the list to see the layout.");
        int company = Col("company", "firm"), gstin = Col("gstin", "gst", "gstno"), email = Col("email", "mail"), city = Col("city", "place"),
            address = Col("address"), notes = Col("notes", "remarks");
        string? Get(List<string> row, int i) => i >= 0 && i < row.Count && !string.IsNullOrWhiteSpace(row[i]) ? row[i].Trim() : null;

        var byPhone = await _db.Customers.ToDictionaryAsync(c => c.Phone, ct);
        int created = 0, updated = 0, skipped = 0;
        var errors = new List<string>();
        for (var n = 1; n < table.Count; n++)
        {
            var row = table[n];
            if (row.All(string.IsNullOrWhiteSpace)) continue;
            try
            {
                var req = new SaveCustomerRequest(Get(row, name) ?? "", Get(row, company), Get(row, gstin), Get(row, phone) ?? "", Get(row, email), Get(row, city), Get(row, address), Get(row, notes));
                var probe = new Customer();
                Fill(probe, req);
                if (byPhone.TryGetValue(probe.Phone, out var existing))
                {
                    // A column that is blank in the file leaves the stored value alone.
                    existing.Name = probe.Name;
                    existing.Company = probe.Company ?? existing.Company;
                    existing.Gstin = probe.Gstin ?? existing.Gstin;
                    existing.Email = probe.Email ?? existing.Email;
                    existing.City = probe.City ?? existing.City;
                    existing.Address = probe.Address ?? existing.Address;
                    existing.Notes = probe.Notes ?? existing.Notes;
                    existing.UpdatedAt = DateTime.UtcNow;
                    updated++;
                }
                else
                {
                    probe.CreatedAt = DateTime.UtcNow;
                    _db.Customers.Add(probe);
                    byPhone[probe.Phone] = probe;
                    created++;
                }
            }
            catch (AppException e)
            {
                skipped++;
                if (errors.Count < 20) errors.Add($"Row {n + 1}: {e.Message}");
            }
        }
        _audit.Record(actorId, "Import", "Customer", "csv", $"{created} new, {updated} updated, {skipped} skipped");
        await _db.SaveChangesAsync(ct);
        return new CustomerImportResult(created, updated, skipped, errors);
    }

    // --- helpers ---------------------------------------------------------------

    private static IQueryable<Customer> Filter(IQueryable<Customer> query, string? q)
    {
        if (string.IsNullOrWhiteSpace(q)) return query;
        q = q.Trim();
        return query.Where(c => c.Name.Contains(q) || c.Phone.Contains(q) || (c.Company != null && c.Company.Contains(q))
            || (c.Gstin != null && c.Gstin.Contains(q)) || (c.City != null && c.City.Contains(q)));
    }

    private IQueryable<CustomerDto> ToDto(IQueryable<Customer> query)
        => query.Select(c => new CustomerDto(c.CustomerId, c.Name, c.Company, c.Gstin, c.Phone, c.Email, c.City, c.Address, c.Notes,
            _db.Quotes.Count(q => q.CustomerId == c.CustomerId), c.CreatedAt));

    private static void Fill(Customer c, SaveCustomerRequest r)
    {
        var name = (r.Name ?? "").Trim();
        if (name.Length is < 2 or > 150) throw new AppException("Enter the customer's name.");
        c.Phone = LeadService.NormalisePhone(r.Phone) ?? throw new AppException("Enter a valid 10-digit phone number.");
        var gstin = string.IsNullOrWhiteSpace(r.Gstin) ? null : r.Gstin.Trim().ToUpperInvariant();
        if (gstin is not null && !Gstin().IsMatch(gstin)) throw new AppException("GSTIN should be 15 characters, e.g. 33ABCDE1234F1Z5.");
        if (!string.IsNullOrWhiteSpace(r.Email) && !r.Email.Contains('@')) throw new AppException("Enter a valid email address.");
        c.Name = name;
        c.Gstin = gstin;
        c.Company = Cut(r.Company, 150);
        c.Email = Cut(r.Email, 256);
        c.City = Cut(r.City, 80);
        c.Address = Cut(r.Address, 400);
        c.Notes = Cut(r.Notes, 1000);
    }

    private static string? Cut(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        s = s.Trim();
        return s.Length > max ? s[..max] : s;
    }

    /// <summary>One CSV cell, quoted when needed. A leading = or @ would run as a formula in Excel, so it is made plain text.</summary>
    private static string Cell(string? v)
    {
        v ??= "";
        if (v.Length > 0 && v[0] is '=' or '@' or '\t' or '\r') v = "'" + v;
        return v.IndexOfAny([',', '"', '\r', '\n']) >= 0 ? "\"" + v.Replace("\"", "\"\"") + "\"" : v;
    }

    /// <summary>Plain CSV: commas, double-quoted cells with "" for a quote, line breaks allowed inside quotes.</summary>
    private static List<List<string>> ParseCsv(string text)
    {
        var rows = new List<List<string>>();
        var row = new List<string>();
        var cell = new StringBuilder();
        var quoted = false;
        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];
            if (quoted)
            {
                if (ch == '"' && i + 1 < text.Length && text[i + 1] == '"') { cell.Append('"'); i++; }
                else if (ch == '"') quoted = false;
                else cell.Append(ch);
            }
            else if (ch == '"') quoted = true;
            else if (ch == ',') { row.Add(cell.ToString()); cell.Clear(); }
            else if (ch is '\r' or '\n')
            {
                if (ch == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++;
                row.Add(cell.ToString()); cell.Clear();
                rows.Add(row); row = [];
            }
            else cell.Append(ch);
        }
        if (cell.Length > 0 || row.Count > 0) { row.Add(cell.ToString()); rows.Add(row); }
        return rows;
    }

    [GeneratedRegex("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$")]
    private static partial Regex Gstin();
}
