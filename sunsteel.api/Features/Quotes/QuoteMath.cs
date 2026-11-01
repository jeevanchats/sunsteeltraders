namespace sunsteel.api.Features.Quotes;

public sealed record PricedLine(decimal Kg, decimal? Amount, decimal GstRate);

/// <summary>
/// Quote totals. Lives twice, like the weight formulas: here and in
/// <c>core/quote/quote-math.ts</c> (the editor's live preview). Change both; the server wins.
/// Order: line amounts → subtotal → discount spread over the lines in proportion to their amounts →
/// cutting/loading/unloading/freight added at their own GST rate → GST per rate (CGST + SGST inside
/// Tamil Nadu, IGST outside), listed once per rate → round off to the rupee.
/// A line without a price has no amount and stays out of the totals.
/// </summary>
public static class QuoteMath
{
    /// <summary>Calculated and by-weight lines: kg × rate. By-unit lines: quantity × unit price. Null while the price is missing.</summary>
    public static decimal? LineAmount(string itemType, decimal kg, decimal ratePerKg, int quantity, decimal? unitPrice)
    {
        if (itemType == "ManualUnit")
            return quantity > 0 && unitPrice is > 0 ? R2(quantity * unitPrice.Value) : null;
        return kg > 0 && ratePerKg > 0 ? R2(kg * ratePerKg) : null;
    }

    public static QuoteTotalsDto Totals(IEnumerable<PricedLine> lines,
        decimal cutting, decimal loading, decimal unloading, decimal transport, decimal discount, decimal chargeGstRate, bool interState)
    {
        var all = lines.ToList();
        var priced = all.Where(l => l.Amount is > 0).ToList();
        var subtotal = priced.Sum(l => l.Amount!.Value);
        var charges = R2(cutting + loading + unloading + transport);

        // Amount per GST rate, in the order the rates first appear.
        var groups = new List<(decimal Rate, decimal Amount)>();
        void Add(decimal rate, decimal amount)
        {
            var i = groups.FindIndex(g => g.Rate == rate);
            if (i < 0) groups.Add((rate, amount)); else groups[i] = (rate, groups[i].Amount + amount);
        }
        foreach (var l in priced) Add(l.GstRate, l.Amount!.Value);

        // Discount first goes over the lines, in proportion; any rounding remainder lands on the largest group.
        var remaining = Math.Min(discount, subtotal > 0 ? subtotal : 0);
        if (subtotal > 0 && remaining > 0)
        {
            var shares = groups.Select(g => R2(remaining * g.Amount / subtotal)).ToList();
            var big = groups.Select((g, i) => (g.Amount, i)).MaxBy(x => x.Amount).i;
            shares[big] += remaining - shares.Sum();
            for (var i = 0; i < groups.Count; i++) groups[i] = (groups[i].Rate, groups[i].Amount - shares[i]);
        }
        // With no priced line there is nothing to spread over: the discount comes off the charges instead.
        var chargesLeft = Math.Max(0, charges - (subtotal > 0 ? 0 : discount));
        if (chargesLeft > 0) Add(chargeGstRate, chargesLeft);

        var taxGroups = groups.Where(g => g.Amount > 0).OrderBy(g => g.Rate).Select(g =>
        {
            var taxable = R2(g.Amount);
            decimal cgst = 0, sgst = 0, igst = 0;
            if (interState) igst = R2(taxable * g.Rate / 100);
            else { cgst = R2(taxable * g.Rate / 200); sgst = cgst; }
            return new TaxGroupDto(g.Rate, taxable, cgst, sgst, igst);
        }).ToList();

        var taxableTotal = taxGroups.Sum(g => g.Taxable);
        var cgstTotal = taxGroups.Sum(g => g.Cgst);
        var sgstTotal = taxGroups.Sum(g => g.Sgst);
        var igstTotal = taxGroups.Sum(g => g.Igst);
        var beforeRound = taxableTotal + cgstTotal + sgstTotal + igstTotal;
        var grand = Math.Round(beforeRound, 0, MidpointRounding.AwayFromZero);
        return new QuoteTotalsDto(all.Sum(l => l.Kg), subtotal, charges, Math.Min(discount, subtotal + charges), taxableTotal,
            cgstTotal, sgstTotal, igstTotal, grand - beforeRound, grand, taxGroups);
    }

    private static decimal R2(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

    /// <summary>"Rupees One Lakh Twenty Thousand Only": Indian numbering, as printed on quotes and invoices.</summary>
    public static string InWords(decimal amount)
    {
        var rupees = (long)Math.Floor(amount);
        var paise = (int)Math.Round((amount - rupees) * 100);
        var words = rupees == 0 ? "Zero" : Indian(rupees);
        return $"Rupees {words}{(paise > 0 ? $" and {Below100(paise)} Paise" : "")} Only";
    }

    private static readonly string[] Ones =
        ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
         "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    private static readonly string[] Tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    private static string Below100(long n) => n < 20 ? Ones[n] : $"{Tens[n / 10]}{(n % 10 > 0 ? " " + Ones[n % 10] : "")}";

    private static string Below1000(long n) =>
        n < 100 ? Below100(n) : $"{Ones[n / 100]} Hundred{(n % 100 > 0 ? " " + Below100(n % 100) : "")}";

    private static string Indian(long n)
    {
        var parts = new List<string>();
        void Take(long unit, string name)
        {
            if (n < unit) return;
            parts.Add($"{(name == "Crore" ? Indian(n / unit) : Below100(n / unit))} {name}");
            n %= unit;
        }
        Take(10_000_000, "Crore");
        Take(100_000, "Lakh");
        Take(1_000, "Thousand");
        if (n > 0) parts.Add(Below1000(n));
        return string.Join(" ", parts);
    }
}
