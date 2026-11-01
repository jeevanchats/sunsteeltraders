using System.Globalization;
using SkiaSharp;

namespace sunsteel.api.Features.Quotes;

/// <summary>
/// A4 quotation PDF, drawn with SkiaSharp (already used for photographs), so there is no extra PDF library or licence.
/// Amounts print as "Rs." because server fonts often lack the ₹ glyph; embedding a font that has it (Noto Sans) is a
/// follow-up. Colours come from the site theme, not hard-coded. Blocks with nothing to print (bank details, notes) are left out.
/// </summary>
public static class QuotePdf
{
    private const float W = 595, H = 842, M = 40; // A4 in points, margin
    private const float Bottom = H - 62;
    private static readonly CultureInfo In = new("en-IN"); // 2,55,622.00

    // Table columns: right edges, in points. Description takes the space on the left.
    private const float ColHsn = 322, ColQty = 372, ColKg = 424, ColRate = 486, ColAmt = W - M;
    private const float DescX = M + 26, DescWidth = ColHsn - 58 - DescX;

    public static byte[] Render(QuoteDetailDto q, IReadOnlyDictionary<string, string?> site, IReadOnlyDictionary<string, string?> theme)
    {
        var decimals = int.TryParse(site.GetValueOrDefault("QuoteWeightDecimals"), out var wd) ? Math.Clamp(wd, 0, 3) : 1;
        using var stream = new MemoryStream();
        using (var doc = SKDocument.CreatePdf(stream, new SKDocumentPdfMetadata { Title = $"Quotation {q.Reference}", Creator = "sunsteeltraders.com" }))
        {
            var pdf = new Writer(doc, Colour(theme, "PrimaryColor", "#1E2430"), Colour(theme, "AccentColor", "#9C6B3C"),
                $"{site.GetValueOrDefault("BusinessName") ?? "Sun Steel Traders"} · {q.Reference}");
            pdf.NewPage();
            Header(pdf, q, site);
            Customer(pdf, q);
            Lines(pdf, q, decimals);
            Totals(pdf, q, decimals);
            Footer(pdf, q, site);
            pdf.Close();
        }
        return stream.ToArray();
    }

    private static void Header(Writer p, QuoteDetailDto q, IReadOnlyDictionary<string, string?> s)
    {
        var lines = new List<string>();
        void Add(params string?[] parts)
        {
            var text = string.Join(" · ", parts.Where(x => !string.IsNullOrWhiteSpace(x)));
            if (text.Length > 0) lines.Add(text);
        }
        Add(s.GetValueOrDefault("Tagline"), s.GetValueOrDefault("IsoCertificate"));
        Add(s.GetValueOrDefault("Address"));
        Add(s.GetValueOrDefault("QuoteBranchAddress") is { Length: > 0 } branch ? $"Branch: {branch}" : null);
        Add(s.GetValueOrDefault("Phone1"), s.GetValueOrDefault("Phone2"), s.GetValueOrDefault("Landline"), s.GetValueOrDefault("SalesEmail"));
        Add(s.GetValueOrDefault("Gstin") is { Length: > 0 } g ? $"GSTIN {g}" : null);

        var wrapped = lines.SelectMany(l => p.Wrap(l, 8.5f, 330)).ToList();
        var bandHeight = Math.Max(52 + wrapped.Count * 11.5f + 6, 96);
        p.Fill(0, 0, W, bandHeight, p.Primary);

        p.Text(s.GetValueOrDefault("BusinessName") ?? "Sun Steel Traders", M, 36, 20, bold: true, color: SKColors.White);
        var y = 52f;
        foreach (var w in wrapped) { p.Text(w, M, y, 8.5f, color: new SKColor(0xD9, 0xDD, 0xE5)); y += 11.5f; }

        p.Text("QUOTATION", W - M, 36, 16, bold: true, color: p.AccentOnDark, align: SKTextAlign.Right);
        p.Text(TypeLabel(q.QuoteType), W - M, 50, 8.5f, bold: true, color: SKColors.White, align: SKTextAlign.Right);
        var ry = 64f;
        foreach (var (k, v) in new[] { ("No.", q.Reference), ("Date", q.QuoteDate.ToString("dd-MM-yyyy")), ("Valid until", q.ValidUntil.ToString("dd-MM-yyyy")) })
        {
            p.Text(k, W - M - 140, ry, 9, color: new SKColor(0xD9, 0xDD, 0xE5));
            p.Text(v, W - M, ry, 9, bold: true, color: SKColors.White, align: SKTextAlign.Right);
            ry += 13;
        }
        p.Y = bandHeight + 18;
    }

