using sunsteel.api.Common.Exceptions;
using sunsteel.api.Features.Weight;

namespace sunsteel.api.Features.Quotes;

/// <summary>What a calculated line works out to.</summary>
public sealed record CalcResult(decimal PieceKg, decimal Kg, string Description, string DimsText, Dictionary<string, double> Dims, string? Section, string? Schedule);

/// <summary>
/// Weight for a calculated quote line. Reuses <see cref="WeightCalculator"/> for every catalogue shape; stainless
/// and mild-steel pipes are two extra shapes that resolve to the same tube formula
/// (π × (OD − WT) × WT × L × ρ), so figures match the public calculator. The editor mirrors this
/// in <c>core/quote/quote-lines.ts</c>; change both.
/// </summary>
public static class QuoteLineCalc
{
    public static readonly string[] Forms = [.. WeightCalculator.Forms, "sspipe", "mspipe"];
    public static readonly string[] StainlessKeys = ["ss300", "ss202", "ss400", "ss431", "ph"];
    public static readonly string[] MsPipeMaterialKeys = ["ms", "alloy"];

    public static CalcResult Calculate(
        string form, string materialKey, string materialName, decimal density, Dictionary<string, double>? dims,
        string? section, string? schedule, double lengthMm, int quantity, int weightDecimals,
        decimal? sectionKgPerMetre, Func<string, string, (decimal Od, decimal Wall)?> pipeLookup)
    {
        var d = dims is null ? new Dictionary<string, double>() : new Dictionary<string, double>(dims);
        if (!Forms.Contains(form)) throw new AppException($"Unknown shape '{form}'.");
        if (!(lengthMm > 0)) throw new AppException("Enter the cut length in mm.");
        var calcForm = form;
        string desc, dimsText;

        switch (form)
        {
            case "sspipe":
                if (!StainlessKeys.Contains(materialKey)) throw new AppException("Stainless pipe needs a stainless steel material.");
                (d["OD"], d["WT"], var id) = ResolveStainless(d);
                d["ID"] = id;
                calcForm = "tube";
                desc = $"SS pipe {N(d["OD"])} OD × {N(id)} ID";
                dimsText = $"OD {N(d["OD"])} × ID {N(id)} ({N(d["WT"])} wall)";
                break;

            case "mspipe":
                if (!MsPipeMaterialKeys.Contains(materialKey)) throw new AppException("Mild steel pipe needs mild / structural or alloy steel.");
                if (string.Equals(schedule, "Custom", StringComparison.OrdinalIgnoreCase))
                {
                    if (!(d.GetValueOrDefault("OD") > 0 && d.GetValueOrDefault("WT") > 0)) throw new AppException("Enter the outside diameter and wall thickness.");
                    desc = $"MS pipe {N(d["OD"])} OD × {N(d["WT"])} wall";
                    dimsText = $"OD {N(d["OD"])} × {N(d["WT"])} wall";
                }
                else
                {
                    var row = pipeLookup(section ?? "", schedule ?? "")
                        ?? throw new AppException($"MS pipe {section} {schedule} is not in the schedule table.");
                    d["OD"] = (double)row.Od;
                    d["WT"] = (double)row.Wall;
                    desc = $"MS pipe {section} {schedule}";
                    dimsText = $"OD {N(d["OD"])} × {N(d["WT"])} wall";
                }
                calcForm = "tube";
                break;

            default:
                desc = $"{FormName(form)} {WeightCalculator.DimText(form, d, section)}".Trim();
                dimsText = WeightCalculator.DimText(form, d, section);
                break;
        }

        if (WeightCalculator.Validate(calcForm, d) is { } problem) throw new AppException(problem);
        var piece = WeightCalculator.PieceKg(calcForm, d, lengthMm, (double)density, (double?)sectionKgPerMetre);
        if (piece <= 0) throw new AppException(form is "beam" or "channel" ? "Pick a section." : "Enter the size.");
        var qty = Math.Max(1, quantity);
        var kg = Math.Round((decimal)piece * qty, weightDecimals, MidpointRounding.AwayFromZero);
        return new CalcResult((decimal)piece, kg, desc, $"{dimsText} × {N(lengthMm)} mm", d, section, schedule);
    }

    /// <summary>OD plus ID or wall thickness: derive the third. ID must be smaller than OD; wall under half the OD.</summary>
    public static (double Od, double Wt, double Id) ResolveStainless(IReadOnlyDictionary<string, double> d)
    {
        double V(string k) => d.TryGetValue(k, out var v) && v > 0 ? v : 0;
        var od = V("OD");
        if (od <= 0) throw new AppException("Enter the outside diameter.");
        double wt, id;
        if (V("ID") > 0)
        {
            id = V("ID");
            if (id >= od) throw new AppException("Inside diameter must be less than the outside diameter.");
            wt = (od - id) / 2;
        }
        else if (V("WT") > 0)
        {
            wt = V("WT");
            if (wt * 2 >= od) throw new AppException("Wall thickness must be less than half the outside diameter.");
            id = od - 2 * wt;
        }
        else throw new AppException("Enter the inside diameter or the wall thickness.");
        return (od, wt, id);
    }

    public static string FormName(string form) => form switch
    {
        "round" => "Round", "square" => "Square", "hex" => "Hex", "flat" => "Flat", "plate" => "Plate",
        "tube" => "Tube", "rect" => "Hollow section", "angle" => "Angle", "beam" => "Beam", "channel" => "Channel",
        _ => form,
    };

    private static string N(double v) => v.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
}
