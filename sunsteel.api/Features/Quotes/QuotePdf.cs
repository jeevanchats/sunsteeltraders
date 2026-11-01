using SkiaSharp;

namespace sunsteel.api.Features.Quotes;

/// <summary>
/// A4 quotation PDF, drawn with SkiaSharp (already used for photographs), so there is no extra
/// PDF library or licence. Amounts print as "Rs." because server fonts often lack the ₹ glyph.
/// Colours come from the site theme, not hard-coded.
/// </summary>
public static class QuotePdf
{
    private const float W = 595, H = 842, M = 40; // A4 in points, margin
    private const float Bottom = H - 60;
    private static readonly System.Globalization.CultureInfo In = new("en-IN"); // 2,55,622.00

    public static byte[] Render(QuoteDetailDto q, IReadOnlyDictionary<string, string?> site, IReadOnlyDictionary<string, string?> theme)
    {
        using var stream = new MemoryStream();
        using (var doc = SKDocument.CreatePdf(stream, new SKDocumentPdfMetadata { Title = $"Quotation {q.Reference}", Creator = "sunsteeltraders.com" }))
        {
            var pdf = new Writer(doc, Colour(theme, "PrimaryColor", "#1E2430"), Colour(theme, "AccentColor", "#9C6B3C"),
                $"{site.GetValueOrDefault("BusinessName") ?? "Sun Steel Traders"} · {q.Reference}");
            pdf.NewPage();
            Header(pdf, q, site);
            Customer(pdf, q);
            Lines(pdf, q);
            Totals(pdf, q);
            Footer(pdf, q, site);
            pdf.Close();
        }
        return stream.ToArray();
    }

    private static void Header(Writer p, QuoteDetailDto q, IReadOnlyDictionary<string, string?> s)
    {
        p.Text(s.GetValueOrDefault("BusinessName") ?? "Sun Steel Traders", M, p.Y + 18, 20, bold: true, color: p.Primary);
        p.Text("QUOTATION", W - M, p.Y + 18, 16, bold: true, color: p.Accent, align: SKTextAlign.Right);
        var y = p.Y + 34;
        var lines = new List<string?>
        {
            string.Join(" · ", new[] { s.GetValueOrDefault("Tagline"), s.GetValueOrDefault("IsoCertificate") }.Where(x => !string.IsNullOrWhiteSpace(x))),
            s.GetValueOrDefault("Address"),
            string.Join(" · ", new[] { s.GetValueOrDefault("Phone1"), s.GetValueOrDefault("Landline"), s.GetValueOrDefault("SalesEmail") }.Where(x => !string.IsNullOrWhiteSpace(x))),
            s.GetValueOrDefault("Gstin") is { Length: > 0 } g ? $"GSTIN {g}" : null,
        };
        foreach (var l in lines.Where(l => !string.IsNullOrWhiteSpace(l)))
        {
            foreach (var w in p.Wrap(l!, 8.5f, 330)) { p.Text(w, M, y, 8.5f, color: p.Muted); y += 11.5f; }
        }
        var ry = p.Y + 34;
        foreach (var (k, v) in new[] { ("No.", q.Reference), ("Date", q.QuoteDate.ToString("dd-MM-yyyy")), ("Valid until", q.ValidUntil.ToString("dd-MM-yyyy")) })
        {
            p.Text(k, W - M - 140, ry, 9, color: p.Muted);
            p.Text(v, W - M, ry, 9, bold: true, align: SKTextAlign.Right);
            ry += 13;
        }
        p.Y = Math.Max(y, ry) + 8;
        p.Rule(p.Accent, 1.2f);
        p.Y += 14;
    }

    private static void Customer(Writer p, QuoteDetailDto q)
    {
        p.Text("TO", M, p.Y, 8, bold: true, color: p.Muted);
        p.Y += 13;
        p.Text(q.Company ?? q.CustomerName, M, p.Y, 11, bold: true);
        p.Y += 13;
        var rest = new List<string?> { q.Company is null ? null : $"Attn: {q.CustomerName}", q.Address, q.City,
            string.Join(" · ", new[] { q.Phone, q.Email }.Where(x => !string.IsNullOrWhiteSpace(x))), q.Gstin is null ? null : $"GSTIN {q.Gstin}" };
        foreach (var l in rest.Where(l => !string.IsNullOrWhiteSpace(l)))
            foreach (var w in p.Wrap(l!, 9, 360)) { p.Text(w, M, p.Y, 9); p.Y += 12; }
        p.Y += 10;
    }

    // Columns: # | Description | Qty | Kg | Rate/kg | Amount (right edges for numbers)
    private static readonly float[] ColRight = [M + 18, 0, 380, 430, 485, W - M];

    private static void TableHead(Writer p)
    {
        p.Fill(M, p.Y - 11, W - 2 * M, 17, p.Primary);
        p.Text("#", ColRight[0], p.Y, 8.5f, bold: true, color: SKColors.White, align: SKTextAlign.Right);
        p.Text("Description / size", M + 26, p.Y, 8.5f, bold: true, color: SKColors.White);
        string[] heads = ["", "", "Qty", "Kg", "Rate/kg", "Amount"];
        for (var c = 2; c < 6; c++) p.Text(heads[c], ColRight[c] - 4, p.Y, 8.5f, bold: true, color: SKColors.White, align: SKTextAlign.Right);
        p.Y += 18;
    }