    private static void Customer(Writer p, QuoteDetailDto q)
    {
        p.Text("TO", M, p.Y, 8, bold: true, color: p.Muted);
        p.Y += 13;
        p.Text(q.Company ?? q.CustomerName, M, p.Y, 11, bold: true);
        p.Y += 13;
        var rest = new List<string?> { q.Company is null ? null : $"Attn: {q.CustomerName}", q.Address, q.City is null ? null : $"Destination: {q.City}",
            string.Join(" · ", new[] { q.Phone, q.Email }.Where(x => !string.IsNullOrWhiteSpace(x))), q.Gstin is null ? null : $"GSTIN {q.Gstin}",
            StateLine(q.Gstin),
            string.Join(" · ", new[] { q.BuyerRef is null ? null : $"Your ref: {q.BuyerRef}", q.DispatchedThrough is null ? null : $"Dispatch through: {q.DispatchedThrough}" }.Where(x => x is not null)) };
        foreach (var l in rest.Where(l => !string.IsNullOrWhiteSpace(l)))
            foreach (var w in p.Wrap(l!, 9, 360)) { p.Text(w, M, p.Y, 9); p.Y += 12; }
        p.Y += 10;
    }

    private static void TableHead(Writer p)
    {
        p.Fill(M, p.Y - 11, W - 2 * M, 17, p.Primary);
        p.Text("#", M + 18, p.Y, 8.5f, bold: true, color: SKColors.White, align: SKTextAlign.Right);
        p.Text("Description", DescX, p.Y, 8.5f, bold: true, color: SKColors.White);
        p.Text("HSN", ColHsn, p.Y, 8.5f, bold: true, color: SKColors.White, align: SKTextAlign.Right);
        p.Text("Qty", ColQty, p.Y, 8.5f, bold: true, color: SKColors.White, align: SKTextAlign.Right);
        p.Text("Weight kg", ColKg, p.Y, 8.5f, bold: true, color: SKColors.White, align: SKTextAlign.Right);
        p.Text("Rate", ColRate, p.Y, 8.5f, bold: true, color: SKColors.White, align: SKTextAlign.Right);
        p.Text("Amount", ColAmt - 4, p.Y, 8.5f, bold: true, color: SKColors.White, align: SKTextAlign.Right);
        p.Y += 18;
    }

    /// <summary>"State: Tamil Nadu, code 33", from the first two digits of the buyer's GSTIN.</summary>
    private static string? StateLine(string? gstin)
    {
        if (gstin is not { Length: >= 2 }) return null;
        var code = gstin[..2];
        return States.TryGetValue(code, out var name) ? $"State: {name}, code {code}" : null;
    }

