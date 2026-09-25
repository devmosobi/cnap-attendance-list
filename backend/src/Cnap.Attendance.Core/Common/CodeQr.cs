using System.Text.RegularExpressions;

namespace Cnap.Attendance.Core.Common;

public static partial class CodeQr
{
    public const int Longueur = 20;

    [GeneratedRegex("^[A-Z0-9]{20}$")]
    private static partial Regex FormatRegex();

    /// <summary>Normalise (trim + majuscules) puis valide le format ; null si invalide.</summary>
    public static string? Normaliser(string? brut)
    {
        if (string.IsNullOrWhiteSpace(brut)) return null;
        var code = brut.Trim().ToUpperInvariant();
        return FormatRegex().IsMatch(code) ? code : null;
    }
}
