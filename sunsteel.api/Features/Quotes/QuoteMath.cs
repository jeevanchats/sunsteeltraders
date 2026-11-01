namespace sunsteel.api.Features.Quotes;

/// <summary>
/// Quote totals. Lives twice, like the weight formulas: here and in
/// <c>core/quote/quote-math.ts</c> (the editor's live preview). Change both.
/// Order: lines (kg × rate) + cutting + loading + unloading + transport − discount = taxable;
/// GST on taxable (CGST + SGST inside Tamil Nadu, IGST outside); grand total rounded to the rupee.
/// </summary>
public static class QuoteMath
{
    public static decimal LineAmount(decimal kg, decimal ratePerKg) => R2(kg * ratePerKg);

    public static QuoteTotalsDto Totals(IEnumerable<(decimal Kg, decimal Rate)> lines,
        decimal cutting, decimal loading, decimal unloading, decimal transport, decimal discount, decimal gstRate, bool interState)
    {
        var list = lines.ToList();
        var material = list.Sum(l => LineAmount(l.Kg, l.Rate));
        var charges = cutting + loading + unloading + transport;
        var taxable = Math.Max(0, material + charges - discount);
        decimal cgst = 0, sgst = 0, igst = 0;
        if (interState) igst = R2(taxable * gstRate / 100);
        else { cgst = R2(taxable * gstRate / 200); sgst = cgst; }
        var beforeRound = taxable + cgst + sgst + igst;
        var grand = Math.Round(beforeRound, 0, MidpointRounding.AwayFromZero);
        return new QuoteTotalsDto(list.Sum(l => l.Kg), material, charges, discount, taxable, cgst, sgst, igst, grand - beforeRound, grand);
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
