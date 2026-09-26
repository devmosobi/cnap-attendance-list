using System.Globalization;
using System.Text;
using Cnap.Attendance.Core.Entities;

namespace Cnap.Attendance.Core.Common;

public static class TypesClub
{
    public static string Libelle(TypeClub type) => type switch
    {
        TypeClub.Rotary => "Rotary Club",
        TypeClub.Rotaract => "Rotaract Club",
        TypeClub.Interact => "Interact Club",
        _ => "Autres"
    };

    private static readonly Dictionary<string, TypeClub> Synonymes = new()
    {
        ["rotary"] = TypeClub.Rotary, ["rotaryclub"] = TypeClub.Rotary, ["rc"] = TypeClub.Rotary,
        ["rotaract"] = TypeClub.Rotaract, ["rotaractclub"] = TypeClub.Rotaract, ["rac"] = TypeClub.Rotaract,
        ["interact"] = TypeClub.Interact, ["interactclub"] = TypeClub.Interact, ["ic"] = TypeClub.Interact,
        ["autre"] = TypeClub.Autre, ["autres"] = TypeClub.Autre, ["other"] = TypeClub.Autre,
    };

    /// <summary>
    /// Lit un type saisi dans un fichier d'import (« Rotary Club », « rotaract », « IC », « Autres »…).
    /// Vide → Autre ; valeur inconnue → null.
    /// </summary>
    public static TypeClub? Lire(string? valeur)
    {
        if (string.IsNullOrWhiteSpace(valeur)) return TypeClub.Autre;
        var cle = new StringBuilder();
        foreach (var c in valeur.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD))
            if (char.IsLetter(c) && CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                cle.Append(c);
        return Synonymes.TryGetValue(cle.ToString(), out var type) ? type : null;
    }
}
