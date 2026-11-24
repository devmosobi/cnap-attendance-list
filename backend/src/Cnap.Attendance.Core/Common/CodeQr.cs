using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace Cnap.Attendance.Core.Common;

public static partial class CodeQr
{
    public const int Longueur = 20;

    /// <summary>Nombre maximal de codes générés en une fois.</summary>
    public const int GenerationMaximum = 1000;

    /// <summary>Alphabet des codes générés : sans 0, O, 1, I ni L, faciles à confondre à la lecture (31 caractères).</summary>
    internal const string Alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

    /// <summary>Code aléatoire de 20 caractères (générateur cryptographique : les codes ne sont pas devinables).</summary>
    public static string Generer() => RandomNumberGenerator.GetString(Alphabet, Longueur);

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
