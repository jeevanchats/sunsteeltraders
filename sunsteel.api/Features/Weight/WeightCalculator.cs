namespace sunsteel.api.Features.Weight;

/// <summary>
/// Theoretical weight of a metal piece (specification §3.1). Dimensions in mm, density in
/// g/cm³, result in kg. The same formulas ship in sunsteel.web (core/weight/weight.ts); keep
/// both in step. The server recomputes every RFQ line rather than trusting the browser.
/// </summary>
public static class WeightCalculator
{
    public static readonly string[] Forms = ["round", "square", "hex", "flat", "plate", "tube", "sqpipe", "rect", "angle", "beam", "channel"];

    /// <summary>Weight of one piece, or 0 when the dimensions are incomplete or impossible.</summary>
    /// <param name="sectionKgPerMetre">IS 808 kg/m, required for beam and channel.</param>
    public static double PieceKg(string form, IReadOnlyDictionary<string, double> d, double lengthMm, double density, double? sectionKgPerMetre = null)
    {
        double V(string k) => d.TryGetValue(k, out var v) && v > 0 ? v : 0;
        if (lengthMm <= 0) return 0;
        if (Validate(form, d) is not null) return 0;

        var kg = form switch
        {
            "round" => Math.PI * V("D") * V("D") * lengthMm * density / 4_000_000,
            "square" => V("W") * V("W") * lengthMm * density / 1_000_000,
            "hex" => 0.866025 * V("AF") * V("AF") * lengthMm * density / 1_000_000,
            "flat" or "plate" => V("T") * V("W") * lengthMm * density / 1_000_000,
            "tube" => Math.PI * (V("OD") - V("WT")) * V("WT") * lengthMm * density / 1_000_000,
            "sqpipe" => (4 * V("A") - 4 * V("WT")) * V("WT") * lengthMm * density / 1_000_000,
            "rect" => (2 * (V("A") + V("B")) - 4 * V("WT")) * V("WT") * lengthMm * density / 1_000_000,
            "angle" => (V("A") + V("B") - V("T")) * V("T") * lengthMm * density / 1_000_000,
            "beam" or "channel" => (sectionKgPerMetre ?? 0) * lengthMm / 1000,
            _ => 0,
        };
        return double.IsFinite(kg) && kg > 0 ? kg : 0;
    }

    /// <summary>A plain-language problem with the dimensions, or null when they are valid.</summary>
    public static string? Validate(string form, IReadOnlyDictionary<string, double> d)
    {
        double V(string k) => d.TryGetValue(k, out var v) ? v : 0;
        return form switch
        {
            "tube" when V("WT") * 2 >= V("OD") => "Wall thickness must be less than half the outside diameter.",
            "sqpipe" when V("WT") * 2 >= V("A") => "Wall thickness must be less than half the side.",
            "rect" when V("WT") * 2 >= Math.Min(V("A"), V("B")) => "Wall thickness must be less than half the smaller side.",
            "angle" when V("T") >= Math.Min(V("A"), V("B")) => "Thickness must be less than the shorter leg.",
            _ => null,
        };
    }

    /// <summary>Short size text for quotes and WhatsApp, e.g. "Ø80", "50 × 10", "ISMB 300".</summary>
    public static string DimText(string form, IReadOnlyDictionary<string, double> d, string? section = null)
    {
        string F(string k) => d.TryGetValue(k, out var v) ? v.ToString("0.##") : "?";
        return form switch
        {
            "round" => $"Ø{F("D")}",
            "square" => $"{F("W")} sq",
            "hex" => $"{F("AF")} A/F hex",
            "flat" => $"{F("W")} × {F("T")}",
            "plate" => $"{F("T")} × {F("W")}",
            "tube" => $"OD {F("OD")} × {F("WT")} wall",
            "sqpipe" => $"{F("A")} sq × {F("WT")} wall",
            "rect" => $"{F("A")} × {F("B")} × {F("WT")}",
            "angle" => $"{F("A")} × {F("B")} × {F("T")}",
            _ => section ?? "",
        };
    }
}