    private static readonly Dictionary<string, string> States = new()
    {
        ["01"] = "Jammu and Kashmir", ["02"] = "Himachal Pradesh", ["03"] = "Punjab", ["04"] = "Chandigarh", ["05"] = "Uttarakhand",
        ["06"] = "Haryana", ["07"] = "Delhi", ["08"] = "Rajasthan", ["09"] = "Uttar Pradesh", ["10"] = "Bihar", ["11"] = "Sikkim",
        ["12"] = "Arunachal Pradesh", ["13"] = "Nagaland", ["14"] = "Manipur", ["15"] = "Mizoram", ["16"] = "Tripura",
        ["17"] = "Meghalaya", ["18"] = "Assam", ["19"] = "West Bengal", ["20"] = "Jharkhand", ["21"] = "Odisha", ["22"] = "Chhattisgarh",
        ["23"] = "Madhya Pradesh", ["24"] = "Gujarat", ["26"] = "Dadra and Nagar Haveli and Daman and Diu", ["27"] = "Maharashtra",
        ["29"] = "Karnataka", ["30"] = "Goa", ["31"] = "Lakshadweep", ["32"] = "Kerala", ["33"] = "Tamil Nadu", ["34"] = "Puducherry",
        ["35"] = "Andaman and Nicobar Islands", ["36"] = "Telangana", ["37"] = "Andhra Pradesh", ["38"] = "Ladakh", ["97"] = "Other Territory",
    };

    private static string TypeLabel(string type) => type switch
    {
        "Project" => "PROJECT",
        "Wholesale" => "WHOLESALE",
        "CutPieces" => "CUT PIECES",
        _ => "RETAIL",
    };

    private static string Kg(decimal v, int decimals) => v.ToString("#,##0." + new string('0', decimals), In).TrimEnd('.');