    private static void Lines(Writer p, QuoteDetailDto q)
    {
        TableHead(p);
        var n = 0;
        foreach (var i in q.Items)
        {
            var desc = p.Wrap(i.Description, 9, 280);
            var size = i.Size is null ? [] : p.Wrap(i.Size, 8, 280);
            var height = desc.Count * 11.5f + size.Count * 10.5f + 6;
            if (p.Y + height > Bottom) { p.NewPage(); TableHead(p); }
            var top = p.Y;
            p.Text($"{++n}", ColRight[0], top, 9, color: p.Muted, align: SKTextAlign.Right);
            p.Text($"{i.Quantity.ToString("#,##0", In)}", ColRight[2] - 4, top, 9, align: SKTextAlign.Right);
            p.Text($"{i.Kg.ToString("#,##0.00", In)}", ColRight[3] - 4, top, 9, align: SKTextAlign.Right);
            p.Text($"{i.RatePerKg.ToString("#,##0.00", In)}", ColRight[4] - 4, top, 9, align: SKTextAlign.Right);
            p.Text($"{i.Amount.ToString("#,##0.00", In)}", ColRight[5] - 4, top, 9, bold: true, align: SKTextAlign.Right);
            foreach (var d in desc) { p.Text(d, M + 26, p.Y, 9); p.Y += 11.5f; }
            foreach (var s in size) { p.Text(s, M + 26, p.Y, 8, color: p.Muted); p.Y += 10.5f; }
            p.Y += 2;
            p.Rule(new SKColor(0xE3, 0xE6, 0xEB), 0.5f);
            p.Y += 12;
        }
    }

    private static void Totals(Writer p, QuoteDetailDto q)
    {
        var t = q.Totals;
        var rows = new List<(string Label, decimal Amount, bool Bold)> { ($"Material ({t.TotalKg.ToString("#,##0.##", In)} kg)", t.MaterialTotal, false) };
        if (q.CuttingCharge > 0) rows.Add(("Cutting charges", q.CuttingCharge, false));
        if (q.LoadingCharge > 0) rows.Add(("Loading charges", q.LoadingCharge, false));
        if (q.UnloadingCharge > 0) rows.Add(("Unloading charges", q.UnloadingCharge, false));
        if (q.TransportCharge > 0) rows.Add(("Transport charges", q.TransportCharge, false));
        if (q.Discount > 0) rows.Add(("Less: discount", -q.Discount, false));
        rows.Add(("Taxable value", t.Taxable, true));
        if (q.InterState) rows.Add(($"IGST @ {q.GstRate:0.##}%", t.Igst, false));
        else { rows.Add(($"CGST @ {q.GstRate / 2:0.##}%", t.Cgst, false)); rows.Add(($"SGST @ {q.GstRate / 2:0.##}%", t.Sgst, false)); }
        if (t.RoundOff != 0) rows.Add(("Round off", t.RoundOff, false));

        if (p.Y + rows.Count * 14 + 60 > Bottom) p.NewPage();
        p.Y += 4;
        foreach (var (label, amount, bold) in rows)
        {
            p.Text(label, 330, p.Y, 9, bold: bold, color: bold ? p.Ink : p.Muted);
            p.Text($"{amount.ToString("#,##0.00", In)}", W - M - 4, p.Y, 9, bold: bold, align: SKTextAlign.Right);
            p.Y += 14;
        }
        p.Fill(322, p.Y - 10, W - M - 322, 20, p.Primary);
        p.Text("Grand total (Rs.)", 330, p.Y + 4, 10.5f, bold: true, color: SKColors.White);
        p.Text($"{t.GrandTotal.ToString("#,##0.00", In)}", W - M - 4, p.Y + 4, 10.5f, bold: true, color: SKColors.White, align: SKTextAlign.Right);
        p.Y += 26;
        foreach (var w in p.Wrap(QuoteMath.InWords(t.GrandTotal), 8.5f, W - 2 * M)) { p.Text(w, M, p.Y, 8.5f, color: p.Muted); p.Y += 11; }
        p.Y += 10;
    }

    private static void Footer(Writer p, QuoteDetailDto q, IReadOnlyDictionary<string, string?> s)
    {
        void Block(string title, string? body)
        {
            if (string.IsNullOrWhiteSpace(body)) return;
            var lines = body.Replace("\r", "").Split('\n').SelectMany(l => p.Wrap(l, 8.5f, W - 2 * M)).ToList();
            if (p.Y + 14 + lines.Count * 11 > Bottom) p.NewPage();
            p.Text(title, M, p.Y, 8, bold: true, color: p.Muted);
            p.Y += 12;
            foreach (var l in lines) { p.Text(l, M, p.Y, 8.5f); p.Y += 11; }
            p.Y += 10;
        }
        Block("NOTES", q.Notes);
        Block("TERMS & CONDITIONS", q.Terms);
        if (p.Y + 50 > Bottom) p.NewPage();
        p.Y += 16;
        p.Text($"For {s.GetValueOrDefault("BusinessName") ?? "Sun Steel Traders"}", W - M, p.Y, 9, bold: true, align: SKTextAlign.Right);
        p.Y += 34;
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
        public SKColor Ink { get; } = new(0x1E, 0x24, 0x30);
        public SKColor Muted { get; } = new(0x6B, 0x74, 0x85);
        public float Y { get; set; }

        public void NewPage()
        {
            if (_canvas is not null) doc.EndPage();
            _canvas = doc.BeginPage(W, H);
            _page++;
            Y = M;
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