    private static void Lines(Writer p, QuoteDetailDto q, int decimals)
    {
        TableHead(p);
        var n = 0;
        foreach (var i in q.Items)
        {
            var title = string.IsNullOrWhiteSpace(i.Brand) ? i.Description : $"{i.Brand} {i.Description}";
            var desc = p.Wrap(title, 9, DescWidth);
            var sub = new List<string>();
            if (!string.IsNullOrWhiteSpace(i.Size)) sub.AddRange(p.Wrap(i.Size!, 8, DescWidth));
            if (!string.IsNullOrWhiteSpace(i.Model)) sub.AddRange(p.Wrap($"Model: {i.Model}", 8, DescWidth));
            if (!string.IsNullOrWhiteSpace(i.Remarks)) sub.AddRange(p.Wrap(i.Remarks!, 8, DescWidth));
            var height = desc.Count * 11.5f + sub.Count * 10.5f + 6;
            if (p.Y + height > Bottom) { p.NewPage(); TableHead(p); }

            var top = p.Y;
            var byUnit = i.ItemType == "ManualUnit";
            var rate = byUnit ? i.UnitPrice : (i.RatePerKg > 0 ? i.RatePerKg : null);
            p.Text($"{++n}", M + 18, top, 9, color: p.Muted, align: SKTextAlign.Right);
            p.Text(i.Hsn ?? "", ColHsn, top, 8.5f, align: SKTextAlign.Right);
            p.Text($"{i.Quantity.ToString("#,##0", In)} {i.Unit}", ColQty, top, 8.5f, align: SKTextAlign.Right);
            p.Text(i.Kg > 0 && !byUnit ? Kg(i.Kg, decimals) : "—", ColKg, top, 9, align: SKTextAlign.Right);
            p.Text(rate is { } r ? $"{r.ToString("#,##0.00", In)}/{(byUnit ? i.Unit : "kg")}" : "—", ColRate, top, 8.5f, align: SKTextAlign.Right);
            p.Text(i.Amount is { } a ? a.ToString("#,##0.00", In) : "—", ColAmt - 4, top, 9, bold: true, align: SKTextAlign.Right);
            foreach (var d in desc) { p.Text(d, DescX, p.Y, 9); p.Y += 11.5f; }
            foreach (var s in sub) { p.Text(s, DescX, p.Y, 8, color: p.Muted); p.Y += 10.5f; }
            p.Y += 2;
            p.Rule(new SKColor(0xE3, 0xE6, 0xEB), 0.5f);
            p.Y += 12;
        }
    }

    private static void Totals(Writer p, QuoteDetailDto q, int decimals)
    {
        var t = q.Totals;
        // Wholesale is bought by the tonne, so the weight is also shown in tonnes.
        var weight = q.QuoteType == "Wholesale" ? $"{Kg(t.TotalKg, decimals)} kg · {(t.TotalKg / 1000).ToString("#,##0.###", In)} t" : $"{Kg(t.TotalKg, decimals)} kg";
        var rows = new List<(string Label, decimal Amount, bool Bold)> { ($"Subtotal ({weight})", t.Subtotal, false) };
        if (t.Discount > 0) rows.Add(("Less: discount", -t.Discount, false));
        if (q.CuttingCharge > 0) rows.Add(("Cutting charges", q.CuttingCharge, false));
        if (q.LoadingCharge > 0) rows.Add(("Loading charges", q.LoadingCharge, false));
        if (q.UnloadingCharge > 0) rows.Add(("Unloading charges", q.UnloadingCharge, false));
        if (q.TransportCharge > 0) rows.Add(("Cartage / freight", q.TransportCharge, false));
        rows.Add(("Taxable value", t.Taxable, true));
        // Tax listed once per rate.
        foreach (var g in t.TaxGroups)
        {
            if (q.InterState) rows.Add(($"IGST @ {g.Rate:0.##}%", g.Igst, false));
            else { rows.Add(($"CGST @ {g.Rate / 2:0.##}%", g.Cgst, false)); rows.Add(($"SGST @ {g.Rate / 2:0.##}%", g.Sgst, false)); }
        }
        if (t.RoundOff != 0) rows.Add(("Round off", t.RoundOff, false));

        if (p.Y + rows.Count * 14 + 60 > Bottom) p.NewPage();
        p.Y += 4;
        foreach (var (label, amount, bold) in rows)
        {
            p.Text(label, 330, p.Y, 9, bold: bold, color: bold ? p.Ink : p.Muted);
            p.Text(amount.ToString("#,##0.00", In), W - M - 4, p.Y, 9, bold: bold, align: SKTextAlign.Right);
            p.Y += 14;
        }
        p.Fill(322, p.Y - 10, W - M - 322, 20, p.Primary);
        p.Text("Grand total (Rs.)", 330, p.Y + 4, 10.5f, bold: true, color: SKColors.White);
        p.Text(t.GrandTotal.ToString("#,##0.00", In), W - M - 4, p.Y + 4, 10.5f, bold: true, color: SKColors.White, align: SKTextAlign.Right);
        p.Y += 26;
        p.Text("E. & O.E", W - M, p.Y, 8.5f, color: p.Muted, align: SKTextAlign.Right); // errors and omissions excepted, as on their invoices
        foreach (var w in p.Wrap(QuoteMath.InWords(t.GrandTotal), 8.5f, W - 2 * M - 60)) { p.Text(w, M, p.Y, 8.5f, color: p.Muted); p.Y += 11; }
        p.Y += 10;
    }

    private static void Footer(Writer p, QuoteDetailDto q, IReadOnlyDictionary<string, string?> s)
    {
        List<string> Wrapped(string body) => body.Replace("\r", "").Split('\n').SelectMany(l => p.Wrap(l, 8.5f, W - 2 * M)).ToList();
        float Height(List<string> lines) => 12 + lines.Count * 11 + 10;
        void Draw(string title, List<string> lines)
        {
            p.Text(title, M, p.Y, 8, bold: true, color: p.Muted);
            p.Y += 12;
            foreach (var l in lines) { p.Text(l, M, p.Y, 8.5f); p.Y += 11; }
            p.Y += 10;
        }
        void Block(string title, string? body)
        {
            if (string.IsNullOrWhiteSpace(body)) return; // nothing supplied: leave the block out rather than print blanks
            var lines = Wrapped(body);
            if (p.Y + Height(lines) > Bottom) p.NewPage();
            Draw(title, lines);
        }
        Block("NOTES", q.Notes);
        Block("PAYMENT TERMS", q.PaymentTerms);
        Block("BANK DETAILS", q.BankDetails);

        // Terms and the signature travel together, so a page break never strands the signature alone.
        const float signature = 44;
        var terms = string.IsNullOrWhiteSpace(q.Terms) ? null : Wrapped(q.Terms);
        var needed = (terms is null ? 0 : Height(terms)) + signature;
        if (p.Y + needed > H - 48) p.NewPage();
        if (terms is not null) Draw("TERMS & CONDITIONS", terms);
        p.Y += 6;
        p.Text($"For {s.GetValueOrDefault("BusinessName") ?? "Sun Steel Traders"}", W - M, p.Y, 9, bold: true, align: SKTextAlign.Right);
        p.Y += 26;
        p.Text("Authorised signatory", W - M, p.Y, 8.5f, color: p.Muted, align: SKTextAlign.Right);
    }

    private static SKColor Colour(IReadOnlyDictionary<string, string?> theme, string key, string fallback) =>
        SKColor.TryParse(theme.GetValueOrDefault(key) ?? fallback, out var c) ? c : SKColor.Parse(fallback);

    /// <summary>Page, cursor and text helpers over one PDF document.</summary>
    private sealed class Writer(SKDocument doc, SKColor primary, SKColor accent, string pageLabel)
    {
        private static readonly SKTypeface Regular = SKTypeface.FromFamilyName("Arial", SKFontStyle.Normal) ?? SKTypeface.Default;
        private static readonly SKTypeface BoldFace = SKTypeface.FromFamilyName("Arial", SKFontStyle.Bold) ?? SKTypeface.Default;
        private SKCanvas? _canvas;
        private int _page;

        public SKColor Primary { get; } = primary;
        public SKColor Accent { get; } = accent;
        /// <summary>The accent, lightened so it stays readable on the dark header band.</summary>
        public SKColor AccentOnDark { get; } = new SKColor(
            (byte)(accent.Red + (255 - accent.Red) * 0.45), (byte)(accent.Green + (255 - accent.Green) * 0.45), (byte)(accent.Blue + (255 - accent.Blue) * 0.45));
        public SKColor Ink { get; } = new(0x1E, 0x24, 0x30);
        public SKColor Muted { get; } = new(0x6B, 0x74, 0x85);
        public float Y { get; set; }

        public void NewPage()
        {
            if (_canvas is not null) doc.EndPage();
            _canvas = doc.BeginPage(W, H);
            _page++;
            Y = M;
            Text("Weights are theoretical; invoices use actual weighed or mill weight.", W / 2, H - 36, 7.5f, color: Muted, align: SKTextAlign.Center);
            Text($"{pageLabel} · page {_page}", W / 2, H - 24, 7.5f, color: Muted, align: SKTextAlign.Center);
        }

        public void Close() { if (_canvas is not null) doc.EndPage(); doc.Close(); }

        public void Text(string text, float x, float y, float size, bool bold = false, SKColor? color = null, SKTextAlign align = SKTextAlign.Left)
        {
            using var font = new SKFont(bold ? BoldFace : Regular, size);
            using var paint = new SKPaint { Color = color ?? Ink, IsAntialias = true };
            _canvas!.DrawText(text, x, y, align, font, paint);
        }

        public void Fill(float x, float y, float w, float h, SKColor color)
        {
            using var paint = new SKPaint { Color = color, Style = SKPaintStyle.Fill };
            _canvas!.DrawRect(x, y, w, h, paint);
        }

        public void Rule(SKColor color, float width)
        {
            using var paint = new SKPaint { Color = color, StrokeWidth = width, Style = SKPaintStyle.Stroke };
            _canvas!.DrawLine(M, Y, W - M, Y, paint);
        }

        /// <summary>Greedy word wrap to a width in points.</summary>
        public List<string> Wrap(string text, float size, float width)
        {
            using var font = new SKFont(Regular, size);
            var lines = new List<string>();
            var line = "";
            foreach (var word in text.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            {
                var next = line.Length == 0 ? word : $"{line} {word}";
                if (font.MeasureText(next) <= width || line.Length == 0) line = next;
                else { lines.Add(line); line = word; }
            }
            if (line.Length > 0 || lines.Count == 0) lines.Add(line);
            return lines;
        }
    }
}
